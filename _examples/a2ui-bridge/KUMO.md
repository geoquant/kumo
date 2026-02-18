# Kumo A2UI Adapter Integration

This document covers the `@a2ui-bridge/react-kumo` package: a design system adapter that renders A2UI protocol UIs using Cloudflare's `@cloudflare/kumo` component library.

## What Was Built

### Package: `packages/react-kumo/`

A new workspace package (`@a2ui-bridge/react-kumo`) containing ~42 adapter components that translate A2UI protocol nodes into Kumo React components. Follows the same direct-implementation pattern as `@a2ui-bridge/react-shadcn` (function components receiving `A2UIComponentProps<T>`).

**Component coverage:**

| Category           | Count | Components                                                                                                                            |
| ------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Layout             | 12    | Row, Column, Card, Divider, Separator, ScrollArea, AspectRatio, Flex, Grid, Center, Box, Container                                    |
| Typography/Display | 10    | Text, Badge, Label, Link, Image, Avatar, Skeleton, Title, Code, Blockquote                                                            |
| Form Inputs        | 13    | Button, Input, TextField, TextArea, Checkbox, Switch, Select, RadioGroup, Slider, ActionIcon, MultiSelect, NumberInput, DateTimeInput |
| Feedback           | 5     | Alert (->Banner), Progress (->Meter), Spinner (->Loader), Toast (->Toasty), Tooltip                                                   |
| Navigation         | 4     | Tabs, TabPanel, Breadcrumb, Pagination                                                                                                |
| Data Display       | 6     | List, Table, TableHeader, TableBody, TableRow, TableCell                                                                              |
| Disclosure/Overlay | 8     | Accordion, AccordionItem, Collapsible, Dialog, Sheet, Popover, DropdownMenu, HoverCard                                                |
| Fallback           | 1     | Fallback (for unknown types)                                                                                                          |

Plus ~20 aliases (HStack, VStack, Stack, Heading, H1-H6, IconButton, TextInput, Textarea, CheckBox, Toggle, Loader, Loading, Banner, Notification, Breadcrumbs, Modal, Drawer, Menu).

### Demo integration

The demo app (`apps/demo/`) now has a 3-way segmented toggle: **Mantine | ShadCN | Kumo**. Selecting "Kumo" swaps the `<Surface>` component mapping to use `kumoComponents`.

### Files changed in the demo

- `apps/demo/package.json` — Added `@a2ui-bridge/react-kumo` (workspace) and `@cloudflare/kumo` (link) deps; upgraded to Tailwind v4 + `@tailwindcss/vite`
- `apps/demo/src/kumo-styles.css` — **NEW**: Separate CSS entry point for Kumo's `@theme` tokens (required due to Tailwind v4 `@theme` merging behavior)
- `apps/demo/src/index.css` — Migrated from `@tailwind` directives to `@import "tailwindcss"` + ShadCN `@theme` + app styles (Kumo import moved to `kumo-styles.css`)
- `apps/demo/vite.config.ts` — Added `@tailwindcss/vite` plugin
- `apps/demo/src/main.tsx` — Imports `kumo-styles.css` before `index.css`; removed `?raw` CSS injection workaround
- `apps/demo/src/components/Demo.tsx` — Import, state type, toggle button, Surface prop
- Removed: `apps/demo/tailwind.config.js`, `apps/demo/postcss.config.js` (config now in CSS)

## Technical Decisions

### CSS loading strategy

The demo app uses Tailwind v4 (`@tailwindcss/vite`) so that both the demo and Kumo share the same CSS framework version. This eliminates the ring-color and layer-ordering conflicts that occurred when v3 and v4 CSS coexisted.

**Critical: Two separate CSS entry points.** Kumo's `@theme` blocks use `light-dark()` for semantic tokens (e.g. `--color-kumo-line`, `--color-kumo-base`). In Tailwind v4, when a CSS file has its own `@theme` block AND `@import`s another file that also has `@theme` blocks, `@tailwindcss/vite` silently drops the imported `@theme` tokens. To work around this, Kumo styles are isolated in their own CSS entry point:

```
src/kumo-styles.css    — @import "@cloudflare/kumo/styles" + @import "tailwindcss"
src/index.css          — @import "tailwindcss" + ShadCN @theme tokens + app styles
```

Both files are imported in `main.tsx`:

```tsx
import "./kumo-styles.css"; // Kumo's @theme with light-dark() tokens
import "./index.css"; // ShadCN @theme + app-specific styles
```

This pattern ensures:

- All Kumo semantic tokens (`--color-kumo-line`, `--color-kumo-ring`, etc.) resolve correctly
- ShadCN tokens (`--color-border`, `--color-primary`, etc.) resolve correctly
- Both `.dark` class (ShadCN) and `[data-mode="dark"]` (Kumo) work for dark mode
- Tailwind utility classes from both Kumo and ShadCN source are generated via `@source` directives

### React types version mismatch

Kumo uses React 19 types (`@types/react@^19`). The demo app and other adapter packages use React 18. The react-kumo package pins `@types/react@^19` in its own devDependencies so tsc can resolve Kumo's ForwardRefExoticComponent types without `bigint is not assignable to ReactNode` errors.

### Dependency linking

`@cloudflare/kumo` lives outside the a2ui-bridge pnpm workspace, so `workspace:` protocol doesn't work. Both `packages/react-kumo/package.json` and `apps/demo/package.json` use `link:` protocol with relative paths (`link:../../../../packages/kumo`) to resolve to the monorepo's kumo package.

## What Each Adapter Component Does

Every adapter file follows the same pattern:

1. Receives `{ node, onAction, components, surfaceId, children }` via `A2UIComponentProps<T>`
2. Extracts properties from `node.properties` using `literalString`/`literalNumber`/`literalBoolean` unwrapping
3. Maps A2UI variant names to Kumo variant names (e.g., A2UI `"filled"` -> Kumo `"primary"`)
4. Renders the corresponding `@cloudflare/kumo` component with mapped props
5. Wires `onAction` callbacks for interactive components (buttons, inputs, selects, etc.)

This is almost entirely mechanical. Each adapter is ~30-70 lines of boilerplate prop extraction and variant mapping.

---

## Opportunities for Automation

The adapter package was written manually, but most of the work is mechanical and could be generated. Here's what Kumo already has that could feed into codegen, and what's missing.

### What Kumo already provides

**`ai/component-registry.json`** (5,000+ lines, 38 components) contains:

- Component names, categories, import paths
- Full prop schemas: types (`string`, `enum`, `ReactNode`, `boolean`), optional flags, defaults, allowed values
- Variant enums with value lists and descriptions
- Example JSX snippets
- Semantic token classes used by each component

**`src/catalog/types.ts`** defines:

- `UIElement<TType, TProps>` — a flat node with `type`, `props`, `children`, `action`, `visible`
- `UITree` — flat map of elements by key (same shape concept as A2UI's component tree)
- `DynamicValue<T>` — literal or `{ path: string }` data binding (analogous to A2UI's `literalString`/`path` pattern)
- `Action` — named actions with params, confirmation, success/error handlers

**`KUMO_{NAME}_VARIANTS` exports** in every component file provide machine-readable variant definitions.

### What could be generated

#### 1. Adapter components (high value, high feasibility)

Each adapter's logic is: extract A2UI properties -> map variants -> render Kumo component. The component registry already contains the exact prop names, types, and variant values. A codegen script could:

- Read `component-registry.json` for each component's props
- Read the A2UI core types (`@a2ui-bridge/core`) for the protocol's node shapes
- Generate a mapping of A2UI property extraction to Kumo prop assignment
- Produce one `.tsx` file per component

The variant mapping (A2UI `"filled"` -> Kumo `"primary"`) is the only part that requires some A2UI-protocol-specific knowledge. This could be driven by a small config file:

```json
{
  "Button": {
    "variantMap": {
      "filled": "primary",
      "default": "secondary",
      "subtle": "ghost",
      "outline": "outline",
      "danger": "destructive"
    }
  }
}
```

**Estimated coverage:** ~80% of adapters could be fully generated. Complex ones (Tabs, Accordion, Table) need manual child-rendering logic.

#### 2. Component mapping (`mapping.ts`)

The `kumoComponents` object and its aliases could be generated from the registry's component list plus a small alias config. Straightforward.

#### 3. Type-safe property extraction

The `extractLiteral` / `extractBoolean` / `extractNumber` utility functions are generic. The per-adapter property extraction (`node.properties.label?.literalString`) could be type-generated from A2UI's protocol types crossed with the registry's prop types.

### What can't easily be generated

- **Child rendering logic** — Container components (Card, Tabs, Accordion, List) need to understand A2UI's `child`/`children`/`childList`/`explicitList` references and call `renderChild()` appropriately. This varies per component.
- **Compound component composition** — Kumo's `Select.Option`, `Checkbox.Item`, `Tabs.Tab` patterns require understanding the parent-child relationship in A2UI's flat tree and rendering sub-components correctly.
- **State management** — Some adapters maintain local state (Select's `selectedValue`, Checkbox's `checked`) that feeds back into `onAction` callbacks. The shape of this depends on the Kumo component's API.
- **CSS entry point separation** — The two-file CSS strategy (`kumo-styles.css` + `index.css`) is required by a Tailwind v4 `@theme` merging limitation. This is environment-specific and may not be needed if Tailwind fixes `@theme` processing from `@import`ed files.

### Proposed codegen approach

A `codegen:a2ui-adapter` script in the kumo package could:

1. Read `ai/component-registry.json` for all component schemas
2. Read a small `a2ui-adapter.config.json` for variant mappings and aliases
3. For each component, generate an adapter `.tsx` file with:
   - Correct imports from `@cloudflare/kumo`
   - Property extraction from `node.properties`
   - Variant mapping
   - `onAction` wiring for interactive components
   - `renderChild()` calls for container components (using a heuristic: if props include `children: ReactNode`, it's a container)
4. Generate `mapping.ts` with all components + aliases
5. Generate `index.ts` barrel export

The variant mapping config and the "is this a container?" heuristic are the main pieces that need human input. Everything else is derivable from the registry.

### Broader integration value

This adapter pattern isn't specific to A2UI. The mechanical nature of the mapping (protocol node -> extract props -> map variants -> render component) is the same shape as any JSON-to-UI rendering protocol. If Kumo's catalog module already handles its own `UITree` -> React rendering, the A2UI adapter is essentially a thin translation layer between A2UI's property format and Kumo's catalog format. A future direction could be a single `@cloudflare/kumo/adapters/a2ui` export generated directly from the registry, shipped as part of the kumo package itself.
