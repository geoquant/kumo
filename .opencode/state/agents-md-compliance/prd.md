# PRD: AGENTS.md Compliance & Review Hardening

**Date:** 2026-02-21
**Branch:** `geoquant/kumo-regression-prevention`

> **IMPORTANT:** All work for this PRD MUST stay on branch `geoquant/kumo-regression-prevention`. Do NOT create new branches. Do NOT switch branches. All commits, file changes, and task completion happen on this branch only.

---

## Problem Statement

### What problem are we solving?

Company-wide mandate (effective immediately): all repos require up-to-date AGENTS.md, INCIDENTS.md, ARCHITECTURE.md, and AI code review approval for merges. The Kumo repo is non-compliant:

- **AGENTS.md files are 85 commits stale** (generated 2026-02-09, now at commit `731ad17`). Contains a factually incorrect claim ("No GitHub Actions workflows checked into repo") when 6 workflows exist. Numeric counts are wrong (35 components vs actual 38, etc.). Undocumented features: CLI `ai` command, VR gate CI job.
- **INCIDENTS.md does not exist.**
- **ARCHITECTURE.md does not exist.**
- **Reviewer prompt is incomplete** — doesn't flag auto-generated file edits, missing scaffolding, or reference regression prevention tests.
- **No pre-commit/pre-push quality gates** beyond changeset validation.

### Why now?

Direct mandate from SVP, triggered by repeated production incidents across Cloudflare. The mandate requires either AI code review approval or SVP sign-off for all changes. Repos must demonstrate compliance through up-to-date AGENTS.md (within a few commits of HEAD), INCIDENTS.md, and ARCHITECTURE.md. Programmatic enforcement is being built by Rajesh Bhatia / Joaquin Madruga.

### Who is affected?

- **Primary: AI agents** — The `/review` bot and `/bonk` assistant read AGENTS.md to produce reviews. Stale context means worse reviews, defeating the mandate's purpose.
- **Primary: Kumo engineers** — Local opencode sessions get stale context. Pre-commit hooks would catch errors before CI.
- **Primary: Compliance auditors** — Programmatic checks will verify AGENTS.md recency, INCIDENTS.md existence, ARCHITECTURE.md existence.

---

## Proposed Solution

### Overview

Regenerate all AGENTS.md files using the `index-knowledge` skill, create INCIDENTS.md and ARCHITECTURE.md, harden the AI reviewer and bonk agent prompts with stronger guardrails, and add lefthook-based pre-commit lint and pre-push staleness warnings.

---

## End State

When this PRD is complete, the following will be true:

- [ ] All AGENTS.md files regenerated with current commit hash, accurate counts, and no factual errors
- [ ] Hand-added content (regression prevention tests) preserved through regeneration
- [ ] New AGENTS.md files created for directories that score high enough (lint/, .github/, etc.)
- [ ] INCIDENTS.md exists at repo root with incident template
- [ ] ARCHITECTURE.md exists at repo root with package diagram and pipeline documentation
- [ ] `/review` prompt flags auto-generated file edits, missing scaffolding, missing changesets
- [ ] `/bonk` agent config has accurate counts, regression prevention awareness, VR gate knowledge
- [ ] Pre-commit hook runs oxlint on staged files
- [ ] Pre-push hook warns when AGENTS.md is >50 commits stale
- [ ] README.md references ARCHITECTURE.md and INCIDENTS.md

---

## Success Metrics

### Quantitative

| Metric                    | Current          | Target            | Measurement Method                                                                                          |
| ------------------------- | ---------------- | ----------------- | ----------------------------------------------------------------------------------------------------------- |
| AGENTS.md commit distance | 85 commits stale | <50 commits stale | `git rev-list --count` from header hash to HEAD                                                             |
| Compliance checklist pass | 2/5 items        | 5/5 items         | AGENTS.md exists + current, INCIDENTS.md exists, ARCHITECTURE.md exists, hooks installed, reviewer hardened |

### Qualitative

- AI reviewer produces more actionable findings due to accurate context
- Engineers trust AGENTS.md content because it matches reality

---

## Acceptance Criteria

### AGENTS.md Regeneration

- [ ] Root AGENTS.md has `Generated:` header with current date and commit hash
- [ ] Root AGENTS.md documents 6 GitHub Actions workflows (reviewer, bonk, pullrequest, preview, preview-deploy, release)
- [ ] Root AGENTS.md has correct counts: 38 components, 38 primitives, 44+ demos, 3 blocks
- [ ] `packages/kumo/AGENTS.md` documents CLI `ai` command
- [ ] `packages/kumo/AGENTS.md` has regression prevention tests section (CSS contract, browser compat, Tailwind conflict lint)
- [ ] `ci/AGENTS.md` documents VR gate CI job
- [ ] `packages/kumo-docs-astro/AGENTS.md` has correct demo/block/component page counts
- [ ] No content duplication between parent and child AGENTS.md files
- [ ] Root file: 50-150 lines. Subdirectory files: 30-80 lines
- [ ] `index-knowledge` scoring evaluated lint/, .github/, packages/kumo/scripts/, \_examples/ for new AGENTS.md

### INCIDENTS.md

- [ ] File exists at repo root
- [ ] Header explains this is a UI component library (not edge infrastructure)
- [ ] Contains incident template: date, severity, summary, root cause, resolution, prevention
- [ ] States no historical incidents
- [ ] References VR gate as prevention mechanism
- [ ] Cross-references docs site deployment as production-adjacent surface

### ARCHITECTURE.md

- [ ] File exists at repo root
- [ ] Contains ASCII or mermaid diagram of monorepo package relationships
- [ ] Documents theming: semantic tokens -> `light-dark()` CSS custom properties -> automatic dark mode
- [ ] Documents 3-step codegen pipeline: docs demos -> registry -> Figma data (correct ordering)
- [ ] Documents publish flow: changesets -> version PR -> npm publish
- [ ] Documents CI: 6 GitHub Actions workflows, artifact bus pattern, VR gate
- [ ] References each package's AGENTS.md for detailed conventions (no duplication)
- [ ] Under 100 lines

### Reviewer Prompt Hardening

- [ ] Prompt reads ARCHITECTURE.md for structural context
- [ ] Prompt reads INCIDENTS.md for failure modes
- [ ] Prompt flags PRs editing auto-generated files (`ai/schemas.ts`, `ai/component-registry.json`, `src/styles/theme-kumo.css`, `src/primitives/*`)
- [ ] Prompt flags PRs adding components without scaffolding (checks `PLOP_INJECT_EXPORT` marker)
- [ ] Prompt flags PRs to `packages/kumo/` missing a changeset
- [ ] Prompt references regression prevention test categories
- [ ] Static prompt text stays under ~1K tokens

### Bonk Agent Config

- [ ] Component count updated from 35 to 38
- [ ] Regression prevention tests section added
- [ ] VR gate mentioned as CI mechanism
- [ ] ARCHITECTURE.md referenced
- [ ] CLI `ai` command in Common Commands
- [ ] Incident prevention focus section added

### Pre-commit Hook

- [ ] `lefthook.yml` has `pre-commit` section
- [ ] oxlint command uses `glob: "*.{ts,tsx,js,jsx,astro}"`
- [ ] oxlint command runs `pnpm oxlint {staged_files}`
- [ ] Hook catches `bg-blue-500` in a staged .ts file (manual verification)

### Pre-push Hook

- [ ] `lefthook.yml` pre-push has `check-agents-staleness` command
- [ ] Extracts commit hash from AGENTS.md `Generated:` header
- [ ] Warns (does not block) when >50 commits stale
- [ ] Skips on merge and rebase
- [ ] Existing `validate-changeset` hook unchanged

### README.md

- [ ] References ARCHITECTURE.md
- [ ] References INCIDENTS.md

---

## Technical Context

### Existing Patterns

- AGENTS.md generation: `.agents/skills/index-knowledge/SKILL.md` — 4-phase skill (discover, score, generate, review)
- Reviewer workflow: `.github/workflows/reviewer.yml` — inline prompt in "Run Reviewer" step, uses `ask-bonk/ask-bonk/github@main` action with Opus 4.6
- Bonk agent: `.opencode/agents/kumo.md` — 214-line agent config referenced by `agent: kumo` in `bonk.yml`
- Git hooks: `lefthook.yml` — currently only `pre-push` with `validate-changeset`

### Key Files

- `AGENTS.md` — root knowledge base (7.4K bytes, 131 lines)
- `packages/kumo/AGENTS.md` — component library knowledge base (9.5K bytes, 129 lines, hand-edited Feb 21)
- `packages/kumo-docs-astro/AGENTS.md` — docs site knowledge base (5.5K bytes, 95 lines)
- `packages/kumo-figma/AGENTS.md` — Figma plugin knowledge base (6.5K bytes, 105 lines)
- `ci/AGENTS.md` — CI/CD knowledge base (5.3K bytes, 90 lines)
- `.github/workflows/reviewer.yml` — reviewer workflow (81 lines)
- `.github/workflows/bonk.yml` — bonk workflow (38 lines)
- `.opencode/agents/kumo.md` — bonk agent config (214 lines)
- `lefthook.yml` — git hooks config (12 lines)

### System Dependencies

- `index-knowledge` skill requires Task subagent dispatch, LSP (optional), bash, file I/O
- `ask-bonk` action routes through Cloudflare AI Gateway to Anthropic Claude
- Lefthook requires installation (`lefthook install` after clone)
- oxlint available via `pnpm oxlint` (already a dependency)

### Critical Constraint: Hand-Added Content

`packages/kumo/AGENTS.md` contains hand-added content from commits `fc656b5` and `3040f38` that was NOT part of the original generation:

- Expanded `tests/` structure (css-contract, build, lint directories)
- 3 WHERE TO LOOK rows for regression prevention tests
- Entire "Regression Prevention Tests" subsection with 3-category table

The `index-knowledge --create-new` flag does NOT preserve hand-added sections. It reads existing files as LLM context, deletes all, then regenerates. **Procedure:** snapshot files as `.bak` before regeneration, diff after, manually merge back lost sections.

### Token Budget (Resolved)

| Component                   | Est. Tokens |
| --------------------------- | ----------- |
| Reviewer static prompt      | ~370        |
| All AGENTS.md files         | ~8,325      |
| ARCHITECTURE.md (projected) | ~1,500      |
| INCIDENTS.md (projected)    | ~500        |
| Typical session total       | ~20K-57K    |

Opus 4.6 context window: 1M tokens. Worst-case usage: <6%. No concern.

---

## Risks & Mitigations

| Risk                                                                          | Likelihood | Impact | Mitigation                                                                                     |
| ----------------------------------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------- |
| `index-knowledge` regeneration loses hand-added regression prevention content | Medium     | Medium | Snapshot `.bak` files before regen, diff after, merge back manually                            |
| Pre-commit oxlint hook produces false positives from custom rules             | Low        | Medium | Custom rules already enforced in CI — no new surprises. Bypassable via `LEFTHOOK=0`            |
| AGENTS.md staleness threshold (50 commits) is too aggressive or too lenient   | Medium     | Low    | Tunable constant. 50 = ~1 week at current velocity (85 commits / 14 days)                      |
| Reviewer prompt additions degrade review quality via noise                    | Low        | High   | Keep additions surgical. Explicit purpose directives ("read X for Y") prevent context dilution |

---

## Alternatives Considered

### Alternative 1: Targeted Manual Update (patch existing files)

- **Description:** Manually fix the known gaps (component counts, workflow claim, VR gate) without regenerating.
- **Pros:** Preserves all hand-added content. No risk of regression. Faster for the immediate fixes.
- **Cons:** Doesn't re-score directories for new AGENTS.md. Doesn't update the hierarchical structure. Leaves systemic staleness — counts will drift again in 2 weeks.
- **Decision:** Rejected. 85 commits of drift is too large for surgical patches. Full regeneration resets the baseline and evaluates new directories.

### Alternative 2: Update Mode (not --create-new)

- **Description:** Run `index-knowledge` without `--create-new` to modify existing files in-place.
- **Pros:** Better chance of preserving hand-added content. Less disruptive.
- **Cons:** Update mode still has no explicit section-locking. The skill's update behavior is less well-documented than create-new. May produce inconsistent results — some files updated, some not.
- **Decision:** Rejected. Create-new with snapshot/merge-back is more predictable and produces a clean baseline. The merge-back step is manageable (one file has hand-added content).

### Alternative 3: Skip Regeneration, Fix Gaps Manually

- **Description:** Don't run the skill at all. Just hand-edit the 7 known gaps.
- **Pros:** Zero risk. Fast. No tooling dependency.
- **Cons:** Doesn't evaluate new directories (lint/, .github/, scripts/). Doesn't update the `Generated:` header, so staleness checks still flag it. Doesn't exercise the regeneration workflow we'll need to maintain ongoing freshness.
- **Decision:** Rejected. Misses the spirit of the mandate ("run the skill regularly to keep agents current").

---

## Non-Goals (v1)

- **GitLab CI AI review bot** — Another team handles this. Kumo uses GitHub Actions.
- **AI approval as merge gate** — Being built by Rajesh/Joaquin. Out of scope for this repo.
- **Global review agent** — Company-level initiative, not repo-specific.
- **Codex compliance blocking** — Ryan's team roadmap item for the OpenCode CI component.
- **AGENTS.md for every directory** — Scoring determines which directories warrant one. Not forcing coverage.
- **Headless opencode pre-push review** — Too slow (minutes) for a git hook. Pre-commit lint is the fast gate.

---

## Documentation Requirements

- [ ] README.md updated to reference ARCHITECTURE.md and INCIDENTS.md
- [ ] No additional external documentation needed — the deliverables ARE the documentation

---

## Open Questions

None — all questions resolved during spec phase. See `specs/agents-md-compliance-and-review-hardening.md` Resolved Questions section for Q1 (lefthook syntax), Q2 (index-knowledge preservation), Q3 (token budget).

---

## Appendix

### References

- Spec: `specs/agents-md-compliance-and-review-hardening.md`
- Mandate source: Slack thread from SVP Dane Knecht (2026-02-20)
- Intent Layer article: https://intent-systems.com/blog/intent-layer (Tyler Brandt)
- Dillon Mulroy's index-knowledge skill: https://github.com/dmmulroy/.dotfiles/blob/main/home/.config/opencode/skill/index-knowledge/SKILL.md
- INCIDENT-8255 exercise: https://wiki.cfdata.org/display/~msilverlock/INCIDENT-8255+exercise
