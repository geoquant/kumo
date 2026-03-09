import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildStageArtifact } from "~/lib/playground/eval-analysis";
import { createPlaygroundFeedbackExport } from "~/lib/playground/feedback-export";
import {
  createScenarioRunPair,
  updateScenarioRunStage,
} from "~/lib/playground/feedback-run";
import { CREATE_WORKER_SCENARIO } from "~/lib/tool-registry";

import { EvalReportPage } from "./_EvalReportPage";

vi.mock("~/components/ThemeToggle", () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

vi.mock("@cloudflare/kumo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@cloudflare/kumo")>();

  return {
    ...actual,
    Button: ({
      children,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button {...props}>{children}</button>
    ),
    CloudflareLogo: () => <div>Cloudflare</div>,
    Empty: ({
      title,
      description,
    }: {
      readonly title: string;
      readonly description: string;
    }) => (
      <div>
        <p>{title}</p>
        <p>{description}</p>
      </div>
    ),
    Loader: () => <div>Loading</div>,
    cn: (...values: Array<string | false | null | undefined>) =>
      values.filter(Boolean).join(" "),
  };
});

class MockFileReader {
  result: string | null = null;
  onload: null | ((this: FileReader, ev: ProgressEvent<FileReader>) => void) =
    null;

  readAsText(file: Blob) {
    void file.text().then((text) => {
      this.result = text;
      this.onload?.call(
        this as unknown as FileReader,
        {} as ProgressEvent<FileReader>,
      );
    });
  }
}

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

function createFeedbackPayload() {
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

  return createPlaygroundFeedbackExport({
    branch: "geoquant/streaming-ui",
    exportedAt: "2026-03-09T01:00:00.000Z",
    runs: [run],
  });
}

describe("EvalReportPage", () => {
  beforeEach(() => {
    vi.stubGlobal("FileReader", MockFileReader);
  });

  it("loads baseline uploads", async () => {
    const { container } = render(<EvalReportPage />);
    const input = container.querySelector('input[type="file"]');

    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Missing file input");
    }

    const file = new File(
      [
        JSON.stringify({
          timestamp: "2026-03-09T00:00:00.000Z",
          args: {},
          prompts: [],
          overall: {},
          overallAllPass: 0,
        }),
      ],
      "baseline.json",
      { type: "application/json" },
    );

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Pass\/Fail Matrix/)).toBeTruthy();
      expect(screen.getByText("baseline")).toBeTruthy();
    });
  });

  it("loads playground feedback exports separately", async () => {
    const { container } = render(<EvalReportPage />);
    const input = container.querySelector('input[type="file"]');

    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Missing file input");
    }

    const file = new File(
      [JSON.stringify(createFeedbackPayload())],
      "feedback.json",
      { type: "application/json" },
    );

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getAllByText("Playground Sessions").length).toBeGreaterThan(
        0,
      );
      expect(screen.getByText(/Warning counts - regression:/)).toBeTruthy();
      expect(screen.getByText(/Combined A/)).toBeTruthy();
    });
  });
});
