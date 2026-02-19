# PRD: Stateful Actions & Component Expansion for kumo-stream

**Date:** 2026-02-19

---

## Problem Statement

### What problem are we solving?

kumo-stream demonstrates that streaming generative UI works — JSONL patches, cross-boundary UMD embedding, per-element error boundaries. But generated forms are **non-functional**: Select doesn't hold selections, Checkbox doesn't toggle, Switch doesn't flip. Components render but can't interact. This reduces kumo-stream from a fully interactive generative UI framework to a read-only demo.

Furthermore, `@cloudflare/kumo/catalog` already defines a complete type infrastructure for actions (`Action`, `ActionHandlers`, `UIElement.action`), but kumo-stream doesn't use it. Generated UIs have no way to communicate user interactions back to the host application — there's no event dispatch, no callback system, no observable interactivity.

### Why now?

The stateful wrappers (Layer 1) were partially implemented by a previous agent — `StatefulSelect`, `StatefulCheckbox`, `StatefulSwitch`, `StatefulTabs`, and `StatefulCollapsible` exist in `src/core/stateful-wrappers.tsx` and are wired into `COMPONENT_MAP`. But the **action dispatch pipeline** (Layer 2) that connects these wrappers to host applications is entirely unimplemented, and the system prompt (Layer 3) doesn't teach the LLM about actions or new components.

The wrappers are dead weight without the dispatch layer. Completing this work turns kumo-stream from "streaming read-only UI" into "streaming interactive UI" — a qualitative leap.

### Who is affected?

- **Primary users:** Developers embedding kumo-stream's cross-boundary UMD bundle in host pages who need to observe and react to user interactions (form submissions, selections, toggles)
- **Secondary users:** Developers using kumo-stream as a React component who want `onAction` callbacks from generated UIs

---

## Proposed Solution

### Overview

Wire the existing stateful wrappers into a complete action dispatch pipeline: the `UITreeRenderer` reads `UIElement.action` from the tree, creates handlers via a factory, and injects them as `onAction` props into stateful wrappers. In cross-boundary (UMD) mode, actions dispatch as `CustomEvent("kumo-action")` on `window` and are observable via a subscription API. In React app mode, actions flow through an `onAction` callback on `useUITree`. The system prompt is updated to teach the LLM the action format and new components.

### User Experience

#### User Flow: Cross-Boundary (UMD) Host Page

1. Host page loads UMD bundle and renders streaming UI into a container
2. LLM generates a form with `action` fields on interactive elements (e.g. `{ "action": { "name": "submit_form" } }` on a Button)
3. User interacts with the generated UI — selects a value, toggles a switch, clicks submit
4. Each interaction dispatches a `CustomEvent("kumo-action")` on `window` with `{ actionName, sourceKey, params, context }`
5. Host page listens via `window.addEventListener("kumo-action", handler)` or `CloudflareKumo.onAction(handler)` and processes the event

#### User Flow: React App Consumer

1. Developer passes `onAction` callback to `useUITree` hook
2. LLM generates interactive UI with `action` fields
3. User interacts with components
4. `onAction` callback fires with `ActionEvent` payload
5. Developer handles the event (API call, state update, multi-turn LLM conversation, etc.)

---

## End State

When this PRD is complete, the following will be true:

- [ ] Action dispatch pipeline exists: `UITreeRenderer` reads `element.action`, creates handlers, injects `onAction` into wrappers
- [ ] `ActionEvent` type and `createActionHandler` factory exist in `src/core/action-handler.ts`
- [ ] Cross-boundary UMD API exposes `onAction(handler)` subscription and dispatches `CustomEvent("kumo-action")`
- [ ] React app's `useUITree` hook accepts an `onAction` callback
- [ ] `RadioGroup`, `RadioItem`, `Textarea`, `Collapsible` are in `COMPONENT_MAP`
- [ ] System prompt teaches the LLM about `action` fields, new components, and includes a worked form example
- [ ] Cross-boundary demo (`public/cross-boundary.html`) demonstrates interactive forms with visible action logging
- [ ] All new functionality has test coverage
- [ ] All existing 107 tests continue to pass
- [ ] UMD bundle size remains under 500KB

---

## Success Metrics

### Quantitative

| Metric                                       | Current                     | Target                                | Measurement Method                               |
| -------------------------------------------- | --------------------------- | ------------------------------------- | ------------------------------------------------ |
| Interactive component types in COMPONENT_MAP | 5 stateful + 2 uncontrolled | 5 stateful + 4 uncontrolled + 1 alias | Count entries in `component-map.ts`              |
| Action dispatch paths                        | 0                           | 2 (UMD CustomEvent + React callback)  | Code inspection                                  |
| Test count                                   | ~107                        | ~130+                                 | `vitest run` output                              |
| UMD bundle size                              | 405KB                       | <500KB                                | `ls -la dist/loadable/component-loadable.umd.js` |

### Qualitative

- Generated forms are fully interactive — users can select, toggle, type, and submit
- Host page developers can observe all user interactions through a single event stream
- LLM reliably generates `action` fields when appropriate (validated by system prompt examples)

---

## Acceptance Criteria

### Feature: Action Handler System

- [ ] `ActionEvent` interface defined: `{ actionName: string; sourceKey: string; params?: Record<string, unknown>; context?: Record<string, unknown> }`
- [ ] `createActionHandler(action, sourceKey, dispatch)` factory returns a handler that calls `dispatch` with a well-formed `ActionEvent`
- [ ] `UITreeRenderer` reads `element.action` on each element, creates a handler via factory, and passes as `onAction` prop
- [ ] Elements without `action` receive no `onAction` prop (no unnecessary re-renders)

### Feature: Cross-Boundary (UMD) Action Dispatch

- [ ] `window.dispatchEvent(new CustomEvent("kumo-action", { detail }))` fires on every action
- [ ] `CloudflareKumo.onAction(handler)` registers a callback and returns an unsubscribe function
- [ ] Multiple subscribers receive the same event
- [ ] Unsubscribe actually stops delivery

### Feature: React App Action Dispatch

- [ ] `useUITree` hook accepts optional `onAction: (event: ActionEvent) => void` parameter
- [ ] `onAction` fires when any interactive element with an `action` triggers

### Feature: Component Expansion

- [ ] `RadioGroup` and `RadioItem` mapped to `Radio.Group` and `Radio.Item`
- [ ] `Textarea` mapped as alias for `InputArea` (uncontrolled)
- [ ] `Collapsible` mapped to `StatefulCollapsible` (already done, verify)
- [ ] System prompt documents all new components with prop signatures

### Feature: System Prompt Updates

- [ ] Documents `action` prop format: `{ "action": { "name": "action_name" } }`
- [ ] Documents `onAction` behavior: interactive elements can trigger named actions
- [ ] Includes worked example: a form with Select + Checkbox + Button where Button has a submit action
- [ ] Documents `Radio.Group` + `Radio.Item` pattern
- [ ] Documents `Textarea` as alias for `InputArea`

### Feature: Cross-Boundary Demo Update

- [ ] Demo page has an action event log panel visible on screen
- [ ] Generates interactive forms that dispatch actions
- [ ] Actions appear in the log panel in real-time
- [ ] Dark mode and existing styling still work

---

## Technical Context

### Existing Patterns

- **Stateful wrappers:** `src/core/stateful-wrappers.tsx` — 5 wrappers already implemented with `onAction?: OnActionCallback` interface. Pattern: `useState` bridge + `onAction?.({ value })` on change.
- **Component map swap:** `src/core/component-map.ts` — maps string type names to React components. Wrappers already swapped in for Select, Checkbox, Switch, Tabs, Collapsible.
- **Prop spreading:** `UITreeRenderer.tsx` — `element.props` spread directly onto component. `onAction` needs to be injected alongside these props.
- **Catalog types:** `@cloudflare/kumo/catalog` — `Action`, `ActionHandler`, `ActionHandlers`, `UIElement.action` all defined. `types.ts` already re-exports them.

### Key Files

| File                                 | Relevance                                                               |
| ------------------------------------ | ----------------------------------------------------------------------- |
| `src/core/stateful-wrappers.tsx`     | Layer 1 complete — 5 wrappers with `onAction` interface                 |
| `src/core/component-map.ts`          | Component registry — needs new entries (Radio, Textarea)                |
| `src/core/UITreeRenderer.tsx`        | Render pipeline — needs `element.action` reading + `onAction` injection |
| `src/core/types.ts`                  | Re-exports catalog types — `Action`, `ActionHandlers` already here      |
| `src/core/hooks.ts`                  | `useUITree` hook — needs `onAction` parameter                           |
| `src/core/system-prompt.ts`          | LLM instructions — needs action + new component docs                    |
| `src/loadable/index.ts`              | UMD API — needs `onAction(handler)` + `CustomEvent` dispatch            |
| `public/cross-boundary.html`         | Demo page — needs action log panel                                      |
| `packages/kumo/src/catalog/types.ts` | Source of truth for `Action`, `ActionEvent`, `UIElement` types          |

### System Dependencies

- `@cloudflare/kumo/catalog` — linked local package, already a dependency
- No new package dependencies required

---

## Risks & Mitigations

| Risk                                                                  | Likelihood | Impact | Mitigation                                                                                                                 |
| --------------------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| UMD bundle size exceeds 500KB after additions                         | Low        | Medium | Wrappers are thin; Radio/Textarea/action-handler add minimal code. Monitor after implementation.                           |
| Stateful wrappers break streaming tolerance                           | Low        | High   | Wrappers only add state; they don't change the prop-spreading pipeline. Regression tests cover streaming.                  |
| LLM doesn't emit `action` field reliably                              | Medium     | Medium | System prompt examples teach the format explicitly. Fallback: components work without actions (just no dispatch).          |
| `Select.Option` children rendering in streaming mode                  | Medium     | Medium | Options arrive as child elements during streaming. Existing streaming tolerance handles missing children. Test explicitly. |
| `CustomEvent` not available in all UMD embedding contexts (e.g., SSR) | Low        | Low    | Guard with `typeof window !== "undefined"` check. UMD is inherently browser-only.                                          |

---

## Alternatives Considered

### Alternative 1: Bidirectional action dispatch (actions sent back to LLM for multi-turn)

- **Description:** Actions trigger a new LLM turn, creating a conversation loop where the UI responds to user input
- **Pros:** Enables truly dynamic, conversational UIs
- **Cons:** Significantly more complex (conversation state management, re-rendering mid-stream, conflict resolution). Orthogonal concern.
- **Decision:** Deferred. Host page dispatch covers the immediate need. Multi-turn can layer on top later.

### Alternative 2: Include `Combobox` in stateful wrappers

- **Description:** Add `StatefulCombobox` wrapper for the compound Combobox component (trigger + content + items)
- **Pros:** Covers autocomplete/search-select use case
- **Cons:** Most complex compound component in kumo; trigger/content/items sub-component orchestration is significantly harder than Select
- **Decision:** Deferred. `Select` covers the dropdown use case. `Combobox` is a separate, more complex effort.

### Alternative 3: Full `DataModel` + `DynamicValue` path resolution

- **Description:** Implement the data model layer so `{ path: "/user/name" }` dynamic values resolve at runtime
- **Pros:** Enables data-driven UIs where component props bind to a shared data store
- **Cons:** Large scope increase; requires data store, path resolution, re-rendering on data change
- **Decision:** Deferred. Listed in spec non-goals. Actions work without data binding.

---

## Non-Goals (v1)

- **Data binding / `DynamicValue` path resolution** — `{ path: "..." }` values are not resolved. Future work.
- **`VisibilityCondition` evaluation** — `visible` field on `UIElement` is not evaluated. Future work.
- **Multi-provider LLM support** — Anthropic only. JSONL patch format is provider-agnostic but client/prompt are Anthropic-specific.
- **Portalled components (Dialog, Popover, Toast)** — Require portal management in cross-boundary context. Separate spec.
- **MCP server** — Orthogonal concern.
- **Additional layout primitives** — Beyond existing Stack/Cluster. Separate track.
- **`Combobox` stateful wrapper** — Too complex for this iteration. Select covers dropdown needs.
- **`ActionConfirm` dialog support** — The `Action.confirm` field exists in catalog types but rendering confirmation dialogs is deferred.

---

## Interface Specifications

### UMD API Addition

```typescript
// Added to window.CloudflareKumo
interface CloudflareKumo {
  // ... existing methods ...

  /** Subscribe to action events. Returns unsubscribe function. */
  onAction(handler: (event: ActionEvent) => void): () => void;
}
```

### ActionEvent Type

```typescript
interface ActionEvent {
  actionName: string;
  sourceKey: string;
  params?: Record<string, unknown>;
  context?: Record<string, unknown>;
}
```

### CustomEvent Dispatch

```typescript
window.dispatchEvent(
  new CustomEvent("kumo-action", {
    detail: { actionName, sourceKey, params, context },
  }),
);
```

### React Hook Extension

```typescript
// useUITree gains optional onAction parameter
function useUITree(options: {
  // ... existing options ...
  onAction?: (event: ActionEvent) => void;
}): UseUITreeReturn;
```

### JSONL Patch Action Format (LLM output)

```jsonl
{
  "op": "add",
  "path": "/elements/submit-btn",
  "value": {
    "key": "submit-btn",
    "type": "Button",
    "props": {
      "children": "Submit",
      "variant": "primary"
    },
    "action": {
      "name": "submit_form"
    }
  }
}
```

---

## Documentation Requirements

- [ ] System prompt updated with action format and new component documentation
- [ ] Cross-boundary demo serves as living documentation of the UMD action API
- [ ] `ActionEvent` type exported and documented in `src/core/types.ts`

---

## Open Questions

| Question                                                                                                                                                                      | Owner | Status |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------ |
| Should `onAction` in cross-boundary mode send actions back to the LLM (multi-turn) or just dispatch to host page? Recommendation: host page only for v1.                      | —     | Open   |
| Should `Action.params` dynamic values (`{ path: "..." }`) be resolved before dispatch, or passed raw? Recommendation: pass raw; resolution is a DataModel concern (non-goal). | —     | Open   |
| Should the action handler support `Action.confirm` (show confirmation dialog before dispatching)? Recommendation: defer; requires UI chrome outside the generated tree.       | —     | Open   |

---

## Appendix

### Glossary

- **Stateful wrapper:** A thin React component that wraps a controlled kumo component with `useState`, making it interactive without external state management
- **Action dispatch:** The pipeline from user interaction → `onAction` callback → `ActionEvent` → host application
- **Cross-boundary / UMD:** The mode where kumo-stream runs as a `<script>`-tag-loaded bundle embedded in any HTML page, without React in the host
- **JSONL patch:** One RFC 6902 JSON Patch operation per line, streamed incrementally from the LLM

### References

- Original spec: `_examples/kumo-stream/specs/stateful-actions-components.md`
- Streaming patches spec: `_examples/kumo-stream/specs/streaming-patches.md`
- Catalog types: `packages/kumo/src/catalog/types.ts`
- Cross-boundary PRD: `_examples/kumo-stream/prd-cross-boundary.md`
