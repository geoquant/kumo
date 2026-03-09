import { describe, expect, it } from "vitest";

import { buildStageArtifact } from "~/lib/playground/eval-analysis";
import {
  createScenarioRunPair,
  updateScenarioRunStage,
} from "~/lib/playground/feedback-run";
import {
  createInitialPlaygroundLayoutState,
  createInitialPlaygroundPanelsState,
  playgroundLayoutReducer,
  playgroundPanelsReducer,
} from "~/lib/playground/state";
import { CREATE_WORKER_SCENARIO } from "~/lib/tool-registry";

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

  it("tracks active feedback runs and captured artifacts", () => {
    let state = createInitialPlaygroundPanelsState();

    state = playgroundPanelsReducer(state, {
      type: "start-feedback-run",
      run: createScenarioRunPair({
        id: "run-1",
        scenarioId: CREATE_WORKER_SCENARIO.id,
        timestamp: "2026-03-09T00:00:00.000Z",
        model: "gpt-oss-120b",
        initialPrompt: CREATE_WORKER_SCENARIO.initialPrompt,
      }),
    });

    state = playgroundPanelsReducer(state, {
      type: "capture-feedback-artifact",
      runId: "run-1",
      stage: "confirmation",
      panelId: "b",
      artifact: buildStageArtifact({
        stage: "confirmation",
        panelId: "b",
        promptText: "Confirm worker",
        rawJsonl: '{"ok":true}',
        tree: {
          root: "surface",
          elements: {
            surface: {
              key: "surface",
              type: "Surface",
              props: { heading: "Create worker" },
              children: ["stack"],
            },
            stack: {
              key: "stack",
              type: "Stack",
              props: {},
              children: ["copy", "cancel", "approve"],
              parentKey: "surface",
            },
            copy: {
              key: "copy",
              type: "Text",
              props: { children: "Create a new worker now" },
              parentKey: "stack",
            },
            cancel: {
              key: "cancel",
              type: "Button",
              props: { children: "Cancel" },
              parentKey: "stack",
              action: {
                name: "tool_cancel",
                params: { toolId: "create-worker-a" },
              },
            },
            approve: {
              key: "approve",
              type: "Button",
              props: { children: "Approve" },
              parentKey: "stack",
              action: {
                name: "tool_approve",
                params: { toolId: "create-worker-a" },
              },
            },
          },
        },
      }),
    });

    expect(state.feedback.activeRunId).toBe("run-1");
    expect(state.feedback.runs).toHaveLength(1);
    expect(state.feedback.runs[0]?.stages.confirmation.b?.panelId).toBe("b");
    expect(state.feedback.panelBWarnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "missing-stage",
          stage: "confirmation",
        }),
        expect.objectContaining({ kind: "missing-stage", stage: "followup" }),
      ]),
    );
  });

  it("hydrates feedback history and keeps latest warnings active", () => {
    let run = createScenarioRunPair({
      id: "run-1",
      scenarioId: CREATE_WORKER_SCENARIO.id,
      timestamp: "2026-03-09T00:00:00.000Z",
      model: "gpt-oss-120b",
      initialPrompt: CREATE_WORKER_SCENARIO.initialPrompt,
    });

    run = updateScenarioRunStage(run, {
      stage: "confirmation",
      panelId: "a",
      artifact: buildStageArtifact({
        stage: "confirmation",
        panelId: "a",
        promptText: "Confirm worker",
        rawJsonl: '{"ok":true}',
        tree: {
          root: "surface",
          elements: {
            surface: {
              key: "surface",
              type: "Surface",
              props: { heading: "Create worker" },
              children: ["stack"],
            },
            stack: {
              key: "stack",
              type: "Stack",
              props: {},
              children: ["copy", "cancel", "approve"],
              parentKey: "surface",
            },
            copy: {
              key: "copy",
              type: "Text",
              props: { children: "Create a new worker now" },
              parentKey: "stack",
            },
            cancel: {
              key: "cancel",
              type: "Button",
              props: { children: "Cancel" },
              parentKey: "stack",
              action: {
                name: "tool_cancel",
                params: { toolId: "create-worker-a" },
              },
            },
            approve: {
              key: "approve",
              type: "Button",
              props: { children: "Approve" },
              parentKey: "stack",
              action: {
                name: "tool_approve",
                params: { toolId: "create-worker-a" },
              },
            },
          },
        },
      }),
    });
    run = updateScenarioRunStage(run, {
      stage: "confirmation",
      panelId: "b",
      artifact: buildStageArtifact({
        stage: "confirmation",
        panelId: "b",
        promptText: "Confirm worker",
        rawJsonl: '{"ok":true}',
        tree: {
          root: "surface",
          elements: {
            surface: {
              key: "surface",
              type: "Surface",
              props: { heading: "Create worker" },
              children: ["stack"],
            },
            stack: {
              key: "stack",
              type: "Stack",
              props: {},
              children: ["copy", "cancel", "approve"],
              parentKey: "surface",
            },
            copy: {
              key: "copy",
              type: "Text",
              props: { children: "Create a new worker now" },
              parentKey: "stack",
            },
            cancel: {
              key: "cancel",
              type: "Button",
              props: { children: "Cancel" },
              parentKey: "stack",
              action: {
                name: "tool_cancel",
                params: { toolId: "create-worker-b" },
              },
            },
            approve: {
              key: "approve",
              type: "Button",
              props: { children: "Approve" },
              parentKey: "stack",
              action: {
                name: "tool_approve",
                params: { toolId: "create-worker-b" },
              },
            },
          },
        },
      }),
    });

    const state = playgroundPanelsReducer(
      createInitialPlaygroundPanelsState(),
      {
        type: "hydrate-feedback-runs",
        runs: [run],
      },
    );

    expect(state.feedback.activeRunId).toBe("run-1");
    expect(state.feedback.runs).toEqual([run]);
    expect(state.feedback.panelBWarnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "missing-stage", stage: "followup" }),
      ]),
    );
  });
});
