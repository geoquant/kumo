# Architecture

Kumo is a pnpm monorepo with three packages that form a unidirectional data pipeline.

## Package Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                        kumo (monorepo)                      │
│                                                             │
│  ┌──────────────────┐    codegen     ┌──────────────────┐   │
│  │  kumo-docs-astro │ ─────────────► │       kumo       │   │
│  │  (Astro site)    │  demo metadata │  (component lib) │   │
│  │  kumo-ui.com     │                │  @cloudflare/kumo│   │
│  └──────────────────┘                └────────┬─────────┘   │
│                                               │ registry    │
│                                               ▼             │
│                                      ┌──────────────────┐   │
│                                      │    kumo-figma    │   │
│                                      │  (Figma plugin)  │   │
│                                      └──────────────────┘   │
│                                                             │
│  ┌──────────┐  ┌────────────────┐  ┌─────────────────────┐  │
│  │  ci/     │  │ lint/ (oxlint) │  │ .github/workflows/  │  │
│  └──────────┘  └────────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

Data flows left-to-right: docs demos → component registry → Figma generators. See each package's `AGENTS.md` for conventions:

- [`packages/kumo/AGENTS.md`](packages/kumo/AGENTS.md) — component library
- [`packages/kumo-docs-astro/AGENTS.md`](packages/kumo-docs-astro/AGENTS.md) — docs site
- [`packages/kumo-figma/AGENTS.md`](packages/kumo-figma/AGENTS.md) — Figma plugin
- [`ci/AGENTS.md`](ci/AGENTS.md) — CI/CD scripts

## Codegen Pipeline

Three-stage pipeline with cross-package dependencies. Order matters.

```
1. kumo-docs-astro    pnpm codegen:demos        → dist/demo-metadata.json
2. kumo               pnpm codegen:registry     → ai/component-registry.{json,md} + ai/schemas.ts
3. kumo-figma         pnpm build:data           → generated/*.json → esbuild → code.js
```

Stage 2 consumes stage 1 output. Stage 3 consumes stage 2 output. Breaking the order produces stale or incomplete data.

## Theming

```
scripts/theme-generator/config.ts    (source of truth)
        ↓ codegen
src/styles/theme-kumo.css            (CSS custom properties using light-dark())
        ↓ consumed by
Tailwind v4 semantic tokens          (bg-kumo-base, text-kumo-default, etc.)
```

- `light-dark()` CSS function switches values automatically — no `dark:` variant needed
- Mode set via `data-mode="light"|"dark"` on a parent element
- FedRamp theme: `data-theme="fedramp"` overrides token values
- Surface hierarchy: `bg-kumo-base` → `bg-kumo-elevated` → `bg-kumo-recessed`

## Publish Flow

```
Developer adds changeset     →  pnpm changeset (required for kumo/ changes)
PR merges to main            →  release.yml triggers
Changesets version PR        →  Bumps versions, updates CHANGELOG
Version PR merges            →  release.yml: build → npm publish → docs deploy
```

Beta publishes happen on every PR via `preview.yml` → `publish-beta.sh`.

## CI Workflows

6 GitHub Actions workflows at `.github/workflows/`:

| Workflow       | Trigger           | Key function                         |
| -------------- | ----------------- | ------------------------------------ |
| pullrequest    | PR events         | Build, test, lint, changeset check   |
| preview        | PR events         | Beta publish, docs preview, VR shots |
| preview-deploy | Workflow call     | Fork-safe docs preview deployment    |
| release        | Push to main      | Production npm publish + docs deploy |
| reviewer       | `/review` comment | AI code review (Opus 4.6)            |
| bonk           | Workflow dispatch | Generic AI agent runner              |

**Artifact bus**: CI jobs communicate via `ci/reports/*.json`. Each reporter writes a JSON artifact; `post-pr-report.ts` aggregates them into a single PR comment.

**VR detection**: `preview.yml` runs visual regression — posts before/after screenshots to PR. Informational only; never blocks merge.
