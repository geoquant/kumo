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

Order:
1. First line: {"op":"add","path":"/root","value":"<root-key>"}
2. Then add elements top-down (parent before children). Parents include children array upfront.

Available types: Surface, Stack, Grid, Cluster, Text, Button, Badge, Div, Code

## Your Task

Generate a compact confirmation card that asks the user to verify an action before executing it. The card should:
- Use a Surface as root
- Include a heading (Text variant="heading3") describing what will happen
- Include a description row explaining the specifics (use Badge for key values like names, IDs)
- End with exactly two buttons in a Cluster:
  1. Cancel button (variant="outline") with action: { "name": "tool_cancel", "params": { "toolId": "TOOL_ID" } }
  2. Approve button (variant="primary") with action: { "name": "tool_approve", "params": { "toolId": "TOOL_ID" } }

The card should be concise — 6-10 elements maximum. Make it visually clear what the user is approving.

Rules: unique kebab-case keys, key field matches path, compact JSON, one object per line.`;

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
// Follow-up prompt builder
// =============================================================================
//
// `buildCreateWorkerFollowUp` has been moved to `tool-registry.ts` as
// `ToolDefinition.buildFollowUpPrompt` on the `create_worker` entry.
// This avoids duplicating follow-up logic and keeps each tool's lifecycle
// self-contained in the registry.
