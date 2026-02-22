# Generative UI Output Quality Improvements

**Type:** Feature Enhancement
**Effort:** L (1-2 days)
**Status:** Ready for task breakdown
**Branch:** Current branch (do not change)

## Problem

Kumo's generative UI system produces functional but inconsistent output. The LLM (glm-4.7-flash via Workers AI) frequently:

1. **Misuses layout patterns** — bare children in Surface without Stack wrapper, inconsistent gap values, Grid without variant
2. **Emits invalid prop values** — enum values the component doesn't support, missing required labels
3. **Lacks compositional vocabulary** — only 3 few-shot examples covering 3 archetypes (user card, form, pricing table). Dashboard, list, empty state, error state are unrepresented
4. **Has no automated quality gate** — no structural validation of LLM output exists; only manual visual inspection
5. **Under-utilizes generative wrappers** — only 6 wrappers exist (Surface, Input, InputArea, CloudflareLogo, Select); common composition mistakes go unrepaired
6. **Validator is weak** — strips invalid top-level props but doesn't auto-wrap orphans, coerce enums, or enforce canonical layout patterns

## Constraints

- **Model-agnostic**: All improvements must work with any Workers AI model, not just glm-4.7-flash
- **No new Kumo components in v1**: Improve output using existing component vocabulary only
- **No snippet/template system in v1**: Out of scope; focus on prompt + validation + wrappers
- **Static test fixtures**: Structural graders use captured JSONL fixtures, not live LLM calls
- **Golden prompt set**: 4 prompts (user card, settings form, counter, pricing table)

## Non-Goals

- Eval harness with live LLM grading
- Model comparison/upgrade evaluation
- New component primitives (Divider, Container, StatCard)
- Snippet/template composition system (a2ui-bridge concept)
- Changes to the streaming parser or RFC 6902 patch engine

---

## Deliverables

### D1. Structural Graders (Vitest) — M

**Files:** `packages/kumo/tests/generative/structural-graders.test.ts`

Add Vitest tests that validate UITree output against structural quality rules. Tests run against static JSONL fixture files (captured LLM output).

**Grader rules:**

| Rule                    | Description                                                                 | Severity |
| ----------------------- | --------------------------------------------------------------------------- | -------- |
| `valid-component-types` | All element types exist in COMPONENT_MAP                                    | Error    |
| `valid-prop-values`     | Enum props contain only valid values (via Zod schemas)                      | Error    |
| `required-props`        | Text elements have children, form elements have labels                      | Error    |
| `canonical-layout`      | Root Surface wraps children in Stack (Surface > Stack > [...])              | Warning  |
| `no-orphan-nodes`       | Every non-root element is referenced by a parent's children array           | Error    |
| `a11y-labels`           | Input, Textarea, Select, Checkbox, Switch, RadioGroup have label/aria-label | Error    |
| `depth-limit`           | No element nesting deeper than 8 levels                                     | Warning  |
| `no-redundant-children` | props.children is not an array (structural children use UIElement.children) | Warning  |

**Fixture format:**

```
tests/generative/fixtures/
  user-card.jsonl        # Captured response for "Show me a user profile card..."
  settings-form.jsonl    # Captured response for "Build a notification preferences form..."
  counter.jsonl          # Captured response for "Create a simple counter..."
  pricing-table.jsonl    # Captured response for "Display a pricing comparison table..."
```

**Helper utilities:**

- `parseJsonlToTree(jsonl: string): UITree` — applies JSONL patches to build tree (reuses `createJsonlParser` + `rfc6902.applyPatch`)
- `walkTree(tree: UITree, visitor: (element, depth, parentKey) => void)` — depth-first tree walker
- `gradeTree(tree: UITree): GraderResult[]` — runs all grader rules, returns pass/fail per rule

**Acceptance:** All grader rules pass on the 4 fixture files. Fixtures may need to be hand-corrected if current LLM output fails (the fixtures represent "known good" output, not raw LLM dumps).

---

### D2. System Prompt Enrichment — M

**Files:** `packages/kumo/src/catalog/system-prompt.ts`

Improve the system prompt to produce higher-quality output from any model.

#### D2a. Expand Few-Shot Examples

Add 3 new examples covering unrepresented archetypes (total: 6 examples). New examples:

1. **Dashboard with stat cards** — Grid(variant="4up") > [Surface > Stack > [Text(secondary label), Text(heading, value)], ...] + main content section below
2. **List with status badges** — Surface > Stack > [Text(heading), Table with Badge in cells, Cluster of action buttons]
3. **Empty state** — Surface > Stack(centered) > [Empty component with description, Button(primary)]

Each example follows the exact JSONL format of existing examples and demonstrates:

- Canonical Surface > Stack pattern
- Proper gap usage
- Accessibility (all inputs labeled)
- Action system integration where appropriate

#### D2b. Layout Composition Guide

Expand the "Layout Patterns" section with explicit anti-patterns and composition recipes:

```markdown
### Layout Anti-Patterns (NEVER do these)

- NEVER put multiple children directly in Surface without a Stack wrapper
- NEVER use Grid without specifying variant or columns
- NEVER nest Surface inside Surface without Grid between them (use Grid > Surface for card grids)
- NEVER use Div when Stack, Grid, or Cluster can express the intent

### Composition Recipes

| Pattern             | Structure                                                                                    | When to use           |
| ------------------- | -------------------------------------------------------------------------------------------- | --------------------- |
| Section with header | Stack(gap="lg") > [Text(heading2), content...]                                               | Any titled section    |
| Stat grid           | Grid(variant="3up" or "4up") > [Surface > Stack > [Text(secondary), Text(heading2)], ...]    | Dashboards, summaries |
| Form group          | Stack(gap="lg") > [Text(heading2), Stack(gap="base") > [Input, Input, ...], Button(primary)] | Any form              |
| Action bar          | Cluster(justify="end", gap="sm") > [Button(secondary), Button(primary)]                      | Bottom of cards/forms |
| Key-value pair      | Stack(gap="xs") > [Text(secondary, label), Text(default, value)]                             | Profile fields, stats |
| Status list row     | Cluster(justify="between") > [Text(label), Badge(status)]                                    | Lists with status     |
```

#### D2c. Prop Usage Guidance

Add brief guidance for the most impactful layout props in the component docs section (injected via prompt-builder):

- **Stack.gap**: "sm" for tight groups (label+value), "base" for form fields, "lg" for sections
- **Grid.variant**: Always specify. "2up" for side-by-side, "3up" for triple, "4up" for stat grids
- **Cluster.justify**: "between" for space-between layouts, "end" for right-aligned button groups
- **Surface.color**: "primary" for main card, "secondary" for nested/recessed cards

---

### D3. Prompt Builder Enhancements — S

**Files:** `packages/kumo/src/catalog/prompt-builder.ts`

#### D3a. Layout Prop Scoring Boost

Increase scores for layout-critical props so they appear in the top-N:

| Prop      | Current Score   | New Score                                 | Rationale                                           |
| --------- | --------------- | ----------------------------------------- | --------------------------------------------------- |
| `gap`     | 1 (interesting) | +2 (layout-critical)                      | Gap is THE most impactful layout prop               |
| `variant` | 1 (interesting) | Already 1, but on Grid it's required (+3) | Grid variant drives layout quality                  |
| `justify` | 1 (interesting) | +2 (layout-critical)                      | Critical for Cluster alignment                      |
| `color`   | 0               | +1 (interesting)                          | Surface color distinguishes primary/secondary cards |
| `layout`  | 0               | +1 (interesting)                          | Table layout prop                                   |

Implementation: Add a `LAYOUT_CRITICAL_PROP_NAMES` set scored at +2, separate from `INTERESTING_PROP_NAMES` (+1).

#### D3b. Composition Hints in Component Descriptions

Enrich the prompt output with brief composition hints after certain component descriptions. The prompt-builder can append these as static suffixes when rendering specific component types:

```
- **Surface** — Card container... | Usage: Always wrap children in Stack. Nest in Grid for card grids.
- **Grid** — Multi-column layout... | Usage: Always specify variant. Wrap each child in Surface for card grids.
- **Stack** — Vertical layout... | Usage: Use gap="lg" between sections, "base" for form fields, "sm" for label+value.
```

Implementation: Add a `COMPOSITION_HINTS` record mapping component names to suffix strings, appended during `renderPropsLines`.

---

### D4. Generative Wrapper Improvements — M

**Files:** `packages/kumo/src/generative/generative-wrappers.tsx`, `packages/kumo/src/generative/component-map.ts`

#### D4a. GenerativeGrid Wrapper

Add a wrapper that applies sensible defaults when the LLM omits them:

- Default `variant="2up"` when BOTH `variant` AND `columns` are missing (prevents single-column fallback). If only `columns` is set, respect it.
- Default `gap="base"` when no gap specified

#### D4b. GenerativeStack Wrapper

- Default `gap="base"` when no gap specified (prevents zero-gap stacking)
- Clamp gap to valid enum values (if LLM emits `gap="medium"`, map to `gap="base"`)

#### D4c. GenerativeText Wrapper

- Default `variant="body"` when variant is missing (LLM sometimes omits it; "body" is the safest default for readable text)
- Note: Emoji stripping is NOT done here — the existing `text-sanitizer.ts` handles it at the streaming level. No duplication.

D4 wrappers handle **defaults for missing props only**. Enum coercion (mapping invalid values to valid ones) is consolidated in D5a to avoid duplication.

Register all new wrappers in COMPONENT_MAP (step 4 in component-map.ts).

---

### D5. Validator Enhancement — M

**Files:** `packages/kumo/src/generative/element-validator.ts`

#### D5a. Enum Coercion Before Strip

Before stripping invalid enum props, attempt to coerce them to the nearest valid value:

```typescript
// Example: variant="info" on Badge → coerce to "primary"
// Example: gap="medium" on Stack → coerce to "base"
// Example: variant="email" on Text → strip (no close match)
```

Implementation: Build a `ENUM_COERCION_MAP` per component per prop. Coercion runs **before** Zod validation in `validateElement()`, not in `repairElement()`. This preserves the coerced prop value rather than stripping it entirely.

Flow change:

```
// Before: validate → fail → repair (strip invalid props)
// After:  coerce → validate → fail → repair (strip remaining invalid props)
```

Coercion map structure:

```typescript
const ENUM_COERCION_MAP: Record<
  string,
  Record<string, Record<string, string>>
> = {
  Badge: {
    variant: {
      info: "primary",
      success: "positive",
      error: "negative",
      danger: "negative",
      warning: "caution",
    },
  },
  Stack: { gap: { medium: "base", large: "lg", small: "sm", extra: "xl" } },
  Grid: { gap: { medium: "base", large: "lg", small: "sm" } },
  Text: {
    variant: { title: "heading2", subtitle: "heading3", caption: "secondary" },
  },
};
```

**Note:** This is the single location for all enum coercion logic. D4 wrappers do NOT coerce — they only apply defaults for missing props. This avoids the "same logic, two places" anti-pattern.

#### D5b. Orphan Auto-Wrap (Renderer-Level Normalization)

When a Surface element has multiple direct children that aren't a single Stack, auto-wrap them in a synthetic Stack element. This enforces the canonical Surface > Stack pattern.

```typescript
// Before: Surface.children = ["text-1", "input-1", "button-1"]
// After:  Surface.children = ["auto-stack-{surface-key}"]
//         auto-stack-{surface-key} = { type: "Stack", props: { gap: "lg" }, children: ["text-1", "input-1", "button-1"] }
```

**Implementation location:** Add `normalizeSurfaceOrphans(tree: UITree): UITree` in `ui-tree-renderer.tsx`, called in the `UITreeRendererImpl` `useMemo` chain alongside the existing `normalizeSiblingFormRowGrids`. This is renderer-time normalization, NOT hook-level mutation — consistent with the existing pattern at `ui-tree-renderer.tsx:592`.

**Critical constraint:** This runs AFTER streaming is complete (the `useMemo` recomputes on every tree change, but the injected Stack element uses deterministic keys derived from the Surface key, not UUIDs). This avoids breaking RFC 6902 patch paths since patches target LLM-declared keys, and auto-wrap keys are synthetic and never patch targets.

**Skip conditions:**

- Surface has exactly 1 child that IS a Stack → already canonical, skip
- Surface has 0 children → skip
- Surface has 1 non-Stack child → wrap (single orphan is still non-canonical)

---

### D6. Chat Endpoint Prompt Scoping — S

**Files:** `packages/kumo-docs-astro/src/pages/api/chat.ts`

#### D6a. Increase maxPropsPerComponent

Change from 6 to 8. Current limit of 6 means critical layout props (gap, variant, justify) are often cut from components with many required props. The token budget increase is ~200 tokens total — negligible vs the 16384 max_tokens.

#### D6b. Add Missing Prompt Components

Add components that improve output quality:

```typescript
const PROMPT_COMPONENTS = [
  // ... existing ...
  "Field", // Form field wrapper with label + error — improves form layouts
  "Label", // Standalone label — improves a11y when LLM can't use Input.label
  "ClipboardText", // Copy-to-clipboard text — useful for code/API key displays
] as const;
```

---

## Deliverable Dependencies

```
D1 (Structural Graders) ─────────── independent, can start immediately
D2 (System Prompt) ──────────────── independent, can start immediately
D3 (Prompt Builder) ─────────────── independent, can start immediately
D4 (Generative Wrappers) ────────── independent, can start immediately
D5 (Validator Enhancement) ──────── independent (coercion consolidated here; wrappers only handle defaults)
D6 (Chat Endpoint) ──────────────── independent, can start immediately
```

All 6 deliverables can be developed in parallel.

After all deliverables are complete, re-capture JSONL fixtures for D1 to validate the full improvement chain.

---

## Effort Breakdown

| Deliverable               | Effort     | Files Changed                              | New Files                     |
| ------------------------- | ---------- | ------------------------------------------ | ----------------------------- |
| D1. Structural Graders    | M (1-2hr)  | 0                                          | 1 test file + 4 fixture files |
| D2. System Prompt         | M (1-2hr)  | 1                                          | 0                             |
| D3. Prompt Builder        | S (<1hr)   | 1                                          | 0                             |
| D4. Generative Wrappers   | M (1-2hr)  | 2                                          | 0                             |
| D5. Validator Enhancement | L (2-4hr)  | 2 (element-validator.ts, ui-tree-renderer) | 0                             |
| D6. Chat Endpoint         | S (<30min) | 1                                          | 0                             |
| **Total**                 | **L (2d)** | **6-7**                                    | **5**                         |

---

## Risks

| Risk                                                        | Likelihood | Impact                                                                                 | Mitigation                                                                                                                                                                      |
| ----------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| System prompt token budget overflow                         | Medium     | Prompt too long for model context window                                               | Measure token count before/after. Current ~3K tokens; additions should stay under 5K. Workers AI context is 32K for glm-4.7-flash.                                              |
| Generative wrappers mask real LLM errors                    | Low        | Wrappers silently fix issues that should surface in graders                            | Wrappers log coercions (existing pattern). Graders run BEFORE wrappers to catch raw LLM issues.                                                                                 |
| Enum coercion map maintenance burden                        | Medium     | Map goes stale when components add/remove variants                                     | Generate coercion map from registry schemas where possible. Add drift-detection test.                                                                                           |
| Few-shot examples bias LLM toward specific patterns         | Low        | LLM over-fits to example structures                                                    | Use diverse examples covering different archetypes. Validate with prompts NOT in the example set.                                                                               |
| Orphan auto-wrap breaks parentKey references                | Medium     | Child elements arrive with parentKey pointing to Surface, but now parent is auto-stack | Use deterministic key derivation (`auto-stack-{surface-key}`). Run at renderer-time only (not during streaming). parentKey is cosmetic — renderer resolves via children arrays. |
| Grid default variant="2up" overrides intentional single-col | Low        | LLM intentionally omits variant for full-width layout                                  | Only default when BOTH variant AND columns are missing. Respect columns-only layouts.                                                                                           |

---

## Open Questions

None. All resolved during CLARIFY phase.

---

## Verification

After implementation:

1. Run `pnpm --filter @cloudflare/kumo test` — all structural graders pass on fixtures
2. Run `pnpm --filter @cloudflare/kumo typecheck` — no type errors
3. Run `pnpm lint` — no lint violations
4. Start `pnpm dev`, test each of the 4 golden prompts visually in the StreamingDemo
5. Capture screenshots before/after for PR description

---

## Discovery Summary

**Explored:**

- `packages/kumo/src/catalog/` — system-prompt.ts (290 lines), prompt-builder.ts (574 lines), catalog.ts
- `packages/kumo/src/generative/` — component-map.ts (111 lines), generative-wrappers.tsx (147 lines), element-validator.ts (224 lines), ui-tree-renderer.tsx (633 lines), stateful-wrappers.tsx (283 lines)
- `packages/kumo/src/streaming/` — 13 files, parser + hooks + action system
- `packages/kumo/ai/` — schemas.ts (899 lines), component-registry.json, component-registry.md (5195 lines)
- `packages/kumo-docs-astro/src/pages/api/chat.ts` — Workers AI endpoint, PROMPT_COMPONENTS list
- `packages/kumo-docs-astro/src/components/demos/StreamingDemo.tsx` — live demo

**Key findings:**

- 3 few-shot examples is insufficient for the component vocabulary available
- Prompt builder's prop scoring under-weights layout-critical props (gap, justify, color)
- Only 6 generative wrappers; Grid and Stack have no wrappers despite being the most composition-critical components
- Validator strips but never coerces — misses easy wins like mapping "info" → "primary" on Badge
- No structural quality tests exist despite excellent Zod schema infrastructure
- maxPropsPerComponent=6 in chat endpoint is too aggressive; cuts layout props from complex components
