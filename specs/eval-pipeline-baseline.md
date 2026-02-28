# Eval Pipeline: Baseline Capture & Composition Grading

**Type:** Feature plan  
**Effort:** XL (>2 days)  
**Status:** Ready for task breakdown  
**Branch:** `geoquant/streaming-ui` (CRITICAL: all work must stay on this branch)

## Problem

The generative UI pipeline (`/api/chat` → Workers AI → JSONL → UITree) has graders, prompt scaffolding, and an eval CLI — but no captured baselines, no composition grading in the CLI or playground, and no mechanism to measure whether the 18 injected skills improve output quality. The plumbing exists; it produces no observable measurement yet.

## Discovery Summary

| Component                                  | Status                                        | Location                                                                 |
| ------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------ |
| `gradeTree()` (8 structural rules)         | LIVE everywhere                               | `packages/kumo/src/generative/structural-graders.ts:135`                 |
| `gradeComposition()` (6 composition rules) | LIVE in Vitest only                           | `packages/kumo/src/generative/composition-graders.ts:78`                 |
| CLI eval (`eval-generative.ts`)            | LIVE, runs against dev server                 | `packages/kumo/scripts/eval-generative.ts`                               |
| Vitest eval harness                        | Structurally complete, no fixtures            | `packages/kumo/tests/generative/eval/composition-eval.test.ts`           |
| `/api/chat`                                | LIVE, Workers AI (GLM-4.7-flash)              | `packages/kumo-docs-astro/src/pages/api/chat/index.ts`                   |
| Skills injection                           | LIVE for authenticated users via `skillIds[]` | `/api/chat/index.ts:239-248`                                             |
| Playground grading tab                     | Shows `gradeTree()` only                      | `packages/kumo-docs-astro/src/components/demos/_PlaygroundPage.tsx:1362` |
| Eval fixtures dir                          | Empty (`.gitkeep`)                            | `packages/kumo/tests/generative/eval/fixtures/`                          |
| 13 eval prompts (Vitest)                   | Defined, unused                               | `packages/kumo/src/generative/eval/eval-prompts.ts`                      |
| 10 eval prompts (CLI)                      | Defined, hardcoded in script                  | `packages/kumo/scripts/eval-generative.ts:51-104`                        |

## Deliverables

### D1: Unify CLI eval prompts with `eval-prompts.ts` (S)

**Files:**

- `packages/kumo/scripts/eval-generative.ts` �� delete hardcoded `EVAL_PROMPTS`, import from `eval-prompts.ts`
- `packages/kumo/src/generative/eval/eval-prompts.ts` — single source of truth (already has 13 prompts)

**Changes:**

1. Remove the 10 hardcoded `EVAL_PROMPTS` from `eval-generative.ts` (lines 46–104)
2. Import `EVAL_PROMPTS` from `../src/generative/eval/eval-prompts.js`
3. Adapt the CLI to use `EvalPrompt.id` as the prompt name and `EvalPrompt.prompt` as the message (currently uses `.name` and `.message` — rename references)
4. The CLI gains 3 additional prompts (13 total) including the novel/edge-case coverage

**Acceptance criteria:**

- CLI eval uses the 13 prompts from `eval-prompts.ts`
- No hardcoded prompt definitions remain in `eval-generative.ts`
- `tsx scripts/eval-generative.ts` runs successfully with 13 prompts

### D2: Add `gradeComposition()` to CLI eval script (S)

**File:** `packages/kumo/scripts/eval-generative.ts`

**Changes:**

1. Import `gradeComposition` and `COMPOSITION_RULE_NAMES` from `../src/generative/composition-graders.js`
2. After `gradeTree(tree)` on line 301, also call `gradeComposition(tree)`
3. Extend `RunResult` with a `compositionReport: GradeReport | null` field
4. Extend `PromptAggregate` and `Baseline` types to include composition rule pass rates alongside structural ones
5. Update the report table to show composition rules as additional columns
6. Update baseline save/compare to include composition data
7. Maintain backward compatibility: if comparing against an old baseline that lacks composition data, show "N/A" for those columns

**Acceptance criteria:**

- `tsx scripts/eval-generative.ts --verbose` prints both structural (8) and composition (6) rule columns
- `--save-baseline` persists composition scores
- `--compare` shows deltas for composition rules

### D3: Add `--skills` flag to CLI eval for A/B comparison (M)

**File:** `packages/kumo/scripts/eval-generative.ts`

**Changes:**

1. Add `--skills` CLI flag (boolean). When set, include `X-Playground-Key` header and `skillIds` (all 18 skill IDs) in each POST to `/api/chat`
2. Add `--playground-key <key>` CLI flag for the auth secret (required when `--skills` is used). Falls back to `PLAYGROUND_SECRET` env var.
3. Fetch skill IDs from `GET /api/chat/skills` at startup (requires auth)
4. In the request body, include `skillIds: allSkillIds` when `--skills` is set

**Intended workflow:**

```bash
# Baseline: no skills
tsx scripts/eval-generative.ts --save-baseline no-skills

# With skills
tsx scripts/eval-generative.ts --skills --playground-key $KEY --save-baseline with-skills

# Compare
tsx scripts/eval-generative.ts --compare no-skills --save-baseline current
```

**Acceptance criteria:**

- `--skills` without `--playground-key` (and no env var) prints error and exits
- With valid key + `--skills`, requests include `skillIds` array in body and `X-Playground-Key` header
- Without `--skills`, requests have no auth header and no skillIds (existing behavior)
- Baselines from skills vs no-skills runs are structurally identical (same JSON shape) and can be compared with `--compare`

### D4: Wire `gradeComposition()` into playground Grading tab (M)

**File:** `packages/kumo-docs-astro/src/components/demos/_PlaygroundPage.tsx`

**Changes:**

1. Import `gradeComposition` and `COMPOSITION_RULE_NAMES` from `@cloudflare/kumo/generative` (already re-exported from barrel, line 66-71 of generative/index.ts)
2. In `GradingTabContent` (line 1362), call `gradeComposition(tree)` alongside `gradeTree(tree)` in the `runGrade` callback
3. Store composition report in separate state: `const [compositionReport, setCompositionReport] = useState<GradeReport | null>(null)`
4. Render two sections in the grading tab:
   - **Structural** (existing) — 8 rules from `gradeTree()`
   - **Composition** (new) — 6 rules from `gradeComposition()`
5. Update the score display: show `{structuralPass}/{structuralTotal} + {compositionPass}/{compositionTotal}` or a combined count
6. Add `COMPOSITION_RULE_DESCRIPTIONS` map for human-readable descriptions:
   - `has-visual-hierarchy`: "Uses heading variants to establish content hierarchy"
   - `has-responsive-layout`: "Complex layouts use Grid with variant prop"
   - `surface-hierarchy-correct`: "No Surface directly nested inside Surface"
   - `spacing-consistency`: "Sibling Stack gaps stay within one scale step"
   - `content-density`: "Element count between 3 and 100"
   - `action-completeness`: "Forms include a Button for user action"

**Acceptance criteria:**

- Playground grading tab shows 14 rules (8 structural + 6 composition)
- Composition rules appear in a visually distinct section (e.g. separate heading)
- Debouncing behavior is preserved (composition grading runs in same `runGrade` callback)
- Score summary reflects both structural and composition pass counts

### D5: Generate eval fixtures and capture first baseline (M)

**Depends on:** D1, D2, D3

**Process (manual, documented):**

1. Start docs dev server: `pnpm dev`
2. Run CLI eval with JSONL saving: `tsx scripts/eval-generative.ts --save-jsonl --save-baseline v0-no-skills --runs 3`
3. Copy best-scoring JSONL files from `.eval-outputs/` to `tests/generative/eval/fixtures/` — one per prompt ID
4. This requires mapping CLI eval prompt names to Vitest eval prompt IDs (they're different sets — see note below)
5. Run with skills: `tsx scripts/eval-generative.ts --skills --playground-key $KEY --save-jsonl --save-baseline v0-with-skills --runs 3`
6. Compare: `tsx scripts/eval-generative.ts --compare v0-no-skills`

**Note:** After D1 unifies the prompt sets, the CLI uses the same 13 prompts as the Vitest harness. Baselines are captured against all 13.

**Acceptance criteria:**

- `.eval-baselines/v0-no-skills.json` exists with structural + composition scores
- `.eval-baselines/v0-with-skills.json` exists with structural + composition scores
- `--compare` between the two shows per-rule deltas, giving the first quantified skill influence measurement
- `.eval-outputs/` contains raw JSONL files for both runs

**Artifacts to commit:**

- Baselines: `.eval-baselines/*.json` — gitignored (machine-specific, model-dependent)
- Outputs: `.eval-outputs/*.jsonl` — gitignored (large, ephemeral)

### D6: `/playground/report` — eval report page (L)

**Depends on:** D2 (needs `gradeComposition`), D4 (shared grading UI patterns)

**New files:**

- `packages/kumo-docs-astro/src/pages/playground/report.astro` — Astro page wrapper
- `packages/kumo-docs-astro/src/components/demos/_EvalReportPage.tsx` — React island (client:load)

**Routing:** Moving `playground.astro` to `playground/index.astro` to enable nested routes. `/playground` keeps working, `/playground/report` is new.

**Architecture:** Entirely client-side. No new server bindings. Two data modes:

1. **Live eval mode** — "Run Eval" button sends 13 prompts to `/api/chat` sequentially, grades each response with `gradeTree()` + `gradeComposition()`, renders results as they complete. Requires auth (`X-Playground-Key`).
2. **Upload mode** — drag-and-drop zone accepts `.eval-baselines/*.json` files (the `Baseline` type from the CLI eval). Renders the same report from saved data. Enables A/B comparison and trend-over-time.

**Auth:** Same `X-Playground-Key` gate as `/api/chat`. Unauthenticated users see upload-only mode (no live eval button).

**UI sections:**

#### 6a. Header

- Title: "Eval Report"
- Controls: "Run Eval" button (auth only), "Upload Baseline" drop zone, skills toggle checkbox (auth only)
- Status: progress indicator during live eval (e.g. "Evaluating 4/13...")

#### 6b. Per-prompt pass/fail matrix

- Table: 13 rows (prompts) × 14 columns (8 structural + 6 composition rules)
- Cells: green (pass) / red (fail) / gray (not yet run)
- Row click → expands to show violation messages per failing rule
- Column headers: abbreviated rule names, hoverable for full description
- Summary row at bottom: per-rule pass rate across all prompts

#### 6c. Skills A/B comparison (when two baselines loaded)

- Side-by-side tables or overlay diff
- Per-rule delta with ▲/▼ indicators (reuse `delta()` formatting from CLI eval)
- Overall score comparison: "No skills: 72% → With skills: 85% (▲ +13%)"

#### 6d. Trend over time (when multiple baselines loaded)

- Simple line chart (use lightweight SVG — no chart library dependency)
- X-axis: baseline timestamp, Y-axis: overall pass rate
- One line per rule category (structural, composition, overall)
- Click a data point to load that baseline's full matrix

#### 6e. Per-rule drill-down

- Click any rule column header → filtered view showing only that rule
- Lists all 13 prompts with pass/fail + violation messages for failures
- Shows pass rate for that rule: "has-visual-hierarchy: 11/13 (85%)"

**State management:** All state in React (useState/useReducer). No global store. Shape:

```typescript
interface EvalReportState {
  /** Currently displayed eval run (live or uploaded) */
  current: EvalRun | null;
  /** Previously loaded baselines for comparison/trends */
  baselines: EvalRun[];
  /** Live eval progress */
  liveEval: {
    status: "idle" | "running" | "complete" | "error";
    completedPrompts: number;
    totalPrompts: number;
  };
}

interface EvalRun {
  name: string;
  timestamp: string;
  skills: boolean;
  prompts: PromptResult[];
  overall: { structural: number; composition: number; combined: number };
}

interface PromptResult {
  id: string;
  expectedPattern: string;
  structuralReport: GradeReport;
  compositionReport: GradeReport;
}
```

**Live eval flow:**

1. User clicks "Run Eval" (+ optionally checks "With Skills")
2. Fetch skill IDs from `GET /api/chat/skills` if skills enabled
3. For each of the 13 `EVAL_PROMPTS`: POST to `/api/chat` → parse SSE → JSONL → `parseJsonlToTree()` → `gradeTree()` + `gradeComposition()`
4. Update state after each prompt completes (progressive rendering)
5. On complete, show full matrix + option to "Save as Baseline" (downloads JSON)

**Upload flow:**

1. User drags `.json` file onto drop zone (or clicks to browse)
2. Parse as `Baseline` type (validate shape)
3. Render report from uploaded data
4. Multiple uploads accumulate in `baselines[]` for comparison/trends

**Reuse from existing code:**

- `fetchJsonl()` SSE→JSONL parsing logic from `eval-generative.ts` (adapt for browser `fetch`)
- `parseJsonlToTree`, `gradeTree`, `gradeComposition` from `@cloudflare/kumo/generative`
- `EVAL_PROMPTS` from `@cloudflare/kumo/generative` (needs re-export — see below)
- Auth pattern from `_PlaygroundPage.tsx` (X-Playground-Key header)

**Re-export needed:** `EVAL_PROMPTS` and `EvalPrompt` type are currently in `packages/kumo/src/generative/eval/eval-prompts.ts` but NOT exported from the `@cloudflare/kumo/generative` barrel. Need to add to `packages/kumo/src/generative/index.ts`.

**Acceptance criteria:**

- `/playground/report` loads for authenticated users
- "Run Eval" executes 13 prompts against `/api/chat`, shows progressive results
- Pass/fail matrix renders 13×14 grid with color-coded cells
- Row expansion shows violation messages
- Upload accepts CLI-generated baseline JSON and renders same matrix
- Two baselines loaded → A/B comparison view appears with deltas
- 3+ baselines loaded → trend chart appears
- "Save as Baseline" downloads current results as JSON
- Unauthenticated users see upload-only mode

## Non-goals

- **Vitest fixture population** — the offline Vitest harness needs `.jsonl` files in `tests/generative/eval/fixtures/`. D5 produces JSONL in `.eval-outputs/` but copying them to Vitest fixtures is a separate manual step.
- **`EVAL_ONLINE` implementation** — the Vitest harness placeholder for live LLM calls stays unimplemented.
- **LLM-as-judge scoring** — an LLM rating outputs on rubrics is a future layer on top of the deterministic graders.
- **Per-skill A/B testing** — measuring individual skill influence (18 separate runs) is explicitly out of scope. We measure all-skills vs no-skills only.
- **Prompt changes** — no changes to `buildSystemPrompt()` or skill content. This spec measures what exists.
- **Chart library** — trend chart is SVG-only. No recharts/d3/chart.js dependency.
- **Server-side persistence** — no KV/R2/D1. All data lives in browser memory or downloaded JSON files.

## Risks

| Risk                                                 | Likelihood | Impact                             | Mitigation                                                                                          |
| ---------------------------------------------------- | ---------- | ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| Workers AI rate limiting kills eval runs             | Medium     | Blocks D5/D6 live eval             | CLI has `--delay` flag (3500ms). Browser live eval adds 3s delay between requests. 13 prompts ~45s. |
| Model non-determinism makes baselines noisy          | High       | Reduces signal                     | 3 runs per prompt in CLI. Live eval is single-run (lower confidence, clearly labeled).              |
| Skills don't actually change output quality          | Medium     | Existential for skill investment   | That's the whole point of measuring. A null result is still a valid result.                         |
| `gradeComposition()` too strict for simple prompts   | Medium     | False negatives inflate failures   | `has-responsive-layout` already exempts ≤12 elements. Monitor which rules fail systematically.      |
| Live eval hits rate limiter (20 req/min anonymous)   | High       | D6 live eval fails mid-run         | Live eval requires auth (100 req/min). 13 requests with 3s delay = ~39s, well under limit.          |
| `playground.astro` → `playground/index.astro` rename | Low        | Could break existing links/deploys | Astro handles both; test that `/playground` still resolves after move.                              |

## Dependency Order

```
D1 (unify prompts) ──► D2 (CLI composition grading) ──┐
                                                        ├──► D5 (generate fixtures + baseline)
                       D3 (CLI --skills flag)          ──┘

D4 (playground composition UI) ──┐
                                  ├──► D6 (report page)
D2 (CLI composition grading)   ──┘
```

D4 and D6 share grading patterns. D6 also needs the `EVAL_PROMPTS` re-export which D1 enables.

## Resolved Questions

- **Q1:** `.eval-baselines/` and `.eval-outputs/` → **gitignored**. Document capture process in D5 instead.
- **Q2:** Prompt sets → **aligned to Vitest's 13** via D1. CLI imports from `eval-prompts.ts`.
- **Q3:** Report data source → **live eval + upload**. No server persistence. All client-side.
