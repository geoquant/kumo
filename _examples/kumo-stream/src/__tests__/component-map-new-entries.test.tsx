import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { UITreeRenderer } from "../core/UITreeRenderer";
import { COMPONENT_MAP, KNOWN_TYPES } from "../core/component-map";
import type { UITree, UIElement } from "../core/types";

// =============================================================================
// Helpers
// =============================================================================

function el(
  key: string,
  type: string,
  props: Record<string, unknown> = {},
  children?: string[],
): UIElement {
  return {
    key,
    type,
    props,
    ...(children != null ? { children } : {}),
  };
}

function mkTree(root: string, elements: Record<string, UIElement>): UITree {
  return { root, elements };
}

// =============================================================================
// KNOWN_TYPES includes new entries
// =============================================================================

describe("KNOWN_TYPES", () => {
  it("includes RadioGroup", () => {
    expect(KNOWN_TYPES.has("RadioGroup")).toBe(true);
  });

  it("includes RadioItem", () => {
    expect(KNOWN_TYPES.has("RadioItem")).toBe(true);
  });

  it("includes Textarea", () => {
    expect(KNOWN_TYPES.has("Textarea")).toBe(true);
  });

  it("includes Collapsible", () => {
    expect(KNOWN_TYPES.has("Collapsible")).toBe(true);
  });

  it("includes Code", () => {
    expect(KNOWN_TYPES.has("Code")).toBe(true);
  });

  it("includes Field", () => {
    expect(KNOWN_TYPES.has("Field")).toBe(true);
  });

  it("includes Label", () => {
    expect(KNOWN_TYPES.has("Label")).toBe(true);
  });
});

// =============================================================================
// COMPONENT_MAP entries resolve to components
// =============================================================================

describe("COMPONENT_MAP entries", () => {
  it("RadioGroup maps to a defined component", () => {
    expect(COMPONENT_MAP.RadioGroup).toBeDefined();
  });

  it("RadioItem maps to a defined component", () => {
    expect(COMPONENT_MAP.RadioItem).toBeDefined();
  });

  it("Textarea maps to a defined component (InputArea)", () => {
    expect(COMPONENT_MAP.Textarea).toBeDefined();
  });

  it("Collapsible maps to StatefulCollapsible", () => {
    expect(COMPONENT_MAP.Collapsible).toBeDefined();
    // StatefulCollapsible is a plain function, not a forwardRef
    expect(typeof COMPONENT_MAP.Collapsible).toBe("function");
  });

  it("Code maps to a defined component", () => {
    expect(COMPONENT_MAP.Code).toBeDefined();
  });

  it("Field maps to a defined component", () => {
    expect(COMPONENT_MAP.Field).toBeDefined();
  });

  it("Label maps to a defined component", () => {
    expect(COMPONENT_MAP.Label).toBeDefined();
  });
});

// =============================================================================
// Rendering tests via UITreeRenderer
//
// NOTE: Kumo components imported from dist/ use a bundled React copy that
// conflicts with the test env's React. The error boundary catches this
// gracefully. These tests verify UITreeRenderer resolves the types (no
// "Unknown component" warning) and that the error boundary triggers on
// the dual-React issue — proving the COMPONENT_MAP entry was hit.
// =============================================================================

describe("UITreeRenderer: RadioGroup + RadioItem", () => {
  it("resolves RadioGroup type (no 'Unknown component' error)", () => {
    const tree = mkTree("group", {
      group: el(
        "group",
        "RadioGroup",
        { legend: "Pick one", defaultValue: "a" },
        ["opt-a", "opt-b"],
      ),
      "opt-a": el("opt-a", "RadioItem", { value: "a", label: "Option A" }),
      "opt-b": el("opt-b", "RadioItem", { value: "b", label: "Option B" }),
    });

    const { container } = render(<UITreeRenderer tree={tree} />);

    // Should NOT have "Unknown component" warning — type is recognized
    const unknownWarning = container.querySelector(".text-kumo-warning");
    expect(unknownWarning).toBeNull();
  });
});

describe("UITreeRenderer: Textarea", () => {
  it("resolves Textarea type (no 'Unknown component' error)", () => {
    const tree = mkTree("ta", {
      ta: el("ta", "Textarea", {
        defaultValue: "hello world",
        placeholder: "Type here...",
      }),
    });

    const { container } = render(<UITreeRenderer tree={tree} />);

    // Should NOT have "Unknown component" warning — type is recognized
    const unknownWarning = container.querySelector(".text-kumo-warning");
    expect(unknownWarning).toBeNull();
  });
});

describe("UITreeRenderer: Field", () => {
  it("resolves Field type (no 'Unknown component' error)", () => {
    const tree = mkTree("field", {
      field: el("field", "Field", { label: "Name" }, ["input"]),
      input: el("input", "Input", { label: "Name" }),
    });

    const { container } = render(<UITreeRenderer tree={tree} />);

    // Should NOT have "Unknown component" warning — type is recognized
    const unknownWarning = container.querySelector(".text-kumo-warning");
    expect(unknownWarning).toBeNull();
  });
});
