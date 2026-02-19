import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, cleanup } from "@testing-library/react";
import { UITreeRenderer } from "../core/UITreeRenderer";
import { COMPONENT_MAP } from "../core/component-map";
import type { UITree, UIElement } from "../core/types";
import type { ActionEvent } from "../core/action-handler";

// =============================================================================
// Helpers
// =============================================================================

/**
 * Spy component that captures received props per element key.
 * Uses a `data-spy-key` prop to distinguish multiple instances in a tree.
 */
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

function el(
  key: string,
  type: string,
  props: Record<string, unknown> = {},
  opts?: {
    children?: string[];
    action?: { name: string; params?: Record<string, unknown> };
  },
): UIElement {
  return {
    key,
    type,
    props,
    ...(opts?.children != null ? { children: opts.children } : {}),
    ...(opts?.action != null ? { action: opts.action } : {}),
  };
}

function mkTree(root: string, elements: Record<string, UIElement>): UITree {
  return { root, elements };
}

/** Get captured props for a spy key, throwing if not found. */
function propsFor(spyKey: string): Record<string, unknown> {
  const props = capturedPropsMap.get(spyKey);
  if (props == null) {
    throw new Error(`No captured props for spy key "${spyKey}"`);
  }
  return props;
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

describe("UITreeRenderer action injection", () => {
  it("injects onAction when element has action field and onAction is provided", () => {
    const dispatch = vi.fn();
    const t = mkTree("root", {
      root: el(
        "root",
        "Spy",
        { "data-spy-key": "root" },
        {
          action: { name: "submit" },
        },
      ),
    });

    render(<UITreeRenderer tree={t} onAction={dispatch} />);

    expect(propsFor("root").onAction).toBeTypeOf("function");
  });

  it("does not inject onAction when element has no action field", () => {
    const dispatch = vi.fn();
    const t = mkTree("root", {
      root: el("root", "Spy", { "data-spy-key": "root" }),
    });

    render(<UITreeRenderer tree={t} onAction={dispatch} />);

    expect(propsFor("root").onAction).toBeUndefined();
  });

  it("does not inject onAction when onAction prop is omitted from renderer", () => {
    const t = mkTree("root", {
      root: el(
        "root",
        "Spy",
        { "data-spy-key": "root" },
        {
          action: { name: "submit" },
        },
      ),
    });

    render(<UITreeRenderer tree={t} />);

    expect(propsFor("root").onAction).toBeUndefined();
  });

  it("preserves existing props alongside onAction injection", () => {
    const dispatch = vi.fn();
    const t = mkTree("root", {
      root: el(
        "root",
        "Spy",
        { "data-spy-key": "root", label: "My Label", size: "lg" },
        {
          action: { name: "click" },
        },
      ),
    });

    render(<UITreeRenderer tree={t} onAction={dispatch} />);

    const props = propsFor("root");
    expect(props.label).toBe("My Label");
    expect(props.size).toBe("lg");
    expect(props.onAction).toBeTypeOf("function");
  });

  it("injected handler dispatches correct ActionEvent", () => {
    const dispatch = vi.fn();
    const t = mkTree("root", {
      root: el(
        "root",
        "Spy",
        { "data-spy-key": "root" },
        {
          action: { name: "toggle", params: { mode: "dark" } },
        },
      ),
    });

    render(<UITreeRenderer tree={t} onAction={dispatch} />);

    // Simulate what a stateful wrapper does: call onAction with context
    const handler = propsFor("root").onAction as (
      ctx?: Record<string, unknown>,
    ) => void;
    handler({ checked: true });

    expect(dispatch).toHaveBeenCalledOnce();
    const event: ActionEvent = dispatch.mock.calls[0][0];
    expect(event.actionName).toBe("toggle");
    expect(event.sourceKey).toBe("root");
    expect(event.params).toEqual({ mode: "dark" });
    expect(event.context).toEqual({ checked: true });
  });

  it("threads onAction to nested children", () => {
    const dispatch = vi.fn();
    const t = mkTree("container", {
      container: el(
        "container",
        "Spy",
        { "data-spy-key": "container" },
        {
          children: ["child"],
        },
      ),
      child: el(
        "child",
        "Spy",
        { "data-spy-key": "child" },
        {
          action: { name: "nested-action" },
        },
      ),
    });

    render(<UITreeRenderer tree={t} onAction={dispatch} />);

    // Container has no action → no onAction
    expect(propsFor("container").onAction).toBeUndefined();

    // Child has action → onAction injected
    const handler = propsFor("child").onAction as (
      ctx?: Record<string, unknown>,
    ) => void;
    expect(handler).toBeTypeOf("function");
    handler();

    expect(dispatch).toHaveBeenCalledOnce();
    const event: ActionEvent = dispatch.mock.calls[0][0];
    expect(event.actionName).toBe("nested-action");
    expect(event.sourceKey).toBe("child");
  });
});
