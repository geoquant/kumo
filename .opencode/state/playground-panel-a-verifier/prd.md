# Playground Panel A Verifier

## Problem

`/playground` panel A is the visual target for the A/B loop, but it currently has weak back-pressure. Large prompts like `show me every kumo component variant` can:

- blow up prompt size and SSE size
- produce malformed UI trees
- trigger repair spam in the renderer
- stall or crash the browser before the result can be judged visually

This makes panel A hard to trust and makes panel B comparisons noisy, because failure mode is currently "render first, discover breakage later".

## Goal

Add a panel A verifier that runs before browser render and produces a compact report. The verifier should reject or warn on unhealthy generations using measurable budgets and tree quality checks.

## Critical Constraint

All implementation work for this spec must stay on branch `geoquant/streaming-ui`.

- Hard block: do not implement this work on another branch.
- Spec, commits, temp scripts, and follow-up task breakdown should all call this out explicitly.

## Scope

In scope:

- a CLI-first verifier for panel A request flow
- panel A-only verification path against `/api/chat`
- compact verifier report surfacing in playground UI
- back-pressure gates based on size + repairs + malformed structure
- persisted/serializable report artifact shape for future iteration

Out of scope:

- changing panel B prompt semantics
- making panel B smarter
- redesigning the entire playground IA
- changing Workers AI model/provider behavior
- fixing every generative compound-structure issue in Kumo

## Discovery Summary

- Panel A uses generated playground prompt from `packages/kumo-docs-astro/src/lib/playground.ts` plus optional `systemPromptSupplement`.
- Panel B uses `skipSystemPrompt: true` and a minimal `BASELINE_PROMPT`; it must remain the stripped control.
- Best existing hook for post-run artifacts is the playground feedback/eval pipeline in:
  - `packages/kumo-docs-astro/src/lib/playground/eval-analysis.ts`
  - `packages/kumo-docs-astro/src/lib/playground/eval-compare.ts`
  - `packages/kumo-docs-astro/src/lib/playground/state.ts`
- Best reusable validation primitives already exist in Kumo:
  - `parseJsonlToTree()`
  - `gradeTree()`
  - `gradeComposition()`
  - `validateElement()`
  - renderer normalization + repair pipeline
- Current renderer reveals structural failures too late, in-browser, via repair spam and invalid DOM nesting warnings.
- Existing prompt display is not the full truth of what was actually sent, because runtime supplements are appended later.

## Constraints Inventory

- Panel B must stay semantically unchanged.
- Panel A should remain model-generated; no instant local fake rendering.
- Verifier must work headlessly, without requiring manual browser inspection.
- Browser render should not be first-line validation.
- Report should be compact enough for playground use, but detailed enough for debugging.
- Initial entry point should be CLI-first, not UI-first.

## Solution Space

### Option A — Advisory verifier only

Run verifier, emit report, never block panel A render.

Pros:

- safest rollout
- minimal disruption

Cons:

- does not solve browser lockups
- still renders pathological outputs

### Option B — Hard verifier gate before panel A render

Run verifier first, block render when budgets or quality checks fail.

Pros:

- strongest protection
- prevents browser meltdown

Cons:

- higher implementation complexity
- risk of over-blocking early

### Option C — Two-stage rollout (recommended)

Build a shared verifier core now, ship with explicit status tiers:

- `pass` -> render panel A normally
- `warn` -> render panel A, surface verifier warnings
- `fail` -> do not render panel A result; surface verifier failure summary and raw artifacts

Pros:

- gives real back-pressure
- preserves debuggability
- supports iterative threshold tuning

Cons:

- more moving parts than advisory-only

## Recommendation

Choose Option C.

Reasoning:

- panel A is the quality target, so it needs stronger safeguards than panel B
- pure advisory mode will not stop the browser lockups already observed
- an always-hard fail path is too brittle before thresholds are tuned
- a tiered verifier gives enough protection while preserving iteration speed

## Proposed Architecture

### 1. Shared verifier core

Add a shared verifier module for panel A generations.

Suggested location:

- `packages/kumo-docs-astro/src/lib/playground/verifier/`

Core inputs:

- prompt payload actually sent to panel A
- raw SSE response from `/api/chat`
- extracted assistant JSONL content only

Core outputs:

- normalized verifier report object
- status: `pass | warn | fail`
- summary metrics
- failure reasons
- references to raw artifacts

### 2. CLI entry point

Add a CLI script that:

1. sends the exact panel A request to `/api/chat`
2. captures raw SSE to file
3. strips reasoning chunks and keeps assistant content only
4. rebuilds JSONL output
5. parses tree via Kumo parser
6. runs grading + validation + budget checks
7. writes compact report JSON/Markdown

Suggested outputs:

- `artifacts/playground-verifier/<timestamp>/request.json`
- `artifacts/playground-verifier/<timestamp>/response.sse`
- `artifacts/playground-verifier/<timestamp>/assistant.jsonl`
- `artifacts/playground-verifier/<timestamp>/report.json`
- `artifacts/playground-verifier/<timestamp>/report.md`

### 3. Panel A gating path

Before applying panel A patches in browser:

1. stream/capture panel A response
2. run verifier on captured content
3. decide render behavior by status

Render policy:

- `pass`: render panel A normally
- `warn`: render panel A, show verifier warning summary
- `fail`: do not mount the generated A tree; show verifier failure card with drill-down links

Panel B behavior:

- unchanged request path
- unchanged prompt semantics
- no verifier gating required for initial scope

### 4. Playground UI surfacing

Add compact report surfacing without changing panel B semantics.

Recommended insertion points:

- top workspace summary strip, reusing feedback summary card pattern
- compact panel A verifier status affordance
- deep drill-down through existing `Tree`, `JSONL`, and `Grade` tabs instead of adding a new dominant mode

Minimum UI payload:

- status badge: `pass | warn | fail`
- key counters
- top 3 failure reasons
- links/actions to inspect raw JSONL/tree/report

## Verifier Checks

### Request/stream budget checks

- prompt chars
- estimated prompt tokens
- SSE byte size
- assistant content chars
- JSONL line count
- patch op count

### Tree/structure checks

- empty/zero-op output
- JSONL parse success
- tree root presence
- renderable tree check
- unknown component count
- orphan/missing child refs
- max depth threshold
- invalid compound structure detection

### Validation/repair checks

- repaired element count
- stripped prop count
- unrepaired invalid elements
- normalization diff count
- parser truncation-repair count
- dropped/ignored malformed lines count

### Quality checks

- `gradeTree()` results
- `gradeComposition()` results
- rule-level violations

## Initial Failure Gates

Initial gate family: repairs + size.

Hard fail candidates:

- zero patch ops
- no renderable tree
- malformed compound structure count over threshold
- SSE bytes over threshold
- repair count over threshold
- unrepaired invalid elements > 0

Warn-only candidates:

- composition grade below target
- high but sub-threshold patch count
- moderate repair count
- prompt token budget near ceiling

Important: thresholds should be config-driven, not hardcoded in UI logic.

## Config

Add verifier config with named budgets.

Suggested shape:

```ts
interface PlaygroundVerifierConfig {
  maxPromptChars: number;
  maxPromptTokensEstimate: number;
  maxSseBytes: number;
  maxAssistantChars: number;
  maxPatchOps: number;
  maxTreeDepth: number;
  maxRepairCount: number;
  maxStrippedProps: number;
  maxMalformedStructureCount: number;
  maxUnknownTypes: number;
  maxDroppedLines: number;
}
```

## Data Model

Add a first-class report type reusable by CLI and playground UI.

Suggested shape:

```ts
type VerifierStatus = "pass" | "warn" | "fail";

interface PlaygroundVerifierReport {
  prompt: {
    message: string;
    model: string;
    promptChars: number;
    promptTokenEstimate: number;
  };
  stream: {
    sseBytes: number;
    assistantChars: number;
    jsonlLineCount: number;
    patchOpCount: number;
    droppedLineCount: number;
    truncationRepairCount: number;
  };
  tree: {
    renderable: boolean;
    elementCount: number;
    maxDepth: number;
    unknownTypeCount: number;
    missingChildRefCount: number;
    malformedStructureCount: number;
  };
  validation: {
    repairedElementCount: number;
    strippedPropCount: number;
    unrepairedInvalidElementCount: number;
    normalizationDiffCount: number;
  };
  grading: {
    structuralScore: number | null;
    compositionScore: number | null;
    structuralViolations: number;
    compositionViolations: number;
  };
  status: VerifierStatus;
  reasons: string[];
}
```

## Deliverables

1. [D1] Verifier core module (M)
   - depends on: -
   - build shared parsing/validation/report pipeline

2. [D2] CLI runner + artifact writer (M)
   - depends on: D1
   - exact panel A request replay, raw capture, report outputs

3. [D3] Panel A render gate integration (L)
   - depends on: D1
   - verify before render, implement pass/warn/fail policy

4. [D4] Compact playground report surfacing (M)
   - depends on: D1, D3
   - summary strip/popover + drill-down links

5. [D5] Threshold/config plumbing (S)
   - depends on: D1
   - config-driven budgets and failure rules

6. [D6] Tests + fixtures (L)
   - depends on: D1, D2, D3
   - pathological stream fixtures, malformed trees, oversized runs, pass/warn/fail assertions

## Acceptance Criteria

### Functional

- panel A requests can be replayed headlessly from CLI using the same payload shape as playground
- verifier captures raw SSE and extracted assistant JSONL separately
- verifier produces structured JSON report and human-readable Markdown summary
- panel A uses verifier status before rendering generated output
- panel B request path and prompt semantics remain unchanged

### Quality/Safety

- pathological outputs like malformed table structure are caught before browser render
- zero-op or non-renderable outputs are surfaced as verifier failures, not silent renders
- verifier report includes repair counts and malformed-structure counts
- thresholds are configurable without changing component code

### UX

- playground shows compact verifier summary for panel A runs
- users can inspect raw JSONL/tree/report when a run warns or fails
- failed verifier runs do not wedge the page in an unusable state

### Branch discipline

- all implementation notes, tasks, and follow-up work explicitly state `geoquant/streaming-ui`
- no work from this spec is executed on another branch

## Risks

1. Over-blocking good generations
   - Mitigation: tiered pass/warn/fail rollout, config-driven thresholds, fixture-driven calibration

2. Duplicate logic drift between CLI verifier and browser verifier
   - Mitigation: shared core library; thin CLI/UI wrappers only

3. Prompt display still not matching actual request
   - Mitigation: include effective request payload in verifier artifact and expose it in drill-down

4. Existing validators miss some compound-structure errors
   - Mitigation: add verifier-specific structural checks for known fragile compounds, especially table-like structures

## Implementation Order

1. Build shared verifier core
2. Build CLI runner and artifact writer
3. Add fixture-based tests for pass/warn/fail
4. Integrate panel A pre-render gate
5. Surface compact report in playground UI
6. Tune thresholds using real prompts on `geoquant/streaming-ui`

## Open Questions

- None for initial spec. Threshold values are intentionally deferred to implementation-time calibration, but the gating model and architecture are fixed.
