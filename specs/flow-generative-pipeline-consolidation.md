# Flow Generative Support + Pipeline Consolidation

**Status:** Draft
**Date:** 2026-02-27
**Effort:** L (1-2 days)
**Branch:** `geoquant/streaming-ui` (CRITICAL: ONLY work on this branch)

## Problem Statement

**Who:** Kumo developers adding new components; playground users wanting Flow diagrams
**What:** Two problems:
1. Flow component is invisible to the generative/playground system because discovery requires `{name}/{name}.tsx` convention and Flow uses `diagram.tsx`
2. Adding any component to the generative system requires updating up to 11 manually-maintained lists across 6 files — fragile, error-prone, already caused Flow to be silently dropped

**Why it matters:** Every new component silently missing from the generative system is a broken experience. The 11-gate pipeline guarantees future drift.
**Evidence:** Flow was added while the generative system was being built. Nobody noticed it was missing until manually checking.

## Proposed Solution

Two-part approach shipped together:

**Part A — Flow in the generative system:** Add Flow (3 sub-components: Flow, Flow.Node, Flow.Parallel) to the component map, prompt docs, and playground. Add a "Workers flow" pill preset. Flow.List and Flow.Anchor are excluded (render prop incompatibility with JSON-based LLM output).

**Part B — Pipeline consolidation:** Reduce 11 manual gates to ~4 by making `component-manifest.ts` the single source of truth for alias/sub-component data. Prompt-builder and element-validator import from the manifest instead of maintaining parallel maps. `PROMPT_COMPONENTS` becomes auto-derived with an excludelist. Discovery relaxed to check `index.ts` exports when `{name}/{name}.tsx` doesn't exist.

## Scope & Deliverables

| # | Deliverable | Effort | Depends On |
|---|-------------|--------|------------|
| D1 | Relax discovery to handle non-conventional components | S | - |
| D2 | Add Flow to registry (discovery + category map) | S | D1 |
| D3 | Add Flow sub-components to generative-map-generator | S | D2 |
| D4 | Consolidate manifest as single source of truth | M | D3 |
| D5 | Prompt-builder imports aliases from manifest | M | D4 |
| D6 | Element-validator imports aliases from manifest | S | D4 |
| D7 | Auto-derive PROMPT_COMPONENTS with excludelist | M | D5 |
| D8 | Wire Flow into component-map.ts | S | D3 |
| D9 | Add Flow prompt docs (synthetic entries for sub-components) | S | D5, D8 |
| D10 | Add "Workers flow" pill preset to playground | S | D9 |
| D11 | Add drift detection to codegen | S | D4 |

## Non-Goals

- Flow.Anchor generative support (render prop incompatible with JSON trees)
- Flow.List generative support (niche; adds complexity without clear LLM use case)
- Flow.Node `render` prop support (LLM uses `children` only)
- Stateful/generative wrappers for Flow (it's not controlled, no styling defaults needed)
- Automated tests for LLM prompt quality (out of scope; prompt engineering is iterative)
- Removing PROMPT_COMPONENTS entirely (token budget control still needed via excludelist)

## Detailed Design

### D1: Relax discovery (`discovery.ts`)

Current `discoverDirs` (L347-356) requires `{dirName}/{dirName}.tsx`. Change to:

```
1. Check {dirName}/{dirName}.tsx (current behavior)
2. If not found, check {dirName}/index.ts and parse main export name
3. Use the detected component name to find the actual source file
```

**File:** `packages/kumo/scripts/component-registry/discovery.ts`

The `discoverDirs` function checks `existsSync(join(fullPath, `${entry}.tsx`))`. Relax to also accept directories that have an `index.ts` with a PascalCase export — reuse the existing `detectExportsFromIndex` function.

`discoverFromDir` (L366-432) already calls `detectExportsFromIndex` but only after the directory passes the `discoverDirs` filter. Move the detection earlier so directories without `{name}.tsx` but with valid `index.ts` exports are included.

The `mainFile` variable (L377) must adapt: if `{dirName}.tsx` doesn't exist, resolve the actual source file from the index.ts re-export path.

### D2: Add Flow to registry

**File:** `packages/kumo/scripts/component-registry/discovery.ts`

Add to `CATEGORY_MAP`:
```typescript
flow: "Layout",
```

After D1, `flow/` directory will be discovered via `index.ts` → detects `Flow` export → finds source in `diagram.tsx`.

Verify: run `pnpm codegen:registry` and confirm `Flow` appears in `ai/component-registry.json`.

### D3: Add Flow sub-components to generative-map-generator

**File:** `packages/kumo/scripts/component-registry/generative-map-generator.ts`

Add to `SUB_COMPONENT_OVERRIDES`:
```typescript
FlowNode: { parent: "Flow", sub: "Node" },
FlowParallel: { parent: "Flow", sub: "Parallel" },
```

This ensures the manifest generates `SUB_COMPONENT_ALIASES` entries for `FlowNode` and `FlowParallel`, and `component-map.ts` step 2 auto-wires `Flow.Node` and `Flow.Parallel`.

### D4: Consolidate manifest as single source of truth

**File:** `packages/kumo/src/generative/component-manifest.ts` (auto-generated)

Extend the manifest to export a unified alias resolution map that both prompt-builder and validator can import:

```typescript
// New: unified type resolution — derived from SUB_COMPONENT_ALIASES + TYPE_ALIASES
// Maps generative type name → { registryComponent, subComponent? }
export const TYPE_RESOLUTION_MAP = {
  // From TYPE_ALIASES
  Textarea: { registryComponent: "InputArea" },
  // From SUB_COMPONENT_ALIASES
  BreadcrumbsCurrent: { registryComponent: "Breadcrumbs", subComponent: "Current" },
  FlowNode: { registryComponent: "Flow", subComponent: "Node" },
  FlowParallel: { registryComponent: "Flow", subComponent: "Parallel" },
  // ... all others
} as const;

// New: all generative type names (for auto-deriving PROMPT_COMPONENTS)
export const ALL_GENERATIVE_TYPES = [
  ...DIRECT_COMPONENTS,
  ...Object.keys(SUB_COMPONENT_ALIASES),
  ...Object.keys(TYPE_ALIASES),
  ...Object.keys(SYNTHETIC_TYPES),
] as const;
```

**File:** `packages/kumo/scripts/component-registry/generative-map-generator.ts`

Add generation logic for `TYPE_RESOLUTION_MAP` and `ALL_GENERATIVE_TYPES` in `generateComponentManifest()`.

### D5: Prompt-builder imports from manifest

**File:** `packages/kumo/src/catalog/prompt-builder.ts`

Replace `UI_TYPE_TO_REGISTRY_REF` (L110-131) with an import:

```typescript
import { TYPE_RESOLUTION_MAP } from "../generative/component-manifest.js";

// Derive UI_TYPE_TO_REGISTRY_REF from manifest
const UI_TYPE_TO_REGISTRY_REF: Readonly<Record<string, RegistryRef>> =
  Object.fromEntries(
    Object.entries(TYPE_RESOLUTION_MAP).map(([type, meta]) => [
      type,
      {
        component: meta.registryComponent,
        ...(meta.subComponent && { subComponent: meta.subComponent }),
      },
    ])
  );
```

`SYNTHETIC_TYPES` in prompt-builder (L486-505) stays local — it has prompt-specific documentation strings (descriptions, propsLines) that don't belong in the manifest.

### D6: Element-validator imports from manifest

**File:** `packages/kumo/src/generative/element-validator.ts`

Replace `TYPE_TO_SCHEMA_KEY` (L129-146) with derived version:

```typescript
import { TYPE_ALIASES, SUB_COMPONENT_ALIASES } from "./component-manifest.js";

// Derive: aliases → schema key, sub-components → null (skip validation)
const TYPE_TO_SCHEMA_KEY: Record<string, keyof typeof ComponentPropsSchemas | null> =
  Object.fromEntries([
    ...Object.entries(TYPE_ALIASES).map(([alias, target]) => [alias, target]),
    ...Object.keys(SUB_COMPONENT_ALIASES).map((key) => [key, null]),
  ]);
```

### D7: Auto-derive PROMPT_COMPONENTS with excludelist

**File:** `packages/kumo-docs-astro/src/lib/playground.ts`

Replace the manual `PROMPT_COMPONENTS` array with:

```typescript
import { ALL_GENERATIVE_TYPES } from "@cloudflare/kumo/generative";

/**
 * Types excluded from the playground prompt to control token budget.
 * Everything in the generative manifest is included unless listed here.
 */
const EXCLUDED_FROM_PROMPT: ReadonlySet<string> = new Set([
  "Breadcrumbs",
  "BreadcrumbsCurrent",
  "BreadcrumbsLink",
  "BreadcrumbsSeparator",
  // Add components here that shouldn't appear in the playground
]);

const PROMPT_COMPONENTS = ALL_GENERATIVE_TYPES.filter(
  (t) => !EXCLUDED_FROM_PROMPT.has(t)
);
```

This flips the default: new components are **included** unless explicitly excluded. The excludelist is the token budget control valve.

**Export path:** `ALL_GENERATIVE_TYPES` needs to be exported from `@cloudflare/kumo/generative`. Check the barrel export at `src/generative/index.ts`.

### D8: Wire Flow into component-map.ts

**File:** `packages/kumo/src/generative/component-map.ts`

Flow is a direct component with sub-components. After D3, the auto-generated manifest will include `Flow` in `DIRECT_COMPONENTS` and `FlowNode`/`FlowParallel` in `SUB_COMPONENT_ALIASES`. Steps 1 and 2 in `component-map.ts` will auto-wire them. **No manual changes needed** if D1-D3 work correctly.

Verify: after codegen, check that `COMPONENT_MAP["Flow"]`, `COMPONENT_MAP["FlowNode"]`, `COMPONENT_MAP["FlowParallel"]` all resolve.

### D9: Add Flow prompt docs

Flow's sub-components need prompt documentation so the LLM knows how to use them.

If Flow is in the registry (after D2), the prompt-builder will auto-generate docs from registry props. `FlowNode` and `FlowParallel` will resolve via `TYPE_RESOLUTION_MAP` to `Flow`'s sub-components.

If Flow's props aren't fully captured by the registry (e.g. `children` isn't explicit), add a `SYNTHETIC_TYPES` entry in `prompt-builder.ts` for `FlowNode` and `FlowParallel` with explicit prop docs.

**Likely needed synthetic entries:**
```typescript
FlowNode: {
  description: "A step node in a flow diagram. Renders as a styled card with connector points.",
  propsLines: [
    '- `children` (string | elements): Content inside the node',
    '- `disabled` (boolean): Visually marks node as inactive; connectors render with reduced opacity',
  ],
},
FlowParallel: {
  description: "Container for parallel branches. Children are Flow.Node components displayed side-by-side with junction connectors.",
  propsLines: [
    '- `children` (elements): FlowNode components to display in parallel',
    '- `align` ("start" | "end"): Horizontal alignment of nodes. Default "start".',
  ],
},
```

### D10: Add "Workers flow" pill preset

**File:** `packages/kumo-docs-astro/src/components/demos/_PlaygroundPage.tsx`

Add to `PRESET_PROMPTS` array (after L239):

```typescript
{
  label: "Workers flow",
  prompt:
    "Build a Cloudflare Workers page with two sections stacked vertically. " +
    "Top section: a Flow diagram showing the request lifecycle — " +
    "a 'Client Request' node, then a FlowParallel with 'WAF Rules' and 'Rate Limiting' nodes, " +
    "then a 'my-worker' node, then a FlowParallel with 'KV Store' and 'D1 Database' nodes, " +
    "then a 'Response' node. " +
    "Bottom section: a Table with columns Name, Type, and Resource showing worker bindings — " +
    "rows for MY_KV (KV Namespace, production-kv), MY_DB (D1 Database, worker-db), " +
    "AUTH_SERVICE (Service Binding, auth-worker), and ASSETS (R2 Bucket, static-assets).",
},
```

### D11: Drift detection

**File:** `packages/kumo/scripts/component-registry/generative-map-generator.ts`

Add a check at the end of `generateComponentManifest`:

```typescript
// Drift detection: warn about component dirs not in registry
const componentDirs = discoverDirs(componentsDir);
const registryNames = new Set(registryNames.map(n => n.toLowerCase()));
const unmapped = componentDirs.filter(dir => {
  const pascal = toPascalCase(dir);
  return !registryNames.has(pascal.toLowerCase())
    && !(pascal in EXCLUDED_COMPONENTS);
});
if (unmapped.length > 0) {
  console.warn(
    `\n[drift] Component dirs not in registry: ${unmapped.join(", ")}\n` +
    `  These won't appear in the generative system.\n` +
    `  Fix: ensure {dir}/{dir}.tsx exists or index.ts has a PascalCase export.\n`
  );
}
```

This warns during `pnpm codegen:registry` — visible in CI and local dev.

## Data Model

### TYPE_RESOLUTION_MAP shape (new, in component-manifest.ts)

```typescript
type TypeResolution = {
  registryComponent: string;
  subComponent?: string;
};

// Maps generative type name → registry lookup info
const TYPE_RESOLUTION_MAP: Record<string, TypeResolution>;
```

### ALL_GENERATIVE_TYPES (new, in component-manifest.ts)

```typescript
// Union of all type names available in generative UI
const ALL_GENERATIVE_TYPES: readonly string[];
```

## Acceptance Criteria

- [ ] `pnpm codegen:registry` discovers Flow and outputs it to `ai/component-registry.json`
- [ ] `component-manifest.ts` includes `Flow` in `DIRECT_COMPONENTS` and `FlowNode`/`FlowParallel` in `SUB_COMPONENT_ALIASES`
- [ ] `COMPONENT_MAP["Flow"]` resolves to the Flow component at runtime
- [ ] `COMPONENT_MAP["FlowNode"]` resolves to `Flow.Node`
- [ ] `COMPONENT_MAP["FlowParallel"]` resolves to `Flow.Parallel`
- [ ] Playground LLM prompt includes Flow, FlowNode, FlowParallel documentation
- [ ] "Workers flow" pill in playground generates a flow diagram above a bindings table
- [ ] `prompt-builder.ts` has zero hardcoded alias/sub-component entries (derives from manifest)
- [ ] `element-validator.ts` has zero hardcoded alias/sub-component entries (derives from manifest)
- [ ] `PROMPT_COMPONENTS` is auto-derived from manifest with excludelist
- [ ] `pnpm codegen:registry` warns about component dirs not in registry (drift detection)
- [ ] Adding a hypothetical `src/components/foo/foo.tsx` and running codegen auto-adds it to manifest, prompt, and component map without manual edits
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

## Test Strategy

| Layer | What | How |
|-------|------|-----|
| Unit | Discovery finds flow/ via index.ts fallback | Add test case to discovery tests (if they exist) or verify via codegen output |
| Unit | TYPE_RESOLUTION_MAP derivation is correct | Snapshot test on generated manifest |
| Integration | Full codegen pipeline | Run `pnpm codegen:registry`, verify all output files |
| Integration | Component map resolves Flow types | Import COMPONENT_MAP, assert Flow/FlowNode/FlowParallel present |
| E2E | Playground pill renders flow | Manual test: click "Workers flow" pill, verify Flow renders with connectors |

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Flow's SVG connectors break in generative renderer | Medium | High | Test early in D8; connectors use ResizeObserver which should work in playground's DOM |
| LLM generates invalid Flow trees (e.g. non-Node children in Parallel) | Medium | Low | Flow component is defensive; invalid children render as-is without crash |
| Import cycle: prompt-builder → manifest → index | Low | High | Manifest is a leaf module with no imports; verify no cycles introduced |
| Token budget grows uncontrolled with auto-derive | Low | Medium | Excludelist provides explicit control; monitor prompt size in playground |
| RadioGroup/RadioItem semantic mismatch exposed by consolidation | Medium | Low | Normalize during D4: RadioGroup is sub-component (Radio.Group), RadioItem is synthetic (no schema) |

## Trade-offs Made

| Chose | Over | Because |
|-------|------|---------|
| Manifest as single source of truth | Keep 3 parallel maps | Eliminates drift between rendering/prompting/validation; manifest is already auto-generated and committed |
| Auto-derive with excludelist | Manual allowlist | New components appear by default; excludelist is smaller to maintain than an allowlist |
| Import manifest at runtime | Codegen separate alias files | Manifest is committed to git, already a stable artifact; no need for more generated files |
| Exclude Flow.Anchor/List from generative | Full Flow API | render prop incompatible with JSON trees; Node children-only covers 90% of use cases |
| Drift detection as codegen warning | CI-only check | Visible during both local dev and CI; no extra CI config needed |

## Open Questions

- [ ] RadioGroup: currently treated as sub-component in manifest but as alias in prompt-builder/validator. Consolidation will normalize to sub-component (`Radio.Group`). Need to verify prompt docs still render correctly for RadioGroup. -> Owner: implementer
- [ ] Flow's `align` prop on root (`"start" | "center"`) — should it be in prompt docs? Probably yes for "center" variant. -> Owner: implementer
- [ ] Should drift detection also check for components in EXCLUDED_COMPONENTS that no longer exist in the registry? (Stale exclusions.) -> Owner: implementer

## Migration/Rollout

1. D1-D3 can land first as a standalone PR (discovery fix + Flow in registry + manifest)
2. D4-D7 is the consolidation PR (manifest as source of truth, auto-derive)
3. D8-D10 is the playground PR (component map + prompt docs + pill)
4. D11 can go with either PR 1 or PR 2

All changes are backward-compatible. No consumer-facing API changes. The consolidation changes internal-only codegen and runtime wiring.
