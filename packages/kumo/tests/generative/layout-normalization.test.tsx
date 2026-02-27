import { describe, it, expect } from "vitest";
import {
  normalizeSiblingFormRowGrids,
  normalizeEmptySelects,
  normalizeNestedSurfaces,
  normalizeCounterStacks,
  normalizeFormActionBars,
  normalizeDuplicateFieldLabels,
  normalizeCheckboxGroupGrids,
  normalizePropsChildrenToStructural,
} from "../../src/generative/ui-tree-renderer";
import type { UITree, UIElement } from "../../src/streaming/types";

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

  it("coerces empty Select into Input", () => {
    const tree: UITree = {
      root: "form",
      elements: {
        form: el("form", "Div", {}, ["frequency"]),
        frequency: el("frequency", "Select", { label: "Email frequency" }),
      },
    };

    const normalized = normalizeEmptySelects(tree);
    expect(normalized.elements["frequency"]?.type).toBe("Input");
  });

  it("lifts inner Surface children to avoid double borders", () => {
    const tree: UITree = {
      root: "outer",
      elements: {
        outer: el("outer", "Surface", {}, ["inner"]),
        inner: el("inner", "Surface", {}, ["stack"]),
        stack: el("stack", "Stack", { gap: "lg" }, ["title"]),
        title: el("title", "Text", { children: "Hi" }),
      },
    };

    const normalized = normalizeNestedSurfaces(tree);
    expect(normalized.elements["outer"]?.children).toEqual(["stack"]);
  });

  it("centers counter Stack when it has increment/decrement actions", () => {
    const tree: UITree = {
      root: "card",
      elements: {
        card: el("card", "Surface", {}, ["stack"]),
        stack: el("stack", "Stack", { gap: "lg" }, [
          "title",
          "count",
          "actions",
        ]),
        title: el("title", "Text", {
          children: "Counter",
          variant: "heading2",
        }),
        count: el("count", "Text", { children: "0", variant: "heading1" }),
        actions: el("actions", "Cluster", { gap: "sm" }, ["dec", "inc"]),
        dec: {
          key: "dec",
          type: "Button",
          props: { children: "Decrement" },
          action: { name: "decrement", params: { target: "count" } },
          parentKey: "actions",
        },
        inc: {
          key: "inc",
          type: "Button",
          props: { children: "Increment" },
          action: { name: "increment", params: { target: "count" } },
          parentKey: "actions",
        },
      },
    };

    const normalized = normalizeCounterStacks(tree);
    expect(normalized.elements["stack"]?.props["align"]).toBe("center");
    expect(normalized.elements["actions"]?.props["justify"]).toBe("center");
  });

  it("right-aligns submit button in a form stack", () => {
    const tree: UITree = {
      root: "card",
      elements: {
        card: el("card", "Surface", {}, ["stack"]),
        stack: el("stack", "Stack", { gap: "lg" }, ["name", "submit"]),
        name: el("name", "Input", { label: "Name" }),
        submit: {
          key: "submit",
          type: "Button",
          props: { children: "Save", variant: "primary" },
          action: { name: "submit_form", params: { form_type: "x" } },
          parentKey: "stack",
        },
      },
    };

    const normalized = normalizeFormActionBars(tree);
    const className = normalized.elements["submit"]?.props["className"];
    expect(typeof className).toBe("string");
    expect(String(className)).toContain("w-full");
    expect(String(className)).toContain("sm:self-end");
  });

  it("right-aligns action Cluster in a form stack", () => {
    const tree: UITree = {
      root: "card",
      elements: {
        card: el("card", "Surface", {}, ["stack"]),
        stack: el("stack", "Stack", { gap: "lg" }, ["name", "actions"]),
        name: el("name", "Input", { label: "Name" }),
        actions: el("actions", "Cluster", { gap: "sm" }, ["cancel", "save"]),
        cancel: el("cancel", "Button", {
          children: "Cancel",
          variant: "secondary",
        }),
        save: {
          key: "save",
          type: "Button",
          props: { children: "Save", variant: "primary" },
          action: { name: "submit_form", params: { form_type: "x" } },
          parentKey: "actions",
        },
      },
    };

    const normalized = normalizeFormActionBars(tree);
    expect(normalized.elements["actions"]?.props["justify"]).toBe("end");
    const className = normalized.elements["actions"]?.props["className"];
    expect(String(className)).toContain("w-full");
  });

  it("drops duplicate Text label before a labeled Input", () => {
    const tree: UITree = {
      root: "card",
      elements: {
        card: el("card", "Surface", {}, ["stack"]),
        stack: el("stack", "Stack", { gap: "lg" }, ["l1", "name"]),
        l1: el("l1", "Text", { children: "Full name" }),
        name: el("name", "Input", { label: "Full name", placeholder: "X" }),
      },
    };

    const normalized = normalizeDuplicateFieldLabels(tree);
    expect(normalized.elements["stack"]?.children).toEqual(["name"]);
  });

  it("coerces checkbox-group Grid into a vertical Stack", () => {
    const tree: UITree = {
      root: "card",
      elements: {
        card: el("card", "Surface", {}, ["stack"]),
        stack: el("stack", "Stack", { gap: "lg" }, ["row"]),
        row: el("row", "Grid", { variant: "2up", gap: "base" }, [
          "label",
          "choices",
        ]),
        label: el("label", "Text", { children: "Notification channels" }),
        choices: el("choices", "Stack", { gap: "sm" }, ["a", "b"]),
        a: el("a", "Checkbox", { label: "Email" }),
        b: el("b", "Checkbox", { label: "SMS" }),
      },
    };

    const normalized = normalizeCheckboxGroupGrids(tree);
    expect(normalized.elements["row"]?.type).toBe("Stack");
    expect(normalized.elements["row"]?.children).toEqual(["label", "choices"]);
  });
});

describe("normalizePropsChildrenToStructural", () => {
  it("moves element-key arrays from props.children to structural children", () => {
    // Reproduces the exact LLM mistake: Select has option keys in props.children
    const tree: UITree = {
      root: "form",
      elements: {
        form: el("form", "Div", {}, ["frequency"]),
        frequency: {
          key: "frequency",
          type: "Select",
          props: {
            label: "Email frequency",
            placeholder: "Choose",
            children: ["freq-rt", "freq-daily", "freq-weekly"],
          },
          parentKey: "form",
        },
        "freq-rt": el("freq-rt", "SelectOption", {
          value: "realtime",
          children: "Real-time",
        }),
        "freq-daily": el("freq-daily", "SelectOption", {
          value: "daily",
          children: "Daily",
        }),
        "freq-weekly": el("freq-weekly", "SelectOption", {
          value: "weekly",
          children: "Weekly",
        }),
      },
    };

    const normalized = normalizePropsChildrenToStructural(tree);
    const freq = normalized.elements["frequency"];

    // Keys moved to structural children
    expect(freq?.children).toEqual(["freq-rt", "freq-daily", "freq-weekly"]);
    // Array removed from props
    expect(freq?.props["children"]).toBeUndefined();
    // Other props preserved
    expect(freq?.props["label"]).toBe("Email frequency");
    expect(freq?.props["placeholder"]).toBe("Choose");
  });

  it("merges with existing structural children without duplicates", () => {
    const tree: UITree = {
      root: "form",
      elements: {
        form: el("form", "Div", {}, ["sel"]),
        sel: {
          key: "sel",
          type: "Select",
          props: { label: "Pick", children: ["opt-a", "opt-b"] },
          children: ["opt-a"],
        },
        "opt-a": el("opt-a", "SelectOption", { value: "a", children: "A" }),
        "opt-b": el("opt-b", "SelectOption", { value: "b", children: "B" }),
      },
    };

    const normalized = normalizePropsChildrenToStructural(tree);
    expect(normalized.elements["sel"]?.children).toEqual(["opt-a", "opt-b"]);
  });

  it("is a no-op when props.children is a scalar string", () => {
    const tree: UITree = {
      root: "card",
      elements: {
        card: el("card", "Div", {}, ["title"]),
        title: el("title", "Text", { children: "Hello", variant: "heading2" }),
      },
    };

    const normalized = normalizePropsChildrenToStructural(tree);
    // Identity — no changes
    expect(normalized).toBe(tree);
  });

  it("is a no-op when props.children array contains no element keys", () => {
    const tree: UITree = {
      root: "card",
      elements: {
        card: el("card", "Div", {}, ["badge"]),
        badge: el("badge", "Badge", { children: ["not-a-key"] }),
      },
    };

    const normalized = normalizePropsChildrenToStructural(tree);
    expect(normalized).toBe(tree);
  });
});
