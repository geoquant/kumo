# Stack + Cluster Layout Primitives

**Type:** Feature Plan
**Effort:** L (1-2 days)
**Status:** Ready for task breakdown

## Problem

The LLM generates layouts by composing Tailwind strings on raw `Div` elements (`"flex flex-col gap-4"`, `"flex justify-end gap-2 pt-4"`). This produces:

1. **Hallucinated classes** — LLM invents non-existent Tailwind utilities
2. **Inconsistent spacing** — every Div gets a bespoke gap/padding string
3. **No semantic constraint** — the system prompt teaches free-form CSS instead of a constrained token vocabulary

The catalog has exactly two layout primitives: `Grid` (responsive column presets) and `Surface` (visual card). There is nothing for the two most common patterns:

- **Vertical stacking** — spacing between sections, form groups, card content
- **Horizontal clustering** — action button rows, badge groups, inline metadata

## Discovery

### Explored

- `packages/kumo/src/components/grid/grid.tsx` — variant/gap pattern, `KUMO_GRID_VARIANTS`, `forwardRef`, `displayName`
- `_examples/kumo-stream/src/core/` — UITreeRenderer, component-map, system-prompt, Div special-case
- `every-layout.md` — Stack (lines 3269-3800) and Cluster (lines 5373-5700) implementations
- `packages/kumo/src/catalog/types.ts` — UIElement structure
- `ai/schemas.ts` — component registration, codegen pipeline

### Key Findings

- `Div` is **not a Kumo component** — it's a special-case in `UITreeRenderer.tsx` (line 124-147) that renders a native `<div>` with only `className`, `style`, `id`, `data-*`, `aria-*`, `role`
- The system prompt (line 85-86) teaches the LLM: `Div — Generic flex container... Pass Tailwind utility classes via className`
- The streaming test at line 282 already references `"Stack"` with `{ direction: "horizontal", gap: "4" }` — anticipated but never built
- Grid follows a strict pattern: `KUMO_GRID_VARIANTS` object, semantic gap tokens (`none`/`sm`/`base`/`lg`), `forwardRef`, `displayName`
- Every Layout's Stack = `flex-direction: column` + `gap` between children; Cluster = `flex-wrap: wrap` + `gap` + `justify-content`

## Recommendation

Add two new Kumo components — **Stack** and **Cluster** — following the Grid component's variant/gap pattern. Export from `@cloudflare/kumo`. Register in the component map and system prompt. Demote `Div` to escape-hatch status.

### Why Two Components, Not One

A single `Flex` component with `direction` prop was considered. Two distinct names are better because:

1. **LLM token economy** — `"Stack"` is unambiguous; `"Flex"` with `direction="column"` requires two correct tokens
2. **Error surface** — an LLM can't produce a horizontal Stack by accident; each component has one job
3. **Matches Every Layout** — Stack and Cluster have distinct CSS strategies (Stack uses `> * + *` margin pattern; Cluster uses `flex-wrap`)
4. **Grid precedent** — Grid doesn't try to be a flex container too

## Deliverables

### D1. Stack Component (M)

**Depends on:** nothing

**File:** `packages/kumo/src/components/stack/stack.tsx`

```typescript
// Variant definitions
export const KUMO_STACK_VARIANTS = {
  gap: {
    none: { classes: "gap-0", description: "No gap between items" },
    xs: { classes: "gap-1", description: "Extra small gap (4px)" },
    sm: { classes: "gap-2", description: "Small gap (8px)" },
    base: { classes: "gap-4", description: "Default gap (16px)" },
    lg: { classes: "gap-6", description: "Large gap (24px)" },
    xl: { classes: "gap-8", description: "Extra large gap (32px)" },
  },
  align: {
    start: { classes: "items-start", description: "Align items to start" },
    center: { classes: "items-center", description: "Center items" },
    end: { classes: "items-end", description: "Align items to end" },
    stretch: { classes: "items-stretch", description: "Stretch items to fill" },
  },
} as const;

export const KUMO_STACK_DEFAULT_VARIANTS = {
  gap: "base",
  align: "stretch",
} as const;
```

**Props (full Every Layout API):**

| Prop         | Type                                               | Default     | Description                                                |
| ------------ | -------------------------------------------------- | ----------- | ---------------------------------------------------------- |
| `gap`        | `"none" \| "xs" \| "sm" \| "base" \| "lg" \| "xl"` | `"base"`    | Space between children                                     |
| `align`      | `"start" \| "center" \| "end" \| "stretch"`        | `"stretch"` | Cross-axis alignment                                       |
| `recursive`  | `boolean`                                          | `false`     | Apply spacing to all descendants, not just direct children |
| `splitAfter` | `number`                                           | —           | Push children after this index to the end (auto margin)    |
| `as`         | `ElementType`                                      | `"div"`     | Polymorphic element type                                   |
| `className`  | `string`                                           | —           | Additional classes via `cn()`                              |
| `children`   | `ReactNode`                                        | —           | Child elements                                             |

**Implementation:**

- Base: `flex flex-col` (always vertical — that's what Stack means)
- Gap via variant classes (not inline styles)
- `recursive` mode: use `[&_*+*]` descendant selector variant or a CSS custom property approach. Pragmatic choice: add a data attribute `data-recursive` and use Tailwind's `[&_>_*+*]:mt-*` vs `[&_*+*]:mt-*` pattern. **Simpler approach**: when `recursive`, apply gap via `space-y-*` on `[&_*]` selector. Actually simplest: just toggle between `> * + *` (default) and `* + *` (recursive) — but since we're using `gap`, recursion means applying the gap to nested flex contexts too. **Decision: use CSS class approach**. Non-recursive = standard `gap`. Recursive = apply `[&_*+*]:mt-{n}` via an additional class (gap doesn't cascade). Document that recursive is best-effort with flex `gap`.
- `splitAfter`: use `[&>:nth-child(n+${splitAfter+1})]:mt-auto` — this requires dynamic class generation. Use inline style on the specific child instead, via a context + wrapper. **Simpler**: Stack wraps children and applies `margin-block-end: auto` to the child at index `splitAfter`. Implemented via `React.Children.map` + clone.

**Recursive & splitAfter complexity note:** These are advanced features from Every Layout. For LLM consumption, `gap` and `align` cover 95% of use cases. `recursive` and `splitAfter` are primarily for human developers composing Stack manually. The LLM system prompt should only teach `gap` and `align`.

### D2. Cluster Component (M)

**Depends on:** nothing (can be parallel with D1)

**File:** `packages/kumo/src/components/cluster/cluster.tsx`

```typescript
export const KUMO_CLUSTER_VARIANTS = {
  gap: {
    none: { classes: "gap-0", description: "No gap between items" },
    xs: { classes: "gap-1", description: "Extra small gap (4px)" },
    sm: { classes: "gap-2", description: "Small gap (8px)" },
    base: { classes: "gap-3", description: "Default gap (12px)" },
    lg: { classes: "gap-4", description: "Large gap (16px)" },
    xl: { classes: "gap-6", description: "Extra large gap (24px)" },
  },
  justify: {
    start: { classes: "justify-start", description: "Pack items to start" },
    center: { classes: "justify-center", description: "Center items" },
    end: { classes: "justify-end", description: "Pack items to end" },
    between: {
      classes: "justify-between",
      description: "Distribute with space between",
    },
  },
  align: {
    start: { classes: "items-start", description: "Align items to start" },
    center: { classes: "items-center", description: "Center items vertically" },
    end: { classes: "items-end", description: "Align items to end" },
    baseline: {
      classes: "items-baseline",
      description: "Align items to text baseline",
    },
    stretch: { classes: "items-stretch", description: "Stretch items" },
  },
  wrap: {
    wrap: { classes: "flex-wrap", description: "Wrap items to next line" },
    nowrap: {
      classes: "flex-nowrap",
      description: "Keep all items on one line",
    },
  },
} as const;

export const KUMO_CLUSTER_DEFAULT_VARIANTS = {
  gap: "base",
  justify: "start",
  align: "center",
  wrap: "wrap",
} as const;
```

**Props (full Every Layout API):**

| Prop        | Type                                                      | Default    | Description                     |
| ----------- | --------------------------------------------------------- | ---------- | ------------------------------- |
| `gap`       | `"none" \| "xs" \| "sm" \| "base" \| "lg" \| "xl"`        | `"base"`   | Space between items             |
| `justify`   | `"start" \| "center" \| "end" \| "between"`               | `"start"`  | Main-axis distribution          |
| `align`     | `"start" \| "center" \| "end" \| "baseline" \| "stretch"` | `"center"` | Cross-axis alignment            |
| `wrap`      | `"wrap" \| "nowrap"`                                      | `"wrap"`   | Whether items wrap to next line |
| `as`        | `ElementType`                                             | `"div"`    | Polymorphic element type        |
| `className` | `string`                                                  | —          | Additional classes via `cn()`   |
| `children`  | `ReactNode`                                               | —          | Child elements                  |

**Implementation:**

- Base: `flex` (horizontal by default — that's what Cluster means)
- `flex-wrap: wrap` by default (key Cluster behavior — items flow like words)
- Gap, justify, align, wrap all via variant classes

**Design note on gap tokens:** Cluster's default gap is intentionally smaller than Stack's (`"base"` = `gap-3` / 12px for Cluster vs `gap-4` / 16px for Stack). Horizontal items are typically more tightly spaced than vertical sections. This mirrors Grid's `sm` gap of `gap-3`.

### D3. Scaffold & Export (S)

**Depends on:** D1, D2

Use `pnpm --filter @cloudflare/kumo new:component` or manually:

1. Create `src/components/stack/index.ts` and `src/components/cluster/index.ts` barrel exports
2. Add exports to `src/index.ts` at `PLOP_INJECT_EXPORT` marker
3. Add entries to `vite.config.ts` at `PLOP_INJECT_COMPONENT_ENTRY` marker
4. Verify `pnpm --filter @cloudflare/kumo build` succeeds

### D4. Component Map + System Prompt Update (S)

**Depends on:** D3

**`_examples/kumo-stream/src/core/component-map.ts`:**

```typescript
import { ..., Stack, Cluster } from "@cloudflare/kumo";

export const COMPONENT_MAP = {
  // Layout
  Surface: Surface as AnyComponent,
  Grid: Grid as AnyComponent,
  Stack: Stack as AnyComponent,      // NEW
  Cluster: Cluster as AnyComponent,  // NEW
  ...
};
```

**`_examples/kumo-stream/src/core/system-prompt.ts`:**

Replace the Layout section (lines 79-86) with:

```
### Layout
- **Stack** — Vertical flow: `{ type: "Stack", props: { gap: "base" }, children: [...] }`
  - Stacks children vertically with consistent spacing. USE THIS for page sections, form groups, card content.
  - gap: "none" | "xs" | "sm" | "base" | "lg" | "xl" (default: "base")
  - align: "start" | "center" | "end" | "stretch" (default: "stretch")
- **Cluster** — Horizontal flow: `{ type: "Cluster", props: { gap: "sm", justify: "end" }, children: [...] }`
  - Wraps children horizontally like words in a sentence. USE THIS for button rows, badge groups, metadata.
  - gap: "none" | "xs" | "sm" | "base" | "lg" | "xl" (default: "base")
  - justify: "start" | "center" | "end" | "between" (default: "start")
  - align: "start" | "center" | "end" | "baseline" | "stretch" (default: "center")
  - wrap: "wrap" | "nowrap" (default: "wrap")
- **Surface** — Card/container: `{ type: "Surface", props: {}, children: [...] }`
  - Renders as a card with border and shadow. No variant prop needed.
- **Grid** — Responsive grid: `{ type: "Grid", props: { variant: "2up", gap: "base" }, children: [...] }`
  - variant: "2up" | "side-by-side" | "2-1" | "1-2" | "3up" | "4up" | "6up"
  - gap: "none" | "sm" | "base" | "lg"
- **Div** — Escape hatch (AVOID — prefer Stack/Cluster): `{ type: "Div", props: { className: "..." }, children: [...] }`
  - Only use when Stack/Cluster/Grid cannot express the layout.
```

Update Example 2 (Doctor Appointment Form) to use Stack + Cluster instead of Div:

```
// Before:
{"op":"add","path":"/elements/actions","value":{"key":"actions","type":"Div","props":{"className":"flex justify-end gap-2 pt-4"},"children":["cancel-btn","submit-btn"],"parentKey":"card"}}

// After:
{"op":"add","path":"/elements/actions","value":{"key":"actions","type":"Cluster","props":{"gap":"sm","justify":"end"},"children":["cancel-btn","submit-btn"],"parentKey":"card"}}
```

And wrap the card content in a Stack:

```
// Before:
{"op":"add","path":"/elements/card","value":{"key":"card","type":"Surface","props":{},"children":["heading","subtitle","form-grid","actions"]}}

// After — Surface wraps a Stack for consistent vertical spacing:
{"op":"add","path":"/elements/card","value":{"key":"card","type":"Surface","props":{},"children":["card-stack"]}}
{"op":"add","path":"/elements/card-stack","value":{"key":"card-stack","type":"Stack","props":{"gap":"lg"},"children":["heading","subtitle","form-grid","actions"],"parentKey":"card"}}
```

### D5. Fix Streaming Integration Test (S)

**Depends on:** D4

`_examples/kumo-stream/src/__tests__/streaming-integration.test.ts` line 282 already uses `"Stack"`. Update the props to match the actual API:

```typescript
// Before:
el("layout-1", "Stack", { direction: "horizontal", gap: "4" }, [
  "card-a",
  "card-b",
]);

// After (this was horizontal, so it should be Cluster):
el("layout-1", "Cluster", { gap: "base" }, ["card-a", "card-b"]);
```

### D6. Registry Codegen (S)

**Depends on:** D3

Run `pnpm --filter @cloudflare/kumo codegen:registry` to regenerate `ai/component-registry.json` and `ai/schemas.ts` with the new Stack and Cluster components.

### D7. Changeset (S)

**Depends on:** D1-D6

`pnpm changeset` — minor version bump for `@cloudflare/kumo` since this adds new public exports.

## Trade-offs

| Decision                         | Chose                    | Over                       | Why                                                                        |
| -------------------------------- | ------------------------ | -------------------------- | -------------------------------------------------------------------------- |
| Two components (Stack + Cluster) | Semantic clarity         | Single Flex component      | LLM can't confuse vertical/horizontal; matches Every Layout                |
| Semantic gap tokens              | `none/xs/sm/base/lg/xl`  | Numeric scale or free-form | Constrains LLM choices; consistent with Grid's pattern                     |
| Different default gaps           | Stack=16px, Cluster=12px | Same default               | Vertical sections need more breathing room than inline groups              |
| Expose recursive/splitAfter      | Full API for human devs  | Minimal API                | You asked for full Every Layout; LLM prompt only teaches gap/align/justify |
| Keep Div as escape hatch         | Demoted in prompt        | Remove entirely            | Some edge cases need raw Tailwind; removing breaks backward compat         |
| `as` polymorphic prop            | Matches Surface pattern  | Fixed div                  | `<Stack as="section">` is useful for semantics                             |

## Risks

| Risk                                                          | Likelihood | Impact | Mitigation                                                                                                                   |
| ------------------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| LLM still uses Div from habit/training                        | Medium     | Low    | System prompt explicitly says "AVOID — prefer Stack/Cluster". Examples demonstrate alternatives. Monitor and iterate prompt. |
| `recursive` prop produces unexpected layout with Tailwind gap | Medium     | Low    | Document limitation. Gap doesn't cascade; recursive uses `[&_*+*]:mt-*` pattern instead. Test thoroughly.                    |
| Scaffolding tool unavailable / breaks                         | Low        | Medium | Can create files manually following Grid's exact pattern.                                                                    |

## Non-Goals

- **No Center/Sidebar/Switcher/Cover** — Stack + Cluster cover the two missing patterns. Others can be added later if needed.
- **No changes to catalog module types** — Stack and Cluster are standard Kumo components; no UIElement schema changes needed.
- **No Figma plugin generators** — Out of scope for this spec.
- **No A2UI alignment** — Priority is "what works for producing better results", not protocol compatibility.

## Acceptance Criteria

1. `import { Stack, Cluster } from "@cloudflare/kumo"` works
2. `<Stack gap="base"><div>A</div><div>B</div></Stack>` renders vertical flex with 16px gap
3. `<Cluster gap="sm" justify="end"><Button>Cancel</Button><Button>Save</Button></Cluster>` renders horizontal flex-wrap with 8px gap, right-aligned
4. `<Stack recursive gap="sm">` applies spacing to nested descendants
5. `<Stack splitAfter={2}>` pushes 3rd+ children to bottom via auto margin
6. Both components appear in `ai/component-registry.json` after codegen
7. `COMPONENT_MAP` in kumo-stream includes Stack and Cluster
8. System prompt teaches Stack/Cluster with constrained token vocabulary
9. System prompt demotes Div to "escape hatch"
10. System prompt Example 2 uses Cluster for button row instead of Div
11. Streaming integration test at line 282 uses valid component type + props
12. `pnpm --filter @cloudflare/kumo build` passes
13. `pnpm --filter @cloudflare/kumo typecheck` passes

## Open Questions

None — all resolved during CLARIFY phase.
