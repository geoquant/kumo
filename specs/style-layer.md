# Style Layer — Composition Quality for Generative UI

**Type:** Feature Plan
**Effort:** L (1-2 days)
**Branch:** `geoquant/streaming-ui` (CRITICAL: ONLY work on this branch)
**Status:** Ready for implementation
**Updated:** 2026-02-26

## Problem

The streaming generative UI pipeline produces structurally valid output (8 structural graders pass), but the output doesn't look like the NS page templates Yelena designed. The gap is **compositional quality** — the difference between "valid components in valid positions" and "a well-composed page that follows Kumo design patterns."

Concretely, the system prompt lacks:
- **Surface hierarchy:** templates use `bg-kumo-elevated` (page) -> `bg-kumo-base` (inset cards), but the prompt only knows single-level `Surface`
- **Page-level layout:** templates have `max-w-[1400px] mx-auto`, responsive `p-6 md:p-8 lg:px-10`, two-column main+sidebar, sticky navs — the prompt has no page-level structure guidance
- **Spacing density grammar:** templates use consistent `gap-2` (titles), `gap-4` (sections), `gap-5/6` (columns), `gap-8` (major divisions) — the prompt only has abstract `"xs"/"sm"/"base"/"lg"` tokens with vague guidance
- **Page-level few-shot examples:** all 7 worked examples are single-card level (user card, counter, form, table, dashboard, deployment list, empty state)
- **Composition graders:** no way to check surface hierarchy, visual hierarchy, responsive patterns, spacing consistency, or content density programmatically

The style-layer work is blocked until the playground exists (Plan 1), but the composition graders and system prompt changes can be built in parallel. The eval harness requires both playground + graders + sample prompts.

**Who:** Internal Kumo team iterating on generative UI quality.
**Cost of not solving:** Model output stays card-level forever. Page-level prompts produce flat, unhierarchical output with no visual structure. Can't evaluate whether prompt changes improve or regress quality.

## Constraints

- All work on `geoquant/streaming-ui` branch
- No new npm dependencies for graders (pure TS functions)
- No LLM-as-judge in v1 — all graders are deterministic
- Existing 8 structural graders (`gradeTree()`) must not be modified — composition graders are a separate function
- System prompt changes are inline in `system-prompt.ts` (consistent with existing 7 card-level examples)
- Eval harness is Vitest, gated behind env var (not run in CI by default)
- Template conversions based on 3 NS templates: ProductOverview, ServiceDetail, ServiceTabs (composition of PageHeader + ServiceDetail/ServiceSettings tabs)
- The `Surface` component in UITree doesn't directly map to `bg-kumo-*` classes — the renderer applies defaults. Surface hierarchy rules must work within UITree's type/props model.

## Solution

### 1. Composition Graders

New file: `packages/kumo/src/generative/composition-graders.ts`
Export: `gradeComposition(tree: UITree): GradeReport` (same `GradeReport` type as structural graders)

**6 composition rules:**

| Rule | What it checks | How it's checked |
|------|----------------|------------------|
| `has-visual-hierarchy` | Tree has heading1 -> heading2 -> body text hierarchy | Walk tree: at least one `Text` with `variant` containing "heading" exists; if heading1 exists, heading2 should too |
| `has-responsive-layout` | Tree uses Grid with breakpoint-aware variants | Walk tree: at least one `Grid` element exists with `variant` prop set |
| `surface-hierarchy-correct` | Surfaces aren't nested directly (Surface > Surface) | Walk tree: no `Surface` child has a `Surface` parent (use Grid/Stack between) |
| `spacing-consistency` | Sibling Stacks use consistent gap values | Walk tree: within each parent, collect all child Stack gap values; warn if same-level siblings use different gaps |
| `content-density` | Tree element count is within reasonable range for complexity | Count elements; flag if <3 (too simple) or >100 (too complex for single generation) |
| `action-completeness` | Interactive contexts have actions | If tree contains Input/Select/Textarea/Form elements, at least one Button must exist |

These are **deterministic** — no model calls needed. They extend the grading vocabulary without touching `gradeTree()`.

### 2. Page-Level System Prompt Additions

New section in `buildSystemPrompt()`: `PAGE_COMPOSITION` (inserted between COMPOSITION_RECIPES and ACCESSIBILITY).

**Content:**

**Surface hierarchy rules:**
- `Surface` is the outermost card container. For page-level layouts, the root Surface represents the page surface.
- Nested content sections use `Surface(color="neutral")` for visual inset (elevated -> base effect).
- NEVER nest Surface directly inside Surface — use Stack or Grid between them.

**Page-level layout rules:**
- Every page-level output needs a root Surface > Stack structure.
- For multi-section pages: Stack(gap="lg") as the primary container.
- For two-column pages: Stack > [header section, Grid(variant="2up") > [main content, sidebar]].
- Sidebar content should be a Stack(gap="base") with multiple Surface(color="neutral") cards.

**Spacing density grammar:**
- `gap="xs"` — key-value pairs, label+value
- `gap="sm"` — section headers (heading + subtext), action clusters, tight groups
- `gap="base"` — standard card sections, sidebar card spacing
- `gap="lg"` — top-level sections within a page, major content divisions

**Content reading order:**
- Title -> context/description -> data/content -> actions
- Headers: Stack(gap="sm") > [Text(heading), Text(secondary text)]
- Stat grids: Grid(variant="3up" or "4up") > [Surface(color="neutral") > Stack > stat, ...]
- Action bars: Cluster(justify="end") > [secondary actions, primary action (last)]

### 3. Page-Level Few-Shot Examples

3 new worked examples added to the EXAMPLES section of `buildSystemPrompt()`:

**Example 8: Product Overview** (from NS `ProductOverview` template)
- Two-column layout: main content left, metrics sidebar right
- Header with title + description
- Stats grid (4-up) in sidebar with Surface(color="neutral") cards
- Resource table in main content
- Footer with doc links

**Example 9: Service Detail** (from NS `ServiceDetail` template)
- Header with title, description, action buttons
- Main content area with table + toolbar
- Empty state fallback

**Example 10: Service Tabs** (from NS Service Tabs composition)
- Header with title + tab navigation (Tabs component)
- Tab content area rendering different content per tab
- Demonstrates composition of multiple content types under one header

Each example is a complete JSONL block showing the full UITree construction via RFC 6902 patches, following the same format as the existing 7 card-level examples.

### 4. Natural Language Eval Prompts

Fixture file: `packages/kumo/src/generative/eval/eval-prompts.ts`

```ts
interface EvalPrompt {
  id: string;
  prompt: string;
  expectedPattern: "product-overview" | "service-detail" | "service-tabs" | "dashboard" | "form" | "table";
  requiredElements: string[];  // element types that must exist in output
  requiredPatterns: string[];  // composition patterns that should be present
}
```

10-15 prompts like:
- "I'm building a DNS management page. Show active zones with status, total queries metric, and doc links." -> product-overview pattern
- "Show a tunnel configuration page: tunnel health, connected routes, replica status. I should be able to add new routes." -> service-detail pattern
- "Create a WAF overview with attack metrics, active rules count, and recent events table." -> product-overview pattern
- "Build a Workers settings page with environment variables, triggers, and build configuration in different sections." -> service-tabs pattern

### 5. Eval Harness

Vitest test suite: `packages/kumo/tests/generative/eval/composition-eval.test.ts`

**Flow:**
1. Load eval prompts from fixture file
2. For each prompt:
   a. Build system prompt via `createKumoCatalog().generatePrompt()`
   b. Call Workers AI (or mock) to generate JSONL
   c. Parse JSONL to UITree via `parseJsonlToTree()`
   d. Run `gradeTree(tree)` (structural) + `gradeComposition(tree)` (composition)
   e. Check `requiredElements` exist in tree
   f. Check `requiredPatterns` are satisfied
3. Report: per-prompt pass/fail, aggregate score, failing rules

**Gating:** Tests skip unless `EVAL_ENABLED=true` env var is set. In normal `pnpm test`, these are skipped.

**Model integration:** The eval needs to call an API to generate output. For v1, this calls the same `/api/chat` endpoint (or Workers AI directly via binding). The eval can also accept pre-generated JSONL fixtures for offline testing.

## Deliverables

### D1: Composition graders (M)
**Location:** `packages/kumo/src/generative/composition-graders.ts`
**Depends on:** nothing
**Export from:** `@cloudflare/kumo/generative`

6 deterministic composition rules. Same `GradeReport` interface as structural graders. Separate function `gradeComposition(tree)`.

Tests: `packages/kumo/tests/generative/composition-graders.test.ts`

**Acceptance:**
- `gradeComposition(tree)` returns `GradeReport` with 6 rules
- Each rule is independently testable with crafted UITrees
- Does not modify or depend on `gradeTree()`
- Exported from `@cloudflare/kumo/generative`

### D2: PAGE_COMPOSITION system prompt section (M)
**Location:** `packages/kumo/src/catalog/system-prompt.ts`
**Depends on:** nothing

New section between COMPOSITION_RECIPES and ACCESSIBILITY with surface hierarchy rules, page-level layout patterns, spacing density grammar, and content reading order.

**Acceptance:**
- `buildSystemPrompt()` output includes PAGE_COMPOSITION section
- Surface hierarchy guidance present (Surface root, Surface(color="neutral") for insets, no direct nesting)
- Page-level layout patterns present (two-column, sidebar, header)
- Spacing density grammar present (xs/sm/base/lg with specific use cases)
- Content reading order documented (title -> context -> data -> actions)

### D3: Page-level JSONL few-shot examples (L)
**Location:** `packages/kumo/src/catalog/system-prompt.ts`
**Depends on:** D2 (examples should follow the new PAGE_COMPOSITION rules)

3 new worked examples (Product Overview, Service Detail, Service Tabs) added to the EXAMPLES array in `buildSystemPrompt()`. Each is a complete JSONL block.

**Acceptance:**
- 3 new examples appended after existing 7 card-level examples
- Each example has a user prompt and complete JSONL output
- JSONL is valid: `parseJsonlToTree()` produces a valid UITree
- Examples pass both `gradeTree()` and `gradeComposition()`
- Examples demonstrate surface hierarchy, page layout, and spacing patterns from D2

### D4: Eval prompt fixtures (S)
**Location:** `packages/kumo/src/generative/eval/eval-prompts.ts`
**Depends on:** nothing

10-15 natural language prompts with expected template patterns and required elements.

**Acceptance:**
- File exports typed array of `EvalPrompt` objects
- Prompts are natural language (not "make me a product overview" — describe intent)
- Each prompt has `expectedPattern`, `requiredElements[]`, and `requiredPatterns[]`
- Covers all 3 template types + card-level patterns
- At least 10 prompts

### D5: Eval harness (M)
**Location:** `packages/kumo/tests/generative/eval/composition-eval.test.ts`
**Depends on:** D1, D3, D4

Vitest test suite that runs prompts, generates output, and grades it. Gated behind `EVAL_ENABLED=true`.

**Acceptance:**
- Tests skip when `EVAL_ENABLED` is not set
- When enabled, each eval prompt is run through the generation pipeline
- Output is graded with both `gradeTree()` and `gradeComposition()`
- Required elements and patterns are checked
- Report shows per-prompt pass/fail and aggregate score
- Supports offline mode with pre-generated JSONL fixtures

## Non-Goals

- LLM-as-judge for eval — all graders are deterministic in v1
- "Dial system" (DESIGN_VARIANCE, MOTION_INTENSITY) — over-engineering for Kumo's fixed aesthetic
- Encouraging deviation from semantic tokens
- Visual diff / screenshot comparison — v2
- CI-integrated eval runs (too expensive, too flaky)
- Modifying the 8 existing structural graders
- Custom component support in eval
- Responsive rendering verification (no headless browser)
- Loading states / empty states grading (v2 composition rules)

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Page-level JSONL examples are too large for context window | Med | High | Measure token count per example; trim to essential structure if needed; test with target models |
| Composition graders too strict (fail valid creative outputs) | Med | Med | Start with warnings, not failures; tune thresholds based on eval results |
| Spacing consistency rule has too many false positives | High | Low | Allow same-level variation within one gap-size step (e.g., "sm" and "base" OK, "xs" and "lg" not OK) |
| Eval prompts are biased toward template patterns | Med | Med | Include 3-5 prompts that intentionally don't match any template (novel layouts) |
| System prompt page-level guidance competes with card-level guidance | Low | Med | Page-level rules are additive; card-level rules still apply within cards; test that card-level prompts don't regress |
| Workers AI model doesn't follow page-level examples well | High | High | This is the fundamental risk. The eval harness exists to measure this. If the model can't follow, we iterate on the prompt or switch models. |

## Open Questions

- None remaining

---

**Phase: DRAFT | Waiting for: user approval**
