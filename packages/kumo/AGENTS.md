# Component Library (`@cloudflare/kumo`)

React component library: Base UI + Tailwind v4 + Vite library mode. ESM-only, tree-shakeable per-component exports.

**Parent:** See [root AGENTS.md](../../AGENTS.md) for monorepo context.

## STRUCTURE

```
kumo/
├── src/
│   ├── components/          # 38 UI components (button/, dialog/, input/, ...)
│   ├── blocks/              # 3 installable blocks (NOT library exports; via CLI `kumo add`)
│   ├── primitives/          # AUTO-GENERATED Base UI re-exports (38 files)
│   ├── catalog/             # JSON-UI rendering runtime (DynamicValue, visibility conditions)
│   ├── command-line/        # CLI: ls, doc, add, blocks, init, migrate, ai
│   ├── styles/              # CSS: kumo-binding.css + theme files (AUTO-GENERATED)
│   ├── utils/               # cn(), safeRandomId, LinkProvider
│   └── index.ts             # Main barrel export (PLOP_INJECT_EXPORT marker)
├── ai/                      # AUTO-GENERATED: component-registry.{json,md}, schemas.ts
├── scripts/
│   ├── component-registry/  # Registry codegen (13 sub-modules)
│   └── theme-generator/     # Theme CSS codegen from config.ts
├── lint/                    # 5 custom oxlint rules (superset of root lint/)
├── tests/
│   ├── imports/             # Structural validation: export paths, package.json, build entries
│   ├── css-contract/        # CSS class contract (public class survival after build)
│   ├── build/               # Post-build guards (browser compat, banned APIs)
│   └── lint/                # Source lint tests (Tailwind conflicts)
└── vite.config.ts           # Library mode, PLOP marker
```

## WHERE TO LOOK

| Task                     | Location                                        | Notes                                                      |
| ------------------------ | ----------------------------------------------- | ---------------------------------------------------------- |
| Component implementation | `src/components/{name}/{name}.tsx`              | Always check registry first                                |
| Component API reference  | `ai/component-registry.json`                    | Source of truth for props/variants                         |
| Variant definitions      | `KUMO_{NAME}_VARIANTS` export in component file | Machine-readable + lint-enforced                           |
| CLI commands             | `src/command-line/commands/`                    | `ls`, `doc`, `add`, `blocks`, `init`, `migrate`, `ai`      |
| Scaffold new component   | `plopfile.js`                                   | Injects into index.ts, vite.config.ts, package.json        |
| Token definitions        | `scripts/theme-generator/config.ts`             | Source of truth; generates theme CSS                       |
| Registry codegen         | `scripts/component-registry/index.ts`           | Pipeline: discovery → cache → type extraction → enrichment |

## CONVENTIONS

### Component File Pattern

Each `src/components/{name}/{name}.tsx` must:

1. Export `KUMO_{NAME}_VARIANTS` + `KUMO_{NAME}_DEFAULT_VARIANTS` (lint-enforced)
2. Use `forwardRef` when wrapping DOM elements; set `.displayName`
3. Use `cn()` for all className composition
4. Use Base UI primitives (`@base-ui/react`) for interactive behavior

### Build System

- **Three-step build**: `vite build` → `css-build.ts` → `build-cli.ts` (esbuild)
- **Bundled deps**: `@base-ui/react`, `clsx`, `tailwind-merge`
- **External peers**: `react`, `react-dom`, `@phosphor-icons/react` only
- **`"use client"` banner**: Injected on ALL output chunks for RSC compatibility

### Testing

- **Vitest** with `happy-dom`, globals; `describe.skipIf(!isBuilt)` for post-build tests

## ANTI-PATTERNS

| Pattern                             | Why                                    | Instead                       |
| ----------------------------------- | -------------------------------------- | ----------------------------- |
| Editing `src/primitives/`           | Auto-generated from Base UI            | Run `pnpm codegen:primitives` |
| Editing `ai/schemas.ts` or registry | Auto-generated                         | Run `pnpm codegen:registry`   |
| Creating component files manually   | Misses index/vite/package.json updates | `pnpm new:component`          |
| Dynamic Tailwind class construction | JIT can't detect `leading-[${val}]`    | Use static class strings      |

## NOTES

- **Compound components**: CommandPalette (14 sub-components), Dialog, Select use two-level contexts
- **`PLOP_INJECT_EXPORT`** in `src/index.ts` and `PLOP_INJECT_COMPONENT_ENTRY` in `vite.config.ts`
- **5th lint rule** (`no-deprecated-props`): Only in `packages/kumo/lint/`, reads from registry
