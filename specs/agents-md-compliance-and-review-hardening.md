# Spec: AGENTS.md Compliance & Review Hardening

**Type:** Strategy + Feature Plan
**Effort:** L (1-2 days total, parallelizable)
**Status:** Ready for task breakdown

## Problem

Company-wide mandate (effective immediately): all repos require up-to-date AGENTS.md, INCIDENTS.md, ARCHITECTURE.md, and AI code review approval (or SVP override) for merges. The Kumo repo has AGENTS.md files from 2026-02-09 but is 85 commits ahead with numeric drift, undocumented features (CLI `ai` command, VR gate), and a factually incorrect claim ("No GitHub Actions workflows checked into repo"). No INCIDENTS.md or ARCHITECTURE.md exist. The reviewer prompt is functional but could be strengthened. No pre-commit/pre-push gates exist beyond changeset validation.

**Cost of not solving:** Non-compliance with the mandate. AI reviewer operates with stale context, reducing its effectiveness at catching the kinds of errors leadership is focused on preventing.

## Constraints

- **Branch policy:** All work stays on the current branch. No new branches.
- **Out of scope:** Adding a GitLab CI AI review bot (another team handles that). This repo uses GitHub Actions.
- **Existing tooling:** `index-knowledge` skill exists locally at `.agents/skills/index-knowledge/SKILL.md`. The `ask-bonk` GitHub Action powers both `/bonk` and `/review`.
- **Auto-generated files:** `ai/component-registry.json`, `ai/schemas.ts`, `src/styles/theme-kumo.css`, `src/primitives/*` must never be edited directly.
- **Time sensitivity:** "Effective immediately" mandate. Prioritize compliance over perfection.

## Deliverables

### D1: Full AGENTS.md Regeneration (M)

**Depends on:** Nothing

Run the `index-knowledge` skill with `--create-new` to regenerate all AGENTS.md files from scratch. The current files are 85 commits stale with the following known gaps:

| File                        | Gap                                                                          | Severity |
| --------------------------- | ---------------------------------------------------------------------------- | -------- |
| Root                        | "No GitHub Actions workflows" — factually wrong (6 workflows exist)          | High     |
| Root                        | Component count 35 -> 38, primitives 37 -> 38, demos 40 -> 44, blocks 2 -> 3 | Low      |
| Root                        | Branch header stale (`rozenmd/agents-init`)                                  | Cosmetic |
| `packages/kumo/`            | CLI `ai` command undocumented                                                | Medium   |
| `packages/kumo/`            | Component count 35 -> 38, `as any` count 3 -> 2                              | Low      |
| `ci/`                       | VR gate CI job not documented                                                | Medium   |
| `packages/kumo-docs-astro/` | Demo/block/component page counts stale                                       | Low      |

**New AGENTS.md locations to evaluate** (directories currently uncovered):

| Directory                          | Rationale                                                               |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `lint/`                            | 6 files, 1382 LOC of custom AST-traversal rules. Complex, undocumented. |
| `.github/` or `.github/workflows/` | 6 active workflows — contradicts current root AGENTS.md claim           |
| `packages/kumo/scripts/`           | 20-file codegen backbone. Parent AGENTS.md covers surface only.         |
| `_examples/`                       | 3 distinct example projects with different architectures                |

**Procedure:**

1. Snapshot existing files: `find . -name "AGENTS.md" -not -path "*/node_modules/*" -exec cp {} {}.bak \;`
2. Run `index-knowledge --create-new`
3. Diff each `.bak` against regenerated output
4. Manually merge back hand-added sections not re-derived (especially regression prevention tests from `packages/kumo/AGENTS.md`)
5. Delete `.bak` files

**Acceptance criteria:**

- All existing AGENTS.md files regenerated with current commit hash + timestamp
- Root AGENTS.md correctly documents GitHub Actions workflows
- All numeric counts accurate to current state
- CLI `ai` command documented in `packages/kumo/AGENTS.md`
- Regression prevention tests section preserved in `packages/kumo/AGENTS.md`
- VR gate documented in `ci/AGENTS.md`
- Scoring determines which new directories warrant their own AGENTS.md
- No content duplication between parent/child files (hierarchical dedup)
- Root file: 50-150 lines. Subdirectory files: 30-80 lines.

### D2: Create INCIDENTS.md (S)

**Depends on:** Nothing

Kumo is a UI component library with no known production incidents (not edge infrastructure). Create a lightweight but mandate-compliant file.

**Contents:**

- Header explaining this is a UI component library (not edge-serving infrastructure)
- Template for recording incidents if they occur
- Cross-reference to the docs site deployment (the one area where Kumo touches production infra)
- Note: the visual regression gate was added to prevent UI regressions

**Acceptance criteria:**

- File exists at repo root: `INCIDENTS.md`
- Contains incident template with fields: date, severity, summary, root cause, resolution, prevention
- Accurately states no historical incidents
- References VR gate as a prevention mechanism

### D3: Create ARCHITECTURE.md (S)

**Depends on:** D1 (references AGENTS.md files)

Lightweight overview — pointers, not prose. Avoid duplicating AGENTS.md content.

**Contents:**

- High-level diagram: monorepo package relationships + build pipeline flow
- Theming system overview: semantic tokens -> `light-dark()` CSS custom properties -> automatic dark mode
- Codegen pipeline: docs demos -> registry -> Figma data (the non-obvious cross-package flow)
- Publish/release flow: changesets -> version PR -> npm publish
- CI architecture: 6 GitHub Actions workflows, artifact bus pattern, VR gate
- Pointers to each package's AGENTS.md for detailed conventions

**Acceptance criteria:**

- File exists at repo root: `ARCHITECTURE.md`
- Contains ASCII or mermaid diagram of package relationships
- Documents the 3-step codegen pipeline with correct ordering
- References (not duplicates) AGENTS.md files for detailed conventions
- Under 100 lines

### D4: Tune Reviewer + Bonk Agent Prompts (M)

**Depends on:** D1 (reviewer reads AGENTS.md)

Two files to improve:

**A) `.github/workflows/reviewer.yml` inline prompt**

Current prompt is decent but missing:

- No instruction to check ARCHITECTURE.md or INCIDENTS.md
- No instruction to verify auto-generated files aren't being edited directly
- No instruction to check changeset presence
- No mention of regression prevention tests (CSS contract, browser compat, Tailwind conflict)
- No codex compliance checking
- No instruction to verify component scaffolding was used (not manual file creation)

Additions to the reviewer prompt:

- Read ARCHITECTURE.md and INCIDENTS.md in addition to AGENTS.md
- Flag PRs that edit auto-generated files (`ai/schemas.ts`, `ai/component-registry.json`, `src/styles/theme-kumo.css`, `src/primitives/*`)
- Flag PRs that add new components without using the scaffolding tool (check for `PLOP_INJECT_EXPORT` marker)
- Flag PRs to `packages/kumo/` missing a changeset (redundant with CI but early signal)
- Reference regression prevention test categories when reviewing component changes

**B) `.opencode/agents/kumo.md` agent config**

Current config is solid but:

- Component count stale (35 -> 38)
- No mention of regression prevention tests
- No mention of VR gate
- No mention of ARCHITECTURE.md/INCIDENTS.md
- No mention of the `ai` CLI command
- Doesn't reference codex or incident-prevention focus

Updates:

- Fix numeric counts
- Add regression prevention test section
- Add VR gate awareness
- Add link to ARCHITECTURE.md
- Add the `ai` CLI command to common commands
- Add a section on incident prevention focus (per the mandate's spirit)

**Acceptance criteria:**

- Reviewer prompt references all 3 documentation files (AGENTS.md, ARCHITECTURE.md, INCIDENTS.md)
- Reviewer prompt flags auto-generated file edits
- Reviewer prompt flags missing scaffolding
- `kumo.md` agent config has accurate counts and covers regression prevention
- Both files pass a self-review (reviewer can find its own documentation)

### D5: Add Pre-push AGENTS.md Staleness Check + Pre-commit Lint (M)

**Depends on:** D1 (needs regenerated AGENTS.md with current commit hash)

**Recommendation rationale:** A headless opencode review on pre-push is too slow (minutes) for a git hook. Instead:

**A) Pre-commit: lint staged files (fast, <5s)**

Add to `lefthook.yml`:

```yaml
pre-commit:
  commands:
    oxlint:
      glob: "*.{ts,tsx,js,jsx,astro}"
      run: pnpm oxlint {staged_files}
```

This catches the most common errors (raw Tailwind colors, `dark:` variants, cross-package imports) before they even reach CI. Aligns with Vivitsu's suggestion of pre-commit gates.

**B) Pre-push: AGENTS.md staleness check (fast, <2s)**

Add to `lefthook.yml` alongside existing `validate-changeset`:

```yaml
pre-push:
  commands:
    validate-changeset:
      # ... existing ...
    check-agents-staleness:
      run: |
        AGENTS_COMMIT=$(head -1 AGENTS.md | grep -oP 'Commit: \K\w+' || echo "none")
        COMMITS_SINCE=$(git rev-list --count ${AGENTS_COMMIT}..HEAD 2>/dev/null || echo "999")
        if [ "$COMMITS_SINCE" -gt 50 ]; then
          echo "WARNING: AGENTS.md is $COMMITS_SINCE commits behind HEAD."
          echo "Run: opencode /index-knowledge to update."
          echo "Bypass with: git push --no-verify"
        fi
      skip:
        - merge
        - rebase
```

This is a **warning, not a blocker** — it prints a message but doesn't fail the push. This matches the mandate's spirit ("make sure your agent is up to date") without blocking urgent work.

**Acceptance criteria:**

- `lefthook.yml` has both `pre-commit` and `pre-push` sections
- Pre-commit runs `pnpm oxlint {staged_files}` with glob `*.{ts,tsx,js,jsx,astro}`
- Pre-push warns (doesn't block) when AGENTS.md is >50 commits stale
- Existing `validate-changeset` pre-push hook unchanged
- Both hooks can be bypassed (`LEFTHOOK=0`, `--no-verify`)

## Delivery Order

```
D1 (AGENTS.md regen) ──┐
D2 (INCIDENTS.md)   ───┤──> D3 (ARCHITECTURE.md) ──> D4 (prompt tuning) ──> D5 (hooks)
                        │
                        └──> D4 can start partially in parallel with D3
```

D1 and D2 can run in parallel. D3 needs D1's output to reference. D4 needs D1 + D3 to know what files exist. D5 needs D1's commit hash for the staleness check.

## Risks

| Risk                                                                                 | Likelihood | Impact | Mitigation                                                                                                                                                 |
| ------------------------------------------------------------------------------------ | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index-knowledge` regeneration produces worse output than hand-tuned existing files  | Medium     | Medium | Review output carefully; the existing `packages/kumo/AGENTS.md` has hand-added regression prevention sections that must be preserved or improved, not lost |
| Pre-commit lint hook annoys developers with false positives from oxlint custom rules | Low        | Medium | Start with warning mode; the custom rules are already enforced in CI so staged-file lint shouldn't surprise anyone                                         |
| AGENTS.md staleness warning threshold (50 commits) is wrong                          | Medium     | Low    | Tunable constant; 50 is ~1 week of activity based on current velocity (85 commits in 14 days)                                                              |
| Reviewer prompt becomes too long, hitting token limits or degrading review quality   | Low        | High   | Keep additions surgical; the `ask-bonk` action handles context windowing but we should measure prompt length before/after                                  |

## Non-Goals

- Adding a GitLab CI review bot (another team)
- Migrating from GitHub Actions to GitLab CI
- Implementing AI approval as a merge gate (another team, per Rajesh/Joaquin)
- Creating a global review agent (company-level initiative)
- Implementing codex compliance blocking (Ryan's team roadmap item)
- Writing AGENTS.md for every single directory (scoring determines which ones warrant it)

## Resolved Questions

### Q1: oxlint staged-file invocation

**Resolved: YES, it works.** Lefthook natively supports `{staged_files}` interpolation. The `glob` filter is applied to the staged files list before substitution — so `glob: "*.{ts,tsx,js,jsx,astro}"` filters staged files, then `{staged_files}` receives only the matching subset.

Correct syntax (no `--config` flag needed if oxlintrc.json is in repo root):

```yaml
pre-commit:
  commands:
    oxlint:
      glob: "*.{ts,tsx,js,jsx,astro}"
      run: pnpm oxlint {staged_files}
```

Lefthook also auto-splits long file lists to stay under OS command length limits (260K chars on macOS). No gotchas.

### Q2: index-knowledge preservation

**Resolved: NO, `--create-new` does not preserve hand-added sections.** It reads existing files into memory as LLM context, then deletes all files and regenerates from scratch. Hand-added content may or may not reappear depending on whether the LLM re-derives it.

**Impact:** `packages/kumo/AGENTS.md` has hand-added content from commits `fc656b5` and `3040f38`:

- Expanded `tests/` structure (css-contract, build, lint)
- 3 new WHERE TO LOOK rows (CSS class contract, browser compat guard, Tailwind conflict lint)
- Entire "Regression Prevention Tests" subsection with 3-category table

**Mitigation (added to D1 procedure):**

1. Snapshot all AGENTS.md files before regeneration: `find . -name "AGENTS.md" -not -path "*/node_modules/*" -exec cp {} {}.bak \;`
2. Run `index-knowledge --create-new`
3. Diff each `.bak` against new output
4. Manually merge back hand-added sections that weren't re-derived
5. Delete `.bak` files

### Q3: Reviewer prompt token budget

**Resolved: No concern.** The numbers:

| Component                   | Est. Tokens         |
| --------------------------- | ------------------- |
| Static prompt + PR metadata | ~370                |
| All 5 AGENTS.md files       | ~8,325              |
| ARCHITECTURE.md (projected) | ~1,500              |
| INCIDENTS.md (projected)    | ~500                |
| OpenCode system prompt      | ~1,500              |
| PR diff (typical)           | 2,000-15,000        |
| Full file reads             | 5,000-30,000        |
| **Total typical session**   | **~20K-57K tokens** |

Opus 4.6 context window: **1M tokens**. Worst-case usage: <6%. No token budget is exposed by the `ask-bonk` action. Adding ARCHITECTURE.md + INCIDENTS.md adds ~2K tokens — negligible.

**One refinement for D4:** Make the prompt directive explicit about _why_ to read each file: "Read ARCHITECTURE.md for structural context. Read INCIDENTS.md to understand what failure modes to watch for." This keeps the signal-to-noise ratio high rather than just dumping more context.
