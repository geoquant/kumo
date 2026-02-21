# Figma Plugin (`@cloudflare/kumo-figma`)

Generates production-quality Figma components from `component-registry.json`. Destructive sync: purges and recreates all components per run.

**Parent:** See [root AGENTS.md](../../AGENTS.md) for monorepo context.

## STRUCTURE

```
kumo-figma/
├── src/
│   ├── code.ts                      # Plugin entry: GENERATORS array, page management
│   ├── generators/
│   │   ├── shared.ts                # ALL constants + utilities (~1540 lines, critical file)
│   │   ├── _test-utils.ts           # Shared test assertions
│   │   ├── drift-detection.test.ts  # Meta-test: registry ↔ generator sync
│   │   └── ...                      # 35+ component generators
│   ├── parsers/
│   │   ├── tailwind-to-figma.ts     # Tailwind classes → Figma values
│   │   └── component-registry.ts    # Type-safe registry wrapper
│   └── generated/                   # BUILD OUTPUT (gitignored): theme-data.json, etc.
├── scripts/
│   ├── sync-tokens-to-figma.ts      # CSS → Figma Variables API (unidirectional)
│   └── color-utils.ts               # oklch → sRGB conversion (uses culori)
└── vitest.config.ts                 # Node env (no DOM)
```

## WHERE TO LOOK

| Task                     | Location                                             | Notes                              |
| ------------------------ | ---------------------------------------------------- | ---------------------------------- |
| Add generator            | `src/generators/` + register in `code.ts` GENERATORS | Also update drift-detection        |
| Centralized constants    | `src/generators/shared.ts`                           | ALL magic numbers must live here   |
| Tailwind → Figma parsing | `src/parsers/tailwind-to-figma.ts`                   | Scale lookups from theme-data.json |
| Drift detection          | `src/generators/drift-detection.test.ts`             | Meta-test enforcing sync           |

## CONVENTIONS

### Generator Pattern

1. **Import**: registry + `shared.ts` utilities + `parseTailwindClasses`
2. **Extract**: Component data from registry (NEVER hardcode)
3. **Testable exports**: Pure `get*Config()` functions (no Figma API)
4. **Generator entry**: `async generate*Components(page, startY) → nextY`

### Build Pipeline

```
pnpm build = sync:maybe → build:data (4 codegen steps) → build:plugin (esbuild → IIFE, ES2017)
```

### Testing Philosophy

- **Test structure, NOT values**: No specific colors, sizes, or variant names in assertions
- Drift detection enforces: every registry component has generator, no magic numbers

## ANTI-PATTERNS

| Pattern                                    | Why                     | Instead                            |
| ------------------------------------------ | ----------------------- | ---------------------------------- |
| Hardcoded `SECTION_PADDING`, `SECTION_GAP` | Drift detection fails   | Import from `shared.ts`            |
| Hardcoded RGB or opacity values            | Test enforcement        | Use `COLORS`/`OPACITY` from shared |
| Redeclaring constants from shared.ts       | Drift detection catches | Always import                      |

## NOTES

- **`generated/` is gitignored**: Run `pnpm build:data` after clone. Tests fail without it.
- **ES2017 target**: Figma runtime constraint. Avoid `??`, output is IIFE not ESM.
- **`code.js` lives in `src/`**: Not `dist/`. Figma reads `manifest.json` pointing to `code.js`.
