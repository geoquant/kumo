# PRD: Kumo Regression Prevention

**Date:** 2026-02-20

---

## Problem Statement

### What problem are we solving?

Kumo ships breaking CSS and JS changes that are invisible to its own CI and only caught after deployment to production dashboards. Each regression requires emergency fixes in downstream repos (stratus), costs engineer hours, and erodes trust in kumo upgrades.

This week alone, four regressions shipped:

1. **z-modal removal** — PR #104 removed `.z-modal { z-index: 9999 }` from `kumo-binding.css`. 12 stratus files depend on this class. Caught by user reports after deploy.
2. **Combobox overflow** — `overflow-hidden` re-introduced in `combobox.tsx:182` during token migration, overriding `overflow-y-auto`. Caught by user reports.
3. **Filter dropdown overflow** — Downstream effect of #2. Required stratus workaround.
4. **E2E logout test broken** — Dropdown DOM structure/test ID change. Caught by stratus CI.

Earlier: `toSorted()` (ES2023) shipped in kumo's bundle, crashing Chrome <110. No build target enforcement exists.

### Why now?

Multiple regressions shipped in a single week. The current test infrastructure covers only 3 of 39 components (1 with real behavioral tests). The four components that regressed — dialog, select, combobox, dropdown — have zero tests. The visual regression system exists but is advisory-only and doesn't block merge.

### Who is affected?

- **Primary users:** Engineers consuming `@cloudflare/kumo` in stratus and other Cloudflare dashboards. They bear the cost of investigating and fixing regressions caused upstream.
- **Secondary users:** End users of Cloudflare dashboards who experience broken UI (modals behind dialogs, non-scrollable dropdowns, crashes on older browsers).

---

## Proposed Solution

### Overview

Four independent, targeted defenses that each prevent a specific class of regression that has already shipped. Each defense is a test or lint that runs in CI and blocks merge when it fails. No new runtime dependencies are added.

### Defense 1: CSS Class Contract Test

Kumo exports CSS classes in `kumo-binding.css` that downstream consumers depend on (`.no-scrollbar`, `.link-current`, `.skeleton-line`, etc.). There is no manifest or test ensuring these classes exist in built output. The z-modal removal was caught only after production deployment.

A manifest of public CSS classes and a post-build test asserting each class exists in `dist/kumo.css`. Removing a class from the manifest requires a deliberate decision (and a major version bump). The manifest is a literal array in the test file, not auto-generated — adding requires intent, removing fails the test.

### Defense 2: Build Target Enforcement

Vite config has no explicit `build.target`, defaulting to `modules` (es2020). ES2023+ APIs like `toSorted()` pass through unbundled. Two changes: (1) set explicit `build.target: "es2022"` in `vite.config.ts`, (2) add a post-build lint scanning `dist/*.js` for known-problematic APIs (toSorted, toReversed, toSpliced, findLast, etc.).

The build target catches syntax issues but NOT API usage (`Array.prototype.toSorted` is valid syntax in any ES version). The post-build lint catches API usage.

### Defense 3: Tailwind Class Conflict Lint

`cn("overflow-y-auto", "overflow-hidden")` silently resolves to `overflow-hidden` (last wins in tailwind-merge). The combobox overflow regression was exactly this — two conflicting classes in the same `cn()` call spanning multiple string arguments.

A vitest-based static analysis test that uses AST parsing to find all `cn()` calls in component source, collects all string literal arguments within each call, tokenizes classes, and checks for known conflict pairs.

**Note:** The combobox bug is still live on main (`combobox.tsx:181-182`). Implementing this defense will immediately surface it as a failing test.

### Defense 4: Visual Regression as Merge Blocker

The visual regression system already exists (pixelmatch screenshots covering dialog, select, combobox, dropdown with click/hover actions). But it's advisory-only. The simplest path is making the existing `Visual Regression` job in `preview.yml` a required status check via GitHub branch protection, and modifying the script to exit non-zero when pixel diff exceeds threshold.

---

## End State

When this PRD is complete, the following will be true:

- [ ] A CSS class contract test exists and runs in CI against built output; removing any public CSS class from `kumo-binding.css` fails the build
- [ ] `vite.config.ts` has an explicit `build.target: "es2022"`; a post-build test scans dist JS for banned browser APIs
- [ ] A Tailwind class conflict lint scans all component `cn()` calls for conflicting class pairs; conflicts fail the build
- [ ] The existing visual regression check blocks merge when pixel diff exceeds 0.5% threshold
- [ ] All new tests run in <30 seconds total
- [ ] No new runtime dependencies added
- [ ] The live combobox overflow conflict on main is surfaced and fixed

---

## Success Metrics

### Quantitative

| Metric                                | Current     | Target | Measurement Method                                     |
| ------------------------------------- | ----------- | ------ | ------------------------------------------------------ |
| CSS class removal regressions shipped | >=1/quarter | 0      | Stratus emergency MRs caused by kumo CSS class removal |
| Browser compat regressions shipped    | >=1/quarter | 0      | Stratus emergency MRs caused by kumo API compat        |
| Tailwind class conflict regressions   | >=1/quarter | 0      | Stratus emergency MRs caused by kumo class conflicts   |
| Visual CSS regressions shipped        | >=1/quarter | 0      | Stratus emergency MRs caused by kumo visual changes    |
| New tests execution time              | N/A         | <30s   | CI timing                                              |

### Qualitative

- Engineers trust kumo version bumps won't break dashboards
- Reduced emergency fix overhead in stratus

---

## Acceptance Criteria

### CSS Class Contract (D1)

- [ ] Test file at `tests/css-contract/css-classes.test.ts` asserts all public CSS classes from `kumo-binding.css` exist in `dist/kumo.css`
- [ ] Removing any current public CSS class fails CI
- [ ] Test uses `describe.skipIf(!isBuilt)` pattern from `tests/imports/`
- [ ] Manifest covers: `no-scrollbar`, `no-input-spinner`, `link-current`, `link-external-icon`, `skeleton-line`, `animate-bounce-in`, `float`, `kumo-tooltip-popup`, `kumo-popover-popup`

### Build Target Enforcement (D2)

- [ ] `vite.config.ts` has explicit `build.target: "es2022"`
- [ ] Test file at `tests/build/browser-compat.test.ts` scans `dist/**/*.js` for banned APIs
- [ ] Adding `toSorted()` to any component and building fails CI
- [ ] Banned API list includes: `toSorted`, `toReversed`, `toSpliced`, `findLast`, `findLastIndex`, `.with(`, `structuredClone`, `Array.fromAsync`

### Tailwind Class Conflict Lint (D3)

- [ ] Test file at `tests/lint/tailwind-conflicts.test.ts` scans `src/components/**/*.tsx` for `cn()` calls
- [ ] Detects conflicts spanning multiple string arguments in a single `cn()` call
- [ ] A `cn()` call containing both `overflow-hidden` and `overflow-y-auto` fails CI
- [ ] Conflict pairs include: `overflow-hidden`/`overflow-y-auto`, `overflow-hidden`/`overflow-x-auto`, `overflow-hidden`/`overflow-auto`, `overflow-visible`/`overflow-hidden`, `hidden`/`block`, `hidden`/`flex`, `invisible`/`visible`

### Visual Regression Blocker (D4)

- [ ] `Visual Regression` job in `preview.yml` is a required status check
- [ ] `run-visual-regression.ts` exits non-zero when pixel diff exceeds 0.5% threshold
- [ ] Fallback: `continue-on-error: true` with annotation warning if screenshot worker is unreachable
- [ ] Manual override via PR label `visual-change-approved`
- [ ] Visual change to dialog/select/combobox/dropdown blocks merge with diff report

---

## Technical Context

### Existing Patterns

- Post-build test with skip guard: `packages/kumo/tests/imports/export-path-validation.test.ts` — uses `describe.skipIf(!isBuilt)` to gracefully skip when `dist/` isn't built
- CSS class definitions: `packages/kumo/src/styles/kumo-binding.css` — all 10 public CSS classes that form the contract
- Visual regression pipeline: `ci/visual-regression/run-visual-regression.ts` — discovers components, captures screenshots via worker, pixelmatch comparison, posts PR comment

### Key Files

- `packages/kumo/vite.config.ts` — Build config; needs `build.target` addition (line ~48, in the `build` block)
- `packages/kumo/src/styles/kumo-binding.css` — Source of truth for public CSS classes (186 lines)
- `ci/visual-regression/run-visual-regression.ts` — Visual regression script (682 lines); needs exit-code change
- `.github/workflows/preview.yml` — Workflow containing the `Visual Regression` job
- `.github/workflows/pullrequest.yml` — PR workflow (runs tests that block merge)
- `packages/kumo/tests/imports/test-utils.ts` — Shared test utilities for post-build tests
- `packages/kumo/src/components/combobox/combobox.tsx:181-182` — Live `cn()` conflict bug (D3 will catch this)

### System Dependencies

- `pixelmatch` — Already used by visual regression
- `ts-morph` — NOT currently a dependency. Needed for D3 AST parsing. Alternative: use TypeScript compiler API directly, or a lighter AST approach
- `kumo-screenshot-worker.design-engineering.workers.dev` — External Cloudflare Worker for screenshot capture (D4 depends on its reliability)

---

## Risks & Mitigations

| Risk                                                                  | Likelihood | Impact                                     | Mitigation                                                                                                                                         |
| --------------------------------------------------------------------- | ---------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 manifest becomes stale (new classes added to CSS but not manifest) | Medium     | Low (false negatives, not false positives) | Manifest only protects existing classes; new classes are opt-in                                                                                    |
| D2 banned API list is incomplete                                      | Medium     | Low                                        | Start with known ES2023 APIs; expand as discovered                                                                                                 |
| D3 false positives on intentional class overrides                     | Low        | Medium                                     | Allow test exclusion pattern or inline comment suppression                                                                                         |
| D3 `ts-morph` is not currently a dependency                           | Low        | Low                                        | Can use TypeScript compiler API directly, or simpler AST parsing. `ts-json-schema-generator` (existing dev dep) depends on `ts-morph` transitively |
| D4 screenshot worker outage blocks all PRs                            | Medium     | High                                       | `continue-on-error: true` with annotation warning when worker unreachable                                                                          |
| D4 visual diff flakiness (font rendering, anti-aliasing)              | Medium     | Medium                                     | 0.5% pixel threshold absorbs minor rendering differences                                                                                           |

---

## Alternatives Considered

### Alternative 1: Source-level lint only (instead of post-build tests for D1/D2)

- **Description:** Lint CSS classes and browser APIs at the source level rather than scanning built output.
- **Pros:** Faster; no build step required.
- **Cons:** Misses build pipeline issues (minification, tree-shaking removing classes, Vite transformations). The `toSorted()` regression was in bundled output.
- **Decision:** Rejected. Post-build tests against `dist/` catch the full class of bugs including build pipeline issues.

### Alternative 2: `eslint-plugin-compat` with browserslist (instead of banned API list for D2)

- **Description:** Use the compat plugin to lint source for browser-incompatible APIs.
- **Pros:** Comprehensive; community-maintained.
- **Cons:** Lints source, not bundle output. Kumo bundles dependencies, so incompatible APIs can come from deps. Also, kumo primarily uses oxlint.
- **Decision:** Rejected. Post-build scan of dist output is more accurate for a library that bundles deps.

### Alternative 3: `eslint-plugin-tailwindcss` (instead of custom conflict test for D3)

- **Description:** Full Tailwind ESLint plugin with `no-contradicting-classname` rule.
- **Pros:** Community-maintained, comprehensive.
- **Cons:** Heavy dependency; kumo primarily uses oxlint; only need conflict detection, not the full plugin.
- **Decision:** Rejected. A focused vitest test with AST parsing is lighter and more targeted.

### Alternative 4: Zero-diff tolerance for visual regression (instead of 0.5% threshold for D4)

- **Description:** Any pixel change fails the check.
- **Pros:** Catches every visual change.
- **Cons:** Font rendering differences between CI runners cause false positives. Would require constant overrides.
- **Decision:** Rejected. 0.5% threshold absorbs minor rendering noise while catching real regressions.

### Alternative 5: Regex-based scanning for Tailwind conflicts (instead of AST parsing for D3)

- **Description:** Use regex to find `cn()` calls and extract class names.
- **Pros:** No AST dependency needed.
- **Cons:** `cn()` calls contain conditional expressions, template literals, and variable references that make regex unreliable. Multi-argument conflicts (the exact combobox bug pattern) are hard to catch with regex.
- **Decision:** Rejected. AST parsing is more reliable for multi-argument `cn()` calls.

---

## Non-Goals (v1)

- **Stratus-side CI changes** — this is kumo-only
- **Full component test coverage** — writing behavioral tests for all 39 components is a separate, larger effort
- **Changeset severity classification automation** — the CSS contract test makes this less critical
- **Deprecation workflow for CSS classes** — handled by the manifest; removal fails the test, forcing a deliberate decision
- **Combobox/dialog behavioral unit tests** — valuable but separate effort; these deliverables prevent the _class_ of bug, not each individual bug
- **DOM structure / test ID stability contract** — regression #4 (E2E test ID change) is NOT covered. This is a different class of problem that would require rendering components and snapshotting `data-testid` attributes. Acknowledged gap worth a follow-up if it recurs

---

## Documentation Requirements

- [ ] Update `AGENTS.md` to mention new test categories (css-contract, browser-compat, tailwind-conflicts)
- [ ] Document the CSS class manifest convention (how to add/remove classes) in a comment block in the test file
- [ ] Document the `visual-change-approved` label override in contributing guide or PR template

---

## Open Questions

| Question                                                                                                              | Owner              | Due Date | Status |
| --------------------------------------------------------------------------------------------------------------------- | ------------------ | -------- | ------ |
| What's the uptime/reliability of `kumo-screenshot-worker`? Need data before making visual regression a merge blocker. | Matt Rothenberg    | TBD      | Open   |
| What's stratus's minimum browser target? Need to align kumo's `build.target`. `es2022` covers Chrome 94+.             | design-engineering | TBD      | Open   |
| Should kumo re-add `.z-modal` to the manifest as a compat class, or is stratus's local definition sufficient?         | Matt Rothenberg    | TBD      | Open   |
| Should the Tailwind conflict lint also check `cva()` variant definitions, or only `cn()` calls?                       | Implementer        | TBD      | Open   |
| Is `ts-morph` acceptable as a new dev dependency, or should D3 use a lighter AST approach?                            | Implementer        | TBD      | Open   |

---

## Appendix

### Glossary

- **kumo-binding.css** — CSS file in kumo that defines utility classes consumed by downstream dashboards
- **stratus** — Cloudflare's main dashboard monorepo, primary consumer of `@cloudflare/kumo`
- **`cn()`** — Kumo's className composition utility (wraps `clsx` + `tailwind-merge`)
- **pixelmatch** — Pixel-level image comparison library used in visual regression
- **`describe.skipIf`** — Vitest pattern to gracefully skip tests when preconditions aren't met

### References

- Source spec: `specs/kumo-regression-prevention.md`
- Stratus emergency MRs: !33262 (z-modal), !33286 (filter dropdown), !33194 (E2E test)
- Kumo PRs: #104 (z-modal removal), #127 (combobox fix)
