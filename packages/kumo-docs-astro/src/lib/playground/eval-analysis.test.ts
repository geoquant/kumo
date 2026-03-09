import { describe, expect, it } from "vitest";

import type { UITree } from "@cloudflare/kumo/streaming";

import { buildStageArtifact } from "~/lib/playground/eval-analysis";

function buildRawJsonl(tree: UITree): string {
  return [
    JSON.stringify({ op: "replace", path: "/root", value: tree.root }),
    JSON.stringify({ op: "replace", path: "/elements", value: tree.elements }),
    "",
  ].join("\n");
}

const CONFIRMATION_TREE: UITree = {
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
      parentKey: "surface",
      children: ["body", "cancel", "approve"],
    },
    body: {
      key: "body",
      type: "Text",
      props: { children: "Create a new hello world worker?" },
      parentKey: "stack",
    },
    cancel: {
      key: "cancel",
      type: "Button",
      props: { children: "Cancel" },
      parentKey: "stack",
      action: {
        name: "tool_cancel",
        params: { toolId: "create-worker-hello-world" },
      },
    },
    approve: {
      key: "approve",
      type: "Button",
      props: { children: "Approve" },
      parentKey: "stack",
      action: {
        name: "tool_approve",
        params: { toolId: "create-worker-hello-world" },
      },
    },
  },
};

const FOLLOWUP_TREE: UITree = {
  root: "surface",
  elements: {
    surface: {
      key: "surface",
      type: "Surface",
      props: { heading: "Deployment dashboard" },
      children: ["stack"],
    },
    stack: {
      key: "stack",
      type: "Stack",
      props: {},
      parentKey: "surface",
      children: ["logo", "title", "chart", "badge", "table"],
    },
    logo: {
      key: "logo",
      type: "CloudflareLogo",
      props: { variant: "glyph" },
      parentKey: "stack",
    },
    title: {
      key: "title",
      type: "Text",
      props: {
        variant: "heading1",
        children: "hello-world deployment dashboard",
      },
      parentKey: "stack",
    },
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
      parentKey: "stack",
    },
    badge: {
      key: "badge",
      type: "Badge",
      props: { children: "Deployed", variant: "success" },
      parentKey: "stack",
    },
    table: {
      key: "table",
      type: "Table",
      props: {},
      parentKey: "stack",
      children: ["head", "body"],
    },
    head: {
      key: "head",
      type: "TableHead",
      props: {},
      parentKey: "table",
      children: ["head-row"],
    },
    "head-row": {
      key: "head-row",
      type: "TableRow",
      props: {},
      parentKey: "head",
      children: ["head-cell"],
    },
    "head-cell": {
      key: "head-cell",
      type: "TableCell",
      props: { children: "Deployment" },
      parentKey: "head-row",
    },
    body: {
      key: "body",
      type: "TableBody",
      props: {},
      parentKey: "table",
      children: ["body-row"],
    },
    "body-row": {
      key: "body-row",
      type: "TableRow",
      props: {},
      parentKey: "body",
      children: ["body-cell"],
    },
    "body-cell": {
      key: "body-cell",
      type: "TableCell",
      props: { children: "prod" },
      parentKey: "body-row",
    },
  },
};

describe("buildStageArtifact", () => {
  it("builds confirmation-stage metrics and checks from raw jsonl and tree", () => {
    const artifact = buildStageArtifact({
      stage: "confirmation",
      panelId: "a",
      promptText: "create a new hello world worker",
      rawJsonl: buildRawJsonl(CONFIRMATION_TREE),
      tree: CONFIRMATION_TREE,
    });

    expect(artifact.metrics).toMatchObject({
      elementCount: 5,
      maxDepth: 2,
      jsonlLineCount: 2,
      parseable: true,
      actionCount: 2,
    });
    expect(artifact.checks.map((check) => [check.id, check.pass])).toEqual([
      ["root-exists", true],
      ["two-action-buttons", true],
      ["approval-actions", true],
      ["worker-copy", true],
    ]);
    expect(artifact.metrics.structuralPassRate).toBeGreaterThanOrEqual(0);
    expect(artifact.metrics.compositionPassRate).toBeGreaterThanOrEqual(0);
    expect(artifact.metrics.combinedPassRate).toBeGreaterThanOrEqual(0);
  });

  it("builds followup-stage checks for dashboard artifacts", () => {
    const artifact = buildStageArtifact({
      stage: "followup",
      panelId: "b",
      promptText: "Generate a deployment dashboard",
      rawJsonl: buildRawJsonl(FOLLOWUP_TREE),
      tree: FOLLOWUP_TREE,
    });

    expect(artifact.metrics).toMatchObject({
      elementCount: 13,
      maxDepth: 5,
      jsonlLineCount: 2,
      parseable: true,
      actionCount: 0,
    });
    expect(artifact.checks.map((check) => [check.id, check.pass])).toEqual([
      ["cloudflare-logo", true],
      ["heading-text", true],
      ["line-chart", true],
      ["status-badge", true],
      ["deployment-table", true],
    ]);
  });

  it("marks invalid jsonl and missing followup UI affordances", () => {
    const artifact = buildStageArtifact({
      stage: "followup",
      panelId: "b",
      promptText: "Generate a deployment dashboard",
      rawJsonl: "not valid jsonl",
      tree: {
        root: "surface",
        elements: {
          surface: {
            key: "surface",
            type: "Surface",
            props: {},
            children: ["body"],
          },
          body: {
            key: "body",
            type: "Text",
            props: { children: "plain text" },
            parentKey: "surface",
          },
        },
      },
    });

    expect(artifact.metrics.parseable).toBe(false);
    expect(artifact.metrics.jsonlLineCount).toBe(1);
    expect(artifact.checks.map((check) => [check.id, check.pass])).toEqual([
      ["cloudflare-logo", false],
      ["heading-text", false],
      ["line-chart", false],
      ["status-badge", false],
      ["deployment-table", false],
    ]);
  });
});
