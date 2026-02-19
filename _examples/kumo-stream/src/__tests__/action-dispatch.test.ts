import { describe, it, expect, vi, afterEach } from "vitest";
import {
  dispatch,
  onAction,
  _clearSubscribers,
} from "../loadable/action-dispatch";
import type { ActionEvent } from "../core/action-handler";

// =============================================================================
// Cleanup
// =============================================================================

afterEach(() => {
  _clearSubscribers();
});

// =============================================================================
// Helpers
// =============================================================================

function mkEvent(overrides?: Partial<ActionEvent>): ActionEvent {
  return {
    actionName: "test-action",
    sourceKey: "el-1",
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("onAction subscription", () => {
  it("registers a handler that receives dispatched events", () => {
    const handler = vi.fn();
    onAction(handler);

    const event = mkEvent();
    dispatch(event);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(event);
  });

  it("returns an unsubscribe function that stops delivery", () => {
    const handler = vi.fn();
    const unsub = onAction(handler);

    dispatch(mkEvent());
    expect(handler).toHaveBeenCalledOnce();

    unsub();
    dispatch(mkEvent());
    expect(handler).toHaveBeenCalledOnce(); // still 1
  });

  it("delivers the same event to multiple subscribers", () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    onAction(handler1);
    onAction(handler2);

    const event = mkEvent({ actionName: "shared" });
    dispatch(event);

    expect(handler1).toHaveBeenCalledWith(event);
    expect(handler2).toHaveBeenCalledWith(event);
  });

  it("unsubscribing one handler does not affect others", () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    onAction(handler1);
    const unsub2 = onAction(handler2);

    unsub2();
    dispatch(mkEvent());

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).not.toHaveBeenCalled();
  });

  it("handler throwing does not prevent other handlers from receiving", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const throwing = vi.fn(() => {
      throw new Error("boom");
    });
    const ok = vi.fn();
    onAction(throwing);
    onAction(ok);

    dispatch(mkEvent());

    expect(ok).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });
});

describe("CustomEvent dispatch", () => {
  it("fires kumo-action CustomEvent on window", () => {
    const listener = vi.fn();
    window.addEventListener("kumo-action", listener);

    const event = mkEvent({ actionName: "submit", sourceKey: "btn-1" });
    dispatch(event);

    expect(listener).toHaveBeenCalledOnce();
    const fired = listener.mock.calls[0][0] as CustomEvent;
    expect(fired.detail.actionName).toBe("submit");
    expect(fired.detail.sourceKey).toBe("btn-1");

    window.removeEventListener("kumo-action", listener);
  });

  it("includes params and context in CustomEvent detail when present", () => {
    const listener = vi.fn();
    window.addEventListener("kumo-action", listener);

    dispatch(
      mkEvent({
        params: { mode: "dark" },
        context: { checked: true },
      }),
    );

    const detail = (listener.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.params).toEqual({ mode: "dark" });
    expect(detail.context).toEqual({ checked: true });

    window.removeEventListener("kumo-action", listener);
  });

  it("omits params and context from detail when not present on event", () => {
    const listener = vi.fn();
    window.addEventListener("kumo-action", listener);

    dispatch(mkEvent()); // no params, no context

    const detail = (listener.mock.calls[0][0] as CustomEvent).detail;
    expect(detail).not.toHaveProperty("params");
    expect(detail).not.toHaveProperty("context");

    window.removeEventListener("kumo-action", listener);
  });
});

describe("no-subscriber dispatch", () => {
  it("dispatching with no subscribers does not throw", () => {
    expect(() => dispatch(mkEvent())).not.toThrow();
  });

  it("CustomEvent still fires even with no subscribers", () => {
    const listener = vi.fn();
    window.addEventListener("kumo-action", listener);

    dispatch(mkEvent());
    expect(listener).toHaveBeenCalledOnce();

    window.removeEventListener("kumo-action", listener);
  });
});
