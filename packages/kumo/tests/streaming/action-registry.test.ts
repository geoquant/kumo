import { describe, it, expect, vi, afterEach } from "vitest";
import {
  BUILTIN_HANDLERS,
  createHandlerMap,
  dispatchAction,
} from "@/streaming/action-registry";
import type { ActionEvent } from "@/streaming/action-types";
import type { UITree } from "@/streaming/types";

// =============================================================================
// Helpers
// =============================================================================

function event(
  actionName: string,
  overrides?: Partial<Omit<ActionEvent, "actionName">>,
): ActionEvent {
  return { actionName, sourceKey: "btn", ...overrides };
}

function expectNonNull<T>(value: T | null): T {
  expect(value).not.toBeNull();
  if (value === null) {
    throw new Error("expected non-null");
  }
  return value;
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

    const nonNull = expectNonNull(result);
    expect(nonNull.type).toBe("patch");
  });

  it("produces correct RFC 6902 replace patch", () => {
    const result = expectNonNull(
      BUILTIN_HANDLERS.increment(event("increment"), treeWithCount("5")),
    );
    if (result.type !== "patch") throw new Error("expected patch result");

    expect(result.patches).toEqual([
      {
        op: "replace",
        path: "/elements/count-display/props/children",
        value: "6",
      },
    ]);
  });

  it("increments from zero", () => {
    const result = expectNonNull(
      BUILTIN_HANDLERS.increment(event("increment"), treeWithCount("0")),
    );
    if (result.type !== "patch") throw new Error("expected patch result");

    expect(result.patches[0].value).toBe("1");
  });

  it("increments negative values", () => {
    const result = expectNonNull(
      BUILTIN_HANDLERS.increment(event("increment"), treeWithCount("-3")),
    );
    if (result.type !== "patch") throw new Error("expected patch result");

    expect(result.patches[0].value).toBe("-2");
  });

  it("returns null when count-display missing", () => {
    const result = BUILTIN_HANDLERS.increment(event("increment"), EMPTY_TREE);
    expect(result).toBeNull();
  });

  it("defaults to 0 for non-numeric text", () => {
    const result = expectNonNull(
      BUILTIN_HANDLERS.increment(event("increment"), treeWithCount("hello")),
    );
    if (result.type !== "patch") throw new Error("expected patch result");

    expect(result.patches[0].value).toBe("1");
  });

  it("handles numeric children (number type)", () => {
    const result = expectNonNull(
      BUILTIN_HANDLERS.increment(event("increment"), treeWithCount(42)),
    );
    if (result.type !== "patch") throw new Error("expected patch result");

    expect(result.patches[0].value).toBe("43");
  });
});

// =============================================================================
// decrement handler
// =============================================================================

describe("decrement handler", () => {
  it("produces correct decrement patch", () => {
    const result = expectNonNull(
      BUILTIN_HANDLERS.decrement(event("decrement"), treeWithCount("5")),
    );
    if (result.type !== "patch") throw new Error("expected patch result");

    expect(result.patches).toEqual([
      {
        op: "replace",
        path: "/elements/count-display/props/children",
        value: "4",
      },
    ]);
  });

  it("decrements past zero", () => {
    const result = expectNonNull(
      BUILTIN_HANDLERS.decrement(event("decrement"), treeWithCount("0")),
    );
    if (result.type !== "patch") throw new Error("expected patch result");

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
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function treeWithFields(): UITree {
    return {
      root: "container",
      elements: {
        container: {
          key: "container",
          type: "Div",
          props: {},
          children: ["form", "outside"],
        },
        form: {
          key: "form",
          type: "Div",
          props: {},
          children: ["email", "notes", "submit"],
          parentKey: "container",
        },
        email: {
          key: "email",
          type: "Input",
          props: {},
          parentKey: "form",
        },
        notes: {
          key: "notes",
          type: "Textarea",
          props: {},
          parentKey: "form",
        },
        submit: {
          key: "submit",
          type: "Button",
          props: {},
          parentKey: "form",
          action: { name: "submit_form", params: { form_type: "contact" } },
        },
        outside: {
          key: "outside",
          type: "Input",
          props: {},
          parentKey: "container",
        },
      },
    };
  }

  it('returns MessageResult with type "message" and payload', () => {
    const t = treeWithFields();
    const result = expectNonNull(
      BUILTIN_HANDLERS.submit_form(
        event("submit_form", {
          params: { form_type: "contact" },
          context: { runtimeValues: { email: "a@b.com" } },
        }),
        t,
      ),
    );

    expect(result.type).toBe("message");
    if (result.type !== "message") throw new Error("expected message result");
    expect(result.payload).toEqual({
      actionName: "submit_form",
      sourceKey: "btn",
      params: { form_type: "contact" },
      fields: { email: "a@b.com" },
    });
    expect(result.content).toBe(
      '{"actionName":"submit_form","sourceKey":"btn","params":{"form_type":"contact"},"fields":{"email":"a@b.com"}}',
    );
  });

  it("defaults to touched-only, field-like keys and produces stable JSON", () => {
    const t = treeWithFields();
    const result = expectNonNull(
      BUILTIN_HANDLERS.submit_form(
        event("submit_form", {
          params: { b: 1, a: 2 },
          context: { runtimeValues: { notes: "x", outside: "y" } },
        }),
        t,
      ),
    );
    if (result.type !== "message") throw new Error("expected message result");
    expect(result.content).toBe(
      '{"actionName":"submit_form","sourceKey":"btn","params":{"a":2,"b":1},"fields":{"notes":"x","outside":"y"}}',
    );
  });

  it("scopes to params.formKey subtree", () => {
    const t = treeWithFields();
    const result = expectNonNull(
      BUILTIN_HANDLERS.submit_form(
        event("submit_form", {
          params: { formKey: "form", form_type: "contact" },
          context: { runtimeValues: { email: "a@b.com", outside: "y" } },
        }),
        t,
      ),
    );
    if (result.type !== "message") throw new Error("expected message result");
    expect(result.payload?.fields).toEqual({ email: "a@b.com" });
  });

  it("scopes to params.fieldKeys", () => {
    const t = treeWithFields();
    const result = expectNonNull(
      BUILTIN_HANDLERS.submit_form(
        event("submit_form", {
          params: { fieldKeys: ["outside"], form_type: "contact" },
          context: { runtimeValues: { email: "a@b.com", outside: "y" } },
        }),
        t,
      ),
    );
    if (result.type !== "message") throw new Error("expected message result");
    expect(result.payload?.fields).toEqual({ outside: "y" });
  });

  it("fails closed with warning if multiple submit_form actions and no scope", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = treeWithFields();
    t.elements.second = {
      key: "second",
      type: "Button",
      props: {},
      action: { name: "submit_form" },
      parentKey: "container",
    };

    const result = expectNonNull(
      BUILTIN_HANDLERS.submit_form(
        event("submit_form", {
          params: { form_type: "contact" },
          context: { runtimeValues: { email: "a@b.com" } },
        }),
        t,
      ),
    );

    expect(result).toEqual({ type: "none" });
    expect(warn).toHaveBeenCalledTimes(1);
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

    const nonNull = expectNonNull(result);
    expect(nonNull.type).toBe("external");
  });

  it("includes url from params", () => {
    const result = expectNonNull(
      BUILTIN_HANDLERS.navigate(
        event("navigate", { params: { url: "https://example.com" } }),
        EMPTY_TREE,
      ),
    );
    if (result.type !== "external") throw new Error("expected external result");

    expect(result.url).toBe("https://example.com");
  });

  it("includes target when provided", () => {
    const result = expectNonNull(
      BUILTIN_HANDLERS.navigate(
        event("navigate", {
          params: { url: "https://example.com", target: "_blank" },
        }),
        EMPTY_TREE,
      ),
    );
    if (result.type !== "external") throw new Error("expected external result");

    expect(result.url).toBe("https://example.com");
    expect(result.target).toBe("_blank");
  });

  it("omits target when not provided", () => {
    const result = expectNonNull(
      BUILTIN_HANDLERS.navigate(
        event("navigate", { params: { url: "https://example.com" } }),
        EMPTY_TREE,
      ),
    );
    if (result.type !== "external") throw new Error("expected external result");

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

    const nonNull = expectNonNull(result);
    expect(nonNull.type).toBe("patch");
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
    );

    const nonNull = expectNonNull(result);
    if (nonNull.type !== "message") throw new Error("expected message result");
    expect(nonNull.content).toBe(
      '{"actionName":"submit_form","sourceKey":"btn","params":{"x":"y"},"fields":{}}',
    );
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
