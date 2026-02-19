# Stateful Wrappers, Action System, and Component Expansion

## Problem

kumo-stream proves streaming generative UI works — JSONL patches, cross-boundary UMD, per-element error boundaries. But generated forms are non-functional: Select doesn't hold selections, Checkbox doesn't toggle, Switch doesn't flip. Components render but can't interact. This limits kumo-stream from being the premier generative UI framework to a read-only demo.

Meanwhile, `@cloudflare/kumo/catalog` already defines the type infrastructure for actions (`Action`, `ActionHandlers`, `DynamicValue`, `DataModel`, `VisibilityCondition`) and `UIElement` already has an `action?: Action` field. This infrastructure is unused in kumo-stream.

## Goal

Make kumo-stream's generated UIs fully interactive while preserving all three strengths:

- **Streaming** — incremental JSONL patch rendering (unchanged)
- **Cross-boundary** — UMD bundle, `<script>` tag embedding (unchanged)
- **Per-element error boundaries** — isolated failures (unchanged)

## Constraints

- Stay on `geoquant/streaming-ui` branch
- All work in `_examples/kumo-stream/` (not in `packages/kumo/`)
- Use existing `@cloudflare/kumo/catalog` types — don't reinvent
- Anthropic only (but JSONL patch format is provider-agnostic)
- No new dependencies
- UMD bundle size: target <500KB (currently 405KB)

## Non-Goals

- Data binding / `DynamicValue` path resolution (future work)
- `VisibilityCondition` evaluation (future work)
- Multi-provider LLM support (orthogonal)
- Portalled components: Dialog, Popover, Toast (separate spec)
- MCP server
- Every Layout primitives beyond Stack/Cluster (separate track)

---

## Architecture

### Key Insight: Catalog Types Already Exist

```
@cloudflare/kumo/catalog already defines:

UIElement.action?: Action
Action { name, params?, confirm?, onSuccess?, onError? }
ActionHandler = (params) => void | Promise<void>
ActionHandlers = Record<string, ActionHandler>
DataModel = Record<string, unknown>
DynamicValue<T> = T | { path: string }
```

kumo-stream re-exports these in `src/core/types.ts` but doesn't use them.

### Three Layers

```
Layer 1: Stateful Wrappers (component-map swap)
  └─ Wrap controlled kumo components with useState
  └─ Same COMPONENT_MAP interface, transparent to renderer

Layer 2: Action Dispatch (UITreeRenderer enhancement)
  └─ Read UIElement.action, create handler, pass to wrapper
  └─ Dispatch as CustomEvent on window for host page observability
  └─ Dispatch via callback prop for React app consumers

Layer 3: Component Expansion (more entries in COMPONENT_MAP)
  └─ Add non-portalled interactive components
  └─ Update system prompt with new component docs
```

### Layer 1: Stateful Wrappers

New file: `src/core/stateful-wrappers.tsx`

Wrappers for components that are controlled-only or need state for usability:

| Component             | State Shape                       | Kumo Props Wrapped           | Notes                                     |
| --------------------- | --------------------------------- | ---------------------------- | ----------------------------------------- |
| `StatefulSelect`      | `useState<unknown>(defaultValue)` | `value`, `onValueChange`     | Must also render `Select.Option` children |
| `StatefulCheckbox`    | `useState<boolean>(checked)`      | `checked`, `onCheckedChange` | No `defaultChecked` in kumo               |
| `StatefulSwitch`      | `useState<boolean>(checked)`      | `checked`, `onCheckedChange` | No `defaultChecked` in kumo               |
| `StatefulTabs`        | `useState<string>(selectedValue)` | `value`, `onValueChange`     | Uses data-driven `tabs` prop              |
| `StatefulCollapsible` | `useState<boolean>(open)`         | `open`, `onOpenChange`       | No `defaultOpen` in kumo                  |

Components that DON'T need wrappers (uncontrolled works):

- `Input` — native `defaultValue` works
- `InputArea`/`Textarea` — native `defaultValue` works
- `Radio.Group` — has `defaultValue`
- `Checkbox.Group` — has `defaultValue`

**Wrapper pattern:**

```tsx
function StatefulSelect({
  defaultValue,
  onAction,
  options,
  children,
  ...props
}) {
  const [value, setValue] = useState(defaultValue ?? null);

  function handleChange(next: unknown) {
    setValue(next);
    onAction?.({ value: next });
  }

  return (
    <Select {...props} value={value} onValueChange={handleChange}>
      {children}
    </Select>
  );
}
```

**COMPONENT_MAP changes:**

```tsx
// component-map.ts
import { StatefulSelect, StatefulCheckbox, StatefulSwitch, ... } from "./stateful-wrappers";

export const COMPONENT_MAP = {
  // ... existing entries ...
  Select: StatefulSelect,   // was: Select
  Checkbox: StatefulCheckbox, // was: Checkbox
  Switch: StatefulSwitch,     // was: Switch
  Tabs: StatefulTabs,         // was: Tabs
  Collapsible: StatefulCollapsible, // new
};
```

### Layer 2: Action Dispatch

**How actions flow:**

1. LLM emits `UIElement.action` in the JSONL patch:

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

2. `UITreeRenderer` reads `element.action`, creates a handler, passes as `onAction` prop to the component wrapper.

3. The wrapper calls `onAction({ value })` when state changes.

4. The handler:
   - In **React app** mode: calls user-provided `ActionHandlers` callback
   - In **cross-boundary UMD** mode: dispatches `CustomEvent("kumo-action", { detail })` on `window`

**UITreeRenderer changes:**

```tsx
// In RenderElement, after resolving the component:
const actionHandler = element.action
  ? createActionHandler(element.action, element.key, onAction)
  : undefined;

<Comp {...restProps} onAction={actionHandler}>
```

**Action handler factory:**

New file: `src/core/action-handler.ts`

```tsx
interface ActionEvent {
  actionName: string;
  sourceKey: string;
  params?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

function createActionHandler(
  action: Action,
  sourceKey: string,
  dispatch: (event: ActionEvent) => void,
): (context?: Record<string, unknown>) => void {
  return (context) => {
    dispatch({
      actionName: action.name,
      sourceKey,
      params: action.params as Record<string, unknown> | undefined,
      context,
    });
  };
}
```

**UMD API addition:**

```tsx
// loadable/index.ts
const api = {
  // ... existing ...

  /** Register action handlers for the cross-boundary context. */
  onAction(handler: (event: ActionEvent) => void): () => void {
    // Subscribe. Returns unsubscribe function.
  },
};
```

Plus automatic `CustomEvent` dispatch:

```ts
window.dispatchEvent(
  new CustomEvent("kumo-action", {
    detail: { actionName, sourceKey, params, context },
  }),
);
```

### Layer 3: Component Expansion

New components to add to COMPONENT_MAP:

| Component     | Stateful?        | Sub-components              | Notes                               |
| ------------- | ---------------- | --------------------------- | ----------------------------------- |
| `Collapsible` | Yes              | None (single element)       | Open/close state                    |
| `Radio`       | No               | `Radio.Group`, `Radio.Item` | Group has `defaultValue`            |
| `Textarea`    | No               | None                        | Alias for `InputArea`, uncontrolled |
| `Meter`       | Already mapped   | —                           | —                                   |
| `Tabs`        | Yes (controlled) | Data-driven via `tabs` prop | Already mapped but needs wrapper    |

**System prompt updates:**

- Document `Collapsible` with `open`/`defaultOpen` (wrapper handles state)
- Document `Radio.Group` + `Radio.Item` pattern
- Document `Textarea` as alias
- Document `action` prop on any interactive element
- Document action format: `{"action": {"name": "submit_form"}}`

---

## Deliverables

### D1: Stateful Wrappers (M)

**Files:** `src/core/stateful-wrappers.tsx`, `src/core/component-map.ts`

Create wrapper components for Select, Checkbox, Switch, Tabs, Collapsible. Swap into COMPONENT_MAP. Each wrapper:

- Accepts same props as the kumo component
- Adds `defaultValue`/`defaultChecked` → `useState` bridge
- Accepts optional `onAction` callback
- Passes through all other props unchanged

**Acceptance:**

- Select holds selection after click
- Checkbox toggles visually
- Switch flips
- Tabs switch panels
- Collapsible opens/closes
- All existing tests still pass
- Cross-boundary demo works with stateful components

### D2: Action Handler System (M)

**Files:** `src/core/action-handler.ts`, `src/core/UITreeRenderer.tsx`, `src/loadable/index.ts`

- Create `ActionEvent` type and `createActionHandler` factory
- UITreeRenderer reads `element.action`, injects `onAction` prop
- Loadable API: `onAction(handler)` subscription + `CustomEvent("kumo-action")` dispatch
- React app: `useUITree` accepts `onAction` callback

**Acceptance:**

- Button with `action: { name: "submit" }` dispatches event on click
- Select with `action` dispatches on value change with `{ value }` context
- Cross-boundary page can `window.addEventListener("kumo-action", ...)` to observe
- React app can pass `onAction` to `useUITree`

**Depends on:** D1 (wrappers need `onAction` prop interface)

### D3: Component Expansion (S)

**Files:** `src/core/component-map.ts`, `src/core/system-prompt.ts`

- Add `RadioGroup`, `RadioItem`, `Textarea`, `Collapsible` to COMPONENT_MAP
- Update system prompt with new component docs and action prop documentation
- Add worked example using stateful form (select + checkbox + submit button)

**Acceptance:**

- LLM generates forms with Radio groups, Textarea
- Collapsible sections work in generated UI
- System prompt example shows action usage

**Depends on:** D1, D2

### D4: Tests (M)

**Files:** `src/__tests__/stateful-wrappers.test.tsx`, `src/__tests__/action-handler.test.ts`, updates to existing test files

- Unit tests for each stateful wrapper (render, state change, onAction callback)
- Unit tests for action handler factory
- Integration test: streaming form with stateful components
- Regression: existing preset tests still pass

**Acceptance:**

- All new tests pass
- All existing 107 tests pass
- Coverage for every wrapper and action dispatch path

**Depends on:** D1, D2, D3

### D5: Cross-Boundary Demo Update (S)

**Files:** `public/cross-boundary.html`

- Add action event listener example
- Show form generation with interactive components
- Log actions to a visible panel on the page

**Acceptance:**

- Cross-boundary demo shows interactive form
- Actions visible in on-page log
- Dark mode still works
- Button variants still styled correctly

**Depends on:** D1, D2, D3

---

## Risks

| Risk                                               | Likelihood | Impact | Mitigation                                                                                                             |
| -------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| UMD bundle size exceeds 500KB                      | Low        | Medium | Wrappers are thin; main cost is already React+kumo. Monitor after D1.                                                  |
| Stateful wrappers break streaming tolerance        | Low        | High   | Wrappers only add state; they don't change the prop-spreading pipeline. Test streaming with stateful components in D4. |
| LLM doesn't emit `action` field reliably           | Medium     | Medium | System prompt examples in D3 teach the format. Fallback: components work fine without actions (just no dispatch).      |
| Select.Option children rendering in streaming mode | Medium     | Medium | Options arrive as child elements. Streaming tolerance already handles missing children. Test explicitly in D4.         |

---

## Open Questions

- [ ] Should `onAction` in cross-boundary mode send actions back to the LLM (multi-turn) or just dispatch to the host page? → Recommend: host page only for now. Multi-turn is a separate concern.
- [ ] Should `Combobox` be included in D1? It's the most complex wrapper (compound component with trigger, content, items). → Recommend: defer to a follow-up. Select covers the dropdown use case for now.

---

## Effort Summary

| Deliverable               | Effort   | Depends On |
| ------------------------- | -------- | ---------- |
| D1: Stateful Wrappers     | M (1-2h) | —          |
| D2: Action Handler System | M (1-2h) | D1         |
| D3: Component Expansion   | S (<1h)  | D1, D2     |
| D4: Tests                 | M (1-2h) | D1, D2, D3 |
| D5: Cross-Boundary Demo   | S (<1h)  | D1, D2, D3 |

**Total: L (5-8h)**
