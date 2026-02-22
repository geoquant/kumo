import { describe, it, expect } from "vitest";
import {
  applyPatch,
  parsePatchLine,
  type JsonPatchOp,
} from "@/streaming/rfc6902";
import type { UITree, UIElement } from "@/streaming/types";

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

const EMPTY: UITree = { root: "", elements: {} };

// =============================================================================
// applyPatch: add to /root
// =============================================================================

describe("applyPatch: add /root", () => {
  it("sets root field on empty tree", () => {
    const patch: JsonPatchOp = { op: "add", path: "/root", value: "card-1" };
    const result = applyPatch(EMPTY, patch);
    expect(result.root).toBe("card-1");
  });

  it("returns a new object (not same reference)", () => {
    const patch: JsonPatchOp = { op: "add", path: "/root", value: "card-1" };
    const result = applyPatch(EMPTY, patch);
    expect(result).not.toBe(EMPTY);
  });
});

// =============================================================================
// applyPatch: add to /elements/{key}
// =============================================================================

describe("applyPatch: add /elements/{key}", () => {
  it("adds an element to the elements map", () => {
    const element = el("card-1", "Surface", { variant: "card" }, ["text-1"]);
    const patch: JsonPatchOp = {
      op: "add",
      path: "/elements/card-1",
      value: element,
    };
    const result = applyPatch(EMPTY, patch);
    expect(result.elements["card-1"]).toEqual(element);
  });

  it("preserves existing elements when adding new ones", () => {
    const prev: UITree = {
      root: "card-1",
      elements: {
        "card-1": el("card-1", "Surface", {}, ["text-1"]),
      },
    };
    const textEl = el("text-1", "Text", { children: "Hello" });
    const patch: JsonPatchOp = {
      op: "add",
      path: "/elements/text-1",
      value: textEl,
    };
    const result = applyPatch(prev, patch);
    expect(result.elements["card-1"]).toBeDefined();
    expect(result.elements["text-1"]).toEqual(textEl);
  });
});

// =============================================================================
// applyPatch: add with /- suffix (array append)
// =============================================================================

describe("applyPatch: add with /- (array append)", () => {
  it("appends to children array using /- suffix", () => {
    const prev: UITree = {
      root: "card",
      elements: {
        card: el("card", "Surface", {}, ["text-1"]),
        "text-1": el("text-1", "Text", { children: "First" }),
      },
    };
    const patch: JsonPatchOp = {
      op: "add",
      path: "/elements/card/children/-",
      value: "text-2",
    };
    const result = applyPatch(prev, patch);
    expect(result.elements["card"]?.children).toEqual(["text-1", "text-2"]);
  });

  it("creates array and appends when children is undefined", () => {
    const prev: UITree = {
      root: "card",
      elements: {
        card: el("card", "Surface"),
      },
    };
    const patch: JsonPatchOp = {
      op: "add",
      path: "/elements/card/children/-",
      value: "text-1",
    };
    const result = applyPatch(prev, patch);
    expect(result.elements["card"]?.children).toEqual(["text-1"]);
  });
});

// =============================================================================
// applyPatch: replace
// =============================================================================

describe("applyPatch: replace", () => {
  it("overwrites an existing value at path", () => {
    const prev: UITree = {
      root: "card",
      elements: {
        card: el("card", "Surface", { variant: "card" }),
      },
    };
    const newElement = el("card", "Surface", { variant: "elevated" });
    const patch: JsonPatchOp = {
      op: "replace",
      path: "/elements/card",
      value: newElement,
    };
    const result = applyPatch(prev, patch);
    expect(result.elements["card"]).toEqual(newElement);
  });

  it("replaces root value", () => {
    const prev: UITree = {
      root: "old",
      elements: { old: el("old", "Surface"), new: el("new", "Surface") },
    };
    const patch: JsonPatchOp = {
      op: "replace",
      path: "/root",
      value: "new",
    };
    const result = applyPatch(prev, patch);
    expect(result.root).toBe("new");
  });

  it("replaces nested property within element", () => {
    const prev: UITree = {
      root: "card",
      elements: {
        card: el("card", "Surface", { variant: "card", children: "Old text" }),
      },
    };
    const patch: JsonPatchOp = {
      op: "replace",
      path: "/elements/card/props",
      value: { variant: "elevated", children: "New text" },
    };
    const result = applyPatch(prev, patch);
    expect(result.elements["card"]?.props).toEqual({
      variant: "elevated",
      children: "New text",
    });
  });
});

// =============================================================================
// applyPatch: remove
// =============================================================================

describe("applyPatch: remove", () => {
  it("deletes an element at path", () => {
    const prev: UITree = {
      root: "card",
      elements: {
        card: el("card", "Surface"),
        text: el("text", "Text"),
      },
    };
    const patch: JsonPatchOp = { op: "remove", path: "/elements/text" };
    const result = applyPatch(prev, patch);
    expect(result.elements["text"]).toBeUndefined();
    expect(result.elements["card"]).toBeDefined();
  });

  it("is a no-op when removing nonexistent path", () => {
    const prev: UITree = {
      root: "card",
      elements: {
        card: el("card", "Surface"),
      },
    };
    const patch: JsonPatchOp = {
      op: "remove",
      path: "/elements/nonexistent",
    };
    const result = applyPatch(prev, patch);
    // Should not throw, returns shallow copy
    expect(result.elements["card"]).toBeDefined();
  });
});

// =============================================================================
// applyPatch: invalid path handling
// =============================================================================

describe("applyPatch: edge cases", () => {
  it("handles empty path for add (returns shallow copy)", () => {
    const patch: JsonPatchOp = { op: "add", path: "", value: "irrelevant" };
    const result = applyPatch(EMPTY, patch);
    expect(result).not.toBe(EMPTY);
    expect(result).toEqual(EMPTY);
  });

  it("handles root-only path /", () => {
    const patch: JsonPatchOp = { op: "add", path: "/", value: "test" };
    const result = applyPatch(EMPTY, patch);
    // "/" with empty segment → no segments → shallow copy
    expect(result).not.toBe(EMPTY);
  });

  it("handles deeply nested nonexistent path for remove gracefully", () => {
    const prev: UITree = {
      root: "card",
      elements: {
        card: el("card", "Surface"),
      },
    };
    const patch: JsonPatchOp = {
      op: "remove",
      path: "/elements/card/deeply/nested/thing",
    };
    // Should not throw
    const result = applyPatch(prev, patch);
    expect(result.elements["card"]).toBeDefined();
  });
});

// =============================================================================
// applyPatch: immutability
// =============================================================================

describe("applyPatch: immutability", () => {
  it("never mutates the input spec", () => {
    const original: UITree = {
      root: "card",
      elements: {
        card: el("card", "Surface", { variant: "card" }, ["text"]),
        text: el("text", "Text", { children: "Hello" }),
      },
    };
    const snapshot = JSON.parse(JSON.stringify(original));

    // Apply various patches
    applyPatch(original, {
      op: "add",
      path: "/elements/new",
      value: el("new", "Button"),
    });
    applyPatch(original, { op: "replace", path: "/root", value: "new-root" });
    applyPatch(original, { op: "remove", path: "/elements/text" });
    applyPatch(original, {
      op: "add",
      path: "/elements/card/children/-",
      value: "appended",
    });

    expect(JSON.parse(JSON.stringify(original))).toEqual(snapshot);
  });

  it("returns a new shallow copy on every call", () => {
    const prev: UITree = {
      root: "card",
      elements: { card: el("card", "Surface") },
    };

    const r1 = applyPatch(prev, { op: "add", path: "/root", value: "card" });
    const r2 = applyPatch(prev, { op: "add", path: "/root", value: "card" });

    // Both return new objects even if value is the same
    expect(r1).not.toBe(prev);
    expect(r2).not.toBe(prev);
    expect(r1).not.toBe(r2);
  });
});

// =============================================================================
// parsePatchLine
// =============================================================================

describe("parsePatchLine", () => {
  it("parses valid add operation", () => {
    const line = '{"op":"add","path":"/root","value":"card-1"}';
    const result = parsePatchLine(line);
    expect(result).toEqual({ op: "add", path: "/root", value: "card-1" });
  });

  it("parses valid replace operation", () => {
    const line =
      '{"op":"replace","path":"/elements/card","value":{"key":"card","type":"Surface","props":{}}}';
    const result = parsePatchLine(line);
    expect(result).toEqual({
      op: "replace",
      path: "/elements/card",
      value: { key: "card", type: "Surface", props: {} },
    });
  });

  it("parses valid remove operation (no value required)", () => {
    const line = '{"op":"remove","path":"/elements/old"}';
    const result = parsePatchLine(line);
    expect(result).toEqual({ op: "remove", path: "/elements/old" });
  });

  it("returns null for invalid JSON", () => {
    expect(parsePatchLine("{not json}")).toBeNull();
    expect(parsePatchLine("")).toBeNull();
    expect(parsePatchLine("   ")).toBeNull();
  });

  it("returns null for missing op field", () => {
    expect(parsePatchLine('{"path":"/root","value":"x"}')).toBeNull();
  });

  it("returns null for missing path field", () => {
    expect(parsePatchLine('{"op":"add","value":"x"}')).toBeNull();
  });

  it("returns null for unsupported op (move/copy/test)", () => {
    expect(
      parsePatchLine('{"op":"move","path":"/root","from":"/old"}'),
    ).toBeNull();
    expect(
      parsePatchLine('{"op":"copy","path":"/root","from":"/old"}'),
    ).toBeNull();
    expect(
      parsePatchLine('{"op":"test","path":"/root","value":"x"}'),
    ).toBeNull();
  });

  it("returns null for add/replace without value", () => {
    expect(parsePatchLine('{"op":"add","path":"/root"}')).toBeNull();
    expect(parsePatchLine('{"op":"replace","path":"/root"}')).toBeNull();
  });

  it("handles line with surrounding whitespace", () => {
    const line = '  {"op":"add","path":"/root","value":"card"}  ';
    const result = parsePatchLine(line);
    expect(result).toEqual({ op: "add", path: "/root", value: "card" });
  });

  it("returns null for arrays", () => {
    expect(parsePatchLine('[{"op":"add"}]')).toBeNull();
  });

  it("returns null for primitive values", () => {
    expect(parsePatchLine("42")).toBeNull();
    expect(parsePatchLine('"string"')).toBeNull();
    expect(parsePatchLine("true")).toBeNull();
    expect(parsePatchLine("null")).toBeNull();
  });
});

// =============================================================================
// applyPatch: prototype pollution prevention
// =============================================================================

describe("applyPatch: prototype pollution prevention", () => {
  const base: UITree = {
    root: "r",
    elements: { r: el("r", "Surface", { children: "hi" }) },
  };

  it("blocks __proto__ paths — add", () => {
    const result = applyPatch(base, {
      op: "add",
      path: "/__proto__/polluted",
      value: true,
    });
    // Blocked path returns same reference (no-op)
    expect(result).toBe(base);
    // Ensure Object.prototype was not modified
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
  });

  it("blocks constructor paths — add", () => {
    const result = applyPatch(base, {
      op: "add",
      path: "/constructor/polluted",
      value: true,
    });
    expect(result).toBe(base);
  });

  it("blocks prototype paths — add", () => {
    const result = applyPatch(base, {
      op: "add",
      path: "/prototype/polluted",
      value: true,
    });
    expect(result).toBe(base);
  });

  it("blocks __proto__ in nested element paths", () => {
    const result = applyPatch(base, {
      op: "replace",
      path: "/elements/r/__proto__/polluted",
      value: true,
    });
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
    // Blocked path returns same reference (no-op)
    expect(result).toBe(base);
  });

  it("blocks tilde-encoded __proto__ (RFC 6901 ~0 = ~)", () => {
    // __proto__ doesn't contain ~ or / so tilde encoding doesn't help an
    // attacker here, but verify the path is still blocked after decoding.
    const result = applyPatch(base, {
      op: "add",
      path: "/__proto__/evil",
      value: "pwned",
    });
    expect(result).toBe(base);
    expect(({} as Record<string, unknown>)["evil"]).toBeUndefined();
  });

  it("blocks __proto__ via remove op", () => {
    const result = applyPatch(base, {
      op: "remove",
      path: "/__proto__/toString",
    });
    expect(result).toBe(base);
    expect({}.toString).toBeDefined();
  });

  it("blocks __proto__ as element key", () => {
    const result = applyPatch(base, {
      op: "add",
      path: "/elements/__proto__",
      value: { type: "Text", key: "__proto__", props: {}, children: "pwned" },
    });
    expect(result).toBe(base);
    expect(({} as Record<string, unknown>)["type"]).toBeUndefined();
  });
});
