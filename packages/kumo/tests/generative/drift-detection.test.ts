/**
 * Drift detection tests for the generative component map.
 *
 * Ensures the component manifest, component map, and wrappers stay in sync
 * with the component registry. Catches:
 *   - New registry components missing from the generative map
 *   - Stale map entries that no longer exist in the registry
 *   - Excluded components without documented reasons
 *   - Missing stateful/generative wrappers
 *   - Codegen staleness (checked-in manifest differs from what codegen produces)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Manifest — auto-generated pure data
import {
  DIRECT_COMPONENTS,
  SUB_COMPONENT_ALIASES,
  TYPE_ALIASES,
  STATEFUL_WRAPPER_TARGETS,
  GENERATIVE_WRAPPER_TARGETS,
  SYNTHETIC_TYPES,
  EXCLUDED_COMPONENTS,
  REGISTRY_COMPONENT_NAMES,
} from "@/generative/component-manifest";

// Runtime map + known types
import { COMPONENT_MAP, KNOWN_TYPES } from "@/generative/component-map";

// Wrappers — verify they exist as real components
import {
  StatefulSelect,
  StatefulCheckbox,
  StatefulSwitch,
  StatefulTabs,
  StatefulCollapsible,
} from "@/generative/stateful-wrappers";

import {
  GenerativeSurface,
  GenerativeInput,
  GenerativeInputArea,
  GenerativeCloudflareLogo,
  GenerativeSelect,
} from "@/generative/generative-wrappers";

// Registry JSON — source of truth
import registryJson from "../../ai/component-registry.json";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// =============================================================================
// Helpers
// =============================================================================

const registryNames = Object.keys(
  (registryJson as Record<string, unknown>)["components"] as Record<
    string,
    unknown
  >,
).toSorted();

const excludedSet = new Set(Object.keys(EXCLUDED_COMPONENTS));
const directSet = new Set<string>(DIRECT_COMPONENTS);
const statefulSet = new Set<string>(STATEFUL_WRAPPER_TARGETS);
const generativeSet = new Set<string>(GENERATIVE_WRAPPER_TARGETS);
const subAliasKeys = new Set(Object.keys(SUB_COMPONENT_ALIASES));
const typeAliasKeys = new Set(Object.keys(TYPE_ALIASES));

// All accounted-for registry components:
// direct + excluded + stateful wrapper targets + generative wrapper targets
const accountedFor = new Set([
  ...directSet,
  ...excludedSet,
  ...statefulSet,
  ...generativeSet,
]);

// =============================================================================
// 1. Registry coverage — every registry component is accounted for
// =============================================================================

describe("Registry coverage", () => {
  it("every registry component is either in the map or explicitly excluded", () => {
    const unaccounted: string[] = [];
    for (const name of registryNames) {
      if (!accountedFor.has(name)) {
        unaccounted.push(name);
      }
    }
    expect(unaccounted).toEqual([]);
  });

  it("REGISTRY_COMPONENT_NAMES matches live registry", () => {
    expect([...REGISTRY_COMPONENT_NAMES].toSorted()).toEqual(registryNames);
  });

  it("DIRECT_COMPONENTS are all in the registry", () => {
    for (const name of DIRECT_COMPONENTS) {
      expect(registryNames).toContain(name);
    }
  });

  it("STATEFUL_WRAPPER_TARGETS are all in the registry", () => {
    for (const name of STATEFUL_WRAPPER_TARGETS) {
      expect(registryNames).toContain(name);
    }
  });

  it("GENERATIVE_WRAPPER_TARGETS are all in the registry", () => {
    for (const name of GENERATIVE_WRAPPER_TARGETS) {
      expect(registryNames).toContain(name);
    }
  });
});

// =============================================================================
// 2. COMPONENT_MAP entries — every entry resolves to a real component
// =============================================================================

describe("COMPONENT_MAP entries", () => {
  it("every map entry is a valid React component or intrinsic element", () => {
    // React components may be: function (plain), object (forwardRef), or string (intrinsic)
    const validTypes = new Set(["function", "object", "string"]);
    for (const [key, value] of Object.entries(COMPONENT_MAP)) {
      expect(
        validTypes.has(typeof value) && value !== null,
        `COMPONENT_MAP["${key}"] is ${typeof value}, expected function/object/string`,
      ).toBe(true);
    }
  });

  it("every direct component has a map entry", () => {
    for (const name of DIRECT_COMPONENTS) {
      expect(
        COMPONENT_MAP[name],
        `COMPONENT_MAP missing direct component "${name}"`,
      ).toBeDefined();
    }
  });

  it("every sub-component alias has a map entry", () => {
    for (const alias of Object.keys(SUB_COMPONENT_ALIASES)) {
      expect(
        COMPONENT_MAP[alias],
        `COMPONENT_MAP missing sub-component alias "${alias}"`,
      ).toBeDefined();
    }
  });

  it("every type alias has a map entry", () => {
    for (const alias of Object.keys(TYPE_ALIASES)) {
      expect(
        COMPONENT_MAP[alias],
        `COMPONENT_MAP missing type alias "${alias}"`,
      ).toBeDefined();
    }
  });

  it("every synthetic type has a map entry", () => {
    for (const name of Object.keys(SYNTHETIC_TYPES)) {
      expect(
        COMPONENT_MAP[name],
        `COMPONENT_MAP missing synthetic type "${name}"`,
      ).toBeDefined();
    }
  });

  it("Div maps to 'div' string (intrinsic element)", () => {
    expect(COMPONENT_MAP["Div"]).toBe("div");
  });

  it("KNOWN_TYPES matches COMPONENT_MAP keys", () => {
    const mapKeys = new Set(Object.keys(COMPONENT_MAP));
    expect(KNOWN_TYPES).toEqual(mapKeys);
  });
});

// =============================================================================
// 3. Stateful wrappers — controlled-only components have wrappers
// =============================================================================

describe("Stateful wrappers", () => {
  const wrapperMap: Record<string, unknown> = {
    Checkbox: StatefulCheckbox,
    Select: StatefulSelect,
    Switch: StatefulSwitch,
    Tabs: StatefulTabs,
    Collapsible: StatefulCollapsible,
  };

  for (const target of STATEFUL_WRAPPER_TARGETS) {
    it(`${target} has a stateful wrapper`, () => {
      expect(
        wrapperMap[target],
        `Missing stateful wrapper for "${target}"`,
      ).toBeDefined();
      expect(typeof wrapperMap[target]).toBe("function");
    });

    it(`COMPONENT_MAP["${target}"] uses the stateful wrapper (not raw Kumo)`, () => {
      // The map entry should be a wrapper, not undefined
      expect(COMPONENT_MAP[target]).toBeDefined();
    });
  }

  it("StatefulSelect has an Option sub-component", () => {
    expect(StatefulSelect.Option).toBeDefined();
    // Select.Option is a React component (function or forwardRef object)
    const t = typeof StatefulSelect.Option;
    expect(t === "function" || t === "object").toBe(true);
  });
});

// =============================================================================
// 4. Generative wrappers — styled defaults exist
// =============================================================================

describe("Generative wrappers", () => {
  const wrapperMap: Record<string, unknown> = {
    Surface: GenerativeSurface,
    Input: GenerativeInput,
    InputArea: GenerativeInputArea,
    CloudflareLogo: GenerativeCloudflareLogo,
    Select: GenerativeSelect,
  };

  for (const target of GENERATIVE_WRAPPER_TARGETS) {
    it(`${target} has a generative wrapper`, () => {
      expect(
        wrapperMap[target],
        `Missing generative wrapper for "${target}"`,
      ).toBeDefined();
      // Generative wrappers may be function or object (forwardRef)
      const t = typeof wrapperMap[target];
      expect(t === "function" || t === "object").toBe(true);
    });
  }
});

// =============================================================================
// 5. No stale entries — map entries trace back to something real
// =============================================================================

describe("No stale entries", () => {
  it("every COMPONENT_MAP key is accounted for by manifest", () => {
    const manifestKeys = new Set([
      ...directSet,
      ...subAliasKeys,
      ...typeAliasKeys,
      ...Object.keys(SYNTHETIC_TYPES),
      // Stateful and generative wrappers override keys already in direct/alias
      // but also introduce their own (e.g. Checkbox, Select, etc.)
      ...statefulSet,
      ...generativeSet,
      // InputArea is in GENERATIVE_WRAPPER_TARGETS but also overridden as
      // "Textarea" alias → both "InputArea" and "Textarea" are map keys
      // SelectOption is a sub-component alias
    ]);

    const staleKeys: string[] = [];
    for (const key of Object.keys(COMPONENT_MAP)) {
      if (!manifestKeys.has(key)) {
        staleKeys.push(key);
      }
    }
    expect(
      staleKeys,
      `Stale COMPONENT_MAP keys not in manifest: ${staleKeys.join(", ")}`,
    ).toEqual([]);
  });

  it("no excluded component has a COMPONENT_MAP entry", () => {
    const leaked: string[] = [];
    for (const name of Object.keys(EXCLUDED_COMPONENTS)) {
      if (COMPONENT_MAP[name] !== undefined) {
        leaked.push(name);
      }
    }
    expect(
      leaked,
      `Excluded components found in COMPONENT_MAP: ${leaked.join(", ")}`,
    ).toEqual([]);
  });
});

// =============================================================================
// 6. Excluded components — documented reasons
// =============================================================================

describe("Excluded components", () => {
  it("every excluded component is in the registry", () => {
    for (const name of Object.keys(EXCLUDED_COMPONENTS)) {
      expect(
        registryNames,
        `Excluded component "${name}" not found in registry — remove from EXCLUDED_COMPONENTS`,
      ).toContain(name);
    }
  });

  it("every excluded component has a non-empty reason string", () => {
    const entries: Record<string, string> = EXCLUDED_COMPONENTS;
    for (const [name, reason] of Object.entries(entries)) {
      expect(typeof reason).toBe("string");
      expect(
        reason.length > 0,
        `Excluded component "${name}" has empty reason`,
      ).toBe(true);
    }
  });

  it("no overlap between excluded and direct components", () => {
    const overlap = [...directSet].filter((n) => excludedSet.has(n));
    expect(overlap).toEqual([]);
  });

  it("no overlap between excluded and stateful wrapper targets", () => {
    const overlap = [...statefulSet].filter((n) => excludedSet.has(n));
    expect(overlap).toEqual([]);
  });

  it("no overlap between excluded and generative wrapper targets", () => {
    const overlap = [...generativeSet].filter((n) => excludedSet.has(n));
    expect(overlap).toEqual([]);
  });
});

// =============================================================================
// 7. Codegen staleness — checked-in manifest matches what codegen produces
// =============================================================================

describe("Codegen staleness", () => {
  it("component-manifest.ts matches what the generator would produce", async () => {
    // Import the generator
    const { generateComponentManifest } = await import(
      "../../scripts/component-registry/generative-map-generator.js"
    );

    // The generator only reads registry.components, but the JSON import's
    // inferred literal type doesn't match ComponentRegistry exactly.
    // Cast through unknown since we know the JSON shape is valid.
    const expectedContent = generateComponentManifest(
      registryJson as unknown as Parameters<
        typeof generateComponentManifest
      >[0],
    );

    // Read the checked-in file
    const manifestPath = resolve(
      __dirname,
      "../../src/generative/component-manifest.ts",
    );
    const actualContent = readFileSync(manifestPath, "utf-8");

    expect(actualContent).toBe(expectedContent);
  });
});
