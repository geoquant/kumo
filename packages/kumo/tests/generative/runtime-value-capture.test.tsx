import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { UITreeRenderer } from "@/generative/ui-tree-renderer";
import { COMPONENT_MAP } from "@/generative/component-map";
import type { UITree, UIElement } from "@/streaming/types";
import { createRuntimeValueStore } from "@/streaming/runtime-value-store";

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

function MockInput(props: Record<string, unknown>): React.JSX.Element {
  return (
    <button
      type="button"
      data-testid="mock-input"
      onClick={() => {
        const handler = props.onChange;
        if (typeof handler !== "function") return;
        handler({ target: { value: "hello" } });
      }}
    >
      change
    </button>
  );
}
MockInput.displayName = "MockInput";

function MockTextarea(props: Record<string, unknown>): React.JSX.Element {
  return (
    <button
      type="button"
      data-testid="mock-textarea"
      onClick={() => {
        const handler = props.onChange;
        if (typeof handler !== "function") return;
        handler({ target: { value: "multiline" } });
      }}
    >
      change
    </button>
  );
}
MockTextarea.displayName = "MockTextarea";

const ORIGINAL_INPUT = (COMPONENT_MAP as Record<string, unknown>).Input;
const ORIGINAL_TEXTAREA = (COMPONENT_MAP as Record<string, unknown>).Textarea;

beforeEach(() => {
  (COMPONENT_MAP as Record<string, unknown>).Input = MockInput;
  (COMPONENT_MAP as Record<string, unknown>).Textarea = MockTextarea;
});

afterEach(() => {
  if (ORIGINAL_INPUT !== undefined) {
    (COMPONENT_MAP as Record<string, unknown>).Input = ORIGINAL_INPUT;
  } else {
    delete (COMPONENT_MAP as Record<string, unknown>).Input;
  }

  if (ORIGINAL_TEXTAREA !== undefined) {
    (COMPONENT_MAP as Record<string, unknown>).Textarea = ORIGINAL_TEXTAREA;
  } else {
    delete (COMPONENT_MAP as Record<string, unknown>).Textarea;
  }

  cleanup();
});

describe("runtime value capture", () => {
  it("captures Input value into store and marks touched", () => {
    const store = createRuntimeValueStore();
    expect(store.snapshotTouched()).toEqual({});

    const t = mkTree("root", {
      root: el("root", "Input"),
    });

    render(<UITreeRenderer tree={t} runtimeValueStore={store} />);

    fireEvent.click(screen.getByTestId("mock-input"));

    expect(store.getValue("root")).toBe("hello");
    expect(store.isTouched("root")).toBe(true);
    expect(store.snapshotTouched()).toEqual({ root: "hello" });
  });

  it("captures Textarea value into store and leaves untouched out of snapshot", () => {
    const store = createRuntimeValueStore();
    const t = mkTree("container", {
      container: el("container", "Div", {}, { children: ["a", "b"] }),
      a: el("a", "Textarea"),
      b: el("b", "Input"),
    });

    render(<UITreeRenderer tree={t} runtimeValueStore={store} />);

    // Touch only textarea
    fireEvent.click(screen.getByTestId("mock-textarea"));

    expect(store.getValue("a")).toBe("multiline");
    expect(store.isTouched("a")).toBe(true);
    expect(store.isTouched("b")).toBe(false);
    expect(store.snapshotTouched()).toEqual({ a: "multiline" });
  });
});
