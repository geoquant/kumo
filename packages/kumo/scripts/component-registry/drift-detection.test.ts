/**
 * Drift detection tests for the generative component manifest.
 *
 * Validates that the committed manifest (`component-manifest.ts`) is internally
 * consistent: every registry component is accounted for in exactly one bucket,
 * all sub-component parents exist in the registry, and wrapper/exclusion lists
 * don't reference phantom components.
 *
 * These tests catch silent regressions where a new component is added to the
 * registry but never classified for the generative system.
 */

import { describe, expect, it } from "vitest";
import {
  DIRECT_COMPONENTS,
  EXCLUDED_COMPONENTS,
  GENERATIVE_WRAPPER_TARGETS,
  REGISTRY_COMPONENT_NAMES,
  STATEFUL_WRAPPER_TARGETS,
  SUB_COMPONENT_ALIASES,
  TYPE_ALIASES,
  ALL_GENERATIVE_TYPES,
  SYNTHETIC_TYPES,
  TYPE_RESOLUTION_MAP,
} from "../../src/generative/component-manifest";

// =============================================================================
// Helpers
// =============================================================================

const registrySet = new Set<string>(REGISTRY_COMPONENT_NAMES);
const excludedSet = new Set(Object.keys(EXCLUDED_COMPONENTS));
const directSet = new Set<string>(DIRECT_COMPONENTS);
const statefulSet = new Set<string>(STATEFUL_WRAPPER_TARGETS);
const generativeSet = new Set<string>(GENERATIVE_WRAPPER_TARGETS);
const subComponentAliasSet = new Set(Object.keys(SUB_COMPONENT_ALIASES));
const typeAliasSet = new Set(Object.keys(TYPE_ALIASES));
const syntheticSet = new Set(Object.keys(SYNTHETIC_TYPES));

/**
 * Check whether a registry component is accounted for in the generative
 * classification system. A component is "classified" if it appears in at
 * least one of: direct, excluded, stateful wrapper, or generative wrapper.
 *
 * Note: a component CAN appear in both STATEFUL_WRAPPER_TARGETS and
 * GENERATIVE_WRAPPER_TARGETS (e.g. Select needs both). But it should NOT
 * appear in DIRECT and a wrapper list, or EXCLUDED and a wrapper list.
 */
function isClassified(name: string): boolean {
  return (
    directSet.has(name) ||
    excludedSet.has(name) ||
    statefulSet.has(name) ||
    generativeSet.has(name)
  );
}

// =============================================================================
// Registry coverage — every component is classified
// =============================================================================

describe("registry coverage", () => {
  it("every registry component is classified in at least one bucket", () => {
    const unclassified: string[] = [];

    for (const name of REGISTRY_COMPONENT_NAMES) {
      if (!isClassified(name)) {
        unclassified.push(name);
      }
    }

    expect(
      unclassified,
      `Unclassified registry components (add to DIRECT_COMPONENTS, EXCLUDED_COMPONENTS, STATEFUL_WRAPPER_TARGETS, or GENERATIVE_WRAPPER_TARGETS): ${unclassified.join(", ")}`,
    ).toEqual([]);
  });

  it("no component is both direct and excluded", () => {
    const conflicts = DIRECT_COMPONENTS.filter((name) => excludedSet.has(name));

    expect(
      conflicts,
      `Components in both DIRECT_COMPONENTS and EXCLUDED_COMPONENTS: ${[...conflicts].join(", ")}`,
    ).toEqual([]);
  });

  it("no excluded component has a wrapper target", () => {
    const conflicts = Object.keys(EXCLUDED_COMPONENTS).filter(
      (name) => statefulSet.has(name) || generativeSet.has(name),
    );

    expect(
      conflicts,
      `EXCLUDED components that are also wrapper targets: ${conflicts.join(", ")}`,
    ).toEqual([]);
  });

  it("no direct component has a wrapper target", () => {
    const conflicts = DIRECT_COMPONENTS.filter(
      (name) => statefulSet.has(name) || generativeSet.has(name),
    );

    expect(
      conflicts,
      `DIRECT components that are also wrapper targets: ${[...conflicts].join(", ")}`,
    ).toEqual([]);
  });
});

// =============================================================================
// Sub-component integrity — parents exist in registry
// =============================================================================

describe("sub-component integrity", () => {
  it("every sub-component alias parent exists in the registry", () => {
    const orphans: Array<{ alias: string; parent: string }> = [];

    for (const [alias, { parent }] of Object.entries(SUB_COMPONENT_ALIASES)) {
      if (!registrySet.has(parent)) {
        orphans.push({ alias, parent });
      }
    }

    expect(
      orphans,
      `Sub-component aliases referencing non-existent parents: ${orphans.map((o) => `${o.alias} → ${o.parent}`).join(", ")}`,
    ).toEqual([]);
  });

  it("every sub-component alias has a map entry", () => {
    const missing: string[] = [];

    for (const alias of Object.keys(SUB_COMPONENT_ALIASES)) {
      if (!(alias in TYPE_RESOLUTION_MAP)) {
        missing.push(alias);
      }
    }

    expect(
      missing,
      `Sub-component aliases missing from TYPE_RESOLUTION_MAP: ${missing.join(", ")}`,
    ).toEqual([]);
  });
});

// =============================================================================
// Wrapper/exclusion phantom detection — no stale references
// =============================================================================

describe("phantom detection", () => {
  it("excluded components all exist in registry", () => {
    const phantoms = Object.keys(EXCLUDED_COMPONENTS).filter(
      (name) => !registrySet.has(name),
    );

    expect(
      phantoms,
      `Stale exclusions (component no longer in registry): ${phantoms.join(", ")}`,
    ).toEqual([]);
  });

  it("stateful wrapper targets all exist in registry", () => {
    const phantoms = STATEFUL_WRAPPER_TARGETS.filter(
      (name) => !registrySet.has(name),
    );

    expect(
      phantoms,
      `Stale stateful wrapper targets: ${[...phantoms].join(", ")}`,
    ).toEqual([]);
  });

  it("generative wrapper targets all exist in registry", () => {
    const phantoms = GENERATIVE_WRAPPER_TARGETS.filter(
      (name) => !registrySet.has(name),
    );

    expect(
      phantoms,
      `Stale generative wrapper targets: ${[...phantoms].join(", ")}`,
    ).toEqual([]);
  });

  it("type alias targets all resolve to registry components", () => {
    const broken: Array<{ alias: string; target: string }> = [];

    for (const [alias, target] of Object.entries(TYPE_ALIASES)) {
      if (!registrySet.has(target)) {
        broken.push({ alias, target });
      }
    }

    expect(
      broken,
      `Type aliases targeting non-existent components: ${broken.map((b) => `${b.alias} → ${b.target}`).join(", ")}`,
    ).toEqual([]);
  });
});

// =============================================================================
// ALL_GENERATIVE_TYPES completeness
// =============================================================================

describe("generative types completeness", () => {
  it("ALL_GENERATIVE_TYPES contains every direct component", () => {
    const allSet = new Set<string>(ALL_GENERATIVE_TYPES);
    const missing = DIRECT_COMPONENTS.filter((name) => !allSet.has(name));

    expect(
      missing,
      `Direct components missing from ALL_GENERATIVE_TYPES: ${[...missing].join(", ")}`,
    ).toEqual([]);
  });

  it("ALL_GENERATIVE_TYPES contains every sub-component alias", () => {
    const allSet = new Set<string>(ALL_GENERATIVE_TYPES);
    const missing = Object.keys(SUB_COMPONENT_ALIASES).filter(
      (name) => !allSet.has(name),
    );

    expect(
      missing,
      `Sub-component aliases missing from ALL_GENERATIVE_TYPES: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("ALL_GENERATIVE_TYPES contains every type alias", () => {
    const allSet = new Set<string>(ALL_GENERATIVE_TYPES);
    const missing = Object.keys(TYPE_ALIASES).filter(
      (name) => !allSet.has(name),
    );

    expect(
      missing,
      `Type aliases missing from ALL_GENERATIVE_TYPES: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("ALL_GENERATIVE_TYPES contains every synthetic type", () => {
    const allSet = new Set<string>(ALL_GENERATIVE_TYPES);
    const missing = Object.keys(SYNTHETIC_TYPES).filter(
      (name) => !allSet.has(name),
    );

    expect(
      missing,
      `Synthetic types missing from ALL_GENERATIVE_TYPES: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("ALL_GENERATIVE_TYPES has no unaccounted entries", () => {
    const accounted = new Set([
      ...DIRECT_COMPONENTS,
      ...Object.keys(SUB_COMPONENT_ALIASES),
      ...Object.keys(TYPE_ALIASES),
      ...Object.keys(SYNTHETIC_TYPES),
    ]);

    const unaccounted = ALL_GENERATIVE_TYPES.filter(
      (name) => !accounted.has(name),
    );

    expect(
      unaccounted,
      `Entries in ALL_GENERATIVE_TYPES not sourced from any known list: ${[...unaccounted].join(", ")}`,
    ).toEqual([]);
  });

  it("ALL_GENERATIVE_TYPES is sorted", () => {
    const sorted = [...ALL_GENERATIVE_TYPES].sort((a, b) => a.localeCompare(b));
    expect(ALL_GENERATIVE_TYPES).toEqual(sorted);
  });
});

// =============================================================================
// Cross-cutting: wrapper targets are valid registry components
// =============================================================================

describe("wrapper target validity", () => {
  it("stateful wrapper targets all exist in registry and are not excluded", () => {
    const invalid = STATEFUL_WRAPPER_TARGETS.filter(
      (name) => !registrySet.has(name) || excludedSet.has(name),
    );

    expect(
      invalid,
      `Stateful wrapper targets missing from registry or in EXCLUDED: ${[...invalid].join(", ")}`,
    ).toEqual([]);
  });

  it("generative wrapper targets all exist in registry and are not excluded", () => {
    const invalid = GENERATIVE_WRAPPER_TARGETS.filter(
      (name) => !registrySet.has(name) || excludedSet.has(name),
    );

    expect(
      invalid,
      `Generative wrapper targets missing from registry or in EXCLUDED: ${[...invalid].join(", ")}`,
    ).toEqual([]);
  });

  it("wrapper targets are not in DIRECT_COMPONENTS (they get their own wrappers)", () => {
    const allWrapperTargets = new Set<string>([
      ...STATEFUL_WRAPPER_TARGETS,
      ...GENERATIVE_WRAPPER_TARGETS,
    ]);
    const conflicts = DIRECT_COMPONENTS.filter((name) =>
      allWrapperTargets.has(name),
    );

    expect(
      conflicts,
      `Components in both DIRECT and wrapper targets: ${[...conflicts].join(", ")}`,
    ).toEqual([]);
  });
});
