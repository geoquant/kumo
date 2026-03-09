import { describe, expect, it } from "vitest";

import type { UITree } from "@cloudflare/kumo/streaming";

import {
  buildScenarioExport,
  evaluateCreateWorkerScenario,
  formatScenarioSummary,
  parseEvalCliArgs,
  type ScenarioRequest,
  type ScenarioResponse,
} from "./eval-playground-scenario";

function buildConfirmationTree(toolId: string): UITree {
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

function buildFollowupTree(includeTable: boolean): UITree {
  return {
    root: "surface",
    elements: {
      surface: {
        key: "surface",
        type: "Surface",
        props: { heading: "Deployment dashboard" },
        children: includeTable
          ? ["logo", "heading", "badge", "table"]
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

describe("eval-playground-scenario", () => {
  it("parses CLI args", () => {
    expect(
      parseEvalCliArgs([
        "--model",
        "glm-4.7-flash",
        "--url",
        "http://localhost:9999",
        "--json",
      ]),
    ).toEqual({
      baseUrl: "http://localhost:9999",
      branch: "geoquant/streaming-ui",
      model: "glm-4.7-flash",
      json: true,
    });
  });

  it("fails fast for missing option values", () => {
    expect(() => parseEvalCliArgs(["--model", "--json"])).toThrowError(
      "Missing value for --model",
    );
  });

  it("evaluates the create-worker scenario and keeps soft warnings non-fatal", async () => {
    const requests: ScenarioRequest[] = [];

    const requester = async (
      request: ScenarioRequest,
    ): Promise<ScenarioResponse> => {
      requests.push(request);

      const message = String(request.body.message ?? "");
      const isPanelB = request.body.skipSystemPrompt === true;

      if (message.includes("Ask me to confirm")) {
        return {
          rawJsonl: '{"confirmation":true}',
          tree: buildConfirmationTree(
            isPanelB ? "create-worker-b" : "create-worker-a",
          ),
        };
      }

      return {
        rawJsonl: '{"followup":true}',
        tree: isPanelB ? buildFollowupTree(false) : buildFollowupTree(true),
      };
    };

    const run = await evaluateCreateWorkerScenario(
      {
        baseUrl: "http://127.0.0.1:4321",
        branch: "geoquant/streaming-ui",
        model: "gpt-oss-120b",
        json: false,
      },
      requester,
    );

    expect(requests).toHaveLength(4);
    expect(requests[1]?.body["skipSystemPrompt"]).toBe(true);
    expect(requests[3]?.body["skipSystemPrompt"]).toBe(true);
    expect(requests[2]?.body["history"]).toEqual([
      { role: "user", content: "create a new hello world worker" },
    ]);
    expect(typeof requests[2]?.body["currentUITree"]).toBe("string");
    expect(run.comparison?.warnings.length).toBeGreaterThan(0);

    const summary = formatScenarioSummary(run);
    expect(summary).toContain("Create worker backstop");
    expect(summary).toContain("warnings");

    const payload = buildScenarioExport(run, "geoquant/streaming-ui");
    expect(payload.format).toBe("playground-feedback-v1");
    expect(payload.branch).toBe("geoquant/streaming-ui");
    expect(payload.runs).toHaveLength(1);
  });
});
