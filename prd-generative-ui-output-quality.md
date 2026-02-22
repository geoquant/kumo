# PRD: Generative UI Output Quality Improvements

**Date:** 2026-02-21

---

## Problem Statement

### What problem are we solving?

Kumo's generative UI system produces functional but inconsistent, often broken output. The LLM generates UI trees via JSONL patches, but without sufficient compositional guidance, smart defaults, or automated repair, the rendered results frequently exhibit:

- **Broken layouts** — bare children in Surface without Stack wrapper, Grid with no variant (collapses to single column), Stack with no gap (elements pile up)
- **Invalid props** — enum values the component doesn't support (e.g., `variant="info"` on Badge, `gap="medium"` on Stack), stripped entirely rather than coerced to nearest valid value
- **Missing accessibility** — form elements without labels, inputs without aria attributes
- **No quality gate** — the only validation is manual visual inspection; no automated structural checks exist

This directly undermines Kumo's thesis: that AI-generated component UIs are the future of how users interact with products. If the generated UI looks broken or inconsistent, the demo fails to convince and the platform loses credibility.

### Why now?

The streaming generative UI framework (milestone 1) is complete. The infrastructure works. Now is the time to invest in output quality before the demo hardens into production patterns. Every day the system ships broken layouts, it trains internal stakeholders to expect mediocrity from generative UI.

### Who is affected?

- **Primary users:** Developers evaluating Kumo's generative UI capabilities via the docs site demo at kumo-ui.com
- **Secondary users:** The Kumo team iterating on prompt engineering and generative wrappers — currently flying blind without quality metrics

---

## Proposed Solution

### Overview

Improve generative UI output quality across 6 dimensions — all working together to produce consistently well-structured, accessible, visually correct UIs from any model. The changes span the system prompt (teaching the LLM better), the prompt builder (surfacing the right props), generative wrappers (applying smart defaults), the validator (coercing before stripping), renderer normalization (auto-fixing layout violations), and the chat endpoint (giving the LLM more component vocabulary).

### Design Considerations

- **Model-agnostic**: All improvements work with any Workers AI model, not tied to glm-4.7-flash
- **Defense in depth**: Prompt teaches correct patterns, wrappers apply defaults for missing props, validator coerces invalid values, renderer normalizes structural violations. Each layer catches what the previous missed.
- **Observable**: All corrections are logged (existing pattern). Structural graders can detect raw LLM issues before wrappers/validator run.

---

## End State

When this PRD is complete, the following will be true:

- [ ] Structural graders (8 rules) validate UITree output in Vitest against static JSONL fixtures
- [ ] System prompt contains 6 few-shot examples (up from 3) covering dashboard, list, and empty state archetypes
- [ ] System prompt includes explicit layout anti-patterns and composition recipes
- [ ] Prompt builder surfaces layout-critical props (gap, justify) with higher scores
- [ ] Prompt builder appends composition hints to key components (Surface, Grid, Stack)
- [ ] GenerativeGrid wrapper defaults `variant="2up"` when both variant and columns are missing
- [ ] GenerativeStack wrapper defaults `gap="base"` when gap is missing
- [ ] GenerativeText wrapper defaults `variant="body"` when variant is missing
- [ ] Validator coerces common invalid enum values before falling back to strip (e.g., `"info"` → `"primary"` on Badge)
- [ ] Renderer auto-wraps Surface orphan children in Stack (canonical Surface > Stack pattern enforced)
- [ ] Chat endpoint exposes 8 props per component (up from 6) and includes Field, Label, ClipboardText
- [ ] All 4 golden prompts produce visually correct, well-structured UI confirmed via manual inspection
- [ ] Tests pass, types check, lint clean

---

## Success Metrics

### Quantitative

| Metric                                         | Current                              | Target                                    | Measurement Method                    |
| ---------------------------------------------- | ------------------------------------ | ----------------------------------------- | ------------------------------------- |
| Structural grader pass rate on golden fixtures | N/A (no graders exist)               | 100% (all 8 rules pass on all 4 fixtures) | `pnpm --filter @cloudflare/kumo test` |
| Layout-critical props visible in prompt        | ~50% (gap/justify cut by maxProps=6) | 100% (gap, justify, color all surface)    | Inspect generated prompt output       |
| Few-shot example coverage                      | 3 archetypes                         | 6 archetypes                              | Count in system-prompt.ts             |
| Generative wrapper coverage                    | 6 wrappers                           | 9 wrappers (add Grid, Stack, Text)        | Count in component-map.ts             |

### Qualitative

- Golden prompt outputs look intentional and polished (reviewer confirmation)
- No broken layouts, collapsed grids, or unlabeled form elements in golden set
- New developers evaluating the demo are impressed, not confused

---

## Acceptance Criteria

### Feature: Structural Graders (D1)

- [ ] `structural-graders.test.ts` exists in `tests/generative/`
- [ ] 4 JSONL fixture files exist in `tests/generative/fixtures/`
- [ ] `parseJsonlToTree()` utility builds UITree from JSONL string
- [ ] `walkTree()` utility provides depth-first traversal
- [ ] `gradeTree()` runs all 8 rules and returns pass/fail per rule
- [ ] All 8 grader rules pass on all 4 fixture files
- [ ] Grader rules: valid-component-types, valid-prop-values, required-props, canonical-layout, no-orphan-nodes, a11y-labels, depth-limit, no-redundant-children

### Feature: System Prompt Enrichment (D2)

- [ ] 3 new JSONL examples added: dashboard with stat cards, list with status badges, empty state
- [ ] Each new example follows canonical Surface > Stack pattern
- [ ] Layout anti-patterns section added (4 NEVER rules)
- [ ] Composition recipes table added (6 patterns)
- [ ] Prop usage guidance added for Stack.gap, Grid.variant, Cluster.justify, Surface.color

### Feature: Prompt Builder Enhancements (D3)

- [ ] `LAYOUT_CRITICAL_PROP_NAMES` set added with +2 scoring for gap, justify
- [ ] `color` and `layout` added to `INTERESTING_PROP_NAMES`
- [ ] `COMPOSITION_HINTS` record maps Surface, Grid, Stack, Cluster to usage hint strings
- [ ] Hints appended after component description in prompt output

### Feature: Generative Wrappers (D4)

- [ ] `GenerativeGrid` wrapper: defaults variant="2up" when both variant AND columns missing; defaults gap="base"
- [ ] `GenerativeStack` wrapper: defaults gap="base" when missing
- [ ] `GenerativeText` wrapper: defaults variant="body" when missing
- [ ] All 3 registered in COMPONENT_MAP (step 4 overrides)
- [ ] Wrappers handle defaults only — NO enum coercion (that's D5)

### Feature: Validator Enhancement (D5)

- [ ] `ENUM_COERCION_MAP` defined for Badge.variant, Stack.gap, Grid.gap, Text.variant
- [ ] Coercion runs before Zod validation in `validateElement()`, not in `repairElement()`
- [ ] Flow: coerce → validate → repair (strip remaining)
- [ ] `normalizeSurfaceOrphans()` added to `ui-tree-renderer.tsx`
- [ ] Called in `UITreeRendererImpl` useMemo chain alongside `normalizeSiblingFormRowGrids`
- [ ] Synthetic auto-stack keys are deterministic (`auto-stack-{surface-key}`)
- [ ] Skip conditions: 0 children, or exactly 1 child that IS a Stack

### Feature: Chat Endpoint Scoping (D6)

- [ ] `maxPropsPerComponent` changed from 6 to 8
- [ ] `Field`, `Label`, `ClipboardText` added to `PROMPT_COMPONENTS`

---

## Technical Context

### Existing Patterns

- **Generative wrappers** (`src/generative/generative-wrappers.tsx`): forwardRef components that override COMPONENT_MAP entries with styled defaults. GenerativeSurface adds `rounded-lg p-6`. Pattern: read prop, apply default if missing, delegate to real component.
- **Renderer normalization** (`src/generative/ui-tree-renderer.tsx:107`): `normalizeSiblingFormRowGrids()` runs in `useMemo` before render, mutates tree immutably. New normalizations follow this exact pattern.
- **Validator repair** (`src/generative/element-validator.ts:166`): `repairElement()` strips invalid top-level props. Coercion is a new pre-validation step that preserves the prop with a corrected value.
- **Prop scoring** (`src/catalog/prompt-builder.ts:231`): `scoreProp()` sums required (+3), enum (+2), interesting name (+1). New `LAYOUT_CRITICAL_PROP_NAMES` adds a +2 tier.

### Key Files

| File                                                   | Relevance                                                             |
| ------------------------------------------------------ | --------------------------------------------------------------------- |
| `packages/kumo/src/catalog/system-prompt.ts`           | System prompt template — add examples, anti-patterns, recipes         |
| `packages/kumo/src/catalog/prompt-builder.ts`          | Prop scoring and component docs — add scoring tier, composition hints |
| `packages/kumo/src/generative/generative-wrappers.tsx` | Existing wrappers — add Grid, Stack, Text wrappers                    |
| `packages/kumo/src/generative/component-map.ts`        | Type→component mapping — register new wrappers                        |
| `packages/kumo/src/generative/element-validator.ts`    | Validation + repair — add coercion step                               |
| `packages/kumo/src/generative/ui-tree-renderer.tsx`    | Renderer — add `normalizeSurfaceOrphans`                              |
| `packages/kumo-docs-astro/src/pages/api/chat.ts`       | Chat endpoint — adjust maxProps, add components                       |
| `packages/kumo/ai/schemas.ts`                          | Auto-generated Zod schemas — used by graders (read-only)              |

### System Dependencies

- Zod schemas from `ai/schemas.ts` (auto-generated, read-only)
- Component registry from `ai/component-registry.json` (auto-generated, read-only)
- Workers AI binding in docs site (no changes needed)

---

## Risks & Mitigations

| Risk                                   | Likelihood | Impact | Mitigation                                                                |
| -------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------- |
| System prompt token overflow           | Medium     | Medium | Measure token count. Current ~3K; target <5K. Workers AI context is 32K.  |
| Wrappers mask LLM errors from graders  | Low        | Medium | Graders validate raw tree (pre-wrapper). Wrappers log all corrections.    |
| Enum coercion map goes stale           | Medium     | Low    | Add drift-detection test. Map is small and manually maintained.           |
| Few-shot examples bias LLM             | Low        | Low    | Diverse archetypes. Validate with prompts outside example set.            |
| Orphan auto-wrap breaks parentKey refs | Medium     | Low    | Deterministic keys. Renderer resolves via children arrays, not parentKey. |
| Grid default variant overrides intent  | Low        | Low    | Only default when BOTH variant AND columns missing.                       |

---

## Alternatives Considered

### Alternative 1: Build eval harness first, then improve quality

- **Description:** Invest in a full eval framework (task bank, LLM-as-judge, CI integration) before making any quality improvements
- **Pros:** Measure-first approach; scientifically rigorous
- **Cons:** Delays tangible quality improvements by weeks. We know the problems — broken layouts, missing labels, invalid enums. Don't need a harness to fix obvious issues.
- **Decision:** Rejected for v1. Structural graders (D1) are the lightweight eval seed. Full harness is a follow-up.

### Alternative 2: Add new Kumo components (Divider, StatCard, Container)

- **Description:** Expand the component vocabulary to give the LLM more expressive power
- **Pros:** LLM could express more patterns; purpose-built components reduce composition errors
- **Cons:** Each new component requires scaffolding + registry + codegen + docs. High effort, uncertain ROI for generative quality.
- **Decision:** Deferred to v2. Improve what exists first.

### Alternative 3: Snippet/template system (a2ui-bridge concept)

- **Description:** Pre-built UI templates the LLM references by name instead of generating element-by-element
- **Pros:** Fewer tokens, higher accuracy, known-good patterns
- **Cons:** Requires new catalog layer, new JSONL format, renderer changes. Large scope.
- **Decision:** Deferred. Interesting concept but orthogonal to the immediate quality issues.

---

## Non-Goals (v1)

- **Eval harness with live LLM grading** — structural graders on static fixtures are sufficient for v1
- **Model comparison/upgrade** — all changes are model-agnostic; model swap is a separate decision
- **New Kumo components** — no Divider, Container, StatCard, or other new primitives
- **Snippet/template system** — no a2ui-bridge concept; element-by-element generation only
- **Streaming parser changes** — no modifications to JSONL parser or RFC 6902 patch engine
- **Dynamic prompt scoping by intent** — classify user intent and subset components accordingly (future)

---

## Documentation Requirements

- [ ] No user-facing documentation needed (internal infrastructure)
- [ ] Structural grader rules documented in test file JSDoc
- [ ] Composition hints self-document in prompt output (visible to LLM, not to end users)

---

## Open Questions

| Question | Owner | Due Date | Status                         |
| -------- | ----- | -------- | ------------------------------ |
| None     | —     | —        | All resolved during spec phase |

---

## Appendix

### Glossary

- **UITree**: Flat JSON structure `{ root: string, elements: Record<string, UIElement> }` representing a component tree
- **JSONL**: One JSON object per line — each line is an RFC 6902 patch operation building the UITree incrementally
- **Generative wrapper**: A React component that wraps a Kumo component with sensible defaults for LLM-generated props
- **Structural grader**: A function that checks a UITree against a quality rule and returns pass/fail
- **Canonical layout**: The pattern `Surface > Stack > [children]` — every Surface wraps its children in a Stack for vertical spacing
- **Enum coercion**: Mapping a common invalid enum value to the nearest valid one (e.g., `"info"` → `"primary"` on Badge)

### References

- Spec: `specs/generative-ui-output-quality.md`
- System prompt: `packages/kumo/src/catalog/system-prompt.ts`
- Existing wrappers: `packages/kumo/src/generative/generative-wrappers.tsx`
- Validator: `packages/kumo/src/generative/element-validator.ts`
- Renderer normalizations: `packages/kumo/src/generative/ui-tree-renderer.tsx`
- Chat endpoint: `packages/kumo-docs-astro/src/pages/api/chat.ts`
