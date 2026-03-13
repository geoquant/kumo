import { describe, expect, it } from "vitest";

import { validateEditableTree } from "~/lib/playground/validate-tree";

const VALID_TREE = {
  root: "surface",
  elements: {
    surface: {
      key: "surface",
      type: "Surface",
      props: { heading: "Playground" },
      children: ["stack"],
    },
    stack: {
      key: "stack",
      type: "Stack",
      props: { gap: "md" },
      children: ["body"],
      parentKey: "surface",
    },
    body: {
      key: "body",
      type: "Text",
      props: { children: "Ready" },
      parentKey: "stack",
    },
  },
};

describe("validateEditableTree", () => {
  it("accepts valid kumo trees", async () => {
    const result = await validateEditableTree(JSON.stringify(VALID_TREE), {});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.tree.root).toBe("surface");
      expect(result.tree.elements.body?.props).toEqual({ children: "Ready" });
    }
  });

  it("returns structured issues for malformed json", async () => {
    const result = await validateEditableTree("{not-json", {});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues[0]?.path).toEqual([]);
      expect(result.issues[0]?.message).toMatch(/json|unexpected/i);
    }
  });

  it("returns validation issues for invalid tree shapes", async () => {
    const result = await validateEditableTree(
      JSON.stringify({
        root: "bad",
        elements: {
          bad: {
            key: "bad",
            type: "DefinitelyNotARealComponent",
            props: {},
          },
        },
      }),
      {},
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });

  it("accepts playground custom components when provided", async () => {
    const result = await validateEditableTree(
      JSON.stringify({
        root: "surface",
        elements: {
          surface: {
            key: "surface",
            type: "Surface",
            props: {},
            children: ["chart"],
          },
          chart: {
            key: "chart",
            type: "PieChart",
            props: { title: "Traffic mix", variant: "donut" },
            parentKey: "surface",
          },
        },
      }),
      {
        PieChart: {
          component: "span",
          description: "Playground-only pie chart",
          props: {
            title: { type: "string", optional: true },
            variant: {
              type: "string",
              values: ["pie", "donut"],
              optional: true,
            },
          },
        },
      },
    );

    expect(result.success).toBe(true);
  });
});
