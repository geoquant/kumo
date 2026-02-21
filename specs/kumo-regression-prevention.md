# Kumo Regression Prevention — Implementation Spec

**Status:** Draft (updated after rebasing to upstream/main @ 04989f0)  
**Date:** 2026-02-20  
**Context:** Multiple regressions shipped to dash this week via kumo version bumps.

## Problem Statement

**Who:** Engineers consuming `@cloudflare/kumo` in stratus (and other Cloudflare dashboards).  
**What:** Kumo ships breaking CSS and JS changes that are invisible to its own CI, caught only after deployment to production.  
**Why it matters:** Each regression requires an emergency fix MR in stratus, costs engineer hours, and erodes trust in kumo upgrades. Multiple regressions this week alone.

**Evidence — This week's regression chain:**

| #   | What Broke                                 | Root Cause in Kumo                                                                                           | Caught By                 | Time to Fix                              |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------- | ---------------------------------------- |
| 1   | Modals/dropdowns behind dialogs in dash    | PR #104 removed `.z-modal { z-index: 9999 }` from `kumo-binding.css`. 12 stratus files depend on this class. | User reports after deploy | ~hours (stratus !33262 added class back) |
| 2   | Combobox dropdowns not scrollable          | `overflow-hidden` re-introduced in `combobox.tsx:182` during token migration, overrides `overflow-y-auto`    | User reports              | ~hours (kumo PR #127)                    |
| 3   | Filter dropdown overflow on AI models page | Downstream effect of #2                                                                                      | User reports              | stratus !33286 workaround                |
| 4   | E2E logout test broken                     | Kumo dropdown changed rendered DOM structure/test IDs                                                        | CI (but stratus-side)     | stratus !33194                           |

**Earlier regressions (same pattern):**

- `toSorted()` (ES2023) shipped in kumo's bundle — Chrome <110 crashed. No build target enforcement.
- Every kumo bump breaks snapshot tests in stratus (Max Rozen migrating 3 MRs this week alone).

## Current State of Kumo's Defenses

| Defense                           | Status                                                    | Blocks Merge?          |
| --------------------------------- | --------------------------------------------------------- | ---------------------- |
| Vitest unit tests                 | **3/39 components tested** (1 with real behavioral tests) | Yes                    |
| TypeScript                        | Yes                                                       | Yes                    |
| oxlint + eslint                   | Yes (enforces semantic tokens, a11y)                      | Yes                    |
| Visual regression                 | Exists (pixelmatch screenshots)                           | **No — advisory only** |
| Browser compat lint               | **Does not exist**                                        | —                      |
| CSS class contract                | **Does not exist**                                        | —                      |
| Build target enforcement          | **Does not exist** (defaults to `esnext`)                 | —                      |
| Tailwind class conflict detection | **Does not exist**                                        | —                      |

The four components that regressed (dialog, select, combobox, dropdown) have **zero tests**.

## Proposed Solution

Four targeted, independent deliverables that each prevent a specific class of regression. Ordered by ROI.

### D1: CSS Class Contract Test (prevents accidental CSS class removal)

**Problem:** Kumo exports CSS classes that downstream consumers depend on (`.no-scrollbar`, `.link-current`, `.skeleton-line`, etc.), but there's no manifest or test ensuring they exist in the built CSS output. The z-modal class was already removed on main (PR #104 merged), but this pattern will recur for other classes.

**Note on z-modal:** `.z-modal` is **already removed** from main. Stratus added it back locally (!33262). The contract test would have caught this _before_ it shipped — the team would have been forced to either keep it or deliberately remove it from the manifest with a major version bump.

**Approach:** Create a manifest of public CSS classes currently in `kumo-binding.css` and a test that asserts each class exists in the built CSS output (`dist/kumo.css`).

```typescript
// tests/css-contract/css-classes.test.ts
import { readFileSync } from "fs";

/**
 * Public CSS classes exported by kumo-binding.css.
 * These are part of kumo's public API — downstream consumers depend on them.
 *
 * REMOVING a class from this list requires a MAJOR version bump.
 * ADDING a class is safe (minor/patch).
 */
const PUBLIC_CSS_CLASSES = [
  // Utility classes
  "no-scrollbar",
  "no-input-spinner",
  "link-current",
  "link-external-icon",
  // Animation classes
  "skeleton-line",
  "animate-bounce-in",
  "float",
  // Component-specific classes
  "kumo-tooltip-popup",
  "kumo-popover-popup",
] as const;

describe("CSS class contract", () => {
  const css = readFileSync("dist/kumo.css", "utf-8");

  for (const className of PUBLIC_CSS_CLASSES) {
    it(`exports .${className}`, () => {
      // Match the class selector in CSS output
      expect(css).toMatch(new RegExp(`\\.${className}[\\s{,:]`));
    });
  }
});
```

**Key decisions:**

- Test runs against **built output** (`dist/kumo.css`), not source — catches build pipeline issues too.
- Manifest is a literal array in the test file, not auto-generated. Adding requires intent, removing fails the test.
- Uses `describe.skipIf(!isBuilt)` pattern already established in `tests/imports/`.

### D2: Build Target Enforcement (prevents toSorted-class regressions)

**Problem:** Vite config has no explicit `build.target`, defaulting to `esnext`. This passes through ES2023+ APIs like `toSorted()` that aren't supported in older browsers stratus targets.

**Approach:** Two changes:

1. **Set explicit build target** in `vite.config.ts`:

```typescript
build: {
  target: "es2022", // Matches tsconfig. Excludes ES2023 (toSorted, etc.)
  // ...
}
```

2. **Add a post-build lint** that scans `dist/*.js` for known-problematic APIs:

```typescript
// tests/build/browser-compat.test.ts
const BANNED_APIS = [
  "toSorted", // ES2023 — not in Chrome <110
  "toReversed", // ES2023
  "toSpliced", // ES2023
  "findLast", // ES2023
  "findLastIndex", // ES2023
  ".with(", // ES2023 Array.prototype.with
  "structuredClone", // Not in older Safari
  "Array.fromAsync", // ES2024
];

describe("browser compatibility", () => {
  const jsFiles = readdirSync("dist", { recursive: true })
    .filter((f) => String(f).endsWith(".js"))
    .map((f) => join("dist", String(f)));

  for (const api of BANNED_APIS) {
    it(`does not use ${api}()`, () => {
      for (const file of jsFiles) {
        const content = readFileSync(file, "utf-8");
        expect(content).not.toContain(`.${api}(`);
      }
    });
  }
});
```

**Why both:** The build target catches syntax (optional chaining, etc.) but NOT API usage (`Array.prototype.toSorted` is valid syntax in any ES version). The post-build lint catches API usage.

### D3: Tailwind Class Conflict Lint (prevents combobox overflow regression)

**Problem:** `cn("overflow-y-auto", "overflow-hidden")` silently resolves to `overflow-hidden` (last wins in tailwind-merge). The combobox overflow regression was literally two conflicting classes in the same `cn()` call.

**Approach:** Custom oxlint rule or a vitest-based static analysis test that scans component files for conflicting Tailwind class pairs in `cn()` calls.

```typescript
// tests/lint/tailwind-conflicts.test.ts
// AST-scan all component .tsx files for cn() calls with conflicting classes

import { Project } from "ts-morph";

const CONFLICT_PAIRS = [
  ["overflow-hidden", "overflow-y-auto"],
  ["overflow-hidden", "overflow-x-auto"],
  ["overflow-hidden", "overflow-auto"],
  ["overflow-visible", "overflow-hidden"],
  ["hidden", "block"],
  ["hidden", "flex"],
  ["invisible", "visible"],
];

// IMPORTANT: conflicts can span multiple string arguments in a single cn() call.
// e.g. cn("overflow-y-auto ...", "overflow-hidden ...") — the combobox bug was exactly this.
// Must use AST parsing to collect ALL string literal arguments within a cn() call,
// tokenize all classes across arguments, then check for pairs.
```

**Implementation approach:** Use `ts-morph` (already available as a dev dep via `ts-json-schema-generator`) to:

1. Find all `cn()` call expressions in `src/components/**/*.tsx`
2. Collect all string literal arguments (including template literal quasis)
3. Tokenize by whitespace to extract class names
4. Check collected classes against `CONFLICT_PAIRS`

This correctly catches the combobox bug where `overflow-y-auto` was in the first string arg and `overflow-hidden` was in the second.

**Note:** This bug is **still live on main** (`combobox.tsx:181-182`). Implementing D3 would immediately surface it as a failing test, forcing a fix.

**Alternative considered:** `eslint-plugin-tailwindcss` has a `no-contradicting-classname` rule, but adding eslint-plugin-tailwindcss is heavy and kumo primarily uses oxlint. A focused vitest test with AST parsing is lighter and more targeted.

**Alternative considered:** Regex-based scanning. Rejected because `cn()` calls often contain conditional expressions, template literals, and variable references that make regex unreliable.

### D4: Promote Visual Regression to Merge Blocker (prevents visual CSS regressions)

**Problem:** The visual regression system already exists and covers dialog, select, combobox, dropdown with click/hover actions. But it's advisory-only — changes to `preview.yml` needed.

**Approach (branch protection, NOT workflow refactoring):**

The simplest path is to make the existing `Visual Regression` job in `preview.yml` a **required status check** via GitHub branch protection rules. This avoids duplicating the docs-build → docs-deploy → screenshot pipeline into `pullrequest.yml`.

1. Add branch protection rule requiring `Visual Regression` check to pass.
2. Modify the visual regression script to **exit non-zero** when pixel diff exceeds threshold (currently it always succeeds and just posts a comment).
3. Set diff threshold at >0.5% pixel change = failure.
4. Add `continue-on-error: true` fallback if screenshot worker is unreachable (with annotation warning).
5. Allow manual override via PR label (e.g., `visual-change-approved`).

**Trade-off:** This adds ~2-3 min to every PR that touches components. But it's the ONLY defense for visual CSS regressions that don't manifest in unit tests.

**Open question:** The visual regression relies on an external screenshot worker (`kumo-screenshot-worker.design-engineering.workers.dev`) and requires `SCREENSHOT_API_KEY`. If the worker is down, PRs would be blocked. Need a fallback strategy (skip if worker unreachable?).

## Scope & Deliverables

| #   | Deliverable                        | Effort   | Depends On                  | Files Touched                                                                                              |
| --- | ---------------------------------- | -------- | --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| D1  | CSS class contract test            | S (1-2h) | Build exists (`dist/`)      | New: `tests/css-contract/css-classes.test.ts`                                                              |
| D2  | Build target + browser compat test | S (1-2h) | —                           | `vite.config.ts`, new: `tests/build/browser-compat.test.ts`                                                |
| D3  | Tailwind class conflict lint       | M (3-5h) | —                           | New: `tests/lint/tailwind-conflicts.test.ts` (uses ts-morph for AST)                                       |
| D4  | Visual regression as merge blocker | M (3-4h) | External worker reliability | `ci/visual-regression/run-visual-regression.ts`, `.github/workflows/preview.yml`, GitHub branch protection |

**Total effort: L (1.5-2 days)**

## Non-Goals (Explicit Exclusions)

- **Stratus-side CI changes.** This spec is kumo-only.
- **Full component test coverage.** Writing behavioral tests for all 39 components is a separate, larger effort.
- **Changeset severity classification automation.** Out of scope; the CSS contract test makes this less critical.
- **Deprecation workflow for CSS classes.** Handled by the manifest — removal fails the test, forcing a deliberate decision.
- **Combobox/dialog behavioral unit tests.** Valuable but separate effort; these deliverables prevent the _class_ of bug, not each individual bug.
- **DOM structure / test ID stability contract.** Regression #4 (E2E test ID change) is NOT covered by D1-D4. This is a different class of problem (DOM structure stability) that would require rendering components and snapshotting `data-testid` attributes. Acknowledged gap — worth a follow-up spec if it recurs.

## Acceptance Criteria

- [ ] Removing any current public CSS class from `kumo-binding.css` fails CI (D1)
- [ ] Adding `toSorted()` to any component file and building → fails CI (D2)
- [ ] A `cn()` call containing both `overflow-hidden` and `overflow-y-auto` → fails CI (D3)
- [ ] Visual change to dialog/select/combobox/dropdown → blocks merge with diff report (D4)
- [ ] All new tests run in <30 seconds total (D1-D3)
- [ ] No new runtime dependencies added

## Test Strategy

| Layer       | What                               | How                                                    |
| ----------- | ---------------------------------- | ------------------------------------------------------ |
| Unit (D1)   | CSS class presence in dist         | Read `dist/kumo.css`, regex match class selectors      |
| Unit (D2)   | Banned API absence in dist         | Read `dist/**/*.js`, string search for API names       |
| Static (D3) | Tailwind class conflicts in source | AST or regex scan of `cn()` calls in `src/components/` |
| Visual (D4) | Screenshot diff                    | Pixelmatch with threshold, already implemented         |

## Risks & Mitigations

| Risk                                                                  | Likelihood | Impact                                     | Mitigation                                                                |
| --------------------------------------------------------------------- | ---------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| D1 manifest becomes stale (new classes added to CSS but not manifest) | Medium     | Low (false negatives, not false positives) | Manifest only protects existing classes; new classes are opt-in           |
| D2 banned API list is incomplete                                      | Medium     | Low                                        | Start with known ES2023 APIs; expand as discovered                        |
| D3 false positives on intentional class overrides                     | Low        | Medium                                     | Allow `// eslint-disable` or test exclusion pattern                       |
| D4 screenshot worker outage blocks all PRs                            | Medium     | High                                       | Add timeout + skip-on-failure, or use `continue-on-error` with annotation |
| D4 visual diff flakiness (font rendering, anti-aliasing)              | Medium     | Medium                                     | Pixel threshold (0.5%) absorbs minor rendering differences                |

## Trade-offs Made

| Chose                                 | Over                                     | Because                                                                     |
| ------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------- |
| Post-build tests against `dist/`      | Source-level lint only                   | Catches build pipeline issues (minification, tree-shaking removing classes) |
| Explicit banned API list              | `eslint-plugin-compat` with browserslist | Compat plugin lints source, not bundle output; kumo bundles dependencies    |
| Vitest test for Tailwind conflicts    | Full `eslint-plugin-tailwindcss`         | Lighter weight; kumo uses oxlint primarily; only need conflict detection    |
| Pixel threshold for visual regression | Zero-diff tolerance                      | Font rendering differences between CI runners cause false positives         |
| Manifest as code (literal array)      | Auto-generated manifest                  | Forces deliberate addition/removal; auto-generation defeats the purpose     |

## Open Questions

- [ ] **D4 worker reliability**: What's the uptime of `kumo-screenshot-worker`? Need data before making it a merge blocker. → Owner: Matt Rothenberg
- [ ] **D2 target browsers**: What's stratus's minimum browser target? Need to align kumo's `build.target`. `es2022` covers Chrome 94+ which should be safe. → Owner: design-engineering
- [ ] **D1 z-modal re-addition**: `z-modal` was removed on main but stratus still depends on it. Should kumo re-add it to the manifest as a compat class (not used internally), or is stratus's local definition sufficient? → Owner: Matt Rothenberg
- [ ] **D3 scope**: Should the conflict lint also check for Tailwind class conflicts in `cva()`/variant definitions, or only `cn()` calls? → Owner: implementer
