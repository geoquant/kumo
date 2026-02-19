# PRD: Stack + Cluster Layout Primitives

**Date:** 2026-02-19

---

## Problem Statement

### What problem are we solving?

The LLM-driven UI generation system relies on raw `Div` elements with free-form Tailwind class strings for all layout beyond Grid columns and Surface cards. The LLM must independently compose strings like `"flex flex-col gap-4"` or `"flex justify-end gap-2 pt-4"` for every layout. This produces:

1. **Hallucinated classes** — the LLM invents non-existent Tailwind utilities
2. **Inconsistent spacing** — every `Div` gets a bespoke gap/padding string with no enforced design scale
3. **No semantic constraint** — the system prompt teaches free-form CSS instead of a constrained token vocabulary

The catalog has exactly two layout primitives: `Grid` (responsive column presets) and `Surface` (visual card). There is nothing for the two most common layout patterns:

- **Vertical stacking** — spacing between sections, form groups, card content
- **Horizontal clustering** — action button rows, badge groups, inline metadata

### Why now?

The LLM-generated UIs are visually broken. The screenshot shows chaotic layouts with invisible button text, inconsistent spacing, and layouts that feel randomly assembled. Every generated UI that needs vertical or horizontal flow forces the LLM into unconstrained Tailwind composition — the primary source of visual regressions. This blocks the product from being presentable.

### Who is affected?

- **Primary users:** LLM agents consuming the `@cloudflare/kumo` catalog to generate UIs via JSONL patches
- **Secondary users:** Developers composing layouts manually with `@cloudflare/kumo` components — they currently have no flex-flow primitives between raw `div` and `Grid`

---

## Proposed Solution

### Overview

Add two new Kumo components — **Stack** (vertical flow) and **Cluster** (horizontal flow) — following the Every Layout methodology and the existing Grid component's variant/gap pattern. Export from `@cloudflare/kumo`. Register in the component map, system prompt, and AI registry. Demote `Div` to escape-hatch status in the LLM system prompt.

### User Experience

#### User Flow: LLM generates a form with action buttons

1. LLM receives user prompt "create a contact form"
2. LLM emits JSONL patch creating a `Surface` containing a `Stack` (gap="lg") for the form sections
3. Within the Stack, LLM creates `Input` fields, labels, and a `Cluster` (justify="end", gap="sm") for the Submit/Cancel buttons
4. UITreeRenderer resolves `Stack` and `Cluster` from `COMPONENT_MAP` and renders Kumo components
5. Result: consistent vertical spacing between form sections, right-aligned horizontal button row with uniform gap

#### User Flow: Developer composes a card layout

1. Developer imports `Stack` and `Cluster` from `@cloudflare/kumo`
2. `<Stack gap="lg"><Heading /><Paragraph /><Cluster justify="end" gap="sm"><Button>Cancel</Button><Button>Save</Button></Cluster></Stack>`
3. Renders a vertical card layout with sections spaced at 24px, buttons right-aligned with 8px gaps

---

## End State

When this PRD is complete, the following will be true:

- [ ] `import { Stack, Cluster } from "@cloudflare/kumo"` works
- [ ] `Stack` renders a vertical flex container with constrained gap tokens
- [ ] `Cluster` renders a horizontal wrapping flex container with constrained gap, justify, align, and wrap tokens
- [ ] Both components appear in `ai/component-registry.json` after codegen
- [ ] Both components have demos in kumo-docs-astro for the codegen pipeline
- [ ] `COMPONENT_MAP` in kumo-stream includes Stack and Cluster
- [ ] System prompt teaches Stack/Cluster with constrained vocabulary and demotes Div
- [ ] System prompt examples use Stack/Cluster instead of Div for layout
- [ ] Streaming integration test uses valid Stack/Cluster types and props
- [ ] `pnpm --filter @cloudflare/kumo build` and `typecheck` pass
- [ ] Changeset created for minor version bump

---

## Success Metrics

### Quantitative

| Metric                        | Current                  | Target                  | Measurement Method                                             |
| ----------------------------- | ------------------------ | ----------------------- | -------------------------------------------------------------- |
| Div usage in LLM output       | ~80% of layouts use Div  | <20% of layouts use Div | Sample 20 generated UIs, count Div vs Stack/Cluster for layout |
| Hallucinated Tailwind classes | Frequent (unconstrained) | Near-zero for layout    | Layout classes are now component props, not free-form strings  |
| Spacing consistency           | Random per-Div           | Uniform per gap token   | Visual inspection: all same-level gaps should match            |

### Qualitative

- Generated UIs look intentionally designed rather than randomly assembled
- Developers can express common layouts without reaching for raw `div` + Tailwind

---

## Acceptance Criteria

### Feature: Stack Component

- [ ] `<Stack gap="base">` renders `display: flex; flex-direction: column;` with 16px gap
- [ ] `gap` prop accepts `"none" | "xs" | "sm" | "base" | "lg" | "xl"` tokens only
- [ ] `align` prop accepts `"start" | "center" | "end" | "stretch"` (default: `"stretch"`)
- [ ] `as` prop supports polymorphic element type (default: `"div"`)
- [ ] `className` prop merges via `cn()`
- [ ] Component uses `forwardRef` and sets `.displayName`
- [ ] Exports `KUMO_STACK_VARIANTS` and `KUMO_STACK_DEFAULT_VARIANTS`

### Feature: Cluster Component

- [ ] `<Cluster gap="base">` renders `display: flex; flex-wrap: wrap;` with 16px gap
- [ ] `gap` prop accepts `"none" | "xs" | "sm" | "base" | "lg" | "xl"` tokens only
- [ ] `justify` prop accepts `"start" | "center" | "end" | "between"` (default: `"start"`)
- [ ] `align` prop accepts `"start" | "center" | "end" | "baseline" | "stretch"` (default: `"center"`)
- [ ] `wrap` prop accepts `"wrap" | "nowrap"` (default: `"wrap"`)
- [ ] `as` prop supports polymorphic element type (default: `"div"`)
- [ ] `className` prop merges via `cn()`
- [ ] Component uses `forwardRef` and sets `.displayName`
- [ ] Exports `KUMO_CLUSTER_VARIANTS` and `KUMO_CLUSTER_DEFAULT_VARIANTS`

### Feature: Unified Gap Token Scale

- [ ] Stack and Cluster share the same gap token → pixel mapping
- [ ] Scale: `none`=0, `xs`=4px (gap-1), `sm`=8px (gap-2), `base`=16px (gap-4), `lg`=24px (gap-6), `xl`=32px (gap-8)
- [ ] Grid's gap scale remains as-is (it has responsive behavior that differs by nature)

### Feature: System Integration

- [ ] `COMPONENT_MAP` in `_examples/kumo-stream/src/core/component-map.ts` includes Stack and Cluster
- [ ] System prompt Layout section teaches Stack, Cluster, Surface, Grid, and demotes Div to "escape hatch — AVOID"
- [ ] System prompt Example 2 (Doctor Appointment Form) uses Cluster for button row, Stack for card content
- [ ] Streaming integration test at line 282 uses `Cluster` (horizontal layout) with valid props
- [ ] Demo components added in `packages/kumo-docs-astro/src/components/demos/` for Stack and Cluster
- [ ] `pnpm --filter @cloudflare/kumo codegen:registry` includes Stack and Cluster in output

---

## Technical Context

### Existing Patterns

- `packages/kumo/src/components/grid/grid.tsx` — The pattern to follow: `KUMO_GRID_VARIANTS` const, typed gap/variant unions, `forwardRef`, `displayName`, `cn()` composition, Context for sub-components
- `packages/kumo/src/components/surface/surface.tsx` — Simpler pattern: polymorphic `as` prop, semantic token styling
- `_examples/kumo-stream/src/core/UITreeRenderer.tsx:124-147` — Div special-case: not a Kumo component, hardcoded `<div>` with `className` passthrough and prop sanitization
- `_examples/kumo-stream/src/core/system-prompt.ts:79-86` — Current Layout section teaching Div as primary layout tool

### Key Files

- `packages/kumo/src/components/grid/grid.tsx` — Reference implementation for variant-based layout component
- `packages/kumo/src/index.ts` — Barrel exports (`PLOP_INJECT_EXPORT` marker)
- `packages/kumo/vite.config.ts` — Build entries (`PLOP_INJECT_COMPONENT_ENTRY` marker)
- `_examples/kumo-stream/src/core/component-map.ts` — Maps type strings to React components (16 entries)
- `_examples/kumo-stream/src/core/system-prompt.ts` — LLM instruction prompt (180 lines)
- `_examples/kumo-stream/src/__tests__/streaming-integration.test.ts:282` — Test already references `"Stack"` with wrong props
- `packages/kumo/ai/schemas.ts` — Auto-generated Zod schemas (regenerated via codegen)
- `packages/kumo/ai/component-registry.json` — Auto-generated registry (regenerated via codegen)
- `packages/kumo/scripts/component-registry/index.ts` — Registry codegen orchestrator
- `packages/kumo-docs-astro/src/components/demos/` — Demo components fed into registry codegen

### System Dependencies

- Tailwind CSS v4 (already configured) — provides `gap-*`, `flex`, `flex-col`, `flex-wrap`, `items-*`, `justify-*` utilities
- `cn()` utility from `packages/kumo/src/utils/cn.ts` — className composition
- Base UI (`@base-ui/react`) — not needed; Stack/Cluster are pure layout, no interactive behavior
- `pnpm --filter @cloudflare/kumo new:component` — scaffolding tool (or manual creation following Grid pattern)

---

## Risks & Mitigations

| Risk                                                  | Likelihood | Impact | Mitigation                                                                                                                       |
| ----------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| LLM still uses Div from training habits               | Medium     | Low    | System prompt explicitly says "AVOID — prefer Stack/Cluster". All examples demonstrate alternatives. Monitor and iterate prompt. |
| Scaffolding tool fails or is unavailable              | Low        | Medium | Create files manually following Grid's exact pattern. Files needed are predictable.                                              |
| Gap token scale conflicts with Grid's responsive gaps | Low        | Low    | Stack/Cluster use static gap tokens. Grid keeps its responsive behavior. Document the distinction.                               |
| Registry codegen doesn't pick up new components       | Low        | Medium | Codegen uses auto-discovery from `src/components/`. Verify with `--no-cache` flag.                                               |
| Docs demo dependency blocks registry codegen          | Medium     | Medium | Create minimal demos. Cross-package build order: demos first, then registry.                                                     |

---

## Alternatives Considered

### Alternative 1: Single Flex Component

- **Description:** One `Flex` component with `direction` prop for both vertical and horizontal.
- **Pros:** Fewer components, familiar API.
- **Cons:** LLM needs two correct tokens (`type: "Flex"` + `direction: "column"`) instead of one (`type: "Stack"`). Higher error surface — LLM can produce horizontal Stack by accident. Doesn't match Every Layout's "each component does one thing" philosophy.
- **Decision:** Rejected. Two distinct semantic names reduce LLM confusion and match the Every Layout source material.

### Alternative 2: Extend Grid to Handle Flex Layouts

- **Description:** Add `mode: "flex"` to Grid with direction/wrap props.
- **Pros:** No new components.
- **Cons:** Overloads Grid's responsibility. Grid is CSS Grid; flex flow is fundamentally different. Breaks Grid's clean variant model (column presets don't apply to flex layouts).
- **Decision:** Rejected. Separate concerns.

### Alternative 3: Remove Div Entirely

- **Description:** Delete the Div escape hatch from UITreeRenderer.
- **Pros:** Forces all layout through constrained components.
- **Cons:** Breaking change. Some edge cases genuinely need raw positioning or layout patterns not covered by Stack/Cluster/Grid.
- **Decision:** Rejected. Demote in prompt but keep for backward compatibility and edge cases.

---

## Non-Goals (v1)

- **`recursive` prop** — Every Layout's Stack supports recursive spacing to all descendants. **Not planned.** Nested Stacks are the correct composable pattern. If prose/markdown content demands it later, a CSS custom property escape hatch or a dedicated `Prose` component is preferred over overloading Stack (see Resolved Questions).
- **`splitAfter` prop** — Every Layout's Stack supports auto-margin splitting after nth child. **Not planned.** The composition alternative (`<Stack><Stack>top</Stack><Cluster justify="end">bottom</Cluster></Stack>`) is explicit and doesn't require `React.Children.map` or magic nth-child margins.
- **Center/Sidebar/Switcher/Cover** — Stack + Cluster cover the two most common missing patterns. Other Every Layout primitives can be added later if needed.
- **Catalog module type changes** — Stack and Cluster are standard Kumo components; no `UIElement` schema changes required.
- **Figma plugin generators** — Out of scope. Figma generators for Stack/Cluster can follow separately.
- **A2UI protocol alignment** — Priority is "what works for producing better LLM results", not protocol compatibility.
- **Grid gap scale changes** — Grid's responsive gap behavior (`gap-2 md:gap-6 lg:gap-8` for base) is intentionally different from Stack/Cluster's static gaps. No migration needed — each component optimizes for its spatial context. Token names (`base`, `sm`) are intentionally reused to mean "the sensible default" per-component (see Resolved Questions).

---

## Interface Specifications

### Component: Stack

```tsx
import { Stack } from "@cloudflare/kumo";

// Basic vertical stacking
<Stack gap="base">
  <Heading>Title</Heading>
  <Paragraph>Content</Paragraph>
</Stack>

// Tight vertical stack, centered items
<Stack gap="sm" align="center">
  <Icon />
  <Label />
</Stack>

// Semantic HTML element
<Stack as="section" gap="lg">
  <article>...</article>
  <article>...</article>
</Stack>
```

**Props:**

| Prop        | Type                                               | Default     | Description                       |
| ----------- | -------------------------------------------------- | ----------- | --------------------------------- |
| `gap`       | `"none" \| "xs" \| "sm" \| "base" \| "lg" \| "xl"` | `"base"`    | Vertical space between children   |
| `align`     | `"start" \| "center" \| "end" \| "stretch"`        | `"stretch"` | Cross-axis (horizontal) alignment |
| `as`        | `React.ElementType`                                | `"div"`     | Rendered HTML element             |
| `className` | `string`                                           | —           | Additional classes via `cn()`     |
| `children`  | `React.ReactNode`                                  | —           | Child elements                    |

**Rendered output:** `<div class="flex flex-col gap-4 items-stretch {className}">...</div>`

### Component: Cluster

```tsx
import { Cluster } from "@cloudflare/kumo";

// Right-aligned button row
<Cluster gap="sm" justify="end">
  <Button variant="ghost">Cancel</Button>
  <Button>Save</Button>
</Cluster>

// Wrapping tag list
<Cluster gap="xs" wrap="wrap">
  <Badge>React</Badge>
  <Badge>TypeScript</Badge>
  <Badge>Tailwind</Badge>
</Cluster>

// Space-between header
<Cluster justify="between" align="center">
  <Logo />
  <Nav />
</Cluster>
```

**Props:**

| Prop        | Type                                                      | Default    | Description                         |
| ----------- | --------------------------------------------------------- | ---------- | ----------------------------------- |
| `gap`       | `"none" \| "xs" \| "sm" \| "base" \| "lg" \| "xl"`        | `"base"`   | Space between items                 |
| `justify`   | `"start" \| "center" \| "end" \| "between"`               | `"start"`  | Main-axis (horizontal) distribution |
| `align`     | `"start" \| "center" \| "end" \| "baseline" \| "stretch"` | `"center"` | Cross-axis (vertical) alignment     |
| `wrap`      | `"wrap" \| "nowrap"`                                      | `"wrap"`   | Whether items wrap to next line     |
| `as`        | `React.ElementType`                                       | `"div"`    | Rendered HTML element               |
| `className` | `string`                                                  | —          | Additional classes via `cn()`       |
| `children`  | `React.ReactNode`                                         | —          | Child elements                      |

**Rendered output:** `<div class="flex flex-wrap gap-4 justify-start items-center {className}">...</div>`

### Unified Gap Token Scale

| Token  | Tailwind Class | Pixels | Use Case                     |
| ------ | -------------- | ------ | ---------------------------- |
| `none` | `gap-0`        | 0px    | Flush elements               |
| `xs`   | `gap-1`        | 4px    | Tight inline groups          |
| `sm`   | `gap-2`        | 8px    | Button groups, compact lists |
| `base` | `gap-4`        | 16px   | Default section spacing      |
| `lg`   | `gap-6`        | 24px   | Major section divisions      |
| `xl`   | `gap-8`        | 32px   | Page-level sections          |

### System Prompt: Layout Section (replacement)

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
- **Surface** — Card/container with border and shadow. No layout behavior.
- **Grid** — Responsive grid: variant: "2up" | "3up" | "4up" | etc. gap: "none" | "sm" | "base" | "lg"
- **Div** — Escape hatch (AVOID — prefer Stack/Cluster/Grid). Only when no component can express the layout.
```

---

## Documentation Requirements

- [ ] Demo components in `packages/kumo-docs-astro/src/components/demos/` for Stack and Cluster
- [ ] `ai/component-registry.json` and `ai/component-registry.md` updated via codegen
- [ ] `ai/schemas.ts` updated via codegen
- [ ] System prompt in kumo-stream updated with new Layout section and examples

---

## Open Questions

| Question                                                                               | Owner | Due Date | Status   | Resolution          |
| -------------------------------------------------------------------------------------- | ----- | -------- | -------- | ------------------- |
| Should Grid's gap scale be migrated to the unified scale in a follow-up?               | —     | —        | Resolved | No. See below.      |
| What's the v2 CSS approach for `recursive` — CSS custom properties or Tailwind plugin? | —     | —        | Resolved | Neither. See below. |

### Resolved: Grid Gap Scale Migration

**Decision: Do not migrate Grid's gap scale.**

Analysis of all 16 Grid `gap` usages across the codebase shows:

- Grid's `base` gap is **responsive** (`gap-2 md:gap-6 lg:gap-8` = 8px→24px→32px). Stack/Cluster use **static** gaps. These are fundamentally different behaviors.
- `GridMobileDividerDemo` couples responsive gap with responsive border behavior (`pb-8 md:pb-0`). Changing gap behavior would break this coupling.
- The system prompt teaches Grid gap as flat tokens (`"none" | "sm" | "base" | "lg"`) — the LLM is unaware of the responsive behavior, so the semantic names are already consistent from the LLM's perspective.
- Zero external runtime consumers of `gridVariants()` or `KUMO_GRID_VARIANTS` — but Grid's responsive base gap is the **default** for every `<Grid>` without an explicit `gap` prop.
- Zero test coverage for gap behavior, making any migration risky without adding tests first.

Grid keeps its 4-token scale (`none`/`sm`/`base`/`lg`) with responsive base. Stack/Cluster get the 6-token scale (`none`/`xs`/`sm`/`base`/`lg`/`xl`) with static values. The token names overlap intentionally — `base` means "the sensible default" for each component, even though the pixel values differ. This is consistent with how Grid's `sm` (12px) differs from Stack/Cluster's `sm` (8px) — each component optimizes for its own spatial context.

### Resolved: Recursive Approach for v2

**Decision: Do not implement `recursive` as a prop. Recommend nested Stacks instead. If prose/markdown content demands it later, add a CSS custom property escape hatch — not a Tailwind plugin or React.Children manipulation.**

Rationale:

1. **Nested Stacks are the correct pattern.** `<Stack gap="lg"><Stack gap="sm">...</Stack></Stack>` is explicit, composable, and matches how every other Kumo layout primitive works. CSS `gap` is the modern approach; margin-based `* + *` selectors are a pre-gap workaround.

2. **`recursive` causes spooky action at a distance.** A recursive Stack changes spacing for components nested arbitrarily deep — components that didn't ask for it. This violates Kumo's principle of composable, predictable layout primitives.

3. **LLM consumers will never use it** (confirmed in spec). Adding complexity to the component for a feature only human developers would use, and that has better alternatives, is entropy.

4. **If a prose/markdown escape hatch is ever needed**, the approach is:
   - Add a global CSS rule in `kumo.css`: `[data-stack-recursive] > * + * { margin-block-start: var(--stack-space); }`
   - Stack sets `--stack-space` via style prop and `data-stack-recursive` attribute when opt-in
   - Mutually exclusive with `gap` classes (margin-based, not gap-based)
   - Or better: create a dedicated `Prose` component for uncontrolled HTML content instead of overloading Stack

5. **`splitAfter` similarly deferred** — the composition alternative is `<Stack><Stack>top group</Stack><Cluster justify="end">bottom group</Cluster></Stack>`. Explicit grouping > magic nth-child margins.

---

## Appendix

### Glossary

- **Stack:** Every Layout primitive for vertical flow with consistent spacing between children. `flex-direction: column` + `gap`.
- **Cluster:** Every Layout primitive for horizontal wrapping flow. `flex-wrap: wrap` + `gap` + `justify-content`.
- **UITree:** The flat JSON structure the LLM emits via JSONL patches. `{ root: string, elements: Record<string, UIElement> }`.
- **JSONL patches:** RFC 6902 JSON Patch operations emitted one-per-line by the LLM to build the UITree incrementally.
- **Div:** Special-case in UITreeRenderer that renders a raw `<div>` with `className` passthrough. Not a Kumo component.

### References

- `specs/stack-cluster-layout-primitives.md` — Original technical spec
- `every-layout.md` — Every Layout book: Stack (lines 3269-3800), Cluster (lines 5373-5997)
- `packages/kumo/src/components/grid/grid.tsx` — Reference component pattern
- `_examples/kumo-stream/src/core/system-prompt.ts` — Current LLM system prompt
- `_examples/kumo-stream/src/__tests__/streaming-integration.test.ts:282` — Anticipatory Stack reference
