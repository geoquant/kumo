# Custom Components for Kumo Streaming UI

**Type:** Feature Plan
**Effort:** M (1-3 hours)
**Branch:** `geoquant/streaming-ui` (CRITICAL: ONLY work on this branch)
**Status:** Ready for implementation

## Problem

Kumo's streaming UI system (`UITreeRenderer`) renders LLM-generated UI trees against a closed component map. Consumers who need proprietary/app-specific components (e.g., a `GeoQuantMap`, `TradingChart`, `RiskMatrix`) cannot extend the system without forking Kumo or upstreaming into the library.

The render-layer extension already exists (`UITreeRenderer` accepts a `components` prop since the current branch), but the **schema validation** and **LLM prompt generation** layers have no extension surface. This means:

- Custom components skip prop validation entirely (fall through to `VALID`)
- The LLM has no knowledge of custom component types, props, or usage patterns
- No documentation explains the extension workflow

## Discovery Summary

### What Already Exists

| Layer                      | Extension exists? | Location                                                                                                                                                                                          |
| -------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rendering**              | Yes               | `UITreeRenderer` accepts `components?: UITreeRendererComponents` prop. `mergeComponentMaps()` at `ui-tree-renderer.tsx:709` merges consumer map over `COMPONENT_MAP`. Consumer wins on collision. |
| **Unknown type detection** | Yes               | `getUnknownTypes(tree, components?)` at `ui-tree-renderer.tsx:1188` respects custom components                                                                                                    |
| **Action handlers**        | Yes               | `createHandlerMap(custom?)` at `action-registry.ts:397` already merges custom handlers                                                                                                            |
| **Schema validation**      | No                | `element-validator.ts:229` returns `VALID` for unknown types. No way to provide custom Zod schemas                                                                                                |
| **Prompt generation**      | No                | `buildComponentDocs()` and `buildSystemPrompt()` read only from auto-generated registry. No merge API                                                                                             |
| **Dev warnings**           | No                | Silent override when consumer collides with built-in names                                                                                                                                        |

### Architecture Diagram (Current Flow)

```
LLM stream
  -> createJsonlParser().push(chunk)
  -> parsePatchLine() -> applyPatch()
  -> useUITree() hook (useState<UITree>)
  -> UITreeRenderer
       -> mergeComponentMaps(COMPONENT_MAP, props.components)  <-- ALREADY EXISTS
       -> RenderElement
            -> componentMap[type] lookup
            -> validateElement() -> ComponentPropsSchemas[type]  <-- MISSING for custom
            -> render with error boundary
```

### Key Files

| File                                  | Lines     | Role                                                |
| ------------------------------------- | --------- | --------------------------------------------------- |
| `src/generative/ui-tree-renderer.tsx` | 628-636   | `UITreeRendererComponents` type + `components` prop |
| `src/generative/ui-tree-renderer.tsx` | 709-719   | `mergeComponentMaps()`                              |
| `src/generative/ui-tree-renderer.tsx` | 1161-1163 | `useMemo` merge in renderer                         |
| `src/generative/element-validator.ts` | 228-229   | Unknown type passthrough                            |
| `src/catalog/system-prompt.ts`        | 413-446   | `buildSystemPrompt()`                               |
| `src/catalog/prompt-builder.ts`       | 528-594   | `buildComponentDocs()`                              |
| `src/catalog/catalog.ts`              | 155-287   | `createKumoCatalog()`                               |
| `src/catalog/types.ts`                | 231-234   | `CatalogConfig`                                     |
| `src/generative/index.ts`             | 1-71      | Public exports                                      |
| `src/catalog/index.ts`                | 1-100     | Public exports                                      |

## Solution

### Design: `defineCustomComponent` + extension APIs

A single `defineCustomComponent()` function creates a typed component definition that can be consumed by all three layers (render, validation, prompt).

### 1. New Type: `CustomComponentDefinition`

```ts
// src/catalog/types.ts

import type { ZodType } from "zod";

/**
 * Definition for a custom component that extends the streaming UI system.
 * Consumed by UITreeRenderer (render), element-validator (validation),
 * and buildSystemPrompt (prompt generation).
 */
export interface CustomComponentDefinition {
  /** React component to render */
  readonly component: React.ElementType;
  /**
   * Optional Zod schema for prop validation.
   * When provided, props are validated at render time (same as built-in components).
   * When omitted, props pass through unvalidated.
   */
  readonly propsSchema?: ZodType;
  /**
   * Component description for the LLM system prompt.
   * Should be a one-line description like "Interactive map for geospatial data visualization."
   */
  readonly description?: string;
  /**
   * Prop documentation for the LLM system prompt.
   * Keys are prop names; values describe the prop for the LLM.
   */
  readonly props?: Record<string, CustomPropDefinition>;
  /**
   * Category for grouping in the system prompt.
   * @default "Other"
   */
  readonly category?: string;
}

export interface CustomPropDefinition {
  readonly type: string;
  readonly description?: string;
  readonly optional?: boolean;
  readonly values?: readonly string[];
  readonly default?: unknown;
}
```

### 2. Helper: `defineCustomComponent()`

```ts
// src/generative/define-custom-component.ts

/**
 * Type-safe factory for custom component definitions.
 * Returns a frozen CustomComponentDefinition.
 *
 * @example
 * const GeoMap = defineCustomComponent({
 *   component: GeoQuantMap,
 *   description: "Interactive map for geospatial data visualization.",
 *   propsSchema: z.object({
 *     latitude: z.number(),
 *     longitude: z.number(),
 *     zoom: z.number().optional(),
 *   }),
 *   props: {
 *     latitude: { type: "number", description: "Center latitude" },
 *     longitude: { type: "number", description: "Center longitude" },
 *     zoom: { type: "number", optional: true, default: 10 },
 *   },
 * });
 */
export function defineCustomComponent(
  definition: CustomComponentDefinition,
): Readonly<CustomComponentDefinition> {
  return Object.freeze(definition);
}
```

### 3. New Prop on `UITreeRenderer`: `customSchemas`

The `components` prop already handles the render map. Add an optional `customSchemas` prop for validation:

```ts
// ui-tree-renderer.tsx props addition

interface UITreeRendererProps {
  readonly tree: UITree;
  readonly components?: UITreeRendererComponents;
  /** Custom Zod schemas for validating custom component props at render time. */
  readonly customSchemas?: Readonly<Record<string, ZodType>>;
  readonly streaming?: boolean;
  readonly onAction?: ActionDispatch;
  readonly runtimeValueStore?: RuntimeValueStore;
}
```

**Alternative (preferred):** Accept `Record<string, CustomComponentDefinition>` as a single `customComponents` prop that replaces both `components` and `customSchemas`:

```ts
interface UITreeRendererProps {
  readonly tree: UITree;
  /** Extension/override map: UITree type string -> React component. */
  readonly components?: UITreeRendererComponents;
  /**
   * Custom component definitions with optional schemas and prompt metadata.
   * Components from this map are merged over COMPONENT_MAP (consumer wins).
   * If both `components` and `customComponents` provide the same type,
   * `customComponents` takes precedence.
   */
  readonly customComponents?: Readonly<
    Record<string, CustomComponentDefinition>
  >;
  readonly streaming?: boolean;
  readonly onAction?: ActionDispatch;
  readonly runtimeValueStore?: RuntimeValueStore;
}
```

The renderer extracts the component map and schema map from the definitions:

```ts
const componentMap = useMemo(() => {
  const customComponentMap: Record<string, React.ElementType> = {};
  if (customComponents) {
    for (const [type, def] of Object.entries(customComponents)) {
      customComponentMap[type] = def.component;
    }
  }
  return mergeComponentMaps(
    mergeComponentMaps(COMPONENT_MAP, components),
    customComponentMap,
  );
}, [components, customComponents]);

const customSchemaMap = useMemo(() => {
  if (!customComponents) return null;
  const schemas: Record<string, ZodType> = {};
  for (const [type, def] of Object.entries(customComponents)) {
    if (def.propsSchema) {
      schemas[type] = def.propsSchema;
    }
  }
  return Object.keys(schemas).length > 0 ? schemas : null;
}, [customComponents]);
```

### 4. Schema Validation for Custom Components

Modify `validateElement()` in `element-validator.ts` to accept an optional custom schema map:

```ts
// element-validator.ts

export function validateElement(
  element: UIElement,
  customSchemas?: Readonly<Record<string, ZodType>> | null,
): ElementValidationResult {
  const { key, type, props } = element;

  // Built-in schema check (existing logic)
  const builtinSchema =
    ComponentPropsSchemas[type as keyof typeof ComponentPropsSchemas];
  if (builtinSchema) {
    // existing validation logic...
  }

  // Custom schema check (NEW)
  if (customSchemas) {
    const customSchema = customSchemas[type];
    if (customSchema) {
      const result = customSchema.safeParse(normalizeProps(props));
      return toResult(key, type, result);
    }
  }

  // Unknown type — no schema to validate against
  return VALID;
}
```

The `UITreeRenderer` passes the custom schema map into `validateElement` via the existing render pipeline.

### 5. Prompt Generation Extension

Extend `CatalogConfig` and `buildSystemPrompt` to accept custom component documentation:

```ts
// src/catalog/types.ts — CatalogConfig extension

export interface CatalogConfig {
  actions?: Record<string, ActionDefinition>;
  /**
   * Custom component definitions for prompt generation.
   * These are appended to the "Available Components" section of the system prompt.
   */
  customComponents?: Readonly<Record<string, CustomComponentDefinition>>;
}
```

In `buildComponentDocs()` (prompt-builder.ts), append custom component docs after the registry components:

```ts
export function buildComponentDocs(
  registryJson: unknown,
  options: PromptBuilderOptions = {},
  customComponents?: Readonly<Record<string, CustomComponentDefinition>>,
): string {
  // ... existing logic ...

  // Append custom component docs
  if (customComponents) {
    const customLines: string[] = [];
    customLines.push("### Custom");
    for (const [type, def] of Object.entries(customComponents)) {
      const desc = def.description ?? "Custom component";
      customLines.push(`- **${type}** — ${desc}`);
      if (def.props) {
        for (const [propName, propDef] of Object.entries(def.props)) {
          const opt = propDef.optional ? "?" : "";
          const defVal =
            propDef.default !== undefined
              ? ` (default ${JSON.stringify(propDef.default)})`
              : "";
          customLines.push(`  - ${propName}${opt}: ${propDef.type}${defVal}`);
        }
      }
    }
    out.push(...customLines);
  }

  return out.join("\n").trimEnd();
}
```

### 6. Dev-Mode Collision Warning

In `mergeComponentMaps()` (or the new merge logic for `customComponents`), add:

```ts
if (process.env.NODE_ENV !== "production") {
  for (const key of Object.keys(overrides)) {
    if (key in base) {
      console.warn(
        `[kumo] Custom component "${key}" overrides built-in Kumo component. ` +
          `This is allowed but may cause unexpected behavior.`,
      );
    }
  }
}
```

### 7. Documentation

Add a "Custom Components" section to the existing `streaming.astro` page with:

1. **Explanation** of the extension model (render + validate + prompt)
2. **Quick start** code example showing `defineCustomComponent` + `UITreeRenderer`
3. **Full example** with schema validation and prompt generation
4. **Caveats** (consumer manages prompt engineering, no auto-codegen)

## Consumer Usage (End-to-End Example)

```tsx
import { UITreeRenderer } from "@cloudflare/kumo/generative";
import { defineCustomComponent } from "@cloudflare/kumo/generative";
import { createKumoCatalog, initCatalog } from "@cloudflare/kumo/catalog";
import { z } from "zod";

// 1. Define custom components
const customComponents = {
  GeoMap: defineCustomComponent({
    component: GeoQuantMap,
    description: "Interactive map for geospatial data visualization.",
    propsSchema: z.object({
      latitude: z.number(),
      longitude: z.number(),
      zoom: z.number().optional(),
    }),
    props: {
      latitude: { type: "number", description: "Center latitude" },
      longitude: { type: "number", description: "Center longitude" },
      zoom: {
        type: "number",
        optional: true,
        default: 10,
        description: "Zoom level",
      },
    },
  }),
  RiskMatrix: defineCustomComponent({
    component: RiskMatrixComponent,
    description: "Risk assessment matrix with severity/likelihood axes.",
    propsSchema: z.object({
      data: z.array(
        z.object({
          label: z.string(),
          severity: z.number(),
          likelihood: z.number(),
        }),
      ),
    }),
    props: {
      data: { type: "array", description: "Risk data points" },
    },
  }),
};

// 2. Create catalog with custom components (for prompt generation)
const catalog = createKumoCatalog({
  customComponents,
  actions: { submit_form: { description: "Submit the form" } },
});
await initCatalog(catalog);

// 3. Generate system prompt (includes custom component docs)
const systemPrompt = catalog.generatePrompt();

// 4. Render (UITreeRenderer validates + renders custom components)
<UITreeRenderer
  tree={tree}
  customComponents={customComponents}
  streaming
  onAction={handleAction}
/>;
```

## Deliverables (Ordered)

| #   | Deliverable                                                                          | Effort | Depends On |
| --- | ------------------------------------------------------------------------------------ | ------ | ---------- |
| D1  | `CustomComponentDefinition` + `CustomPropDefinition` types in `src/catalog/types.ts` | S      | -          |
| D2  | `defineCustomComponent()` helper in `src/generative/define-custom-component.ts`      | S      | D1         |
| D3  | `customComponents` prop on `UITreeRenderer` + merge logic                            | S      | D1, D2     |
| D4  | `validateElement()` extension to accept custom schemas                               | S      | D1         |
| D5  | `CatalogConfig.customComponents` + `buildComponentDocs()` extension for prompt       | S      | D1         |
| D6  | Dev-mode `console.warn` on built-in name collision                                   | S      | D3         |
| D7  | Exports from `@cloudflare/kumo/generative` and `@cloudflare/kumo/catalog`            | S      | D2-D5      |
| D8  | Documentation section in `streaming.astro` + example                                 | M      | D1-D7      |

## Non-Goals

- **Auto-codegen for custom components**: Custom components are NOT added to `component-registry.json` or `ai/schemas.ts`. Those remain auto-generated from Kumo source only.
- **Custom component scaffolding CLI**: No `kumo add-custom-component` command.
- **Runtime schema generation from TypeScript types**: Consumer provides Zod schemas manually.
- **Custom normalizers**: The 8 normalization passes in UITreeRenderer apply only to built-in types. Custom components skip normalization.
- **New branch**: All work stays on `geoquant/streaming-ui`.

## Risks

| Risk                                                                                      | Likelihood | Impact | Mitigation                                                                                                                                            |
| ----------------------------------------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema duplication (consumer defines props twice: Zod + prompt description)               | High       | Low    | Both are optional; consumer can use render-only mode. Document the pattern clearly. Future: generate prompt docs from Zod schema.                     |
| LLM generates invalid custom component trees despite prompt docs                          | Medium     | Medium | Validation layer catches bad props when schema provided. Error boundary wraps every element. Repair pipeline strips unrecognized props.               |
| Performance: `useMemo` deps change on every render if consumer creates definitions inline | Medium     | Low    | Document: define `customComponents` outside render or use `useMemo`. The `defineCustomComponent` helper returns frozen objects for stable references. |

## Trade-offs

| Choice                                                                                | What we get                                                  | What we give up                                                             |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Single `customComponents` prop (not separate `components` + `schemas` + `promptDocs`) | One extension surface, easy to understand                    | Slightly more complex type; existing `components` prop users need migration |
| Keep existing `components` prop alongside `customComponents`                          | Backward compatible; simple render-only override still works | Two ways to do the same thing                                               |
| Consumer-wins on collision                                                            | Maximum flexibility for overriding built-in behavior         | Risk of accidentally shadowing a built-in (mitigated by dev warning)        |
| Zod schema optional, not required                                                     | Lower barrier to entry; render-only mode is trivial          | Custom components can render garbage props silently                         |

**Recommendation:** Keep both `components` (render-only, backward compat) and `customComponents` (full-stack extension). Document `customComponents` as the recommended path; `components` as legacy/simple override.

## Backward Compatibility

- The existing `components` prop on `UITreeRenderer` continues to work unchanged
- The existing `UITreeRendererComponents` type is preserved
- `createKumoCatalog()` with no `customComponents` behaves identically to today
- `validateElement()` with no custom schemas behaves identically (unknown types return `VALID`)
- No changes to auto-generated files (`ai/schemas.ts`, `ai/component-registry.json`)

## Open Questions

None remaining. All resolved during clarification:

- Scope: full-stack (render + schema + prompt) -> resolved
- Error handling: validation via optional Zod schemas; error boundary catches render failures -> resolved
- Collision: consumer wins + dev warning -> resolved
- Streaming: same as built-in (partial render as props stream in) -> resolved
- Docs: section in streaming.astro page -> resolved
