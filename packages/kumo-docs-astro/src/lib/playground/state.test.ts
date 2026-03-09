import { describe, expect, it } from "vitest";

import {
  createInitialPlaygroundLayoutState,
  createInitialPlaygroundPanelsState,
  playgroundLayoutReducer,
  playgroundPanelsReducer,
} from "~/lib/playground/state";

describe("playground state reducers", () => {
  it("tracks tab, status, raw jsonl, and action log updates per panel", () => {
    let state = createInitialPlaygroundPanelsState();

    state = playgroundPanelsReducer(state, {
      type: "set-tab",
      panelId: "a",
      tab: "tree",
    });
    state = playgroundPanelsReducer(state, {
      type: "set-status",
      panelId: "a",
      status: "streaming",
    });
    state = playgroundPanelsReducer(state, {
      type: "set-raw-jsonl",
      panelId: "a",
      rawJsonl: "patches",
    });
    state = playgroundPanelsReducer(state, {
      type: "append-action-log",
      panelId: "a",
      entry: {
        timestamp: "2026-03-08T00:00:00.000Z",
        event: { actionName: "increment", sourceKey: "button-1" },
      },
    });

    expect(state.a.activeTab).toBe("tree");
    expect(state.a.status).toBe("streaming");
    expect(state.a.rawJsonl).toBe("patches");
    expect(state.a.actionLog).toHaveLength(1);
    expect(state.b.actionLog).toHaveLength(0);
  });

  it("tracks editor dirty, invalid, applied, and reset flows", () => {
    let state = createInitialPlaygroundPanelsState();

    state = playgroundPanelsReducer(state, {
      type: "set-editor-text",
      panelId: "a",
      text: '{"root":"a"}',
      source: "manual",
    });
    expect(state.a.editor.status).toBe("dirty");

    state = playgroundPanelsReducer(state, {
      type: "set-editor-validation",
      panelId: "a",
      issues: [{ message: "bad json", path: [] }],
    });
    expect(state.a.editor.status).toBe("invalid");

    state = playgroundPanelsReducer(state, {
      type: "mark-editor-applied",
      panelId: "a",
      appliedAt: "2026-03-08T00:00:00.000Z",
    });
    expect(state.a.editor.status).toBe("applied");
    expect(state.a.editor.lastAppliedAt).toBe("2026-03-08T00:00:00.000Z");

    state = playgroundPanelsReducer(state, {
      type: "set-local-tree-override",
      panelId: "a",
      tree: { root: "root", elements: {} },
    });
    state = playgroundPanelsReducer(state, {
      type: "reset-editor",
      panelId: "a",
      text: "{}",
    });

    expect(state.a.editor.text).toBe("{}");
    expect(state.a.editor.status).toBe("clean");
    expect(state.a.localTreeOverride).toBeNull();
  });

  it("tracks layout toggles and persisted sizes", () => {
    let state = createInitialPlaygroundLayoutState();

    state = playgroundLayoutReducer(state, { type: "toggle-chat-minimized" });
    state = playgroundLayoutReducer(state, {
      type: "set-mobile-view",
      value: "catalog",
    });
    state = playgroundLayoutReducer(state, {
      type: "set-desktop-root-sizes",
      value: [22, 78],
    });
    state = playgroundLayoutReducer(state, {
      type: "set-workspace-sizes",
      value: [44, 56],
    });

    expect(state.chatMinimized).toBe(true);
    expect(state.mobileView).toBe("catalog");
    expect(state.desktopRootSizes).toEqual([22, 78]);
    expect(state.workspaceSizes).toEqual([44, 56]);
  });
});
