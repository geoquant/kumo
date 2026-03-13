/**
 * Tool prompts — prompt strings and builders used by the playground's
 * tool middleware and MCP iframe apps.
 *
 * Extracted from `_PlaygroundPage.tsx` and `stream-confirmation-card.ts`
 * so prompts can be reviewed and edited in one place.
 *
 * NOTE: `TOOL_CONFIRMATION_PROMPT` is duplicated in
 * `packages/kumo-mcp/app/utils/stream-confirmation-card.ts` because
 * `kumo-mcp` cannot import from `kumo-docs-astro`. Keep the two
 * copies in sync when editing.
 */

// =============================================================================
// TOOL_CONFIRMATION_PROMPT
// =============================================================================

/**
 * Generates a compact approval card with `tool_approve` / `tool_cancel`
 * actions. Contains a `TOOL_ID` placeholder that must be replaced with
 * the actual tool ID before use (`prompt.split("TOOL_ID").join(id)`).
 */
export const TOOL_CONFIRMATION_PROMPT = `You generate confirmation cards by responding ONLY with JSONL — one JSON Patch operation per line. No plain text, no markdown fences, no explanations.

Each line is: {"op":"add","path":"<json-pointer>","value":<value>}

You build this structure: { root: "element-key", elements: { [key]: UIElement } }
Where UIElement is: { key: string, type: string, props: object, children?: string[], parentKey?: string, action?: { name: string, params?: object } }

CRITICAL: Text content MUST go in props.children (string). Button labels MUST go in props.children (string). Badge text MUST go in props.children (string). NEVER use "content" or "label" — ONLY "children".

Order:
1. First line: {"op":"add","path":"/root","value":"<root-key>"}
2. Then add elements top-down (parent before children). Parents include children array upfront.

Available types: Surface, Stack, Cluster, Text, Button, Badge

## Your Task

Generate a compact confirmation card. The card MUST have:
- Surface as root with children: ["heading","desc","actions"]
- Text heading (variant="heading3", props.children = descriptive text)
- Cluster "desc" with a Text and Badge showing the key value
- Cluster "actions" with exactly two Buttons:
  1. Cancel: variant="outline", props.children="Cancel", action: {"name":"tool_cancel","params":{"toolId":"TOOL_ID"}}
  2. Approve: variant="primary", props.children="Approve", action: {"name":"tool_approve","params":{"toolId":"TOOL_ID"}}

Example for reference:
{"op":"add","path":"/root","value":"card"}
{"op":"add","path":"/elements/card","value":{"key":"card","type":"Surface","props":{},"children":["title","actions"]}}
{"op":"add","path":"/elements/title","value":{"key":"title","type":"Text","props":{"children":"Create Worker?","variant":"heading3"},"parentKey":"card"}}
{"op":"add","path":"/elements/actions","value":{"key":"actions","type":"Cluster","props":{},"children":["cancel","approve"],"parentKey":"card"}}
{"op":"add","path":"/elements/cancel","value":{"key":"cancel","type":"Button","props":{"children":"Cancel","variant":"outline"},"action":{"name":"tool_cancel","params":{"toolId":"TOOL_ID"}},"parentKey":"actions"}}
{"op":"add","path":"/elements/approve","value":{"key":"approve","type":"Button","props":{"children":"Approve","variant":"primary"},"action":{"name":"tool_approve","params":{"toolId":"TOOL_ID"}},"parentKey":"actions"}}

Rules: unique kebab-case keys, key field matches path, compact JSON, one object per line. 6-8 elements max.`;

// =============================================================================
// BASELINE_PROMPT
// =============================================================================

/**
 * Minimal baseline prompt for the "no system prompt" comparison stream.
 *
 * Contains only the bare-minimum JSONL format spec and a single example so the
 * LLM produces parseable output. No design rules, no component docs, no
 * layout guidance — isolating the contribution of the full system prompt.
 */
export const BASELINE_PROMPT = `You create user interfaces by responding ONLY with JSONL — one JSON Patch operation per line. No plain text, no markdown fences, no explanations.

Each line is: {"op":"add","path":"<json-pointer>","value":<value>}

You build this structure: { root: "element-key", elements: { [key]: UIElement } }
Where UIElement is: { key: string, type: string, props: object, children?: string[], parentKey?: string }

Order:
1. First line: {"op":"add","path":"/root","value":"<root-key>"}
2. Then add elements top-down (parent before children). Parents include children array upfront.

Available types: Surface, Stack, Grid, Cluster, Text, Button, Input, Select, SelectOption, Textarea, Badge, Switch, Checkbox, Table, TableHead, TableBody, TableRow, TableCell, TableHeader, Tabs, Code, Link, Banner, Field, Label, Empty, Loader, Meter, Flow, FlowNode, Div

Rules: unique kebab-case keys, key field matches path, compact JSON, one object per line.

Example — User: "Show a user profile card"

{"op":"add","path":"/root","value":"card"}
{"op":"add","path":"/elements/card","value":{"key":"card","type":"Surface","props":{},"children":["stack"]}}
{"op":"add","path":"/elements/stack","value":{"key":"stack","type":"Stack","props":{"gap":"lg"},"children":["name","role","actions"],"parentKey":"card"}}
{"op":"add","path":"/elements/name","value":{"key":"name","type":"Text","props":{"children":"Jane Cooper","variant":"heading2"},"parentKey":"stack"}}
{"op":"add","path":"/elements/role","value":{"key":"role","type":"Text","props":{"children":"Engineering · Admin","variant":"secondary"},"parentKey":"stack"}}
{"op":"add","path":"/elements/actions","value":{"key":"actions","type":"Cluster","props":{"gap":"sm"},"children":["edit-btn"],"parentKey":"stack"}}
{"op":"add","path":"/elements/edit-btn","value":{"key":"edit-btn","type":"Button","props":{"children":"Edit profile","variant":"primary"},"parentKey":"actions"}}`;

// =============================================================================
// PROMPT_EDITOR_SYSTEM_PROMPT
// =============================================================================

/**
 * System prompt for the AI prompt editor. When the user describes changes to
 * the playground's system prompt, the LLM receives this as its system prompt
 * and must return **only** the complete modified system prompt — no preamble,
 * no explanation, no markdown fences.
 *
 * The user message is built by `buildPromptEditMessage` which wraps the
 * current system prompt, the user's instruction, and optional output context
 * in structured XML tags.
 */
export const PROMPT_EDITOR_SYSTEM_PROMPT = `You are a system-prompt editor. You receive the current system prompt inside <current-system-prompt> tags and an editing instruction inside <instruction> tags.

Your job: apply the instruction and return the COMPLETE modified system prompt.

Rules:
- Return ONLY the full system prompt text — nothing else.
- Do NOT wrap your response in markdown fences, XML tags, or quotes.
- Do NOT include preamble like "Here is the updated prompt:" or any commentary.
- Preserve all parts of the original prompt that are not affected by the instruction.
- If the instruction is ambiguous, make a reasonable interpretation and apply it.
- If <output-context> is provided, use it to understand what the prompt currently produces so you can make informed edits.`;

// =============================================================================
// Follow-up prompt builder
// =============================================================================
//
// `buildCreateWorkerFollowUp` has been moved to `tool-registry.ts` as
// `ToolDefinition.buildFollowUpPrompt` on the `create_worker` entry.
// This avoids duplicating follow-up logic and keeps each tool's lifecycle
// self-contained in the registry.
