# Spec: Streaming UI as First-Class Library Infrastructure

**Status:** Ready for Implementation
**Type:** Feature Plan
**Effort:** XL (5-8 days)
**Author:** spec-planner
**Date:** 2026-02-21
**Branch:** `geoquant/streaming-ui`

> **CRITICAL — BRANCH POLICY:** All work for this spec MUST happen on the `geoquant/streaming-ui` branch. Do NOT create new branches. All deliverables (D1–D5), all PRDs, all tasks commit directly to `geoquant/streaming-ui`. This branch already exists and contains prior work. Rebase onto main as needed but never fork off sub-branches.

---

## Problem Definition

Kumo has a working proof-of-concept (`_examples/kumo-stream/`) demonstrating AI-driven streaming UI: an LLM emits JSONL RFC 6902 patches that progressively render Kumo components. But this lives as an example app, not as library infrastructure. Consumers wanting to build generative UI applications must copy ~20 files and reverse-engineer the architecture.

**The vision:** Kumo becomes the first AI-native design system. Components are consumable not just by developers writing JSX, but by LLMs generating UI at runtime. The streaming pipeline, component mappings, system prompts, and rendering runtime should ship as part of `@cloudflare/kumo` so any consumer can build generative UI apps with minimal effort.

**Cost of not solving:** Every team building AI UI with Kumo reinvents the same plumbing. The docs site can't demonstrate the capability. Kumo misses the "Components Will Kill Pages" moment.

---

## Constraints

| Constraint                    | Detail                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Backwards compatibility**   | No breaking changes to existing `@cloudflare/kumo` exports                                                                |
| **Bundle size**               | Streaming/generative modules must be tree-shakeable; consumers not using AI pay nothing                                   |
| **Model agnostic**            | System prompts must work across LLMs (Workers AI, Anthropic, OpenAI). Start with `@cf/zai-org/glm-4.7-flash`              |
| **Docs site deployment**      | Astro 5.x static on Workers. Adding AI chat requires `@astrojs/cloudflare@12.x` adapter + AI binding. No Astro 6 upgrade. |
| **No secrets in client**      | Workers AI accessed server-side only. No API keys in browser                                                              |
| **Design Engineering org**    | Account `61e3887ff0554f81e1e175d106c3926f`. Workers AI bound to this account                                              |
| **Existing codegen pipeline** | Must extend, not replace, the component-registry codegen                                                                  |

---

## Solution: 5 Deliverables

### Overview

```
@cloudflare/kumo
├── /streaming      ← [D1] Core streaming engine (JSONL parser, RFC6902, useUITree)
├── /generative     ← [D2] Rendering runtime (UITreeRenderer, component-map, stateful wrappers)
├── /loadable       ← [D3] UMD bundle (script-tag consumable, React bundled inside)
└── /catalog        ← [D4] Enhanced generatePrompt() (full system prompt generation)

@cloudflare/kumo-docs-astro
└── /streaming page ← [D5] Live interactive demo + documentation (Workers AI backend)
```

---

### D1: `@cloudflare/kumo/streaming` — Core Streaming Engine (M)

**What:** Extract framework-agnostic streaming primitives from `kumo-stream/src/core/` into `packages/kumo/src/streaming/`.

**Files to create in `packages/kumo/src/streaming/`:**

| File                              | Source                                                 | Purpose                                                                                  |
| --------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `jsonl-parser.ts`                 | `kumo-stream/src/core/jsonl-parser.ts`                 | Stateful streaming JSONL line parser. `push(chunk)` returns complete `JsonPatchOp[]`     |
| `rfc6902.ts`                      | `kumo-stream/src/core/rfc6902.ts`                      | Immutable RFC 6902 JSON Patch engine (add/replace/remove). Operates on `UITree`          |
| `hooks.ts`                        | `kumo-stream/src/core/hooks.ts`                        | `useUITree()` React hook — manages UITree state, applies patches via functional setState |
| `runtime-value-store.ts`          | `kumo-stream/src/core/runtime-value-store.ts`          | Per-container `Map<string, unknown>` for capturing user-entered form values              |
| `runtime-value-store-context.tsx` | `kumo-stream/src/core/runtime-value-store-context.tsx` | React context provider for runtime value store                                           |
| `action-registry.ts`              | `kumo-stream/src/core/action-registry.ts`              | `ActionHandlerMap`, builtin handlers (submit_form, navigate, increment, decrement)       |
| `action-handler.ts`               | `kumo-stream/src/core/action-handler.ts`               | `ActionEvent` type, `createActionHandler()`, `createClickHandler()`                      |
| `process-action-result.ts`        | `kumo-stream/src/core/process-action-result.ts`        | Maps `ActionResult` union (patch/message/external/none) to side effects                  |
| `url-policy.ts`                   | `kumo-stream/src/core/url-policy.ts`                   | URL scheme allowlist (http/https/relative only)                                          |
| `text-sanitizer.ts`               | `kumo-stream/src/core/text-sanitizer.ts`               | Strips leading emoji from LLM text output                                                |
| `types.ts`                        | `kumo-stream/src/core/types.ts`                        | Re-exports from `catalog` + streaming-specific types (`JsonPatchOp`, `StreamingOptions`) |
| `index.ts`                        | —                                                      | Barrel export                                                                            |

**Export path:** `@cloudflare/kumo/streaming`

**package.json entry:**

```json
"./streaming": {
  "types": "./dist/src/streaming/index.d.ts",
  "import": "./dist/streaming.js"
}
```

**vite.config.ts entry:**

```ts
streaming: resolve(__dirname, "src/streaming/index.ts"),
```

**Tests:** Port the 19 test files from `kumo-stream/src/__tests__/` that cover these modules. Target: 100% of existing test coverage maintained.

**Acceptance criteria:**

- [ ] `import { createJSONLParser, applyPatch, useUITree } from "@cloudflare/kumo/streaming"` works
- [ ] All ported tests pass in kumo's vitest environment
- [ ] Zero new dependencies added to kumo (these modules are dependency-free)
- [ ] Tree-shakeable: importing only `createJSONLParser` doesn't pull in React hooks

---

### D2: `@cloudflare/kumo/generative` — Rendering Runtime (L)

**What:** Ship UITreeRenderer, auto-generated component map, and stateful wrappers as library exports.

**Files to create in `packages/kumo/src/generative/`:**

| File                      | Source                                      | Purpose                                                                                 |
| ------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------- |
| `UITreeRenderer.tsx`      | `kumo-stream/src/core/UITreeRenderer.tsx`   | Recursive renderer: resolves types to components, error boundaries, streaming tolerance |
| `element-validator.ts`    | `kumo-stream/src/core/element-validator.ts` | Validates element props against Zod schemas before rendering                            |
| `component-map.ts`        | **auto-generated**                          | `COMPONENT_MAP: Record<string, React.ComponentType>` — generated by codegen             |
| `stateful-wrappers.tsx`   | **auto-generated**                          | `useState` wrappers for controlled-only components — generated by codegen               |
| `generative-wrappers.tsx` | —                                           | Thin wrappers that add default styles (e.g., `GenerativeSurface` with `rounded-lg p-6`) |
| `index.ts`                | —                                           | Barrel export: `{ UITreeRenderer, COMPONENT_MAP, KNOWN_TYPES }`                         |

**Auto-generation strategy for `component-map.ts`:**

Extend `scripts/component-registry/` codegen to emit:

1. **Component map** — derive from `component-registry.json`:
   - Direct mappings: `type → Component` for simple components
   - Sub-component flattening: `TableHeader → Table.Header`, `BreadcrumbsLink → Breadcrumbs.Link`
   - Type aliases: `Textarea → InputArea`, `RadioGroup → Radio.Group`

2. **Stateful wrappers** — detect controlled-only components from the registry:
   - **Heuristic:** Component has `value`/`checked`/`open` prop marked required + corresponding `onValueChange`/`onCheckedChange`/`onOpenChange` callback but no `defaultValue`/`defaultChecked`/`defaultOpen`
   - **Template:** For each, generate a wrapper following the pattern in `kumo-stream/src/core/stateful-wrappers.tsx`:
     ```tsx
     function StatefulX(props) {
       const [state, setState] = useState(props.defaultX ?? initialValue);
       // runtime value store integration
       // onAction callback
       return <X {...props} x={state} onXChange={setState} />;
     }
     ```
   - **Configuration escape hatch:** A `STATEFUL_WRAPPER_CONFIG` object in the codegen metadata for overrides (initial values, extra props, display defaults)

3. **Generative wrappers** — maintain a small hand-written config:
   ```ts
   const GENERATIVE_DEFAULTS = {
     Surface: { className: "rounded-lg p-6" },
     Input: { className: "w-full" },
     InputArea: { className: "w-full" },
     CloudflareLogo: { width: 120, height: 40 },
   };
   ```

**New codegen script:** `scripts/component-registry/generative-map-generator.ts`

- Input: `component-registry.json` + stateful wrapper config
- Output: `src/generative/component-map.ts` + `src/generative/stateful-wrappers.tsx`
- Run as part of `pnpm codegen:registry`
- `PLOP_INJECT_GENERATIVE_ENTRY` marker for scaffolding

**Export path:** `@cloudflare/kumo/generative`

**Acceptance criteria:**

- [ ] `import { UITreeRenderer, COMPONENT_MAP } from "@cloudflare/kumo/generative"` works
- [ ] Component map has entries for all 37+ components in the registry
- [ ] Stateful wrappers auto-generated for Select, Checkbox, Switch, Tabs, Collapsible
- [ ] Adding a new component via `pnpm new:component` + `pnpm codegen:registry` auto-updates the generative map
- [ ] UITreeRenderer renders a valid UITree with all component types without errors
- [ ] Element validator catches invalid props and renders warning box (not crash)

---

### D3: `@cloudflare/kumo/loadable` — UMD Bundle (M)

**What:** Ship a self-contained UMD bundle that any HTML page can load via `<script>` tag. React bundled inside.

**Files to create in `packages/kumo/src/loadable/`:**

| File                 | Source                                        | Purpose                                                                           |
| -------------------- | --------------------------------------------- | --------------------------------------------------------------------------------- |
| `index.ts`           | `kumo-stream/src/loadable/index.ts`           | `window.CloudflareKumo` API: applyPatch, createParser, renderTree, setTheme, etc. |
| `action-dispatch.ts` | `kumo-stream/src/loadable/action-dispatch.ts` | Pub/sub + CustomEvent dispatch for cross-boundary actions                         |
| `theme.tsx`          | `kumo-stream/src/loadable/theme.tsx`          | ThemeWrapper (listens for kumo-theme-change CustomEvent)                          |

**Separate Vite config:** `vite.loadable.config.ts`

- Entry: `src/loadable/index.ts`
- Format: `umd`
- Global: `window.CloudflareKumo`
- React + ReactDOM bundled (not external)
- Tailwind processes `@cloudflare/kumo/styles/standalone`
- Output: `dist/loadable/kumo-loadable.umd.js` + `dist/loadable/style.css`
- `cssCodeSplit: false`

**Build script:** `"build:loadable": "vite build --config vite.loadable.config.ts"`

**Export path:** Not a JS export (UMD is consumed via `<script>` tag). But expose as package file:

```json
"./loadable/kumo-loadable.umd.js": "./dist/loadable/kumo-loadable.umd.js",
"./loadable/style.css": "./dist/loadable/style.css"
```

**Acceptance criteria:**

- [ ] `<script src="node_modules/@cloudflare/kumo/dist/loadable/kumo-loadable.umd.js">` exposes `window.CloudflareKumo`
- [ ] `CloudflareKumo.applyPatch(op, "container")` renders a Kumo component into `#container`
- [ ] `CloudflareKumo.createParser()` returns a working JSONL streaming parser
- [ ] Bundle size < 500KB gzipped (React + Kumo components + renderer)
- [ ] CSS file includes all Kumo component styles
- [ ] Light/dark theme toggle via `CloudflareKumo.setTheme("dark")`
- [ ] Shadow DOM mount mode supported

---

### D4: Enhanced `catalog.generatePrompt()` — System Prompt Generation (M)

**What:** Replace the barebones `generatePrompt()` in `src/catalog/catalog.ts` with the sophisticated implementation from `kumo-stream/src/core/system-prompt-components.ts`.

**Changes to `packages/kumo/src/catalog/`:**

| File                | Change                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `catalog.ts`        | Replace `generatePrompt()` body with rich component documentation                                                                  |
| `prompt-builder.ts` | **New.** Port logic from `system-prompt-components.ts`: prop scoring, filtering, grouping, sub-component resolution, type aliasing |
| `system-prompt.ts`  | **New.** Port the JSONL/RFC6902 system prompt template from `kumo-stream/src/core/system-prompt.ts`                                |

**`generatePrompt()` output structure:**

```
You are a UI generation assistant. You create user interfaces using Cloudflare's Kumo design system.

## Output Format
- Emit one JSON line per operation (JSONL)
- Each line is an RFC 6902 JSON Patch operation
- Build a flat UITree: { root, elements }
[... format instructions ...]

## Available Components

### Layout
- **Surface** — Container with visual prominence variants
  Props: variant (card|raised|sunken), padding (sm|md|lg)

- **Grid** — CSS grid layout
  Props: columns (1-12), gap (sm|md|lg)
[... all components grouped by category, top 10 props each ...]

## Action System
[... built-in actions, custom action registration ...]

## Design Rules
[... accessibility, semantic grouping, no emoji ...]
```

**Key improvements over current `generatePrompt()`:**

1. Full JSONL/RFC6902 format instructions (currently missing)
2. Prop filtering: skip internal props (`className`, `id`, `on*`, `set*`, `aria-*`)
3. Prop scoring: required > enum > interesting names (children, variant, size)
4. Top 10 props per component (not all props)
5. Category grouping (Layout, Content, Interactive, Data Display, etc.)
6. Sub-component documentation (Select.Option, Table.Row, etc.)
7. Working examples (counter UI, form)
8. Action system documentation

**Signature change:**

```ts
// Before
generatePrompt(): string

// After
generatePrompt(options?: {
  format?: "jsonl" | "json";        // Output format instructions (default: jsonl)
  maxPropsPerComponent?: number;     // Default: 10
  includeExamples?: boolean;         // Default: true
  components?: string[];             // Subset of components (default: all)
}): string
```

**Acceptance criteria:**

- [ ] `catalog.generatePrompt()` returns a prompt that includes all component props, grouped by category
- [ ] Prompt includes JSONL/RFC6902 format instructions
- [ ] Prompt includes action system documentation
- [ ] Prompt includes 2+ working examples
- [ ] `generatePrompt({ components: ["Button", "Input", "Surface"] })` returns subset
- [ ] Output is < 15K tokens for full prompt (reasonable context budget)
- [ ] Existing `generatePrompt()` callers are not broken (options param is optional)

---

### D5: Docs Site — Live Streaming Demo + Workers AI (L)

**What:** Add Workers AI backend to the docs site. Bring back the streaming tab with a live interactive chat demo that renders Kumo components.

#### 5a. SSR + Workers AI Backend

**Convert docs to hybrid SSR (Astro 5.x pattern):**

1. Install `@astrojs/cloudflare@^12.2.1` adapter
2. Add `adapter: cloudflare()` to `astro.config.mjs` (Astro 5 defaults to static; use `export const prerender = false` per-route to opt into SSR)
3. Add AI + rate limit bindings to `wrangler.jsonc`:
   ```jsonc
   "ai": { "binding": "AI" },
   "rate_limits": [{
     "binding": "CHAT_RATE_LIMIT",
     "namespace_id": "1001",
     "simple": { "limit": 20, "period": 60 }
   }]
   ```
4. Add `main` entry to `wrangler.jsonc` (required for Worker script; adapter generates this)

**Astro 5 binding access pattern:** `Astro.locals.runtime.env` (NOT `import { env } from 'cloudflare:workers'` — that's Astro 6)

**New API route:** `src/pages/api/chat.ts`

```ts
import type { APIRoute } from "astro";
import { createKumoCatalog, initCatalog } from "@cloudflare/kumo/catalog";

export const prerender = false; // SSR this route only

export const POST: APIRoute = async ({ locals, request }) => {
  const { env } = locals.runtime;
  const ip = request.headers.get("cf-connecting-ip") || "unknown";

  // Rate limit: 20 requests/minute per IP
  const { success } = await env.CHAT_RATE_LIMIT.limit({ key: ip });
  if (!success) return new Response("Rate limited", { status: 429 });

  const { message, history } = await request.json();

  // Generate system prompt from kumo's catalog
  const catalog = createKumoCatalog();
  await initCatalog(catalog);
  const systemPrompt = catalog.generatePrompt();

  // Stream from Workers AI
  const stream = await env.AI.run("@cf/zai-org/glm-4.7-flash", {
    messages: [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: message },
    ],
    stream: true,
    max_tokens: 4096,
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
    },
  });
};
```

#### 5b. Streaming Page Update

**Update `src/pages/streaming.astro`:**

- Keep existing catalog documentation (data binding, visibility, validation)
- Add new sections at the top:
  1. **Live Demo** — Interactive chat interface (React island, `client:load`)
  2. **Quick Start** — Minimal code to get streaming UI working
  3. **UMD/HTML Approach** — Copy-pasteable HTML example using `<script>` tag
  4. **Component Map** — Auto-generated reference of all mapped components
  5. **System Prompt** — How `generatePrompt()` works, customization options
  6. **Action System** — How actions work in generative UI

**New demo component:** `src/components/demos/StreamingDemo.tsx`

- Chat input + message history
- Uses `@cloudflare/kumo/streaming` (useUITree, createJSONLParser)
- Uses `@cloudflare/kumo/generative` (UITreeRenderer, COMPONENT_MAP)
- Fetches from `/api/chat`
- Shows real Kumo components rendering from AI responses
- Theme-aware (respects docs site light/dark toggle)
- Preset prompts for quick demos ("Show me a user card", "Build a settings form")

**Add to navigation:**

- Add "Streaming UI" to `SidebarNav.tsx` `staticPages` array
- Already in `SearchDialog.tsx` `STATIC_PAGES`

#### 5c. UMD Demo Section

Embed a simplified version of `kumo-stream`'s `cross-boundary.html` as a live example:

- Copy-pasteable `<script>` tag approach
- Shows the `window.CloudflareKumo` API
- Links to the npm package for the UMD bundle

**Acceptance criteria:**

- [ ] `/api/chat` endpoint returns SSE stream from Workers AI
- [ ] Rate limited to 20 req/min per IP
- [ ] Live chat demo on `/streaming` renders Kumo components from AI responses
- [ ] Existing static pages still work (Astro 5 default = static; only `prerender = false` routes are SSR)
- [ ] "Streaming UI" appears in sidebar navigation
- [ ] Page includes copy-pasteable HTML/UMD example
- [ ] Works in both light and dark mode
- [ ] Graceful degradation if Workers AI is unavailable (error message, not crash)

---

## Dependency Graph

```
D4 (generatePrompt)
  ↓
D1 (streaming engine) ← no deps, can start immediately
  ↓
D2 (generative runtime) ← depends on D1 (imports streaming types) + D4 (uses prompt)
  ↓
D3 (UMD bundle) ← depends on D2 (bundles the generative runtime)
  ↓
D5 (docs site) ← depends on D1 + D2 + D4 (imports everything)
```

**Parallel work possible:**

- D1 and D4 can be done in parallel (no dependency between them)
- D5a (SSR + backend) can start as soon as D4 is done
- D5b (demo) needs D1 + D2

---

## Trade-off Analysis

| Decision                       | Chosen                        | Alternative                | Why                                                                                           |
| ------------------------------ | ----------------------------- | -------------------------- | --------------------------------------------------------------------------------------------- |
| Ship rendering runtime in kumo | Full runtime (D2)             | Core primitives only       | Vision is "easy to build agent apps." Consumers shouldn't need to build a renderer.           |
| Auto-generate component map    | Codegen from registry         | Hand-maintain              | 37 entries, grows with every new component. Manual = drift. Codegen = anti-drift.             |
| UMD in main package            | `@cloudflare/kumo/loadable`   | Separate package           | Simpler DX, one install. UMD is tree-shaken away for ESM consumers.                           |
| Astro 5 + adapter 12.x         | `prerender = false` per-route | Upgrade to Astro 6         | No breaking upgrade. Adapter 12.x supports Astro 5. Access bindings via `locals.runtime.env`. |
| Workers AI model               | `@cf/zai-org/glm-4.7-flash`   | Model-agnostic abstraction | 131K context, fast, free tier. System prompt designed to be model-agnostic for future swaps.  |
| Rate limiting                  | Simple IP-based (20/min)      | Turnstile, auth            | Sunil: "abuse controls later." IP rate limit is sufficient initial protection.                |
| Stateful wrappers              | Auto-generated + shipped      | Consumer-side              | Pattern is mechanical, identical for all controlled-only components. Library should own this. |

---

## Risks

| Risk                                                       | Likelihood | Impact | Mitigation                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GLM-4.7-Flash doesn't follow JSONL/RFC6902 format reliably | Medium     | High   | Workers AI has no grammar-based constrained generation. Mitigation is in our parser: JSONL parser skips unparseable lines gracefully (already tested in kumo-stream). Element validator catches bad props via Zod. `response_format: { type: "json_object" }` available as a nudge. System prompt is model-agnostic for future swaps. |
| UMD bundle too large (>1MB)                                | Low        | Medium | React 18 is ~40KB gzipped. Kumo components tree-shake. Target <500KB. If exceeded, use dynamic component loading.                                                                                                                                                                                                                     |
| Astro hybrid SSR breaks existing static pages              | Low        | High   | `output: "hybrid"` defaults to static. Only pages/routes with `export const prerender = false` are SSR. Existing pages unchanged.                                                                                                                                                                                                     |
| Codegen for component map breaks on edge cases             | Medium     | Medium | Test with all 37 current components. Add snapshot tests. Configuration escape hatch for overrides.                                                                                                                                                                                                                                    |
| Workers AI rate limits hit by legitimate docs users        | Low        | Low    | 20 req/min is generous for docs demo. Can increase or add Turnstile later.                                                                                                                                                                                                                                                            |

---

## Effort Breakdown

| Deliverable                          | Effort | Days | Depends On |
| ------------------------------------ | ------ | ---- | ---------- |
| **D1** `@cloudflare/kumo/streaming`  | M      | 1-2  | —          |
| **D4** Enhanced `generatePrompt()`   | M      | 1-2  | —          |
| **D2** `@cloudflare/kumo/generative` | L      | 2-3  | D1, D4     |
| **D3** `@cloudflare/kumo/loadable`   | M      | 1-2  | D2         |
| **D5** Docs site streaming demo      | L      | 2-3  | D1, D2, D4 |
| **Total**                            | XL     | 5-8  | —          |

---

## Resolved Decisions

| #   | Question          | Decision                                  | Rationale                                                                                                                                                                                                        |
| --- | ----------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Changeset scope   | **One minor bump**                        | D1-D4 ship together. Tightly coupled — streaming needs generative, generative needs generatePrompt().                                                                                                            |
| 2   | Model reliability | **Validation + skip + recover**           | Workers AI has no grammar enforcement. Our JSONL parser already skips unparseable lines gracefully. Element validator catches bad props via Zod. Resilience is in the client, not dependent on model perfection. |
| 3   | Type re-exports   | **`streaming` re-exports from `catalog`** | `import { useUITree, UITree } from "@cloudflare/kumo/streaming"` — one import path for related concepts.                                                                                                         |
| 4   | DPU mode          | **Deferred**                              | Experimental, adds complexity. Ship JSONL streaming first.                                                                                                                                                       |
| 5   | Astro version     | **Stay on Astro 5**                       | `@astrojs/cloudflare@12.x` works with Astro 5. Use `locals.runtime.env` for bindings. No upgrade needed.                                                                                                         |
| 6   | Drift prevention  | **Drift test + codegen**                  | Mirror the Figma `drift-detection.test.ts` pattern. See section below.                                                                                                                                           |

---

## Drift Prevention: Generative Component Map

**Problem:** When new components are added to `@cloudflare/kumo`, they must automatically appear in the generative component map. Manual maintenance = drift.

**Solution: 3-layer anti-drift mechanism** (mirroring `packages/kumo-figma/src/generators/drift-detection.test.ts`):

### Layer 1: Codegen (primary)

The component map is **auto-generated** by `scripts/component-registry/generative-map-generator.ts` as part of `pnpm codegen:registry`. New components automatically get a direct mapping entry.

### Layer 2: Drift detection test

**New file:** `packages/kumo/tests/generative/drift-detection.test.ts`

Pattern (modeled on Figma's 1395-line drift test):

```ts
import registry from "../../ai/component-registry.json";
import { COMPONENT_MAP, KNOWN_TYPES } from "../../src/generative/component-map";

// Every registry component has a generative map entry
const EXCLUDED_COMPONENTS = new Set([
  // Components intentionally excluded (with documented reason)
]);

const COMPONENT_NAME_MAPPING: Record<string, string> = {
  // Aliases: registry name → generative map key
  InputArea: "Textarea",
};

describe("generative component map drift detection", () => {
  test("every registry component has a map entry", () => {
    const registryNames = Object.keys(registry.components);
    const missing = registryNames.filter((name) => {
      const mapKey = COMPONENT_NAME_MAPPING[name] ?? name;
      return !KNOWN_TYPES.has(mapKey) && !EXCLUDED_COMPONENTS.has(name);
    });
    expect(missing).toEqual([]);
  });

  test("every map entry references a real component", () => {
    for (const [key, component] of Object.entries(COMPONENT_MAP)) {
      expect(component).toBeDefined();
      expect(typeof component).toBe("function"); // React component
    }
  });

  test("stateful wrappers exist for all controlled-only components", () => {
    // Detect components with value/checked/open + onChange but no default*
    // Assert wrapper exists
  });

  test("excluded components have documented reasons", () => {
    // Every entry in EXCLUDED_COMPONENTS must have a comment
  });

  test("no stale entries in map that aren't in registry", () => {
    const registryNames = new Set(Object.keys(registry.components));
    const stale = [...KNOWN_TYPES].filter((key) => {
      // Account for aliases and sub-components
      const baseName = key.split(/(?=[A-Z])/).join(""); // rough
      return !registryNames.has(baseName) && !isSubComponent(key);
    });
    expect(stale).toEqual([]);
  });
});
```

### Layer 3: Codegen staleness check

Add to the existing `pnpm codegen:registry` pipeline:

After generating `src/generative/component-map.ts`, **compare with the checked-in version**. If different, fail with:

```
ERROR: Generative component map is stale. Run `pnpm codegen:registry` to update.
```

This runs in CI (same as the existing registry codegen check).

### Backpressure mechanisms

| Mechanism                | When it fires                | What it catches                                                                  |
| ------------------------ | ---------------------------- | -------------------------------------------------------------------------------- |
| **Drift test**           | `pnpm test` / CI             | Missing map entries, stale entries, missing stateful wrappers                    |
| **Codegen staleness**    | `pnpm codegen:registry` / CI | Generated file out of date with registry                                         |
| **Scaffolding hook**     | `pnpm new:component`         | Could auto-run codegen after scaffolding (optional)                              |
| **Changeset validation** | Pre-push (lefthook)          | Changeset required if `src/components/` changed — nudges dev to also run codegen |

---

## Open Questions

None. All questions resolved.
