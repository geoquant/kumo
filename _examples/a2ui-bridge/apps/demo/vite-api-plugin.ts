/**
 * Vite API Plugin
 *
 * Provides a /api/generate endpoint that proxies requests to various LLM APIs.
 * Supports Anthropic (Claude), OpenAI (GPT), and Google (Gemini).
 * This avoids CORS issues when calling the APIs from the browser.
 *
 * Now includes MCP tool integration for Anthropic provider, enabling
 * AI to query the component catalog for more accurate A2UI generation.
 */

import type { Plugin, ViteDevServer } from 'vite';
import { loadEnv } from 'vite';
import { readFileSync } from 'fs';
import { join } from 'path';

type Provider = 'anthropic' | 'openai' | 'google';

interface GenerateRequest {
  provider: Provider;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  system: string;
  messages: Array<{ role: string; content: string | ContentBlock[] }>;
  useMcpTools?: boolean; // Enable MCP tool integration
}

interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: ContentBlock[];
  stop_reason: string;
  stop_sequence: string | null;
  usage: { input_tokens: number; output_tokens: number };
}

interface EnvKeys {
  anthropic?: string;
  openai?: string;
  google?: string;
}

// Default models for each provider
const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: 'claude-opus-4-5-20251101',
  openai: 'gpt-5.2',
  google: 'gemini-3-pro',
};

// ============================================================================
// MCP Tool Definitions and Handlers (inline to avoid ESM import complexity)
// ============================================================================

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

const CATALOG_MCP_TOOLS: AnthropicTool[] = [
  {
    name: 'list_components',
    description: `List all available A2UI components. Use this to discover what UI components you can use.
Returns component names, categories, and descriptions.
Categories: Layout, Typography, Form Inputs, Feedback, Navigation, Overlays, Data Display, Media`,
    input_schema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Optional. Filter by category: Layout, Typography, Form Inputs, Feedback, Navigation, Overlays, Data Display, Media',
        },
      },
    },
  },
  {
    name: 'get_component_schema',
    description: `Get the detailed schema for a specific A2UI component.
Returns the component's props, their types, constraints, and usage examples.
Use this before using a component to ensure you're using it correctly.`,
    input_schema: {
      type: 'object',
      properties: {
        component: {
          type: 'string',
          description: 'The component name (e.g., "Button", "Card", "TextField")',
        },
      },
      required: ['component'],
    },
  },
  {
    name: 'get_layout_patterns',
    description: `Get pre-built layout patterns for common UI needs.
Patterns include: ContactCard, TaskList, LoginForm, ProductCard, SettingsForm, Dashboard, Wizard.
Use this to get recommended component compositions for specific use cases.`,
    input_schema: {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          description: 'Optional. The intent to match (e.g., "contact", "login", "dashboard", "task", "product", "settings", "wizard")',
        },
      },
    },
  },
  {
    name: 'validate_a2ui',
    description: `Validate A2UI JSON before generating output.
Checks that all components exist, props are valid, and structure is correct.
Use this to verify your A2UI JSON is valid before returning it.`,
    input_schema: {
      type: 'object',
      properties: {
        json: {
          type: 'string',
          description: 'The A2UI JSON string to validate',
        },
      },
      required: ['json'],
    },
  },
];

// Load component catalog
interface ComponentDef {
  name: string;
  category: string;
  description: string;
  props: Record<string, unknown>;
  examples?: Array<{ description: string; json: unknown }>;
}

interface LayoutPattern {
  name: string;
  description: string;
  intent: string[];
  template: { root: string; children: string[]; structure: string };
}

interface Catalog {
  version: string;
  components: ComponentDef[];
  patterns: LayoutPattern[];
}

let catalog: Catalog | null = null;

function loadCatalog(): Catalog {
  if (catalog) return catalog;
  // When running from apps/demo, cwd is already apps/demo
  // When running from repo root, we need apps/demo prefix
  const cwd = process.cwd();
  const catalogPath = cwd.endsWith('demo')
    ? join(cwd, 'mcp-server', 'data', 'components.json')
    : join(cwd, 'apps', 'demo', 'mcp-server', 'data', 'components.json');
  catalog = JSON.parse(readFileSync(catalogPath, 'utf-8'));
  return catalog!;
}

// Tool handlers
function handleListComponents(input: { category?: string }): string {
  const cat = loadCatalog();
  let components = cat.components;

  if (input.category) {
    components = components.filter(
      (c) => c.category.toLowerCase() === input.category!.toLowerCase()
    );
  }

  const summary = components.map((c) => ({
    name: c.name,
    category: c.category,
    description: c.description,
  }));

  const grouped: Record<string, typeof summary> = {};
  for (const comp of summary) {
    if (!grouped[comp.category]) grouped[comp.category] = [];
    grouped[comp.category].push(comp);
  }

  return JSON.stringify({
    version: cat.version,
    totalComponents: summary.length,
    categories: Object.keys(grouped),
    components: input.category ? summary : grouped,
  }, null, 2);
}

function handleGetComponentSchema(input: { component: string }): string {
  const cat = loadCatalog();
  const comp = cat.components.find(
    (c) => c.name.toLowerCase() === input.component.toLowerCase()
  );

  if (!comp) {
    return JSON.stringify({
      error: `Component "${input.component}" not found`,
      availableComponents: cat.components.map((c) => c.name).join(', '),
    }, null, 2);
  }

  return JSON.stringify({
    name: comp.name,
    category: comp.category,
    description: comp.description,
    props: comp.props,
    examples: comp.examples || [],
    usage: `Use the "${comp.name}" component: { "component": { "${comp.name}": { ...props } } }`,
  }, null, 2);
}

function handleGetLayoutPatterns(input: { intent?: string }): string {
  const cat = loadCatalog();
  let patterns = cat.patterns;

  if (input.intent) {
    const intentLower = input.intent.toLowerCase();
    patterns = patterns.filter((p) =>
      p.intent.some(i =>
        i.toLowerCase().includes(intentLower) ||
        intentLower.includes(i.toLowerCase())
      )
    );
  }

  if (patterns.length === 0) {
    return JSON.stringify({
      message: `No patterns found matching intent "${input.intent}"`,
      availablePatterns: cat.patterns.map((p) => ({ name: p.name, intent: p.intent })),
    }, null, 2);
  }

  return JSON.stringify({
    matchedPatterns: patterns.length,
    patterns: patterns.map((p) => ({
      name: p.name,
      description: p.description,
      matchingIntent: p.intent,
      structure: p.template.structure,
      requiredComponents: [p.template.root, ...p.template.children],
    })),
  }, null, 2);
}

function handleValidateA2ui(input: { json: string }): string {
  const cat = loadCatalog();

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.json);
  } catch {
    return JSON.stringify({ valid: false, errors: ['Invalid JSON'] }, null, 2);
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const validComponents = new Set(cat.components.map((c) => c.name));

  function validateNode(node: unknown, path: string = 'root'): void {
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;

    if (obj.component && typeof obj.component === 'object') {
      const compObj = obj.component as Record<string, unknown>;
      const componentName = Object.keys(compObj)[0];
      if (componentName && !validComponents.has(componentName)) {
        errors.push(`${path}: Unknown component "${componentName}"`);
      }
    }

    if (!obj.id && obj.component) {
      warnings.push(`${path}: Missing "id" field`);
    }

    if (Array.isArray(obj.children)) {
      obj.children.forEach((child, i) => {
        if (typeof child === 'object') validateNode(child, `${path}.children[${i}]`);
      });
    }
  }

  if (Array.isArray(parsed)) {
    parsed.forEach((item, i) => validateNode(item, `[${i}]`));
  } else {
    validateNode(parsed);
  }

  return JSON.stringify({
    valid: errors.length === 0,
    errors,
    warnings,
    summary: errors.length === 0
      ? `Validation passed${warnings.length > 0 ? ` with ${warnings.length} warning(s)` : ''}`
      : `Validation failed with ${errors.length} error(s)`,
  }, null, 2);
}

function executeToolHandler(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'list_components':
      return handleListComponents(input as { category?: string });
    case 'get_component_schema':
      return handleGetComponentSchema(input as { component: string });
    case 'get_layout_patterns':
      return handleGetLayoutPatterns(input as { intent?: string });
    case 'validate_a2ui':
      return handleValidateA2ui(input as { json: string });
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

// ============================================================================
// Plugin Implementation
// ============================================================================

export function viteApiPlugin(): Plugin {
  const envKeys: EnvKeys = {};

  return {
    name: 'vite-api-plugin',
    config(_, { mode }) {
      const env = loadEnv(mode, process.cwd(), '');
      envKeys.anthropic = env.VITE_ANTHROPIC_API_KEY;
      envKeys.openai = env.VITE_OPENAI_API_KEY;
      envKeys.google = env.VITE_GOOGLE_API_KEY;
    },
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/generate', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        let body = '';
        for await (const chunk of req) {
          body += chunk;
        }

        let requestData: GenerateRequest;
        try {
          requestData = JSON.parse(body);
        } catch {
          res.statusCode = 400;
          res.end('Invalid JSON');
          return;
        }

        const provider = requestData.provider || 'anthropic';
        const apiKey = requestData.apiKey || envKeys[provider];

        if (!apiKey) {
          res.statusCode = 400;
          const envVar = {
            anthropic: 'VITE_ANTHROPIC_API_KEY',
            openai: 'VITE_OPENAI_API_KEY',
            google: 'VITE_GOOGLE_API_KEY',
          }[provider];
          res.end(`API key required for ${provider}. Set ${envVar} in .env file.`);
          return;
        }

        try {
          const model = requestData.model || DEFAULT_MODELS[provider];
          const maxTokens = requestData.maxTokens || 4096;

          let data: unknown;

          if (provider === 'anthropic') {
            // Use MCP tools if enabled
            if (requestData.useMcpTools) {
              data = await callAnthropicWithTools(
                apiKey,
                model,
                maxTokens,
                requestData.system,
                requestData.messages as Array<{ role: string; content: string | ContentBlock[] }>
              );
            } else {
              data = await callAnthropic(apiKey, model, maxTokens, requestData.system, requestData.messages as Array<{ role: string; content: string }>);
            }
          } else if (provider === 'openai') {
            data = await callOpenAI(apiKey, model, maxTokens, requestData.system, requestData.messages as Array<{ role: string; content: string }>);
          } else if (provider === 'google') {
            data = await callGoogle(apiKey, model, maxTokens, requestData.system, requestData.messages as Array<{ role: string; content: string }>);
          } else {
            res.statusCode = 400;
            res.end(`Unknown provider: ${provider}`);
            return;
          }

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify(data));
        } catch (error) {
          console.error(`${provider} API error:`, error);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: String(error) }));
        }
      });

      server.middlewares.use('/api/providers', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.statusCode = 204;
          res.end();
          return;
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify({
          anthropic: !!envKeys.anthropic,
          openai: !!envKeys.openai,
          google: !!envKeys.google,
        }));
      });
    },
  };
}

/**
 * Call Anthropic Claude API (basic, no tools)
 */
async function callAnthropic(
  apiKey: string,
  model: string,
  maxTokens: number,
  system: string,
  messages: Array<{ role: string; content: string }>
) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Call Anthropic Claude API with MCP tool integration
 *
 * This handles the tool use loop:
 * 1. Send request with tools
 * 2. If AI calls tools, execute them and send results back
 * 3. Repeat until AI returns final text response
 */
async function callAnthropicWithTools(
  apiKey: string,
  model: string,
  maxTokens: number,
  system: string,
  messages: Array<{ role: string; content: string | ContentBlock[] }>
): Promise<AnthropicResponse> {
  // Enhance system prompt to mention available tools
  const enhancedSystem = `${system}

## MCP Tools Available

You have access to the following tools to help generate accurate A2UI:

1. **list_components** - Discover available UI components by category
2. **get_component_schema** - Get detailed props and constraints for a component
3. **get_layout_patterns** - Get pre-built patterns for common UI needs (login, contact, dashboard, etc.)
4. **validate_a2ui** - Validate your A2UI JSON before returning it

Use these tools when you're unsure about component names, props, or structure. They ensure your output is valid and follows best practices.`;

  // Clone messages to avoid mutating the original
  const conversationMessages = [...messages];

  // Maximum iterations to prevent infinite loops
  const maxIterations = 10;
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: enhancedSystem,
        messages: conversationMessages,
        tools: CATALOG_MCP_TOOLS,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const data: AnthropicResponse = await response.json();

    // Check if AI wants to use tools
    const toolUseBlocks = data.content.filter(block => block.type === 'tool_use');

    if (toolUseBlocks.length === 0 || data.stop_reason === 'end_turn') {
      // No tool calls, return the response
      return data;
    }

    // Execute tool calls
    console.log(`[MCP] AI called ${toolUseBlocks.length} tool(s):`, toolUseBlocks.map(t => t.name).join(', '));

    // Add assistant's response to conversation
    conversationMessages.push({
      role: 'assistant',
      content: data.content,
    });

    // Execute tools and collect results
    const toolResults: ContentBlock[] = toolUseBlocks.map(toolBlock => {
      const result = executeToolHandler(
        toolBlock.name!,
        toolBlock.input as Record<string, unknown>
      );
      console.log(`[MCP] ${toolBlock.name} result:`, result.substring(0, 200) + '...');
      return {
        type: 'tool_result',
        tool_use_id: toolBlock.id!,
        content: result,
      };
    });

    // Add tool results to conversation
    conversationMessages.push({
      role: 'user',
      content: toolResults,
    });
  }

  throw new Error('Max iterations reached in tool use loop');
}

/**
 * Call OpenAI GPT API
 */
async function callOpenAI(
  apiKey: string,
  model: string,
  maxTokens: number,
  system: string,
  messages: Array<{ role: string; content: string }>
) {
  const openaiMessages = [
    { role: 'system', content: system },
    ...messages,
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: openaiMessages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  return {
    content: [{ text: data.choices?.[0]?.message?.content || '' }],
  };
}

/**
 * Call Google Gemini API
 */
async function callGoogle(
  apiKey: string,
  model: string,
  maxTokens: number,
  system: string,
  messages: Array<{ role: string; content: string }>
) {
  const geminiContents = messages.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: geminiContents,
        generationConfig: {
          maxOutputTokens: maxTokens,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return {
    content: [{ text }],
  };
}

export default viteApiPlugin;
