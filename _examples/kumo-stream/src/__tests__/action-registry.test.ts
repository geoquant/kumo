import { describe, it, expect } from "vitest";
import {
  BUILTIN_HANDLERS,
  createHandlerMap,
  dispatchAction,
  type ActionResult,
} from "../core/action-registry";
import type { ActionEvent } from "../core/action-handler";
import type { UITree } from "../core/types";

// =============================================================================
// Helpers
// =============================================================================

function event(
  actionName: string,
  overrides?: Partial<Omit<ActionEvent, "actionName">>,
): ActionEvent {
  return { actionName, sourceKey: "btn", ...overrides };
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
// BUILTIN_HANDLERS — structure
// =============================================================================

describe("BUILTIN_HANDLERS", () => {
  it("contains increment, decrement, submit_form, navigate", () => {
    expect(Object.keys(BUILTIN_HANDLERS).sort()).toEqual([
      "decrement",
      "increment",
      "navigate",
      "submit_form",
    ]);
  });

  it("every handler is a function", () => {
    for (const handler of Object.values(BUILTIN_HANDLERS)) {
      expect(typeof handler).toBe("function");
    }
  });
});

// =============================================================================
// increment handler
// =============================================================================

describe("increment handler", () => {
  it('returns PatchResult with type "patch"', () => {
    const result = BUILTIN_HANDLERS.increment(
      event("increment"),
      treeWithCount("5"),
    );

    expect(result).not.toBeNull();
    expect(result!.type).toBe("patch");
  });

  it("produces correct RFC 6902 replace patch", () => {
    const result = BUILTIN_HANDLERS.increment(
      event("increment"),
      treeWithCount("5"),
    ) as Extract<ActionResult, { type: "patch" }>;

    expect(result.patches).toEqual([
      {
        op: "replace",
        path: "/elements/count-display/props/children",
        value: "6",
      },
    ]);
  });

  it("increments from zero", () => {
    const result = BUILTIN_HANDLERS.increment(
      event("increment"),
      treeWithCount("0"),
    ) as Extract<ActionResult, { type: "patch" }>;

    expect(result.patches[0].value).toBe("1");
  });

  it("increments negative values", () => {
    const result = BUILTIN_HANDLERS.increment(
      event("increment"),
      treeWithCount("-3"),
    ) as Extract<ActionResult, { type: "patch" }>;

    expect(result.patches[0].value).toBe("-2");
  });

  it("returns null when count-display missing", () => {
    const result = BUILTIN_HANDLERS.increment(event("increment"), EMPTY_TREE);
    expect(result).toBeNull();
  });

  it("defaults to 0 for non-numeric text", () => {
    const result = BUILTIN_HANDLERS.increment(
      event("increment"),
      treeWithCount("hello"),
    ) as Extract<ActionResult, { type: "patch" }>;

    expect(result.patches[0].value).toBe("1");
  });

  it("handles numeric children (number type)", () => {
    const result = BUILTIN_HANDLERS.increment(
      event("increment"),
      treeWithCount(42),
    ) as Extract<ActionResult, { type: "patch" }>;

    expect(result.patches[0].value).toBe("43");
  });
});

// =============================================================================
// decrement handler
// =============================================================================

describe("decrement handler", () => {
  it("produces correct decrement patch", () => {
    const result = BUILTIN_HANDLERS.decrement(
      event("decrement"),
      treeWithCount("5"),
    ) as Extract<ActionResult, { type: "patch" }>;

    expect(result.patches).toEqual([
      {
        op: "replace",
        path: "/elements/count-display/props/children",
        value: "4",
      },
    ]);
  });

  it("decrements past zero", () => {
    const result = BUILTIN_HANDLERS.decrement(
      event("decrement"),
      treeWithCount("0"),
    ) as Extract<ActionResult, { type: "patch" }>;

    expect(result.patches[0].value).toBe("-1");
  });

  it("returns null when count-display missing", () => {
    const result = BUILTIN_HANDLERS.decrement(event("decrement"), EMPTY_TREE);
    expect(result).toBeNull();
  });
});

// =============================================================================
// submit_form handler
// =============================================================================

describe("submit_form handler", () => {
  it('returns MessageResult with type "message"', () => {
    const result = BUILTIN_HANDLERS.submit_form(
      event("submit_form", { params: { name: "Alice", email: "a@b.com" } }),
      EMPTY_TREE,
    );

    expect(result).not.toBeNull();
    expect(result!.type).toBe("message");
  });

  it("serializes params into line-separated key-value pairs", () => {
    const result = BUILTIN_HANDLERS.submit_form(
      event("submit_form", { params: { name: "Alice", age: 30 } }),
      EMPTY_TREE,
    ) as Extract<ActionResult, { type: "message" }>;

    expect(result.content).toBe("name: Alice\nage: 30");
  });

  it("falls back to context when params absent", () => {
    const result = BUILTIN_HANDLERS.submit_form(
      event("submit_form", { context: { field1: "value1" } }),
      EMPTY_TREE,
    ) as Extract<ActionResult, { type: "message" }>;

    expect(result.content).toBe("field1: value1");
  });

  it("returns NoneResult when no data provided", () => {
    const result = BUILTIN_HANDLERS.submit_form(
      event("submit_form"),
      EMPTY_TREE,
    );

    expect(result).toEqual({ type: "none" });
  });

  it("returns NoneResult for empty params object", () => {
    const result = BUILTIN_HANDLERS.submit_form(
      event("submit_form", { params: {} }),
      EMPTY_TREE,
    );

    expect(result).toEqual({ type: "none" });
  });
});

// =============================================================================
// navigate handler
// =============================================================================

describe("navigate handler", () => {
  it('returns ExternalResult with type "external"', () => {
    const result = BUILTIN_HANDLERS.navigate(
      event("navigate", { params: { url: "https://example.com" } }),
      EMPTY_TREE,
    );

    expect(result).not.toBeNull();
    expect(result!.type).toBe("external");
  });

  it("includes url from params", () => {
    const result = BUILTIN_HANDLERS.navigate(
      event("navigate", { params: { url: "https://example.com" } }),
      EMPTY_TREE,
    ) as Extract<ActionResult, { type: "external" }>;

    expect(result.url).toBe("https://example.com");
  });

  it("includes target when provided", () => {
    const result = BUILTIN_HANDLERS.navigate(
      event("navigate", {
        params: { url: "https://example.com", target: "_blank" },
      }),
      EMPTY_TREE,
    ) as Extract<ActionResult, { type: "external" }>;

    expect(result.url).toBe("https://example.com");
    expect(result.target).toBe("_blank");
  });

  it("omits target when not provided", () => {
    const result = BUILTIN_HANDLERS.navigate(
      event("navigate", { params: { url: "https://example.com" } }),
      EMPTY_TREE,
    ) as Extract<ActionResult, { type: "external" }>;

    expect(result.target).toBeUndefined();
  });

  it("returns null when url param missing", () => {
    const result = BUILTIN_HANDLERS.navigate(
      event("navigate", { params: { target: "_blank" } }),
      EMPTY_TREE,
    );

    expect(result).toBeNull();
  });

  it("returns null when url is empty string", () => {
    const result = BUILTIN_HANDLERS.navigate(
      event("navigate", { params: { url: "" } }),
      EMPTY_TREE,
    );

    expect(result).toBeNull();
  });

  it("returns null when no params", () => {
    const result = BUILTIN_HANDLERS.navigate(event("navigate"), EMPTY_TREE);

    expect(result).toBeNull();
  });
});

// =============================================================================
// createHandlerMap
// =============================================================================

describe("createHandlerMap", () => {
  it("returns BUILTIN_HANDLERS when no custom handlers", () => {
    const map = createHandlerMap();
    expect(map).toBe(BUILTIN_HANDLERS);
  });

  it("merges custom handlers with builtins", () => {
    const custom = { my_action: () => ({ type: "none" as const }) };
    const map = createHandlerMap(custom);

    expect(map.increment).toBe(BUILTIN_HANDLERS.increment);
    expect(map.my_action).toBe(custom.my_action);
  });

  it("custom handlers override builtins", () => {
    const customIncrement = () => ({ type: "none" as const });
    const map = createHandlerMap({ increment: customIncrement });

    expect(map.increment).toBe(customIncrement);
    expect(map.decrement).toBe(BUILTIN_HANDLERS.decrement);
  });
});

// =============================================================================
// dispatchAction
// =============================================================================

describe("dispatchAction", () => {
  it("dispatches to matching handler", () => {
    const result = dispatchAction(
      BUILTIN_HANDLERS,
      event("increment"),
      treeWithCount("5"),
    );

    expect(result).not.toBeNull();
    expect(result!.type).toBe("patch");
  });

  it("returns null for unregistered action", () => {
    const result = dispatchAction(
      BUILTIN_HANDLERS,
      event("unknown_action"),
      treeWithCount("5"),
    );

    expect(result).toBeNull();
  });

  it("passes event and tree to handler", () => {
    const result = dispatchAction(
      BUILTIN_HANDLERS,
      event("submit_form", { params: { x: "y" } }),
      EMPTY_TREE,
    ) as Extract<ActionResult, { type: "message" }>;

    expect(result.content).toBe("x: y");
  });

  it("returns null when handler returns null", () => {
    const result = dispatchAction(
      BUILTIN_HANDLERS,
      event("navigate"), // no url param → null
      EMPTY_TREE,
    );

    expect(result).toBeNull();
  });
});
