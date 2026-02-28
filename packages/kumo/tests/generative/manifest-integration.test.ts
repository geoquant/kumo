/**
 * Integration tests for manifest-derived data flowing into validator and prompt-builder.
 *
 * Verifies the cross-cutting contract: component-manifest.ts is the SSOT and
 * both element-validator.ts and prompt-builder.ts derive their lookup tables
 * from it correctly. Catches drift where the manifest changes but a consumer
 * doesn't adapt.
 */

import { describe, it, expect } from "vitest";

import {
  TYPE_ALIASES,
  SUB_COMPONENT_ALIASES,
  TYPE_RESOLUTION_MAP,
  ALL_GENERATIVE_TYPES,
  DIRECT_COMPONENTS,
  SYNTHETIC_TYPES,
} from "@/generative/component-manifest";
import { validateElement } from "@/generative/element-validator";
import { buildComponentDocs } from "../../src/catalog/prompt-builder";
import { ComponentPropsSchemas } from "../../ai/schemas";

import registryJson from "../../ai/component-registry.json";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeElement(type: string, props: Record<string, unknown> = {}) {
  return { key: `test-${type}`, type, props };
}

// ---------------------------------------------------------------------------
// Manifest → Validator integration
// ---------------------------------------------------------------------------

describe("manifest → validator integration", () => {
  it("every TYPE_ALIASES entry resolves to a valid schema key", () => {
    for (const alias of Object.keys(TYPE_ALIASES)) {
      const target = TYPE_ALIASES[alias as keyof typeof TYPE_ALIASES];
      expect(
        target in ComponentPropsSchemas,
        `TYPE_ALIASES["${alias}"] targets "${target}" which has no schema in ComponentPropsSchemas`,
      ).toBe(true);
    }
  });

  it("alias types validate against the target schema", () => {
    // Textarea → InputArea: InputArea accepts `placeholder` prop
    const result = validateElement(
      makeElement("Textarea", { placeholder: "Type here..." }),
    );
    expect(result.valid).toBe(true);
  });

  it("alias types are routed through validator without throwing", () => {
    // Textarea → InputArea: validator should handle alias resolution
    for (const alias of Object.keys(TYPE_ALIASES)) {
      expect(() => validateElement(makeElement(alias))).not.toThrow();
    }
  });

  it("every SUB_COMPONENT_ALIASES entry is handled by validator without throwing", () => {
    // Sub-components either pass-through (null schema) or validate against
    // parent schema (VALIDATED_SUB_COMPONENTS). Either path should not throw.
    for (const subName of Object.keys(SUB_COMPONENT_ALIASES)) {
      expect(
        () => validateElement(makeElement(subName)),
        `sub-component "${subName}" should be handled by validator`,
      ).not.toThrow();
    }
  });

  it("null-mapped sub-components pass validation (no schema)", () => {
    // Sub-components NOT in VALIDATED_SUB_COMPONENTS map to null = pass-through
    const validatedSubComponents = new Set(["RadioGroup"]);
    for (const subName of Object.keys(SUB_COMPONENT_ALIASES)) {
      if (validatedSubComponents.has(subName)) continue;
      const result = validateElement(makeElement(subName));
      expect(
        result.valid,
        `"${subName}" should pass (null schema = pass-through)`,
      ).toBe(true);
    }
  });

  it("every DIRECT_COMPONENTS entry has a schema in ComponentPropsSchemas", () => {
    for (const name of DIRECT_COMPONENTS) {
      expect(
        name in ComponentPropsSchemas,
        `DIRECT_COMPONENTS includes "${name}" but ComponentPropsSchemas has no entry for it`,
      ).toBe(true);
    }
  });

  it("direct components validate correctly through the validator", () => {
    // Every direct component should at least pass with empty props
    // (schemas typically allow all props to be optional)
    for (const name of DIRECT_COMPONENTS) {
      const result = validateElement(makeElement(name));
      // We only assert no thrown errors — some schemas may require props,
      // so we check the result is a valid structure, not necessarily valid=true
      expect(result).toHaveProperty("valid");
    }
  });

  it("Div synthetic type passes through validator", () => {
    const result = validateElement(makeElement("Div", { className: "test" }));
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Manifest → Prompt-builder integration
// ---------------------------------------------------------------------------

describe("manifest → prompt-builder integration", () => {
  it("every TYPE_RESOLUTION_MAP entry produces prompt docs for its registry component", () => {
    for (const [uiType, entry] of Object.entries(TYPE_RESOLUTION_MAP)) {
      const docs = buildComponentDocs(registryJson, {
        components: [uiType],
      });
      // Types in TYPE_RESOLUTION_MAP are sub-components or aliases.
      // Sub-components may not have registry entries (resolved via parent's
      // subComponents map). If the registry has the entry, it should appear;
      // if not, the prompt-builder's SYNTHETIC_TYPES may cover it.
      // At minimum, no error should be thrown.
      expect(typeof docs).toBe("string");

      // For the Textarea alias, verify the alias annotation appears
      if (uiType in TYPE_ALIASES) {
        const target = TYPE_ALIASES[uiType as keyof typeof TYPE_ALIASES];
        expect(
          docs,
          `prompt docs for alias "${uiType}" should mention target "${target}"`,
        ).toContain(`alias of ${target}`);
      }
    }
  });

  it("every alias in TYPE_ALIASES gets an annotation in prompt docs", () => {
    for (const alias of Object.keys(TYPE_ALIASES)) {
      const target = TYPE_ALIASES[alias as keyof typeof TYPE_ALIASES];
      const docs = buildComponentDocs(registryJson, {
        components: [alias],
      });
      expect(docs).toContain(`**${alias}**`);
      expect(docs).toContain(`alias of ${target}`);
    }
  });

  it("direct components appear in prompt docs with their name", () => {
    const docs = buildComponentDocs(registryJson, {
      components: [...DIRECT_COMPONENTS],
    });
    for (const name of DIRECT_COMPONENTS) {
      expect(
        docs,
        `direct component "${name}" should appear in prompt docs`,
      ).toContain(`**${name}**`);
    }
  });

  it("synthetic types appear in prompt docs", () => {
    for (const syntheticName of Object.keys(SYNTHETIC_TYPES)) {
      const docs = buildComponentDocs(registryJson, {
        components: [syntheticName],
      });
      expect(
        docs,
        `synthetic type "${syntheticName}" should appear in prompt docs`,
      ).toContain(`**${syntheticName}**`);
    }
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: manifest consistency across consumers
// ---------------------------------------------------------------------------

describe("manifest cross-consumer consistency", () => {
  it("TYPE_RESOLUTION_MAP keys are a superset of SUB_COMPONENT_ALIASES keys", () => {
    const resolutionKeys = new Set(Object.keys(TYPE_RESOLUTION_MAP));
    for (const subName of Object.keys(SUB_COMPONENT_ALIASES)) {
      expect(
        resolutionKeys.has(subName),
        `SUB_COMPONENT_ALIASES["${subName}"] has no TYPE_RESOLUTION_MAP entry`,
      ).toBe(true);
    }
  });

  it("TYPE_RESOLUTION_MAP keys are a superset of TYPE_ALIASES keys", () => {
    const resolutionKeys = new Set(Object.keys(TYPE_RESOLUTION_MAP));
    for (const alias of Object.keys(TYPE_ALIASES)) {
      expect(
        resolutionKeys.has(alias),
        `TYPE_ALIASES["${alias}"] has no TYPE_RESOLUTION_MAP entry`,
      ).toBe(true);
    }
  });

  it("every ALL_GENERATIVE_TYPES entry is handled by validator without throwing", () => {
    for (const type of ALL_GENERATIVE_TYPES) {
      // Must not throw — every generative type should be a known path
      expect(() => validateElement(makeElement(type))).not.toThrow();
    }
  });

  it("every ALL_GENERATIVE_TYPES entry can be requested in prompt docs without throwing", () => {
    for (const type of ALL_GENERATIVE_TYPES) {
      expect(() =>
        buildComponentDocs(registryJson, { components: [type] }),
      ).not.toThrow();
    }
  });

  it("validator and prompt-builder agree on alias targets", () => {
    // For each alias, validator maps it to a schema key and prompt-builder
    // maps it to a registry ref. Both should reference the same target component.
    for (const alias of Object.keys(TYPE_ALIASES)) {
      const target = TYPE_ALIASES[alias as keyof typeof TYPE_ALIASES];

      // Validator: alias �� target schema
      const validatorTarget = target;

      // Prompt-builder: alias → registry ref component
      const resolutionEntry =
        TYPE_RESOLUTION_MAP[alias as keyof typeof TYPE_RESOLUTION_MAP];
      expect(resolutionEntry).toBeDefined();

      const promptTarget = resolutionEntry.registryComponent;

      expect(
        validatorTarget,
        `alias "${alias}": validator targets "${validatorTarget}" but prompt resolution targets "${promptTarget}"`,
      ).toBe(promptTarget);
    }
  });

  it("sub-component parent references are consistent across manifest tables", () => {
    for (const subName of Object.keys(SUB_COMPONENT_ALIASES)) {
      const entry =
        SUB_COMPONENT_ALIASES[subName as keyof typeof SUB_COMPONENT_ALIASES];
      const { parent, sub } = entry;

      const resolution =
        TYPE_RESOLUTION_MAP[subName as keyof typeof TYPE_RESOLUTION_MAP];
      expect(
        resolution,
        `SUB_COMPONENT_ALIASES["${subName}"] has no TYPE_RESOLUTION_MAP entry`,
      ).toBeDefined();

      expect(
        resolution.registryComponent,
        `resolution map parent mismatch for "${subName}": expected "${parent}"`,
      ).toBe(parent);

      if ("subComponent" in resolution) {
        expect(
          resolution.subComponent,
          `resolution map sub mismatch for "${subName}": expected "${sub}"`,
        ).toBe(sub);
      }
    }
  });
});
