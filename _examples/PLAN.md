# PLAN: Kumo as First-Class AI UI Renderer

**Status**: Draft (Revised with Strategic Analysis)
**Author**: AI-assisted
**Date**: 2026-02-19

---

## Table of Contents

1. [Motivation](#motivation)
2. [Strategic Analysis: Three Approaches vs. GENERATIVE-UI.md Requirements](#strategic-analysis-three-approaches-vs-generative-uimd-requirements)
3. [What Already Exists](#what-already-exists)
4. [What's Missing](#whats-missing)
5. [Original Plan](#original-plan)
6. [Plan Review: Identified Flaws](#plan-review-identified-flaws)
7. [Revised Plan](#revised-plan)
8. [Implementation Details](#implementation-details)
9. [Validation Checklist](#validation-checklist)
10. [Agent Self-Verification Protocol](#agent-self-verification-protocol)
11. [Agent Execution Spec](#agent-execution-spec)

---

## Motivation

The internet is shifting from page-based navigation to conversational interfaces. Users
increasingly expect to type a question and get an answer — not click through five pages of
filters and sort controls. Chat applications like ChatGPT keep users in their own surface
rather than linking out to websites.

For brands, this creates a problem: how do you maintain your visual identity and product
experience when your users interact through a third-party chat interface?

The answer is components. If a chat application understands what components a brand exposes
(their props, variants, and composition rules), it can render branded, interactive UI inline
within the chat response. The user never leaves the app, and the brand retains ownership of
how its product story is told.

Kumo already has most of the infrastructure for this:

- A component registry (`ai/component-registry.json`) describing 38 components
- Auto-generated Zod schemas (`ai/schemas.ts`) derived from TypeScript types
- A catalog module (`src/catalog/`) with data binding, visibility conditions, and validation
- A flat UITree format optimized for LLM token-by-token streaming

What's missing is the bridge: code that takes a validated UITree and renders it as actual
React elements using real Kumo components, with support for incremental streaming updates.

**End goal**: A `/streaming` route on the docs site with a working chat application that
demonstrates AI-generated Kumo UI, plus documentation explaining the full solution.

### Why Kumo Wins as a UI-Streaming Solution

Analysis of prior art (`_examples/`) reveals clear competitive advantages:

| Dimension               | `kumo-provider`        | `a2ui-bridge`             | `json-render`          | `mcp-ui`           | **Kumo (this plan)**                    |
| ----------------------- | ---------------------- | ------------------------- | ---------------------- | ------------------ | --------------------------------------- |
| Wire format             | Ad-hoc JSON            | A2UI protocol (verbose)   | JSONL (RFC 6902)       | Raw HTML strings   | **JSONL UITree patches**                |
| Token efficiency        | Medium                 | Low (literalString wraps) | High (flat map)        | N/A                | **High** (flat map, no wrappers)        |
| Component extensibility | Monolithic switch      | Adapter factory pattern   | defineCatalog/Registry | None               | **Registration + adapter pattern**      |
| Streaming support       | Progressive SSE        | Batch only                | JSONL streaming        | None               | **JSONL patch-based streaming + diff**  |
| Error isolation         | Per-component boundary | None                      | Per-element boundary   | Iframe isolation   | **Per-element ErrorBoundary**           |
| Bundle impact           | Imports all components | 77 adapters               | Opt-in components      | N/A                | **Opt-in registration, tree-shakeable** |
| Validation              | None at runtime        | None                      | Zod schemas            | Zod on tool output | **Zod schemas from component types**    |
| State management        | Manual wrappers        | useSyncExternalStore      | $bindState / contexts  | postMessage        | **useReducer + structural sharing**     |
| Dark mode               | Manual theme toggle    | CSS variables             | Host CSS               | Inline styles      | **Automatic via light-dark() tokens**   |
| Cross-boundary loading  | **YES** (UMD)          | NO                        | NO                     | Iframe             | **YES** (UMD, Phase 2)                  |

**Strategic note**: `json-render` and similar third-party JSON-to-UI libraries are
competitors. Kumo's renderer is purpose-built and must NOT depend on them. The integration
with `component-registry.json`, `resolveProps`, `evaluateVisibility`, and Kumo's semantic
token system is a moat that third-party solutions cannot replicate.

---

## Strategic Analysis: Three Approaches vs. GENERATIVE-UI.md Requirements

This section evaluates three existing implementations (`kumo-provider`, `a2ui-bridge`,
`json-render`) against the requirements in `GENERATIVE-UI.md`, and documents the strategic
decisions that shape this plan.

### The Three Approaches

**1. `kumo-provider/` (initial UMD prototype)**

A self-contained UMD bundle (`kumo-bundle.umd.cjs`) that embeds React + Kumo into a single
file loadable by any HTML page:

- `window.CloudflareKumo.render()` and `window.CloudflareKumo.renderFromJSON()` entry points
- 994-line `loader.tsx` with stateful wrappers (Dialog, Select, Combobox, CommandPalette,
  Popover, Dropdown)
- 676-line `server.js` with Anthropic streaming + incremental JSON parsing
- `ThemeWrapper` with `window.addEventListener('kumo-theme-change')` for cross-boundary mode
  switching
- `ErrorBoundary` per component
- `flushSync` for immediate progressive rendering during streaming

**2. `a2ui-bridge/` (protocol adapter layer)**

A protocol-based approach: A2UI defines ~20 abstract component types + a flat component map
\+ data model:

- `packages/react-kumo/` has ~42 adapter components mapping A2UI nodes to Kumo components
- Uses `useSyncExternalStore` for reactive updates
- Snippet-based composition system with a system prompt builder
- Three-way design system toggle (Mantine / ShadCN / Kumo) in the demo
- Each adapter extracts `literalString`/`literalNumber`/`literalBoolean` from node properties

**3. `json-render/` (catalog/registry renderer)**

A `defineCatalog()` + `defineRegistry()` pattern: catalog describes schema, registry maps to
React components:

- JSONL-based streaming (each line is a complete JSON Patch per RFC 6902, never incomplete
  JSON)
- `$bindState` / `useBoundProp` for two-way state binding
- `createSpecStreamCompiler()` for progressive streaming compilation
- `createMixedStreamParser()` for interleaved text + JSONL patch streams
- Per-element `ElementErrorBoundary`
- Integrates with Vercel AI SDK's `streamObject()`
- Validation, data-binding, custom schemas, repeat/visibility conditions

### Requirements Matrix

| Requirement                                   | `kumo-provider`                       | `a2ui-bridge` + Kumo              | `json-render`                           | **This plan**                                    |
| --------------------------------------------- | ------------------------------------- | --------------------------------- | --------------------------------------- | ------------------------------------------------ |
| Dynamic loadable UMD (`.well-known/` pattern) | **YES** — already builds UMD          | NO — assumes co-located React app | NO — ESM only, same-bundle              | **YES** — Phase 2                                |
| Cross-boundary CSS injection                  | **YES** — `style.css` beside UMD      | NO — requires Tailwind build      | NO                                      | **YES** — Phase 2                                |
| Discoverable `component-registry.json`        | **YES** — uses Kumo's registry        | Implicit via A2UI types           | `catalog.prompt()` but no `.well-known` | **YES** — leverages `ai/component-registry.json` |
| Stateful component wrappers                   | **YES** — manual wrappers             | Partial — Select has state        | **YES** — `$bindState`                  | **YES** — `compound-wrappers.tsx`                |
| Error boundaries per component                | **YES**                               | NO                                | **YES**                                 | **YES**                                          |
| Theme/mode switching across boundaries        | **YES** — ThemeWrapper + events       | NO — relies on host CSS vars      | NO                                      | **YES** — Phase 2                                |
| Streaming (incomplete JSON handling)          | **YES** — 676-line incremental parser | Batch only                        | **YES** — JSONL avoids problem          | **YES** — JSONL patches                          |
| Works on third-party sites (ChatGPT, etc.)    | **YES** — the whole point             | NO — requires React app           | NO — requires React app                 | **YES** — Phase 2                                |

### Key Findings

**`a2ui-bridge` does NOT meet `GENERATIVE-UI.md` requirements:**

1. **No cross-boundary story.** A2UI is a protocol for apps that already include the design
   system. `GENERATIVE-UI.md`'s core requirement is injecting Kumo into sites that don't
   bundle it. A2UI has no UMD output, no `.well-known` convention, no dynamic loading.
2. **Protocol overhead.** A2UI wraps every value in `{ literalString: "..." }` /
   `{ literalNumber: ... }`. This is token-wasteful for LLMs.
3. **No streaming.** A2UI processes complete messages in batches.
4. **Missing error boundaries.** If one Kumo adapter throws, the whole surface fails.

However, A2UI's adapter pattern is genuinely good for a different use case: design-system-
agnostic apps where you want to swap between Mantine/ShadCN/Kumo at runtime. It's a great
abstraction layer, just not solving the `GENERATIVE-UI` problem.

**`json-render` is the strongest renderer but has zero cross-boundary capability:**

Its catalog/registry pattern, JSONL streaming, and `$bindState` system are well-designed.
But it assumes the components live in the same bundle — the exact opposite of what
`GENERATIVE-UI.md` needs. It is also a competitor; Kumo must NOT depend on it (the format
ideas are generic and independently implementable).

**`kumo-provider` is the only approach that addresses the cross-boundary requirement:**

It's scrappy (994-line monolith, manual wrappers), but it's the only one that:

- Builds a UMD that third-party sites can load via `<script>`
- Has `window.CloudflareKumo.render()` / `renderFromJSON()` entry points
- Has `ThemeWrapper` with cross-boundary event listening
- Handles streaming via incremental JSON parsing
- Uses `flushSync` for immediate progressive rendering

### Strategic Decisions

Based on this analysis, the following decisions shape this plan:

1. **Both in-app renderer AND cross-boundary loadable are goals.** They are layered: the
   loadable wraps the renderer in a UMD bundle. The renderer is the prerequisite.

2. **JSONL streaming replaces incremental JSON parsing.** Instead of the 676-line
   incremental JSON parser in `kumo-provider/server.js`, adopt JSONL (each line is a
   complete `UITreePatch` JSON object). This is dramatically simpler and more robust.
   The `diffUITree()` function (Step 13) remains useful for server-side generation (LLM
   produces complete tree, server diffs and emits JSONL patches), but the client never
   deals with incomplete JSON objects.

3. **A2UI becomes an optional adapter layer (Phase 5).** It solves "design system
   abstraction" not "cross-boundary generative UI." A thin translation layer can convert
   A2UI `ServerToClientMessage` arrays into `UITreePatch[]`, making A2UI just another wire
   format that produces patches. The ~42 Kumo adapters in `packages/react-kumo/` become
   unnecessary once the renderer uses the component map directly.

4. **Do not depend on `json-render` or any third-party JSON-to-UI library.** The JSONL
   format and RFC 6902 JSON Patch are open standards. The patch types are Kumo-specific.
   No dependency is needed or wanted.

5. **Port `kumo-provider`'s cross-boundary infra in Phase 2** — UMD build, ThemeWrapper,
   `window.CloudflareKumo` mount API. This is the only existing code that solves
   `.well-known` + dynamic loading.

### JSONL Wire Format

Each line is a complete `UITreePatch` JSON object. Examples:

```
{"type":"upsertElements","elements":{"btn-1":{"type":"Button","props":{"children":"Click me"}}}}
{"type":"appendChildren","parentKey":"root","childKeys":["btn-1"]}
{"type":"setData","path":"/user/name","value":"Alice"}
```

The client reads line-by-line, parses each as JSON, feeds into `applyTreePatch()`. No
incomplete JSON, no 676-line parser. For mixed text + JSONL streams (chat scenarios), the
same fencing/heuristic approach used by `json-render`'s `createMixedStreamParser()` applies:
lines starting with `{` are tested as patches; everything else is text.

### Revised Phase Structure

The original plan had: Phase 1 (Renderer) → Phase 2 (Docs Demo) → Phase 3 (Workers AI) →
Phase 4 (Tiers 3-4). This revision inserts the cross-boundary loadable:

| Phase | What                    | Depends on | Notes                                       |
| ----- | ----------------------- | ---------- | ------------------------------------------- |
| 1     | Core Renderer           | —          | Unchanged from original plan (Steps 1-8)    |
| 2     | Cross-Boundary Loadable | Phase 1    | NEW: UMD build + ThemeWrapper + mount API   |
| 3     | Docs Demo / Playground  | Phase 1    | Was Phase 2; mock data first                |
| 4     | Workers AI Integration  | Phases 1,3 | Was Phase 3; `diffUITree` + API Worker      |
| 5     | Component Map Tiers 3-4 | Phase 1    | Was Phase 4; complex compound components    |
| 6     | A2UI Adapter (Optional) | Phase 1    | NEW: translates A2UI messages → UITreePatch |

Phase 1 is unchanged — it remains the foundation. Phase 2 (loadable) and Phase 3 (docs demo)
can proceed in parallel since they both depend only on Phase 1.

### What to NOT Build (additions)

- **Don't build the incremental JSON parser** — JSONL solves this.
- **Don't maintain A2UI Kumo adapters separately** — They'll be replaced by the component
  map when the renderer is complete.
- **Don't extend `ComponentSchema` with `childrenMode`/`compoundResolution`** — No consumer
  yet (aligned with original Flaw 7).

### Open Question: System Prompt for JSONL Patches

`GENERATIVE-UI.md` and all three approaches address "how does the AI know which components
to use?" differently:

- `kumo-provider/server.js` has `buildSystemPrompt()` baked into its Express route
- `a2ui-bridge` has its snippet system with `buildSystemPrompt()`
- `json-render` uses `catalog.prompt()`
- Kumo's `catalog.generatePrompt()` exists but doesn't know about the JSONL patch format

`catalog.generatePrompt()` needs to be updated to teach the LLM the JSONL patch format.
This is a small but important piece — it fits in Phase 1 alongside Step 6 (catalog fixes).

---

## What Already Exists

### Catalog Module (`packages/kumo/src/catalog/`)

| File              | Lines | What it does                                                                          |
| ----------------- | ----- | ------------------------------------------------------------------------------------- |
| `types.ts`        | 267   | Core type system: `UITree`, `UIElement`, `DynamicValue<T>`, `Action`, `AuthState`     |
| `data.ts`         | 142   | JSON Pointer `getByPath`/`setByPath`, `resolveProps()` for `{path:"/..."}` resolution |
| `visibility.ts`   | 189   | `evaluateVisibility()` with logic expressions (and/or/not/eq/gt/...)                  |
| `catalog.ts`      | 283   | `createKumoCatalog()` with async schema loading, validation, prompt generation        |
| `index.ts`        | 86    | Barrel export of all catalog types and functions                                      |
| `catalog.test.ts` | 258   | Unit tests for data resolution, visibility evaluation                                 |

### Generated AI Artifacts (`packages/kumo/ai/`)

| File                      | What it does                                                 |
| ------------------------- | ------------------------------------------------------------ |
| `schemas.ts`              | Auto-generated Zod v4 schemas for all 38 components          |
| `component-registry.json` | 38 components with props, variants, examples, sub-components |
| `component-registry.md`   | Markdown version of the registry                             |

### Package Exports (`packages/kumo/package.json`)

Already exports `./catalog` and `./ai/schemas` subpaths:

```json
"./catalog": { "types": "./dist/src/catalog/index.d.ts", "import": "./dist/catalog.js" },
"./ai/schemas": { "types": "./ai/schemas.ts", "import": "./ai/schemas.ts" }
```

### Vite Entry (`packages/kumo/vite.config.ts:198`)

```ts
catalog: resolve(__dirname, "src/catalog/index.ts"),
```

### Existing Docs Page (`packages/kumo-docs-astro/src/pages/streaming.astro`)

A 565-line **documentation-only** page covering the catalog module. No React islands, no
interactive demos. Accessible at `/streaming` but NOT listed in `SidebarNav.tsx`, so it's
undiscoverable via navigation.

### Prior Art (`_examples/`)

| Example                        | Key insight                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| `kumo-provider/src/loader.tsx` | 994-line renderer with stateful wrappers for compound components, ErrorBoundary    |
| `kumo-provider/server.js`      | 676-line Express backend with Anthropic streaming + incremental JSON parsing       |
| `a2ui-bridge/`                 | A2UI protocol adapter pattern, `createAdapter()`, `useSyncExternalStore` hooks     |
| `mcp-ui/exercises/05.advanced` | `waitForRenderData()` + signed token pattern for protected data in iframe contexts |

---

## What's Missing

1. **React Renderer** — No code turns a `UITree` + `DataModel` into React elements using Kumo components
2. **Streaming reconciliation** — No `applyTreePatch()` to incrementally update a UITree
3. **Component mapping** — No registry mapping `type: "Button"` to `<Button>` with compound component handling
4. **React hooks** — No `useUITree()` / `useCatalogStream()` for React consumption
5. **Server-side streaming** — No Worker-side helpers for UITree patch generation
6. **Interactive demo** — The `/streaming` page is static docs, not a working chat app

---

## Original Plan

The original plan proposed four phases:

### Phase 1: React Renderer (`packages/kumo/src/catalog/react/`)

New files:

- `component-map.ts` — Map of 38 component type strings to resolver functions
- `KumoCatalogRenderer.tsx` — Core renderer walking the flat UITree
- `compound-wrappers.tsx` — Stateful wrappers for Dialog, Select, Tabs, etc.
- `patches.ts` — `UITreePatch` types and `applyTreePatch()` function
- `hooks.ts` — `useUITree()` and `useCatalogStream()` hooks
- `error-boundary.tsx` — Per-element error boundary
- `types.ts` — Renderer-specific types
- `index.ts` — Barrel export

Patch types proposed:

```ts
type UITreePatch =
  | { type: "upsertElements"; elements: Record<string, UIElement> }
  | { type: "deleteElements"; keys: string[] }
  | { type: "setRoot"; root: string }
  | { type: "setData"; path: string; value: unknown }
  | { type: "replaceData"; data: DataModel }
  | { type: "replaceTree"; tree: UITree };
```

### Phase 2: Transport Package (`packages/kumo-agent-ui/`)

A new package with:

- SSE stream helpers for Workers
- A2UI JSONL adapter
- MCP UI surface protocol

### Phase 3: Registry Schema Extensions

Add `childrenMode`, `childrenProp`, `compoundResolution` fields to `ComponentSchema`.

### Phase 4: Docs Demo

Interactive streaming playground at `/streaming` or `/ai-ui`.

---

## Plan Review: Identified Flaws

### FLAW 1: `/streaming` Route Already Exists (Severity: Medium)

The plan says "Extend or create `src/pages/streaming.astro`" but this page already exists as
a 565-line documentation page. It covers `createKumoCatalog`, `resolveProps`,
`evaluateVisibility`, etc.

Overwriting it with a chat app loses the reference documentation. The plan doesn't specify
whether to replace or extend.

**Resolution**: Keep `/streaming` as the documentation page (rename internally to "Catalog
API Reference"). Create a new page at `/playground` for the interactive chat demo. Add both
to the sidebar navigation.

### FLAW 2: Compound Component Complexity Underestimated (Severity: High)

The plan says "Medium effort" for the component map and lists "38 total" resolvers. The
reality:

**Tabs is NOT a compound component.** It uses a `tabs: TabsItem[]` data array prop. There
are no `Tabs.Tab` sub-components. The plan says "Map props.tabs array to Tab items" but
there's nothing to map to — the renderer should pass the `tabs` array directly.

**Pagination is NOT a compound component.** It's fully self-contained with props `page`,
`setPage`, `perPage`, `totalCount`. The plan lists it alongside Dialog and Select.

**Combobox has 12 sub-components** (`Content`, `TriggerInput`, `TriggerValue`,
`TriggerMultipleWithInput`, `Item`, `Chip`, `Input`, `Empty`, `GroupLabel`, `Group`, `List`,
`Collection`). The `TriggerMultipleWithInput` takes a `renderItem` render prop that cannot
be expressed in JSON. The `List` and `Collection` sub-components are raw Base UI
passthroughs, not styled wrappers.

**DatePicker and DateRangePicker** are complex stateful components not covered by
`loader.tsx` at all.

**Breadcrumbs** has 4 sub-components (`Link`, `Current`, `Separator`, `Clipboard`) that the
plan doesn't enumerate.

The `loader.tsx` that the plan says to "port from" is 994 lines and still doesn't cover
Combobox, DatePicker, DateRangePicker, or MenuBar.

**Resolution**: Implement in explicit tiers:

| Tier | Components                                                                                                                                  | Count | Complexity                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----- | --------------------------------------------- |
| 1    | Badge, Banner, Button, Text, Link, Loader, Empty, Surface, Label, CloudflareLogo, SkeletonLine, ClipboardText, Code, Switch, Tooltip, Meter | 16    | Trivial — simple props, no sub-components     |
| 2    | Tabs, Pagination, Input, SensitiveInput, Grid, Checkbox, Radio, Breadcrumbs, Collapsible, LayerCard                                         | 10    | Moderate — data-driven or shallow compound    |
| 3    | Select, Dialog, Table, Popover, Dropdown, Toast                                                                                             | 6     | Complex — compound with managed state         |
| 4    | Combobox, CommandPalette, DatePicker, DateRangePicker, MenuBar                                                                              | 5     | Hard — render props, deep sub-component trees |

Ship Tiers 1-2 first. Tier 3 next. Defer Tier 4 until there's demand.

### FLAW 3: `initCatalog()` Race Condition (Severity: Medium)

`catalog.ts:279-282`:

```ts
export async function initCatalog(catalog: KumoCatalog): Promise<void> {
  catalog.validateTree({}); // calls getSchemas() which throws if not loaded
}
```

`loadSchemas()` is async (`import("../../ai/schemas")`) but `initCatalog` calls
`catalog.validateTree({})` synchronously. `getSchemas()` at line 63 throws if the module
isn't loaded yet. The `validateTree` catch block at line 159 swallows this as a validation
error, so `initCatalog` appears to succeed silently while schemas remain unloaded.

The `useCatalogStream` hook will hit this: it needs schemas loaded before the first patch
arrives, and there's no loading state or guarantee about timing.

**Resolution**: Fix `initCatalog()` to properly await `loadSchemas()`:

```ts
export async function initCatalog(catalog: KumoCatalog): Promise<void> {
  await loadSchemas();
}
```

### FLAW 4: `applyTreePatch` Lacks Structural Sharing (Severity: High)

The plan says "React re-renders only what changed" via `React.memo` keyed by `element.key`.
But if `applyTreePatch` returns a new `UITree` with a shallow copy of `elements`, every
element reference changes, and every `React.memo` comparison fails.

Additional gaps:

- **No orphan cleanup**: `deleteElements` for a parent doesn't remove children.
- **No `appendChildren` patch**: Adding an element to the tree requires both upserting the
  element AND modifying the parent's `children` array — a two-patch operation with no
  atomicity guarantee.
- **No patch validation**: What happens when you delete the root? Or set the root to a
  nonexistent element?

**Resolution**:

- `applyTreePatch` must preserve object identity for unchanged elements.
- Add `batch` patch type for atomic multi-patch operations.
- Add `appendChildren`/`removeChildren` as first-class patches.
- Validate patches: reject `deleteElements` for root, reject `setRoot` to nonexistent key.

### FLAW 5: Static Docs Site Cannot Serve SSE (Severity: Critical)

The docs site (`kumo-docs-astro`) is deployed as **static assets** via `wrangler.jsonc`.
There is no SSR adapter configured in `astro.config.mjs`. The plan proposes a "Streaming
Playground Page" with SSE but doesn't address where the SSE endpoint lives.

The plan also says "our docs site will probably utilize Workers AI to demonstrate this
capability" — but a static site can't bind to Workers AI.

**Resolution**: The interactive demo has two modes:

1. **Mock mode** (default): Pre-recorded patch sequences replayed client-side. No server
   needed. Ships with the static site.
2. **Live mode** (optional): A separate Worker at a different origin (e.g.,
   `api.kumo-ui.com`) with Workers AI binding. The demo page calls it via `fetch()`. This
   is a separate deployment and a separate milestone.

### FLAW 6: `packages/kumo-agent-ui/` Is Premature (Severity: Medium)

Phase 2 creates a new package with SSE helpers, A2UI adapter, and MCP surface — all before
there's a single consumer.

- The SSE client is just an `EventSource` wrapper; it belongs in the hooks file.
- The A2UI data model (`literalString`, `surfaceUpdate`, `beginRendering`) is fundamentally
  different from UITree patches. Translation isn't straightforward. A2UI uses nested trees;
  Kumo uses flat maps. A2UI has `DataValue` wrappers (`{ literalString: "..." }`); Kumo uses
  `{ path: "/..." }`.
- The MCP `postMessage` protocol (`ui-lifecycle-iframe-ready`,
  `ui-lifecycle-iframe-render-data`) is an implementation detail of the exercise examples,
  not a standard.
- `kumo-provider/server.js` already has working SSE streaming — that's the real prior art.

**Resolution**: Skip the original Phase 2 (transport package) entirely. Put the SSE client
in `hooks.ts`. Build the A2UI adapter and MCP surface only when real consumers demand them.
The plan's own dependency graph confirms Steps 7-12 are non-critical-path. (Note: the
revised plan's "Phase 2" is now the cross-boundary loadable, not this transport package.)

### FLAW 7: Registry Schema Extensions Have No Consumer (Severity: Low)

Phase 3 adds `childrenMode`, `childrenProp`, and `compoundResolution` to `ComponentSchema`,
then updates codegen. But the renderer uses a hand-written component map with resolver
functions — it doesn't need machine-readable compound resolution hints. Adding fields to
`ComponentSchema` changes `component-registry.json` and `ai/schemas.ts` (committed to git,
shipped in npm). This modifies the AI-facing contract for no current benefit.

**Resolution**: Defer. If auto-generation of the component map is pursued later, add the
metadata then.

### FLAW 8: `children` Prop Ambiguity (Severity: High)

The UITree format puts text content in `props.children` (e.g.,
`props: { children: "Welcome" }`) and child elements in the `children` array on the element
itself (e.g., `children: ["child-1", "child-2"]`). The plan doesn't specify what happens
when both are present:

```json
{
  "key": "text-1",
  "type": "Text",
  "props": { "children": "Hello World" },
  "children": ["badge-1"]
}
```

Does the renderer use `props.children` (the string), recursively render `children` (the
array), or concatenate both? `types.ts` doesn't specify.

**Resolution**: Define clear precedence:

1. If `element.children` array is non-empty, render those as React children.
2. Otherwise, use `props.children` as the React children.
3. `props.children` is ignored when `element.children` is present.
4. Document this in the UITree spec and enforce in the renderer.

### FLAW 9: Actions Are Fire-and-Forget (Severity: Medium)

The proposed `onAction` callback signature is `(action, resolvedParams) => void`. But
`Action` in `types.ts:111-122` has `onSuccess` and `onError` with `set` paths for data
model updates. There's no mechanism for:

- Async resolution (the handler returns nothing)
- Communicating success/failure back to the renderer
- Applying `onSuccess.set`/`onError.set` patches after handler completion

**Resolution**: `onAction` should return `Promise<void>`. The renderer wraps it:

```ts
try {
  await onAction(action, resolvedParams);
  if (action.onSuccess?.set) applyDataUpdates(action.onSuccess.set);
} catch {
  if (action.onError?.set) applyDataUpdates(action.onError.set);
}
```

### FLAW 10: No Server-Side Patch Generation Strategy (Severity: Critical)

The plan describes the client-side rendering pipeline in detail but barely addresses how
UITree patches get produced.

- LLMs generate tokens, not complete JSON objects. The `kumo-provider/server.js` handles
  this with incremental JSON parsing on partial buffers with error recovery — it's 676
  lines of non-trivial code.
- `catalog.generatePrompt()` describes the UITree format but not the patch format. The LLM
  has no instruction on how to emit patches.
- No error recovery strategy for partial/malformed patches mid-stream.

**Resolution**: For the initial demo, have the LLM generate **complete UITrees** (not
patches). Diff them client-side into patches using a simple object comparison. This is
dramatically simpler and more reliable. Move to server-side patch generation only when the
simpler approach proves insufficient.

### FLAW 11: Bundle Size — Importing All 38 Components (Severity: High)

The component map imports all 38 Kumo components into a single entry point. This defeats
the library's tree-shakeable per-component exports (`./components/button`,
`./components/dialog`, etc.). Any consumer of `@cloudflare/kumo/catalog/react` would pull
in the entire component library.

**Resolution**: Use a registration pattern. The component map ships empty (or with a small
default set). Consumers register what they need:

```ts
import { registerComponents, KumoCatalogRenderer } from "@cloudflare/kumo/catalog/react";
import { Button, Text, Surface, Badge } from "@cloudflare/kumo";

registerComponents({ Button, Text, Surface, Badge });
// or
<KumoCatalogRenderer components={{ Button, Text, Surface, Badge }} tree={tree} />
```

Provide a `registerAllComponents()` convenience import from a separate heavy entry point for
consumers who don't care about bundle size.

### FLAW 12: Missing Test Strategy (Severity: Low)

Step 6 says "Tests" with "Medium" effort but doesn't specify what's tested. Critical things:

- Does each resolver produce correct React output for every prop combination?
- Do compound wrappers manage state when driven by JSON?
- Does `applyTreePatch` maintain structural sharing?
- Does the error boundary isolate failures?
- Does streaming reconciliation work with rapid sequential patches?

The existing test infrastructure (`vitest` + `happy-dom`) supports this but no plan exists
for test cases.

**Resolution**: Define test categories inline with each implementation step. See the revised
plan below.

### FLAW 13: `resolveProps` Does Not Resolve Dynamic Values Inside Arrays (Severity: Medium)

`data.ts:128-133` explicitly checks `!Array.isArray(value)` before recursing into nested
objects. This means if an LLM generates:

```json
{
  "type": "Checkbox",
  "props": {
    "items": [{ "path": "/options/0" }, { "path": "/options/1" }]
  }
}
```

The `{ path: "..." }` refs inside the array will pass through unresolved to the component.
This directly affects Tier 2 resolvers (Checkbox, Radio, Breadcrumbs) which rely on array
props (`items`, `links`). The resolver will receive `{ path: "..." }` objects instead of
actual data.

**Resolution**: Fix `resolveProps` in `data.ts` to recursively resolve array elements:

```ts
if (Array.isArray(value)) {
  let changed = false;
  const resolved = value.map((item) => {
    if (isDynamicPath(item)) {
      changed = true;
      return getByPath(dataModel, item.path);
    }
    if (typeof item === "object" && item !== null) {
      const r = resolveProps(item, dataModel);
      if (r !== item) changed = true;
      return r;
    }
    return item;
  });
  return changed ? resolved : value;
}
```

Add this fix as a sub-task of Step 6 (alongside the `initCatalog` fix), since it's in the
same file area and the Tier 2 resolvers (Step 3) depend on it working correctly.

**Tests**: Add test cases to `catalog.test.ts` for resolving dynamic values inside arrays,
including nested objects within arrays.

### FLAW 14: `resolveProps` Breaks Reference Equality (Severity: Medium)

`resolveProps` always returns a **new object**, even when no dynamic values exist in the
props. This defeats the `React.memo` optimization described in Step 4. The plan says
"React.memo on the per-element renderer using element reference identity" — but even with
structural sharing in `applyTreePatch`, every call to `resolveProps` during render produces
a new props object, causing all memoized components to re-render regardless.

```ts
// Current behavior: always returns new object
resolveProps({ label: "Hello", variant: "primary" }, data);
// Returns: { label: "Hello", variant: "primary" } — same values, new reference
```

**Resolution**: Modify `resolveProps` to track whether any value actually changed, and
return the original object when nothing was resolved:

```ts
export function resolveProps(
  props: Record<string, unknown>,
  dataModel: DataModel,
): Record<string, unknown> {
  let changed = false;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    const resolved = resolveValue(value, dataModel);
    if (resolved !== value) changed = true;
    result[key] = resolved;
  }
  return changed ? result : props;
}
```

This preserves reference identity for static props, making `React.memo` effective.

Add this fix as a sub-task of Step 6.

**Tests**: Add test case verifying `resolveProps` returns the same object reference when
no dynamic values are present: `expect(resolveProps(staticProps, data)).toBe(staticProps)`.

### FLAW 15: `catalog.ts` Has Zero Test Coverage (Severity: Medium)

The test file `catalog.test.ts` only tests `data.ts` utilities (`getByPath`, `setByPath`,
`resolveProps`) and `visibility.ts` (`evaluateVisibility`, `evaluateLogicExpression`).
There are zero tests for:

- `createKumoCatalog()`
- `initCatalog()` / `loadSchemas()`
- `validateElement()` / `validateTree()`
- `generatePrompt()`
- `hasComponent()` / `getComponentSchema()`

The most complex and bug-prone module has no test coverage. The Step 6 fix to `initCatalog`
has no way to verify it doesn't regress existing behavior because there are no existing tests
to regress against.

**Resolution**: Step 6 must include tests for `initCatalog` and `loadSchemas` at minimum.
Broader `catalog.ts` test coverage is desirable but can be a follow-up. The Step 6 tests
should verify:

- `await initCatalog(catalog)` resolves only after schemas are loaded
- After `initCatalog`, `catalog.validateTree(validTree)` returns `{ success: true }`
- After `initCatalog`, `catalog.validateTree(invalidTree)` returns errors
- Calling `catalog.validateTree()` **before** `initCatalog` throws or returns an error
  (not a silent false success)

### FLAW 16: Module-Level Singleton Schema State (Severity: Low — Tech Debt)

`catalog.ts:41-42` uses module-level mutable state for schema caching:

```ts
let schemasModule: SchemasModule | null = null;
let schemasLoadPromise: Promise<SchemasModule> | null = null;
```

Multiple `KumoCatalog` instances share this global state. The plan's own design principles
say "No module-level mutable state" — but the existing `catalog.ts` violates this.

This is NOT a blocker for Phase 1 since the renderer does not call `initCatalog`. However,
it means:

- Tests that load schemas cannot be parallelized safely
- SSR with multiple catalogs per request shares schema state across requests
- There's no way to reset the schema cache without reloading the module

**Resolution**: Document as known tech debt. Do not fix in Phase 1. If schema loading
becomes a problem in tests or SSR, refactor `loadSchemas` to be instance-scoped on the
`KumoCatalog` object.

---

## Revised Plan

### Design Principles

1. **UITree patches as canonical wire format** — A2UI/MCP adapters produce patches, not
   the other way around. The renderer understands one format.
2. **JSONL as the streaming wire format** — Each line is a complete `UITreePatch` JSON
   object. No incomplete JSON, no incremental parser. `diffUITree()` on the server
   converts complete trees to patches; the client reads line-by-line.
3. **Component map lives in `@cloudflare/kumo`** — Co-located with implementations to
   prevent version skew.
4. **Registration pattern for bundle size** — Consumers opt into which components to
   include. No implicit import of all 38.
5. **Complete trees before patches** — For the LLM integration, generate complete UITrees
   and diff server-side into JSONL patches. Don't ask the LLM to generate patches directly.
6. **ErrorBoundary per-element** — One failed component doesn't break the rest (critical
   for AI-generated UI where the model might hallucinate invalid props).
7. **No new packages until there are consumers** — Everything in Phase 1 lives in
   `packages/kumo/`. No `kumo-agent-ui` yet. Phase 2 (cross-boundary loadable) may live
   in a separate entry point or a thin wrapper package, but only after Phase 1 ships.
8. **Cross-boundary is a first-class goal** — The renderer must work both in-app (React
   import) and cross-boundary (UMD loaded via `<script>` on third-party sites). Phase 1
   builds the renderer; Phase 2 wraps it for cross-boundary use.
9. **Streaming UX is a first-class concern** — The renderer must support patterns that
   make AI-streaming feel responsive:
   - **Immediate rendering**: When patches arrive during streaming, consumers may need
     `flushSync` to force synchronous DOM updates rather than letting React batch them.
     `KumoCatalogRenderer` itself does NOT call `flushSync` (that's a consumer decision),
     but `useUITree` and the docs should document this pattern.
   - **Entrance animations**: New elements appearing during streaming should support CSS
     transitions. The renderer applies a `data-catalog-new` attribute on freshly upserted
     elements (removed after one frame via `requestAnimationFrame`). Consumers can style
     `[data-catalog-new] { opacity: 0; transform: translateY(4px); }` with CSS transitions.
     This is lighter than the MutationObserver approach in `kumo-provider` and doesn't
     require JavaScript animation libraries.
   - **Skeleton placeholders**: During streaming, components whose props are partially
     resolved (containing remaining `{ path: "..." }` refs against an incomplete data
     model) should degrade to `SkeletonLine` rather than rendering broken UI. This is
     handled by the fallback mechanism in the renderer, not the component map.

### Phase 1: Core Renderer (`packages/kumo/src/catalog/react/`)

All renderer code goes in `packages/kumo/src/catalog/react/`. The component library remains
self-contained.

#### Step 1: Patch Types and `applyTreePatch` (Small)

**File**: `src/catalog/react/patches.ts`

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

function applyTreePatch(prev: UITree, patch: UITreePatch): UITree;
function applyDataPatch(prev: DataModel, patch: UITreePatch): DataModel;
```

Requirements:

- **Structural sharing**: Only create new element objects for elements that actually changed.
  Unchanged elements must preserve reference identity.
- **Orphan cleanup**: `deleteElements` on a parent recursively removes children.
- **Validation**: Reject `deleteElements` for root. Reject `setRoot` to nonexistent key.
- **Batch semantics (snapshot isolation)**: `batch` applies sub-patches sequentially. If any
  sub-patch throws, the entire batch returns the **original** (pre-batch) tree unchanged.
  The error is re-thrown so callers know the batch failed. Partial results are never exposed.
- **`appendChildren` edge cases**:
  - If a `childKey` doesn't exist in `elements`, throw `"Element {childKey} not found"`.
  - If a `childKey` already has a different `parentKey`, throw
    `"Element {childKey} already has parent {existingParent}"`. Reparenting requires
    explicit `removeChildren` then `appendChildren`.
  - The parent's `children` array is created if it doesn't exist.
- **`removeChildren` edge cases**:
  - If a `childKey` is not in the parent's `children`, silently skip (idempotent).
  - After removal, if the parent's `children` array is empty, set it to `[]` (not
    `undefined`) to preserve the array type.
  - Removed children retain their element entry in `elements` — they become orphaned.
    Callers who want deletion should use `deleteElements` instead.

Also re-export from `src/catalog/index.ts` since `patches.ts` has no React dependency.

**Tests**: Unit tests for each patch type, structural sharing verification, orphan cleanup,
error cases (delete root, set root to nonexistent key, batch rollback, appendChildren to
nonexistent element, appendChildren with existing parent, removeChildren idempotency).

#### Step 2: Component Map — Tier 1 (Small)

**File**: `src/catalog/react/component-map.ts`

Registration-based approach using **React Context** (not global singleton), so it's safe for
SSR and multiple renderer instances with different component sets:

```ts
// === Exported types ===
type ComponentResolver = (
  element: UIElement,
  resolvedProps: Record<string, unknown>,
  children: ReactNode,
) => ReactElement | null;

// === Exported functions ===

// Create a default resolver from a plain React component (pass-through props + children)
function createPassthroughResolver(
  Component: ComponentType<any>,
): ComponentResolver;

// Create a component map from a Record of components (convenience for Tier 1 pattern)
function createComponentMap(
  components: Record<string, ComponentType<any>>,
): Record<string, ComponentResolver>;

// Merge multiple maps (later entries override earlier)
function mergeComponentMaps(
  ...maps: Record<string, ComponentResolver>[]
): Record<string, ComponentResolver>;

// === Exported from this file ===
export {
  type ComponentResolver,
  createPassthroughResolver,
  createComponentMap,
  mergeComponentMaps,
};
```

**Design decision — Context, not global singleton**: The component map is passed to
`KumoCatalogRenderer` via the `components` prop and provided to child renderers via React
Context. There is NO module-level `registerComponents()` function. This means:

- SSR-safe: no shared mutable state between requests.
- Multiple renderers on one page can use different component sets.
- Consumers must always pass `components` to the renderer.

Tier 1 components (16): Badge, Banner, Button, Text, Link, Loader, Empty, Surface, Label,
CloudflareLogo, SkeletonLine, ClipboardText, Code, Switch, Tooltip, Meter.

These all follow the same pattern: pass `resolvedProps` + `children` directly, so consumers
use `createComponentMap({ Button, Text, ... })`.

Tier 1 also includes a **default resolver** for unknown types that renders a styled error
box showing the type name and props (dev mode) or nothing (prod mode). This is NOT in the
component map — it's a fallback inside `KumoCatalogRenderer` itself.

**Tests**: Verify each Tier 1 resolver produces the correct element type with correct props.
Verify `createComponentMap` produces resolvers that pass props correctly. Verify
`mergeComponentMaps` gives later entries precedence.

#### Step 3: Component Map — Tier 2 (Medium)

Add resolvers for 10 components with moderate complexity:

- **Tabs**: Pass `tabs` array prop directly (it's data-driven, NOT compound).
- **Pagination**: Pass `page`, `setPage`, `perPage`, `totalCount`. The resolver must create
  a stateful wrapper that manages `page` state internally when no `setPage` is provided.
- **Input / SensitiveInput**: Direct prop pass-through with optional `Field` wrapper.
- **Grid**: Direct prop pass-through.
- **Checkbox**: `Checkbox.Group` + `Checkbox.Item` from a `{ items: [...] }` prop.
- **Radio**: `Radio.Group` + `Radio.Item` from a `{ items: [...] }` prop.
- **Breadcrumbs**: Map a `links` array to `Breadcrumbs.Link` + `Breadcrumbs.Current`.
- **Collapsible**: Direct with title/children mapping.
- **LayerCard**: Map `primary`/`secondary` slot props to sub-components.

**Tests**: Verify compound resolution (Checkbox items, Radio items, Breadcrumbs links).

#### Step 4: `KumoCatalogRenderer` (Medium)

**File**: `src/catalog/react/KumoCatalogRenderer.tsx`

```tsx
interface KumoCatalogRendererProps {
  tree: UITree;
  data?: DataModel;
  auth?: AuthState;
  actions?: ActionHandlers;
  onAction?: (action: Action, params: Record<string, unknown>) => Promise<void>;
  components: Record<string, ComponentResolver>; // REQUIRED — no implicit global map
  fallback?: ComponentType<{ element: UIElement }>;
}
```

**Note**: `components` is **required**, not optional. There is no global registry to fall
back to. This is intentional — it makes the dependency explicit and tree-shakeable.

**`initCatalog` is NOT called by the renderer.** Schema loading is only needed for
server-side validation (`catalog.validateTree()`). The renderer does not validate — it
trusts the tree structure and uses `resolveProps`/`evaluateVisibility` which are pure
functions with no async dependencies. Consumers who want validation should call
`await initCatalog(catalog)` before rendering. Document this in the JSDoc on
`KumoCatalogRenderer`.

Implementation:

1. Start at `tree.root`, look up element in `tree.elements`.
2. `evaluateVisibility(element.visible, { data, auth })` — skip if invisible.
3. `resolveProps(element.props, data)` — resolve all `{path:"/..."}` refs.
4. Look up `ComponentResolver` in `components` map (exact match or fallback renderer).
5. Recursively render `element.children` (mapped by key from `tree.elements`).
6. Wire `element.action` to async `onAction` callback with `onSuccess`/`onError` handling.
7. Wrap each element in `ErrorBoundary`.

Children precedence rule:

- If `element.children` array is non-empty → render those as React children.
- Otherwise → use `props.children` as React children.
- `props.children` is stripped from the props passed to the component when
  `element.children` is present.

Use `React.memo` on the per-element renderer. The memo comparison uses `element` reference
identity (enabled by structural sharing in `applyTreePatch`).

**Tests**: Full render cycle with mock components. Visibility filtering. Data binding. Action
dispatch with success/error paths. Error boundary isolation. Children precedence.

#### Step 5: `useUITree` Hook (Small)

**File**: `src/catalog/react/hooks.ts`

```ts
function useUITree(
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

Uses `useReducer` internally for predictable state transitions.

**Tests**: Patch application, data updates, reset behavior.

#### Step 6: Fix `initCatalog`, `resolveProps`, and Add Catalog Tests (Medium)

This step bundles three related fixes in `src/catalog/`:

**6a. Fix `initCatalog` race condition**

**File**: `src/catalog/catalog.ts`

Change `initCatalog` from:

```ts
export async function initCatalog(catalog: KumoCatalog): Promise<void> {
  catalog.validateTree({});
}
```

To:

```ts
export async function initCatalog(_catalog: KumoCatalog): Promise<void> {
  await loadSchemas();
}
```

**6b. Fix `resolveProps` to handle arrays** (Flaw 13)

**File**: `src/catalog/data.ts`

Add array resolution to `resolveProps` so that dynamic values inside arrays (e.g.,
`items: [{ path: "/options/0" }]`) are resolved. See Flaw 13 for the implementation.

**6c. Fix `resolveProps` to preserve reference equality** (Flaw 14)

**File**: `src/catalog/data.ts`

Modify `resolveProps` to return the original object when no dynamic values were resolved.
This enables `React.memo` to work correctly. See Flaw 14 for the implementation.

**6d. Add catalog.ts test coverage** (Flaw 15)

**File**: `src/catalog/catalog.test.ts` (extend existing)

Add tests for:

- `initCatalog` awaits schema loading (schemas are available after await resolves)
- `catalog.validateTree(validTree)` returns `{ success: true }` after init
- `catalog.validateTree(invalidTree)` returns `{ success: false }` with errors
- `resolveProps` resolves dynamic values inside arrays
- `resolveProps` resolves nested objects inside arrays
- `resolveProps` returns the same object reference when no dynamic values are present
  (`expect(resolveProps(staticProps, data)).toBe(staticProps)`)
- `resolveProps` returns a new object when dynamic values are present
  (`expect(resolveProps(dynamicProps, data)).not.toBe(dynamicProps)`)

#### Step 7: Error Boundary (Small)

**File**: `src/catalog/react/error-boundary.tsx`

Class component (React error boundaries require class components). Catches render errors
per-element and shows a fallback. In development, shows the component type and error message.
In production, renders nothing.

Pattern from `_examples/kumo-provider/src/loader.tsx`.

**Tests**: Verify error isolation — one element throwing doesn't affect siblings.

#### Step 8: Barrel Export + Package Config (Small)

**File**: `src/catalog/react/index.ts`

```ts
// === Full export contract for src/catalog/react/index.ts ===
export {
  KumoCatalogRenderer,
  type KumoCatalogRendererProps,
} from "./KumoCatalogRenderer";
export { applyTreePatch, applyDataPatch, type UITreePatch } from "./patches";
export { useUITree } from "./hooks";
export {
  createPassthroughResolver,
  createComponentMap,
  mergeComponentMaps,
  type ComponentResolver,
} from "./component-map";
export { CatalogErrorBoundary } from "./error-boundary";
```

**Files to modify**:

- `packages/kumo/package.json` — Add `"./catalog/react"` export:
  ```json
  "./catalog/react": {
    "types": "./dist/src/catalog/react/index.d.ts",
    "import": "./dist/catalog/react.js"
  }
  ```
- `packages/kumo/vite.config.ts` — Add entry:
  ```ts
  "catalog/react": resolve(__dirname, "src/catalog/react/index.ts"),
  ```
- `packages/kumo/src/catalog/index.ts` — Re-export patch types + diff (no React dependency):
  ```ts
  export type { UITreePatch } from "./react/patches";
  export { applyTreePatch, applyDataPatch } from "./react/patches";
  export { diffUITree } from "./react/diff"; // Added in Phase 4, Step 13
  ```

Note on the vite entry name: existing entries use flat names (`catalog`, `registry`). A
slash in the entry name (`catalog/react`) produces `dist/catalog/react.js` which matches the
package.json export path. This works but verify in a build.

**`"use client"` strategy**: The existing vite config injects `"use client"` on ALL output
chunks via `renderChunk` hook. Since `catalog/react` is a separate entry point, it will get
its own chunk(s). This means `patches.ts` (which has no React dependency) will still get the
banner — acceptable since it's a no-op in non-RSC contexts. Do NOT try to split the entry
point into client/non-client chunks; it adds complexity for no benefit. If `patches.ts`
reuse from the base `catalog` entry is desired, the re-export in `src/catalog/index.ts`
handles that — consumers who import from `@cloudflare/kumo/catalog` get `patches` without
the React chunk.

**Test convention**: New tests go in `src/catalog/react/__tests__/` (subdirectory pattern),
NOT co-located with source files. This matches the file creation summary and avoids
cluttering the implementation directory. The existing `src/catalog/catalog.test.ts` is
co-located — that's legacy; don't follow that pattern for new files.

**Tests**: Structural import tests (pattern from `tests/imports/`). Verify the export path
resolves. Verify `pnpm --filter @cloudflare/kumo build` produces `dist/catalog/react.js`.

### Phase 2: Cross-Boundary Loadable

This phase wraps the Phase 1 renderer into a UMD bundle that third-party sites (ChatGPT,
etc.) can load via `<script>`, fulfilling `GENERATIVE-UI.md`'s core cross-boundary
requirement. This is rebuilt from `kumo-provider`'s approach on top of Phase 1's renderer.

**New entry point**: `packages/kumo/src/loadable/` (or a separate `packages/kumo-loadable/`)

#### Step 19: UMD Build Configuration (Medium)

**File**: New vite config (or entry in existing `vite.config.ts`)

A separate vite build that:

1. Imports the Phase 1 renderer + all Kumo components (kitchen-sink build)
2. Creates mount/render functions
3. Outputs IIFE/UMD format with React bundled in → `component-loadable.umd.cjs`
4. Outputs CSS → `stylesheet.css`

```ts
// packages/kumo/src/loadable/index.ts
import {
  KumoCatalogRenderer,
  applyTreePatch,
  useUITree,
  createComponentMap,
} from "../catalog/react";
import * as KumoComponents from "../../index"; // all components
// ... build window.CloudflareKumo API
```

**Key outputs**:

- `component-loadable.umd.cjs` — React + Kumo + renderer in one file
- `stylesheet.css` — Kumo styles for injection
- `.well-known/` convention: `component-registry.json` (already exists),
  `component-loadable.umd.cjs`, `stylesheet.css`

#### Step 20: `window.CloudflareKumo` Mount API (Medium)

**File**: `packages/kumo/src/loadable/mount.tsx`

```ts
window.CloudflareKumo = {
  render(name: string, props: Record<string, unknown>, containerId: string): void;
  renderFromJSON(jsonDef: any, containerId: string): void;
  renderFromStream(url: string, containerId: string): void;
  setTheme(mode: 'light' | 'dark'): void;
  _roots: Map<string, ReactRoot>;
};
```

Port from `kumo-provider/src/loader.tsx:871-994`. Key differences from the original:

- Uses Phase 1's `KumoCatalogRenderer` + `createComponentMap` instead of the monolithic
  `createKumoElement` switch
- Uses `applyTreePatch` for streaming instead of the ad-hoc JSON walker
- `renderFromStream` reads JSONL lines from a URL and progressively renders

#### Step 21: ThemeWrapper for Cross-Boundary Mode Switching (Small)

**File**: `packages/kumo/src/loadable/theme-wrapper.tsx`

Port from `kumo-provider/src/loader.tsx:854-869`. Wraps rendered components in a
`<div data-mode={mode} className="kumo-root">` and listens for
`window.addEventListener('kumo-theme-change')` events.

Also updates `document.body` attributes for portal components (Select menus, etc.) that
render outside the wrapper:

```ts
document.body.setAttribute("data-mode", mode);
```

#### Step 22: Integration Test — Third-Party HTML Page (Small)

A minimal `test.html` page that:

1. Loads `component-loadable.umd.cjs` via `<script>`
2. Loads `stylesheet.css` via `<link>`
3. Calls `window.CloudflareKumo.renderFromJSON(...)` with a simple component tree
4. Verifies rendering works without any build step on the host page

This is a manual smoke test, not an automated CI test (UMD + real browser required).

**Verification gate:**

```bash
# Build the loadable
pnpm --filter @cloudflare/kumo build:loadable
# Verify output exists
ls packages/kumo/dist/loadable/component-loadable.umd.cjs
ls packages/kumo/dist/loadable/stylesheet.css
# Verify bundle size is reasonable (< 500KB gzipped)
gzip -c packages/kumo/dist/loadable/component-loadable.umd.cjs | wc -c
```

### Phase 3: Docs Demo (`packages/kumo-docs-astro/`)

#### Step 9: Rename + Restructure `/streaming` (Small)

The existing `/streaming` page becomes the API reference documentation. Keep the content,
update the title to "Catalog API" or "JSON-UI Reference", and add it to the sidebar
navigation.

Create a new `/playground` route for the interactive demo.

**Files to modify**:

- `src/components/SidebarNav.tsx` — Add both pages to `staticPages`:
  ```ts
  { label: "Streaming UI", href: "/streaming" },
  { label: "Playground", href: "/playground" },
  ```

#### Step 10: Mock Data Sequences (Small)

**File**: `src/components/demos/playground/mock-sequences.ts`

Pre-recorded UITree patch sequences demonstrating:

- A simple card with text and button
- A form with inputs and validation
- A table with data binding
- A multi-step wizard-like flow
- Streaming element-by-element assembly (simulating LLM output)

Each sequence is an array of `UITreePatch` objects with timing metadata.

#### Step 11: Chat Demo Component (Medium)

**File**: `src/components/demos/PlaygroundDemo.tsx`

React island component with:

- Chat-style message list (user messages + AI responses)
- Text input for sending messages
- Split view option: rendered Kumo UI (left) + raw JSON (right)
- Patch log showing applied patches
- Preset scenarios (dropdown) that play mock sequences
- `useUITree` hook for state management
- `KumoCatalogRenderer` for rendering

Uses `client:load` hydration directive since it needs immediate interactivity.

Initially uses mock data only. Real Workers AI integration is a separate milestone.

#### Step 12: Playground Page (Small)

**File**: `src/pages/playground.astro`

Astro page using `DocLayout` that embeds `<PlaygroundDemo client:load />` with minimal
surrounding documentation explaining what's happening.

### Phase 4: Workers AI Integration (Future — Separate Milestone)

This is a separate deployment, not part of the static docs site.

#### Step 13: `diffUITree` Function (Small)

**File**: `src/catalog/react/diff.ts`

```ts
// === Export contract ===
export function diffUITree(prev: UITree, next: UITree): UITreePatch[];
```

Produces the minimal set of patches to transform `prev` into `next`:

- Compare `root`: emit `setRoot` if different.
- Compare `elements` keys: emit `deleteElements` for removed keys, `upsertElements` for
  added or changed elements. Use shallow equality on each element object to detect changes.
- Compare `children` arrays per element: emit `appendChildren`/`removeChildren` as needed.
- Output is deterministic (same inputs → same patches).
- Does NOT produce `batch` — caller can wrap if atomicity is needed.

This function is the bridge between "LLM generates complete UITrees" (simple) and "client
receives patches" (efficient). It has no React dependency and is re-exported from
`src/catalog/index.ts`.

**Tests**: Verify diff of identical trees produces empty array. Verify added/removed/changed
elements produce correct patches. Verify applying `diffUITree(a, b)` patches to `a` produces
a tree equivalent to `b` (round-trip property test).

#### Step 14: API Worker

A standalone Cloudflare Worker (`packages/kumo-docs-api/` or similar) with:

- Workers AI binding for LLM inference
- `/api/chat` endpoint returning SSE
- System prompt built from `catalog.generatePrompt()` + component registry context
- LLM generates complete UITrees (not patches)
- Worker uses `diffUITree(prevTree, newTree)` to produce patches
- Patches sent as SSE events

#### Step 15: `useCatalogStream` Hook

**File**: `src/catalog/react/hooks.ts`

```ts
function useCatalogStream(
  url: string,
  options?: {
    onError?: (error: Error) => void;
    onComplete?: () => void;
  },
): {
  tree: UITree;
  data: DataModel;
  isStreaming: boolean;
  error: Error | null;
  send: (message: string) => void;
};
```

Thin wrapper around `EventSource` that feeds patches into `useUITree`.

#### Step 16: Live Mode Toggle

Update `PlaygroundDemo.tsx` to support both mock and live mode:

- Mock mode: plays pre-recorded sequences (default, works on static site)
- Live mode: connects to the API Worker via `useCatalogStream`

### Phase 5: Component Map Tiers 3-4 (Future)

#### Step 17: Tier 3 — Select, Dialog, Table, Popover, Dropdown, Toast

Each needs a stateful wrapper managing open/close state from JSON:

- **Select**: Convert `props.options: [{label, value}]` into `<Select>` + `<Select.Option>` children.
- **Dialog**: Map `props.title`/`description`/`actions` to `Dialog.Root` + sub-components.
  Needs internal `open` state.
- **Table**: Map `props.headers` + `props.rows` to `Table.Header`/`Table.Body`/`Table.Row`/`Table.Cell`.
- **Popover**: Map `props.trigger` + `props.content` with internal `open` state.
- **Dropdown**: Similar to Popover with menu items.
- **Toast**: Needs integration with Toast provider (context-dependent).

#### Step 18: Tier 4 — Combobox, CommandPalette, DatePicker, DateRangePicker, MenuBar

These have render props, deep sub-component trees, or complex internal state that may not
be fully representable in JSON. Evaluate on a case-by-case basis whether a JSON-driven
interface makes sense or whether these should be "escape hatch" components that require
custom resolver functions from the consumer.

### Phase 6: A2UI Adapter (Optional — Future)

A thin translation layer that converts A2UI `ServerToClientMessage` arrays into
`UITreePatch[]`. This sits between the A2UI protocol and the Phase 1 renderer:

```
A2UI messages → a2uiToPatch(messages) → UITreePatch[] → applyTreePatch() → KumoCatalogRenderer
```

This means:

- The ~42 Kumo adapters in `packages/react-kumo/` become unnecessary (the renderer uses
  the component map directly)
- A2UI becomes just another wire format that produces patches
- The investment in understanding the A2UI protocol pays off as protocol knowledge, not as
  maintained adapters

#### Step 23: A2UI-to-Patch Translator (Medium)

**File**: `packages/kumo/src/catalog/adapters/a2ui.ts` (or a separate package)

```ts
export function a2uiToPatch(messages: ServerToClientMessage[]): UITreePatch[];
```

Key translations:

- `beginRendering` → `replaceTree` or `setRoot`
- `surfaceUpdate` with component additions → `upsertElements` + `appendChildren`
- `dataModelUpdate` → `setData`
- `literalString` / `literalNumber` / `literalBoolean` unwrapping → plain values
- A2UI `ComponentArrayReference.explicitList` → `children` arrays

Build this only when there is a real A2UI consumer demanding Kumo rendering.

---

## Implementation Details

### File Creation Summary (Phase 1)

```
packages/kumo/src/catalog/react/
├── index.ts                     # Barrel export (see export contract in Step 8)
├── KumoCatalogRenderer.tsx      # <KumoCatalogRenderer tree data components actions />
├── component-map.ts             # Context-based component mapping (no global state)
├── compound-wrappers.tsx        # Stateful wrappers for Dialog, Select, etc. (Phase 5)
├── patches.ts                   # UITreePatch types + applyTreePatch() + applyDataPatch()
├── diff.ts                      # diffUITree(prev, next) → UITreePatch[] (Phase 4, Step 13)
├── hooks.ts                     # useUITree (Phase 1), useCatalogStream (Phase 4)
├── error-boundary.tsx           # Per-element error boundary (CatalogErrorBoundary)
├── types.ts                     # Renderer-specific types
└── __tests__/
    ├── patches.test.ts          # Patch application, structural sharing, edge cases
    ├── diff.test.ts             # Tree diffing, round-trip property tests (Phase 4)
    ├── component-map.test.ts    # Resolver output verification
    ├── renderer.test.ts         # Full render cycle
    └── hooks.test.ts            # Hook state management
```

### File Modification Summary (Phase 1)

```
packages/kumo/src/catalog/catalog.ts       # Fix initCatalog race condition
packages/kumo/src/catalog/data.ts          # Fix resolveProps (arrays + reference equality)
packages/kumo/src/catalog/catalog.test.ts  # Add initCatalog + resolveProps tests
packages/kumo/src/catalog/index.ts         # Re-export patch types
packages/kumo/package.json                 # Add ./catalog/react export
packages/kumo/vite.config.ts               # Add catalog/react entry
```

### File Creation Summary (Phase 2 — Cross-Boundary Loadable)

```
packages/kumo/src/loadable/
├── index.ts                     # Entry point for UMD build
├── mount.tsx                    # window.CloudflareKumo API (render, renderFromJSON, etc.)
├── theme-wrapper.tsx            # ThemeWrapper with cross-boundary mode switching
└── stream-reader.ts             # JSONL stream reader for renderFromStream()
```

Or, if a separate package is preferred:

```
packages/kumo-loadable/
├── src/
│   ├── index.ts
│   ├── mount.tsx
│   ├── theme-wrapper.tsx
│   └── stream-reader.ts
├── vite.config.ts               # UMD/IIFE build config
└── package.json
```

### File Creation Summary (Phase 3 — Docs)

```
packages/kumo-docs-astro/src/
├── pages/playground.astro                 # Interactive demo page
└── components/demos/
    └── playground/
        ├── PlaygroundDemo.tsx             # Chat demo React island
        ├── mock-sequences.ts             # Pre-recorded patch sequences
        └── types.ts                       # Demo-specific types
```

### File Modification Summary (Phase 3 — Docs)

```
packages/kumo-docs-astro/src/components/SidebarNav.tsx  # Add nav items
packages/kumo-docs-astro/src/pages/streaming.astro      # Update title/framing
```

### Implementation Order

| Step | What                                       | Depends on  | Effort | Phase |
| ---- | ------------------------------------------ | ----------- | ------ | ----- |
| 1    | `applyTreePatch` + patch types             | Nothing     | Small  | 1     |
| 2    | Component map — Tier 1 (16)                | Nothing     | Small  | 1     |
| 3    | Component map — Tier 2 (10)                | Step 2      | Medium | 1     |
| 4    | `KumoCatalogRenderer`                      | Steps 1-3   | Medium | 1     |
| 5    | `useUITree` hook                           | Step 1      | Small  | 1     |
| 6    | Fix `initCatalog` + `resolveProps` + tests | Nothing     | Medium | 1     |
| 7    | Error boundary                             | Nothing     | Small  | 1     |
| 8    | Package exports + vite entry               | Steps 1-7   | Small  | 1     |
| 8b   | **Changeset**                              | Step 8      | Tiny   | 1     |
| 19   | UMD build configuration                    | Step 8      | Medium | 2     |
| 20   | `window.CloudflareKumo` mount API          | Step 19     | Medium | 2     |
| 21   | ThemeWrapper for cross-boundary            | Step 20     | Small  | 2     |
| 22   | Integration test — third-party HTML page   | Step 21     | Small  | 2     |
| 9    | Restructure `/streaming` + nav             | Nothing     | Small  | 3     |
| 10   | Mock data sequences                        | Step 1      | Small  | 3     |
| 11   | Chat demo component                        | Steps 4, 5  | Medium | 3     |
| 12   | Playground page                            | Step 11     | Small  | 3     |
| 13   | `diffUITree` function                      | Step 1      | Small  | 4     |
| 14   | API Worker (Workers AI)                    | Steps 4, 13 | Large  | 4     |
| 15   | `useCatalogStream` hook                    | Steps 5, 14 | Small  | 4     |
| 16   | Live mode toggle                           | Step 15     | Small  | 4     |
| 17   | Tier 3 components (6)                      | Step 4      | Large  | 5     |
| 18   | Tier 4 components (5)                      | Step 17     | Large  | 5     |
| 23   | A2UI-to-Patch translator                   | Step 1      | Medium | 6     |

Steps 1, 2, 5, 6, 7 have no dependencies on each other and can be done in parallel.

**Step 8b — Changeset** (required per AGENTS.md for any `packages/kumo/` change):

```bash
pnpm changeset
# Select @cloudflare/kumo, minor bump
# Summary: "Add catalog/react renderer — UITree patch system, component map, KumoCatalogRenderer, useUITree hook"
```

This must happen before push. The pre-push lefthook hook will reject without it.

### What NOT to Do

- **Don't create `packages/kumo-agent-ui/`** — No consumers yet. Premature abstraction.
- **Don't modify `ComponentSchema`** — Registry extensions with no consumer.
- **Don't depend on Vercel AI SDK** — UITree + SSE is lighter and works on Workers.
- **Don't copy GPL code from `a2ui-bridge`** — Take patterns only, write fresh.
- **Don't ask the LLM to generate patches** — Have it generate complete UITrees; diff
  server-side into JSONL patches.
- **Don't build the incremental JSON parser** — JSONL solves incomplete JSON. The 676-line
  parser in `kumo-provider/server.js` is unnecessary with JSONL streaming.
- **Don't maintain A2UI Kumo adapters separately** — They'll be replaced by the component
  map when the renderer is complete. A2UI becomes a wire format adapter, not a rendering
  layer.
- **Don't import all 38 components in the component map** — Use registration pattern.
- **Don't run** `pnpm version`, `pnpm release`, `pnpm publish:beta`,
  `pnpm release:production` — Per AGENTS.md.
- **Don't use `dark:` variants** — Per Kumo conventions, dark mode is automatic via
  `light-dark()` CSS custom properties.
- **Don't create component files manually** — `src/catalog/react/` is a new module, not a
  component; it doesn't go through `pnpm new:component`.
- **Don't edit auto-generated files** — `ai/schemas.ts`, `ai/component-registry.json`,
  `src/primitives/`, `src/styles/theme-kumo.css`.
- **Don't use module-level mutable state** — Component maps, renderer config, etc. must
  flow through React Context or function parameters. Global singletons break SSR.
- **Don't use `json-render` or any third-party JSON-to-UI rendering library** — It is a
  competitor. Kumo's catalog/react renderer is a first-party implementation purpose-built
  for the Kumo component system, semantic tokens, and streaming architecture. Third-party
  solutions cannot integrate with `component-registry.json`, `resolveProps`,
  `evaluateVisibility`, or the UITree patch format. Building this in-house is a strategic
  decision, not a convenience shortcut.

### Anti-Pattern Enforcement (Verification Commands)

After any implementation step, run these checks:

```bash
# No direct imports from kumo barrel inside catalog/react (tree-shaking violation)
rg "from ['\"]@cloudflare/kumo['\"]" packages/kumo/src/catalog/react/ --count
# Expected: 0 matches (or only in __tests__/ files)

# No dark: variants
rg "dark:" packages/kumo/src/catalog/react/ --count
# Expected: 0 matches

# No raw Tailwind colors
rg "(bg|text|border)-(red|blue|green|gray|slate|zinc|neutral|stone|orange|amber|yellow|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)-" packages/kumo/src/catalog/react/ --count
# Expected: 0 matches

# No module-level mutable state (Map, Set, let, var at top level)
rg "^(export )?(let|var) " packages/kumo/src/catalog/react/ --glob '!__tests__/*'
# Expected: 0 matches

# cn() used for all className composition
rg "className=" packages/kumo/src/catalog/react/ --glob '!__tests__/*' | rg -v "cn\(" | rg -v "className={" | rg -v "\.test\."
# Review manually — any className that's a string literal without cn() is suspect
```

---

## Validation Checklist

Use this checklist to verify the implementation at each step. Each item is a concrete,
testable assertion. **Verification gates** list the exact commands to run after each step.

### After Step 1 (Patches)

- [ ] `applyTreePatch` with `upsertElements` adds new elements and preserves identity of
      unchanged elements: `prev.elements["unchanged-key"] === next.elements["unchanged-key"]`
- [ ] `applyTreePatch` with `deleteElements` removes the element AND all its descendants
- [ ] `applyTreePatch` with `deleteElements` for the root key throws an error
- [ ] `applyTreePatch` with `setRoot` to a nonexistent key throws an error
- [ ] `applyTreePatch` with `appendChildren` adds keys to parent's `children` array
- [ ] `applyTreePatch` with `appendChildren` for nonexistent childKey throws
- [ ] `applyTreePatch` with `appendChildren` for childKey with existing parent throws
- [ ] `applyTreePatch` with `removeChildren` removes keys from parent's `children` array
- [ ] `applyTreePatch` with `removeChildren` for absent childKey is a no-op (idempotent)
- [ ] `applyTreePatch` with `removeChildren` leaves `children: []` not `undefined`
- [ ] `applyTreePatch` with `batch` applies all patches; if any throws, returns original tree
- [ ] `applyDataPatch` with `setData` sets the value at the correct path
- [ ] `applyDataPatch` with `replaceData` replaces the entire data model
- [ ] All patch functions are pure (no mutation of input)

**Verification gate:**

```bash
pnpm --filter @cloudflare/kumo test -- --grep "applyTreePatch\|applyDataPatch"
# Expect: all tests pass, 0 failures
pnpm --filter @cloudflare/kumo typecheck
# Expect: exit 0
```

### After Step 2 (Tier 1 Components)

- [ ] `createComponentMap({ Button })` returns a map where `map["Button"]` is a resolver
- [ ] Each Tier 1 resolver produces a React element of the correct component type
- [ ] `createPassthroughResolver(Button)` passes resolvedProps + children correctly
- [ ] `mergeComponentMaps(mapA, mapB)` gives mapB entries precedence
- [ ] Unknown component types are not in the map (no magic defaults)

**Verification gate:**

```bash
pnpm --filter @cloudflare/kumo test -- --grep "component-map\|createComponentMap\|createPassthroughResolver"
# Expect: all tests pass
pnpm --filter @cloudflare/kumo typecheck
# Expect: exit 0
```

### After Step 3 (Tier 2 Components)

- [ ] Tabs resolver passes `tabs` array directly, does NOT try to create sub-components
- [ ] Checkbox resolver converts `{ items: [{label, value}] }` to `Checkbox.Group` +
      `Checkbox.Item` children
- [ ] Radio resolver converts `{ items: [{label, value}] }` to `Radio.Group` + `Radio.Item`
- [ ] Breadcrumbs resolver converts `{ links: [...] }` to `Breadcrumbs.Link` +
      `Breadcrumbs.Current`
- [ ] Pagination resolver manages internal `page` state when no `setPage` prop provided

**Verification gate:**

```bash
pnpm --filter @cloudflare/kumo test -- --grep "Tier 2\|Tabs\|Checkbox\|Radio\|Breadcrumbs\|Pagination"
# Expect: all tests pass
pnpm --filter @cloudflare/kumo typecheck
# Expect: exit 0
```

### After Step 4 (Renderer)

- [ ] `KumoCatalogRenderer` renders a UITree with Tier 1 components correctly
- [ ] `components` prop is required (TypeScript error if omitted)
- [ ] Elements with `visible: false` are not rendered
- [ ] Elements with `visible: { path: "/some/path" }` resolve against `data` prop
- [ ] Dynamic props (`{ path: "/user/name" }`) are resolved before passing to components
- [ ] `element.children` array takes precedence over `props.children`
- [ ] `onAction` is called with resolved params when an element's action is triggered
- [ ] After successful action, `onSuccess.set` paths are applied to the data model
- [ ] After failed action, `onError.set` paths are applied to the data model
- [ ] A component that throws during render shows the error boundary fallback, siblings
      still render
- [ ] `React.memo` prevents re-render of elements whose reference hasn't changed

**Verification gate:**

```bash
pnpm --filter @cloudflare/kumo test -- --grep "KumoCatalogRenderer\|renderer"
# Expect: all tests pass
pnpm --filter @cloudflare/kumo typecheck
# Expect: exit 0
```

### After Step 5 (useUITree)

- [ ] `useUITree()` returns initial tree and data
- [ ] `applyPatch` triggers re-render with the updated tree
- [ ] `setData` updates a specific path in the data model
- [ ] `reset` returns to the initial tree and data

**Verification gate:**

```bash
pnpm --filter @cloudflare/kumo test -- --grep "useUITree"
# Expect: all tests pass
```

### After Step 6 (initCatalog + resolveProps Fixes)

- [ ] `await initCatalog(catalog)` resolves only after schemas are loaded
- [ ] `catalog.validateTree(validTree)` returns `{ success: true }` after init
- [ ] `catalog.validateTree(invalidTree)` returns `{ success: false }` with errors
- [ ] `resolveProps` resolves `{ path: "..." }` values inside arrays
- [ ] `resolveProps` resolves nested objects inside arrays
- [ ] `resolveProps` returns the **same object reference** when no dynamic values exist
- [ ] `resolveProps` returns a **new object** when dynamic values are resolved
- [ ] All existing `catalog.test.ts` tests continue to pass (no regressions)

**Verification gate:**

```bash
pnpm --filter @cloudflare/kumo test -- --grep "initCatalog\|catalog\|resolveProps"
# Expect: all tests pass (including existing + new tests)
pnpm --filter @cloudflare/kumo typecheck
# Expect: exit 0
```

### After Step 8 (Package Exports)

- [ ] `import { KumoCatalogRenderer } from "@cloudflare/kumo/catalog/react"` resolves
- [ ] `import { applyTreePatch } from "@cloudflare/kumo/catalog"` resolves (re-export)
- [ ] `pnpm --filter @cloudflare/kumo build` succeeds
- [ ] `pnpm --filter @cloudflare/kumo typecheck` succeeds
- [ ] `pnpm --filter @cloudflare/kumo test` passes
- [ ] `dist/catalog/react.js` exists after build
- [ ] `dist/catalog/react.js` does NOT bundle Zod (the react renderer has no need for it)

**Verification gate:**

```bash
pnpm --filter @cloudflare/kumo build && \
pnpm --filter @cloudflare/kumo typecheck && \
pnpm --filter @cloudflare/kumo test && \
ls packages/kumo/dist/catalog/react.js
# Expect: all succeed, file exists
pnpm lint
# Expect: exit 0

# Verify Zod is not bundled into the react renderer chunk:
rg "z\.object\|z\.string\|z\.enum\|z\.union\|z\.array" packages/kumo/dist/catalog/react.js --count
# Expect: 0 matches (Zod schemas belong in the catalog chunk, not the react renderer)
```

### After Step 8b (Changeset)

- [ ] A `.changeset/*.md` file exists with `@cloudflare/kumo` listed

**Verification gate:**

```bash
ls .changeset/*.md | head -5
# Expect: at least one file exists
grep -l "@cloudflare/kumo" .changeset/*.md
# Expect: at least one match
```

### After Step 11 (Chat Demo)

- [ ] `/playground` page loads and renders the chat demo
- [ ] Selecting a preset scenario plays the mock sequence
- [ ] UITree patches are applied incrementally (elements appear one by one)
- [ ] Split view shows raw JSON alongside rendered output
- [ ] Actions in the rendered UI trigger callbacks visible in the patch log
- [ ] The demo works on the static site (no server dependency)

**Verification gate:**

```bash
pnpm --filter @cloudflare/kumo-docs-astro build
# Expect: exit 0
# Manual: open dist/playground/index.html, verify demo loads
```

### After Step 12 (Playground Page)

- [ ] `/playground` is accessible and renders correctly
- [ ] Both `/streaming` and `/playground` appear in sidebar navigation
- [ ] `pnpm dev` serves both pages correctly
- [ ] `pnpm --filter @cloudflare/kumo-docs-astro build` succeeds

**Verification gate:**

```bash
pnpm --filter @cloudflare/kumo-docs-astro build
# Expect: exit 0
grep -r "playground" packages/kumo-docs-astro/src/components/SidebarNav.tsx
# Expect: at least one match
grep -r "streaming" packages/kumo-docs-astro/src/components/SidebarNav.tsx
# Expect: at least one match
```

### After Step 22 (Cross-Boundary Loadable — Phase 2)

- [ ] UMD build produces `component-loadable.umd.cjs`
- [ ] CSS build produces `stylesheet.css`
- [ ] `window.CloudflareKumo.renderFromJSON()` renders a simple component in test HTML
- [ ] `window.CloudflareKumo.setTheme('dark')` switches theme across components
- [ ] Bundle size is reasonable (< 500KB gzipped for kitchen-sink build)

**Verification gate:**

```bash
pnpm --filter @cloudflare/kumo build:loadable && \
ls packages/kumo/dist/loadable/component-loadable.umd.cjs && \
ls packages/kumo/dist/loadable/stylesheet.css
# Expect: all succeed, files exist
gzip -c packages/kumo/dist/loadable/component-loadable.umd.cjs | wc -c
# Expect: < 512000 bytes (500KB)
```

### After Step 13 (diffUITree — Phase 4)

- [ ] `diffUITree(tree, tree)` returns `[]` (identical trees produce no patches)
- [ ] `diffUITree(a, b)` patches applied to `a` produce tree equivalent to `b`
- [ ] Added elements produce `upsertElements` patch
- [ ] Removed elements produce `deleteElements` patch
- [ ] Changed elements produce `upsertElements` with only the changed elements
- [ ] Root change produces `setRoot` patch

**Verification gate:**

```bash
pnpm --filter @cloudflare/kumo test -- --grep "diffUITree"
# Expect: all tests pass
```

### Cross-Cutting Validations

Run after **every** step:

```bash
# Full validation suite
pnpm --filter @cloudflare/kumo typecheck && \
pnpm lint && \
pnpm --filter @cloudflare/kumo test

# Anti-pattern checks (see "Anti-Pattern Enforcement" section above)
rg "dark:" packages/kumo/src/catalog/react/ --count        # Expect: 0
rg "from ['\"]@cloudflare/kumo['\"]" packages/kumo/src/catalog/react/ \
  --glob '!__tests__/*' --count                              # Expect: 0
```

- [ ] No `dark:` variant classes in any new file
- [ ] All className composition uses `cn()` utility
- [ ] All semantic tokens use `kumo-*` prefix (no raw Tailwind colors)
- [ ] No `bg-blue-500`, `text-gray-*`, etc.
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] A changeset exists for changes to `packages/kumo/`

---

## Agent Self-Verification Protocol

The per-step verification gates in the Validation Checklist verify step-specific correctness.
But an executing agent also needs to detect **regressions** (Step 4 breaking Step 1's tests)
and verify **build artifacts** (not just test results). This protocol defines what an agent
must run after every step, regardless of step-specific gates.

### Mandatory After Every Step

```bash
# 1. Full type + lint + test suite (catches regressions across steps)
pnpm --filter @cloudflare/kumo typecheck && \
pnpm --filter @cloudflare/kumo test && \
pnpm lint
```

If any command fails, the agent MUST fix the issue before proceeding. Do not move to the
next step with a red suite.

### Mandatory After Step 8 (Build Config) and All Subsequent Steps

Once the build entry point exists, verify the artifact:

```bash
# 2. Build and verify artifact exists
pnpm --filter @cloudflare/kumo build && \
ls -la packages/kumo/dist/catalog/react.js

# 3. Verify Zod is not bundled into the react chunk
rg "z\.object\|z\.string\|z\.enum\|z\.union\|z\.array" packages/kumo/dist/catalog/react.js --count
# Expected: 0 matches

# 4. Verify exports resolve (run from repo root)
node --input-type=module -e "
  import { pathToFileURL } from 'url';
  const pkg = await import(pathToFileURL('packages/kumo/dist/catalog/react.js'));
  const keys = Object.keys(pkg);
  console.log('Exports:', keys.join(', '));
  const required = ['KumoCatalogRenderer', 'applyTreePatch', 'useUITree', 'createComponentMap'];
  const missing = required.filter(k => !keys.includes(k));
  if (missing.length) { console.error('MISSING:', missing); process.exit(1); }
  console.log('All required exports present');
"
```

### Anti-Pattern Sweep (Run After Any File Creation/Modification)

```bash
# No dark: variants in new code
rg "dark:" packages/kumo/src/catalog/react/ --count 2>/dev/null
# Expected: 0 or no output

# No barrel imports from kumo in implementation (only allowed in __tests__/)
rg "from ['\"]@cloudflare/kumo['\"]" packages/kumo/src/catalog/react/ --glob '!__tests__/*' --count 2>/dev/null
# Expected: 0 or no output

# No raw Tailwind colors
rg "(bg|text|border)-(red|blue|green|gray|slate|zinc|neutral)-" packages/kumo/src/catalog/react/ --count 2>/dev/null
# Expected: 0 or no output

# No module-level mutable state
rg "^(export )?(let|var) " packages/kumo/src/catalog/react/ --glob '!__tests__/*' 2>/dev/null
# Expected: 0 or no output
```

### Phase Gate (Before Starting Phase 2 — Cross-Boundary Loadable)

All Phase 1 steps must pass their individual verification gates AND:

```bash
pnpm --filter @cloudflare/kumo build && \
pnpm --filter @cloudflare/kumo typecheck && \
pnpm --filter @cloudflare/kumo test && \
pnpm lint && \
ls packages/kumo/dist/catalog/react.js && \
grep -l "@cloudflare/kumo" .changeset/*.md
# ALL must succeed
```

Failures at this gate block Phase 2.

### Phase Gate (Before Starting Phase 3 — Docs Demo)

Phase 1 must be complete. Phase 2 (loadable) is NOT required for the docs demo — the demo
uses the renderer directly, not the UMD bundle. Phases 2 and 3 can proceed in parallel.

```bash
pnpm --filter @cloudflare/kumo build && \
pnpm --filter @cloudflare/kumo typecheck && \
pnpm --filter @cloudflare/kumo test && \
pnpm lint
# ALL must succeed
```
