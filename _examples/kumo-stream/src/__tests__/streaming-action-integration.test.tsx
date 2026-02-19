/**
 * Integration tests: streaming form with action dispatch.
 *
 * Tests the full pipeline: UITree with action fields → UITreeRenderer →
 * createActionHandler → ActionEvent dispatch. Covers both static rendering
 * and streaming mode where child elements arrive incrementally.
 *
 * Uses the Spy component pattern (inject into COMPONENT_MAP) to capture
 * onAction handlers and simulate user interactions without rendering
 * real kumo components (avoiding the dual-React bundling issue).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, cleanup } from "@testing-library/react";
import { UITreeRenderer } from "../core/UITreeRenderer";
import { COMPONENT_MAP } from "../core/component-map";
import type { UITree, UIElement } from "../core/types";
import type { ActionEvent } from "../core/action-handler";

// =============================================================================
// Spy Component
// =============================================================================

const capturedPropsMap = new Map<string, Record<string, unknown>>();

function SpyComponent(props: Record<string, unknown>): React.JSX.Element {
  const spyKey =
    typeof props["data-spy-key"] === "string"
      ? props["data-spy-key"]
      : "default";
  const { children, ...rest } = props;
  capturedPropsMap.set(spyKey, rest);
  return <div data-testid={`spy-${spyKey}`}>{children as React.ReactNode}</div>;
}
SpyComponent.displayName = "SpyComponent";

// =============================================================================
// Helpers
// =============================================================================

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

function propsFor(spyKey: string): Record<string, unknown> {
  const props = capturedPropsMap.get(spyKey);
  if (props == null) {
    throw new Error(`No captured props for spy key "${spyKey}"`);
  }
  return props;
}

/** Invoke the captured onAction handler for a spy key. */
function triggerAction(
  spyKey: string,
  context?: Record<string, unknown>,
): void {
  const handler = propsFor(spyKey).onAction;
  if (typeof handler !== "function") {
    throw new Error(`No onAction handler on spy "${spyKey}"`);
  }
  (handler as (ctx?: Record<string, unknown>) => void)(context);
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
// Test 1: Render form UITree with action fields → ActionEvent dispatched
// =============================================================================

describe("integration: form with action fields", () => {
  it("renders a form tree and dispatches ActionEvent from each element", () => {
    const dispatch = vi.fn();

    // Simulate a form: container → select + checkbox + submit button
    // Each interactive element has an action field
    const tree = mkTree("form", {
      form: el(
        "form",
        "Div",
        { className: "form-container" },
        { children: ["region-select", "notify-check", "submit-btn"] },
      ),
      "region-select": el(
        "region-select",
        "Spy",
        { "data-spy-key": "select", label: "Region" },
        { action: { name: "select_region", params: { field: "region" } } },
      ),
      "notify-check": el(
        "notify-check",
        "Spy",
        { "data-spy-key": "checkbox", label: "Notifications" },
        { action: { name: "toggle_notify" } },
      ),
      "submit-btn": el(
        "submit-btn",
        "Spy",
        { "data-spy-key": "button", children: "Submit" },
        { action: { name: "submit_form", params: { formId: "settings" } } },
      ),
    });

    render(<UITreeRenderer tree={tree} onAction={dispatch} />);

    // All three interactive elements should have onAction handlers
    expect(propsFor("select").onAction).toBeTypeOf("function");
    expect(propsFor("checkbox").onAction).toBeTypeOf("function");
    expect(propsFor("button").onAction).toBeTypeOf("function");

    // Simulate select change
    triggerAction("select", { value: "us-east" });

    expect(dispatch).toHaveBeenCalledTimes(1);
    const selectEvent: ActionEvent = dispatch.mock.calls[0][0];
    expect(selectEvent.actionName).toBe("select_region");
    expect(selectEvent.sourceKey).toBe("region-select");
    expect(selectEvent.params).toEqual({ field: "region" });
    expect(selectEvent.context).toEqual({ value: "us-east" });

    // Simulate checkbox toggle
    triggerAction("checkbox", { checked: true });

    expect(dispatch).toHaveBeenCalledTimes(2);
    const checkEvent: ActionEvent = dispatch.mock.calls[1][0];
    expect(checkEvent.actionName).toBe("toggle_notify");
    expect(checkEvent.sourceKey).toBe("notify-check");
    expect(checkEvent).not.toHaveProperty("params");
    expect(checkEvent.context).toEqual({ checked: true });

    // Simulate button click
    triggerAction("button");

    expect(dispatch).toHaveBeenCalledTimes(3);
    const btnEvent: ActionEvent = dispatch.mock.calls[2][0];
    expect(btnEvent.actionName).toBe("submit_form");
    expect(btnEvent.sourceKey).toBe("submit-btn");
    expect(btnEvent.params).toEqual({ formId: "settings" });
    expect(btnEvent).not.toHaveProperty("context");
  });
});

// =============================================================================
// Test 2: Simulate user interaction → verify ActionEvent
// =============================================================================

describe("integration: user interaction simulation", () => {
  it("dispatches with correct sourceKey matching element key, not spy key", () => {
    const dispatch = vi.fn();

    // Two buttons with different element keys but both using Spy type
    const tree = mkTree("container", {
      container: el(
        "container",
        "Div",
        {},
        { children: ["save-btn", "cancel-btn"] },
      ),
      "save-btn": el(
        "save-btn",
        "Spy",
        { "data-spy-key": "save" },
        { action: { name: "save" } },
      ),
      "cancel-btn": el(
        "cancel-btn",
        "Spy",
        { "data-spy-key": "cancel" },
        { action: { name: "cancel" } },
      ),
    });

    render(<UITreeRenderer tree={tree} onAction={dispatch} />);

    triggerAction("cancel");

    expect(dispatch).toHaveBeenCalledOnce();
    const event: ActionEvent = dispatch.mock.calls[0][0];
    // sourceKey should be the UIElement key, not the spy key
    expect(event.sourceKey).toBe("cancel-btn");
    expect(event.actionName).toBe("cancel");
  });

  it("elements without action field do not get onAction handler", () => {
    const dispatch = vi.fn();

    const tree = mkTree("form", {
      form: el("form", "Div", {}, { children: ["label-el", "action-el"] }),
      "label-el": el("label-el", "Spy", { "data-spy-key": "label" }),
      "action-el": el(
        "action-el",
        "Spy",
        { "data-spy-key": "action" },
        { action: { name: "click" } },
      ),
    });

    render(<UITreeRenderer tree={tree} onAction={dispatch} />);

    // Label has no action → no onAction
    expect(propsFor("label").onAction).toBeUndefined();
    // Action element has action → onAction present
    expect(propsFor("action").onAction).toBeTypeOf("function");
  });
});

// =============================================================================
// Test 3: Action dispatch works during streaming (streaming=true)
// =============================================================================

describe("integration: streaming mode with actions", () => {
  it("dispatches actions from elements that exist while others are still missing", () => {
    const dispatch = vi.fn();

    // Container references 3 children but only 2 exist (simulating mid-stream)
    const tree = mkTree("form", {
      form: el(
        "form",
        "Div",
        {},
        { children: ["present-btn", "present-check", "missing-el"] },
      ),
      "present-btn": el(
        "present-btn",
        "Spy",
        { "data-spy-key": "btn" },
        { action: { name: "early_click" } },
      ),
      "present-check": el(
        "present-check",
        "Spy",
        { "data-spy-key": "check" },
        { action: { name: "early_toggle" } },
      ),
      // "missing-el" is NOT in elements — simulates element not yet streamed
    });

    // streaming=true suppresses "Missing element" errors
    render(<UITreeRenderer tree={tree} streaming={true} onAction={dispatch} />);

    // Present elements should have onAction handlers and work normally
    triggerAction("btn");
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect((dispatch.mock.calls[0][0] as ActionEvent).actionName).toBe(
      "early_click",
    );

    triggerAction("check", { checked: true });
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect((dispatch.mock.calls[1][0] as ActionEvent).actionName).toBe(
      "early_toggle",
    );
    expect((dispatch.mock.calls[1][0] as ActionEvent).context).toEqual({
      checked: true,
    });
  });

  it("newly arrived elements get action handlers on re-render", () => {
    const dispatch = vi.fn();

    // Phase 1: only container + button exist
    const phase1 = mkTree("form", {
      form: el("form", "Div", {}, { children: ["btn", "select"] }),
      btn: el(
        "btn",
        "Spy",
        { "data-spy-key": "btn" },
        { action: { name: "click" } },
      ),
      // "select" not yet arrived
    });

    const { rerender } = render(
      <UITreeRenderer tree={phase1} streaming={true} onAction={dispatch} />,
    );

    // Button works in phase 1
    triggerAction("btn");
    expect(dispatch).toHaveBeenCalledTimes(1);

    // Phase 2: select element arrives
    const phase2 = mkTree("form", {
      form: el("form", "Div", {}, { children: ["btn", "select"] }),
      btn: el(
        "btn",
        "Spy",
        { "data-spy-key": "btn" },
        { action: { name: "click" } },
      ),
      select: el(
        "select",
        "Spy",
        { "data-spy-key": "select" },
        { action: { name: "choose", params: { field: "color" } } },
      ),
    });

    capturedPropsMap.clear();
    rerender(
      <UITreeRenderer tree={phase2} streaming={true} onAction={dispatch} />,
    );

    // Now select should have an onAction handler
    triggerAction("select", { value: "blue" });
    expect(dispatch).toHaveBeenCalledTimes(2);

    const selectEvent: ActionEvent = dispatch.mock.calls[1][0];
    expect(selectEvent.actionName).toBe("choose");
    expect(selectEvent.sourceKey).toBe("select");
    expect(selectEvent.params).toEqual({ field: "color" });
    expect(selectEvent.context).toEqual({ value: "blue" });
  });

  it("streaming=false shows error for missing elements but actions still work on present ones", () => {
    const dispatch = vi.fn();

    const tree = mkTree("root", {
      root: el("root", "Div", {}, { children: ["exists", "missing"] }),
      exists: el(
        "exists",
        "Spy",
        { "data-spy-key": "exists" },
        { action: { name: "test_action" } },
      ),
      // "missing" not in elements
    });

    const { container } = render(
      <UITreeRenderer tree={tree} streaming={false} onAction={dispatch} />,
    );

    // Should show "Missing element" error for the missing key
    expect(container.textContent).toContain("Missing element: missing");

    // But the present element's action should still work
    triggerAction("exists", { value: "hello" });
    expect(dispatch).toHaveBeenCalledOnce();
    expect((dispatch.mock.calls[0][0] as ActionEvent).actionName).toBe(
      "test_action",
    );
  });
});
