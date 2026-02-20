# Spec: kumo-stream Interactivity, Exports, and .well-known Convention

**Status:** Implemented on `geoquant/streaming-ui`
**Effort:** L (1-2 days)
**Type:** Feature plan + bug fixes + package enhancement
**Branch:** `geoquant/streaming-ui` (only)

## Problem Definition

kumo-stream is the stress-test for cross-boundary generative UI. Three critical gaps
prevent it from being a world-class reference implementation:

1. **Counter/interactive buttons don't work.** UITreeRenderer injects `onAction` as a prop
   but Kumo's `Button` has no `onAction` prop — it only has `onClick`. The stateful wrapper
   pattern (used by Select, Checkbox, Switch, Tabs, Collapsible) was never applied to Button.
   Buttons silently do nothing on click. This is the core interactivity failure.

2. **Generic action system missing.** `action-patch-bridge.ts` hardcodes counter actions only.
   Any other LLM-generated interactive UI (form submit, navigation, data fetch) has no path
   to the host. The bridge should be a generic dispatch — host decides what to do.

3. **Package export issues.** `@cloudflare/kumo` exports `./ai/schemas` pointing at raw `.ts`
   (fails without TS-capable bundler). kumo-stream uses `link:../../packages/kumo` which
   breaks with bun and doesn't reflect the npm consumer experience.

4. **`.well-known/` convention not implemented.** GENERATIVE-UI.md proposes it but kumo-stream
   serves loadable from `/dist/loadable/` instead.

5. **Package manager mismatch.** bun.lock present but `link:` protocol breaks with bun.
   Monorepo standardizes on pnpm.

### Cost of not solving

The entire value proposition of kumo-stream — "generate useful UIs that users can interact
with" — is broken. Buttons render but do nothing. This undermines every demo and the path
toward shipping generative UI in kumo proper.

## Constraints

- Work only on `geoquant/streaming-ui` branch.
- No changes to Kumo's `Button` component API (fix in kumo-stream renderer layer)
- `component-registry.json` and `schemas.ts` already ship in the npm package — just fix the export path
- `.well-known` implementation in kumo-stream's Express server only (not kumo main package yet)
- pnpm for package management (matching monorepo)
- Existing 177 tests must continue passing; new tests for all changes

## Deliverables

### D1: Fix Button action dispatch (S)

**Root cause:** `UITreeRenderer` injects `restProps.onAction = createActionHandler(...)` on
elements with an `action` field. Kumo's `Button` component does not have an `onAction` prop.
The StatefulWrapper pattern explicitly calls `onAction?.()` in onChange handlers, but Button
has no wrapper.

**Fix:** In `UITreeRenderer.tsx`, when the resolved component is `Button` (or more generally,
when an element has `action` AND the component type is known to use `onClick` rather than
`onAction`), inject an `onClick` handler that calls the action handler.

```tsx
// In RenderElement, after the action handler injection block:
if (element.action != null && onAction != null) {
  const handler = createActionHandler(element.action, elementKey, onAction);

  // Components with stateful wrappers already consume onAction.
  // For components that use onClick (Button, Link), bridge onClick → action.
  const componentType = element.type;
  if (componentType === "Button" || componentType === "Link") {
    const existingOnClick = restProps.onClick as (() => void) | undefined;
    restProps.onClick = () => {
      existingOnClick?.();
      handler();
    };
  } else {
    restProps.onAction = handler;
  }
}
```

**Alternative considered:** StatefulButtonWrapper — rejected because Button doesn't need
internal state management. It just needs onClick→action bridging. Doing it in the renderer
is simpler and covers Link too.

**Acceptance criteria:**

- [ ] Counter increment/decrement buttons update the count in React SPA
- [ ] Counter increment/decrement buttons update the count in HTML/UMD cross-boundary
- [ ] Other Button actions (non-counter) dispatch ActionEvents to host
- [ ] Link elements with actions dispatch on click
- [ ] Existing onClick props from LLM output are preserved (not overwritten)
- [ ] Tests: new test cases for Button/Link action injection in UITreeRenderer

**Depends on:** —

---

### D2: Generic action dispatch system (M)

**Current state:** `action-patch-bridge.ts` hardcodes `increment`/`decrement` → counter patch.
Unknown actions return null. The host has no generic way to handle arbitrary actions.

**Design:** Replace the hardcoded bridge with a generic host callback pattern:

1. **ChatDemo.tsx**: `handleAction` dispatches ALL actions to a pluggable handler map.
   Counter actions are just one entry. Form submissions, navigation, API calls are others.

2. **Action handler registry** (new: `src/core/action-registry.ts`):

```typescript
/** Map of action names to handler functions. */
export type ActionHandlerMap = Record<
  string,
  (event: ActionEvent, tree: UITree) => ActionResult
>;

/** Result of handling an action. */
export type ActionResult =
  | { type: "patch"; patches: readonly JsonPatchOp[] }
  | { type: "message"; content: string } // send as next chat message
  | { type: "external"; url: string; method: string; body?: unknown }
  | { type: "none" }; // logged only

/** Built-in action handlers. */
export const BUILTIN_HANDLERS: ActionHandlerMap = {
  increment: counterHandler,
  decrement: counterHandler,
  submit_form: formSubmitHandler,
  navigate: navigationHandler,
};

function counterHandler(event: ActionEvent, tree: UITree): ActionResult {
  const patch = actionToPatch(event, tree);
  return patch ? { type: "patch", patches: [patch] } : { type: "none" };
}

function formSubmitHandler(event: ActionEvent, tree: UITree): ActionResult {
  // Collect form values from tree elements referenced in event.params
  return { type: "message", content: summarizeFormValues(event, tree) };
}
```

3. **ChatDemo.tsx** uses the registry:

```typescript
const handleAction = useCallback((event: ActionEvent) => {
  logAction(event);
  if (statusRef.current === "streaming") return;

  const handler = actionHandlers[event.actionName];
  const result = handler
    ? handler(event, treeRef.current)
    : { type: "none" as const };

  switch (result.type) {
    case "patch":
      applyPatchesRef.current(result.patches);
      break;
    case "message":
      handleSubmit(result.content); // auto-send as next chat message
      break;
    case "external":
      fetch(result.url, {
        method: result.method,
        body: JSON.stringify(result.body),
      });
      break;
  }
}, []);
```

4. **cross-boundary.html** — same pattern via `CloudflareKumo.onAction()`:

```javascript
CloudflareKumo.onAction(function (event) {
  appendActionLog(event);
  if (streamingActive) return;

  // Counter actions remain inline for simplicity
  if (event.actionName === "increment" || event.actionName === "decrement") {
    // ... existing counter logic unchanged
  }

  // Form submissions: send as next chat message
  if (event.actionName === "submit_form") {
    var formData = event.context || {};
    streamChat("Form submitted: " + JSON.stringify(formData));
  }
});
```

5. **System prompt enhancement** — add form-submit action example and generic action
   guidelines to `system-prompt.ts`.

**Acceptance criteria:**

- [ ] Counter actions still work (regression test)
- [ ] Form-submit actions send form data as a chat message
- [ ] Unknown actions are logged but don't crash
- [ ] ActionResult discriminated union is exhaustively typed
- [ ] System prompt includes form-submit and generic action examples
- [ ] Tests: action registry handlers, form collection, message dispatch

**Depends on:** D1

---

### D3: Fix `@cloudflare/kumo` schemas export (S)

**Root cause:** `package.json` exports `./ai/schemas` pointing at raw TypeScript:

```json
"./ai/schemas": { "types": "./ai/schemas.ts", "import": "./ai/schemas.ts" }
```

The compiled schemas exist in `dist/` as a content-hashed chunk (`schemas-DoprfCSB.js`)
because `src/catalog/catalog.ts` dynamically imports it. But there's no stable entry point.

**Fix (in `packages/kumo`):**

1. **Add `ai/schemas` as a vite entry point** in `vite.config.ts`:

```typescript
entry: {
  // ... existing entries
  "ai/schemas": resolve(__dirname, "ai/schemas.ts"),
}
```

This produces a stable `dist/ai/schemas.js`.

2. **Update `package.json` export:**

```json
"./ai/schemas": {
  "types": "./dist/ai/schemas.d.ts",
  "import": "./dist/ai/schemas.js"
}
```

3. **Add `zod` to `externals`** in vite config (already an optional peer dep, shouldn't be
   bundled into the compiled output — consumers provide their own zod).

4. **Verify** the catalog's dynamic `import("../../ai/schemas")` still resolves correctly
   after schemas becomes a proper entry point (Rollup should deduplicate).

**Acceptance criteria:**

- [ ] `import { ButtonSchema } from "@cloudflare/kumo/ai/schemas"` works with Node.js (no TS loader)
- [ ] `import type { ... } from "@cloudflare/kumo/ai/schemas"` still resolves types
- [ ] `dist/ai/schemas.js` is a stable (non-hashed) output file
- [ ] Catalog's lazy schema loading still works
- [ ] Build passes, existing tests pass

**Depends on:** —

---

### D4: Switch kumo-stream to pnpm (S)

**Current state:** `bun.lock` exists, `@cloudflare/kumo: "link:../../packages/kumo"`.
`link:` protocol breaks with bun's resolver. Monorepo uses pnpm everywhere else.

**Fix:**

1. Delete `bun.lock`
2. Change `@cloudflare/kumo` dependency to `workspace:*` in `package.json`
3. Add `_examples/kumo-stream` to root `pnpm-workspace.yaml` (if not already present)
4. Run `pnpm install` from root
5. Verify `node_modules/@cloudflare/kumo` resolves correctly
6. Update any scripts that reference `bun` to use `pnpm` or `npx`

**If `_examples/` is not in pnpm-workspace.yaml:** Add it as:

```yaml
packages:
  - "packages/*"
  - "_examples/*"
```

**Acceptance criteria:**

- [ ] `bun.lock` removed
- [ ] `pnpm install` from root resolves `@cloudflare/kumo` correctly
- [ ] `pnpm dev`, `pnpm build`, `pnpm test` all work from `_examples/kumo-stream/`
- [ ] `pnpm build:loadable` produces `dist/loadable/` correctly
- [ ] No `bun` references remain in package.json scripts

**Depends on:** —

---

### D5: Implement `.well-known/` convention (M)

**From GENERATIVE-UI.md:**

```
/.well-known/component-loadable.umd.cjs
/.well-known/component-registry.json
/.well-known/stylesheet.css
```

**Implementation in `server/index.ts`:**

1. **Add `.well-known` static route** pointing to `dist/loadable/`:

```typescript
// Serve .well-known convention files
app.get("/.well-known/component-loadable.umd.js", (_req, res) => {
  res.sendFile(
    path.join(PROJECT_ROOT, "dist/loadable/component-loadable.umd.js"),
  );
});

app.get("/.well-known/component-registry.json", async (_req, res) => {
  // Serve from @cloudflare/kumo's published registry
  const registryPath = require.resolve(
    "@cloudflare/kumo/ai/component-registry.json",
  );
  res.sendFile(registryPath);
});

app.get("/.well-known/stylesheet.css", (_req, res) => {
  res.sendFile(path.join(PROJECT_ROOT, "dist/loadable/style.css"));
});
```

Since this is ESM, use `import.meta.resolve` or `createRequire` for resolving kumo's
registry path.

2. **Update `cross-boundary.html`** to reference `.well-known` paths (with fallback to
   current paths for dev):

```html
<link rel="stylesheet" href="/.well-known/stylesheet.css" />
<script src="/.well-known/component-loadable.umd.js"></script>
```

3. **Add discovery endpoint:**

```typescript
app.get("/.well-known/generative-ui.json", (_req, res) => {
  res.json({
    version: "0.1.0",
    loadable: "/.well-known/component-loadable.umd.js",
    registry: "/.well-known/component-registry.json",
    stylesheet: "/.well-known/stylesheet.css",
    streaming: {
      format: "jsonl",
      patchFormat: "rfc6902",
      endpoint: "/api/chat",
    },
  });
});
```

4. **Update GENERATIVE-UI.md** to document the convention with kumo-stream as reference
   implementation. Note the `.umd.js` extension (not `.umd.cjs` as originally proposed —
   Vite outputs `.js` for UMD builds).

**Acceptance criteria:**

- [ ] `GET /.well-known/component-loadable.umd.js` returns the UMD bundle
- [ ] `GET /.well-known/component-registry.json` returns the component registry
- [ ] `GET /.well-known/stylesheet.css` returns the compiled CSS
- [ ] `GET /.well-known/generative-ui.json` returns discovery metadata
- [ ] `cross-boundary.html` loads from `.well-known` paths
- [ ] GENERATIVE-UI.md updated with kumo-stream as reference

**Depends on:** D3 (registry from npm), D4 (pnpm for dependency resolution)

---

### D6: System prompt a11y and DOM nesting fixes (S)

**Observed issues:**

- Input components generated without `label` or `aria-label` → a11y warnings
- `<p>` inside `<p>` via Banner containing Text → DOM nesting warning

**Fix in `system-prompt.ts`:**

Add to the anti-patterns / design rules section:

```
## Accessibility Rules (REQUIRED)
- Every Input MUST have a `label` or `aria-label` prop
- Every Checkbox MUST have a `label` prop
- Every Select MUST have a `label` prop
- Never nest Text inside Banner as direct children — use children string prop instead
- Never nest block-level elements (Surface, Stack, Grid) inside Text
```

**Acceptance criteria:**

- [ ] System prompt includes a11y rules
- [ ] System prompt includes DOM nesting anti-patterns
- [ ] Counter preset example has proper labels on any form elements

**Depends on:** —

---

### D7: Update GENERATIVE-UI.md documentation (S)

Bring the parent guide up to date with kumo-stream's implementation:

1. **Streaming section** (currently just "Talk about...") — document JSONL + RFC 6902 approach
2. **Action system** — document the action dispatch pattern (missing entirely)
3. **`.well-known` convention** — formalize with kumo-stream as reference
4. **Registry hosting** — clarify that `component-registry.json` ships in `@cloudflare/kumo`
   npm package and can be served from `node_modules` or re-hosted

**Acceptance criteria:**

- [ ] Streaming section documents JSONL + RFC 6902 pattern with code examples
- [ ] Action system section explains ActionEvent → host dispatch → effect
- [ ] `.well-known` section updated to match implementation (`.umd.js` not `.umd.cjs`)
- [ ] Registry hosting clarified

**Depends on:** D5

---

## Delivery Order

```
D1 (Button fix) ──────────┐
                           ├──► D2 (Generic actions)
D3 (Schemas export fix) ──┤
D4 (pnpm switch) ─────────┼──► D5 (.well-known)
D6 (System prompt a11y) ──┘         │
                                    ▼
                              D7 (GENERATIVE-UI.md)
```

D1, D3, D4, D6 can be done in parallel (no interdependencies).
D2 depends on D1.
D5 depends on D3 + D4.
D7 depends on D5.

## Trade-offs

| Decision                     | Chose                                                  | Over                                | Rationale                                                                         |
| ---------------------------- | ------------------------------------------------------ | ----------------------------------- | --------------------------------------------------------------------------------- |
| Button fix location          | UITreeRenderer onClick injection                       | StatefulButtonWrapper               | Button needs no internal state; renderer-level fix is simpler and covers Link too |
| Action result type           | Discriminated union (`patch\|message\|external\|none`) | Free-form callback                  | Exhaustive type checking; host knows all possible effect shapes                   |
| `.well-known` file extension | `.umd.js`                                              | `.umd.cjs` (as in GENERATIVE-UI.md) | Vite outputs `.js` for UMD; `.cjs` would require post-build rename for no benefit |
| Registry hosting             | Serve from `node_modules/@cloudflare/kumo`             | Copy into dist/                     | Single source of truth; always matches installed version                          |
| schemas export fix           | Add as vite entry point                                | Separate build step                 | Clean, one change, stable output path                                             |

## Risks

| Risk                                                               | Impact                       | Mitigation                                                                                            |
| ------------------------------------------------------------------ | ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| Kumo Button's onClick signature differs from expected `() => void` | Action handler doesn't fire  | Verify Kumo Button's onClick accepts standard React MouseEventHandler; wrap if needed                 |
| Adding `ai/schemas` entry point changes chunk hashing for catalog  | Catalog's lazy import breaks | Test catalog schema loading after build; Rollup should deduplicate                                    |
| pnpm workspace change affects other `_examples/` projects          | Build breakage               | Only add kumo-stream to workspace; verify other examples unaffected                                   |
| LLM ignores system prompt a11y rules                               | Continued a11y warnings      | Rules are best-effort; ErrorBoundary already prevents crashes. Consider Zod validation layer (future) |

## Open Questions

- [ ] Does `pnpm-workspace.yaml` already include `_examples/*`? If not, should we include all examples or just kumo-stream? → Check during D4
- [ ] Should `generative-ui.json` discovery endpoint include schema/validation info (e.g., Zod schema endpoint)? → Park for future spec
- [ ] Should the generic action system support async handlers (e.g., API calls that return data to inject into the tree)? → Start sync-only, extend later
