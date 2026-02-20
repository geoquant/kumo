import { describe, it, expect } from "vitest";
import { normalizeSiblingFormRowGrids } from "../core/UITreeRenderer";
import type { UITree, UIElement } from "../core/types";

function el(
  key: string,
  type: string,
  props: Record<string, unknown> = {},
  children?: string[],
): UIElement {
  const element: UIElement = { key, type, props };
  if (children) element.children = children;
  return element;
}

describe("layout normalization", () => {
  it("coerces mixed form row Grid variants to 2up", () => {
    const tree: UITree = {
      root: "form",
      elements: {
        // Use Div to avoid relying on kumo layout components in tests.
        // Div is a renderer-only synthetic container.
        form: el("form", "Div", {}, ["row-a", "row-b"]),
        "row-a": el("row-a", "Grid", { variant: "side-by-side", gap: "base" }, [
          "a-1",
          "a-2",
        ]),
        "row-b": el("row-b", "Grid", { variant: "2-1", gap: "base" }, [
          "b-1",
          "b-2",
        ]),
        "a-1": el("a-1", "Input", { label: "Left A" }),
        "a-2": el("a-2", "Input", { label: "Right A" }),
        "b-1": el("b-1", "Input", { label: "Left B" }),
        "b-2": el("b-2", "Input", { label: "Right B" }),
      },
    };

    const normalized = normalizeSiblingFormRowGrids(tree);
    const rowA = normalized.elements["row-a"];
    const rowB = normalized.elements["row-b"];

    expect(rowA?.props["variant"]).toBe("2up");
    expect(rowB?.props["variant"]).toBe("2up");
  });
});
