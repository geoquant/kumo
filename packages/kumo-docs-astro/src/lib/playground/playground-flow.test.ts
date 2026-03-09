import { describe, expect, it } from "vitest";

import {
  gradeComposition,
  gradeTree,
  walkTree,
} from "@cloudflare/kumo/generative/graders";
import { isRenderableTree, uiTreeToJsx } from "@cloudflare/kumo/generative";
import type { UITree } from "@cloudflare/kumo/streaming";

import { buildNestedTree } from "~/lib/playground/nested-tree";
import {
  createInitialPlaygroundPanelsState,
  playgroundPanelsReducer,
} from "~/lib/playground/state";
import { validateEditableTree } from "~/lib/playground/validate-tree";

function countElements(tree: Parameters<typeof walkTree>[0]): number {
  let count = 0;
  walkTree(tree, () => {
    count += 1;
  });
  return count;
}

const STREAMED_TREE: UITree = {
  root: "surface",
  elements: {
    surface: {
      key: "surface",
      type: "Surface",
      props: { heading: "Counter" },
      children: ["stack"],
    },
    stack: {
      key: "stack",
      type: "Stack",
      props: {},
      children: ["counter", "button"],
      parentKey: "surface",
    },
    counter: {
      key: "counter",
      type: "Text",
      props: { children: "0" },
      parentKey: "stack",
    },
    button: {
      key: "button",
      type: "Button",
      props: { children: "Increment" },
      parentKey: "stack",
      action: { name: "increment", params: { target: "counter" } },
    },
  },
};

const EDITED_TREE: UITree = {
  root: "surface",
  elements: {
    surface: {
      key: "surface",
      type: "Surface",
      props: { heading: "Counter" },
      children: ["stack"],
    },
    stack: {
      key: "stack",
      type: "Stack",
      props: {},
      children: ["counter", "note", "button"],
      parentKey: "surface",
    },
    counter: {
      key: "counter",
      type: "Text",
      props: { children: "5" },
      parentKey: "stack",
    },
    note: {
      key: "note",
      type: "Text",
      props: { children: "Edited note" },
      parentKey: "stack",
    },
    button: {
      key: "button",
      type: "Button",
      props: { children: "Increment" },
      parentKey: "stack",
      action: { name: "increment", params: { target: "counter" } },
    },
  },
};

describe("playground edit/apply flow", () => {
  it("integrates validation, local apply, tsx export, grading, and tree inspection", async () => {
    let state = createInitialPlaygroundPanelsState();

    state = playgroundPanelsReducer(state, {
      type: "set-tree",
      panelId: "a",
      tree: STREAMED_TREE,
    });

    const validationResult = await validateEditableTree(
      JSON.stringify(EDITED_TREE),
      {},
    );

    expect(validationResult.success).toBe(true);
    if (!validationResult.success) {
      return;
    }

    state = playgroundPanelsReducer(state, {
      type: "set-local-tree-override",
      panelId: "a",
      tree: validationResult.tree,
    });
    state = playgroundPanelsReducer(state, {
      type: "mark-editor-applied",
      panelId: "a",
      appliedAt: "2026-03-08T00:00:00.000Z",
    });

    const effectiveTree = state.a.localTreeOverride ?? state.a.tree;

    expect(isRenderableTree(effectiveTree)).toBe(true);
    expect(buildNestedTree(effectiveTree)?.children).toHaveLength(1);

    const tsx = uiTreeToJsx(effectiveTree, {
      componentName: "GeneratedPanelA",
    });
    expect(tsx).toContain("GeneratedPanelA");
    expect(tsx).toContain("Edited note");

    const structuralReport = gradeTree(effectiveTree, {
      customTypes: new Set<string>(),
    });
    const compositionReport = gradeComposition(effectiveTree);
    expect(structuralReport.results.length).toBeGreaterThan(0);
    expect(compositionReport.results.length).toBeGreaterThan(0);

    expect(countElements(STREAMED_TREE)).toBe(4);
    expect(countElements(effectiveTree)).toBe(5);
    expect(state.a.editor.status).toBe("applied");
  });
});
