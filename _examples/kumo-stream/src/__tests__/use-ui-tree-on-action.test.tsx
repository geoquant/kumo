import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderHook, render, cleanup, act } from "@testing-library/react";
import { useUITree } from "../core/hooks";
import { UITreeRenderer } from "../core/UITreeRenderer";
import { COMPONENT_MAP } from "../core/component-map";
import type { UIElement } from "../core/types";
import type { ActionEvent, ActionDispatch } from "../core/action-handler";
import type { JsonPatchOp } from "../core/rfc6902";

// =============================================================================
// Helpers
// =============================================================================

const capturedPropsMap = new Map<string, Record<string, unknown>>();

function SpyComponent(props: Record<string, unknown>): React.JSX.Element {
  const spyKey =
    typeof props["data-spy-key"] === "string"
      ? props["data-spy-key"]
      : "default";
  const { children, ...rest } = props;
  capturedPropsMap.set(spyKey, rest);
  return <div data-testid="spy">{children as React.ReactNode}</div>;
}
SpyComponent.displayName = "SpyComponent";

function propsFor(spyKey: string): Record<string, unknown> {
  const props = capturedPropsMap.get(spyKey);
  if (props == null) {
    throw new Error(`No captured props for spy key "${spyKey}"`);
  }
  return props;
}

/** Build a tree with patches that produce a Spy element with an action. */
function buildTreePatches(opts?: {
  action?: { name: string; params?: Record<string, unknown> };
}): JsonPatchOp[] {
  const element: UIElement = {
    key: "root",
    type: "Spy",
    props: { "data-spy-key": "root" },
    ...(opts?.action != null ? { action: opts.action } : {}),
  };
  return [
    { op: "replace", path: "/root", value: "root" },
    { op: "add", path: "/elements/root", value: element },
  ];
}

/**
 * Integration wrapper: renders useUITree + UITreeRenderer together.
 * This tests the full pipeline from hook → renderer.
 */
function TreeWithHook({
  onAction,
  patchesRef,
}: {
  onAction?: ActionDispatch;
  patchesRef: React.MutableRefObject<
    ((patches: readonly JsonPatchOp[]) => void) | null
  >;
}): React.JSX.Element | null {
  const {
    tree,
    applyPatches,
    onAction: hookOnAction,
  } = useUITree({
    onAction,
  });
  patchesRef.current = applyPatches;
  return <UITreeRenderer tree={tree} onAction={hookOnAction} />;
}

// =============================================================================
// Setup / Teardown
// =============================================================================

const ORIGINAL_SPY = COMPONENT_MAP.Spy;

beforeEach(() => {
  capturedPropsMap.clear();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  COMPONENT_MAP.Spy = SpyComponent as React.ComponentType<any>;
});

afterEach(() => {
  if (ORIGINAL_SPY !== undefined) {
    COMPONENT_MAP.Spy = ORIGINAL_SPY;
  } else {
    delete COMPONENT_MAP.Spy;
  }
  cleanup();
});

// =============================================================================
// Tests
// =============================================================================

describe("useUITree onAction parameter", () => {
  it("returns onAction from options", () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useUITree({ onAction: dispatch }));
    expect(result.current.onAction).toBe(dispatch);
  });

  it("returns undefined onAction when no options provided", () => {
    const { result } = renderHook(() => useUITree());
    expect(result.current.onAction).toBeUndefined();
  });

  it("returns undefined onAction when options omit onAction", () => {
    const { result } = renderHook(() => useUITree({}));
    expect(result.current.onAction).toBeUndefined();
  });

  it("existing return values are unaffected by onAction option", () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useUITree({ onAction: dispatch }));
    expect(result.current.tree).toEqual({ root: "", elements: {} });
    expect(result.current.applyPatch).toBeTypeOf("function");
    expect(result.current.applyPatches).toBeTypeOf("function");
    expect(result.current.reset).toBeTypeOf("function");
  });
});

describe("useUITree → UITreeRenderer onAction integration", () => {
  it("wires onAction from hook through to component", () => {
    const dispatch = vi.fn();
    const patchesRef: React.MutableRefObject<
      ((patches: readonly JsonPatchOp[]) => void) | null
    > = { current: null };

    render(<TreeWithHook onAction={dispatch} patchesRef={patchesRef} />);

    // Apply patches to build a tree with an action element
    act(() => {
      patchesRef.current?.(buildTreePatches({ action: { name: "submit" } }));
    });

    // Spy component should have received onAction
    const handler = propsFor("root").onAction as (
      ctx?: Record<string, unknown>,
    ) => void;
    expect(handler).toBeTypeOf("function");

    // Trigger it — dispatch should fire with ActionEvent
    handler({ value: "test" });
    expect(dispatch).toHaveBeenCalledOnce();
    const event: ActionEvent = dispatch.mock.calls[0][0];
    expect(event.actionName).toBe("submit");
    expect(event.sourceKey).toBe("root");
    expect(event.context).toEqual({ value: "test" });
  });

  it("works without onAction — no errors, no injection", () => {
    const patchesRef: React.MutableRefObject<
      ((patches: readonly JsonPatchOp[]) => void) | null
    > = { current: null };

    render(<TreeWithHook patchesRef={patchesRef} />);

    act(() => {
      patchesRef.current?.(buildTreePatches({ action: { name: "submit" } }));
    });

    // Spy component should NOT have onAction since hook wasn't given one
    expect(propsFor("root").onAction).toBeUndefined();
  });
});
