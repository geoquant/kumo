import { describe, expect, it } from "vitest";

import { buildStageArtifact } from "~/lib/playground/eval-analysis";
import {
  createScenarioRunPair,
  getScenarioRunWarnings,
  isScenarioRunComplete,
  updateScenarioRunStage,
} from "~/lib/playground/feedback-run";
import { CREATE_WORKER_SCENARIO } from "~/lib/tool-registry";

function buildConfirmationTree() {
  return {
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
        action: { name: "tool_cancel", params: { toolId: "create-worker-a" } },
      },
      approve: {
        key: "approve",
        type: "Button",
        props: { children: "Approve" },
        parentKey: "stack",
        action: { name: "tool_approve", params: { toolId: "create-worker-a" } },
      },
    },
  };
}

function buildFollowupTree(includeTable: boolean) {
  return {
    root: "surface",
    elements: {
      surface: {
        key: "surface",
        type: "Surface",
        props: { heading: "Deployment dashboard" },
        children: includeTable
          ? ["logo", "heading", "chart", "badge", "table"]
          : ["heading", "badge"],
      },
      logo: {
        key: "logo",
        type: "CloudflareLogo",
        props: {},
        parentKey: "surface",
      },
      heading: {
        key: "heading",
        type: "Text",
        props: { children: "hello-world", variant: "heading2" },
        parentKey: "surface",
      },
      ...(includeTable
        ? {
            chart: {
              key: "chart",
              type: "TimeseriesChart",
              props: {
                data: [
                  {
                    name: "Requests",
                    data: [
                      [1710000000000, 10],
                      [1710000060000, 18],
                    ],
                    color: "#f38020",
                  },
                ],
              },
              parentKey: "surface",
            },
          }
        : {}),
      badge: {
        key: "badge",
        type: "Badge",
        props: { children: "Active" },
        parentKey: "surface",
      },
      ...(includeTable
        ? {
            table: {
              key: "table",
              type: "Table",
              props: {},
              children: ["head", "body"],
              parentKey: "surface",
            },
            head: {
              key: "head",
              type: "TableHead",
              props: {},
              children: ["head-row"],
              parentKey: "table",
            },
            "head-row": {
              key: "head-row",
              type: "TableRow",
              props: {},
              children: ["name-head"],
              parentKey: "head",
            },
            "name-head": {
              key: "name-head",
              type: "TableHeadCell",
              props: { children: "Name" },
              parentKey: "head-row",
            },
            body: {
              key: "body",
              type: "TableBody",
              props: {},
              children: ["row"],
              parentKey: "table",
            },
            row: {
              key: "row",
              type: "TableRow",
              props: {},
              children: ["cell"],
              parentKey: "body",
            },
            cell: {
              key: "cell",
              type: "TableCell",
              props: { children: "hello-world" },
              parentKey: "row",
            },
          }
        : {}),
    },
  };
}

describe("feedback run helpers", () => {
  it("tracks staged artifacts and completion state", () => {
    let run = createScenarioRunPair({
      id: "run-1",
      scenarioId: CREATE_WORKER_SCENARIO.id,
      timestamp: "2026-03-09T00:00:00.000Z",
      model: "gpt-oss-120b",
      initialPrompt: CREATE_WORKER_SCENARIO.initialPrompt,
    });

    const confirmationA = buildStageArtifact({
      stage: "confirmation",
      panelId: "a",
      promptText: "Confirm worker",
      rawJsonl: '{"ok":true}',
      tree: buildConfirmationTree(),
    });
    const confirmationB = buildStageArtifact({
      stage: "confirmation",
      panelId: "b",
      promptText: "Confirm worker",
      rawJsonl: '{"ok":true}',
      tree: buildConfirmationTree(),
    });
    const followupA = buildStageArtifact({
      stage: "followup",
      panelId: "a",
      promptText: "Show deployments",
      rawJsonl: '{"ok":true}',
      tree: buildFollowupTree(true),
    });
    const followupB = buildStageArtifact({
      stage: "followup",
      panelId: "b",
      promptText: "Show deployments",
      rawJsonl: '{"ok":true}',
      tree: buildFollowupTree(false),
    });

    run = updateScenarioRunStage(run, {
      stage: "confirmation",
      panelId: "a",
      artifact: confirmationA,
    });
    run = updateScenarioRunStage(run, {
      stage: "confirmation",
      panelId: "b",
      artifact: confirmationB,
    });

    expect(isScenarioRunComplete(run)).toBe(false);

    run = updateScenarioRunStage(run, {
      stage: "followup",
      panelId: "a",
      artifact: followupA,
    });
    run = updateScenarioRunStage(run, {
      stage: "followup",
      panelId: "b",
      artifact: followupB,
    });

    expect(isScenarioRunComplete(run)).toBe(true);
    expect(getScenarioRunWarnings(run)).not.toHaveLength(0);
  });

  it("treats followup completion as enough for workspace feedback", () => {
    let run = createScenarioRunPair({
      id: "run-2",
      scenarioId: CREATE_WORKER_SCENARIO.id,
      timestamp: "2026-03-09T00:00:00.000Z",
      model: "gpt-oss-120b",
      initialPrompt: CREATE_WORKER_SCENARIO.initialPrompt,
    });

    run = updateScenarioRunStage(run, {
      stage: "followup",
      panelId: "a",
      artifact: buildStageArtifact({
        stage: "followup",
        panelId: "a",
        promptText: "Show deployments",
        rawJsonl: '{"ok":true}',
        tree: buildFollowupTree(true),
      }),
    });
    run = updateScenarioRunStage(run, {
      stage: "followup",
      panelId: "b",
      artifact: buildStageArtifact({
        stage: "followup",
        panelId: "b",
        promptText: "Show deployments",
        rawJsonl: '{"ok":true}',
        tree: buildFollowupTree(false),
      }),
    });

    expect(isScenarioRunComplete(run)).toBe(true);
    expect(getScenarioRunWarnings(run)).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "missing-stage",
          stage: "confirmation",
        }),
      ]),
    );
  });
});
