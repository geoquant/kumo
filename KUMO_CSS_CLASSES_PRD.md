# PRD: Generated Kumo CSS Component Classes

## Summary

Create a generated, CSS-only component styling layer for Kumo so teams can build "Kumo-looking" experiences in server-rendered HTML, vanilla JavaScript, or other non-React environments without depending on Tailwind in their application.

The generated CSS must not drift from the React component library. Kumo's React/Tailwind component source remains the styling source of truth. Every eligible component must expose a machine-readable CSS contract from its main component file, and CI/linting must enforce that the contract exists and follows the project convention.

This work is complete only when all eligible Kumo components have contracts, generated CSS is shipped from `@cloudflare/kumo`, and docs explain how to use the classes safely.

## Goals

- Generate browser-ready CSS component classes from Kumo component styling metadata.
- Allow non-React consumers to use Kumo visual styles with plain HTML.
- Keep React/Tailwind component code as the source of truth.
- Prevent drift through lint rules, tests, generated output checks, and documentation.
- Document a `/css` guide in the Kumo docs site with examples, support matrix, and a kitchen sink.
- Ship generated CSS through `@cloudflare/kumo` exports.

## Non-goals

- Do not reimplement React components in CSS.
- Do not provide JavaScript behavior, focus management, popover positioning, portals, keyboard interaction, or ARIA state machines.
- Do not require consumers to install Tailwind.
- Do not write a custom Tailwind class-to-CSS compiler.
- Do not expand CSS support to deprecated components.
- Do not include charts, flow diagrams, CloudflareLogo, or blocks as generated component-class targets.

## Target consumers

- Cloudflare teams with server-rendered HTML and vanilla JavaScript.
- Internal apps that want Kumo visual parity but cannot adopt React components.
- Teams that can own semantic markup and behavior but need standardized Kumo styling.

## Product positioning

Kumo CSS is a generated visual styling layer. It gives plain markup Kumo component appearance for documented structure, variants, parts, and states.

Kumo CSS does not make plain markup accessible or interactive by itself. Consumers remain responsible for:

- semantic HTML;
- ARIA attributes;
- keyboard interaction;
- focus management;
- disclosure/open state;
- validation state;
- JavaScript behavior;
- positioning for floating UI.

## Example API

React source of truth:

```tsx
<Badge variant="success">Healthy</Badge>
```

CSS-only equivalent:

```html
<span class="kumo-c-badge kumo-c-badge--variant-success">Healthy</span>
```

Button example:

```html
<button class="kumo-c-button kumo-c-button--variant-primary kumo-c-button--size-sm">
  Deploy
</button>
```

Component part example:

```html
<div class="kumo-c-input-group">
  <span class="kumo-c-input-group__addon">https://</span>
  <input class="kumo-c-input-group__input" />
  <button class="kumo-c-input-group__button">Copy</button>
</div>
```

## Naming convention

Use Kumo-prefixed component classes:

```css
.kumo-c-button
.kumo-c-button--variant-primary
.kumo-c-button--size-sm
.kumo-c-button--shape-square
.kumo-c-button__icon
.kumo-c-button__content
```

Rules:

- `kumo-c-` identifies generated Kumo component classes.
- Root component class: `.kumo-c-{component}`.
- Variant modifier: `.kumo-c-{component}--{axis}-{value}`.
- Part/slot class: `.kumo-c-{component}__{part}`.
- Prefer native, ARIA, and data states over visual state modifier classes.

Examples:

```html
<button class="kumo-c-button" disabled>Disabled</button>
<button class="kumo-c-tabs__trigger" aria-selected="true">Tab</button>
<div class="kumo-c-dropdown__popup" data-state="open">...</div>
```

## Component eligibility

The PR is complete only when every eligible component under:

```txt
packages/kumo/src/components/{name}/{name}.tsx
```

exports a valid CSS contract.

### Exclusions

The lint rule and generator should exclude:

- `chart`
- `flow`
- `cloudflare-logo`
- deprecated components, currently `date-range-picker`

Blocks are out of scope because they live under `packages/kumo/src/blocks` and are installable compositions rather than core component exports.

## CSS contract standard

Each eligible component must export a contract from its main component file:

```ts
export const KUMO_BADGE_CSS_CONTRACT = defineCssContract({
  component: "badge",
  baseClass: "kumo-c-badge",
  baseStyles: KUMO_BADGE_BASE_STYLES,
  variants: KUMO_BADGE_VARIANTS,
  defaults: KUMO_BADGE_DEFAULT_VARIANTS,
});
```

Contracts live in the component file, not separate `*.css-contract.ts` files. This matches the existing Kumo convention where variant constants live beside the React component and lets lint enforce the standard for newly added components.

### Required contract capabilities

The contract system must be expressive enough for all eligible components, including complex Base UI-based components.

At minimum, contracts must support:

- component name;
- root class name;
- base Tailwind classes;
- variant axes;
- default variants;
- compound/derived variants where needed;
- parts/slots;
- state selectors;
- ARIA selectors;
- data attribute selectors;
- pseudo-class selectors;
- child/nested selectors;
- arbitrary Tailwind values;
- explicit CSS escape hatches for cases Tailwind `@apply` cannot represent cleanly;
- docs/example metadata where needed.

Representative shape:

```ts
defineCssContract({
  component: "button",
  baseClass: "kumo-c-button",
  baseStyles: KUMO_BUTTON_BASE_STYLES,
  variants: KUMO_BUTTON_VARIANTS,
  defaults: KUMO_BUTTON_DEFAULT_VARIANTS,
  parts: {
    icon: {
      className: "kumo-c-button__icon",
      styles: "size-4 shrink-0",
    },
    content: {
      className: "kumo-c-button__content",
      styles: "relative flex items-center gap-1.5",
    },
  },
  states: {
    disabled: {
      selector: "&:disabled, &[aria-disabled='true'], &[data-disabled]",
      styles: "cursor-not-allowed opacity-50",
    },
    open: {
      selector: '&[data-state="open"]',
      styles: "bg-kumo-base",
    },
  },
  selectors: [
    {
      selector: ".kumo-c-button svg",
      styles: "shrink-0",
    },
  ],
  extraCss: `
    .kumo-c-button--variant-primary {
      --kumo-button-emphasis-token: var(--color-kumo-brand);
    }
  `,
});
```

## Tailwind compilation strategy

Use Tailwind CLI during Kumo's package build. Do not create a custom Tailwind translator.

The generator should:

1. discover `KUMO_*_CSS_CONTRACT` exports from component files;
2. generate an intermediate CSS source using Kumo class names and Tailwind `@apply` where possible;
3. compile that source with Tailwind CLI into browser-ready CSS;
4. ship compiled CSS from `@cloudflare/kumo`.

Example generated intermediate CSS:

```css
@import "tailwindcss";
@import "./kumo-binding.css";

@layer components {
  .kumo-c-badge {
    @apply inline-flex w-fit flex-none shrink-0 items-center justify-self-start rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap;
  }

  .kumo-c-badge--variant-success {
    @apply bg-kumo-success-tint/70 text-kumo-success;
  }
}
```

If a Tailwind class cannot be safely represented through `@apply`, the contract may provide generated selectors or explicit `extraCss`. Consumers should receive plain compiled CSS and should not need Tailwind, CSS nesting transforms, or custom functions such as `size()`.

## Package output

Ship generated CSS from `@cloudflare/kumo`.

Recommended outputs:

```txt
dist/styles/kumo-components.css
dist/styles/components/{component}.css
```

Recommended package exports:

```json
{
  "./styles/kumo-components.css": {
    "default": "./dist/styles/kumo-components.css"
  },
  "./styles/components/badge.css": {
    "default": "./dist/styles/components/badge.css"
  }
}
```

The single bundle is the documented default. Per-component CSS files are useful for incremental adoption and lower CSS payloads.

## Lint enforcement

Add a custom oxlint rule, likely:

```txt
packages/kumo/lint/enforce-css-contract-standard.js
```

The rule should mirror the existing variant standard rule.

For every non-exempt component file matching:

```txt
src/components/{name}/{name}.tsx
```

require:

```ts
export const KUMO_{COMPONENT}_CSS_CONTRACT = defineCssContract(...)
```

The rule must enforce:

- missing contract fails for eligible components;
- contract export name matches component path;
- only one CSS contract export exists per component file;
- contract uses `defineCssContract(...)`;
- incorrect `*_CSS_CONTRACT` names fail;
- exempt/deprecated components are not required to export contracts.

The rule should use this initial exemption list:

```js
const CSS_CONTRACT_EXEMPT_COMPONENTS = [
  "CHART",
  "FLOW",
  "CLOUDFLARE_LOGO",
  "DATE_RANGE_PICKER",
];
```

## Drift prevention and tests

Drift prevention is a release blocker.

Required checks:

- lint enforces every eligible component exports a correctly named contract;
- contract schema validation tests load every discovered contract;
- generator tests verify all eligible contracts are included;
- generated CSS freshness check fails if output is stale;
- compiled CSS contains expected root, variant, part, and state selectors;
- representative parity tests compare React variant helper output to contract-derived styles where practical;
- docs support matrix is generated from discovered contracts so docs cannot drift from implementation.

Recommended test locations:

```txt
packages/kumo/tests/css-contracts/
packages/kumo/scripts/css-components/*.test.ts
```

## Docs requirements

Add a new docs page:

```txt
packages/kumo-docs-astro/src/pages/css.astro
```

Add sidebar entry immediately after Colors:

```ts
{ label: "Colors", href: "/colors" },
{ label: "CSS", href: "/css" },
{ label: "Accessibility", href: "/accessibility" },
```

Recommended `/css` page sections:

1. What Kumo CSS is
2. What Kumo CSS is not
3. Installation
4. Required theme setup
5. Light/dark/FedRAMP modes
6. Naming conventions
7. Component classes
8. State classes and data attributes
9. Accessibility responsibilities
10. Support matrix
11. Versioning/drift guarantee
12. Migration examples from plain HTML
13. Kitchen sink

The kitchen sink should come last, after users understand the contract, caveats, and responsibilities.

Docs should show React and CSS-only examples side by side where useful.

## Accessibility requirements

Docs must state that Kumo CSS only provides visuals. For interactive components, examples must use semantic markup and appropriate attributes, but must not imply CSS alone implements behavior.

For complex components, docs should call out required consumer responsibilities such as:

- maintaining `aria-expanded`;
- toggling `data-state`;
- moving focus;
- handling keyboard events;
- dismissing popovers/dialogs;
- keeping active descendant state in sync.

## Implementation sequence

This is not a partial-shipping plan. The PR is complete only when all eligible components are covered. The sequence below is for execution only.

1. Define `defineCssContract` and the contract schema.
2. Build contract discovery from component files.
3. Build the CSS generator and Tailwind CLI compilation path.
4. Add lint enforcement for eligible component contracts.
5. Prove the simple path with Badge.
6. Prove the complex styling path with Button.
7. Extend schema as needed for parts, states, nested selectors, and escape hatches.
8. Add contracts for every eligible component.
9. Add generated CSS package outputs and exports.
10. Add generated support matrix metadata.
11. Add `/css` docs page and sidebar entry.
12. Add kitchen sink examples.
13. Add CI checks for lint, contract validation, generated CSS freshness, and docs sync.

## Acceptance criteria

- Every non-exempt, non-deprecated component under `packages/kumo/src/components/{name}/{name}.tsx` exports `KUMO_{COMPONENT}_CSS_CONTRACT`.
- `chart`, `flow`, `cloudflare-logo`, and deprecated components are excluded.
- A custom lint rule fails when an eligible component is missing a contract or exports a malformed contract name.
- Generated CSS is compiled with Tailwind CLI during the Kumo build.
- Consumers can import a browser-ready CSS bundle without installing Tailwind.
- Generated CSS includes root, variant, part, and state classes for all eligible components.
- Package exports expose the generated CSS bundle.
- Docs include `/css` under the main sidebar after Colors.
- Docs include installation, theming, naming, accessibility caveats, support matrix, migration examples, and kitchen sink.
- Tests fail if contracts, generated CSS, or docs metadata drift.

## Risks and mitigations

### Risk: contract schema cannot express complex components

Mitigation: design the schema with parts, states, selectors, and `extraCss` from the beginning. Use Button and one complex Base UI component as early proving grounds.

### Risk: generated CSS drifts from React styling

Mitigation: contracts must import/reuse existing Tailwind variant constants where possible, lint enforces contract presence, and tests compare generated contract coverage against component files.

### Risk: consumers mistake CSS for behavior

Mitigation: docs must clearly state that CSS is visual only and interactive components require consumer-owned behavior and accessibility state.

### Risk: Tailwind `@apply` cannot compile every class pattern

Mitigation: use Tailwind CLI as the compiler, but allow contracts to generate explicit selectors and `extraCss` for cases that cannot be safely represented with `@apply`.

### Risk: component files become noisy

Mitigation: keep the canonical contract export in the component file, but allow complex CSS fragments to be factored into local constants or helper modules when necessary.
