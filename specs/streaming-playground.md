# Streaming UI Playground — v3

**Type:** Feature Plan
**Effort:** L (1-2 days)
**Branch:** `geoquant/streaming-ui` (CRITICAL: ONLY work on this branch)
**Status:** Ready for implementation
**Updated:** 2026-02-26

## Problem

The existing `/streaming` demo renders in a constrained chat bubble within a docs page. Page-level generative UI (multi-section, two-column, sticky sidebar templates) needs a full-width viewport to evaluate. There's no way to see generated code, inspect structural quality, switch models, or iterate conversationally. The style-layer work (composition graders, page-level templates) is blocked until there's a playground with a feedback loop.

**Who:** Internal Kumo team iterating on generative UI quality.
**Cost of not solving:** Can't evaluate page-level output, can't iterate on the system prompt, can't measure compositional quality — the style-layer plan is dead in the water.

## Constraints

- Reuse existing streaming infra (`useUITree`, `createJsonlParser`, `UITreeRenderer`, `readSSEStream`, `gradeTree`)
- Reuse and extend `/api/chat` endpoint (Workers AI, SSE streaming)
- No new npm dependencies for code generation — `uiTreeToJsx` is a pure string transform
- No new npm dependencies for syntax highlighting in v1 — use `<pre>` with monospace
- Must work within Astro + Cloudflare Workers (hybrid rendering, `/api/*` routes are SSR)
- Playground auth via simple shared secret (query param or header) — no CF Access infra
- System prompt is read-only (viewable, not editable) — avoids prompt injection risk
- All work on `geoquant/streaming-ui` branch

## Solution

### Architecture

```
/playground (new Astro page, BaseLayout — no sidebar, full-width)
    └─ PlaygroundPage.tsx (React island, client:load)
         ├─ Top bar: prompt input + model selector + preset pills
         ├─ Tab switcher: Preview | Code | Grading | System Prompt
         ├─ Tab content area (full remaining viewport):
         │    ├─ Preview: UITreeRenderer (full-width, no max-height)
         │    ├─ Code: uiTreeToJsx() output + copy button
         │    ├─ Grading: gradeTree() report (score, violations, warnings)
         │    └─ System Prompt: read-only view of assembled prompt
         └─ Bottom bar: conversational follow-up input
```

### Layout: Full-Width with Tabs

The playground uses `BaseLayout` directly (NOT `DocLayout`/`MainLayout`) to avoid the sidebar and max-width constraint. The page is full-viewport — the playground IS the page.

**Tab system:** 4 tabs across the top of the content area.

| Tab | Content | Updates during stream? |
|-----|---------|----------------------|
| **Preview** | `UITreeRenderer` rendering the live UITree | Yes, live |
| **Code** | `uiTreeToJsx(tree)` output in `<pre>` + Copy button | Yes, live |
| **Grading** | `gradeTree(tree)` report — score, rule violations, warnings | Yes, on each tree update |
| **System Prompt** | Read-only view of the assembled system prompt text | No (static per session) |

Default tab: **Preview**. Tabs persist across generations (if you're on Code, you stay on Code when a new stream starts).

### UITree -> JSX Code Generation

The LLM outputs JSONL patches that build a flat UITree. To show copyable code, we need `uiTreeToJsx()`.

**Location:** `packages/kumo/src/generative/ui-tree-to-jsx.ts`
**Export from:** `@cloudflare/kumo/generative`

Pure function: `uiTreeToJsx(tree: UITree, options?: { componentName?: string }): string`

**Mapping strategy:**
- UITree `type` -> JSX tag name (e.g., `Surface` -> `<Surface>`, `TableHeader` -> `<Table.Header>`)
- Sub-component aliases reverse-map to dot notation (from `component-manifest.ts` `SUB_COMPONENT_ALIASES`)
- `props.children` (string) -> JSX text children
- `children[]` (element keys) -> nested JSX children
- Synthetic `Div` -> `<div>`
- Skip internal-only props: `action`, `visible`, `parentKey`, `key`
- Skip generative wrapper defaults (output should use standard Kumo imports)
- Generate `import { ... } from "@cloudflare/kumo"` with only used components (deduplicated, sorted)
- Apply same 8-pass normalization pipeline before conversion (consistency with UITreeRenderer)
- Wrap in `export function GeneratedUI() { return (...) }` (or configurable name)
- 2-space indentation, Prettier-like formatting

**Example output:**
```tsx
import { Surface, Stack, Text, Button } from "@cloudflare/kumo";

export function GeneratedUI() {
  return (
    <Surface>
      <Stack gap="lg">
        <Text variant="heading2">Welcome</Text>
        <Text>Enter your details below</Text>
        <Button variant="primary">Get Started</Button>
      </Stack>
    </Surface>
  );
}
```

### Grading Panel

Uses the existing `gradeTree()` from `structural-graders.ts`. The grading tab shows:

1. **Overall score** — pass/fail count out of 8 rules
2. **Per-rule results** — each of the 8 rules with pass/fail/warning status and violation details
3. **Element count** — total elements in tree
4. **Tree depth** — current max depth vs limit (8)

Updates live during streaming (recomputed on every tree state change via `useMemo` or `useEffect`).

### Multi-Turn Conversation

**Client-side state:** `messages: Array<{ role: "user" | "assistant"; content: string }>` in React state. On each submit:
1. Append user message to `messages`
2. Send full `messages` array + current message to `/api/chat`
3. Append assistant response (accumulated JSONL text) when stream completes

**Tree behavior:** Resets on each new generation (same as current — AI rebuilds from scratch each turn with conversation context). This is correct because the model needs to produce a complete UITree each time.

**UI flow:**
1. User types "Build a DNS zone management page" in top input -> stream starts
2. Preview tab shows live rendering, Code tab shows live JSX
3. Stream completes. Follow-up input appears at bottom.
4. User types "Add a search bar above the table" -> tree resets, new stream starts
5. Model gets full conversation history, generates updated UI

### Model Selector

Dropdown in the top bar showing available Workers AI models. The `/api/chat` endpoint will accept an optional `model` parameter to override the default.

**Available models (hardcoded list in v1):**
- `@cf/zai-org/glm-4.7-flash` (default, current)
- `@cf/meta/llama-4-scout-17b-16e-instruct` 
- `@cf/google/gemma-3-27b-it`

This list lives in a shared constant. The playground UI shows friendly names. Adding models is a code change (no dynamic discovery in v1).

### Auth: Simple Shared Secret

The `/playground` route and `/api/chat` (when called from playground) are gated by a simple secret.

**Mechanism:** Environment variable `PLAYGROUND_SECRET` in `wrangler.jsonc`. The playground page checks for `?key=<secret>` query param on load. If missing or wrong, shows an "Access restricted" message. The secret is also sent as `X-Playground-Key` header on `/api/chat` requests from the playground.

**`/api/chat` changes:** When `X-Playground-Key` is present and valid:
- Rate limit increases from 20/min to 100/min (or bypassed)
- Model override parameter is accepted
- History/messages array format is accepted

When `X-Playground-Key` is absent, existing behavior is unchanged (backward compatible).

### Extracting Shared Utilities

`readSSEStream()` (currently inlined in `_StreamingDemo.tsx`, 143 lines) is extracted to `packages/kumo-docs-astro/src/lib/read-sse-stream.ts`. Both `_StreamingDemo.tsx` and `_PlaygroundPage.tsx` import from there.

## Deliverables

### D1: `uiTreeToJsx()` — UITree to JSX converter (M)
**Location:** `packages/kumo/src/generative/ui-tree-to-jsx.ts`
**Depends on:** nothing
**Export from:** `@cloudflare/kumo/generative`

Responsibilities:
- Walk UITree from root, recursively build JSX string
- Map type names to JSX tags (use `SUB_COMPONENT_ALIASES` for dot notation)
- Handle `props.children` (text) vs `children[]` (structural)
- Generate import statement (deduplicated, sorted, only used components)
- Apply 2-space indentation
- Skip blocked/internal props (`action`, `visible`, `parentKey`, `key`)
- Handle prop serialization: strings as `"value"`, booleans as `{true}`, numbers as `{123}`
- Apply 8-pass normalization pipeline before conversion
- Wrap in `export function GeneratedUI() { return (...) }`

Tests: `packages/kumo/tests/generative/ui-tree-to-jsx.test.ts`

**Acceptance:**
- Given UITree with Surface > Stack > [Text, Button], outputs valid JSX
- Compound components use dot notation (`<Table.Header>` not `<TableHeader>`)
- Import statement includes only used components
- Handles empty/missing trees gracefully (returns empty component)
- Normalization output matches UITreeRenderer behavior

### D2: Extract `readSSEStream` to shared utility (S)
**Location:** `packages/kumo-docs-astro/src/lib/read-sse-stream.ts`
**Depends on:** nothing

Extract `readSSEStream()` from `_StreamingDemo.tsx` (lines 109-252) into a shared module. Update `_StreamingDemo.tsx` to import from new location. No behavior change.

**Acceptance:**
- `_StreamingDemo.tsx` works identically after extraction
- New file exports `readSSEStream` with same signature
- No code duplication

### D3: Extend `/api/chat` for playground features (M)
**Location:** `packages/kumo-docs-astro/src/pages/api/chat.ts`
**Depends on:** nothing

Changes:
1. Accept `messages: Array<{role, content}>` in request body (alongside existing `message` field for backward compat)
2. Accept optional `model: string` field to override default model
3. Check `X-Playground-Key` header against `PLAYGROUND_SECRET` env var
4. When playground-authed: accept model override, relax rate limit
5. When not authed: ignore `model` and `messages` fields, existing behavior unchanged
6. Expose system prompt via new GET endpoint `/api/chat/prompt` (returns assembled prompt text, playground-auth required)

**Acceptance:**
- Existing single-message requests still work (backward compatible)
- `_StreamingDemo.tsx` works with zero changes
- Multi-turn `messages` array forwarded to Workers AI when playground-authed
- Model override works when playground-authed
- `/api/chat/prompt` returns system prompt text (playground-auth required)
- Unauthenticated requests to model override / messages are ignored silently

### D4: `/playground` page + `PlaygroundPage` component (L)
**Location:** `packages/kumo-docs-astro/src/pages/playground.astro` + `packages/kumo-docs-astro/src/components/demos/_PlaygroundPage.tsx`
**Depends on:** D1, D2, D3

**Page:** Uses `BaseLayout` (full-width, no sidebar). Renders `PlaygroundPage` as `client:load` React island.

**PlaygroundPage component structure:**

```
┌──────────────────────────────────────────────────────────────┐
│ [Prompt input ..................] [Model ▾] [Send] [Presets ▾]│
├──────────────────────────────────────────────────────────────┤
│ [ Preview ] [ Code ] [ Grading ] [ System Prompt ]           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  (Full viewport tab content area)                            │
│                                                              │
│  Preview: UITreeRenderer, full-width, scrollable             │
│  Code: <pre> with JSX, Copy button top-right                 │
│  Grading: Score summary + per-rule breakdown                 │
│  System Prompt: <pre> with assembled prompt text              │
│                                                              │
├���─────────────────────────────────────────────────────────────┤
│ [Follow-up input ..............................] [Send]       │
│ Status: idle | streaming ● | error                           │
└──────────────────────────────────────────────────────────────┘
```

**Key behaviors:**
- Tab switcher at top of content area. Tabs: Preview, Code, Grading, System Prompt.
- Preview tab is default. Tab selection persists across generations.
- All tabs update live during streaming (except System Prompt which is static).
- Top bar: prompt input (InputArea), model selector dropdown, Send button, preset prompts dropdown.
- Bottom bar: follow-up input for conversational refinement. Only visible after first generation.
- Code tab: `uiTreeToJsx(tree)` output in `<pre>`, Copy button (clipboard API).
- Grading tab: `gradeTree(tree)` results — overall score, per-rule pass/fail, violation details.
- System Prompt tab: fetched from `/api/chat/prompt` on load, displayed in `<pre>`.
- Auth: checks `?key=` query param on mount. If invalid, shows "Access restricted" and disables inputs.
- Preset prompts: same 5 presets from `_StreamingDemo.tsx` + new page-level presets (DNS management, tunnel config, WAF overview).
- Status indicator in bottom bar (idle/streaming/error).
- Error handling: error banner when stream fails, user can retry.

**State:**
- `messages: Array<{role, content}>` — conversation history (client-side)
- `tree: UITree` — current tree state (from `useUITree`)
- `activeTab: "preview" | "code" | "grading" | "prompt"` — selected tab
- `selectedModel: string` — current model ID
- `status: "idle" | "streaming" | "error"` — stream status
- `systemPrompt: string` — cached prompt text from `/api/chat/prompt`
- `isAuthed: boolean` — whether playground key is valid

**Acceptance:**
- `/playground?key=<secret>` loads, shows full-width playground
- Without valid key, shows access restricted message
- User types prompt -> Preview tab shows live rendered UI
- Code tab shows valid, copyable JSX with `@cloudflare/kumo` imports
- Grading tab shows `gradeTree()` results
- System Prompt tab shows assembled prompt text
- Model selector switches between available models
- Follow-up prompts work (multi-turn conversation)
- Copy button copies JSX to clipboard

### D5: Navigation updates (S)
**Location:** `SidebarNav.tsx`, `SearchDialog.tsx`, `streaming.astro`
**Depends on:** D4

1. Add `{ label: "Playground", href: "/playground" }` to `staticPages` in `SidebarNav.tsx`
2. Add playground to `SearchDialog.tsx` static pages array
3. Add cross-link from `/streaming` page to `/playground`

**Acceptance:**
- "Playground" in sidebar nav
- "Playground" in search results
- `/streaming` has visible link to `/playground`

### D6: Wrangler config for playground secret (S)
**Location:** `packages/kumo-docs-astro/wrangler.jsonc`
**Depends on:** nothing

Add `PLAYGROUND_SECRET` as a Workers secret (not in jsonc — use `wrangler secret put`). Document the setup in a comment in the endpoint.

**Acceptance:**
- `PLAYGROUND_SECRET` available as env var in the Worker
- Works in dev via `.dev.vars` file
- Works in production via `wrangler secret put`

## Non-Goals

- Editable system prompt (read-only only — avoids prompt injection, cost amplification)
- Custom component support in playground (built-in catalog only)
- Saving/sharing generated UIs (URL persistence, etc.)
- Syntax highlighting library (Shiki, Prism) — v2
- Resizable split panes — not applicable (tabs, not split)
- Cloudflare Containers/Sandboxes for isolated preview
- Dynamic model discovery from Workers AI API (hardcoded list in v1)
- Server-side rendering of UITree
- Action/event log panel (focus on code + grading instead)
- AI prompt engineering / output quality (that's the style-layer plan)

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| `uiTreeToJsx` output diverges from rendered UI | Devs copy code that looks different from preview | Run same 8-pass normalization before converting; snapshot tests comparing rendered tree structure vs JSX AST |
| Multi-turn produces worse results than single-shot | Degraded output on follow-ups | Each turn rebuilds full tree from scratch (no incremental patching across turns); degrade to single-shot if model struggles |
| Code output too verbose for complex trees (30+ elements) | Hard to read in tab | Scroll support; monospace at 12px; future: collapsible sections |
| Shared secret in query param leaks via browser history/referrer | Unauthorized access | Acceptable risk for internal dev tool; can migrate to CF Access later |
| Model selector enables expensive models | Cost amplification | Hardcoded allowlist of 3 models; all are Workers AI (no external API costs) |
| `/api/chat` backward compat break | Existing streaming demo breaks | Accept both `message` and `messages` formats; test both paths; playground features gated behind auth header |
| Grading during streaming is expensive (recomputes on every tree update) | UI jank | Debounce grading computation (run at most every 500ms during stream, final run on stream complete) |

## Open Questions

- None remaining

---

**Phase: DRAFT | Waiting for: user approval before REFINE**
