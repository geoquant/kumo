import { describe, it, expect } from "vitest";
import { actionToPatch } from "../core/action-patch-bridge";
import type { ActionEvent } from "../core/action-handler";
import type { UITree } from "../core/types";

// =============================================================================
// Helpers
// =============================================================================

function event(actionName: string, sourceKey = "btn"): ActionEvent {
  return { actionName, sourceKey };
}

function treeWithCount(children: unknown): UITree {
  return {
    root: "card",
    elements: {
      card: {
        key: "card",
        type: "Surface",
        props: {},
        children: ["count-display"],
      },
      "count-display": {
        key: "count-display",
        type: "Text",
        props: { children, variant: "heading1" },
        parentKey: "card",
      },
    },
  };
}

const EMPTY_TREE: UITree = { root: "", elements: {} };

// =============================================================================
// actionToPatch
// =============================================================================

describe("actionToPatch", () => {
  describe("increment", () => {
    it("returns replace op incrementing count-display text by 1", () => {
      const patch = actionToPatch(event("increment"), treeWithCount("5"));

      expect(patch).toEqual({
        op: "replace",
        path: "/elements/count-display/props/children",
        value: "6",
      });
    });

    it("increments from zero", () => {
      const patch = actionToPatch(event("increment"), treeWithCount("0"));

      expect(patch).toEqual({
        op: "replace",
        path: "/elements/count-display/props/children",
        value: "1",
      });
    });

    it("increments negative values", () => {
      const patch = actionToPatch(event("increment"), treeWithCount("-3"));

      expect(patch).toEqual({
        op: "replace",
        path: "/elements/count-display/props/children",
        value: "-2",
      });
    });
  });

  describe("decrement", () => {
    it("returns replace op decrementing count-display text by 1", () => {
      const patch = actionToPatch(event("decrement"), treeWithCount("5"));

      expect(patch).toEqual({
        op: "replace",
        path: "/elements/count-display/props/children",
        value: "4",
      });
    });

    it("decrements past zero", () => {
      const patch = actionToPatch(event("decrement"), treeWithCount("0"));

      expect(patch).toEqual({
        op: "replace",
        path: "/elements/count-display/props/children",
        value: "-1",
      });
    });
  });

  describe("unknown actions", () => {
    it("returns null for unrecognized action names", () => {
      expect(
        actionToPatch(event("submit_form"), treeWithCount("5")),
      ).toBeNull();
    });

    it("returns null for empty action name", () => {
      expect(actionToPatch(event(""), treeWithCount("5"))).toBeNull();
    });
  });

  describe("missing count-display element", () => {
    it("returns null when tree has no count-display", () => {
      expect(actionToPatch(event("increment"), EMPTY_TREE)).toBeNull();
    });

    it("returns null when tree has other elements but no count-display", () => {
      const tree: UITree = {
        root: "card",
        elements: {
          card: { key: "card", type: "Surface", props: {}, children: [] },
        },
      };
      expect(actionToPatch(event("increment"), tree)).toBeNull();
    });
  });

  describe("non-numeric text", () => {
    it("defaults to 0 then increments for non-numeric children", () => {
      const patch = actionToPatch(event("increment"), treeWithCount("hello"));

      expect(patch).toEqual({
        op: "replace",
        path: "/elements/count-display/props/children",
        value: "1",
      });
    });

    it("defaults to 0 then decrements for non-numeric children", () => {
      const patch = actionToPatch(event("decrement"), treeWithCount("abc"));

      expect(patch).toEqual({
        op: "replace",
        path: "/elements/count-display/props/children",
        value: "-1",
      });
    });

    it("handles numeric props.children (number type)", () => {
      const patch = actionToPatch(event("increment"), treeWithCount(42));

      expect(patch).toEqual({
        op: "replace",
        path: "/elements/count-display/props/children",
        value: "43",
      });
    });

    it("defaults to 0 for null children", () => {
      const patch = actionToPatch(event("increment"), treeWithCount(null));

      expect(patch).toEqual({
        op: "replace",
        path: "/elements/count-display/props/children",
        value: "1",
      });
    });

    it("defaults to 0 for undefined children", () => {
      const patch = actionToPatch(event("increment"), treeWithCount(undefined));

      expect(patch).toEqual({
        op: "replace",
        path: "/elements/count-display/props/children",
        value: "1",
      });
    });
  });
});
