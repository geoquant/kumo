# Kumo Localization — Implementation Spec

**Status:** Approved
**Effort:** XL (3-5 days)
**Date:** 2026-03-05

## Problem Statement

**Who:** Kumo consumers building products for non-English markets; screen reader users in non-English locales
**What:** ~60 hardcoded English strings across 13 component/block files. No mechanism to translate UI chrome (aria-labels, button text, status messages). No RTL support.
**Why it matters:** Compliance, accessibility, and consumer demand. Cloudflare products ship in 12+ languages — the component library should not be the bottleneck.
**Evidence:** Audit found strings in `sensitive-input` (9), `date-range-picker` (12), `pagination` (8), `delete-resource` (9), and 9 other files. Two components (`clipboard-text`, `code/ShikiProvider`) already have ad-hoc `labels` prop workarounds.

## Proposed Solution

Build a React-native localization system inspired by [CrowdStrike Glide Core](https://github.com/CrowdStrike/glide-core/blob/main/src/library/localize.ts) (which wraps `@shoelace-style/localize`) but adapted for React instead of Lit.

**Core architecture:**

- Typed translation registry with `registerTranslation()` — global, singleton
- `useLocalize()` React hook for component consumption
- Optional `<KumoLocaleProvider>` context — falls back to `<html lang>` via `useSyncExternalStore`
- English bundled as default; all 12 locale files eagerly registered (same as Glide Core)
- `DirectionProvider` context (Base UI pattern) for JS-level RTL logic
- Migrate 23 component files from physical to logical CSS for RTL support

**Target locales (12):** `en`, `de`, `es`, `fr`, `it`, `pt`, `ko`, `ja`, `zh-CN`, `zh-TW`, `ar`, `he`

## Scope & Deliverables

| #   | Deliverable                                                     | Effort | Depends On |
| --- | --------------------------------------------------------------- | ------ | ---------- |
| D1  | Localize core module (`src/localize/`)                          | M      | -          |
| D2  | English translation file (source of truth)                      | S      | D1         |
| D3  | Migrate all 13 files to use `useLocalize()`                     | L      | D1, D2     |
| D4  | 11 non-English translation files (AI-generated, human-reviewed) | M      | D2         |
| D5  | `DirectionProvider` context + `useDirection()` hook             | S      | -          |
| D6  | RTL CSS migration (physical → logical properties)               | L      | D5         |
| D7  | Tests                                                           | M      | D1, D3, D5 |
| D8  | Docs site i18n guide page (`kumo-docs-astro`)                   | M      | D1, D5     |

## Non-Goals (Explicit Exclusions)

- **ICU MessageFormat** — overkill for ~60 strings. Parameterized strings use JS functions (Glide Core pattern).
- **Lazy loading of translations** — 60 strings x 12 locales ≈ 8-12KB uncompressed, ~3-4KB gzipped. Not worth the complexity.
- **Translation management platform integration** — no Crowdin/Phrase/etc. JSON + TS files in-repo.
- **Consumer-facing translation override API** — consumers set `<html lang>`, system responds. No per-term override API (unlike MUI's theme merge). Existing `labels` props remain as escape hatches on components that have them.
- **Layout mirroring testing infrastructure** — RTL CSS migration is mechanical (class swaps). Visual regression testing for RTL is out of scope for this spec.
- **Removing existing `labels` props** — `clipboard-text` and `code/ShikiProvider` keep their `labels` props. No breaking changes.
- **Translating brand names** — "Cloudflare" stays as "Cloudflare" in all locales. Only the surrounding word (e.g. "logo") is translated. e.g. `cloudflareLogo` → `"Cloudflare-Logo"` (de), `"Cloudflare ロゴ"` (ja).
- **Versioning/publishing** — no `pnpm version`, `pnpm release`, `pnpm publish:beta`, or `pnpm release:production`.

## Data Model

### Translation Interface

```typescript
// src/localize/types.ts

export interface KumoTranslation {
  /** BCP 47 language tag */
  $code: string;
  /** Human-readable name, e.g. "English", "Deutsch" */
  $name: string;
  /** Text direction */
  $dir: "ltr" | "rtl";

  // ── Shared UI chrome ──────────────────────────────
  close: string;
  copy: string;
  copied: string;
  copyToClipboard: string;
  copiedToClipboard: string;
  loading: string;
  noResultsFound: string;
  optional: string;
  moreInformation: string;

  // ── Pagination ────────────────────────────────────
  firstPage: string;
  previousPage: string;
  nextPage: string;
  lastPage: string;
  pageNumber: string;
  pageSize: string;
  /** e.g. "Per page:" */
  perPage: string;
  /** e.g. (start, end, total) => "Showing 1-10 of 100" */
  showingRange: (start: number, end: number, total: number) => string;

  // ── Sensitive Input ───────────────────────────────
  sensitiveValue: string;
  clickToReveal: string;
  hideValue: string;
  revealValue: string;
  valueMasked: string;
  valueHidden: string;
  clickOrPressEnterToReveal: string;

  // ── Date Range Picker ─────────────────────────────
  previousMonth: string;
  nextMonth: string;
  editMonthAndYear: string;
  resetDates: string;
  /** e.g. (tz) => "Timezone: America/New_York" */
  timezone: (tz: string) => string;
  /** e.g. (dateStr) => "Jan 1, 2026, selected as start date" */
  selectedAsStartDate: (dateStr: string) => string;
  selectedAsEndDate: (dateStr: string) => string;
  withinSelectedRange: (dateStr: string) => string;
  // NOTE: Day abbreviations (Su/Mo/Tu...) derived from Intl.DateTimeFormat
  // using resolved locale — NOT stored in translation files.

  // ── Table ─────────────────────────────────────────
  resizeColumn: string;

  // ── Breadcrumbs ───────────────────────────────────
  clickToCopy: string;

  // ── Empty ─────────────────────────────────────────
  copyCommand: string;

  // ── Label ─────────────────────────────────────────
  // `optional` and `moreInformation` listed under Shared

  // ── Cloudflare Logo ───────────────────────────────
  /** "Cloudflare" stays untranslated; only "logo" is localized.
   *  e.g. en: "Cloudflare logo", de: "Cloudflare-Logo", ja: "Cloudflare ロゴ" */
  cloudflareLogo: string;

  // ── Delete Resource (block) ───────────────────────
  deleteResource: (resourceName: string) => string;
  deleteActionCannotBeUndone: (resourceType: string) => string;
  typeToConfirm: (resourceName: string) => string;
  confirmDeletionAriaLabel: (resourceName: string) => string;
  copyResourceNameToClipboard: (resourceName: string) => string;
  cancel: string;
  deleteResourceType: (resourceType: string) => string;
}
```

### Incomplete Translation Pattern (from Glide Core)

```typescript
// src/translations/fr.ts
export const PENDING_STRINGS = ["confirmDeletionAriaLabel"] as const;
type PendingString = (typeof PENDING_STRINGS)[number];

const translation: Omit<KumoTranslation, PendingString> = {
  $code: "fr",
  $name: "Francais",
  $dir: "ltr",
  close: "Fermer",
  // ... omit pending strings, they fall back to English
};

export default translation as KumoTranslation;
```

## API / Interface Contract

### Core Module — `src/localize/index.ts`

```typescript
// ── Registration (global, called at module load) ────
export function registerTranslation(...translations: KumoTranslation[]): void;

// ── React Hook ──────────────────────────────────────
export function useLocalize(): {
  /** Resolve a translation term by key */
  term: <K extends keyof KumoTranslation>(
    key: K,
    ...args: KumoTranslation[K] extends (...a: infer P) => string ? P : []
  ) => string;
  /** Format a date using Intl.DateTimeFormat with resolved locale */
  date: (date: Date, options?: Intl.DateTimeFormatOptions) => string;
  /** Format a number using Intl.NumberFormat with resolved locale */
  number: (value: number, options?: Intl.NumberFormatOptions) => string;
  /** Current resolved language code */
  lang: () => string;
  /** Current resolved text direction */
  dir: () => "ltr" | "rtl";
};

// ── Optional Locale Provider ────────────────────────
export function KumoLocaleProvider(props: {
  /** Override locale (bypasses <html lang> detection) */
  locale?: string;
  children: React.ReactNode;
}): React.JSX.Element;

// ── Direction Provider (Base UI pattern) ────────────
export function DirectionProvider(props: {
  /** Text direction. Must match the `dir` attribute on the nearest DOM ancestor. */
  direction: "ltr" | "rtl";
  children: React.ReactNode;
}): React.JSX.Element;

export function useDirection(): "ltr" | "rtl";
```

### Locale Resolution Order

1. `KumoLocaleProvider` `locale` prop (if provider present)
2. `document.documentElement.lang` (via `useSyncExternalStore` + `MutationObserver`)
3. `navigator.language`
4. `'en'` (hardcoded fallback)

### Translation Resolution Order

1. Exact match: `zh-CN` → registered `zh-CN` translation
2. Language prefix: `es-PE` → registered `es` translation
3. Fallback: first registered translation (English)

### Reactivity Model

- `useSyncExternalStore` subscribes to `<html lang>` changes via `MutationObserver`
- When `<html lang>` changes → all components using `useLocalize()` re-render
- `KumoLocaleProvider` context change → standard React context re-render
- **No module-level side effects until first `useLocalize()` call** — `MutationObserver` created lazily

### DirectionProvider (Base UI Pattern)

Follows the [Base UI DirectionProvider](https://base-ui.com/react/utils/direction-provider) pattern. CSS layout direction is handled by the HTML `dir` attribute + logical CSS properties. JS-level direction logic (keyboard navigation, positioning, coordinate math) is handled by React context.

**Both must be set together for RTL:**

```tsx
// ��� Correct — both DOM dir + context
<div dir="rtl">
  <DirectionProvider direction="rtl">
    <App />
  </DirectionProvider>
</div>

// ❌ CSS works but component JS logic (keyboard nav, positioning) breaks
<div dir="rtl">
  <App />
</div>
```

**`useDirection()` hook** — components that need JS-level direction awareness:

```tsx
function MyComponent() {
  const direction = useDirection(); // 'ltr' | 'rtl'
  // Use for coordinate math, keyboard nav, etc.
}
```

**Default:** `'ltr'` when no `DirectionProvider` is present.

**Relationship to `useLocalize().dir()`:** The `useLocalize()` hook's `dir()` method reads `$dir` from the resolved translation. `useDirection()` reads from React context. They serve different purposes — `useLocalize().dir()` tells you what direction the locale expects, `useDirection()` tells you what direction is currently active in the component tree. Consumers should set `DirectionProvider direction` based on locale, but the two systems are decoupled by design.

### Consumer Usage

```tsx
// LTR locale — just set <html lang>. All Kumo components respond.
<html lang="es">
  <body>
    <Pagination ... />  {/* Shows "Mostrando 1-10 de 100" */}
    <Toast ... />        {/* Close button says "Cerrar" */}
  </body>
</html>

// RTL locale — must set both dir + DirectionProvider
import { KumoLocaleProvider, DirectionProvider } from '@cloudflare/kumo';

<html lang="ar" dir="rtl">
  <body>
    <DirectionProvider direction="rtl">
      <Pagination ... />  {/* Arabic, right-to-left */}
    </DirectionProvider>
  </body>
</html>

// Explicit locale override via provider
<KumoLocaleProvider locale="ja">
  <Pagination ... />  {/* Japanese */}
</KumoLocaleProvider>

// Register a custom locale not shipped by Kumo
import { registerTranslation } from '@cloudflare/kumo';

registerTranslation({
  $code: 'th',
  $name: 'Thai',
  $dir: 'ltr',
  close: 'ปิด',
  // ...
});
```

### Interaction with Existing `labels` Props

```
Component render:
  1. If labels prop provided → use prop value (consumer's responsibility to translate)
  2. Else → useLocalize().term('key') (localize system provides translated default)
```

Example in `clipboard-text`:

```tsx
const t = useLocalize();
const resolvedCopyAction = labels?.copyAction ?? t.term("copyToClipboard");
```

### Exports from `@cloudflare/kumo`

```typescript
// New exports added to package index
export {
  useLocalize,
  KumoLocaleProvider,
  registerTranslation,
  DirectionProvider,
  useDirection,
} from "./localize";
export type { KumoTranslation } from "./localize/types";
```

## File Structure

```
src/localize/
  index.ts           # registerTranslation, useLocalize, KumoLocaleProvider, DirectionProvider, useDirection
  types.ts           # KumoTranslation interface
  registry.ts        # Translation map, resolution logic
  use-locale.ts      # useSyncExternalStore hook for <html lang>
  direction.ts       # DirectionProvider context + useDirection hook

src/translations/
  en.ts              # English (fallback, source of truth)
  en.json            # English in ICU format (for tooling)
  de.ts / de.json
  es.ts / es.json
  fr.ts / fr.json
  it.ts / it.json
  pt.ts / pt.json
  ko.ts / ko.json
  ja.ts / ja.json
  zh-CN.ts / zh-CN.json
  zh-TW.ts / zh-TW.json
  ar.ts / ar.json
  he.ts / he.json
  index.ts           # Eager import + registerTranslation() for all locales
```

## RTL CSS Migration

### Strategy

Replace physical Tailwind utilities with logical equivalents. Tailwind v4 ships these out of the box — no config changes needed.

| Physical                             | Logical                                        | Count |
| ------------------------------------ | ---------------------------------------------- | ----- |
| `ml-*` / `mr-*`                      | `ms-*` / `me-*`                                | ~15   |
| `pl-*` / `pr-*`                      | `ps-*` / `pe-*`                                | ~20   |
| `left-*` / `right-*`                 | `start-*` / `end-*`                            | ~25   |
| `rounded-l-*` / `rounded-r-*`        | `rounded-s-*` / `rounded-e-*`                  | ~7    |
| `rounded-tl-*` / `rounded-bl-*` etc. | `rounded-ss-*` / `rounded-es-*` etc.           | ~5    |
| `text-left` / `text-right`           | `text-start` / `text-end`                      | ~3    |
| `border-l` / `border-r`              | `border-s` / `border-e`                        | ~2    |
| `slide-in-from-left/right`           | Conditional on `dir`                           | ~2    |
| `bg-linear-to-r`                     | `bg-linear-to-e` (if available) or conditional | ~1    |
| CSS `padding-left/right`             | `padding-inline-start/end`                     | ~2    |
| CSS `left/right`                     | `inset-inline-start/end`                       | ~2    |

**~83 class changes across 23 files.** Most are mechanical substitutions.

### Exceptions (no change needed)

- `left-1/2 -translate-x-1/2` — viewport centering, direction-neutral
- Grid column classes (`col-start-1`) — not directional
- `ml-auto` → `ms-auto` (same pattern, just swap)

### High-complexity components

- **`combobox`** — 16+ directional classes with size-variant maps. Needs careful refactoring of icon positioning.
- **`sensitive-input`** — 14+ directional classes with similar size-variant patterns.

### `date-range-picker` — Already partially RTL-ready

The RDP calendar styles in `kumo.css` already use logical properties and `[dir="rtl"]` selectors. The component wrapper classes need migration but the calendar internals are handled.

## Documentation (D8)

### Location & Format

New top-level page in the docs site, following the same pattern as `colors.astro` and `accessibility.astro`:

```
packages/kumo-docs-astro/src/pages/i18n.astro
```

Uses `DocLayout` → `ComponentSection` blocks with `CodeBlock`, `Callout`, and `Heading` doc components. No MDX — `.astro` file only.

### Sidebar Navigation

Add entry to `staticPages` array in `packages/kumo-docs-astro/src/components/SidebarNav.tsx`, after "Accessibility":

```typescript
{ label: "Internationalization", href: "/i18n" },
```

### Page Outline

1. **Overview** — What Kumo i18n covers: 12 supported locales, automatic translation of UI chrome, RTL support. Callout: "User-facing content (button labels, headings, body text) is your responsibility. Kumo only translates internal UI chrome (close buttons, pagination labels, aria text)."

2. **Supported Locales** — Table of 12 locales with `$code`, `$name`, `$dir`. Callout: which are LTR vs RTL.

3. **Quick Start** — Minimal setup:
   - LTR: just set `<html lang="es">`, done
   - RTL: set `<html lang="ar" dir="rtl">` + wrap with `<DirectionProvider direction="rtl">`
   - Code examples for both

4. **Locale Resolution** — How the system determines the active locale (provider → `<html lang>` → `navigator.language` → `en`). Diagram or ordered list.

5. **Translation Resolution** — Fallback chain: exact match → language prefix → English default. Code example showing `es-PE` falling back to `es`.

6. **RTL Support** —
   - Explain the two-layer model: CSS (`dir` attribute + logical properties) vs JS (`DirectionProvider` + `useDirection()`)
   - Why both are needed
   - Code example of full RTL setup
   - Callout: "`dir` attribute handles CSS layout. `DirectionProvider` handles JS logic (keyboard nav, positioning). You need both."

7. **Custom Locales** — How to register a locale not shipped by Kumo via `registerTranslation()`. Full code example with type.

8. **API Reference** — Brief reference for:
   - `useLocalize()` — `term()`, `date()`, `number()`, `lang()`, `dir()`
   - `KumoLocaleProvider` — props
   - `DirectionProvider` — props
   - `useDirection()` — return type
   - `registerTranslation()` — signature
   - `KumoTranslation` — type (link to source or inline)

9. **Interaction with `labels` Props** — Explain that some components (`ClipboardText`, `CodeHighlighted`) accept `labels` props. If provided, the prop wins. If omitted, the localize system provides the translated default. Callout: "If you pass a `labels` prop, you are responsible for translating it yourself."

10. **SSR Considerations** — Server snapshot returns `'en'` as default. Document how to set locale on the server if using SSR frameworks.

### No Demo Component

This is a prose guide page (like `accessibility.astro`), not a component page. No `ComponentExample` or `PropsTable` needed. Code examples use `CodeBlock` with `lang="tsx"`.

## Acceptance Criteria

- [ ] `useLocalize()` returns correct term for `<html lang>` value
- [ ] Changing `<html lang>` at runtime re-renders all components using `useLocalize()`
- [ ] `KumoLocaleProvider` overrides `<html lang>` for its subtree
- [ ] Fallback chain works: `zh-CN` → `zh` → `en`
- [ ] All 12 translation files compile and pass type checking
- [ ] Zero hardcoded English strings remain in component runtime code (all go through `useLocalize()` or existing `labels` props)
- [ ] Existing `labels` props on `clipboard-text` and `code/ShikiProvider` continue to work — no breaking change
- [ ] `registerTranslation()` allows consumers to add custom locales
- [ ] `date-range-picker` uses `Intl.DateTimeFormat` with resolved locale (not hardcoded `"en-US"`)
- [ ] `date-range-picker` day abbreviations derived from `Intl.DateTimeFormat` with resolved locale (not hardcoded `["Su","Mo"...]` array)
- [ ] `DirectionProvider` propagates direction via React context
- [ ] `useDirection()` returns `'ltr'` when no provider is present
- [ ] `useDirection()` returns correct direction when wrapped in `DirectionProvider`
- [ ] All physical Tailwind utilities replaced with logical equivalents across 23 files
- [ ] `switch.tsx` existing `rtl:` usage still works
- [ ] Calendar `[dir="rtl"]` styles still work
- [ ] `pnpm lint` passes (no regressions)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm --filter @cloudflare/kumo test` passes
- [ ] Bundle size increase < 15KB uncompressed for all 12 locales
- [ ] Docs page at `/i18n` renders with `DocLayout`, includes all 10 outline sections
- [ ] `/i18n` appears in sidebar navigation (after "Accessibility")
- [ ] All code examples in docs page use `CodeBlock` component with correct `lang` prop
- [ ] `pnpm dev` serves the i18n page without errors

## Test Strategy

| Layer       | What                                                     | How                                                                                 |
| ----------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Unit        | `registry.ts` — registration, resolution, fallback chain | Vitest, pure function tests                                                         |
| Unit        | `use-locale.ts` — `useSyncExternalStore` subscription    | Vitest + happy-dom, mutate `<html lang>`                                            |
| Unit        | `useLocalize()` — term lookup, date/number formatting    | Vitest, mock registry                                                               |
| Integration | Components render correct text per locale                | Vitest, render component, assert text content with different `<html lang>`          |
| Integration | `KumoLocaleProvider` overrides locale for subtree        | Vitest, nested providers                                                            |
| Integration | `labels` prop overrides localized default                | Vitest, render `clipboard-text` with/without `labels`                               |
| Unit        | `direction.ts` — `DirectionProvider` + `useDirection()`  | Vitest, render with/without provider, assert hook return value                      |
| Integration | RTL direction propagation to components                  | Vitest, wrap component in `DirectionProvider direction="rtl"`, assert behavior      |
| Snapshot    | Translation files — all keys present                     | Vitest, iterate `KumoTranslation` keys, assert each locale has all non-pending keys |
| Smoke       | Docs i18n page builds                                    | `pnpm dev` — verify `/i18n` loads without errors                                    |

## Risks & Mitigations

| Risk                                                                  | Likelihood | Impact | Mitigation                                                                                                           |
| --------------------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| Translation quality (AI-generated)                                    | High       | Medium | Mark all as PENDING, require human review before shipping. Ship English-only initially if review is slow.            |
| RTL CSS migration breaks existing LTR layouts                         | Medium     | High   | Run full test suite after each component migration. Visual review of complex components (combobox, sensitive-input). |
| `MutationObserver` on `<html>` conflicts with consumer's own observer | Low        | Low    | Observer only watches `lang` attribute; unlikely to conflict.                                                        |
| Bundle size larger than expected                                      | Low        | Medium | 60 strings x 12 locales. Measure after D4. If > 15KB uncompressed, consider lazy loading.                            |
| `useSyncExternalStore` SSR behavior                                   | Medium     | Medium | Provide server snapshot returning `'en'` as default. Document SSR behavior.                                          |
| Consumers rely on exact English strings in tests (snapshot tests)     | Medium     | Medium | This is a breaking change for consumers who snapshot-test Kumo component output. Document in changelog.              |

## Trade-offs Made

| Chose                                    | Over                                     | Because                                                                                                                         |
| ---------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Eager bundling of all 12 locales         | Lazy loading per-locale                  | ~3-4KB gzipped is acceptable. Lazy loading adds complexity and DX friction. Glide Core validates this approach.                 |
| Custom ~100-line module                  | `@shoelace-style/localize` dependency    | Shoelace lib is Lit-coupled (ReactiveController). Adapting it is more code than writing a React-native solution. Zero new deps. |
| `useSyncExternalStore` for `<html lang>` | `MutationObserver` + `useState`          | Concurrent-mode safe, SSR-compatible with server snapshot. React 18+ standard.                                                  |
| Keep existing `labels` props             | Remove or deprecate                      | Non-breaking. Consumers may depend on them. Labels prop = escape hatch for edge cases.                                          |
| JS functions for parameterized strings   | ICU MessageFormat                        | No build tooling needed. Type-safe via function signatures. 60 strings don't justify ICU parser overhead.                       |
| `registerTranslation()` global API       | Context-only translations                | Allows registration before React tree mounts. Consumers can register custom locales from anywhere.                              |
| Logical CSS properties for RTL           | `rtl:` variant conditionals              | Logical properties are the web standard. Work automatically with `dir` attribute. Less code than conditional `rtl:` prefixes.   |
| `Intl.DateTimeFormat` for day names      | Hardcoded arrays in translation files    | Automatically correct for all locales. No manual maintenance of 12x7=84 strings. Browser-native.                                |
| Separate `DirectionProvider` context     | Reading `$dir` from resolved translation | Follows Base UI pattern. Decouples direction from locale. Consumer controls when/where RTL is active.                           |
| Single minor changeset                   | Split into multiple changesets           | All changes are part of one feature. Simpler to review and release as a unit.                                                   |
| Timezone default kept as-is              | Remove or make required prop             | Not a localization concern — it's a prop default. Non-breaking.                                                                 |

## Resolved Questions

- [x] **Day abbreviations source** — Use `Intl.DateTimeFormat` with resolved locale. No hardcoded arrays.
- [x] **`date-range-picker` timezone default** — Keep as-is. It's a prop default, not a localization concern.
- [x] **Changeset scope** — Single minor changeset for the entire feature.
- [x] **Translation review process** — AI generates initial strings; internal localization team reviews before merge.
- [x] **Brand names** — "Cloudflare" stays untranslated in all locales. Only surrounding words are localized (e.g. "logo" → "ロゴ").

## Open Questions

None — all resolved.

## Success Metrics

- Zero hardcoded English strings in `src/components/` and `src/blocks/` runtime code
- `<html lang="ar">` renders all Kumo components in Arabic with RTL layout
- Bundle size increase < 15KB uncompressed (~4KB gzipped) for full localization system + 12 locales
- No breaking changes to existing public API
