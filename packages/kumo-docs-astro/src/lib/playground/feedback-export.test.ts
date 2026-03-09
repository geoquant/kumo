import { describe, expect, it } from "vitest";

import { buildStageArtifact } from "~/lib/playground/eval-analysis";
import {
  createPlaygroundFeedbackExport,
  parsePlaygroundFeedbackExport,
} from "~/lib/playground/feedback-export";
import {
  createScenarioRunPair,
  updateScenarioRunStage,
} from "~/lib/playground/feedback-run";
import { CREATE_WORKER_SCENARIO } from "~/lib/tool-registry";

function buildConfirmationTree(toolId: string) {
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
        action: { name: "tool_cancel", params: { toolId } },
      },
      approve: {
        key: "approve",
        type: "Button",
        props: { children: "Approve" },
        parentKey: "stack",
        action: { name: "tool_approve", params: { toolId } },
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
          : ["logo", "heading", "badge"],
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

describe("feedback export helpers", () => {
  it("round-trips exported feedback sessions", () => {
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
        tree: buildConfirmationTree("create-worker-a"),
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
        tree: buildConfirmationTree("create-worker-b"),
      }),
    });
    run = updateScenarioRunStage(run, {
      stage: "followup",
      panelId: "a",
      artifact: buildStageArtifact({
        stage: "followup",
        panelId: "a",
        promptText: "Show deployment dashboard",
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
        promptText: "Show deployment dashboard",
        rawJsonl: '{"ok":true}',
        tree: buildFollowupTree(false),
      }),
    });

    const exported = createPlaygroundFeedbackExport({
      branch: "geoquant/streaming-ui",
      exportedAt: "2026-03-09T01:00:00.000Z",
      runs: [run],
    });

    expect(parsePlaygroundFeedbackExport(exported)).toEqual(exported);
  });

  it("rejects invalid feedback payloads", () => {
    expect(
      parsePlaygroundFeedbackExport({
        format: "playground-feedback-v1",
        branch: "geoquant/streaming-ui",
        exportedAt: "2026-03-09T01:00:00.000Z",
        runs: [{ id: "broken" }],
      }),
    ).toBeNull();
  });
});
