# CI/CD Scripts

TypeScript scripts + shell scripts for validation, reporting, versioning, and deployment. Called by 6 GitHub Actions workflows in `.github/workflows/`.

**Parent:** See [root AGENTS.md](../AGENTS.md) for monorepo context.

## STRUCTURE

```
ci/
├── tsconfig.json              # ES2022, strict, Node types
├── reporters/
│   ├── types.ts               # Core types + artifact I/O (ci/reports/*.json)
│   ├── index.ts               # Reporter registry + re-exports
│   ├── npm-release.ts         # NPM beta install instructions (priority 10)
│   └── kumo-docs-preview.ts   # Docs preview URL (priority 30)
├── scripts/
│   ├── validate-kumo-changeset.ts   # Pre-push + CI changeset enforcement
│   ├── post-pr-report.ts            # Aggregates artifacts → GitHub PR comment
│   └── create-release-pr.ts         # Creates release PR via GitHub API
├── utils/
│   ├── git-operations.ts      # Git ref detection (CI + local), diff, changed files
│   ├── github-api.ts          # Octokit wrapper (hardcoded: cloudflare/kumo)
│   └── pr-reporter.ts         # Markdown assembly + comment posting
└── versioning/
    ├── publish-beta.sh        # version → build → publish → verify (45s) → report
    ├── release-production.sh  # Branch → version → build → publish → verify → push → PR
    └── deploy-kumo-docs-preview.sh   # Build → wrangler versions upload → preview URL
```

## WHERE TO LOOK

| Task                 | Location                                   | Notes                                                             |
| -------------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| Changeset validation | `scripts/validate-kumo-changeset.ts`       | Used by lefthook pre-push AND CI                                  |
| PR comment system    | `reporters/` + `scripts/post-pr-report.ts` | Artifact bus via `ci/reports/*.json`                              |
| Beta release         | `versioning/publish-beta.sh`               | Calls version-beta.sh internally                                  |
| Production release   | `versioning/release-production.sh`         | Creates release branch + PR                                       |
| Git operations       | `utils/git-operations.ts`                  | Dual-mode: GitHub Actions env vars / local `merge-base`           |
| VR detection         | `.github/workflows/preview.yml`            | Visual regression screenshots (informational, never blocks merge) |

## CONVENTIONS

### Artifact Bus Pattern

Jobs communicate via filesystem: each writes JSON to `ci/reports/{id}.json`, final job reads all.

- Priority determines display order (lower = higher in comment): npm=10, docs=30
- Reporter returns `null` to skip; `readReportArtifacts()` handles partial failures

### Dual-Mode Git Operations

`getGitRefs()` adapts automatically:

- **CI**: Uses `GITHUB_BASE_REF` / `GITHUB_HEAD_REF`
- **Local**: Computes `git merge-base origin/main HEAD`
- Uses `execFileSync` (array args) to prevent shell injection

## ANTI-PATTERNS

| Pattern                                  | Why                    | Instead                                |
| ---------------------------------------- | ---------------------- | -------------------------------------- |
| Reading `process.env.*` directly         | Bypasses typed context | Use `buildContextFromEnv()`            |
| Adding reporter without registry         | Won't be collected     | Add to `reporters/index.ts` array      |
| Running `release-production.sh` as agent | Sensitive operation    | Human-only; use `DRY_RUN=true` to test |

## NOTES

- **`DRY_RUN=true`**: Production release script gates all destructive operations
- **Hardcoded repo**: `github-api.ts` uses `owner: "cloudflare", repo: "kumo"`
