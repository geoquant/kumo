# Playground Tool Middleware — "Create Worker" Flow

**Type:** Feature Plan  
**Effort:** L (1–2 days)  
**Status:** Ready for implementation

---

## Problem

The playground's chat sidebar currently supports a single interaction pattern: user sends prompt → LLM streams JSONL → A/B panels render UI. There is no mechanism for **multi-phase interactions** where the bot first presents structured UI in the chat (e.g. a confirmation card with approve/cancel) and the user's response to that UI gates what happens next (e.g. triggering panel generation, or aborting).

This limits the playground's ability to demonstrate realistic agentic workflows where an AI assistant needs to gather information, present tool-call confirmations, and conditionally execute side effects — which is the exact pattern used in production by the Cloudflare dashboard's AI Agent sidebar (`useApprovals` / `ApprovalCard`) and the Cloudflare Agents SDK (`needsApproval` → `approval-requested` state machine).

### Goal

Add a "create a new hello world worker" pill prompt that demonstrates a **tool-call middleware pattern** in the chat:

1. User clicks pill → bot streams a confirmation card into chat (matching the design in `inspo/_create-worker-design.png`)
2. User clicks Cancel → nothing happens in panels
3. User clicks Approve → mock "API call" delay → A/B panels render generated UI (CloudflareLogo + "hello-world worker created")

### Constraints

- **Existing pills unchanged:** All current preset prompts (User card, Settings form, Counter, Pricing table, Custom, Workers flow) continue to work exactly as they do today — direct LLM call → A/B panel generation. ONLY the new "Create worker" pill triggers the tool middleware flow.
- The new pill is the **only** prompt that renders UI within the chat sidebar. All other prompts render exclusively in the right panels.

### Non-goals

- Real Cloudflare API integration (fully mocked for now)
- Full MCP server implementation
- Changes to the `@cloudflare/kumo` streaming package itself (we extend at the playground level)
- Production agent architecture (this is a proof of concept to stress-test the streaming UI framework)

---

## Architecture

### Key Insight

The existing streaming pipeline already supports everything we need:

| Capability                   | Status    | Location                                                                 |
| ---------------------------- | --------- | ------------------------------------------------------------------------ |
| Streaming JSONL → UITree     | ✅ Exists | `createJsonlParser`, `useUITree`, `UITreeRenderer`                       |
| Rendering UITree inside chat | ❌ New    | Chat sidebar currently shows `AssistantMessageSummary` text, not live UI |
| Action buttons in UITree     | ✅ Exists | `action` field on UIElement, `ActionDispatch`                            |
| Custom action handlers       | ✅ Exists | `createHandlerMap(custom)` merges with built-ins                         |
| A/B panel generation         | ✅ Exists | `ComparisonPanels` with independent streaming                            |

**The missing piece is a new message rendering mode** in the chat sidebar that renders a UITree inline (instead of a text summary) and dispatches actions back to the playground's control flow.

### Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│ "Create Worker" Pill Click                                    │
│                                                              │
│  1. Intercept in submit handler (not sent to /api/chat)      │
│  2. Add user message to chat                                 │
│  3. Stream tool-call JSONL from local generator (no LLM)     │
│  4. Render confirmation UITree inline in chat                │
│                                                              │
│  ┌─ Cancel ──→ Add "Cancelled" status to chat. Done.         │
│  │                                                           │
│  └─ Approve ─→ 5. Show "applying" spinner in chat            │
│                6. Mock API delay (800ms)                      │
│                7. Inject follow-up prompt into both panels:   │
│                   "Show a hello-world worker success view     │
│                    with CloudflareLogo and confirmation text" │
│                8. Both panels stream independently as normal  │
└──────────────────────────────────────────────────────────────┘
```

### Why Not an LLM Call for the Confirmation Card?

The confirmation card is deterministic — it always shows the same structure for "create hello-world worker". Using an LLM call would:

- Add latency for a predictable response
- Risk the LLM generating a different layout each time
- Make the demo unreliable

However, the card IS rendered via the UITree pipeline (JSONL → patches → UITreeRenderer), so the architecture is identical to what an LLM would produce. This makes it trivial to swap in an LLM-generated version later.

---

## Deliverables

### D1: Chat Message Types Extension (S)

**File:** `_PlaygroundPage.tsx`

Extend the `ChatMessage` type to support tool-call messages:

```typescript
type ChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string } // existing: JSONL text for panel generation
  | {
      role: "tool";
      toolId: string;
      tree: UITree; // new: inline interactive UI
      status: "pending" | "approved" | "cancelled" | "applying" | "completed";
    };
```

The `role: "tool"` message renders a `UITreeRenderer` inline in the chat sidebar instead of `AssistantMessageSummary`.

**Depends on:** —

### D2: Tool Response JSONL Generator (S)

**File:** `_PlaygroundPage.tsx` (or new `src/lib/tool-responses.ts`)

A function that produces the confirmation card as JSONL patches, matching the design screenshot:

```typescript
function generateCreateWorkerConfirmation(workerName: string): string {
  // Returns JSONL string that builds a UITree:
  // - Surface (card container)
  //   - Text: "Verify this change"
  //   - Cluster: Text "Create new Worker script named" + Badge "hello-world"
  //   - Stack (vertical, full-width):
  //     - Button "Cancel" (variant: outline, action: { name: "tool_cancel", params: { toolId } })
  //     - Button "Approve" (variant: default/brand, action: { name: "tool_approve", params: { toolId } })
}
```

This is streamed through the existing `createJsonlParser` → `useUITree` pipeline at natural speed (no artificial delay). The JSONL is fed directly into the parser — no fake SSE wrapping needed.

**Depends on:** —

### D3: Tool Action Handlers (S)

**File:** `_PlaygroundPage.tsx`

Two new action handlers registered via `createHandlerMap`:

```typescript
const TOOL_HANDLERS: ActionHandlerMap = {
  tool_approve: (event) => ({
    type: "tool_response" as const, // new result type (or use "message" with convention)
    toolId: event.params?.toolId,
    approved: true,
  }),
  tool_cancel: (event) => ({
    type: "tool_response" as const,
    toolId: event.params?.toolId,
    approved: false,
  }),
};
```

**Option A (simpler):** Use the existing `MessageResult` type with a JSON payload convention. The host parses the message content to detect tool responses.

**Option B (cleaner):** Add a new `ToolResponseResult` to the `ActionResult` union in `@cloudflare/kumo/streaming`. This is architecturally cleaner but requires a package change.

**Recommendation:** Option A for this iteration — keep changes in the playground, avoid package modifications.

**Depends on:** D2

### D4: Inline UITree Rendering in Chat (M)

**File:** `_PlaygroundPage.tsx` — specifically `PlaygroundChatSidebar` and message rendering

Currently, assistant messages in the chat show `AssistantMessageSummary` (a text summary like "Generated UI with Surface, Stack, Text"). For `role: "tool"` messages, render a full `UITreeRenderer` with:

- Constrained width (fits the 380px chat sidebar)
- `onAction` wired to the tool action handlers from D3
- Status overlay when `status === "applying"` (spinner/loading state)
- Disabled interaction when `status !== "pending"` (prevent double-click)

No status text chrome above the card (skip "Waiting..." / "[Write] Cloudflare API Tool"). The card renders directly in the chat bubble.

Layout within a chat bubble:

```
┌─────────────────────────────────────┐
│ ┌─────────────────────────────────┐ │
│ │ Verify this change              │ │
│ │                                 │ │
│ │ Create new Worker script named  │ │
│ │ ┌───────────┐                   │ │
│ │ │hello-world│                   │ │
│ │ └───────────┘                   │ │
│ │                                 │ │
│ │ ┌─────────────────────────────┐ │ │
│ │ │          Cancel             │ │ │
│ │ └─────────────────────────────┘ │ │
│ │ ┌─────────────────────────────┐ │ │
│ │ │          Approve            │ │ │
│ │ └─────────────────────────────┘ │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Cancelled state:** When user clicks Cancel, the card is greyed out — reduced opacity, buttons disabled, strikethrough on the action text. Visual signal that this interaction is resolved and no longer actionable.

**Depends on:** D1, D2, D3

### D5: Pill → Middleware → Panel Orchestration (M)

**File:** `_PlaygroundPage.tsx`

Wire the full flow in the submit handler:

1. **Intercept:** When input matches the "create worker" pill, don't send to `/api/chat`
2. **Chat phase:** Stream the confirmation JSONL into a `role: "tool"` message
3. **Wait for action:** The `onAction` handler for `tool_approve` / `tool_cancel` resolves a Promise or sets state
4. **Cancel path:** Update tool message status to `"cancelled"` — card greys out (opacity + disabled buttons + strikethrough)
5. **Approve path:**
   - Update tool message status to `"applying"`
   - `await` mock delay (800ms)
   - Update status to `"completed"`
   - Fire A/B panel generation with a follow-up prompt: _"Show a success confirmation that a Cloudflare Worker named 'hello-world' was created. Include a CloudflareLogo component (variant glyph) and success text."_
   - Both panels stream independently using existing infrastructure

**Depends on:** D1–D4

### D6: Preset Pill Addition (S)

**File:** `_PlaygroundPage.tsx`

Add to `PRESET_PROMPTS`:

```typescript
{
  label: "Create worker",
  prompt: "create a new hello world worker",
}
```

Add detection logic in the submit handler to identify this as a tool-call prompt (simple string match or flag on the preset).

**Depends on:** D5

---

## Trade-off Analysis

| Decision                   | Option A                                   | Option B                            | Choice                                            |
| -------------------------- | ------------------------------------------ | ----------------------------------- | ------------------------------------------------- |
| Confirmation card source   | Hardcoded JSONL generator                  | LLM call                            | **A** — deterministic, reliable, same pipeline    |
| Action result type         | Reuse `MessageResult` with JSON convention | New `ToolResponseResult` in package | **A** — no package change needed                  |
| Post-approve panel content | Generated by LLM (via follow-up prompt)    | Hardcoded UITree                    | **LLM** — stress-tests the framework              |
| Streaming simulation       | Natural speed through parser (no delay)    | Instant tree injection              | **Natural stream** — real pipeline, no fake delay |
| Scope                      | Playground-only changes                    | Package-level tool protocol         | **Playground** — prototype first, extract later   |

---

## Risks

| Risk                                                      | Impact                                     | Mitigation                                                                                            |
| --------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Chat sidebar too narrow for confirmation card             | Card renders poorly at 380px               | Design card with mobile-first constraints; test at sidebar width                                      |
| UITreeRenderer inside chat conflicts with sidebar scroll  | Scroll position jumps, nested scroll traps | Wrap in a non-scrollable container; card should be short enough to not need internal scroll           |
| Follow-up prompt doesn't reliably generate CloudflareLogo | LLM might ignore or misuse the component   | Include CloudflareLogo in the system prompt examples; fall back to hardcoded tree if generation fails |
| Action handler timing — user clicks approve twice         | Double-fires panel generation              | Disable buttons immediately on first click; use status state machine                                  |

---

## Resolved Questions

- [x] **Status text chrome:** Skipped — no "Waiting..." / "[Write] Cloudflare API Tool" text. Card renders directly.
- [x] **Streaming delay:** No artificial delay. Stream at natural speed through the JSONL parser pipeline.
- [x] **Cancelled state:** Greyed out — reduced opacity, disabled buttons, strikethrough on action text.
- [x] **Existing pills:** Unchanged. All current presets work exactly as before. Only "Create worker" uses the tool middleware.
- [x] **Follow-up prompt:** Mentions "hello-world" worker name — passed from the confirmation flow into the panel generation prompt.

---

## Future Considerations (Parked)

These are explicitly out of scope but worth noting for when this pattern grows:

- **Tool registry:** A `Map<string, ToolDefinition>` that maps tool names to JSONL generators, schemas, and handlers — analogous to `BUILTIN_HANDLERS` in `action-registry.ts`
- **Server-side tool execution:** Move tool JSONL generation to `/api/chat/tools` endpoint; useful when tools need auth or external API access
- **MCP integration:** Align the tool-call JSONL format with MCP `tool_call` / `tool_result` message types for interop with `@cloudflare/agents`
- **Approval persistence:** Track approval state across page reloads (currently ephemeral)
- **Multi-step tools:** Chain multiple approval steps (e.g. "name your worker" → "select region" → "confirm")
