import { describe, it, expect } from "vitest";
import {
  applyTreePatch,
  applyDataPatch,
  EMPTY_TREE,
  type UITreePatch,
} from "../core/patches";
import type { UITree, UIElement } from "../core/types";

// =============================================================================
// Helpers
// =============================================================================

function el(
  key: string,
  type: string,
  props: Record<string, unknown> = {},
  children?: string[],
  parentKey?: string | null,
): UIElement {
  const element: UIElement = { key, type, props };
  if (children) element.children = children;
  if (parentKey !== undefined) element.parentKey = parentKey;
  return element;
}

function tree(root: string, elements: Record<string, UIElement>): UITree {
  return { root, elements };
}

// =============================================================================
// upsertElements
// =============================================================================

describe("applyTreePatch: upsertElements", () => {
  it("adds new elements", () => {
    const btn = el("btn-1", "Button", { children: "Click" });
    const result = applyTreePatch(EMPTY_TREE, {
      type: "upsertElements",
      elements: { "btn-1": btn },
    });
    expect(result.elements["btn-1"]).toBe(btn);
  });

  it("preserves identity of unchanged elements", () => {
    const existing = el("text-1", "Text", { children: "Hello" });
    const prev = tree("text-1", { "text-1": existing });

    const newBtn = el("btn-1", "Button", { children: "Click" });
    const result = applyTreePatch(prev, {
      type: "upsertElements",
      elements: { "btn-1": newBtn },
    });

    expect(result.elements["text-1"]).toBe(existing); // Reference preserved
    expect(result.elements["btn-1"]).toBe(newBtn);
  });

  it("returns same tree when upserting identical elements", () => {
    const btn = el("btn-1", "Button", { children: "Click" });
    const prev = tree("btn-1", { "btn-1": btn });

    const result = applyTreePatch(prev, {
      type: "upsertElements",
      elements: { "btn-1": btn }, // Same reference
    });

    expect(result).toBe(prev); // No change
  });

  it("replaces existing elements with new references", () => {
    const oldBtn = el("btn-1", "Button", { children: "Old" });
    const prev = tree("btn-1", { "btn-1": oldBtn });

    const newBtn = el("btn-1", "Button", { children: "New" });
    const result = applyTreePatch(prev, {
      type: "upsertElements",
      elements: { "btn-1": newBtn },
    });

    expect(result.elements["btn-1"]).toBe(newBtn);
    expect(result).not.toBe(prev);
  });

  it("handles empty elements map", () => {
    const prev = tree("r", { r: el("r", "Surface") });
    const result = applyTreePatch(prev, {
      type: "upsertElements",
      elements: {},
    });
    expect(result).toBe(prev);
  });
});

// =============================================================================
// deleteElements
// =============================================================================

describe("applyTreePatch: deleteElements", () => {
  it("removes elements", () => {
    const prev = tree("root", {
      root: el("root", "Surface", {}, ["child"]),
      child: el("child", "Text", {}, undefined, "root"),
    });

    const result = applyTreePatch(prev, {
      type: "deleteElements",
      keys: ["child"],
    });

    expect(result.elements["child"]).toBeUndefined();
    expect(result.elements["root"]!.children).toEqual([]);
  });

  it("recursively removes descendants", () => {
    const prev = tree("root", {
      root: el("root", "Surface", {}, ["parent"]),
      parent: el("parent", "Surface", {}, ["child1", "child2"], "root"),
      child1: el("child1", "Text", {}, undefined, "parent"),
      child2: el("child2", "Text", {}, undefined, "parent"),
    });

    const result = applyTreePatch(prev, {
      type: "deleteElements",
      keys: ["parent"],
    });

    expect(result.elements["parent"]).toBeUndefined();
    expect(result.elements["child1"]).toBeUndefined();
    expect(result.elements["child2"]).toBeUndefined();
    expect(result.elements["root"]!.children).toEqual([]);
  });

  it("throws when deleting root", () => {
    const prev = tree("root", { root: el("root", "Surface") });

    expect(() =>
      applyTreePatch(prev, { type: "deleteElements", keys: ["root"] }),
    ).toThrow('Cannot delete root element "root"');
  });

  it("returns same tree when deleting nonexistent keys", () => {
    const prev = tree("root", { root: el("root", "Surface") });
    const result = applyTreePatch(prev, {
      type: "deleteElements",
      keys: ["nonexistent"],
    });
    expect(result).toBe(prev);
  });

  it("handles empty keys array", () => {
    const prev = tree("root", { root: el("root", "Surface") });
    const result = applyTreePatch(prev, {
      type: "deleteElements",
      keys: [],
    });
    expect(result).toBe(prev);
  });
});

// =============================================================================
// appendChildren
// =============================================================================

describe("applyTreePatch: appendChildren", () => {
  it("appends children to parent", () => {
    const prev = tree("root", {
      root: el("root", "Surface"),
      child: el("child", "Text"),
    });

    const result = applyTreePatch(prev, {
      type: "appendChildren",
      parentKey: "root",
      childKeys: ["child"],
    });

    expect(result.elements["root"]!.children).toEqual(["child"]);
    expect(result.elements["child"]!.parentKey).toBe("root");
  });

  it("creates children array if it doesn't exist", () => {
    const prev = tree("root", {
      root: el("root", "Surface"),
      child: el("child", "Text"),
    });

    const result = applyTreePatch(prev, {
      type: "appendChildren",
      parentKey: "root",
      childKeys: ["child"],
    });

    expect(result.elements["root"]!.children).toEqual(["child"]);
  });

  it("throws for nonexistent parent", () => {
    const prev = tree("root", { root: el("root", "Surface") });

    expect(() =>
      applyTreePatch(prev, {
        type: "appendChildren",
        parentKey: "nonexistent",
        childKeys: ["root"],
      }),
    ).toThrow('Parent element "nonexistent" not found');
  });

  it("throws for nonexistent child", () => {
    const prev = tree("root", { root: el("root", "Surface") });

    expect(() =>
      applyTreePatch(prev, {
        type: "appendChildren",
        parentKey: "root",
        childKeys: ["nonexistent"],
      }),
    ).toThrow('Element "nonexistent" not found');
  });

  it("throws when child already has a different parent", () => {
    const prev = tree("root", {
      root: el("root", "Surface", {}, ["child"]),
      other: el("other", "Surface"),
      child: el("child", "Text", {}, undefined, "root"),
    });

    expect(() =>
      applyTreePatch(prev, {
        type: "appendChildren",
        parentKey: "other",
        childKeys: ["child"],
      }),
    ).toThrow('Element "child" already has parent "root"');
  });

  it("allows appending child already under same parent (idempotent-ish)", () => {
    const prev = tree("root", {
      root: el("root", "Surface", {}, ["child"]),
      child: el("child", "Text", {}, undefined, "root"),
    });

    // This adds a duplicate -- the caller should handle dedup if needed
    const result = applyTreePatch(prev, {
      type: "appendChildren",
      parentKey: "root",
      childKeys: ["child"],
    });

    expect(result.elements["root"]!.children).toEqual(["child", "child"]);
  });

  it("handles empty childKeys", () => {
    const prev = tree("root", { root: el("root", "Surface") });
    const result = applyTreePatch(prev, {
      type: "appendChildren",
      parentKey: "root",
      childKeys: [],
    });
    expect(result).toBe(prev);
  });
});

// =============================================================================
// removeChildren
// =============================================================================

describe("applyTreePatch: removeChildren", () => {
  it("removes children from parent", () => {
    const prev = tree("root", {
      root: el("root", "Surface", {}, ["child1", "child2"]),
      child1: el("child1", "Text", {}, undefined, "root"),
      child2: el("child2", "Text", {}, undefined, "root"),
    });

    const result = applyTreePatch(prev, {
      type: "removeChildren",
      parentKey: "root",
      childKeys: ["child1"],
    });

    expect(result.elements["root"]!.children).toEqual(["child2"]);
    // Removed child still exists in elements (orphaned, not deleted)
    expect(result.elements["child1"]).toBeDefined();
  });

  it("is idempotent for absent children", () => {
    const prev = tree("root", {
      root: el("root", "Surface", {}, ["child"]),
      child: el("child", "Text"),
    });

    const result = applyTreePatch(prev, {
      type: "removeChildren",
      parentKey: "root",
      childKeys: ["nonexistent"],
    });

    expect(result).toBe(prev);
  });

  it("leaves empty array (not undefined) after removing all children", () => {
    const prev = tree("root", {
      root: el("root", "Surface", {}, ["child"]),
      child: el("child", "Text"),
    });

    const result = applyTreePatch(prev, {
      type: "removeChildren",
      parentKey: "root",
      childKeys: ["child"],
    });

    expect(result.elements["root"]!.children).toEqual([]);
  });

  it("handles empty childKeys", () => {
    const prev = tree("root", { root: el("root", "Surface") });
    const result = applyTreePatch(prev, {
      type: "removeChildren",
      parentKey: "root",
      childKeys: [],
    });
    expect(result).toBe(prev);
  });
});

// =============================================================================
// setRoot
// =============================================================================

describe("applyTreePatch: setRoot", () => {
  it("changes the root element", () => {
    const prev = tree("old-root", {
      "old-root": el("old-root", "Surface"),
      "new-root": el("new-root", "Surface"),
    });

    const result = applyTreePatch(prev, {
      type: "setRoot",
      root: "new-root",
    });

    expect(result.root).toBe("new-root");
  });

  it("returns same tree when root is unchanged", () => {
    const prev = tree("root", { root: el("root", "Surface") });
    const result = applyTreePatch(prev, { type: "setRoot", root: "root" });
    expect(result).toBe(prev);
  });

  it("throws for nonexistent root in non-empty tree", () => {
    const prev = tree("root", { root: el("root", "Surface") });

    expect(() =>
      applyTreePatch(prev, { type: "setRoot", root: "nonexistent" }),
    ).toThrow('Cannot set root to nonexistent element "nonexistent"');
  });

  it("allows setting root on empty tree", () => {
    const result = applyTreePatch(EMPTY_TREE, {
      type: "setRoot",
      root: "new-root",
    });
    expect(result.root).toBe("new-root");
  });
});

// =============================================================================
// replaceTree
// =============================================================================

describe("applyTreePatch: replaceTree", () => {
  it("replaces entire tree", () => {
    const newTree = tree("new", { new: el("new", "Button") });
    const result = applyTreePatch(EMPTY_TREE, {
      type: "replaceTree",
      tree: newTree,
    });
    expect(result).toBe(newTree);
  });
});

// =============================================================================
// batch
// =============================================================================

describe("applyTreePatch: batch", () => {
  it("applies multiple patches sequentially", () => {
    const patches: UITreePatch[] = [
      {
        type: "upsertElements",
        elements: {
          root: el("root", "Surface"),
          btn: el("btn", "Button", { children: "Click" }),
        },
      },
      { type: "setRoot", root: "root" },
      { type: "appendChildren", parentKey: "root", childKeys: ["btn"] },
    ];

    const result = applyTreePatch(EMPTY_TREE, {
      type: "batch",
      patches,
    });

    expect(result.root).toBe("root");
    expect(result.elements["root"]!.children).toEqual(["btn"]);
    expect(result.elements["btn"]!.parentKey).toBe("root");
  });

  it("rolls back on failure (returns original tree)", () => {
    const prev = tree("root", { root: el("root", "Surface") });

    expect(() =>
      applyTreePatch(prev, {
        type: "batch",
        patches: [
          {
            type: "upsertElements",
            elements: { new: el("new", "Text") },
          },
          { type: "deleteElements", keys: ["root"] }, // This will throw
        ],
      }),
    ).toThrow();
  });

  it("handles empty batch", () => {
    const prev = tree("root", { root: el("root", "Surface") });
    const result = applyTreePatch(prev, { type: "batch", patches: [] });
    expect(result).toBe(prev);
  });
});

// =============================================================================
// applyDataPatch
// =============================================================================

describe("applyDataPatch", () => {
  it("sets data at path", () => {
    const prev = { user: { name: "Alice" } };
    const result = applyDataPatch(prev, {
      type: "setData",
      path: "/user/name",
      value: "Bob",
    });

    expect(result).toEqual({ user: { name: "Bob" } });
    // Immutable: original unchanged
    expect(prev.user.name).toBe("Alice");
  });

  it("creates intermediate objects", () => {
    const result = applyDataPatch({}, {
      type: "setData",
      path: "/user/profile/age",
      value: 30,
    });

    expect(result).toEqual({ user: { profile: { age: 30 } } });
  });

  it("replaces entire data model", () => {
    const newData = { count: 42 };
    const result = applyDataPatch({ old: true }, {
      type: "replaceData",
      data: newData,
    });

    expect(result).toBe(newData);
  });

  it("ignores tree-only patches", () => {
    const prev = { x: 1 };
    const result = applyDataPatch(prev, {
      type: "upsertElements",
      elements: {},
    });
    expect(result).toBe(prev);
  });

  it("processes batch data patches", () => {
    const result = applyDataPatch({}, {
      type: "batch",
      patches: [
        { type: "setData", path: "/a", value: 1 },
        { type: "setData", path: "/b", value: 2 },
      ],
    });

    expect(result).toEqual({ a: 1, b: 2 });
  });
});

// =============================================================================
// Purity / No Mutation
// =============================================================================

describe("applyTreePatch: purity", () => {
  it("never mutates the input tree", () => {
    const original = tree("root", {
      root: el("root", "Surface", {}, ["child"]),
      child: el("child", "Text", { children: "Hello" }, undefined, "root"),
    });

    // Deep freeze to detect mutations
    const frozen = JSON.parse(JSON.stringify(original));

    applyTreePatch(original, {
      type: "upsertElements",
      elements: { new: el("new", "Button") },
    });

    expect(JSON.parse(JSON.stringify(original))).toEqual(frozen);
  });
});
