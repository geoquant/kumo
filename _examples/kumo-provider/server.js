import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from current directory

// Initialize Anthropic
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Configuration for registry fetching
const REGISTRY_CONFIG = {
  cacheDuration: parseInt(process.env.REGISTRY_CACHE_DURATION || '3600000'), // 1 hour default
  retryAttempts: 3,
  retryDelay: 1000
};

// Cache for component registries (keyed by URL)
const registryCache = new Map();

/**
 * Fetch component registry from remote URL with retry logic and caching
 */
async function fetchRegistry(registryUrl, attempt = 1) {
  const now = Date.now();
  
  // Check cache for this specific URL
  const cached = registryCache.get(registryUrl);
  if (cached && (now - cached.fetchTime) < REGISTRY_CONFIG.cacheDuration) {
    console.log(`📦 Using cached registry for ${registryUrl} (age: ${Math.round((now - cached.fetchTime) / 1000)}s)`);
    return cached.data;
  }
  
  try {
    console.log(`🔄 Fetching component registry (attempt ${attempt}/${REGISTRY_CONFIG.retryAttempts})...`);
    console.log(`   URL: ${registryUrl}`);
    
    const response = await fetch(registryUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Validate registry structure
    if (!data.components || typeof data.components !== 'object') {
      throw new Error('Invalid registry format: missing components object');
    }
    
    // Cache the result
    registryCache.set(registryUrl, { data, fetchTime: now });
    
    const componentCount = Object.keys(data.components).length;
    const version = data.version || 'unknown';
    console.log(`✅ Fetched ${componentCount} components (version: ${version})`);
    
    return data;
  } catch (error) {
    console.error(`❌ Failed to fetch registry (attempt ${attempt}):`, error.message);
    
    // Retry logic
    if (attempt < REGISTRY_CONFIG.retryAttempts) {
      console.log(`   Retrying in ${REGISTRY_CONFIG.retryDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, REGISTRY_CONFIG.retryDelay));
      return fetchRegistry(registryUrl, attempt + 1);
    }
    
    // Return stale cached version if available
    if (cached) {
      console.log('📦 Using stale cached registry as fallback');
      return cached.data;
    }
    
    throw new Error(`Failed to fetch registry after ${REGISTRY_CONFIG.retryAttempts} attempts: ${error.message}`);
  }
}

/**
 * Build AI system prompt from component registry
 * This function is completely library-agnostic and works with any registry format
 * 
 * @param {object} registry - Component registry JSON
 * @param {object} jsonOverrides - Optional JSON structure overrides for compound components
 */
function buildSystemPrompt(registry, jsonOverrides = null) {
  const { components, version } = registry;
  const componentNames = Object.keys(components);
  
  console.log(`🏗️  Building system prompt from ${componentNames.length} components...`);
  
  // Merge JSON overrides into registry (if provided)
  if (jsonOverrides) {
    console.log(`   Merging JSON overrides for ${Object.keys(jsonOverrides).length} components...`);
    Object.keys(jsonOverrides).forEach(componentName => {
      if (components[componentName]) {
        const override = jsonOverrides[componentName];
        
        // Merge props
        if (override.props) {
          components[componentName].props = {
            ...components[componentName].props,
            ...override.props
          };
        }
        
        // Add jsonExample
        if (override.jsonExample) {
          components[componentName].jsonExample = override.jsonExample;
        }
      }
    });
  }
  
  // Analyze registry structure to extract patterns
  const arrayPropPatterns = ['options', 'items', 'tabs', 'rows', 'headers', 'links', 'actions', 'columns'];
  
  // Build comprehensive component descriptions
  const componentDescriptions = componentNames
    .map(name => {
      const comp = components[name];
      const lines = [];
      
      // Component name and description
      const description = comp.description || `${name} component`;
      lines.push(`**${name}**: ${description}`);
      
      // Extract props with detailed information
      if (comp.props && typeof comp.props === 'object') {
        const propEntries = Object.entries(comp.props);
        
        // Filter out callback/function props (they can't be in JSON)
        const isCallbackProp = (prop) => {
          return prop.type && (
            prop.type.includes('=>') || 
            prop.type.includes('function') ||
            prop.type.includes('Function')
          );
        };
        
        const nonCallbackProps = propEntries.filter(([_, prop]) => !isCallbackProp(prop));
        
        // Required props (excluding callbacks)
        const requiredProps = nonCallbackProps.filter(([_, prop]) => prop.required || !prop.optional);
        if (requiredProps.length > 0) {
          const reqPropsStr = requiredProps.map(([propName, prop]) => {
            const typeStr = prop.type === 'enum' && prop.values 
              ? `"${prop.values.join('" | "')}"` 
              : prop.type || 'any';
            return `${propName}: ${typeStr}`;
          }).join(', ');
          lines.push(`  Required props: ${reqPropsStr}`);
        }
        
        // Enum props with defaults (these are critical!)
        const enumProps = nonCallbackProps.filter(([_, prop]) => 
          prop.type === 'enum' && (prop.default || prop.values)
        );
        if (enumProps.length > 0) {
          enumProps.forEach(([propName, prop]) => {
            const defaultValue = prop.default || prop.values?.[0];
            const values = prop.values ? prop.values.join(' | ') : '';
            const desc = prop.descriptions?.[defaultValue] || '';
            lines.push(`  ${propName}: ${values} (default: "${defaultValue}")${desc ? ' - ' + desc : ''}`);
          });
        }
        
        // Array props (detect patterns, excluding callbacks)
        const arrayProps = nonCallbackProps.filter(([propName, prop]) => 
          arrayPropPatterns.some(pattern => propName.toLowerCase().includes(pattern)) ||
          prop.type?.includes('[]') ||
          prop.description?.toLowerCase().includes('array')
        );
        if (arrayProps.length > 0) {
          const arrayPropsStr = arrayProps.map(([propName, prop]) => {
            const desc = prop.description || '';
            return `${propName}${desc ? ` (${desc.slice(0, 60)}...)` : ''}`;
          }).join(', ');
          lines.push(`  Array props: ${arrayPropsStr}`);
        }
        
        // Common props (excluding callbacks)
        const commonProps = nonCallbackProps.filter(([propName, prop]) => 
          ['children', 'className', 'label', 'placeholder', 'disabled'].includes(propName)
        );
        if (commonProps.length > 0) {
          const commonPropsStr = commonProps.map(([propName]) => propName).join(', ');
          lines.push(`  Common props: ${commonPropsStr}`);
        }
      }
      
      // SubComponents (compound components)
      if (comp.subComponents && Object.keys(comp.subComponents).length > 0) {
        const subCompNames = Object.keys(comp.subComponents);
        lines.push(`  Sub-components: ${subCompNames.join(', ')}`);
        lines.push(`  ⚠️  This is a compound component - use special JSON structure`);
      }
      
      // JSON example (if provided in registry - this is the MOST IMPORTANT for compound components!)
      if (comp.jsonExample) {
        lines.push(`  **JSON structure**: ${JSON.stringify(comp.jsonExample)}`);
      }
      // Otherwise, try to convert JSX examples to JSON hints
      else if (comp.examples && Array.isArray(comp.examples) && comp.examples.length > 0) {
        const simpleExample = comp.examples.find(ex => ex && ex.length < 150 && !ex.includes('\n'));
        if (simpleExample) {
          const jsonHint = convertJSXToJSONHint(simpleExample, name);
          if (jsonHint) {
            lines.push(`  JSON example: ${jsonHint}`);
          }
        }
      }
      
      return lines.join('\n');
    })
    .join('\n\n');
  
  // Build rules dynamically from registry patterns
  const rules = [
    '1. ALWAYS respond with valid JSON in this exact format (no markdown, no code blocks, no explanation):',
    '   {"component": "ComponentName", "props": {...}}',
    '',
    '2. Use the exact component names listed above',
    '',
    '3. **CRITICAL**: For enum props (variant, size, etc.), ALWAYS provide a value even if marked optional:',
  ];
  
  // Add specific enum prop rules from registry
  const enumPropExamples = [];
  componentNames.forEach(name => {
    const comp = components[name];
    if (comp.props) {
      const enumProps = Object.entries(comp.props).filter(([_, prop]) => prop.type === 'enum');
      if (enumProps.length > 0) {
        enumProps.forEach(([propName, prop]) => {
          const defaultValue = prop.default || prop.values?.[0];
          if (defaultValue) {
            enumPropExamples.push(
              `   ✅ {"component": "${name}", "props": {"${propName}": "${defaultValue}", ...}}`
            );
          }
        });
      }
    }
  });
  rules.push(...enumPropExamples.slice(0, 5)); // Show up to 5 examples
  
  rules.push(
    '',
    '4. **NEVER include callback/function props** (onValueChange, onClick, onChange, onOpenChange, etc.) in JSON',
    '   - Callbacks cannot be serialized to JSON',
    '   - The loader will provide default implementations',
    '   - ❌ BAD: {"component": "Select", "props": {"onValueChange": () => {}}}',
    '   - ✅ GOOD: {"component": "Select", "props": {"label": "Choose", "options": [...]}}',
    '',
    '5. For components with sub-components (like Table.Header, Dialog.Trigger), use the special JSON structure',
    '   required by the library\'s loader (this is library-specific)',
    '',
    '6. For array props (options, items, tabs, rows, headers, links), provide arrays:',
  );
  
  // Add array prop examples from registry
  const arrayExamples = [];
  componentNames.forEach(name => {
    const comp = components[name];
    if (comp.props) {
      const arrayProps = Object.keys(comp.props).filter(propName =>
        arrayPropPatterns.some(pattern => propName.toLowerCase().includes(pattern))
      );
      if (arrayProps.length > 0) {
        arrayProps.forEach(propName => {
          if (propName === 'options') {
            arrayExamples.push(`   ✅ "${propName}": [{"label": "Option 1", "value": "opt1"}, ...]`);
          } else if (propName === 'items' || propName === 'tabs') {
            arrayExamples.push(`   ✅ "${propName}": [{...}, {...}]`);
          }
        });
      }
    }
  });
  rules.push(...[...new Set(arrayExamples)].slice(0, 3)); // Dedupe and show up to 3
  
  rules.push(
    '',
    '7. You can nest components by including component objects in props',
    '',
    '8. Return ONLY the JSON object, no other text, no explanations',
    '',
    '9. Make the components relevant to the user\'s request'
  );
  
  // Build complete system prompt
  const prompt = `You are a UI component generator that helps users create user interfaces.

You have access to these components from the component library (version: ${version || 'unknown'}):

${componentDescriptions}

IMPORTANT RULES:
${rules.join('\n')}

Examples of correct JSON structure:
✅ Single component: {"component": "Button", "props": {"variant": "primary", "children": "Click me"}}
✅ Nested components: {"component": "Container", "props": {"children": {"component": "Text", "props": {"children": "Hello"}}}}
✅ Array of components: {"component": "Card", "props": {"items": [{"component": "Button", "props": {...}}]}}`;

  return prompt;
}

/**
 * Helper: Convert JSX example to JSON hint
 * Extracts the component structure and converts to JSON format suggestion
 */
function convertJSXToJSONHint(jsx, componentName) {
  try {
    // Simple pattern matching for basic JSX
    const propsMatch = jsx.match(/<\w+\s+([^>]+)>/);
    if (!propsMatch) return null;
    
    const propsStr = propsMatch[1];
    const props = {};
    
    // Extract variant/size/etc enum props
    const enumMatches = propsStr.matchAll(/(\w+)="([^"]+)"/g);
    for (const match of enumMatches) {
      props[match[1]] = match[2];
    }
    
    // Extract children if simple text
    const childrenMatch = jsx.match(/>([^<]+)</);
    if (childrenMatch && childrenMatch[1].trim().length < 30) {
      props.children = childrenMatch[1].trim();
    }
    
    if (Object.keys(props).length === 0) return null;
    
    return JSON.stringify({ component: componentName, props });
  } catch (e) {
    return null;
  }
}

/**
 * Endpoint to get registry info for a specific URL
 */
app.get('/api/registry', async (req, res) => {
  try {
    const registryUrl = req.query.url;
    if (!registryUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: url'
      });
    }
    
    const registry = await fetchRegistry(registryUrl);
    const cached = registryCache.get(registryUrl);
    
    res.json({
      success: true,
      version: registry.version || 'unknown',
      componentCount: Object.keys(registry.components).length,
      components: Object.keys(registry.components),
      url: registryUrl,
      cacheAge: cached ? Math.round((Date.now() - cached.fetchTime) / 1000) : 0,
      cacheDuration: Math.round(REGISTRY_CONFIG.cacheDuration / 1000)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Endpoint to get current system prompt for a registry
 */
app.get('/api/prompt', async (req, res) => {
  try {
    const registryUrl = req.query.url;
    if (!registryUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: url'
      });
    }
    
    const registry = await fetchRegistry(registryUrl);
    const jsonOverrides = req.query.overrides ? JSON.parse(req.query.overrides) : null;
    const prompt = buildSystemPrompt(registry, jsonOverrides);
    
    res.json({
      success: true,
      version: registry.version,
      componentCount: Object.keys(registry.components).length,
      prompt
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Endpoint to force refresh registry cache for a specific URL
 */
app.post('/api/registry/refresh', async (req, res) => {
  try {
    const { registryUrl } = req.body;
    if (!registryUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: registryUrl'
      });
    }
    
    console.log(`🔄 Force refreshing registry cache for ${registryUrl}...`);
    registryCache.delete(registryUrl); // Invalidate cache
    const registry = await fetchRegistry(registryUrl);
    
    res.json({
      success: true,
      message: 'Registry cache refreshed',
      version: registry.version,
      componentCount: Object.keys(registry.components).length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Streaming chat endpoint
 */
app.post('/api/chat', async (req, res) => {
  const { message, registryUrl, promptAdditions } = req.body;

  console.log('User message:', message);
  console.log('Registry URL:', registryUrl);

  // Set headers for Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Validate registryUrl
    if (!registryUrl) {
      throw new Error('registryUrl is required');
    }
    
    // Fetch registry and build base prompt
    const registry = await fetchRegistry(registryUrl);
    
    // Extract JSON overrides from promptAdditions if provided
    const jsonOverrides = promptAdditions?.jsonOverrides || null;
    let systemPrompt = buildSystemPrompt(registry, jsonOverrides);
    
    // Merge library-specific prompt additions if provided
    if (promptAdditions) {
      console.log('📝 Merging library-specific prompt additions...');
      
      if (promptAdditions.rules && Array.isArray(promptAdditions.rules)) {
        console.log(`   Adding ${promptAdditions.rules.length} library-specific rules`);
        const additionalRules = promptAdditions.rules.map((rule, i) => `${8 + i}. ${rule}`).join('\n');
        systemPrompt += `\n\nLibrary-Specific Guidelines:\n${additionalRules}`;
      }
      
      if (promptAdditions.examples) {
        // Examples can be either a string (pre-formatted) or an object
        const examplesText = typeof promptAdditions.examples === 'string' 
          ? promptAdditions.examples
          : Object.entries(promptAdditions.examples)
              .map(([name, ex]) => `${name}: ${JSON.stringify(ex)}`)
              .join('\n');
        const exampleCount = (examplesText.match(/Example:/g) || []).length;
        console.log(`   Adding ${exampleCount} component examples`);
        systemPrompt += `\n\nLibrary-Specific Component Examples:\n${examplesText}`;
      }
    }
    
    // Log the final prompt for debugging
    if (process.env.DEBUG_PROMPT === 'true') {
      console.log('\n=== FULL SYSTEM PROMPT ===');
      console.log(systemPrompt);
      console.log('=== END PROMPT ===\n');
    }
    
    const stream = await anthropic.messages.stream({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2048,
      messages: [
        { 
          role: 'user', 
          content: `${systemPrompt}\n\nUser request: ${message}\n\nRespond with ONLY the JSON object, nothing else.`
        }
      ]
    });

    let buffer = '';
    let lastSentComponent = null;
    let partialUpdateCount = 0;
    let lastArrayLength = 0;
    let hasSentInitialStructure = false;
    let insideArrayProp = false;

    // Function to try parsing and sending updates (library-agnostic progressive rendering)
    const tryParseAndSend = () => {
      try {
        const jsonMatch = buffer.match(/\{[\s\S]*/);
        if (!jsonMatch) return;
        
        let partialJSON = jsonMatch[0];
        
        // Add closing braces to make it parseable
        const openBraces = (partialJSON.match(/\{/g) || []).length;
        const closeBraces = (partialJSON.match(/\}/g) || []).length;
        const openBrackets = (partialJSON.match(/\[/g) || []).length;
        const closeBrackets = (partialJSON.match(/\]/g) || []).length;
        
        const quoteCount = (partialJSON.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) {
          partialJSON += '"';
        }
        
        for (let i = 0; i < openBrackets - closeBrackets; i++) {
          partialJSON += ']';
        }
        for (let i = 0; i < openBraces - closeBraces; i++) {
          partialJSON += '}';
        }
        
        try {
          const parsed = JSON.parse(partialJSON);
          
          if (parsed.component) {
            // Generic progressive rendering: detect when array props grow
            // Look for any array prop that's growing in size
            let currentArrayLength = 0;
            if (parsed.props && typeof parsed.props === 'object') {
              for (const [key, value] of Object.entries(parsed.props)) {
                if (Array.isArray(value)) {
                  currentArrayLength = Math.max(currentArrayLength, value.length);
                }
              }
            }
            
            const hasNewArrayItem = currentArrayLength > lastArrayLength;
            const hasBasicStructure = parsed.component && parsed.props;
            
            // Send initial structure as soon as we have component + props
            if (!hasSentInitialStructure && hasBasicStructure) {
              hasSentInitialStructure = true;
              lastSentComponent = JSON.stringify(parsed);
              
              res.write(`data: ${JSON.stringify({ 
                type: 'partial', 
                data: parsed 
              })}\n\n`);
            }
            // Send updates when array props grow
            else if (hasNewArrayItem) {
              lastArrayLength = currentArrayLength;
              lastSentComponent = JSON.stringify(parsed);
              
              res.write(`data: ${JSON.stringify({ 
                type: 'partial', 
                data: parsed 
              })}\n\n`);
            } else {
              lastSentComponent = JSON.stringify(parsed);
            }
          }
        } catch (parseError) {
          // Continue buffering
        }
      } catch (e) {
        // Continue buffering
      }
    };

    stream.on('text', (text) => {
      buffer += text;
      partialUpdateCount++;
      
      res.write(`data: ${JSON.stringify({ type: 'progress', content: text })}\n\n`);

      // Generic array detection: look for any array prop starting to be populated
      if (!insideArrayProp) {
        const arrayPatternMatch = buffer.match(/"(\w+)":\s*\[/);
        if (arrayPatternMatch) {
          insideArrayProp = true;
        }
      }
      
      // When we're inside an array and see closing braces, try to parse
      if (insideArrayProp && text.includes('}')) {
        tryParseAndSend();
      }

      // Periodically try to parse and send updates
      if (partialUpdateCount % 10 === 0) {
        tryParseAndSend();
      }
    });

    stream.on('end', () => {
      try {
        const jsonMatch = buffer.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const finalParsed = JSON.parse(jsonMatch[0]);
          
          if (finalParsed && finalParsed.component) {
            res.write(`data: ${JSON.stringify({ 
              type: 'component', 
              data: finalParsed 
            })}\n\n`);
          }
        }
      } catch (e) {
        console.error('Failed to parse final JSON:', e);
      }
      
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    });

    stream.on('error', (error) => {
      console.error('Stream Error:', error);
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        message: error.message 
      })}\n\n`);
      res.end();
    });

  } catch (error) {
    console.error('Error:', error);
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      message: error.message 
    })}\n\n`);
    res.end();
  }
});

// Start server (registries are fetched on-demand when user selects them)
console.log('🚀 Starting server with on-demand registry fetching...');
console.log(`⏱️  Registry cache duration: ${REGISTRY_CONFIG.cacheDuration / 1000}s`);

app.listen(port, () => {
  console.log(`\n✅ Server ready!`);
  console.log(`🌐 Server: http://localhost:${port}`);
  console.log(`🤖 AI Chat: http://localhost:${port}/ai-chat.html`);
  console.log(`📊 Registry info: http://localhost:${port}/api/registry?url=<registry-url>`);
  console.log(`📝 Current prompt: http://localhost:${port}/api/prompt?url=<registry-url>`);
  console.log(`🔄 Refresh cache: POST http://localhost:${port}/api/registry/refresh`);
  console.log(`\n💡 Registries are fetched on-demand based on user selection in the UI`);
});
