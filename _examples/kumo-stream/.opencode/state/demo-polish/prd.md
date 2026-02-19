# PRD: Demo Polish — Unified UI, Chat History, Counter & Action Panel

**Date:** 2026-02-19

---

## Problem Statement

### What problem are we solving?

The kumo-stream example has two demo surfaces (React SPA + HTML/UMD) that diverge in styling, features, and capability. Neither tells a complete generative UI story on its own:

- **React SPA** has preset prompts and multi-turn but no action event visibility, no conversation history, and a generic centered layout.
- **HTML/UMD** has the action event log and better visual style but lacks preset prompts, conversation history, and multi-turn.
- **Neither** demonstrates stateful client-side interactions (e.g., a counter that increments/decrements) — the action system dispatches events but never mutates the rendered UI.
- **Neither** demonstrates the full loop: user asks for UI → UI renders → user interacts → interaction data captured �� data available for external use.

This matters because this demo is the primary proof-of-concept for the [GENERATIVE-UI.md](../_examples/GENERATIVE-UI.md) thesis — the 4 pillars (Dynamic Loadable, Component Response, Component Styles, Streaming Responses). A fragmented, incomplete demo undermines the thesis.

### Why now?

All foundational tasks are complete (streaming patches, stateful wrappers, action system, component expansion). The infrastructure works. Now it needs to be presentable.

### Who is affected?

- **Primary:** Engineers and stakeholders evaluating generative UI as a pattern for Cloudflare products.
- **Secondary:** Developers using this example as a reference implementation for their own generative UI integrations.

---

## Proposed Solution

### Overview

Unify both demo surfaces into polished, feature-complete showcases. The React SPA adopts the HTML/UMD's visual aesthetic (full-width layout, dark header, toolbar controls). Both versions gain visual chat history (user prompt bubble + rendered UI per turn), preset prompt pills, a "Counter" preset demonstrating stateful interactions, and an action events panel showing the full interaction lifecycle including simulated external service calls.

### User Experience

#### User Flow: Generate and Interact

1. User opens either demo surface (React SPA or HTML/UMD)
2. User sees header with title + dark mode toggle, preset prompt pills, and input bar
3. User clicks "Counter" preset (or types a prompt)
4. UI streams in progressively — counter with [−] 0 [+] buttons appears
5. User clicks [+] — count updates to 1; action panel logs: `increment from increment-btn → POST /api/actions {...}`
6. User clicks [+] again — count updates to 2; another log entry appears
7. User types a follow-up prompt — previous counter moves into chat history (read-only), new UI streams below
8. Chat history scrolls showing the full conversation: prompt bubbles + rendered UI responses

#### User Flow: Form Interaction Loop

1. User clicks "Build a support ticket form" preset
2. Form streams in with fields and submit button
3. User fills fields and clicks submit
4. Action panel shows: `submit_form from submit-btn params={...} → POST /api/actions { actionName: "submit_form", params: {...} }`
5. Viewer understands: this is where a real app would send data to a backend

### Design Considerations

- Both surfaces must look visually cohesive — HTML/UMD's aesthetic is the target (960px max-width, system font, Cloudflare orange accents).
- Dark mode support via `data-mode` attribute toggle.
- Responsive: 2-column layout (chat + action panel) stacks vertically below 768px.
- Chat history UI renders are read-only snapshots — only the latest turn is interactive.

---

## End State

When this PRD is complete, the following will be true:

- [ ] React SPA visual style matches HTML/UMD aesthetic (layout, header, controls)
- [ ] Both versions have a working dark mode toggle
- [ ] Both versions display scrollable chat history (user prompt bubble + rendered UI per turn)
- [ ] Both versions have preset prompt pill buttons (same list + "Counter")
- [ ] HTML/UMD version supports multi-turn (sends history to server)
- [ ] "Counter" preset generates a counter with increment/decrement that updates the displayed count
- [ ] React SPA has a 2-column layout with action events panel on the right
- [ ] Action panel shows timestamped events with action name, source, params, and simulated POST line
- [ ] System prompt includes counter example for reliable LLM generation
- [ ] UITreeRenderer adds `data-key` attributes for DOM element identification
- [ ] Action-to-patch bridge enables client-side tree mutation from action events (React SPA)
- [ ] HTML/UMD counter uses inline DOM manipulation via `data-key` selector

---

## Success Metrics

### Quantitative

| Metric                  | Current              | Target                           | Measurement Method                     |
| ----------------------- | -------------------- | -------------------------------- | -------------------------------------- |
| Feature parity gap      | 5 features divergent | 0                                | Manual comparison checklist            |
| Counter LLM reliability | N/A                  | >80% correct on first generation | Test 5 generations with counter preset |

### Qualitative

- Both demos tell a complete story independently — a viewer understands the full generative UI lifecycle.
- The counter interaction is immediately impressive — user sees live UI state changes from AI-generated components.

---

## Acceptance Criteria

### Visual Unification

- [ ] React SPA uses max-w-[960px] container (not max-w-4xl)
- [ ] Header is flex row: title left (20px semibold), dark mode toggle right
- [ ] Subtitle is muted text (not Kumo `<Text>` component)
- [ ] Controls bar is horizontal toolbar: input fills space, Generate/Stop/Reset in row
- [ ] Dark mode toggle sets `data-mode` on root wrapper and affects all Kumo components

### Chat History

- [ ] Both versions show scrollable conversation history
- [ ] Each turn shows user prompt as right-aligned bubble with muted background
- [ ] Each turn shows assistant response as rendered UITree
- [ ] Previous turns are read-only (actions only fire on latest turn)
- [ ] Auto-scrolls to bottom on new messages
- [ ] Reset clears all history

### Preset Prompt Pills

- [ ] HTML/UMD has pill buttons between header and controls
- [ ] Same preset list as React SPA plus "Counter"
- [ ] Clicking a pill triggers generation with that prompt
- [ ] Pills disabled during streaming
- [ ] Pills styled as rounded outline buttons (border-radius: 16px)

### Counter Interaction

- [ ] "Counter" preset exists in both versions
- [ ] LLM generates counter with increment/decrement buttons and count display
- [ ] Clicking increment increases displayed count by 1
- [ ] Clicking decrement decreases displayed count by 1
- [ ] Action events fire and appear in action panel
- [ ] Actions during active streaming are logged but don't mutate tree (race prevention)

### Action Events Panel (React SPA)

- [ ] 2-column layout: left 60-65% (chat), right 35-40% (panel)
- [ ] Panel header: "Action Events" + "Clear" button
- [ ] Each entry: timestamp (HH:MM:SS.mmm) + action name (orange) + source key + params/context
- [ ] Below each entry: faded `→ POST /api/actions { ... }` line
- [ ] Empty state: "No action events yet. Generate a form and interact with it."
- [ ] Auto-scrolls to latest entry
- [ ] Clear button and chat Reset both clear the log
- [ ] Stacks vertically below md breakpoint (768px)

### Infrastructure

- [ ] `UITreeRenderer.tsx` adds `data-key={element.key}` attribute to rendered elements
- [ ] `system-prompt.ts` includes counter example (Example 5) with correct action names and keys
- [ ] `action-patch-bridge.ts` module maps increment/decrement actions to tree replace ops
- [ ] Bridge handles missing elements and non-numeric text gracefully (returns null)

---

## Technical Context

### Existing Patterns

- React SPA entry: `src/app/main.tsx` → `App.tsx` → `ChatDemo.tsx`
- HTML/UMD demo: `public/cross-boundary.html` (580 lines, inline CSS + JS)
- UMD API: `CloudflareKumo.{createParser, applyPatch, reset, setTheme, onAction}`
- Action dispatch: `action-handler.ts` → `ActionEvent` via `onAction` callback
- Stateful wrappers: `stateful-wrappers.tsx` (Select, Checkbox, Switch, Tabs, Collapsible)
- Tree rendering: `UITreeRenderer.tsx` uses `COMPONENT_MAP` from `component-map.ts`
- Patch engine: `rfc6902.ts` handles add/replace/remove ops on UITree (immutable)
- Server SSE: `server/index.ts` `POST /api/chat` accepts `{ message, history? }`

### Key Files

- `src/app/App.tsx` — React root layout (restyle target)
- `src/app/ChatDemo.tsx` — React chat interface (major changes)
- `public/cross-boundary.html` — HTML/UMD demo (major changes)
- `src/core/UITreeRenderer.tsx` — Recursive renderer (add data-key)
- `src/core/hooks.ts` — `useUITree` hook (wire onAction)
- `src/core/action-handler.ts` — ActionEvent types and factory
- `src/core/system-prompt.ts` — LLM instructions (add counter example)
- `src/core/rfc6902.ts` — Patch engine (used by bridge)
- `src/core/types.ts` — UITree, UIElement, Action types
- `server/index.ts` — Express SSE proxy (already supports history)

### System Dependencies

- Server already accepts `history` array in `/api/chat` — no server changes needed.
- `useUITree` hook already supports `onAction` callback pass-through.
- RFC 6902 engine already handles `/elements/{key}/props/children` paths.

---

## Risks & Mitigations

| Risk                                                                                  | Likelihood | Impact | Mitigation                                                                                          |
| ------------------------------------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------------------------- |
| LLM doesn't consistently generate correct counter structure (wrong keys/action names) | Medium     | High   | Add worked example to system prompt; preset prompt is very explicit about keys and action names     |
| Tree mutation via action handler races with active streaming                          | Low        | High   | Gate action-to-patch on `status !== "streaming"` — log events but don't apply patches during stream |
| HTML/UMD chat history snapshots are static HTML, not live React                       | Certain    | Low    | Acceptable: history is read-only. Subtle visual dimming distinguishes past turns from current.      |
| 2-column layout breaks on narrow viewports                                            | Medium     | Medium | Responsive breakpoint at 768px: stack vertically, action panel below chat                           |

---

## Alternatives Considered

### Alternative 1: Server-side counter state (round-trip)

- **Description:** Action triggers POST to server, server computes new count, responds with patch.
- **Pros:** Proves full server round-trip; more realistic integration.
- **Cons:** Adds latency; requires new server endpoint; overcomplicates a demo that should show instant feedback.
- **Decision:** Rejected. Client-side tree mutation is instant and demonstrates the architecture without server coupling. Server round-trip can be a future enhancement.

### Alternative 2: StatefulCounter wrapper component

- **Description:** New wrapper component (like StatefulSelect) that manages count internally via useState.
- **Pros:** Self-contained; no external patching needed.
- **Cons:** LLM would need to know about a special "Counter" component type; breaks the pattern of generic components + action system; not generalizable to other stateful interactions.
- **Decision:** Rejected. The action-to-patch bridge is more general and demonstrates the intended architecture.

### Alternative 3: Log-only action panel (no simulated POST)

- **Description:** Just show raw events without the "→ POST /api/actions" simulation line.
- **Pros:** Simpler; less visual noise.
- **Cons:** Doesn't tell the story of "this data goes somewhere useful."
- **Decision:** Rejected. The simulated POST line is one faded text line per entry — minimal complexity, significant storytelling value.

---

## Non-Goals (v1)

- **localStorage persistence** — Chat history is in-memory only; lost on refresh. Future enhancement.
- **Actual external service integration** — Action panel shows simulated POST lines, no real endpoint. Future enhancement.
- **New Kumo components** — No changes to `packages/kumo/`. All work in `_examples/kumo-stream/`.
- **Combobox stateful wrapper** — Deferred per previous spec.
- **Branch changes** — All work stays on `geoquant/streaming-ui`.

---

## Tasks

### Visual Unification — React SPA adopts HTML/UMD aesthetic [ui]

Restyle `App.tsx` and `ChatDemo.tsx` to match cross-boundary.html: full-width 960px layout, header bar with dark mode toggle, horizontal controls toolbar.

**Verification:**

- App.tsx uses max-w-[960px] container with p-8 px-6
- Header is flex row: title left (20px semibold h1) + dark mode toggle right
- Subtitle is muted text (not Kumo Text component)
- Controls bar is horizontal flex gap-2: Input fills space, Generate/Stop/Reset in row
- Dark mode toggle sets data-mode on root wrapper and affects Kumo components
- Visual structure matches cross-boundary.html layout

### Chat History — React SPA [ui]

Add scrollable conversation history to React SPA with user prompt bubbles and rendered UITree responses.

**Verification:**

- ChatHistory state tracks array of { role, content, tree? } entries
- On completed response, user message + UITree snapshot pushed to history
- History renders as scrollable list above current streaming response
- User messages show as right-aligned bubble with muted background
- Assistant responses show as rendered UITree (read-only, non-interactive)
- Auto-scrolls to bottom on new messages
- Reset clears all history
- Previous turns' actions don't fire (only latest turn interactive)

### Chat History — HTML/UMD [ui]

Add scrollable conversation history and multi-turn support to HTML/UMD demo.

**Verification:**

- chatHistory array tracks conversation in IIFE state
- Before each streamChat(), current kumo-container innerHTML snapshotted
- On completion, snapshot + user prompt moved to history section above active container
- User messages render as styled divs; assistant responses as static HTML
- history array sent with each /api/chat request (multi-turn works)
- Reset clears history and history DOM

### Preset Prompt Pills — HTML/UMD [ui]

Port preset prompt pill buttons to HTML/UMD demo.

**Verification:**

- .presets container between header and controls
- Pill buttons for each preset including Counter (rounded, outline, border-radius 16px)
- Clicking a pill triggers streamChat() with preset text
- Pills disabled during streaming, re-enabled after
- Same list as React SPA presets

### data-key Attribute — UITreeRenderer [functional]

Add `data-key={element.key}` attribute to rendered elements for DOM identification.

**Verification:**

- Each rendered element receives data-key attribute
- Attribute visible in DOM inspector
- HTML page can locate elements via `document.querySelector('[data-key="count-display"]')`

### System Prompt — Counter Example [functional]

Add worked counter example to system-prompt.ts for reliable LLM counter generation.

**Verification:**

- Example 5 — Stateful Counter section added to system prompt
- Example shows JSONL patches with action names 'increment'/'decrement'
- Example uses key 'count-display' for count text element
- LLM generates correct counter UI when given counter preset (test 3+ generations)

### Action-to-Patch Bridge [functional]

Create module mapping action events to UITree patches for known interaction patterns.

**Verification:**

- src/core/action-patch-bridge.ts exports actionToPatch(event, tree) returning JsonPatchOp or null
- Returns replace op for increment: increments count-display text by 1
- Returns replace op for decrement: decrements count-display text by 1
- Returns null for unknown action names
- Handles missing count-display element gracefully (returns null)
- Handles non-numeric text gracefully (defaults to 0)

### Counter Preset — React SPA [functional]

Wire counter preset, onAction callback, and tree mutation into React SPA.

**Verification:**

- Counter preset in PRESET_PROMPTS array
- ChatDemo passes onAction to useUITree
- onAction calls actionToPatch for increment/decrement
- Patch applied via applyPatches — count display updates
- Clicking + increments, clicking − decrements
- Actions during streaming logged but patches not applied

### Counter Preset — HTML/UMD [functional]

Wire counter preset pill and inline DOM manipulation for count updates.

**Verification:**

- Counter preset pill exists
- kumo-action listener checks for increment/decrement actionName
- Finds count element via document.querySelector('[data-key="count-display"]')
- Parses textContent as integer, updates to current ± 1
- Action still logged to action panel

### Action Events Panel — React SPA [ui]

Add action events panel with 2-column layout and simulated POST lines.

**Verification:**

- 2-column layout: left 60-65% (chat), right 35-40% (action panel)
- ActionPanel component with header: Action Events + Clear button
- Scrollable monospace log area
- Each entry: timestamp + action name (orange) + source key + params/context
- Below each entry: faded → POST /api/actions { ... } line
- Empty state text shown when no events
- Auto-scrolls to latest entry
- Clear and Reset both clear log
- Stacks vertically below md breakpoint

---

## Open Questions

| Question                                       | Owner       | Due Date              | Status |
| ---------------------------------------------- | ----------- | --------------------- | ------ |
| Counter preset prompt tuning after LLM testing | Implementer | During implementation | Open   |

---

## Appendix

### References

- [GENERATIVE-UI.md](../_examples/GENERATIVE-UI.md) — Cross-boundary generative UI thesis
- [specs/streaming-patches.md](specs/streaming-patches.md) — JSONL streaming pipeline spec (implemented)
- [specs/stateful-actions-components.md](specs/stateful-actions-components.md) — Stateful wrappers + actions spec (implemented)
- [specs/demo-polish.md](specs/demo-polish.md) — Detailed implementation spec with architecture notes
