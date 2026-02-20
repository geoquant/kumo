import { describe, it, expect, vi } from "vitest";
import { processActionResult } from "../core/process-action-result";
import type { ActionResultCallbacks } from "../core/process-action-result";
import type { ActionResult } from "../core/action-registry";
import { dispatchAction, BUILTIN_HANDLERS } from "../core/action-registry";

// =============================================================================
// Helpers
// =============================================================================

interface MockCallbacks extends ActionResultCallbacks {
  applyPatches: ReturnType<typeof vi.fn>;
  sendMessage: ReturnType<typeof vi.fn>;
  openExternal: ReturnType<typeof vi.fn>;
}

function createCallbacks(): MockCallbacks {
  return {
    applyPatches: vi.fn(),
    sendMessage: vi.fn(),
    openExternal: vi.fn(),
  };
}

// =============================================================================
// patch result
// =============================================================================

describe("processActionResult — patch", () => {
  it("calls applyPatches with the result patches", () => {
    const cbs = createCallbacks();
    const result: ActionResult = {
      type: "patch",
      patches: [
        {
          op: "replace",
          path: "/elements/count-display/props/children",
          value: "6",
        },
      ],
    };

    processActionResult(result, cbs);

    expect(cbs.applyPatches).toHaveBeenCalledOnce();
    expect(cbs.applyPatches).toHaveBeenCalledWith(result.patches);
    expect(cbs.sendMessage).not.toHaveBeenCalled();
    expect(cbs.openExternal).not.toHaveBeenCalled();
  });

  it("passes multiple patches through", () => {
    const cbs = createCallbacks();
    const patches = [
      { op: "replace" as const, path: "/root", value: "new-root" },
      {
        op: "add" as const,
        path: "/elements/x",
        value: { key: "x", type: "Text", props: {} },
      },
    ];

    processActionResult({ type: "patch", patches }, cbs);

    expect(cbs.applyPatches).toHaveBeenCalledWith(patches);
  });
});

// =============================================================================
// message result — form submission → chat message
// =============================================================================

describe("processActionResult — message", () => {
  it("calls sendMessage with the result content", () => {
    const cbs = createCallbacks();
    const result: ActionResult = {
      type: "message",
      content: "name: Alice\nemail: alice@example.com",
    };

    processActionResult(result, cbs);

    expect(cbs.sendMessage).toHaveBeenCalledOnce();
    expect(cbs.sendMessage).toHaveBeenCalledWith(
      "name: Alice\nemail: alice@example.com",
    );
    expect(cbs.applyPatches).not.toHaveBeenCalled();
  });

  it("sends empty string content without error", () => {
    const cbs = createCallbacks();

    processActionResult({ type: "message", content: "" }, cbs);

    expect(cbs.sendMessage).toHaveBeenCalledWith("");
  });
});

// =============================================================================
// external result
// =============================================================================

describe("processActionResult — external", () => {
  it("calls openExternal with url and target", () => {
    const cbs = createCallbacks();
    const result: ActionResult = {
      type: "external",
      url: "https://example.com",
      target: "_self",
    };

    processActionResult(result, cbs);

    expect(cbs.openExternal).toHaveBeenCalledOnce();
    expect(cbs.openExternal).toHaveBeenCalledWith(
      "https://example.com",
      "_self",
    );
  });

  it('defaults target to "_blank" when not specified', () => {
    const cbs = createCallbacks();
    const result: ActionResult = {
      type: "external",
      url: "https://example.com",
    };

    processActionResult(result, cbs);

    expect(cbs.openExternal).toHaveBeenCalledWith(
      "https://example.com",
      "_blank",
    );
  });

  it("falls back to window.open when openExternal not provided", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    processActionResult(
      { type: "external", url: "https://example.com" },
      { applyPatches: vi.fn(), sendMessage: vi.fn() },
    );

    expect(openSpy).toHaveBeenCalledWith("https://example.com", "_blank");
    openSpy.mockRestore();
  });

  it("blocks disallowed schemes (javascript:) and logs", () => {
    const cbs = createCallbacks();
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    processActionResult({ type: "external", url: "javascript:alert(1)" }, cbs);

    expect(cbs.openExternal).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });
});

// =============================================================================
// none result
// =============================================================================

describe("processActionResult — none", () => {
  it("calls no callbacks", () => {
    const cbs = createCallbacks();

    processActionResult({ type: "none" }, cbs);

    expect(cbs.applyPatches).not.toHaveBeenCalled();
    expect(cbs.sendMessage).not.toHaveBeenCalled();
    expect(cbs.openExternal).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Integration: registry → processActionResult end-to-end
// =============================================================================

describe("integration: dispatchAction → processActionResult", () => {
  it("counter increment produces patch that gets applied", () => {
    const cbs = createCallbacks();
    const tree = {
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
          props: { children: "5" },
          parentKey: "card",
        },
      },
    };

    const result = dispatchAction(
      BUILTIN_HANDLERS,
      { actionName: "increment", sourceKey: "btn" },
      tree,
    );

    expect(result).not.toBeNull();
    processActionResult(result!, cbs);

    expect(cbs.applyPatches).toHaveBeenCalledWith([
      {
        op: "replace",
        path: "/elements/count-display/props/children",
        value: "6",
      },
    ]);
  });

  it("form submit produces message that gets sent", () => {
    const cbs = createCallbacks();

    const result = dispatchAction(
      BUILTIN_HANDLERS,
      {
        actionName: "submit_form",
        sourceKey: "form-btn",
        params: { name: "Bob" },
      },
      { root: "", elements: {} },
    );

    expect(result).not.toBeNull();
    processActionResult(result!, cbs);

    expect(cbs.sendMessage).toHaveBeenCalledWith(
      '{"actionName":"submit_form","sourceKey":"form-btn","params":{"name":"Bob"},"fields":{}}',
    );
  });

  it("unknown action returns null — no processing needed", () => {
    const result = dispatchAction(
      BUILTIN_HANDLERS,
      { actionName: "unknown_xyz", sourceKey: "el-1" },
      { root: "", elements: {} },
    );

    expect(result).toBeNull();
    // No crash, no callbacks — caller just logs the unknown action
  });

  it("navigate action produces external result", () => {
    const cbs = createCallbacks();

    const result = dispatchAction(
      BUILTIN_HANDLERS,
      {
        actionName: "navigate",
        sourceKey: "link-1",
        params: { url: "https://cloudflare.com", target: "_self" },
      },
      { root: "", elements: {} },
    );

    expect(result).not.toBeNull();
    processActionResult(result!, cbs);

    expect(cbs.openExternal).toHaveBeenCalledWith(
      "https://cloudflare.com",
      "_self",
    );
  });
});
