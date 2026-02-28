/**
 * Generative Component Manifest Generator
 *
 * Generates `src/generative/component-manifest.ts` — a pure data file that
 * declares which registry components are available in generative UI, how they
 * map, and which need wrappers.
 *
 * The manifest is consumed by hand-written `component-map.ts`,
 * `stateful-wrappers.tsx`, and `generative-wrappers.tsx`.
 *
 * Run: pnpm codegen:registry (called from index.ts main)
 * Output: src/generative/component-manifest.ts
 */

import type { ComponentRegistry } from "./types.js";

// =============================================================================
// Configuration — manually maintained lists of special-cased components
// =============================================================================

/**
 * Components excluded from generative UI. These are complex overlay/portal
 * components that don't make sense in LLM-generated flat UI trees.
 *
 * Each entry MUST have a documented reason.
 */
const EXCLUDED_COMPONENTS: Record<string, string> = {
  CommandPalette:
    "Complex overlay with 14 sub-components; requires host keyboard handling",
  Combobox:
    "Complex dropdown with search, multi-select, portals; requires host state",
  DatePicker:
    "Calendar overlay requires date library and complex state management",
  DateRangePicker:
    "Calendar overlay requires date library and complex state management",
  Dialog: "Portal-based overlay; LLM-generated content should be inline",
  DropdownMenu:
    "Portal-based overlay with sub-menus; requires host trigger management",
  LayerCard:
    "Specialized dashboard layout component; not suited for freeform generation",
  MenuBar: "Complex keyboard-navigable menu system; requires host integration",
  Pagination: "Requires host-managed page state and data fetching",
  Popover: "Portal-based overlay; LLM-generated content should be inline",
  SensitiveInput: "Security-sensitive input; should not be auto-generated",
  Toasty: "Toast notification system requires imperative host API",
  Tooltip: "Portal-based overlay; requires hover trigger management",
};

/**
 * Components that are controlled-only in Kumo (no defaultValue/defaultChecked)
 * and need stateful wrappers for LLM-generated UIs to be interactive.
 */
const STATEFUL_WRAPPER_TARGETS = [
  "Checkbox",
  "Collapsible",
  "Select",
  "Switch",
  "Tabs",
] as const;

/**
 * Components that need generative wrappers for default styling or behavior
 * adjustments in LLM-generated UI. Each entry maps to a wrapper component
 * in `generative-wrappers.tsx`.
 */
const GENERATIVE_WRAPPER_TARGETS = [
  "CloudflareLogo",
  "Input",
  "InputArea",
  "Select",
  "Surface",
] as const;

/**
 * Type aliases: LLM output name → Kumo export name.
 * Allows models to use shorter/clearer names.
 */
const TYPE_ALIASES: Record<string, string> = {
  Textarea: "InputArea",
};

/**
 * Sub-component flattening rules. Maps flattened name → { parent, sub }.
 * These are sub-components exposed as top-level types in the generative map
 * so models can reference "TableHeader" instead of nesting under "Table".
 *
 * Derived from registry sub-components, filtered to only those that make
 * sense in flat generative UI.
 */
const SUB_COMPONENT_OVERRIDES: Record<string, { parent: string; sub: string }> =
  {
    BreadcrumbsCurrent: { parent: "Breadcrumbs", sub: "Current" },
    BreadcrumbsLink: { parent: "Breadcrumbs", sub: "Link" },
    BreadcrumbsSeparator: { parent: "Breadcrumbs", sub: "Separator" },
    FlowNode: { parent: "Flow", sub: "Node" },
    FlowParallel: { parent: "Flow", sub: "Parallel" },
    RadioGroup: { parent: "Radio", sub: "Group" },
    RadioItem: { parent: "Radio", sub: "Item" },
    SelectOption: { parent: "Select", sub: "Option" },
    TableBody: { parent: "Table", sub: "Body" },
    TableCell: { parent: "Table", sub: "Cell" },
    TableFooter: { parent: "Table", sub: "Footer" },
    TableHead: { parent: "Table", sub: "Head" },
    TableHeader: { parent: "Table", sub: "Header" },
    TableRow: { parent: "Table", sub: "Row" },
  };

/**
 * Synthetic types: component names that don't correspond to a registry
 * component or sub-component, but are useful aliases for LLM output.
 */
const SYNTHETIC_TYPES: Record<string, string> = {
  Div: "Generic container element rendered as a <div>",
};

// =============================================================================
// Generator
// =============================================================================

/**
 * Derive the set of "direct" components — registry components that map 1:1
 * to a Kumo export without any wrapper or aliasing.
 */
function computeDirectComponents(registryNames: readonly string[]): string[] {
  const excluded = new Set(Object.keys(EXCLUDED_COMPONENTS));
  const stateful = new Set<string>(STATEFUL_WRAPPER_TARGETS);
  const generative = new Set<string>(GENERATIVE_WRAPPER_TARGETS);

  return registryNames.filter(
    (name) =>
      !excluded.has(name) && !stateful.has(name) && !generative.has(name),
  );
}

function computeTypeResolutionMap(): Record<
  string,
  { registryComponent: string; subComponent?: string }
> {
  const merged: Record<
    string,
    { registryComponent: string; subComponent?: string }
  > = {};

  for (const [name, registryComponent] of Object.entries(TYPE_ALIASES)) {
    merged[name] = { registryComponent };
  }

  for (const [name, { parent, sub }] of Object.entries(
    SUB_COMPONENT_OVERRIDES,
  )) {
    merged[name] = { registryComponent: parent, subComponent: sub };
  }

  return Object.fromEntries(
    Object.keys(merged)
      .toSorted((a, b) => a.localeCompare(b))
      .map((name) => [name, merged[name]]),
  );
}

function computeAllGenerativeTypes(
  directComponents: readonly string[],
): string[] {
  const allTypes = new Set<string>(directComponents);

  for (const key of Object.keys(SUB_COMPONENT_OVERRIDES)) {
    allTypes.add(key);
  }
  for (const key of Object.keys(TYPE_ALIASES)) {
    allTypes.add(key);
  }
  for (const key of Object.keys(SYNTHETIC_TYPES)) {
    allTypes.add(key);
  }

  return Array.from(allTypes).toSorted((a, b) => a.localeCompare(b));
}

// =============================================================================
// Drift Detection
// =============================================================================

interface DriftWarning {
  readonly type: "stale-exclusion" | "stale-wrapper" | "orphan-sub-component";
  readonly component: string;
  readonly message: string;
}

/**
 * Detect drift between registry contents and the hardcoded generative
 * configuration. Catches stale references that would otherwise silently
 * accumulate as components are added/removed from the registry.
 *
 * Note: "unclassified" components are impossible by construction —
 * `computeDirectComponents` treats any non-excluded, non-wrapper component
 * as direct. The real drift risks are stale references and orphaned
 * sub-component parents.
 */
function detectDrift(registryNames: readonly string[]): DriftWarning[] {
  const warnings: DriftWarning[] = [];
  const registrySet = new Set(registryNames);

  // Stale exclusions: component removed from registry but still in EXCLUDED
  for (const name of Object.keys(EXCLUDED_COMPONENTS)) {
    if (!registrySet.has(name)) {
      warnings.push({
        type: "stale-exclusion",
        component: name,
        message: `EXCLUDED_COMPONENTS references "${name}" which is no longer in the registry`,
      });
    }
  }

  // Stale wrapper targets: component removed but still targeted
  for (const name of STATEFUL_WRAPPER_TARGETS) {
    if (!registrySet.has(name)) {
      warnings.push({
        type: "stale-wrapper",
        component: name,
        message: `STATEFUL_WRAPPER_TARGETS references "${name}" which is no longer in the registry`,
      });
    }
  }
  for (const name of GENERATIVE_WRAPPER_TARGETS) {
    if (!registrySet.has(name)) {
      warnings.push({
        type: "stale-wrapper",
        component: name,
        message: `GENERATIVE_WRAPPER_TARGETS references "${name}" which is no longer in the registry`,
      });
    }
  }

  // Orphaned sub-component parents: parent removed but sub-component override remains
  for (const [alias, { parent }] of Object.entries(SUB_COMPONENT_OVERRIDES)) {
    if (!registrySet.has(parent)) {
      warnings.push({
        type: "orphan-sub-component",
        component: alias,
        message: `SUB_COMPONENT_OVERRIDES "${alias}" references parent "${parent}" which is no longer in the registry`,
      });
    }
  }

  return warnings;
}

/**
 * Generate the content of `src/generative/component-manifest.ts`.
 *
 * Runs drift detection and logs warnings to stderr during codegen.
 * Warnings are visible in `pnpm codegen:registry` output and CI logs.
 */
export function generateComponentManifest(registry: ComponentRegistry): string {
  const registryNames = Object.keys(registry.components).toSorted();
  const directComponents = computeDirectComponents(registryNames);
  const typeResolutionMap = computeTypeResolutionMap();
  const allGenerativeTypes = computeAllGenerativeTypes(directComponents);

  // Drift detection — warn during codegen
  const driftWarnings = detectDrift(registryNames);
  if (driftWarnings.length > 0) {
    console.warn("\n[drift] Generative manifest drift detected:");
    for (const w of driftWarnings) {
      console.warn(`  ⚠ ${w.message}`);
    }
    console.warn(
      "  Fix: classify new components in generative-map-generator.ts\n",
    );
  }

  const lines: string[] = [
    "/**",
    " * Auto-generated generative component manifest",
    " * DO NOT EDIT — Generated by scripts/component-registry/generative-map-generator.ts",
    " *",
    " * Declares which registry components are available in generative UI,",
    " * how they map to React components, and which need wrappers.",
    " *",
    " * Run: pnpm codegen:registry",
    " */",
    "",
    "// =============================================================================",
    "// Direct components — registry components that map 1:1 to Kumo exports",
    "// =============================================================================",
    "",
    `export const DIRECT_COMPONENTS = ${JSON.stringify(directComponents, null, 2)} as const;`,
    "",
    "// =============================================================================",
    "// Sub-component flattening — ParentSub → Parent.Sub in component map",
    "// =============================================================================",
    "",
    `export const SUB_COMPONENT_ALIASES = ${JSON.stringify(SUB_COMPONENT_OVERRIDES, null, 2)} as const;`,
    "",
    "// =============================================================================",
    "// Unified type resolution — generative type → registry component lookup",
    "// =============================================================================",
    "",
    `export const TYPE_RESOLUTION_MAP = ${JSON.stringify(typeResolutionMap, null, 2)} as const;`,
    "",
    "// =============================================================================",
    "// Type aliases — LLM output name → Kumo export name",
    "// =============================================================================",
    "",
    `export const TYPE_ALIASES = ${JSON.stringify(TYPE_ALIASES, null, 2)} as const;`,
    "",
    "// =============================================================================",
    "// Wrapper targets — components requiring stateful or generative wrappers",
    "// =============================================================================",
    "",
    `export const STATEFUL_WRAPPER_TARGETS = ${JSON.stringify([...STATEFUL_WRAPPER_TARGETS], null, 2)} as const;`,
    "",
    `export const GENERATIVE_WRAPPER_TARGETS = ${JSON.stringify([...GENERATIVE_WRAPPER_TARGETS], null, 2)} as const;`,
    "",
    "// =============================================================================",
    "// Synthetic types — virtual types not in registry",
    "// =============================================================================",
    "",
    `export const SYNTHETIC_TYPES = ${JSON.stringify(SYNTHETIC_TYPES, null, 2)} as const;`,
    "",
    "// =============================================================================",
    "// All generative types — direct + aliases + sub-components + synthetic",
    "// =============================================================================",
    "",
    `export const ALL_GENERATIVE_TYPES = ${JSON.stringify(allGenerativeTypes, null, 2)} as const;`,
    "",
    "// =============================================================================",
    "// Excluded components — intentionally not in generative map",
    "// =============================================================================",
    "",
    `export const EXCLUDED_COMPONENTS = ${JSON.stringify(EXCLUDED_COMPONENTS, null, 2)} as const;`,
    "",
    "// =============================================================================",
    "// Registry snapshot — all component names for drift detection",
    "// =============================================================================",
    "",
    `export const REGISTRY_COMPONENT_NAMES = ${JSON.stringify(registryNames, null, 2)} as const;`,
    "",
  ];

  return lines.join("\n");
}
