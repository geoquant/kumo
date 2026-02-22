/**
 * Integration tests: schema validation in UITreeRenderer.
 *
 * Real kumo components crash in the test env due to dual React copies.
 * We use the Spy component pattern (see ui-tree-renderer-action.test.tsx)
 * for "valid" sibling elements, and test validation failure behavior
 * via components with known-bad props.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, cleanup } from "@testing-library/react";
import { UITreeRenderer } from "@/generative/ui-tree-renderer";
import { COMPONENT_MAP } from "@/generative/component-map";
import type { UITree, UIElement } from "@/streaming/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SpyComponent(props: Record<string, unknown>): React.JSX.Element {
  const { children, ...rest } = props;
  // Spread rest to preserve data-key and other props from the renderer
  return (
    <div data-testid="spy" {...rest}>
      {children as React.ReactNode}
    </div>
  );
}
SpyComponent.displayName = "SpyComponent";

function el(
  key: string,
  type: string,
  props: Record<string, unknown> = {},
  opts?: { children?: string[] },
): UIElement {
  return {
    key,
    type,
    props,
    ...(opts?.children != null ? { children: opts.children } : {}),
  };
}

function mkTree(root: string, elements: Record<string, UIElement>): UITree {
  return { root, elements };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

const originals: Record<
  string,
  React.ComponentType<Record<string, unknown>> | undefined
> = {};
const spyTypes = ["Text", "Badge", "Button", "Banner", "Table", "Stack"];

beforeEach(() => {
  for (const t of spyTypes) {
    originals[t] = COMPONENT_MAP[t];
    (
      COMPONENT_MAP as Record<
        string,
        React.ComponentType<Record<string, unknown>>
      >
    )[t] = SpyComponent;
  }
});

afterEach(() => {
  for (const t of spyTypes) {
    if (originals[t] !== undefined) {
      (
        COMPONENT_MAP as Record<
          string,
          React.ComponentType<Record<string, unknown>>
        >
      )[t] = originals[t];
    } else {
      delete (COMPONENT_MAP as Record<string, unknown>)[t];
    }
  }
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("UITreeRenderer validation integration", () => {
  it("renders valid tree without validation warnings", () => {
    const tree = mkTree("root", {
      root: el("root", "Div", { className: "flex" }, { children: ["txt"] }),
      txt: el("txt", "Text", { children: "Hello world", variant: "body" }),
    });

    const { container } = render(<UITreeRenderer tree={tree} />);

    expect(container.textContent).toContain("Hello world");
    expect(container.textContent).not.toContain("Validation failed");
  });

  it("repairs invalid props by stripping them and renders with defaults", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const tree = mkTree("root", {
      root: el("root", "Button", {
        variant: "totally-invalid",
        children: "Click me",
      }),
    });

    const { container } = render(<UITreeRenderer tree={tree} />);

    // Should NOT show validation failure — the element is repaired
    expect(container.textContent).not.toContain("Validation failed");

    // Button should render (via Spy) with the invalid variant stripped
    const buttonEl = container.querySelector('[data-key="root"]');
    expect(buttonEl).not.toBeNull();
    expect(container.textContent).toContain("Click me");

    // Should have logged a repair warning
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0][0]).toContain("Repaired");
    expect(warnSpy.mock.calls[0][0]).toContain("root");
  });

  it("repairs invalid sibling and renders all elements", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const tree = mkTree("container", {
      container: el(
        "container",
        "Div",
        {},
        {
          children: ["valid-text", "invalid-badge", "valid-button"],
        },
      ),
      "valid-text": el("valid-text", "Text", { children: "I am valid" }),
      "invalid-badge": el("invalid-badge", "Badge", {
        variant: "does-not-exist",
        children: "Repaired badge",
      }),
      "valid-button": el("valid-button", "Button", {
        variant: "primary",
        children: "OK",
      }),
    });

    const { container } = render(<UITreeRenderer tree={tree} />);

    // Valid text should render (via Spy)
    expect(container.textContent).toContain("I am valid");

    // Invalid badge should be repaired (variant stripped), not show error
    expect(container.textContent).not.toContain("Validation failed");
    const badgeEl = container.querySelector('[data-key="invalid-badge"]');
    expect(badgeEl).not.toBeNull();
    expect(container.textContent).toContain("Repaired badge");

    // Valid button should still render
    const buttonEl = container.querySelector('[data-key="valid-button"]');
    expect(buttonEl).not.toBeNull();

    // Should have logged exactly 1 repair warning (for the badge)
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain("Repaired");
  });

  it("repairs deeply nested invalid elements gracefully", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const tree = mkTree("root", {
      root: el("root", "Div", {}, { children: ["level1"] }),
      level1: el("level1", "Div", {}, { children: ["level2"] }),
      level2: el("level2", "Div", {}, { children: ["bad-elem", "good-elem"] }),
      "bad-elem": el("bad-elem", "Banner", {
        variant: "nonexistent",
        children: "Fixed banner",
      }),
      "good-elem": el("good-elem", "Text", { children: "Still here" }),
    });

    const { container } = render(<UITreeRenderer tree={tree} />);

    // Bad element should be repaired, not show error
    expect(container.textContent).not.toContain("Validation failed");
    const bannerEl = container.querySelector('[data-key="bad-elem"]');
    expect(bannerEl).not.toBeNull();
    expect(container.textContent).toContain("Fixed banner");

    // Good sibling should still render
    expect(container.textContent).toContain("Still here");

    // Should have logged a repair warning
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain("Repaired");
  });

  it("does not show validation warning for Div elements", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const tree = mkTree("root", {
      root: el("root", "Div", {
        className: "flex gap-2",
        arbitrary: "stuff",
        "data-custom": "yes",
      }),
    });

    const { container } = render(<UITreeRenderer tree={tree} />);

    expect(container.textContent).not.toContain("Validation failed");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("does not show validation warning for sub-component types", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Sub-component types (TableBody, TableRow, etc.) have no schema → pass validation.
    // They render via Spy since we swapped Table in setup.
    const tree = mkTree("root", {
      root: el("root", "Table", {}, { children: ["body"] }),
      body: el("body", "TableBody", {}, { children: ["row"] }),
      row: el("row", "TableRow", {}, { children: ["cell"] }),
      cell: el("cell", "TableCell", { children: "Data" }),
    });

    const { container } = render(<UITreeRenderer tree={tree} />);

    expect(container.textContent).not.toContain("Validation failed");
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
