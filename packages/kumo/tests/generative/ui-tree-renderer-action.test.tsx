import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, cleanup } from "@testing-library/react";
import { UITreeRenderer } from "@/generative/ui-tree-renderer";
import { COMPONENT_MAP } from "@/generative/component-map";
import type { UITree, UIElement } from "@/streaming/types";
import type { ActionEvent } from "@/streaming/action-types";

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

const ORIGINAL_SPY = (COMPONENT_MAP as Record<string, unknown>).Spy;

beforeEach(() => {
  capturedPropsMap.clear();
  (COMPONENT_MAP as Record<string, unknown>).Spy = SpyComponent;
});

afterEach(() => {
  if (ORIGINAL_SPY !== undefined) {
    (COMPONENT_MAP as Record<string, unknown>).Spy = ORIGINAL_SPY;
  } else {
    delete (COMPONENT_MAP as Record<string, unknown>).Spy;
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

  // =========================================================================
  // Button/Link onClick→action bridging (renderer-1)
  // =========================================================================

  it("injects onClick (not onAction) for Button type with action field", () => {
    const dispatch = vi.fn();

    // Register Spy as the Button component so we can inspect props
    const originalButton = (COMPONENT_MAP as Record<string, unknown>).Button;
    (COMPONENT_MAP as Record<string, unknown>).Button = SpyComponent;

    try {
      const t = mkTree("root", {
        root: el(
          "root",
          "Button",
          { "data-spy-key": "root", children: "Click me" },
          { action: { name: "increment" } },
        ),
      });

      render(<UITreeRenderer tree={t} onAction={dispatch} />);

      const props = propsFor("root");
      // Button should get onClick, not onAction
      expect(props.onClick).toBeTypeOf("function");
      expect(props.onAction).toBeUndefined();

      // Invoke onClick and verify dispatch
      const clickHandler = props.onClick as (...args: unknown[]) => void;
      clickHandler();

      expect(dispatch).toHaveBeenCalledOnce();
      const event: ActionEvent = dispatch.mock.calls[0][0];
      expect(event.actionName).toBe("increment");
      expect(event.sourceKey).toBe("root");
    } finally {
      (COMPONENT_MAP as Record<string, unknown>).Button = originalButton;
    }
  });

  it("injects onClick (not onAction) for Link type with action field", () => {
    const dispatch = vi.fn();

    const originalLink = (COMPONENT_MAP as Record<string, unknown>).Link;
    (COMPONENT_MAP as Record<string, unknown>).Link = SpyComponent;

    try {
      const t = mkTree("root", {
        root: el(
          "root",
          "Link",
          { "data-spy-key": "root", children: "Go somewhere" },
          { action: { name: "navigate", params: { url: "/dashboard" } } },
        ),
      });

      render(<UITreeRenderer tree={t} onAction={dispatch} />);

      const props = propsFor("root");
      expect(props.onClick).toBeTypeOf("function");
      expect(props.onAction).toBeUndefined();

      const clickHandler = props.onClick as (...args: unknown[]) => void;
      clickHandler();

      expect(dispatch).toHaveBeenCalledOnce();
      const event: ActionEvent = dispatch.mock.calls[0][0];
      expect(event.actionName).toBe("navigate");
      expect(event.sourceKey).toBe("root");
      expect(event.params).toEqual({ url: "/dashboard" });
    } finally {
      (COMPONENT_MAP as Record<string, unknown>).Link = originalLink;
    }
  });

  it("blocks unsafe Link hrefs (javascript:) by stripping href and preventing default on click", () => {
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const originalLink = (COMPONENT_MAP as Record<string, unknown>).Link;
    (COMPONENT_MAP as Record<string, unknown>).Link = SpyComponent;

    try {
      const t = mkTree("root", {
        root: el("root", "Link", {
          "data-spy-key": "root",
          href: "javascript:alert(1)",
          children: "Bad",
        }),
      });

      render(<UITreeRenderer tree={t} />);

      const props = propsFor("root");
      expect(props.href).toBeUndefined();
      expect(props.onClick).toBeTypeOf("function");

      const preventDefault = vi.fn();
      const clickHandler = props.onClick as (...args: unknown[]) => void;
      clickHandler({ preventDefault });

      expect(preventDefault).toHaveBeenCalledOnce();
      expect(warnSpy).toHaveBeenCalledOnce();
    } finally {
      (COMPONENT_MAP as Record<string, unknown>).Link = originalLink;
      warnSpy.mockRestore();
    }
  });

  it("preserves existing onClick from LLM output on Button", () => {
    const dispatch = vi.fn();
    const existingOnClick = vi.fn();

    const originalButton = (COMPONENT_MAP as Record<string, unknown>).Button;
    (COMPONENT_MAP as Record<string, unknown>).Button = SpyComponent;

    try {
      const t = mkTree("root", {
        root: el(
          "root",
          "Button",
          { "data-spy-key": "root", onClick: existingOnClick },
          { action: { name: "submit" } },
        ),
      });

      render(<UITreeRenderer tree={t} onAction={dispatch} />);

      const props = propsFor("root");
      // onClick should be a wrapper that chains the existing handler
      expect(props.onClick).toBeTypeOf("function");
      expect(props.onAction).toBeUndefined();

      // Invoke and verify both handlers fire
      const clickHandler = props.onClick as (...args: unknown[]) => void;
      const fakeEvent = { type: "click" };
      clickHandler(fakeEvent);

      expect(existingOnClick).toHaveBeenCalledOnce();
      expect(existingOnClick).toHaveBeenCalledWith(fakeEvent);
      expect(dispatch).toHaveBeenCalledOnce();
    } finally {
      (COMPONENT_MAP as Record<string, unknown>).Button = originalButton;
    }
  });

  it("Button action handler includes params from action definition", () => {
    const dispatch = vi.fn();

    const originalButton = (COMPONENT_MAP as Record<string, unknown>).Button;
    (COMPONENT_MAP as Record<string, unknown>).Button = SpyComponent;

    try {
      const t = mkTree("root", {
        root: el(
          "root",
          "Button",
          { "data-spy-key": "root", children: "Delete" },
          { action: { name: "delete", params: { id: "42" } } },
        ),
      });

      render(<UITreeRenderer tree={t} onAction={dispatch} />);

      const clickHandler = propsFor("root").onClick as (
        ...args: unknown[]
      ) => void;
      clickHandler();

      expect(dispatch).toHaveBeenCalledOnce();
      const event: ActionEvent = dispatch.mock.calls[0][0];
      expect(event.actionName).toBe("delete");
      expect(event.params).toEqual({ id: "42" });
    } finally {
      (COMPONENT_MAP as Record<string, unknown>).Button = originalButton;
    }
  });

  it("non-Button/Link components still receive onAction (not onClick)", () => {
    const dispatch = vi.fn();
    const t = mkTree("root", {
      root: el(
        "root",
        "Spy",
        { "data-spy-key": "root" },
        { action: { name: "toggle" } },
      ),
    });

    render(<UITreeRenderer tree={t} onAction={dispatch} />);

    const props = propsFor("root");
    expect(props.onAction).toBeTypeOf("function");
    expect(props.onClick).toBeUndefined();
  });

  it("non-Button/Link onClick from LLM passes through unchanged", () => {
    const dispatch = vi.fn();
    const existingOnClick = vi.fn();
    const t = mkTree("root", {
      root: el(
        "root",
        "Spy",
        { "data-spy-key": "root", onClick: existingOnClick },
        { action: { name: "submit" } },
      ),
    });

    render(<UITreeRenderer tree={t} onAction={dispatch} />);

    const props = propsFor("root");
    // For non-Button/Link, onAction is injected and onClick passes through as-is
    expect(props.onAction).toBeTypeOf("function");
    expect(props.onClick).toBe(existingOnClick);
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
