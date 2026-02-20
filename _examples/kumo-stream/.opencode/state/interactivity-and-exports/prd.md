# PRD: kumo-stream Interactivity, Exports, and .well-known Convention

**Date:** 2026-02-19

---

## Problem Statement

### What problem are we solving?

kumo-stream is the stress-test for cross-boundary generative UI. Three critical gaps prevent it from being a world-class reference implementation:

1. **Buttons don't work.** `UITreeRenderer` injects `onAction` as a prop but Kumo's `Button` only has `onClick`. The stateful wrapper pattern (used by Select, Checkbox, Switch, Tabs, Collapsible) was never applied to Button. Buttons silently do nothing on click. This is the core interactivity failure.

2. **Generic action system missing.** `action-patch-bridge.ts` hardcodes counter actions only. Any other LLM-generated interactive UI (form submit, navigation, data fetch) has no path to the host. The bridge should be a generic dispatch — host decides what to do.

3. **Package export issues.** `@cloudflare/kumo` exports `./ai/schemas` pointing at raw `.ts` (fails without TS-capable bundler). kumo-stream uses `link:../../packages/kumo` which breaks with bun and doesn't reflect the npm consumer experience.

4. **`.well-known/` convention not implemented.** `GENERATIVE-UI.md` proposes it but kumo-stream serves loadable from `/dist/loadable/` instead.

5. **Package manager mismatch.** `bun.lock` present but `link:` protocol breaks with bun. Monorepo standardizes on pnpm.

### Why now?

The entire value proposition of kumo-stream — "generate useful UIs that users can interact with" — is broken. Buttons render but do nothing. This undermines every demo and the path toward shipping generative UI in kumo proper.

### Who is affected?

- **Primary users:** Developers building generative UI applications with `@cloudflare/kumo`
- **Secondary users:** Internal teams demoing cross-boundary generative UI capabilities

---

## Proposed Solution

### Overview

Fix the interactivity pipeline end-to-end: bridge Button/Link `onClick` to the action system in the renderer, replace the hardcoded counter bridge with a generic action dispatch registry, fix the `@cloudflare/kumo` schemas export to point at compiled JS, switch kumo-stream to pnpm with workspace resolution, implement the `.well-known/` convention for component discovery, add a11y rules to the system prompt, and update `GENERATIVE-UI.md` documentation.

### User Experience

#### User Flow: Interactive Button in React SPA

1. LLM generates UI with a Button containing an `action` field (e.g., `{ name: "increment", params: { target: "count-display" } }`)
2. `UITreeRenderer` detects the action field and injects an `onClick` handler (instead of `onAction`)
3. User clicks the button
4. `onClick` fires, dispatching an `ActionEvent` to the host's action handler
5. Host looks up the action in its handler registry and applies the result (patch, message, external call, or no-op)

#### User Flow: Cross-boundary interactive Button

1. Same as above but rendered via UMD bundle in `cross-boundary.html`
2. Action dispatches as a `kumo-action` CustomEvent on `window`
3. Host JS listener handles the event using the same registry pattern

#### User Flow: Importing schemas without TS loader

1. Developer installs `@cloudflare/kumo` from npm
2. `import { ButtonSchema } from "@cloudflare/kumo/ai/schemas"` works with plain Node.js/bundler — no TypeScript loader needed
3. Types resolve correctly for IDE support

---

## End State

When this PRD is complete, the following will be true:

- [ ] Counter increment/decrement buttons work in both React SPA and cross-boundary HTML
- [ ] Generic action dispatch system handles arbitrary actions (form submit, navigation, etc.)
- [ ] `@cloudflare/kumo/ai/schemas` imports compiled JS, not raw TS
- [ ] kumo-stream uses pnpm with `workspace:*` resolution
- [ ] `.well-known/` endpoints serve component loadable, registry, stylesheet, and discovery metadata
- [ ] System prompt includes a11y rules and DOM nesting anti-patterns
- [ ] `GENERATIVE-UI.md` documents streaming, actions, and `.well-known` convention
- [ ] LLM-generated UI elements are validated against Kumo Zod schemas before rendering
- [ ] All 177 existing tests continue passing; new tests cover all changes

---

## Success Metrics

### Quantitative

| Metric                       | Current                 | Target                            | Measurement Method                                       |
| ---------------------------- | ----------------------- | --------------------------------- | -------------------------------------------------------- |
| Button action success rate   | 0% (silently fails)     | 100%                              | Manual test: click counter buttons, verify count changes |
| Schemas import compatibility | Requires TS loader      | Works with plain Node.js          | `node -e "import('@cloudflare/kumo/ai/schemas')"`        |
| Action types handled         | 2 (increment/decrement) | Extensible registry (4+ built-in) | Count entries in `BUILTIN_HANDLERS`                      |
| `.well-known` endpoints      | 0                       | 4                                 | HTTP GET each endpoint, verify 200                       |

### Qualitative

- Demos reliably show interactive generative UI without silent failures
- External consumers can import schemas without special bundler config
- `.well-known` convention establishes a discoverable standard for component libraries

---

## Acceptance Criteria

### Feature: Button Action Dispatch (D1)

- [ ] Counter increment/decrement buttons update the count in React SPA
- [ ] Counter increment/decrement buttons update the count in HTML/UMD cross-boundary
- [ ] Other Button actions (non-counter) dispatch ActionEvents to host
- [ ] Link elements with actions dispatch on click
- [ ] Existing onClick props from LLM output are preserved (not overwritten)
- [ ] Tests: new test cases for Button/Link action injection in UITreeRenderer

### Feature: Generic Action Dispatch System (D2)

- [ ] Counter actions still work (regression test)
- [ ] Form-submit actions send form data as a chat message
- [ ] Unknown actions are logged but don't crash
- [ ] ActionResult discriminated union is exhaustively typed
- [ ] System prompt includes form-submit and generic action examples
- [ ] Tests: action registry handlers, form collection, message dispatch

### Feature: Fix @cloudflare/kumo Schemas Export (D3)

- [ ] `import { ButtonSchema } from "@cloudflare/kumo/ai/schemas"` works with Node.js (no TS loader)
- [ ] `import type { ... } from "@cloudflare/kumo/ai/schemas"` still resolves types
- [ ] `dist/ai/schemas.js` is a stable (non-hashed) output file
- [ ] Catalog's lazy schema loading still works
- [ ] Build passes, existing tests pass

### Feature: Switch kumo-stream to pnpm (D4)

- [ ] `bun.lock` removed
- [ ] `pnpm install` from root resolves `@cloudflare/kumo` correctly
- [ ] `pnpm dev`, `pnpm build`, `pnpm test` all work from `_examples/kumo-stream/`
- [ ] `pnpm build:loadable` produces `dist/loadable/` correctly
- [ ] No `bun` references remain in package.json scripts

### Feature: Implement .well-known Convention (D5)

- [ ] `GET /.well-known/component-loadable.umd.js` returns the UMD bundle
- [ ] `GET /.well-known/component-registry.json` returns the component registry
- [ ] `GET /.well-known/stylesheet.css` returns the compiled CSS
- [ ] `GET /.well-known/generative-ui.json` returns discovery metadata
- [ ] `cross-boundary.html` loads from `.well-known` paths
- [ ] `GENERATIVE-UI.md` updated with kumo-stream as reference

### Feature: System Prompt a11y and DOM Nesting Fixes (D6)

- [ ] System prompt includes a11y rules
- [ ] System prompt includes DOM nesting anti-patterns
- [ ] Counter preset example has proper labels on any form elements

### Feature: Update GENERATIVE-UI.md Documentation (D7)

- [ ] Streaming section documents JSONL + RFC 6902 pattern with code examples
- [ ] Action system section explains ActionEvent → host dispatch → effect
- [ ] `.well-known` section updated to match implementation (`.umd.js` not `.umd.cjs`)
- [ ] Registry hosting clarified

### Feature: Zod Validation of LLM UI Output (D8)

- [ ] LLM-generated UI tree elements are validated against `@cloudflare/kumo/ai/schemas` before rendering
- [ ] Validation errors are logged with element key and schema violation details
- [ ] Invalid elements degrade gracefully (render with ErrorBoundary fallback, don't block the tree)
- [ ] Valid elements pass through with no performance overhead from validation
- [ ] Tests: valid tree passes, invalid props caught, missing required props caught, rendering continues after validation failure

---

## Technical Context

### Existing Patterns

- **StatefulWrapper pattern:** `src/core/stateful-wrappers.tsx` — wraps Select, Checkbox, Switch, Tabs, Collapsible with internal state and `onAction` callback. Button was never given this treatment because it needs no internal state, just `onClick→action` bridging.
- **Action→Patch bridge:** `src/core/action-patch-bridge.ts` — maps `ActionEvent` to RFC 6902 JSON Patch ops. Currently hardcodes `increment`/`decrement` only.
- **UITree rendering:** `src/core/UITreeRenderer.tsx` — recursive renderer with per-element error boundaries, max depth 50, action handler injection via `onAction` prop.
- **Cross-boundary UMD:** `src/loadable/index.ts` + `vite.loadable.config.ts` — builds Kumo components as UMD bundle for script-tag consumption.

### Key Files

- `src/core/UITreeRenderer.tsx` — Action handler injection logic (the onClick/onAction bridging fix goes here)
- `src/core/action-patch-bridge.ts` — Current hardcoded counter bridge (to be superseded by action registry)
- `src/app/ChatDemo.tsx` — Host-side action handling (uses the bridge, needs to use registry)
- `src/core/system-prompt.ts` — LLM system prompt (a11y rules, form-submit action examples)
- `server/index.ts` — Express server (`.well-known` routes go here)
- `public/cross-boundary.html` — Standalone HTML demo (action handling, `.well-known` paths)
- `packages/kumo/vite.config.ts` — Vite entry points (add `ai/schemas`)
- `packages/kumo/package.json` — Export map (fix `./ai/schemas` path)
- `pnpm-workspace.yaml` — Workspace config (add `_examples/*`)
- `_examples/GENERATIVE-UI.md` — Parent documentation guide

### System Dependencies

- `@anthropic-ai/sdk` — Anthropic streaming SDK (used in ChatDemo and server)
- `@cloudflare/kumo` — Component library (workspace dependency)
- `zod` — Schema validation (peer dep of kumo, used by `ai/schemas`)
- Express — Server for cross-boundary demo
- Vite — Build tool for both SPA and UMD loadable

### Data Model Changes

None. All changes are in the rendering/action pipeline, build config, and documentation.

---

## Risks & Mitigations

| Risk                                                               | Likelihood | Impact | Mitigation                                                                                      |
| ------------------------------------------------------------------ | ---------- | ------ | ----------------------------------------------------------------------------------------------- |
| Kumo Button's onClick signature differs from expected `() => void` | Low        | High   | Verify Kumo Button's onClick accepts standard React MouseEventHandler; wrap if needed           |
| Adding `ai/schemas` entry point changes chunk hashing for catalog  | Med        | Med    | Test catalog schema loading after build; Rollup should deduplicate                              |
| pnpm workspace change affects other `_examples/` projects          | Med        | Med    | Only add kumo-stream to workspace; verify other examples unaffected                             |
| LLM ignores system prompt a11y rules                               | High       | Low    | Rules are best-effort; Zod validation catches structural issues; ErrorBoundary prevents crashes |

---

## Alternatives Considered

### Alternative 1: StatefulButtonWrapper

- **Description:** Create a `StatefulButtonWrapper` like the existing Select/Checkbox wrappers
- **Pros:** Consistent with existing wrapper pattern
- **Cons:** Button needs no internal state management; adds unnecessary complexity
- **Decision:** Rejected. onClick→action bridging in the renderer is simpler and covers Link too.

### Alternative 2: Free-form action callback (no registry)

- **Description:** Pass raw `ActionEvent` to host with no structure on the result
- **Pros:** Maximum flexibility
- **Cons:** No exhaustive type checking; host can't know all possible effect shapes; harder to test
- **Decision:** Rejected. Discriminated union (`patch|message|external|none`) provides type safety and extensibility.

### Alternative 3: Copy registry into dist/ for .well-known

- **Description:** Copy `component-registry.json` into the dist folder during build
- **Pros:** No runtime dependency on `node_modules` path resolution
- **Cons:** Two copies that can drift; doesn't always match installed version
- **Decision:** Rejected. Serve directly from `node_modules/@cloudflare/kumo` — single source of truth.

### Alternative 4: Separate build step for schemas

- **Description:** Add a separate tsc or build step to compile `ai/schemas.ts`
- **Pros:** Doesn't touch the main vite config
- **Cons:** Extra build step to maintain; inconsistent with how other exports are built
- **Decision:** Rejected. Adding as a vite entry point is a single clean change with a stable output path.

---

## Non-Goals (v1)

Explicitly out of scope for this PRD:

- **OAuth/social login** — unrelated to generative UI interactivity
- **Async action handlers** (e.g., API calls returning data to inject into tree) — start sync-only, extend later
- **Zod validation for every possible LLM output shape** — validate core structure and known component schemas; don't block rendering on validation failures
- **`.well-known` convention in kumo main package** — implement in kumo-stream only; formalize in kumo later
- **Schema endpoint in `generative-ui.json` discovery** — park for future spec

---

## Interface Specifications

### API: .well-known Endpoints

```
GET /.well-known/component-loadable.umd.js
Response: UMD JavaScript bundle (application/javascript)

GET /.well-known/component-registry.json
Response: Component registry JSON (application/json)

GET /.well-known/stylesheet.css
Response: Compiled CSS (text/css)

GET /.well-known/generative-ui.json
Response: {
  "version": "0.1.0",
  "loadable": "/.well-known/component-loadable.umd.js",
  "registry": "/.well-known/component-registry.json",
  "stylesheet": "/.well-known/stylesheet.css",
  "streaming": {
    "format": "jsonl",
    "patchFormat": "rfc6902",
    "endpoint": "/api/chat"
  }
}
```

### TypeScript: Action Registry

```typescript
type ActionHandlerMap = Record<
  string,
  (event: ActionEvent, tree: UITree) => ActionResult
>;

type ActionResult =
  | { type: "patch"; patches: readonly JsonPatchOp[] }
  | { type: "message"; content: string }
  | { type: "external"; url: string; method: string; body?: unknown }
  | { type: "none" };
```

---

## Documentation Requirements

- [ ] Update `_examples/GENERATIVE-UI.md` with streaming, actions, and `.well-known` documentation
- [ ] System prompt updated with a11y rules and form-submit examples

---

## Open Questions

| Question                                                    | Owner | Due Date  | Status                             |
| ----------------------------------------------------------- | ----- | --------- | ---------------------------------- |
| Does `pnpm-workspace.yaml` already include `_examples/*`?   | Agent | During D4 | Open (currently only `packages/*`) |
| Should `generative-ui.json` include schema/validation info? | —     | Future    | Deferred                           |
| Should generic action system support async handlers?        | —     | Future    | Deferred (start sync-only)         |

---

## Appendix

### Dependency Graph

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

### Trade-offs

| Decision                     | Chose                                                  | Over                                | Rationale                                                                         |
| ---------------------------- | ------------------------------------------------------ | ----------------------------------- | --------------------------------------------------------------------------------- |
| Button fix location          | UITreeRenderer onClick injection                       | StatefulButtonWrapper               | Button needs no internal state; renderer-level fix is simpler and covers Link too |
| Action result type           | Discriminated union (`patch\|message\|external\|none`) | Free-form callback                  | Exhaustive type checking; host knows all possible effect shapes                   |
| `.well-known` file extension | `.umd.js`                                              | `.umd.cjs` (as in GENERATIVE-UI.md) | Vite outputs `.js` for UMD; `.cjs` would require post-build rename for no benefit |
| Registry hosting             | Serve from `node_modules/@cloudflare/kumo`             | Copy into dist/                     | Single source of truth; always matches installed version                          |
| Schemas export fix           | Add as vite entry point                                | Separate build step                 | Clean, one change, stable output path                                             |

### References

- `_examples/kumo-stream/specs/interactivity-and-exports.md` — Original spec
- `_examples/GENERATIVE-UI.md` — Parent documentation guide
- `packages/kumo/ai/component-registry.json` — Component registry (auto-generated)
