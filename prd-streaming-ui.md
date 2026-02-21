# PRD: Streaming UI as First-Class Library Infrastructure

**Date:** 2026-02-21
**Branch:** `geoquant/streaming-ui`

> **CRITICAL — BRANCH POLICY:** All work MUST happen on the `geoquant/streaming-ui` branch. Do NOT create new branches. This branch already exists and contains prior work. Rebase onto main as needed but never fork off sub-branches.

---

## Problem Statement

### What problem are we solving?

Kumo has a working proof-of-concept (`_examples/kumo-stream/`) proving that LLMs can stream UI components via JSONL RFC 6902 patches. But this lives as an isolated example app — ~20 core files, a custom server, hand-maintained component mappings. Any team wanting to build generative UI with Kumo must copy these files and reverse-engineer the architecture.

Meanwhile, the docs site (`kumo-ui.com`) has a `/streaming` page documenting the catalog module but no live demo, no working AI integration, and no way for visitors to see what AI-driven Kumo UI actually looks like.

### Why now?

"Components Will Kill Pages." AI chat interfaces are replacing traditional page navigation. Users increasingly expect to type a question and get a visual, interactive answer — not navigate 5 pages deep. Kumo needs to be the first design system that ships AI-native infrastructure: system prompts, streaming renderers, component mappings, and a UMD bundle that any HTML page can `<script>` tag.

The proof-of-concept is done. The architecture is validated. Now it's time to ship it as library infrastructure.

### Who is affected?

- **Primary users:** Developers building AI/generative UI applications with Kumo — they need streaming primitives, a rendering runtime, and system prompts out of the box
- **Secondary users:** Docs site visitors — they should see a live demo of AI-generated Kumo UI to understand the capability
- **Tertiary users:** Non-React consumers — HTML pages, Wordpress sites, any page that can load a `<script>` tag should be able to render AI-generated Kumo components

---

## Proposed Solution

### Overview

Ship 5 new capabilities across `@cloudflare/kumo` and `@cloudflare/kumo-docs-astro` that extract the proven kumo-stream architecture into reusable library infrastructure:

1. **`@cloudflare/kumo/streaming`** — Core streaming engine (JSONL parser, RFC 6902 patch engine, `useUITree` hook, action system, runtime value store)
2. **`@cloudflare/kumo/generative`** — Rendering runtime (UITreeRenderer, auto-generated component map, auto-generated stateful wrappers, element validator)
3. **`@cloudflare/kumo/loadable`** — UMD bundle exposing `window.CloudflareKumo` API (React bundled inside, any HTML page can use it)
4. **Enhanced `catalog.generatePrompt()`** — Full system prompt generation with JSONL format instructions, scored/filtered component props, category grouping, examples
5. **Docs site live demo** — Workers AI backend (`@cf/zai-org/glm-4.7-flash`), SSE streaming endpoint, interactive chat demo on `/streaming` page

### User Experience

#### User Flow: Developer using streaming in a React app

1. Developer installs `@cloudflare/kumo` (already a dependency)
2. Imports `useUITree`, `createJSONLParser` from `@cloudflare/kumo/streaming`
3. Imports `UITreeRenderer`, `COMPONENT_MAP` from `@cloudflare/kumo/generative`
4. Calls `catalog.generatePrompt()` to get the system prompt for their LLM
5. Connects their LLM stream → parser → `useUITree` → `<UITreeRenderer>`
6. Kumo components render progressively as the LLM streams

#### User Flow: Developer using UMD in a plain HTML page

1. Adds `<script src="@cloudflare/kumo/loadable/kumo-loadable.umd.js">` and `<link>` for CSS
2. Calls `CloudflareKumo.createParser()` to get a JSONL parser
3. Feeds SSE stream chunks through the parser
4. Calls `CloudflareKumo.applyPatchesBatched(ops, "container-id")` to render
5. Kumo components appear inside the target div, fully styled

#### User Flow: Docs site visitor

1. Navigates to `/streaming` on kumo-ui.com
2. Sees a live chat interface with preset prompt pills ("Show me a user card", "Build a settings form")
3. Types a prompt or clicks a preset
4. Watches Kumo components stream in progressively from Workers AI
5. Scrolls down for documentation: quick start code, UMD approach, component map reference, action system

---

## End State

When this PRD is complete, the following will be true:

- [ ] `@cloudflare/kumo/streaming` exports core streaming primitives (JSONL parser, RFC 6902 engine, useUITree hook, action system, runtime value store)
- [ ] `@cloudflare/kumo/generative` exports UITreeRenderer + auto-generated component map covering all 37+ registry components + auto-generated stateful wrappers for controlled-only components
- [ ] `@cloudflare/kumo/loadable` ships a UMD bundle (`window.CloudflareKumo`) with React bundled inside, consumable via `<script>` tag
- [ ] `catalog.generatePrompt()` returns a comprehensive, model-agnostic system prompt with JSONL format instructions, component props (scored/filtered), examples, and action system docs
- [ ] The docs site (`kumo-ui.com/streaming`) has a live interactive chat demo powered by Workers AI (`@cf/zai-org/glm-4.7-flash`)
- [ ] A drift-detection test (mirroring Figma's pattern) ensures every registry component has a generative map entry
- [ ] Codegen pipeline auto-generates component-map and stateful wrappers — new components added via `pnpm new:component` automatically appear
- [ ] All existing `@cloudflare/kumo` exports and docs site pages are unaffected
- [ ] All new modules are tree-shakeable — consumers not using AI pay zero bundle cost
- [ ] One changeset, one minor version bump for all library changes

---

## Success Metrics

### Quantitative

| Metric                            | Current                       | Target                                                | Measurement Method           |
| --------------------------------- | ----------------------------- | ----------------------------------------------------- | ---------------------------- |
| Export paths for AI/streaming     | 2 (`/catalog`, `/ai/schemas`) | 5 (+ `/streaming`, `/generative`, `/loadable`)        | `package.json` exports count |
| Component map coverage            | 0% (no map in library)        | 100% of registry components                           | Drift detection test         |
| `generatePrompt()` output quality | ~20 lines, names only         | Full prompt with props, examples, format instructions | Token count + manual review  |
| UMD bundle size                   | N/A                           | < 500KB gzipped                                       | `vite build` output          |
| Docs site streaming demo          | No demo                       | Live interactive chat                                 | Manual verification          |
| Ported test coverage              | 0 tests in kumo               | 19+ streaming tests ported                            | `pnpm test` pass count       |

### Qualitative

- Developers can build a streaming AI UI app with Kumo in < 30 minutes using library exports
- Non-React pages can render AI-generated Kumo components via a single `<script>` tag
- Docs site visitors immediately understand what "AI-native design system" means through the live demo

---

## Acceptance Criteria

### Feature: Core Streaming Engine (`@cloudflare/kumo/streaming`)

- [ ] `import { createJSONLParser, applyPatch, useUITree } from "@cloudflare/kumo/streaming"` resolves
- [ ] JSONL parser: `push(chunk)` returns `JsonPatchOp[]`, skips unparseable lines gracefully
- [ ] RFC 6902 engine: immutable `applyPatch(tree, op)` for add/replace/remove operations
- [ ] `useUITree()` hook: manages UITree state, applies patches via functional setState
- [ ] Action system: `ActionHandlerMap` with builtins (submit_form, navigate, increment, decrement)
- [ ] Runtime value store: captures user-entered form values from uncontrolled inputs
- [ ] URL policy: allowlist http/https/relative, block javascript/data/file schemes
- [ ] `streaming/types.ts` re-exports UITree, UIElement, Action from `catalog`
- [ ] All 19+ ported tests pass in kumo's vitest environment
- [ ] Zero new dependencies added
- [ ] Tree-shakeable: importing `createJSONLParser` alone doesn't pull React

### Feature: Rendering Runtime (`@cloudflare/kumo/generative`)

- [ ] `import { UITreeRenderer, COMPONENT_MAP } from "@cloudflare/kumo/generative"` resolves
- [ ] Component map has entries for all 37+ registry components
- [ ] Stateful wrappers auto-generated for controlled-only components (Select, Checkbox, Switch, Tabs, Collapsible)
- [ ] UITreeRenderer: recursive rendering with error boundaries, streaming tolerance (missing children = null)
- [ ] Element validator: Zod schema validation, invalid elements render warning box (no crash)
- [ ] Generative wrappers: Surface gets `rounded-lg p-6`, Input/InputArea get `w-full`
- [ ] `pnpm codegen:registry` regenerates component-map and stateful-wrappers
- [ ] Drift detection test passes: every registry component has a map entry

### Feature: UMD Bundle (`@cloudflare/kumo/loadable`)

- [ ] `<script>` tag exposes `window.CloudflareKumo`
- [ ] `CloudflareKumo.applyPatch(op, containerId)` renders Kumo components
- [ ] `CloudflareKumo.createParser()` returns a working JSONL parser
- [ ] `CloudflareKumo.setTheme("dark")` toggles theme
- [ ] Shadow DOM mount mode supported via `CloudflareKumo.configureContainer(id, { mount: "shadow-root" })`
- [ ] Bundle < 500KB gzipped
- [ ] CSS file includes all Kumo component styles

### Feature: Enhanced `generatePrompt()`

- [ ] Returns prompt with JSONL/RFC6902 format instructions
- [ ] Component props: filtered (no className/id/on*/aria-*), scored (required > enum > interesting), top 10 per component
- [ ] Components grouped by category (Layout, Content, Interactive, Data Display, Navigation, Action, Feedback)
- [ ] Sub-component documentation (Select.Option, Table.Row, Breadcrumbs.Link, etc.)
- [ ] Includes 2+ working examples (counter UI, form)
- [ ] Action system documentation (builtins + custom)
- [ ] `generatePrompt({ components: ["Button", "Input"] })` returns subset
- [ ] Full prompt < 15K tokens
- [ ] Backwards compatible: no-args call still works

### Feature: Docs Site Streaming Demo

- [ ] `@astrojs/cloudflare@^12.2.1` adapter installed, Astro 5 retained
- [ ] `POST /api/chat` endpoint: SSR route, streams from Workers AI, rate limited 20 req/min/IP
- [ ] Bindings accessed via `Astro.locals.runtime.env` (Astro 5 pattern)
- [ ] Live chat demo on `/streaming`: interactive, theme-aware, preset prompts
- [ ] "Streaming UI" in sidebar navigation
- [ ] Copy-pasteable UMD/HTML example on page
- [ ] Existing static pages unaffected
- [ ] Graceful degradation if Workers AI unavailable

### Feature: Drift Prevention

- [ ] `tests/generative/drift-detection.test.ts`: every registry component has a map entry
- [ ] Test catches stale map entries not in registry
- [ ] Test verifies stateful wrappers exist for all controlled-only components
- [ ] Codegen staleness check: fails if generated files differ from checked-in versions

---

## Technical Context

### Existing Patterns

- **Component registry codegen:** `packages/kumo/scripts/component-registry/` — 13 sub-modules, parallel batch processing, cache-based incremental builds. The generative map codegen extends this pipeline.
- **Figma drift detection:** `packages/kumo-figma/src/generators/drift-detection.test.ts` — 1395-line test asserting registry→generator coverage. The generative drift test mirrors this pattern.
- **Catalog module:** `packages/kumo/src/catalog/` — existing `createKumoCatalog()`, `initCatalog()`, `generatePrompt()`, `validateTree()`. The prompt enhancement extends this existing API.
- **Kumo-stream example:** `_examples/kumo-stream/` — 20+ core files, 19+ tests, 7 ADRs. This is the proven source code being extracted into the library.
- **Package exports pattern:** `packages/kumo/package.json` has 35+ export paths following `"./path": { "types": ..., "import": ... }` pattern.

### Key Files

- `_examples/kumo-stream/src/core/` — All streaming core modules to be ported (jsonl-parser, rfc6902, UITreeRenderer, component-map, stateful-wrappers, hooks, action-\*, runtime-value-store, url-policy, text-sanitizer)
- `_examples/kumo-stream/src/loadable/` — UMD entry point, action dispatch, theme wrapper
- `_examples/kumo-stream/src/core/system-prompt.ts` — JSONL/RFC6902 system prompt template
- `_examples/kumo-stream/src/core/system-prompt-components.ts` — Prop scoring, filtering, grouping logic for prompt generation
- `packages/kumo/src/catalog/catalog.ts` — Current barebones `generatePrompt()` to be enhanced
- `packages/kumo/scripts/component-registry/` — Codegen pipeline to be extended
- `packages/kumo/vite.config.ts` — Build config needing new entry points
- `packages/kumo/package.json` — Export map needing new paths
- `packages/kumo-docs-astro/astro.config.mjs` — Needs Cloudflare adapter
- `packages/kumo-docs-astro/wrangler.jsonc` — Needs AI + rate limit bindings
- `packages/kumo-docs-astro/src/pages/streaming.astro` — Existing page to enhance
- `packages/kumo-docs-astro/src/components/SidebarNav.tsx` — Needs "Streaming UI" entry

### System Dependencies

- **Workers AI:** `@cf/zai-org/glm-4.7-flash` model, bound via `ai` binding in wrangler.jsonc
- **Cloudflare Rate Limiting API:** `rate_limits` binding for IP-based rate limiting
- **`@astrojs/cloudflare@^12.2.1`:** Astro 5 compatible SSR adapter
- **No new npm dependencies** for the kumo library itself (streaming modules are dependency-free)

---

## Risks & Mitigations

| Risk                                            | Likelihood | Impact | Mitigation                                                                                                                                                                                                                 |
| ----------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GLM-4.7-Flash emits malformed JSONL             | Medium     | High   | Parser skips unparseable lines gracefully (proven in kumo-stream). Element validator catches bad props via Zod. `response_format: { type: "json_object" }` as additional nudge. Model-agnostic prompts allow future swaps. |
| UMD bundle exceeds 500KB gzipped                | Low        | Medium | React 18 ~40KB gzipped. Kumo components tree-shake. If exceeded, use dynamic component loading or lazy imports.                                                                                                            |
| Astro SSR adapter breaks static pages           | Low        | High   | Astro 5 defaults to static. Only routes with `export const prerender = false` are SSR. Explicit opt-in, not opt-out.                                                                                                       |
| Codegen for component map mishandles edge cases | Medium     | Medium | Snapshot tests for generated output. Configuration escape hatch (`STATEFUL_WRAPPER_CONFIG`). Drift detection test catches missing entries.                                                                                 |
| Workers AI cost escalation from docs abuse      | Low        | Low    | Rate limit 20 req/min/IP. Design Engineering org account. Turnstile can be added later.                                                                                                                                    |
| Component map drift when new components added   | Medium     | High   | 3-layer prevention: codegen auto-generates, drift test catches missing entries, staleness check in CI.                                                                                                                     |

---

## Alternatives Considered

### Alternative 1: Core primitives only (no rendering runtime)

- **Description:** Ship only the JSONL parser, RFC 6902 engine, and useUITree hook. Let consumers build their own renderer and component map.
- **Pros:** Smaller surface area, less maintenance, more flexible
- **Cons:** Every consumer reinvents the renderer. Component map maintenance burden shifts to each team. Defeats "easy to build agent apps" goal.
- **Decision:** Rejected. The vision is a complete, turnkey generative UI experience.

### Alternative 2: Separate `@cloudflare/kumo-streaming` package

- **Description:** New package for all streaming/generative infrastructure instead of new export paths on `@cloudflare/kumo`.
- **Pros:** Clean separation, independent versioning, no risk to main package
- **Cons:** Extra install step, version coordination headaches, component map can't import from `@cloudflare/kumo` without circular dep issues.
- **Decision:** Rejected. Tree-shakeable export paths achieve the same isolation with simpler DX.

### Alternative 3: Upgrade to Astro 6 for cleaner binding access

- **Description:** Upgrade docs site from Astro 5 to Astro 6 to use `import { env } from 'cloudflare:workers'` syntax.
- **Pros:** Cleaner API, future-proof
- **Cons:** Breaking upgrade risk, adapter v13.x required, existing pages may break, not necessary for functionality
- **Decision:** Rejected for now. `@astrojs/cloudflare@12.x` works with Astro 5. `Astro.locals.runtime.env` is fine.

### Alternative 4: Hand-maintained component map

- **Description:** Manually maintain the component map in the library, similar to kumo-stream.
- **Pros:** Simple, explicit, no codegen complexity
- **Cons:** 37+ entries that must stay in sync with registry. Every new component requires manual update. Proven drift problem in kumo-figma.
- **Decision:** Rejected. Auto-generation + drift tests is the only sustainable approach at this scale.

---

## Non-Goals (v1)

- **DPU (Declarative Partial Updates) mode** — Experimental server-side HTML snapshot streaming. Deferred to v2 after JSONL streaming is proven.
- **Multi-model testing harness** — Automated testing across different LLM providers. Ship with GLM-4.7-Flash, test others manually.
- **Turnstile / auth for docs chat** — "Abuse controls later" (Sunil). Rate limiting is sufficient for v1.
- **Component-level code splitting in UMD** — Bundle all components. Dynamic loading deferred unless bundle exceeds 500KB.
- **Astro 6 upgrade** — Stay on Astro 5. Upgrade is independent work.
- **Custom action handlers in docs demo** — Demo uses built-in actions only. Custom action registration documented but not demoed.

---

## Interface Specifications

### API: `@cloudflare/kumo/streaming`

```ts
// JSONL Parser
function createJSONLParser(): {
  push(chunk: string): JsonPatchOp[];
  flush(): JsonPatchOp[];
};

// RFC 6902
function applyPatch(tree: UITree, op: JsonPatchOp): UITree;
function applyPatches(tree: UITree, ops: JsonPatchOp[]): UITree;

// React Hook
function useUITree(options?: { batchWithRAF?: boolean }): {
  tree: UITree;
  applyPatch(op: JsonPatchOp): void;
  applyPatches(ops: JsonPatchOp[]): void;
  reset(): void;
};

// Action System
type ActionResult = PatchResult | MessageResult | ExternalResult | NoneResult;
function createActionHandler(
  handlers: ActionHandlerMap,
): (event: ActionEvent) => ActionResult;
function processActionResult(
  result: ActionResult,
  callbacks: ActionCallbacks,
): void;

// Runtime Value Store
function createRuntimeValueStore(): RuntimeValueStore;
```

### API: `@cloudflare/kumo/generative`

```ts
// Renderer
function UITreeRenderer(props: {
  tree: UITree;
  componentMap?: Record<string, React.ComponentType>;
  onAction?: (event: ActionEvent) => void;
}): React.ReactElement;

// Component Map (auto-generated)
const COMPONENT_MAP: Record<string, React.ComponentType>;
const KNOWN_TYPES: Set<string>;
```

### API: `window.CloudflareKumo` (UMD)

```ts
interface CloudflareKumo {
  applyPatch(op: JsonPatchOp, containerId: string): void;
  applyPatches(ops: JsonPatchOp[], containerId: string): void;
  applyPatchBatched(op: JsonPatchOp, containerId: string): void;
  applyPatchesBatched(ops: JsonPatchOp[], containerId: string): void;
  renderTree(tree: UITree, containerId: string): void;
  createParser(): {
    push(chunk: string): JsonPatchOp[];
    flush(): JsonPatchOp[];
  };
  setTheme(mode: "light" | "dark"): void;
  getTree(containerId: string): UITree | undefined;
  getRuntimeValues(containerId: string): Record<string, unknown>;
  onAction(handler: (event: ActionEvent) => void): () => void;
  reset(containerId: string): void;
  configureContainer(
    id: string,
    config: { mount: "light-dom" | "shadow-root" },
  ): void;
}
```

### API: Enhanced `generatePrompt()`

```ts
catalog.generatePrompt(options?: {
  format?: "jsonl" | "json";
  maxPropsPerComponent?: number;
  includeExamples?: boolean;
  components?: string[];
}): string;
```

### API: Docs chat endpoint

```
POST /api/chat
Request: { message: string; history?: Array<{ role: string; content: string }> }
Response: SSE stream (text/event-stream)
  data: {"response":"...token..."}\n\n
  data: [DONE]\n\n
Errors:
  429 — Rate limited (20 req/min/IP)
  500 — Workers AI unavailable
```

---

## Documentation Requirements

- [ ] `/streaming` page updated with live demo, quick start, UMD approach, component map reference, action system docs
- [ ] "Streaming UI" added to sidebar navigation
- [ ] Copy-pasteable HTML/UMD example on streaming page
- [ ] `generatePrompt()` options documented on streaming page
- [ ] Existing catalog documentation on `/streaming` preserved

---

## Open Questions

| Question | Owner | Due Date | Status                  |
| -------- | ----- | -------- | ----------------------- |
| None     | —     | —        | All resolved (see spec) |

---

## Appendix

### Glossary

- **JSONL:** Newline-delimited JSON. Each line is independently parseable.
- **RFC 6902:** JSON Patch standard. Operations: add, replace, remove on JSON Pointer paths.
- **UITree:** Flat element map `{ root: string, elements: Record<string, UIElement> }`. Optimized for streaming — elements can be added progressively.
- **DPU:** Declarative Partial Updates. Server-side HTML snapshot streaming via `<template>` tags. Deferred to v2.
- **Stateful wrappers:** `useState` wrappers around controlled-only Kumo components (Select, Checkbox, etc.) so they work in generative UI without explicit state management.
- **Component map:** `Record<string, React.ComponentType>` mapping UITree element `type` strings to actual React components.

### References

- Spec: `specs/streaming-ui-library.md`
- kumo-stream ADRs: `_examples/kumo-stream/decisions/`
- kumo-stream specs: `_examples/kumo-stream/specs/`
- Figma drift test: `packages/kumo-figma/src/generators/drift-detection.test.ts`
- "Components Will Kill Pages" blog post (2026-02-10)
