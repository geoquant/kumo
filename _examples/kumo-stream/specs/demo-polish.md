# Demo Polish: Unified UI, Chat History, Counter Preset & Action Panel

**Status:** Implemented on `geoquant/streaming-ui`
**Effort:** L (1–2 days)
**Branch:** `geoquant/streaming-ui`

---

## Problem

The kumo-stream example has two demo surfaces (React SPA + HTML/UMD) that diverge in styling, features, and capability coverage. Neither tells a complete story on its own:

- **React SPA** has preset prompt buttons and multi-turn but no action event log, no visual chat history, and a sterile centered layout.
- **HTML/UMD** has the action event log and a better visual style but lacks preset buttons, chat history, and multi-turn.
- Neither demonstrates **stateful client-side interactions** (e.g., a counter that increments/decrements) — the action system dispatches events but doesn't mutate the UITree.
- Neither demonstrates the **full loop** of: user asks for UI → UI renders → user interacts → interaction data is captured → data is available for external use.

**GENERATIVE-UI.md alignment:** This spec advances the 4 pillars (Dynamic Loadable, Component Response, Component Styles, Streaming Responses) by making both demo surfaces feature-complete showcases.

---

## Constraints

- All changes on `geoquant/streaming-ui` branch — no new branches.
- No changes to `packages/kumo/` (component library itself).
- Server already accepts `history` array — reuse, don't redesign.
- Counter state management must work within the existing action dispatch architecture.
- The HTML/UMD demo must remain zero-build-step for the host page (UMD bundle is pre-built).
- Keep client-side API key approach in React SPA (demo-only, documented).

---

## Non-Goals

- localStorage persistence of chat history (in-memory only).
- Actual external service integration (action panel is log/simulation only).
- New Kumo components or modifications to the component library.
- Combobox stateful wrapper (deferred per previous spec).

---

## Deliverables

### D1: Unify visual style — React SPA adopts HTML/UMD aesthetic (M)

**Depends on:** —

Restyle `App.tsx` and `ChatDemo.tsx` to match the HTML/UMD cross-boundary demo's look:

1. **Layout:** Replace `max-w-4xl` centered container with full-width `max-w-[960px]` with `p-8 px-6` (matching `.page`).
2. **Header:** Flex row with title left + dark mode toggle button right. Title as `<h1>` style (20px semibold), subtitle smaller and muted. Add a working dark mode toggle that sets `data-mode` on the root wrapper.
3. **Controls bar:** Horizontal `flex gap-2` toolbar — input fills remaining space, Generate/Stop/Reset buttons in a row (matching `.controls` layout). Use Kumo `<Input>` and `<Button>` but style the container to match.
4. **Remove** the `<Text variant="heading1">` and `<Text variant="secondary">` Kumo components from the header — use plain HTML-like styling via Tailwind to match the raw aesthetic.

**Acceptance:**

- React SPA visually matches HTML/UMD page structure (header bar, controls bar, content area).
- Dark mode toggle works and affects both host chrome and rendered Kumo components.

### D2: Chat history with message bubbles — both versions (M)

**Depends on:** D1

Add visual chat history showing each conversation turn as: user prompt bubble → rendered UI response.

**React SPA:**

1. Add a `ChatHistory` type: `Array<{ role: 'user' | 'assistant'; content: string; tree?: UITree }>`. UITree snapshots are shallow copies (safe due to immutable patch updates).
2. On each completed response, push the user message and snapshot the current UITree into history.
3. Render history as a scrollable list above the current streaming response:
   - User messages: right-aligned bubble with muted background, monospace or sans-serif text.
   - Assistant responses: full-width rendered UITree (read-only, non-interactive — actions only fire on the latest turn).
4. Auto-scroll to bottom on new messages.
5. Reset clears history.

**HTML/UMD:**

1. Add a `chatHistory` array in the IIFE state.
2. Before each `streamChat()`, snapshot the current `#kumo-container` innerHTML.
3. On stream completion, move the snapshot + user prompt into a history section above the active container.
4. User messages rendered as styled divs; assistant responses as static HTML snapshots.
5. Add multi-turn: accumulate `history` array, send it with each `/api/chat` request (server already supports this).

**Acceptance:**

- Both versions show scrollable conversation history.
- Each turn displays user prompt and the generated UI.
- Multi-turn works in both (HTML/UMD gains it; React already has it).
- History clears on Reset.

### D3: Preset prompt pills — HTML/UMD version (S)

**Depends on:** —

Port the React SPA's preset prompt buttons to the HTML/UMD demo:

1. Add a `.presets` container between the header and controls in cross-boundary.html.
2. Render pill-style buttons (rounded, outline, small) for each preset prompt.
3. Clicking a preset fills the input and triggers `streamChat()`.
4. Disabled during streaming.
5. Use the same preset list as React SPA, plus the new "Counter" preset (D4).

**CSS:** Style pills to match the existing `.controls button` aesthetic but with `border-radius: 16px` and smaller padding.

**Acceptance:**

- HTML/UMD has pill buttons matching React's preset list.
- Clicking a pill generates the corresponding UI.
- Pills disabled while streaming.

### D4: Counter preset — stateful interaction demo (M)

**Depends on:** —

Add a "Counter" preset prompt to both versions. The prompt asks the LLM to generate a counter UI with increment/decrement buttons and a count display where:

- Each button has an `action` declared (e.g., `action: { name: "increment" }` / `action: { name: "decrement" }`).
- The displayed count updates when buttons are clicked.

**Implementation — client-side tree mutation via action handler:**

The most robust approach: when an action event fires with `actionName === "increment"` or `"decrement"`, the host applies an RFC 6902 patch to mutate the count text in the current UITree.

1. **Preset prompt text:** "Build a counter with increment and decrement buttons. Show the current count between them. The increment button should have action name 'increment' and the decrement button should have action name 'decrement'. The count display element should have key 'count-display'."

2. **Action-to-patch bridge (new module: `src/core/action-patch-bridge.ts`):**

   ```ts
   // Maps action events to UITree patches for known interaction patterns.
   // Returns null if the action doesn't have a mapped patch.
   function actionToPatch(event: ActionEvent, tree: UITree): JsonPatchOp | null;
   ```

   For counter actions:
   - Read current count from `tree` by finding element with key `count-display`.
   - Parse the text content as a number.
   - Compute new value (±1).
   - Return `{ op: "replace", path: "/elements/count-display/props/children", value: String(newValue) }` (exact path depends on tree structure — bridge inspects tree to find correct path).

3. **Wire into React SPA:** Pass `onAction` to `useUITree`. In the callback, run `actionToPatch(event, tree)` → if it returns an op, apply it via `applyPatches([op])`.

4. **Wire into HTML/UMD:** In the `kumo-action` event listener, call a new `CloudflareKumo.applyPatch()` with the computed patch. This requires the bridge logic to also be available in the UMD bundle OR implemented inline in the HTML page's vanilla JS.

   **Decision:** Implement counter logic inline in the HTML page via DOM manipulation. The bridge module is React-SPA-only. The HTML version finds the count element via `data-key` attribute and updates `textContent` directly.

   **Prerequisite:** Add `data-key={element.key}` attribute to rendered elements in `UITreeRenderer.tsx`. This is a one-line change in the element rendering and enables the HTML page to locate specific elements without exposing internal tree state.

   ```ts
   // In UITreeRenderer.tsx, when rendering each element:
   <Component data-key={element.key} {...props}>{children}</Component>
   ```

   **HTML counter logic (inline in cross-boundary.html):**

   ```js
   window.addEventListener("kumo-action", function (e) {
     var detail = e.detail;
     if (
       detail.actionName === "increment" ||
       detail.actionName === "decrement"
     ) {
       var el = document.querySelector('[data-key="count-display"]');
       if (el) {
         var current = parseInt(el.textContent || "0", 10);
         el.textContent = String(
           detail.actionName === "increment" ? current + 1 : current - 1,
         );
       }
     }
     appendActionLog(detail);
   });
   ```

**Acceptance:**

- "Counter" preset appears in both versions.
- LLM generates counter UI with increment/decrement buttons.
- Clicking increment/decrement updates the displayed count.
- Action events fire and appear in the action panel.

### D5: Action events panel — React SPA (M)

**Depends on:** D1

Add an action events panel to the React SPA, matching the HTML/UMD version's existing panel.

**Layout:** 2-column fixed layout:

- Left column (60–65%): chat history + current response + input controls.
- Right column (35–40%): action events panel, always visible.

**Panel implementation (`src/app/ActionPanel.tsx`):**

1. Header row: "Action Events" label + "Clear" button.
2. Scrollable log area with monospace font.
3. Each entry: timestamp (HH:MM:SS.mmm) + action name (orange/brand color) + source key + params/context.
4. Empty state: "No action events yet. Generate a form and interact with it."
5. Auto-scroll to latest entry.

**Wiring:**

- `ChatDemo` passes `onAction` callback to `useUITree`.
- `onAction` appends to an `actionLog` state array.
- `ActionPanel` receives and renders the log.
- "Clear" resets the log array.
- "Reset" (chat reset) also clears the log.

**Panel also shows simulated external call:**
Below each action event entry, show a faded line like:

```
→ POST /api/actions { actionName: "submit_form", params: {...} }
```

This is purely visual — no actual network call. Demonstrates to viewers what _would_ happen in a real integration.

**Acceptance:**

- React SPA has a persistent right-side action panel.
- Actions from component interactions appear in the panel.
- Simulated POST lines appear below each action.
- Panel scrolls and can be cleared.

### D6: System prompt — counter example (S)

**Depends on:** —

Add a worked example to `src/core/system-prompt.ts` showing how to generate a counter with action fields. This improves LLM reliability for the counter preset.

Add to the examples section:

```
### Example 5 — Stateful Counter
User: Build a counter with increment and decrement buttons
Response (JSONL patches):
{"op":"add","path":"/root","value":{"type":"Div","key":"counter-root","props":{"className":"flex items-center gap-4"}}}
{"op":"add","path":"/elements/counter-root/children/-","value":"decrement-btn"}
{"op":"add","path":"/elements/decrement-btn","value":{"type":"Button","key":"decrement-btn","props":{"variant":"outline","children":"−"},"action":{"name":"decrement"}}}
{"op":"add","path":"/elements/counter-root/children/-","value":"count-display"}
{"op":"add","path":"/elements/count-display","value":{"type":"Text","key":"count-display","props":{"variant":"heading2","children":"0"}}}
{"op":"add","path":"/elements/counter-root/children/-","value":"increment-btn"}
{"op":"add","path":"/elements/increment-btn","value":{"type":"Button","key":"increment-btn","props":{"variant":"outline","children":"+"},"action":{"name":"increment"}}}
```

**Acceptance:**

- System prompt includes counter example.
- LLM consistently generates counter UIs with correct action names and keys when given the counter preset prompt.

---

## Architecture Notes

### Counter state flow

```
User clicks [+] button
  → StatefulWrapper (Button) calls onAction({ value: "increment" })
  → createActionHandler produces ActionEvent { actionName: "increment", sourceKey: "increment-btn" }
  → dispatch(event) fires to host
  → Host's onAction callback:
      1. Logs event to action panel
      2. Calls actionToPatch(event, currentTree)
      3. Gets back { op: "replace", path: "...", value: "1" }
      4. Applies patch → tree updates → re-render shows "1"
```

### 2-column layout (React SPA)

```
┌─────────────────────────────────────────────────────────────────┐
│  Header: "Kumo Generative UI Demo"              [Dark Mode]     │
├─────────────────────────────────────────────────────────────────┤
│  [preset] [pills] [here] [counter] [...]                        │
├──────────────────────────────────┬──────────────────────────────┤
│  Chat History                    │  Action Events               │
│  ┌─ User: "Build a counter" ─┐  │  ┌────────────────────────┐  │
│  └───────────────────────────┘  │  │ 10:30:01.234           │  │
│  ┌─ [Counter UI rendered] ───┐  │  │ increment from         │  │
│  │  [−]  0  [+]              │  │  │   increment-btn        │  │
│  └───────────────────────────┘  │  │ → POST /api/actions    │  │
│                                  │  │   { name: "increment"} │  │
│  ┌─ Input + Generate/Stop ───┐  │  │                        │  │
│  └───────────────────────────┘  │  └────────────────────────┘  │
└──────────────────────────────┴──────────────────────────────────┘
```

---

## Risks

| Risk                                                            | Impact                                                   | Mitigation                                                                                                     |
| --------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| LLM doesn't consistently generate correct counter structure     | Counter interactions fail                                | D6 adds system prompt example; preset prompt is very explicit about keys/action names                          |
| Tree mutation via action handler creates race with streaming    | Corrupted tree state during active stream                | Only allow action-to-patch when `status !== "streaming"` — actions during streaming are logged but not applied |
| HTML/UMD chat history snapshots are static HTML, not live React | Re-renders or theme changes don't affect history entries | Acceptable: history is read-only record. Note in UI with subtle visual distinction (slightly dimmed).          |
| 2-column layout breaks on narrow viewports                      | Mobile/small screens unusable                            | Add responsive breakpoint: stack vertically below `md` (768px). Action panel goes below chat.                  |

---

## Open Questions

- [x] Counter state approach → **client-side tree mutation via action-to-patch bridge**
- [x] Action panel style → **raw event log matching HTML/UMD, plus simulated POST lines**
- [x] Multi-turn in HTML/UMD → **yes, server already supports history param**
- [ ] Counter preset prompt may need tuning after testing LLM output → **Resolve during D4/D6 implementation. Test 3+ generations and adjust prompt if key names or structure vary.**
- [x] How to find elements in tree for patching → **`tree.elements[key]` directly — keys are map keys by convention. Path: `/elements/${key}/props/children`.**
- [x] How HTML/UMD applies counter patches without tree access → **DOM manipulation via `data-key` attribute (requires `data-key` addition to UITreeRenderer).**

---

## Delivery Order

```
D1 (style unify) ──────────┐
D3 (preset pills HTML)     │──→ D5 (action panel React) ──→ D2 (chat history)
D6 (system prompt counter) │──→ D4 (counter preset + bridge)
```

D1, D3, D6 are independent and can start in parallel.
D5 depends on D1 (needs the 2-column layout).
D2 depends on D1 (history sits inside the new layout).
D4 depends on D6 (needs the system prompt example for reliable LLM output).
