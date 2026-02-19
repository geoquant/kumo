# kumo-stream -- Streaming Generative UI Framework

**Status:** Ready for task breakdown
**Type:** Feature Plan (Self-Contained Prototype)
**Effort:** XL (~3-5 days)
**Date:** 2026-02-19

---

## Problem Statement

**Who:** Developers building AI-powered interfaces that render Cloudflare Kumo components
**What:** No working end-to-end implementation exists that takes an LLM prompt, streams a response, and progressively renders Kumo components from the streamed JSON
**Why it matters:** The GENERATIVE-UI.md vision -- branded, interactive UI rendered inline within AI chat responses -- has three incomplete prototypes (`kumo-provider`, `a2ui-bridge`, `json-render`) but no single implementation that covers the full pipeline: prompt -> LLM -> streaming patches -> progressive React rendering -> cross-boundary UMD bundle
**Evidence:** Each prototype solves part of the problem. `kumo-provider` handles cross-boundary + streaming but has a 994-line monolith renderer. `a2ui-bridge` has clean architecture but no streaming or cross-boundary. `json-render` has JSONL streaming but no cross-boundary. None integrate with the existing catalog module's `UITree`/`UIElement` types.

---

## Proposed Solution

Build `_examples/kumo-stream/`, a self-contained Bun + Vite + React prototype that implements the full streaming generative UI pipeline using `@cloudflare/kumo` as a dependency. The prototype serves as both a testbed for the concepts in PLAN.md and a reference implementation that can later be extracted into `packages/kumo/src/catalog/react/`.

The architecture has three layers:

1. **Core renderer** -- `UITreePatch` types, `applyTreePatch()` with structural sharing, component map with registration pattern, `KumoCatalogRenderer`, `useUITree` hook, per-element `ErrorBoundary`. Supports Tiers 1-3 (32 components).

2. **Streaming server** -- Vite API plugin (a2ui-bridge pattern) that proxies Anthropic API calls. LLM generates complete UITrees; server runs `diffUITree()` to produce JSONL patches sent via SSE. No separate backend process needed.

3. **Cross-boundary UMD bundle** -- Separate Vite build that bundles React + Kumo + renderer into a single `component-loadable.umd.cjs` with `window.CloudflareKumo` mount API, ThemeWrapper for cross-boundary mode switching, and `renderFromStream()` for JSONL consumption.

The demo app is a chat interface where users type natural language, the LLM generates Kumo component trees, and components stream in progressively with entrance animations.

---

## Scope & Deliverables

| #   | Deliverable                           | Effort | Depends On | Description                                                                                                    |
| --- | ------------------------------------- | ------ | ---------- | -------------------------------------------------------------------------------------------------------------- |
| D1  | Project scaffold                      | S      | -          | Bun + Vite + React + TypeScript project in `_examples/kumo-stream/` with `@cloudflare/kumo` linked             |
| D2  | Patch types + `applyTreePatch`        | M      | D1         | `UITreePatch` union type, `applyTreePatch()` with structural sharing, `applyDataPatch()`, batch semantics      |
| D3  | `diffUITree`                          | S      | D2         | Produce minimal patch set from two UITrees. Round-trip property: `apply(diff(a,b), a) === b`                   |
| D4  | Component map (Tiers 1-2)             | M      | D1         | Registration pattern, `createComponentMap()`, `createPassthroughResolver()`, 26 component resolvers            |
| D5  | Component map (Tier 3)                | L      | D4         | Stateful wrappers for Select, Dialog, Table, Popover, Dropdown, Toast (6 compound components)                  |
| D6  | `KumoCatalogRenderer`                 | M      | D2, D4     | Core renderer: visibility, data binding, action dispatch, error boundaries, children precedence                |
| D7  | `useUITree` hook                      | S      | D2         | `useReducer`-based hook for patch application, data updates, reset                                             |
| D8  | Vite API plugin + Anthropic streaming | L      | D3         | SSE endpoint, system prompt from registry, complete UITree generation, server-side diff to JSONL patches       |
| D9  | Chat demo UI                          | M      | D6, D7, D8 | Chat interface with message list, streaming rendering, split view (UI + JSON), preset scenarios                |
| D10 | UMD build                             | L      | D6         | Vite UMD config bundling React + Kumo + renderer, `window.CloudflareKumo` API, ThemeWrapper                    |
| D11 | Cross-boundary test page              | S      | D10        | Static HTML page loading UMD + CSS via `<script>`/`<link>`, exercising `renderFromJSON` and `renderFromStream` |
| D12 | Tests                                 | M      | D2-D7      | Unit tests for patches, diff, component map, renderer, hooks                                                   |

---

## Non-Goals (Explicit Exclusions)

- **No Tier 4 components** (Combobox, CommandPalette, DatePicker, DateRangePicker, MenuBar) -- render props and deep sub-component trees defer until demand
- **No changes to `packages/kumo/`** -- this is a self-contained prototype in `_examples/`. Catalog bug fixes (initCatalog, resolveProps) happen when porting to `packages/kumo/`
- **No A2UI adapter** -- A2UI is a different wire format; translation layer deferred
- **No MCP UI surface protocol** -- iframe-based rendering is out of scope
- **No Workers AI backend** -- Anthropic API only. Workers AI integration is a future milestone
- **No production deployment** -- this is a development prototype, not a deployed service
- **No changesets** -- `_examples/` is not a published package

---

## Architecture

### Directory Structure

```
_examples/kumo-stream/
  src/
    core/                       # Portable renderer (extractable to packages/kumo later)
      patches.ts                # UITreePatch types + applyTreePatch + applyDataPatch
      diff.ts                   # diffUITree(prev, next) -> UITreePatch[]
      component-map.ts          # Registration pattern, createComponentMap, mergeComponentMaps
      compound-wrappers.tsx     # Stateful wrappers for Tier 3 components
      renderer.tsx              # KumoCatalogRenderer
      hooks.ts                  # useUITree
      error-boundary.tsx        # Per-element CatalogErrorBoundary
      types.ts                  # Renderer-specific types
      index.ts                  # Barrel export
    server/                     # Vite API plugin (dev-only backend)
      vite-api-plugin.ts        # /api/chat SSE endpoint
      system-prompt.ts          # Build prompt from component-registry.json
      stream-producer.ts        # LLM response -> diffUITree -> JSONL patches
    app/                        # Demo chat application
      App.tsx                   # Root component
      Chat.tsx                  # Chat interface
      StreamViewer.tsx          # Split view: rendered UI + JSON inspector
      PresetScenarios.ts        # Pre-recorded patch sequences for demo
    loadable/                   # Cross-boundary UMD entry
      index.ts                  # Entry: window.CloudflareKumo API
      mount.tsx                 # render, renderFromJSON, renderFromStream
      theme-wrapper.tsx         # Cross-boundary mode switching
      stream-reader.ts          # JSONL line reader
    __tests__/
      patches.test.ts
      diff.test.ts
      component-map.test.ts
      renderer.test.ts
      hooks.test.ts
  public/
    test-crossboundary.html     # Static HTML page for UMD testing
  index.html                    # SPA entry point
  vite.config.ts                # Dev server + library builds
  vite.loadable.config.ts       # UMD build config
  package.json
  tsconfig.json
  .env.example                  # ANTHROPIC_API_KEY
```

### Data Model

#### UITree & UIElement (from `@cloudflare/kumo/catalog`)

```ts
// Already defined in packages/kumo/src/catalog/types.ts
interface UITree {
  root: string;
  elements: Record<string, UIElement>;
}

interface UIElement {
  key: string;
  type: string; // "Button", "Surface", "Text", etc.
  props: Record<string, unknown>;
  children?: string[]; // Child element keys (flat)
  parentKey?: string | null;
  visible?: VisibilityCondition;
  action?: Action;
}
```

#### UITreePatch (new)

```ts
type UITreePatch =
  | { type: "upsertElements"; elements: Record<string, UIElement> }
  | { type: "deleteElements"; keys: string[] }
  | { type: "appendChildren"; parentKey: string; childKeys: string[] }
  | { type: "removeChildren"; parentKey: string; childKeys: string[] }
  | { type: "setRoot"; root: string }
  | { type: "setData"; path: string; value: unknown }
  | { type: "replaceData"; data: DataModel }
  | { type: "replaceTree"; tree: UITree }
  | { type: "batch"; patches: UITreePatch[] };
```

#### ComponentResolver

```ts
type ComponentResolver = (
  element: UIElement,
  resolvedProps: Record<string, unknown>,
  children: ReactNode,
) => ReactElement | null;
```

### API/Interface Contract

#### Core Renderer Exports

```ts
// Renderer
export function KumoCatalogRenderer(props: {
  tree: UITree;
  data?: DataModel;
  auth?: AuthState;
  actions?: ActionHandlers;
  onAction?: (action: Action, params: Record<string, unknown>) => Promise<void>;
  components: Record<string, ComponentResolver>; // REQUIRED
  fallback?: ComponentType<{ element: UIElement }>;
}): ReactElement;

// Patches
export function applyTreePatch(prev: UITree, patch: UITreePatch): UITree;
export function applyDataPatch(prev: DataModel, patch: UITreePatch): DataModel;
export function diffUITree(prev: UITree, next: UITree): UITreePatch[];

// Component Map
export function createPassthroughResolver(
  Component: ComponentType<any>,
): ComponentResolver;
export function createComponentMap(
  components: Record<string, ComponentType<any>>,
): Record<string, ComponentResolver>;
export function mergeComponentMaps(
  ...maps: Record<string, ComponentResolver>[]
): Record<string, ComponentResolver>;

// Hooks
export function useUITree(
  initialTree?: UITree,
  initialData?: DataModel,
): {
  tree: UITree;
  data: DataModel;
  applyPatch: (patch: UITreePatch) => void;
  setData: (path: string, value: unknown) => void;
  reset: () => void;
};
```

#### SSE Wire Format (JSONL)

Each SSE `data:` line is a complete `UITreePatch` JSON object:

```
data: {"type":"upsertElements","elements":{"btn-1":{"key":"btn-1","type":"Button","props":{"children":"Click me"}}}}

data: {"type":"appendChildren","parentKey":"root","childKeys":["btn-1"]}

data: {"type":"setData","path":"/user/name","value":"Alice"}
```

Mixed content (text + patches) uses a heuristic: lines starting with `{` are tested as JSON patches; everything else is chat text.

#### `window.CloudflareKumo` (UMD)

```ts
interface CloudflareKumoAPI {
  render(
    name: string,
    props: Record<string, unknown>,
    containerId: string,
  ): void;
  renderFromJSON(tree: UITree, containerId: string): void;
  renderFromStream(
    url: string,
    containerId: string,
    options?: {
      onError?: (error: Error) => void;
      onComplete?: () => void;
    },
  ): void;
  setTheme(mode: "light" | "dark"): void;
  destroy(containerId: string): void;
}
```

### Streaming Pipeline

```
User prompt
    |
    v
POST /api/chat { message, registryUrl? }
    |
    v
Vite API Plugin
    |-- Builds system prompt from component-registry.json
    |-- Calls Anthropic Messages API (streaming)
    |-- Accumulates text chunks into complete UITree JSON
    |-- On each complete UITree: diffUITree(prev, next)
    |-- Sends JSONL patches as SSE events
    v
SSE Response (text/event-stream)
    |
    v
Client: useCatalogStream(url)
    |-- EventSource reads SSE lines
    |-- Each line parsed as UITreePatch
    |-- applyPatch() via useUITree
    v
KumoCatalogRenderer
    |-- Walks UITree from root
    |-- evaluateVisibility -> skip invisible
    |-- resolveProps -> resolve {path:"/..."} refs
    |-- ComponentResolver lookup -> React element
    |-- ErrorBoundary per element
    v
Rendered Kumo Components
```

---

## Component Tier Strategy

### Tier 1: Pass-through (16 components)

Badge, Banner, Button, Text, Link, Loader, Empty, Surface, Label, CloudflareLogo, SkeletonLine, ClipboardText, Code, Switch, Tooltip, Meter.

All use `createPassthroughResolver(Component)` -- props + children pass directly.

### Tier 2: Data-driven / shallow compound (10 components)

| Component              | Resolver Strategy                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------- |
| Tabs                   | Pass `tabs` array prop directly (NOT compound)                                        |
| Pagination             | Stateful wrapper managing `page` state internally                                     |
| Input / SensitiveInput | Pass-through with optional Field wrapper                                              |
| Grid                   | Pass-through                                                                          |
| Checkbox               | `items` array -> `Checkbox.Group` + `Checkbox.Item` children                          |
| Radio                  | `items` array -> `Radio.Group` + `Radio.Item` children                                |
| Breadcrumbs            | `links` array -> `Breadcrumbs.Link` + `Breadcrumbs.Separator` + `Breadcrumbs.Current` |
| Collapsible            | Pass-through with default `onOpenChange` no-op                                        |
| LayerCard              | Map `primary`/`secondary` slot props to sub-components                                |

### Tier 3: Complex compound with managed state (6 components)

| Component | Resolver Strategy                                                                 |
| --------- | --------------------------------------------------------------------------------- |
| Select    | `options` array -> `Select.Option` children; manages `value` state                |
| Dialog    | Maps `title`/`description`/`actions` to sub-components; manages `open` state      |
| Table     | `headers` + `rows` arrays -> `Table.Header`/`Table.Body`/`Table.Row`/`Table.Cell` |
| Popover   | Maps `trigger`/`content` with managed `open` state                                |
| Dropdown  | Maps `items` to menu items with separators; manages `open` state                  |
| Toast     | Integration with Toast provider context                                           |

---

## Key Technical Decisions

| Decision            | Choice                                              | Over                              | Because                                                                                            |
| ------------------- | --------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------- |
| Wire format         | JSONL (one complete JSON per line)                  | Incremental JSON parsing          | Dramatically simpler; no 676-line parser. Each line is independently parseable.                    |
| LLM output          | Complete UITrees                                    | Direct patches                    | LLMs are bad at generating diff operations. Complete trees are natural; server diffs into patches. |
| Component map       | Context-based registration (not global)             | Module-level singleton            | SSR-safe, multiple renderers per page, explicit dependencies.                                      |
| State management    | `useReducer` in `useUITree`                         | External state library            | Predictable transitions, no external deps, matches patch semantics.                                |
| Dev server          | Vite API plugin (a2ui-bridge pattern)               | Separate Express server           | Single `bun dev` command, URL paths match any future deployment.                                   |
| UMD build           | Separate Vite config (`vite.loadable.config.ts`)    | Same config with multiple outputs | UMD bundles React (not external); library mode externalizes it. Clean separation.                  |
| Streaming UX        | `flushSync` + `data-catalog-new` attribute          | MutationObserver animations       | `flushSync` forces immediate rendering; CSS attribute is lighter than JS animations.               |
| Children precedence | `element.children` array wins over `props.children` | Concatenation                     | Clear, unambiguous rule. Document it. Enforce in renderer.                                         |
| Action handlers     | `onAction` returns `Promise<void>`                  | Fire-and-forget void              | Enables `onSuccess`/`onError` data model updates after async completion.                           |

---

## Acceptance Criteria

### Core Renderer

- [ ] `applyTreePatch` with `upsertElements` preserves identity of unchanged elements (`prev.elements["key"] === next.elements["key"]`)
- [ ] `applyTreePatch` with `deleteElements` recursively removes children
- [ ] `applyTreePatch` with `deleteElements` for root key throws
- [ ] `applyTreePatch` with `batch` rolls back to pre-batch tree if any sub-patch throws
- [ ] `diffUITree(tree, tree)` returns empty array
- [ ] Applying `diffUITree(a, b)` patches to `a` produces tree equivalent to `b`
- [ ] `KumoCatalogRenderer` renders a UITree with registered components
- [ ] Elements with `visible: false` are not rendered
- [ ] Dynamic props (`{path: "/..."}`) are resolved from data model
- [ ] `element.children` array takes precedence over `props.children`
- [ ] A component that throws renders error boundary; siblings unaffected
- [ ] `useUITree().applyPatch()` triggers re-render with updated tree
- [ ] Each Tier 1 resolver produces correct React element with correct props
- [ ] Tier 2 compound resolvers (Checkbox items, Radio items, Breadcrumbs links) produce correct sub-component trees
- [ ] Tier 3 stateful wrappers (Select, Dialog) manage internal state from JSON props

### Streaming

- [ ] `/api/chat` POST returns SSE stream with JSONL patches
- [ ] System prompt includes component registry information
- [ ] Components appear progressively as patches arrive (not all at once)
- [ ] New elements have `data-catalog-new` attribute for one frame (entrance animation hook)

### Cross-Boundary

- [ ] `bun run build:loadable` produces `component-loadable.umd.cjs` + `stylesheet.css`
- [ ] `test-crossboundary.html` loads UMD + CSS via `<script>`/`<link>` tags
- [ ] `window.CloudflareKumo.renderFromJSON()` renders components on a plain HTML page
- [ ] `window.CloudflareKumo.setTheme('dark')` switches mode across rendered components
- [ ] UMD bundle size < 600KB gzipped (React + Kumo + renderer)

### Demo App

- [ ] `bun dev` starts the app with both frontend and API proxy
- [ ] Chat UI sends messages and displays streaming Kumo component responses
- [ ] Split view shows rendered UI alongside raw JSON tree
- [ ] Preset scenarios play pre-recorded patch sequences without API key

---

## Test Strategy

| Layer       | What                                                                        | How                                       |
| ----------- | --------------------------------------------------------------------------- | ----------------------------------------- |
| Unit        | `applyTreePatch` (all 9 patch types, structural sharing, edge cases)        | Vitest, pure functions                    |
| Unit        | `diffUITree` (round-trip property, empty diff, add/remove/change)           | Vitest, pure functions                    |
| Unit        | Component resolvers (Tier 1 pass-through, Tier 2 compound, Tier 3 stateful) | Vitest + happy-dom, render verification   |
| Unit        | `KumoCatalogRenderer` (visibility, data binding, actions, error boundary)   | Vitest + happy-dom, mock components       |
| Unit        | `useUITree` (patch application, data updates, reset)                        | Vitest + renderHook                       |
| Integration | Chat demo with mock API                                                     | Vitest, verify end-to-end patch flow      |
| Manual      | UMD cross-boundary test                                                     | Open `test-crossboundary.html` in browser |
| Manual      | Live Anthropic streaming                                                    | Set API key, send chat messages           |

---

## Risks & Mitigations

| Risk                                                | Likelihood | Impact | Mitigation                                                                                                                |
| --------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| Anthropic API token format issues                   | Medium     | Medium | Complete UITree generation (not patches) reduces LLM format sensitivity; robust JSON extraction with code fence stripping |
| UMD bundle size exceeds 600KB                       | Medium     | Low    | Tree-shake unused components from kitchen-sink build; measure early                                                       |
| `@cloudflare/kumo` build dependency                 | High       | Medium | Must build `packages/kumo` first. Document in README. Add `predev` script.                                                |
| Compound component APIs change                      | Low        | Medium | Prototype is in `_examples/`; not coupled to releases. Update when porting.                                               |
| JSONL parsing edge cases (nested braces in strings) | Low        | Medium | Parse full lines as JSON; reject unparseable lines gracefully                                                             |

---

## Trade-offs Made

| Chose                                             | Over                                      | Because                                                                                                                |
| ------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Self-contained prototype in `_examples/`          | Direct implementation in `packages/kumo/` | Faster iteration, no changeset/CI overhead, can break things freely. Port proven patterns later.                       |
| Import `@cloudflare/kumo` as real dep             | Mock components                           | Real component behavior, real styling, validates against actual API surface. Worth the build dependency.               |
| JSONL over incremental JSON                       | Incremental JSON parsing (kumo-provider)  | 676 lines of parser replaced by `line.split('\n').map(JSON.parse)`. Dramatically simpler.                              |
| Vite API plugin over Express                      | Separate Express server (kumo-provider)   | Single process, single command, URL paths portable to production deployment.                                           |
| Anthropic over Workers AI                         | Cloudflare Workers AI                     | Anthropic Claude produces higher quality structured output. Workers AI is a deployment concern, not a prototyping one. |
| Context-based component map over global singleton | Module-level `registerComponents()`       | SSR-safe, testable, explicit. Global state is the #1 cause of subtle bugs in renderers.                                |

---

## Implementation Order

```
D1 (scaffold) ─────┬──> D2 (patches) ──> D3 (diff)
                    │                         │
                    ├──> D4 (map T1-2) ──> D5 (map T3)
                    │         │                │
                    │         └────────┬───────┘
                    │                  v
                    │            D6 (renderer) ──> D7 (hooks)
                    │                  │              │
                    │                  └──────┬───────┘
                    │                         v
                    ├──> D8 (API plugin) ──> D9 (chat demo)
                    │
                    └──> D10 (UMD build) ──> D11 (test page)

D12 (tests) runs throughout, alongside each deliverable.
```

Parallelizable: D2+D4 can start simultaneously. D8 can start as soon as D1 is done (only needs D3 for full integration). D10 can start after D6.

---

## Open Questions

- [ ] Should `resolveProps` bugs (array resolution, reference equality) be fixed in `_examples/kumo-stream/` with a local patched copy, or should we fix them in `packages/kumo/` first? -> Owner: User
- [ ] What Anthropic model to use? `claude-sonnet-4-20250514` for speed/cost or `claude-opus-4-20250414` for quality? -> Owner: User
- [ ] Should the UMD bundle include ALL 32 Tier 1-3 components or allow configuration? -> Owner: User (recommendation: include all for prototype simplicity)

---

## Resolved Questions

1. **resolveProps fix:** Fix in `packages/kumo/src/catalog/data.ts` first (array resolution + reference equality), rebuild, consume fixed version. This is a prerequisite (D0).
2. **Claude model:** Configurable via `ANTHROPIC_MODEL` env var, default `claude-sonnet-4-20250514`.
3. **UMD scope:** All 32 Tier 1-3 components. Kitchen-sink build. Optimize later if needed.

---

Phase: DONE | Status: Approved, ready for implementation
