# PRD: Custom Components for Kumo Streaming UI

**Date:** 2026-02-22
**Branch:** `geoquant/streaming-ui` (existing PR — all work on this branch)
**Spec:** `specs/custom-components.md`

---

## Problem Statement

### What problem are we solving?

Kumo's streaming UI renderer (`UITreeRenderer`) resolves LLM-generated `type` strings against a closed, auto-generated `COMPONENT_MAP`. Consumers who need proprietary or app-specific components (e.g., `GeoQuantMap`, `TradingChart`, `RiskMatrix`) cannot extend the streaming UI system without forking Kumo or upstreaming every component into the library.

The render-layer extension partially exists — `UITreeRenderer` already accepts a `components` prop that merges custom React components over the built-in map. But the **schema validation** and **LLM prompt generation** layers have no extension surface:

- Custom components skip prop validation entirely (unknown types return `VALID`)
- The LLM has zero knowledge of custom component types, props, or usage patterns
- No documentation explains the existing `components` prop or the extension workflow
- No prop sanitization is applied to custom components (security gap)

### Why now?

Internal teams (GeoQuant) are building streaming UI integrations and need app-specific components. The current answer is "you can't" — forcing either a fork or upstreaming every component into Kumo, neither of which scales.

### Who is affected?

- **Primary users:** Developers building streaming UI integrations who need custom/proprietary components alongside Kumo's built-in set
- **Secondary users:** Kumo maintainers who would otherwise receive PRs to upstream every one-off component

---

## Proposed Solution

### Overview

Extend Kumo's streaming UI system with a `customComponents` prop on `UITreeRenderer` that accepts `CustomComponentDefinition` objects. Each definition bundles a React component, an optional Zod schema for prop validation, and optional prompt metadata (description + prop docs) for LLM system prompt generation. A `defineCustomComponent()` helper provides a type-safe factory. The catalog's `createKumoCatalog()` and `buildComponentDocs()` are extended to merge custom component documentation into the LLM system prompt.

### User Experience

#### User Flow: Render-Only (Minimal)

1. Developer imports `defineCustomComponent` from `@cloudflare/kumo/generative`
2. Defines a custom component with just a React component reference
3. Passes it to `UITreeRenderer` via `customComponents` prop
4. LLM-generated trees with `type: "MyWidget"` render the custom component

#### User Flow: Full-Stack (Render + Validation + Prompt)

1. Developer defines custom components with `component`, `propsSchema`, `description`, and `props`
2. Passes definitions to both `UITreeRenderer` (for rendering + validation) and `createKumoCatalog()` (for prompt generation)
3. `catalog.generatePrompt()` includes custom component docs in the "Available Components" section
4. LLM generates trees that include custom component types
5. `UITreeRenderer` validates props against the Zod schema and renders the component
6. Invalid props are caught by validation; render failures caught by error boundary

---

## End State

When this PRD is complete, the following will be true:

- [ ] `CustomComponentDefinition` and `CustomPropDefinition` types exist in `@cloudflare/kumo/catalog`
- [ ] `defineCustomComponent()` factory is exported from `@cloudflare/kumo/generative`
- [ ] `UITreeRenderer` accepts a `customComponents` prop that merges custom definitions into the render pipeline
- [ ] Custom component props are validated against consumer-provided Zod schemas at render time
- [ ] Custom component props are sanitized (same `sanitizeProps` pipeline as built-in components)
- [ ] `createKumoCatalog({ customComponents })` merges custom component docs into the LLM system prompt
- [ ] `buildComponentDocs()` appends custom component documentation in a "Custom" category
- [ ] Dev-mode `console.warn` fires when a custom component name collides with a built-in
- [ ] Consumer-wins semantics: custom components override built-in components with the same name
- [ ] Existing `components` prop on `UITreeRenderer` continues to work (backward compatible)
- [ ] Documentation section in `streaming.astro` explains the full extension workflow with examples
- [ ] All work is on the `geoquant/streaming-ui` branch

---

## Success Metrics

This is an API extension. Success = it works and is documented. No quantitative metrics required for v1.

---

## Acceptance Criteria

### Feature: Custom Component Types

- [ ] `CustomComponentDefinition` interface has fields: `component` (required), `propsSchema` (optional), `description` (optional), `props` (optional), `category` (optional)
- [ ] `CustomPropDefinition` interface has fields: `type` (required), `description` (optional), `optional` (optional), `values` (optional), `default` (optional)
- [ ] Both types are exported from `@cloudflare/kumo/catalog`

### Feature: defineCustomComponent Helper

- [ ] `defineCustomComponent(definition)` returns a frozen `CustomComponentDefinition`
- [ ] Exported from `@cloudflare/kumo/generative`
- [ ] Type-safe: TypeScript errors if required fields are missing

### Feature: UITreeRenderer Custom Components

- [ ] `UITreeRenderer` accepts `customComponents?: Readonly<Record<string, CustomComponentDefinition>>`
- [ ] Custom components are merged over `COMPONENT_MAP` (consumer wins on collision)
- [ ] If both `components` and `customComponents` provide the same type, `customComponents` takes precedence
- [ ] Custom component renders stream identically to built-in components (partial render as props arrive)
- [ ] Custom component props pass through `sanitizeProps()` (same security pipeline as built-ins)
- [ ] Unknown custom component types (not in custom map either) still render the yellow "Unknown component" warning

### Feature: Schema Validation

- [ ] `validateElement()` accepts an optional custom schema map parameter
- [ ] When a custom Zod schema exists for a component type, props are validated against it
- [ ] Validation failures produce the same `ElementValidationResult` as built-in validation failures
- [ ] When no custom schema exists, behavior is unchanged (unknown types return `VALID`)
- [ ] The existing repair pipeline (strip bad props) works for custom component validation failures

### Feature: Prompt Generation

- [ ] `CatalogConfig` accepts `customComponents?: Readonly<Record<string, CustomComponentDefinition>>`
- [ ] `createKumoCatalog({ customComponents })` includes custom components in `componentNames`
- [ ] `catalog.generatePrompt()` includes custom component docs in the "Available Components" section under a "Custom" category
- [ ] Custom component docs follow the same format as built-in docs: `- **TypeName** — description` with prop lines
- [ ] When no `customComponents` provided, prompt generation is identical to today

### Feature: Dev-Mode Collision Warning

- [ ] When `NODE_ENV !== "production"`, merging a custom component that collides with a built-in name logs `console.warn`
- [ ] Warning message includes the component name
- [ ] No warning in production builds
- [ ] Override still works (consumer wins); warning is informational only

### Feature: Documentation

- [ ] "Custom Components" section added to `streaming.astro` page
- [ ] Includes explanation of the three-layer extension model (render, validation, prompt)
- [ ] Includes minimal quick-start example (render-only)
- [ ] Includes full example with schema + prompt generation
- [ ] Documents caveats: consumer manages prompt engineering, no auto-codegen, define outside render for stable references
- [ ] Documents security: props are sanitized but consumers are responsible for their component's security

---

## Technical Context

### Existing Patterns

- **Render extension:** `UITreeRenderer` already has `components?: UITreeRendererComponents` prop with `mergeComponentMaps()` at `src/generative/ui-tree-renderer.tsx:709-719`. This is the pattern to extend.
- **Action extension:** `createHandlerMap(custom?)` at `src/streaming/action-registry.ts:397` already merges custom action handlers. Same merge-over-built-in pattern.
- **Validation passthrough:** `element-validator.ts:228-229` returns `VALID` for unknown types. New code adds a custom schema lookup before this fallback.
- **Prompt building:** `buildComponentDocs()` at `src/catalog/prompt-builder.ts:528-594` builds categorized markdown from registry JSON. Custom components append a "Custom" category.

### Key Files

| File                                                 | Role                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------- |
| `packages/kumo/src/generative/ui-tree-renderer.tsx`  | Main renderer; `components` prop, `mergeComponentMaps()`, `RenderElement` |
| `packages/kumo/src/generative/component-map.ts`      | `COMPONENT_MAP`, `KNOWN_TYPES`                                            |
| `packages/kumo/src/generative/element-validator.ts`  | `validateElement()`, enum coercion, repair pipeline                       |
| `packages/kumo/src/generative/index.ts`              | `@cloudflare/kumo/generative` public exports                              |
| `packages/kumo/src/catalog/types.ts`                 | `CatalogConfig`, `UITree`, `UIElement` types                              |
| `packages/kumo/src/catalog/catalog.ts`               | `createKumoCatalog()`, `initCatalog()`                                    |
| `packages/kumo/src/catalog/prompt-builder.ts`        | `buildComponentDocs()`                                                    |
| `packages/kumo/src/catalog/system-prompt.ts`         | `buildSystemPrompt()`                                                     |
| `packages/kumo/src/catalog/index.ts`                 | `@cloudflare/kumo/catalog` public exports                                 |
| `packages/kumo-docs-astro/src/pages/streaming.astro` | Streaming UI documentation page                                           |

### System Dependencies

- `zod` — already a dependency via `ai/schemas.ts`; used for custom prop schemas
- No new package dependencies required

---

## Risks & Mitigations

| Risk                                                                                              | Likelihood | Impact | Mitigation                                                                                                                                       |
| ------------------------------------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Schema duplication: consumer defines props twice (Zod schema + prompt description)                | High       | Low    | Both are optional. Document the pattern. Future iteration: generate prompt docs from Zod schema automatically.                                   |
| LLM hallucinates invalid props for custom components despite prompt docs                          | Medium     | Medium | Validation layer catches bad props when schema provided. Error boundary wraps every element. Repair pipeline strips unrecognized props.          |
| Performance regression: `useMemo` deps change every render if consumer creates definitions inline | Medium     | Low    | `defineCustomComponent` returns frozen objects. Document: define outside render for stable references.                                           |
| Security: custom component props could contain malicious values                                   | Medium     | Medium | Apply existing `sanitizeProps()` pipeline to custom components. Document that consumers are responsible for their component's internal security. |

---

## Alternatives Considered

### Alternative 1: Render-Only Extension (No Schema, No Prompt)

- **Description:** Only add the `customComponents` prop to UITreeRenderer for rendering. No schema validation or prompt generation.
- **Pros:** Simplest possible change; ships in 30 minutes
- **Cons:** Custom components have no validation (garbage in, garbage out). LLM can't know about custom types. Consumer has to manually edit system prompts.
- **Decision:** Rejected. The render layer already exists via the `components` prop. The real value is the full-stack extension (validation + prompt).

### Alternative 2: Wrapper Package

- **Description:** Create a new `@cloudflare/kumo-custom` package that wraps `UITreeRenderer` and adds extension APIs.
- **Pros:** Zero changes to `@cloudflare/kumo`; cleanly separated
- **Cons:** Extra package to install/maintain; indirection; can't extend `validateElement` or `buildComponentDocs` without exposing internal hooks. Consumer ends up importing from two packages.
- **Decision:** Rejected. The extension points are all inside `@cloudflare/kumo`; wrapping adds complexity without benefit.

### Alternative 3: Codegen-Based Extension

- **Description:** Extend the `codegen:registry` pipeline to accept external component definitions, auto-generating schemas and manifest entries.
- **Pros:** Single source of truth; no manual Zod schema writing
- **Cons:** Much larger scope; requires TypeScript type extraction from consumer code; couples consumer's build pipeline to Kumo's codegen
- **Decision:** Deferred to future iteration. Start with manual definition; add codegen later if demand warrants.

---

## Non-Goals (v1)

- **Auto-codegen for custom components** — custom components are NOT added to `component-registry.json` or `ai/schemas.ts`. Those remain auto-generated from Kumo source only. Deferred: codegen extension is a natural v2.
- **Custom component scaffolding CLI** — no `kumo add-custom-component` command. Consumer defines components in their own code.
- **Runtime schema generation from TypeScript types** — consumer provides Zod schemas manually. Deferred: could use `ts-json-schema-generator` in future.
- **Custom normalizers** — the 8 normalization passes in UITreeRenderer apply only to built-in types. Custom components skip normalization. Deferred: extension hook for normalizers is separate work.
- **Branch changes** — all work stays on `geoquant/streaming-ui`. No new branches.

---

## Interface Specifications

### API: defineCustomComponent

```ts
import { defineCustomComponent } from "@cloudflare/kumo/generative";

const MyWidget = defineCustomComponent({
  component: MyWidgetComponent,          // required: React.ElementType
  propsSchema: z.object({ ... }),        // optional: Zod schema
  description: "One-line description",   // optional: for LLM prompt
  props: {                               // optional: for LLM prompt
    propName: {
      type: "string",
      description: "What this prop does",
      optional: true,
      values: ["a", "b"],
      default: "a",
    },
  },
  category: "Custom",                    // optional, default "Other"
});
```

### API: UITreeRenderer

```tsx
import { UITreeRenderer } from "@cloudflare/kumo/generative";

<UITreeRenderer
  tree={tree}
  customComponents={{
    MyWidget: myWidgetDefinition,
    AnotherWidget: anotherDefinition,
  }}
  streaming
  onAction={handleAction}
/>;
```

### API: createKumoCatalog

```ts
import { createKumoCatalog, initCatalog } from "@cloudflare/kumo/catalog";

const catalog = createKumoCatalog({
  customComponents: {
    MyWidget: myWidgetDefinition,
    AnotherWidget: anotherDefinition,
  },
  actions: { ... },
});
await initCatalog(catalog);
const systemPrompt = catalog.generatePrompt();
```

---

## Documentation Requirements

- [ ] "Custom Components" section added to existing `streaming.astro` page
- [ ] Quick-start code example (render-only, 10 lines)
- [ ] Full example (render + schema + prompt, 30 lines)
- [ ] Caveats documented (define outside render, consumer manages prompts, no auto-codegen)

---

## Open Questions

| Question | Owner | Due Date | Status                         |
| -------- | ----- | -------- | ------------------------------ |
| (none)   | —     | —        | All resolved during spec phase |

---

## Appendix

### Glossary

- **COMPONENT_MAP** — frozen `Record<string, React.ComponentType>` mapping UITree type strings to React components. Built from auto-generated manifest + hand-written wrappers.
- **UITree** — `{ root: string; elements: Record<string, UIElement> }` — flat structure describing a UI. Built incrementally via RFC 6902 JSON Patch operations streamed from the LLM.
- **UIElement** — `{ key, type, props, children?, parentKey?, visible?, action? }` — a single node in the UITree.
- **ComponentPropsSchemas** — auto-generated map of component type -> Zod schema in `ai/schemas.ts`.
- **Catalog** — runtime module that validates UITrees and generates LLM system prompts from the component registry.

### References

- Spec: `specs/custom-components.md`
- Existing streaming docs: `packages/kumo-docs-astro/src/pages/streaming.astro`
- Component registry: `packages/kumo/ai/component-registry.json`
- Auto-generated schemas: `packages/kumo/ai/schemas.ts`
