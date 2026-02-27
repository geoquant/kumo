# PRD: Generative UI Style Layer

**Date:** 2026-02-26

---

## Problem Statement

### What problem are we solving?

The streaming generative UI pipeline produces structurally valid output — all 8 structural graders pass — but the output doesn't resemble the page-level templates Yelena designed (ProductOverview, ServiceDetail, ServiceTabs). The gap is **compositional quality**: the system prompt lacks surface hierarchy guidance, page-level layout patterns, spacing density grammar, and page-level worked examples. There are no composition graders to measure this gap, no eval prompts to test against, and no harness to run evaluations.

Specifically:

1. **Surface hierarchy absent:** NS templates use `bg-kumo-elevated` (page surface) -> `bg-kumo-base` (inset cards). The prompt only knows single-level `Surface` with no nesting guidance.
2. **No page-level layout:** Templates have `max-w-[1400px]`, responsive padding `p-6 md:p-8 lg:px-10`, two-column main+sidebar with sticky positioning. The prompt has zero page-level structure.
3. **Spacing is vague:** Templates use consistent `gap-2` (titles), `gap-4` (sections), `gap-5/6` (columns). The prompt only has abstract `"xs"/"sm"/"base"/"lg"` tokens with no specific use-case mapping.
4. **All examples are card-level:** 7 worked examples are single cards (user card, counter, form, table). No page-level examples exist.
5. **No composition measurement:** Can't programmatically check visual hierarchy, surface nesting, spacing consistency, or content density.

### Why now?

The streaming infrastructure is complete. The playground (Plan 1) provides the viewport to see page-level output. Without the style layer, the playground shows structurally valid but compositionally poor pages. The eval harness is the feedback loop that turns prompt iteration from guesswork into measurement.

### Who is affected?

- **Primary users:** Internal Kumo team iterating on generative UI output quality (prompt engineering, grading rules)
- **Secondary users:** External developers who will receive better page-level output once the style layer improves model behavior

---

## Proposed Solution

### Overview

A composition quality layer for generative UI that adds: (1) 6 deterministic composition graders checking page-level design patterns, (2) a PAGE_COMPOSITION section in the system prompt with surface hierarchy, layout, and spacing rules, (3) 3 page-level JSONL few-shot examples derived from NS templates, (4) 10-15 natural language eval prompts with expected output patterns, and (5) a Vitest eval harness that runs prompts through the model and grades output with both structural and composition graders.

### Design Considerations

- **Deterministic only:** All graders are pure functions of UITree — no LLM-as-judge, no visual comparison, no screenshot diffing. Deterministic rules establish a baseline; LLM judges can be layered on later when deterministic rules plateau.
- **Additive, not modifying:** Composition graders are a separate `gradeComposition()` function. The existing 8 structural graders in `gradeTree()` are untouched.
- **Examples follow the rules:** The 3 new JSONL examples must pass both `gradeTree()` and `gradeComposition()`. This validates that the rules and examples are internally consistent.
- **Eval is measurement, not CI gating:** The eval harness is env-gated (`EVAL_ENABLED=true`). It measures quality to guide prompt iteration, not to block deploys.

---

## End State

When this PRD is complete, the following will be true:

- [ ] `gradeComposition(tree)` exists with 6 composition rules, exported from `@cloudflare/kumo/generative`
- [ ] System prompt includes PAGE_COMPOSITION section with surface hierarchy, page layout, spacing density, content reading order
- [ ] 3 page-level JSONL worked examples exist in the system prompt (ProductOverview, ServiceDetail, ServiceTabs)
- [ ] All 3 new examples parse to valid UITrees and pass both `gradeTree()` and `gradeComposition()`
- [ ] 10-15 eval prompts exist as a typed fixture file with expected patterns and required elements
- [ ] Eval harness runs prompts, generates output, grades with structural + composition graders
- [ ] Eval harness is env-gated (skipped unless `EVAL_ENABLED=true`)
- [ ] Existing card-level prompts do not regress (7 existing examples still pass structural graders)
- [ ] All work is on the `geoquant/streaming-ui` branch

---

## Success Metrics

### Quantitative

| Metric                                         | Current             | Target               | Measurement Method                      |
| ---------------------------------------------- | ------------------- | -------------------- | --------------------------------------- |
| Composition grader rules                       | 0                   | 6                    | Count rules in `gradeComposition()`     |
| Page-level worked examples in prompt           | 0                   | 3                    | Count examples in `buildSystemPrompt()` |
| Eval prompts with expected patterns            | 0                   | 10-15                | Count entries in eval fixture file      |
| Page-level prompts passing composition graders | Unknown             | >60% of eval prompts | Eval harness aggregate score            |
| Card-level prompt regression                   | 7/7 pass structural | 7/7 still pass       | Run gradeTree on existing examples      |

### Qualitative

- Team can measure whether prompt changes improve or regress page-level output quality
- System prompt gives the model concrete guidance on surface hierarchy and page layout
- Page-level few-shot examples demonstrate the target output structure
- Eval harness provides a repeatable feedback loop for prompt iteration

---

## Acceptance Criteria

### Feature: Composition Graders

- [ ] `gradeComposition(tree)` returns `GradeReport` with 6 rules
- [ ] Rule `has-visual-hierarchy`: passes when tree has heading-level Text elements
- [ ] Rule `has-responsive-layout`: passes when tree has Grid with variant prop
- [ ] Rule `surface-hierarchy-correct`: fails when Surface is directly nested in Surface
- [ ] Rule `spacing-consistency`: warns when same-level sibling Stacks use inconsistent gaps
- [ ] Rule `content-density`: fails when element count is <3 or >100
- [ ] Rule `action-completeness`: fails when form elements exist without any Button
- [ ] Each rule is independently testable with crafted UITrees
- [ ] Exported from `@cloudflare/kumo/generative`
- [ ] Does not modify or depend on existing `gradeTree()` function

### Feature: PAGE_COMPOSITION System Prompt Section

- [ ] `buildSystemPrompt()` output includes PAGE_COMPOSITION section
- [ ] Surface hierarchy guidance: Surface root, Surface(color="neutral") for insets, no direct nesting
- [ ] Page-level layout patterns: root Surface > Stack, two-column via Grid, sidebar patterns
- [ ] Spacing density grammar: xs (key-value), sm (headers, actions), base (standard sections), lg (top-level divisions)
- [ ] Content reading order: title -> context -> data -> actions
- [ ] Section is positioned between COMPOSITION_RECIPES and ACCESSIBILITY

### Feature: Page-Level JSONL Examples

- [ ] 3 new examples appended after existing 7 card-level examples
- [ ] Example 8: Product Overview — two-column, metrics sidebar, resource table, doc links
- [ ] Example 9: Service Detail — header with actions, table content, empty state fallback
- [ ] Example 10: Service Tabs — header with tab navigation, multiple content sections
- [ ] Each example has a natural language user prompt and complete JSONL output
- [ ] `parseJsonlToTree()` produces valid UITree for each example
- [ ] Each example passes both `gradeTree()` and `gradeComposition()`
- [ ] Existing 7 card-level examples still pass `gradeTree()` (no regression)

### Feature: Eval Prompt Fixtures

- [ ] File exports typed array of `EvalPrompt` objects
- [ ] At least 10 prompts covering all 3 template types + card-level
- [ ] Prompts are natural language describing intent (not "make me a product overview")
- [ ] Each prompt has `expectedPattern`, `requiredElements[]`, `requiredPatterns[]`
- [ ] 3-5 prompts that don't match any template (novel layouts) to test creativity

### Feature: Eval Harness

- [ ] Vitest test suite at `packages/kumo/tests/generative/eval/composition-eval.test.ts`
- [ ] Tests skip when `EVAL_ENABLED` env var is not set
- [ ] When enabled: loads eval prompts, generates output, parses to UITree
- [ ] Grades each output with both `gradeTree()` and `gradeComposition()`
- [ ] Checks `requiredElements` exist in tree
- [ ] Checks `requiredPatterns` are satisfied
- [ ] Reports per-prompt pass/fail and aggregate score
- [ ] Supports offline mode with pre-generated JSONL fixtures (no API call required)

---

## Technical Context

### Existing Patterns

- **Structural graders:** `gradeTree(tree)` in `packages/kumo/src/generative/structural-graders.ts` — 8 rules, `GradeReport` type, `walkTree` utility. Composition graders should use the same `GradeReport` type and `walkTree` utility.
- **System prompt assembly:** `buildSystemPrompt(options)` in `packages/kumo/src/catalog/system-prompt.ts` — sections: DESIGN_RULES, LAYOUT_ANTI_PATTERNS, COMPOSITION_RECIPES, ACCESSIBILITY, EXAMPLES, etc. New PAGE_COMPOSITION section follows the same pattern.
- **Worked examples:** 7 card-level examples inline in `system-prompt.ts` as template literal strings. Each has a "User:" prompt and complete JSONL output. New page-level examples follow same format.
- **JSONL parsing:** `parseJsonlToTree(jsonl)` in `structural-graders.ts` — parses JSONL string to UITree via the production parser + patch engine. Used to validate examples.

### Key Files

- `packages/kumo/src/generative/structural-graders.ts` — Existing graders, `GradeReport` type, `walkTree`, `parseJsonlToTree`
- `packages/kumo/src/catalog/system-prompt.ts` — `buildSystemPrompt()`, existing DESIGN_RULES, COMPOSITION_RECIPES, LAYOUT_ANTI_PATTERNS, 7 worked examples
- `packages/kumo/src/catalog/types.ts` — `UITree`, `UIElement` type definitions
- `packages/kumo/src/generative/component-manifest.ts` — `KNOWN_TYPES`, component type names
- `packages/kumo/src/generative/index.ts` — Barrel export for `@cloudflare/kumo/generative`
- `inspo/ns-kumo-ui-templates/app/components/templates/ProductOverview.tsx` — Source template for Example 8
- `inspo/ns-kumo-ui-templates/app/components/templates/ServiceDetail.tsx` — Source template for Example 9
- `inspo/ns-kumo-ui-templates/app/routes/service-tabs-example.tsx` — Source for Example 10 (ServiceTabs composition pattern)

### System Dependencies

- **Workers AI:** Required for eval harness (generating output from prompts). Gated behind env var.
- **`@cloudflare/kumo`:** All generative/catalog modules (local workspace dependency)

### Data Model Changes

None. All state is in-memory (UITree, GradeReport). No persistence.

---

## Risks & Mitigations

| Risk                                                             | Likelihood | Impact | Mitigation                                                                                                                                          |
| ---------------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page-level JSONL examples are too large for model context window | Med        | High   | Measure token count per example; trim to essential structure; test with target models                                                               |
| Composition graders too strict (fail valid creative outputs)     | Med        | Med    | Start with warnings not failures; tune thresholds based on eval results                                                                             |
| Spacing consistency rule has high false positive rate            | High       | Low    | Allow variation within one gap-size step (sm+base OK, xs+lg not OK)                                                                                 |
| System prompt page-level rules conflict with card-level rules    | Low        | Med    | Page rules are additive; card rules still apply within cards; test card prompts don't regress                                                       |
| Workers AI model can't follow page-level examples                | High       | High   | The fundamental risk. Eval harness exists to measure this. If model can't follow, iterate on prompt or switch models via playground model selector. |
| Eval prompts are biased toward template patterns                 | Med        | Med    | Include 3-5 prompts for novel layouts that don't match any template                                                                                 |

---

## Alternatives Considered

### Alternative 1: LLM-as-judge for composition quality

- **Description:** Use a second LLM call to evaluate whether output matches design intent
- **Pros:** More nuanced evaluation; can assess "taste" beyond structural rules
- **Cons:** Non-deterministic (flaky tests); expensive (2x API calls per eval); hard to debug failures; results change across model versions
- **Decision:** Rejected for v1. Start deterministic, add LLM judge only when deterministic rules plateau and we have a baseline to compare against.

### Alternative 2: Visual diff / screenshot comparison

- **Description:** Render output in headless browser, screenshot, compare to reference images
- **Pros:** Tests actual visual output; catches CSS/rendering issues
- **Cons:** Requires headless browser infrastructure; brittle to minor rendering differences; slow; doesn't work for UITree (would need full React rendering pipeline)
- **Decision:** Rejected. UITree grading at the structural level is faster, more debuggable, and sufficient for v1 composition quality.

### Alternative 3: Modify existing gradeTree() to include composition rules

- **Description:** Add 6 new rules directly inside the existing `gradeTree()` function
- **Pros:** Single function for all grading; simpler API surface
- **Cons:** gradeTree() is already monolithic (8 rules inlined); mixing structural correctness with compositional quality conflates concerns; harder to disable composition rules independently
- **Decision:** Rejected. Separate `gradeComposition()` keeps concerns clean and allows playground to show structural vs composition grades independently.

### Alternative 4: External config file for composition rules

- **Description:** Define rules in JSON/YAML, loaded at runtime
- **Pros:** Non-engineers could tweak rules; no code changes for threshold adjustments
- **Cons:** Over-engineering for 6 rules; rules need tree traversal logic that doesn't fit in config; adds indirection
- **Decision:** Rejected. 6 rules in a TypeScript file is simpler and more maintainable.

---

## Non-Goals (v1)

- **LLM-as-judge** — all graders deterministic; add LLM judge when deterministic rules plateau
- **Visual diff / screenshot comparison** — v2 after UITree grading baseline established
- **Dial system** (DESIGN_VARIANCE, MOTION_INTENSITY) — over-engineering for Kumo's fixed aesthetic
- **Encouraging deviation from semantic tokens** — antithetical to Kumo's purpose
- **CI-integrated eval runs** — too expensive, too flaky; manual/local only
- **Modifying existing 8 structural graders** — composition graders are separate
- **Custom component support in eval** — built-in catalog only
- **Responsive rendering verification** — no headless browser; check for Grid variants only
- **Loading/empty states grading** — v2 composition rules
- **Frontmatter design skill's "be creative" philosophy** — Kumo is a design system, not a canvas

---

## Interface Specifications

### API: Composition Graders

```typescript
// packages/kumo/src/generative/composition-graders.ts

import type { UITree } from "../catalog/types";
import type { GradeReport } from "./structural-graders";

export function gradeComposition(tree: UITree): GradeReport;
```

Returns same `GradeReport` shape as `gradeTree()`. 6 rules:

- `has-visual-hierarchy`
- `has-responsive-layout`
- `surface-hierarchy-correct`
- `spacing-consistency`
- `content-density`
- `action-completeness`

### API: Eval Prompt Fixture

```typescript
// packages/kumo/src/generative/eval/eval-prompts.ts

export interface EvalPrompt {
  readonly id: string;
  readonly prompt: string;
  readonly expectedPattern:
    | "product-overview"
    | "service-detail"
    | "service-tabs"
    | "dashboard"
    | "form"
    | "table"
    | "novel";
  readonly requiredElements: ReadonlyArray<string>;
  readonly requiredPatterns: ReadonlyArray<string>;
}

export const EVAL_PROMPTS: ReadonlyArray<EvalPrompt>;
```

---

## Documentation Requirements

- [ ] JSDoc on `gradeComposition()` with rule descriptions
- [ ] JSDoc on `EvalPrompt` interface
- [ ] Inline comments in PAGE_COMPOSITION prompt section explaining rationale for each rule
- [ ] No external documentation updates needed (internal tooling)

---

## Open Questions

| Question | Owner | Due Date | Status |
| -------- | ----- | -------- | ------ |
| None     | —     | —        | —      |

---

## Appendix

### Glossary

- **Composition graders:** Deterministic rules checking page-level design quality (visual hierarchy, surface nesting, spacing, etc.)
- **Structural graders:** Existing 8 rules checking UITree validity (types, props, layout, a11y, depth, orphans)
- **Surface hierarchy:** The pattern of nesting visual surfaces — page surface (elevated) contains inset cards (base/neutral)
- **NS templates:** Network Services team's page-level Kumo templates (ProductOverview, ServiceDetail, ServiceTabs) in `inspo/` directory
- **Eval harness:** Test suite that runs prompts through model, grades output, reports quality scores
- **Few-shot examples:** Complete JSONL examples in the system prompt that show the model what good output looks like

### References

- Spec: `specs/style-layer.md`
- Paste context: https://paste.cfdata.org/xEEpgz8JaRm9 (analysis of current state + strategy)
- Structural graders: `packages/kumo/src/generative/structural-graders.ts`
- System prompt: `packages/kumo/src/catalog/system-prompt.ts`
- NS templates: `inspo/ns-kumo-ui-templates/app/components/templates/`
