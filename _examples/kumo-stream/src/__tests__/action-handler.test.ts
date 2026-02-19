import { describe, it, expect, vi } from "vitest";
import {
  createActionHandler,
  type ActionEvent,
  type ActionDispatch,
} from "../core/action-handler";
import type { Action } from "../core/types";

// =============================================================================
// Helpers
// =============================================================================

function action(name: string, params?: Record<string, unknown>): Action {
  return params != null ? { name, params } : { name };
}

// =============================================================================
// createActionHandler
// =============================================================================

describe("createActionHandler", () => {
  it("calls dispatch with correct actionName and sourceKey", () => {
    const dispatch = vi.fn<ActionDispatch>();
    const handler = createActionHandler(action("submit"), "btn-1", dispatch);

    handler();

    expect(dispatch).toHaveBeenCalledOnce();
    const event: ActionEvent = dispatch.mock.calls[0][0];
    expect(event.actionName).toBe("submit");
    expect(event.sourceKey).toBe("btn-1");
  });

  it("includes action.params in the event", () => {
    const dispatch = vi.fn<ActionDispatch>();
    const handler = createActionHandler(
      action("filter", { category: "logs", limit: 50 }),
      "filter-btn",
      dispatch,
    );

    handler();

    const event: ActionEvent = dispatch.mock.calls[0][0];
    expect(event.params).toEqual({ category: "logs", limit: 50 });
  });

  it("passes through context from wrapper call", () => {
    const dispatch = vi.fn<ActionDispatch>();
    const handler = createActionHandler(action("toggle"), "sw-1", dispatch);

    handler({ checked: true });

    const event: ActionEvent = dispatch.mock.calls[0][0];
    expect(event.context).toEqual({ checked: true });
  });

  it("works with no params and no context (both optional)", () => {
    const dispatch = vi.fn<ActionDispatch>();
    const handler = createActionHandler(action("ping"), "el-0", dispatch);

    handler();

    const event: ActionEvent = dispatch.mock.calls[0][0];
    expect(event.actionName).toBe("ping");
    expect(event.sourceKey).toBe("el-0");
    expect(event).not.toHaveProperty("params");
    expect(event).not.toHaveProperty("context");
  });

  it("omits params key when action has no params", () => {
    const dispatch = vi.fn<ActionDispatch>();
    const handler = createActionHandler(action("click"), "btn-x", dispatch);

    handler({ value: "selected" });

    const event: ActionEvent = dispatch.mock.calls[0][0];
    expect(event).not.toHaveProperty("params");
    expect(event.context).toEqual({ value: "selected" });
  });

  it("omits context key when wrapper passes undefined", () => {
    const dispatch = vi.fn<ActionDispatch>();
    const handler = createActionHandler(
      action("save", { draft: true }),
      "btn-save",
      dispatch,
    );

    handler(undefined);

    const event: ActionEvent = dispatch.mock.calls[0][0];
    expect(event.params).toEqual({ draft: true });
    expect(event).not.toHaveProperty("context");
  });
});
