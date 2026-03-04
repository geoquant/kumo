# MCP-UI Playground — Real Tool Execution via MCP Protocol

**Type:** Feature Plan
**Effort:** XL (5–8 days)
**Status:** Draft
**Branch:** `geoquant/streaming-ui`

> **CRITICAL: All work MUST be on branch `geoquant/streaming-ui`. Do NOT create new branches or use `main`.**

---

## Problem Statement

**Who:** Kumo playground users (internal developers evaluating the component library)
**What:** The "Create Worker" flow is architectural theater — regex intercept, fake 800ms delay, no real tool execution, no isolation, no extensibility. Everything is crammed into `_PlaygroundPage.tsx` (2651 lines).
**Why it matters:** The playground is supposed to demonstrate production patterns. The current tool middleware is a prototype that can't scale to additional tools, can't execute real actions, and has no security boundary between tool UIs and the host.
**Evidence:** The original PRD explicitly parked MCP integration as a future consideration. The `_inspo/mcp-ui/exercises/05.advanced/` reference material implements the exact architecture needed.

### Goal

Replace the prototype tool middleware with a real MCP-based architecture:

1. MCP server (`packages/kumo-mcp`) owns tool definitions and execution
2. Tool confirmation UIs render in sandboxed iframes communicating via `postMessage`
3. Streaming works inside iframes (iframe fetches its own SSE stream)
4. Extensible tool registry — adding a new tool doesn't require modifying the playground's submit handler
5. A/B panels continue using `/api/chat` for AI-generated content (unchanged)

---

## Proposed Solution

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  kumo-docs-astro (Astro site)                                       │
│                                                                     │
│  PlaygroundPage (chat sidebar + A/B panels)                         │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Chat Sidebar                                                   │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │ <iframe src="kumo-mcp-worker/ui/create-worker-confirm">  │  │ │
│  │  │                                                          │  │ │
│  │  │   Streams JSONL from /api/chat inside iframe             │  │ │
│  │  │   Renders confirmation card (Approve / Cancel)           │  │ │
│  │  │   postMessage({type:'tool', toolName:'create_worker'})   │  │ │
│  │  │       ↕ postMessage                                      │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  │                                                                │ │
│  │  Host receives tool action                                     │ │
│  │  → calls MCP server tool (create_worker)                       │ │
│  │  → returns structuredContent to iframe                         │ │
│  │  → if success, fires follow-up prompt to A/B panels            │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────���──────────┐  ┌─────────────────┐                          │
│  │ Panel A          │  │ Panel B          │  (unchanged — /api/chat) │
│  │ streams JSONL    │  │ streams JSONL    │                          │
│  └─────────────────┘  └─────────────────┘                          │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  packages/kumo-mcp (Cloudflare Worker + Durable Object)             │
│                                                                     │
│  McpAgent subclass                                                  │
│  ├─ Tool: create_worker                                             │
│  │   ├─ Returns UI resource (iframe URL for confirmation)           │
│  │   └─ On execution: mock API call → structuredContent             │
│  └─ (future tools here)                                             │
│                                                                     │
│  Serves iframe apps:                                                │
│  ├─ /ui/create-worker-confirm → React app (streaming card)          │
│  └─ (future tool UIs here)                                          │
└─────────────────────────────────────────────────────────────────────┘
```

### Streaming Strategy

MCP tool results don't stream — they return complete objects. The streaming UX is achieved by the **iframe app streaming its own content internally**:

1. MCP server returns a UI resource with `{ type: 'externalUrl', iframeUrl }`.
2. The iframe app loads and calls its own streaming endpoint (e.g., the docs site's `/api/chat` with `TOOL_CONFIRMATION_PROMPT`).
3. The iframe renders tokens progressively using the existing `readSSEStream` → `createJsonlParser` → `applyPatch` → `UITreeRenderer` pipeline.
4. When the user clicks Approve/Cancel, the iframe sends a `postMessage` to the host.
5. The host forwards the tool call to the MCP server, which executes the tool and returns `structuredContent`.
6. The host relays the result back to the iframe via `postMessage`.

This keeps streaming as a presentation concern (inside the iframe) while MCP handles tool execution as a protocol concern.

### Key Insight: Separation of Concerns

| Concern                           | Owner                           | Protocol                            |
| --------------------------------- | ------------------------------- | ----------------------------------- |
| Tool definition + execution       | MCP server (kumo-mcp)           | MCP tool_call/tool_result           |
| Confirmation UI rendering         | Iframe app (served by kumo-mcp) | Internal SSE streaming              |
| User interaction (approve/cancel) | Iframe → Host                   | postMessage                         |
| Tool execution request            | Host → MCP server               | MCP client SDK                      |
| Tool result delivery              | Host → Iframe                   | postMessage (`ui-message-response`) |
| A/B panel generation              | Host → /api/chat                | SSE (unchanged)                     |
| Iframe lifecycle                  | UIResourceRenderer              | postMessage (`ui-lifecycle-*`)      |

---

## Scope & Deliverables

| #   | Deliverable                                              | Effort | Depends On | Phase |
| --- | -------------------------------------------------------- | ------ | ---------- | ----- |
| D1  | `packages/kumo-mcp` — MCP server package scaffold        | M      | —          | 1     |
| D2  | `create_worker` tool definition + mock execution         | S      | D1         | 1     |
| D3  | Confirmation iframe app (React, streaming card)          | L      | D1         | 1     |
| D4  | `postMessage` protocol utilities (host + iframe)         | M      | —          | 1     |
| D5  | Host-side iframe embedding in chat sidebar               | M      | D3, D4     | 2     |
| D6  | Host-side MCP client integration                         | M      | D1, D4     | 2     |
| D7  | Tool action flow wiring (approve → MCP execute → panels) | L      | D5, D6     | 2     |
| D8  | Refactor `_PlaygroundPage.tsx` — extract tool middleware | M      | D7         | 3     |
| D9  | Tool registry pattern for extensibility                  | S      | D8         | 3     |

### Phase 1: MCP Server + Iframe App (3 days)

Build the MCP server and the streaming confirmation iframe independently. Can be developed and tested in isolation.

### Phase 2: Integration (2–3 days)

Wire the iframe into the playground chat, connect to MCP server, handle the full approve/cancel/panel flow.

### Phase 3: Cleanup (1–2 days)

Refactor the monolithic `_PlaygroundPage.tsx`, extract tool middleware into a clean pattern, make it easy to add new tools.

---

## Non-Goals (Explicit Exclusions)

- **Real Cloudflare API calls** — `create_worker` tool stays mocked (800ms delay, fake success)
- **Migrating existing pills** — Only "Create Worker" uses MCP. Other 6 pills stay as-is
- **Library-first exports** — No `@cloudflare/kumo/mcp` exports. Build in playground, extract later
- **OAuth/auth for MCP** — No auth on the MCP server. It's a demo
- **Multiple tools** — Only `create_worker`. Tool registry designed for extensibility but only one tool ships
- **Changing A/B panel architecture** — Panels still stream from `/api/chat`. No render-data push for panels
- **Production deployment** — `kumo-mcp` Worker deployed to dev/staging only; can share the `kumo-ui.com` zone or use a subdomain

---

## Data Model

### postMessage Protocol Types

```typescript
// ─── Iframe → Host ───

/** Iframe signals it has loaded and is ready */
interface IframeReadyMessage {
  type: "ui-lifecycle-iframe-ready";
}

/** Iframe reports its content dimensions */
interface IframeSizeMessage {
  type: "ui-size-change";
  payload: { height: number; width: number };
}

/** Iframe requests tool execution */
interface ToolCallMessage {
  type: "tool";
  messageId: string; // crypto.randomUUID()
  payload: {
    toolName: string;
    params: Record<string, unknown>;
  };
}

// ─── Host → Iframe ───

/** Host delivers initial data to iframe */
interface RenderDataMessage {
  type: "ui-lifecycle-iframe-render-data";
  payload: {
    renderData?: Record<string, unknown>;
    error?: unknown;
  };
}

/** Host delivers tool execution result */
interface ToolResponseMessage {
  type: "ui-message-response";
  messageId: string; // correlates with ToolCallMessage.messageId
  payload: {
    response?: unknown; // tool result (e.g. { success: boolean })
    error?: unknown;
  };
}
```

### MCP Server Types

```typescript
// Tool: create_worker
interface CreateWorkerInput {
  workerName: string;
}

interface CreateWorkerResult {
  success: boolean;
  workerName: string;
  createdAt: string; // ISO 8601
}
```

### Chat Message Extension

```typescript
// Existing (unchanged)
type ToolMessageStatus =
  | "streaming" // iframe loading / streaming content
  | "pending" // awaiting user action
  | "approved" // user approved (transient)
  | "applying" // MCP tool executing
  | "completed" // tool succeeded
  | "cancelled"; // user cancelled

// New: ToolChatMessage carries iframe URL instead of inline UITree
interface ToolChatMessage {
  role: "tool";
  toolId: string;
  iframeUrl: string; // URL of the confirmation iframe app
  status: ToolMessageStatus;
  renderData?: Record<string, unknown>; // initial data for iframe
}
```

### Client Utilities (iframe-side)

```typescript
/** Send a tool call to the host and await the result */
function sendMcpMessage<T>(
  type: "tool",
  payload: { toolName: string; params: Record<string, unknown> },
  options?: { schema?: z.ZodSchema<T> },
): Promise<T>;

/** Wait for initial render data from the host */
function waitForRenderData<T>(schema: z.ZodSchema<T>): Promise<T>;

/** Signal iframe readiness and report initial dimensions */
function useMcpUiInit(rootRef: React.RefObject<HTMLDivElement | null>): void;
```

---

## API/Interface Contract

### MCP Server (`packages/kumo-mcp`)

```
POST /mcp → McpAgent.serve() (streamable-http transport)
GET  /ui/create-worker-confirm → React app (Vite-built, served as static asset)
```

The MCP server exposes one tool:

```
Tool: create_worker
  Input:  { workerName: string }
  Output: UI resource (externalUrl → /ui/create-worker-confirm)
          + uiMetadata: { 'initial-render-data': { workerName, toolId } }

  On execution (after approval):
    Input:  { workerName: string }
    Output: { content: [{ type: 'text', text: '...' }] }
            + structuredContent: { success: true, workerName, createdAt }
```

### Host ↔ Iframe Communication

The host (PlaygroundPage) embeds an `<iframe>` in the chat sidebar. Communication follows the MCP-UI postMessage protocol (see Data Model above). The host:

1. Receives `ui-lifecycle-iframe-ready` → sends `ui-lifecycle-iframe-render-data` with `{ workerName, toolId }`
2. Receives `tool` message (approve/cancel) → if approve, calls MCP server `create_worker` tool → sends `ui-message-response` with result
3. On successful result → fires follow-up prompt to A/B panels (existing flow, unchanged)

### Iframe App

The confirmation iframe app at `/ui/create-worker-confirm`:

1. Loads, calls `waitForRenderData(schema)` to get `{ workerName, toolId }`
2. Fetches `/api/chat` (on the docs site, not the MCP server) with `TOOL_CONFIRMATION_PROMPT` to stream the confirmation card
3. Renders the streaming card using `UITreeRenderer`
4. When user clicks Approve: calls `sendMcpMessage('tool', { toolName: 'create_worker', params: { workerName } }, { schema })`
5. Receives `{ success: true }` → shows "Applied" overlay
6. When user clicks Cancel: sends a `tool` message with `toolName: 'tool_cancel'` → host updates status

---

## Detailed Design

### D1: `packages/kumo-mcp` — MCP Server Scaffold

New Cloudflare Worker package in the monorepo:

```
packages/kumo-mcp/
├── worker/
│   ├── index.ts              # Worker entrypoint, routes /mcp to DO
│   └── mcp/
│       ├── index.ts           # McpAgent subclass (KumoPlaygroundMCP)
│       └── tools.ts           # Tool registrations
├── app/                       # Iframe React apps
│   ├── utils/
│   │   └── mcp.ts             # sendMcpMessage, waitForRenderData, useMcpUiInit
│   └── routes/
│       └── ui/
│           └── create-worker-confirm.tsx  # Confirmation card app
├── wrangler.jsonc
├── package.json
├── tsconfig.json
└── vite.config.ts
```

Dependencies:

- `agents` (McpAgent base class)
- `@modelcontextprotocol/sdk` (McpServer, MCP types)
- `@mcp-ui/server` (createUIResource)
- `@cloudflare/vite-plugin` (Vite integration)
- `react`, `react-dom`, `react-router` (iframe app)
- `zod` (schemas)

The iframe app imports `@cloudflare/kumo` components + `UITreeRenderer` from `@cloudflare/kumo/streaming` for rendering the streamed card. It also imports `readSSEStream` and `createJsonlParser` from the docs site's shared utilities (or these get extracted to a shared location).

**Open question:** The iframe needs to call the docs site's `/api/chat` for streaming. This is a cross-origin request (kumo-mcp Worker → kumo-docs Worker). CORS headers needed on `/api/chat`, or the iframe is served from the same origin as the docs site.

**Decision:** Serve iframe apps from the docs site origin. The MCP server at `packages/kumo-mcp` only handles `/mcp` (MCP protocol). The iframe HTML/JS is built by `kumo-mcp` but deployed alongside the docs site (or served via a proxy route). This avoids CORS entirely.

Alternative: The MCP Worker serves its own `/api/chat` endpoint that proxies to Workers AI. This duplicates the docs site's chat endpoint but keeps `kumo-mcp` self-contained.

### D2: `create_worker` Tool

```typescript
// worker/mcp/tools.ts
import { createUIResource } from "@mcp-ui/server";
import { z } from "zod";

export function initializeTools(agent: KumoPlaygroundMCP) {
  // Phase 1: Tool returns UI resource for confirmation
  agent.server.tool(
    "create_worker",
    "Create a new Cloudflare Worker",
    { workerName: z.string().describe("Name for the new Worker") },
    async ({ workerName }) => {
      const iframeUrl = new URL(
        "/ui/create-worker-confirm",
        agent.requireBaseUrl(),
      );

      return {
        content: [
          await createUIResource({
            uri: `ui://create-worker/${workerName}`,
            content: { type: "externalUrl", iframeUrl: iframeUrl.toString() },
            encoding: "text",
            uiMetadata: {
              "initial-render-data": {
                workerName,
                toolId: `create-worker-${workerName}`,
              },
              "preferred-frame-size": ["100%", "280px"],
            },
          }),
        ],
      };
    },
  );

  // Phase 2: Separate execution tool (called after approval)
  agent.server.tool(
    "execute_create_worker",
    "Execute the worker creation (after user approval)",
    { workerName: z.string() },
    async ({ workerName }) => {
      // Mock execution
      await new Promise((resolve) => setTimeout(resolve, 800));

      return {
        content: [
          {
            type: "text" as const,
            text: `Worker "${workerName}" created successfully.`,
          },
        ],
        // structuredContent is non-standard but our host understands it
        structuredContent: {
          success: true,
          workerName,
          createdAt: new Date().toISOString(),
        },
      };
    },
  );
}
```

**Design note:** Two separate tools — `create_worker` returns the UI resource, `execute_create_worker` does the actual work. This mirrors the MCP-UI pattern where the confirmation UI and execution are decoupled.

### D3: Confirmation Iframe App

A minimal React app served at `/ui/create-worker-confirm`:

```typescript
// app/routes/ui/create-worker-confirm.tsx
export async function clientLoader() {
  const schema = z.object({
    workerName: z.string(),
    toolId: z.string(),
  })
  const renderData = await waitForRenderData(schema)
  return renderData
}

export function HydrateFallback() {
  return <Loader /> // shown while waitForRenderData resolves
}

export default function CreateWorkerConfirm() {
  const { workerName, toolId } = useLoaderData<typeof clientLoader>()
  const [status, setStatus] = useState<'streaming' | 'pending' | 'applying' | 'completed' | 'cancelled'>('streaming')
  const [tree, setTree] = useState<UITree>({})

  // Stream confirmation card from /api/chat
  useEffect(() => {
    streamConfirmationCard(workerName, toolId, {
      onPatch: (newTree) => setTree(newTree),
      onComplete: () => setStatus('pending'),
    })
  }, [workerName, toolId])

  const handleAction = async (event: ActionEvent) => {
    if (event.actionName === 'tool_cancel') {
      setStatus('cancelled')
      // Notify host
      sendMcpMessage('tool', { toolName: 'tool_cancel', params: { toolId } })
      return
    }
    if (event.actionName === 'tool_approve') {
      setStatus('applying')
      const result = await sendMcpMessage('tool',
        { toolName: 'execute_create_worker', params: { workerName } },
        { schema: z.object({ success: z.boolean() }) }
      )
      setStatus(result.success ? 'completed' : 'cancelled')
    }
  }

  return (
    <div ref={rootRef}>
      <UITreeRenderer tree={tree} onAction={status === 'pending' ? handleAction : undefined} />
      {status === 'applying' && <Overlay><Loader /></Overlay>}
      {status === 'completed' && <Overlay><CheckIcon /> Applied</Overlay>}
    </div>
  )
}
```

The `streamConfirmationCard` function:

1. Fetches the docs site `/api/chat` with `{ skipSystemPrompt: true, systemPromptOverride: TOOL_CONFIRMATION_PROMPT }`
2. Uses `readSSEStream` + `createJsonlParser` + `applyPatch` to build the tree progressively
3. Reports patches to the component via callback

### D4: postMessage Protocol Utilities

Two copies: one for iframe apps (`packages/kumo-mcp/app/utils/mcp.ts`), one for the host (`packages/kumo-docs-astro/src/lib/mcp-host.ts`).

**Iframe-side** (adapted from exercise 05):

- `sendMcpMessage(type, payload, options?)` — sends typed postMessage, awaits correlated response
- `waitForRenderData(schema)` — lifecycle: ready signal → receive render data → Zod validate
- `useMcpUiInit(rootRef)` — effect hook: signals ready + reports dimensions

**Host-side** (new):

- `createIframeMessageHandler(config)` — returns a `message` event listener that:
  - Handles `ui-lifecycle-iframe-ready` → responds with render data from config
  - Handles `tool` messages → delegates to MCP client → responds with result
  - Handles `ui-size-change` → calls resize callback
- `McpToolIframe` component — manages iframe lifecycle, wires up message handler, exposes status

### D5: Host-Side Iframe Embedding

Replace inline `UITreeRenderer` in chat messages with `McpToolIframe`:

```tsx
// In chat message rendering
case 'tool':
  return (
    <McpToolIframe
      src={msg.iframeUrl}
      renderData={msg.renderData}
      status={msg.status}
      onToolAction={handleToolAction}
      onStatusChange={(status) => updateToolMessageStatus(msg.toolId, status)}
      className="w-full rounded-lg border border-kumo-line overflow-hidden"
      style={{ height: '280px' }} // from preferred-frame-size
    />
  )
```

`McpToolIframe` responsibilities:

- Renders `<iframe src={src} sandbox="allow-scripts allow-same-origin">`
- Listens for postMessage events from the iframe
- Handles lifecycle (ready → render data, size changes)
- Delegates tool actions to parent via `onToolAction`
- Applies status-based styling (loading overlay, disabled state)

### D6: Host-Side MCP Client

The playground needs an MCP client to call tools on the `kumo-mcp` server.

**Option A:** Use `@modelcontextprotocol/sdk/client` directly from the browser.
**Option B:** Proxy tool calls through a docs-site API endpoint (`/api/mcp-proxy`).
**Option C:** Since the MCP server is mocked anyway, keep tool execution client-side but use MCP types.

**Recommendation:** Option B. The MCP server runs on a Durable Object — the browser can't directly connect to it via streamable-http (CORS, session management). A thin proxy endpoint in the docs site forwards tool calls to the MCP server via service binding or fetch.

```typescript
// packages/kumo-docs-astro/src/pages/api/mcp-proxy.ts
export const POST: APIRoute = async ({ request, locals }) => {
  const { toolName, params } = await request.json();
  // Forward to kumo-mcp Worker
  const response = await fetch(`${MCP_SERVER_URL}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: toolName, arguments: params },
    }),
  });
  return response;
};
```

**Or** with a Cloudflare service binding (if both Workers are in the same account):

```jsonc
// kumo-docs-astro wrangler.jsonc
{
  "services": [{ "binding": "MCP_SERVER", "service": "kumo-mcp" }],
}
```

### D7: Full Flow Wiring

The complete flow after integration:

1. User clicks "Create worker" pill
2. `handleSubmit` detects the pattern (regex stays as the trigger mechanism for now — this is the playground's UX decision, not the MCP server's)
3. Instead of streaming a card directly, the host:
   a. Calls MCP server `create_worker` tool → gets UI resource with iframe URL + render data
   b. Creates a `ToolChatMessage` with `iframeUrl` and `renderData`
   c. The `McpToolIframe` component renders in the chat
4. Iframe loads → streams confirmation card → shows Approve/Cancel
5. User clicks Approve → iframe sends `tool` postMessage → host proxies to MCP → `execute_create_worker` runs → result returned to iframe
6. Iframe shows "Applied" overlay
7. Host detects successful execution → fires follow-up prompt to A/B panels (existing flow)

### D8: Refactor `_PlaygroundPage.tsx`

Extract from the 2651-line monolith:

| Extract            | Target                       | What                                                                                  |
| ------------------ | ---------------------------- | ------------------------------------------------------------------------------------- |
| Tool middleware    | `src/lib/tool-middleware.ts` | `matchCreateWorkerMessage`, `handleToolAction`, `updateToolMessageStatus`, status FSM |
| MCP host utilities | `src/lib/mcp-host.ts`        | `McpToolIframe`, `createIframeMessageHandler`, postMessage types                      |
| Tool prompts       | `src/lib/tool-prompts.ts`    | `TOOL_CONFIRMATION_PROMPT`, follow-up prompt templates                                |
| Chat types         | `src/lib/chat-types.ts`      | `ChatMessage`, `ToolChatMessage`, `TextChatMessage`, `ToolMessageStatus`              |

### D9: Tool Registry

```typescript
// src/lib/tool-registry.ts
interface ToolDefinition {
  /** Pattern that triggers this tool in the chat */
  match: (message: string) => string | null; // returns tool param or null
  /** MCP tool name to call for the UI resource */
  mcpToolName: string;
  /** MCP tool name to call for execution */
  mcpExecuteToolName: string;
  /** Follow-up prompt template after successful execution */
  followUpPrompt: (result: Record<string, unknown>) => string;
  /** Preset pill configuration */
  pill: { label: string; prompt: string };
}

const TOOL_REGISTRY: ReadonlyMap<string, ToolDefinition> = new Map([
  [
    "create_worker",
    {
      match: (msg) =>
        /\bcreate\b.*\bworker\b/i.test(msg) ? "hello-world" : null,
      mcpToolName: "create_worker",
      mcpExecuteToolName: "execute_create_worker",
      followUpPrompt: (result) =>
        `Show a deployment dashboard for Worker "${result.workerName}"...`,
      pill: {
        label: "Create worker",
        prompt: "create a new hello world worker",
      },
    },
  ],
]);
```

Adding a new tool = adding an entry to `TOOL_REGISTRY` + registering tools in the MCP server + building an iframe app. No changes to `_PlaygroundPage.tsx`.

---

## Trade-offs Made

| Chose                                         | Over                          | Because                                                                                           |
| --------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------- |
| Iframe streams internally (fetches /api/chat) | MCP streaming tool results    | MCP protocol doesn't support streaming results. Iframe internal streaming preserves the UX.       |
| Proxy endpoint for MCP calls                  | Direct browser→MCP connection | Avoids CORS, session management complexity. Thin proxy is ~20 lines.                              |
| Two MCP tools (create + execute)              | Single tool with approval     | Decouples UI presentation from execution. Matches MCP-UI exercise pattern.                        |
| Regex trigger stays in playground             | LLM-driven tool selection     | The playground controls the UX — it decides when to show a tool. MCP owns execution, not routing. |
| Serve iframe from docs site origin            | Separate kumo-mcp origin      | Avoids CORS for /api/chat streaming. iframe HTML built by kumo-mcp, deployed alongside docs.      |
| Mock execution (still)                        | Real Cloudflare API           | Scope control. Architecture is real; execution is pluggable.                                      |
| `structuredContent` (non-standard)            | Plain text tool results       | Host needs machine-readable results to drive UI state. The pattern from exercise 05 uses it.      |

---

## Risks & Mitigations

| Risk                                                                 | Likelihood | Impact | Mitigation                                                                |
| -------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------- |
| iframe ↔ host postMessage race conditions                           | Medium     | High   | Use messageId correlation; iframe waits for render data before streaming  |
| Streaming inside iframe requires /api/chat access from iframe origin | High       | Medium | Serve iframe from same origin as docs site (no CORS needed)               |
| Two Workers to deploy/maintain                                       | Low        | Medium | kumo-mcp is minimal; could eventually merge into docs site Worker         |
| McpAgent SDK changes (agents package is 0.x)                         | Medium     | Medium | Pin version; the surface area we use (tool registration, serve) is stable |
| iframe sandbox restrictions break UITreeRenderer                     | Low        | High   | Test early; `allow-scripts allow-same-origin` should suffice              |
| 2651-line \_PlaygroundPage.tsx refactor risk                         | Medium     | Medium | Phase 3 (cleanup) only happens after integration is proven in Phase 2     |

---

## Acceptance Criteria

- [ ] `packages/kumo-mcp` Worker deploys and exposes `create_worker` + `execute_create_worker` tools via MCP protocol
- [ ] Clicking "Create worker" pill renders an iframe in the chat sidebar that streams a confirmation card
- [ ] Card renders token-by-token (streaming UX preserved)
- [ ] Clicking "Approve" in the iframe triggers MCP tool execution and shows "Applied" overlay
- [ ] Clicking "Cancel" greys out the card (same visual treatment as current)
- [ ] After successful approval, A/B panels generate content (same as current follow-up prompt flow)
- [ ] All 6 existing pills work unchanged
- [ ] postMessage communication is type-safe (Zod validation on both sides)
- [ ] Adding a second tool requires: 1 registry entry + 1 MCP tool + 1 iframe app (no \_PlaygroundPage changes)

---

## Test Strategy

| Layer       | What                                                      | How                                                                |
| ----------- | --------------------------------------------------------- | ------------------------------------------------------------------ |
| Unit        | postMessage utilities (sendMcpMessage, waitForRenderData) | Vitest with mock postMessage                                       |
| Unit        | Tool registry matching                                    | Vitest — regex patterns, null returns                              |
| Unit        | MCP tool handlers (create_worker, execute_create_worker)  | Vitest with MCP SDK test harness                                   |
| Integration | iframe ↔ host communication                              | Playwright — load iframe, verify postMessage round-trip            |
| Integration | Full "Create worker" flow                                 | Playwright — pill click → iframe renders → approve → panels stream |
| E2E         | MCP server deployment                                     | `wrangler dev` + MCP client → call tools → verify responses        |

---

## Open Questions

- [ ] **iframe serving strategy** — Build iframe app in kumo-mcp, serve from docs site? Or proxy from docs to kumo-mcp for `/ui/*` routes? → Owner: you
- [ ] **Shared streaming utilities** — `readSSEStream`, `createJsonlParser` currently live in kumo-docs-astro. The iframe app needs them too. Extract to `@cloudflare/kumo/streaming` or duplicate? → Owner: you
- [ ] **Service binding vs fetch** — Can kumo-docs and kumo-mcp use a Cloudflare service binding (same account, zero-latency)? Or must we use external fetch? → Owner: you (infra)
- [ ] **Deployment topology** — Separate Worker (kumo-mcp.kumo-ui.com)? Or same Worker with Durable Object added to kumo-docs? → Owner: you

---

## Success Metrics

- Confirmation card streams at same perceived speed as current implementation
- No regression in existing pill flows (existing Playwright tests pass)
- `_PlaygroundPage.tsx` drops below 2000 lines after refactor
- A new tool can be added in <1 hour by someone unfamiliar with the codebase
