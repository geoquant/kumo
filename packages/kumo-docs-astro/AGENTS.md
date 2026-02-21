# Docs Site (`@cloudflare/kumo-docs-astro`)

Astro documentation site for Kumo. React islands architecture. Deployed to Cloudflare Workers at `kumo-ui.com`.

**Parent:** See [root AGENTS.md](../../AGENTS.md) for monorepo context.

## STRUCTURE

```
kumo-docs-astro/
├── src/
│   ├── pages/
│   │   ├── index.astro              # Homepage (HomeGrid showcase)
│   │   ├── components/{name}.astro  # 37 component doc pages
│   │   ├── blocks/{name}.astro      # 3 block doc pages
│   │   └── api/                     # JSON endpoints (version, component-registry)
│   ├── components/
│   │   ├── demos/                   # 44 *Demo.tsx files + 2 non-demo (feed into registry codegen!)
│   │   └── docs/                    # Doc components (PropsTable, CodeBlock, etc.)
│   ├── layouts/                     # BaseLayout → MainLayout → DocLayout
│   └── lib/                         # Vite plugins (virtual:kumo-colors, virtual:kumo-registry)
├── scripts/
│   └── extract-demo-examples.ts     # Parses demos → dist/demo-metadata.json
└── astro.config.mjs                 # React + Tailwind + 2 custom Vite plugins
```

## WHERE TO LOOK

| Task               | Location                                        | Notes                              |
| ------------------ | ----------------------------------------------- | ---------------------------------- |
| Component doc page | `src/pages/components/{name}.astro`             | Uses DocLayout + ComponentExample  |
| Demo examples      | `src/components/demos/{Name}Demo.tsx`           | Naming is load-bearing (see below) |
| Props table        | `src/components/docs/PropsTable.astro`          | Server-rendered from registry      |
| Layout/nav         | `src/layouts/`, `src/components/SidebarNav.tsx` | Nav items are hard-coded           |

## CONVENTIONS

### Demo File Naming (CRITICAL)

- **File**: `{Component}Demo.tsx` (e.g., `ButtonDemo.tsx`)
- **Exports**: Functions ending in `Demo` suffix
- **JSDoc** on demos becomes `description` field in metadata
- Wrong naming = not extracted = missing from component registry.

### Hydration Directives

| Directive             | When                                         |
| --------------------- | -------------------------------------------- |
| `client:visible`      | Most component demos (lazy)                  |
| `client:load`         | Interactive: Dialog, Search, Toast, Registry |
| `client:only="react"` | SSR mismatch: ThemeToggle, HomeGrid          |

### Two Registry Access Patterns

- **Server-side** (`.astro`): Import from `~/lib/component-registry.ts`
- **Client-side** (React): Use `virtual:kumo-registry` Vite module. Do NOT mix.

## ANTI-PATTERNS

| Pattern                             | Why                             | Instead                                  |
| ----------------------------------- | ------------------------------- | ---------------------------------------- |
| Demo function without `Demo` suffix | Won't be extracted for registry | Always suffix with `Demo`                |
| Forgetting `@source` in global.css  | Tailwind misses kumo classes    | Keep `@source "../../../kumo/dist/**/*"` |

## NOTES

- **Build order**: `codegen:demos` → `dist/demo-metadata.json` consumed by kumo registry codegen
- **SidebarNav is manual**: Adding a component page requires updating `SidebarNav.tsx` arrays
- **BaseLayout has blocking inline script**: Reads `localStorage.theme` synchronously to prevent FOUC
