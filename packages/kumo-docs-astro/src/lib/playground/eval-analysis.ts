import {
  gradeComposition,
  gradeTree,
  parseJsonlToTree,
} from "@cloudflare/kumo/generative/graders";
import type { UITree } from "@cloudflare/kumo/streaming";

import type {
  EvalMetrics,
  ScenarioCheckResult,
  ScenarioStageArtifact,
} from "~/lib/playground/eval-types";
import { buildNestedTree } from "~/lib/playground/nested-tree";
import type { NestedTreeNode } from "~/lib/playground/types";

const HEADING_VARIANTS = new Set(["heading1", "heading2", "heading3"]);

const WORKER_COPY_PATTERN =
  /\b(create|creating|created|new)\b[\s\S]{0,48}\bworker\b|\bworker\b[\s\S]{0,48}\b(create|creating|created|new)\b/i;

interface NestedTreeMetrics {
  readonly elementCount: number;
  readonly maxDepth: number;
  readonly actionCount: number;
}

function countPassedRules(
  results: readonly { readonly pass: boolean }[],
): number {
  return results.reduce((count, result) => count + (result.pass ? 1 : 0), 0);
}

function buildPassRate(results: readonly { readonly pass: boolean }[]): number {
  return results.length === 0 ? 0 : countPassedRules(results) / results.length;
}

function countJsonlLines(rawJsonl: string): number {
  return rawJsonl.split("\n").filter((line) => line.trim() !== "").length;
}

function isParseableJsonl(rawJsonl: string): boolean {
  if (rawJsonl.trim() === "") {
    return false;
  }

  const parsedTree = parseJsonlToTree(rawJsonl);
  return parsedTree.root !== "" && Object.keys(parsedTree.elements).length > 0;
}

function measureNestedTree(node: NestedTreeNode | null): NestedTreeMetrics {
  if (node === null) {
    return {
      elementCount: 0,
      maxDepth: 0,
      actionCount: 0,
    };
  }

  function visit(current: NestedTreeNode, depth: number): NestedTreeMetrics {
    return current.children.reduce<NestedTreeMetrics>(
      (metrics, child) => {
        const childMetrics = visit(child, depth + 1);
        return {
          elementCount: metrics.elementCount + childMetrics.elementCount,
          maxDepth: Math.max(metrics.maxDepth, childMetrics.maxDepth),
          actionCount: metrics.actionCount + childMetrics.actionCount,
        };
      },
      {
        elementCount: 1,
        maxDepth: depth,
        actionCount: current.action === null ? 0 : 1,
      },
    );
  }

  return visit(node, 0);
}

function buildMetrics(tree: UITree, rawJsonl: string): EvalMetrics {
  const nestedTree = buildNestedTree(tree);
  const nestedMetrics = measureNestedTree(nestedTree);
  const structuralReport = gradeTree(tree);
  const compositionReport = gradeComposition(tree);
  const structuralPassRate = buildPassRate(structuralReport.results);
  const compositionPassRate = buildPassRate(compositionReport.results);

  return {
    structuralPassRate,
    compositionPassRate,
    combinedPassRate: (structuralPassRate + compositionPassRate) / 2,
    elementCount: nestedMetrics.elementCount,
    maxDepth: nestedMetrics.maxDepth,
    jsonlLineCount: countJsonlLines(rawJsonl),
    parseable: isParseableJsonl(rawJsonl),
    actionCount: nestedMetrics.actionCount,
  };
}

function collectVisibleCopy(tree: UITree): string {
  const fragments: string[] = [];

  for (const element of Object.values(tree.elements)) {
    const children = element.props["children"];
    const heading = element.props["heading"];
    const label = element.props["label"];
    const title = element.props["title"];
    const description = element.props["description"];

    if (typeof children === "string") {
      fragments.push(children);
    }
    if (typeof heading === "string") {
      fragments.push(heading);
    }
    if (typeof label === "string") {
      fragments.push(label);
    }
    if (typeof title === "string") {
      fragments.push(title);
    }
    if (typeof description === "string") {
      fragments.push(description);
    }
  }

  return fragments.join(" ");
}

function buildCheck(
  id: string,
  label: string,
  pass: boolean,
  passMessage: string,
  failMessage: string,
): ScenarioCheckResult {
  return {
    id,
    label,
    pass,
    message: pass ? passMessage : failMessage,
  };
}

function buildConfirmationChecks(tree: UITree): readonly ScenarioCheckResult[] {
  const elements = Object.values(tree.elements);
  const actionButtons = elements.filter(
    (element) => element.type === "Button" && element.action !== undefined,
  );
  const actionNames = new Set(
    actionButtons
      .map((element) => element.action?.name)
      .filter((name): name is string => typeof name === "string"),
  );
  const visibleCopy = collectVisibleCopy(tree);

  return [
    buildCheck(
      "root-exists",
      "Root exists",
      tree.root !== "" && tree.elements[tree.root] !== undefined,
      `Root "${tree.root}" exists.`,
      "Missing root element.",
    ),
    buildCheck(
      "two-action-buttons",
      "Exactly two action buttons",
      actionButtons.length === 2,
      "Confirmation UI exposes exactly two action buttons.",
      `Expected 2 action buttons, found ${String(actionButtons.length)}.`,
    ),
    buildCheck(
      "approval-actions",
      "Has tool_cancel and tool_approve",
      actionNames.has("tool_cancel") && actionNames.has("tool_approve"),
      "Confirmation actions include tool_cancel and tool_approve.",
      "Confirmation actions must include tool_cancel and tool_approve.",
    ),
    buildCheck(
      "worker-copy",
      "References worker creation intent",
      WORKER_COPY_PATTERN.test(visibleCopy),
      "Visible copy references creating a worker.",
      "Visible copy does not mention creating a worker.",
    ),
  ];
}

function buildFollowupChecks(tree: UITree): readonly ScenarioCheckResult[] {
  const elements = Object.values(tree.elements);
  const hasHeadingText = elements.some((element) => {
    if (element.type !== "Text") {
      return false;
    }

    const variant = element.props["variant"];
    return typeof variant === "string" && HEADING_VARIANTS.has(variant);
  });
  const hasTable = elements.some((element) => element.type === "Table");
  const hasTableHead = elements.some((element) => element.type === "TableHead");
  const hasTableBody = elements.some((element) => element.type === "TableBody");
  const hasTimeseriesChart = elements.some((element) => {
    if (element.type !== "TimeseriesChart") {
      return false;
    }

    const chartType = element.props["type"];
    return chartType === undefined || chartType === "line";
  });
  const hasTableRowContent = elements.some((element) => {
    if (element.type !== "TableRow") {
      return false;
    }

    return (element.children ?? []).length > 0;
  });

  return [
    buildCheck(
      "cloudflare-logo",
      "Contains CloudflareLogo",
      elements.some((element) => element.type === "CloudflareLogo"),
      "Follow-up UI includes CloudflareLogo.",
      "Follow-up UI is missing CloudflareLogo.",
    ),
    buildCheck(
      "heading-text",
      "Contains heading-like Text",
      hasHeadingText,
      "Follow-up UI includes heading-style Text.",
      "Follow-up UI is missing heading-style Text.",
    ),
    buildCheck(
      "line-chart",
      "Contains line TimeseriesChart",
      hasTimeseriesChart,
      "Follow-up UI includes a line TimeseriesChart.",
      "Follow-up UI is missing a line TimeseriesChart.",
    ),
    buildCheck(
      "status-badge",
      "Contains Badge",
      elements.some((element) => element.type === "Badge"),
      "Follow-up UI includes a Badge.",
      "Follow-up UI is missing a Badge.",
    ),
    buildCheck(
      "deployment-table",
      "Contains deployment table structure",
      hasTable && hasTableHead && hasTableBody && hasTableRowContent,
      "Follow-up UI includes table, head, body, and row content.",
      "Follow-up UI is missing deployment table structure.",
    ),
  ];
}

export function buildStageArtifact(input: {
  readonly stage: ScenarioStageArtifact["stage"];
  readonly panelId: ScenarioStageArtifact["panelId"];
  readonly promptText: string;
  readonly rawJsonl: string;
  readonly tree: UITree;
}): ScenarioStageArtifact {
  const structuralReport = gradeTree(input.tree);
  const compositionReport = gradeComposition(input.tree);

  return {
    stage: input.stage,
    panelId: input.panelId,
    promptText: input.promptText,
    rawJsonl: input.rawJsonl,
    tree: input.tree,
    structuralReport,
    compositionReport,
    metrics: buildMetrics(input.tree, input.rawJsonl),
    checks:
      input.stage === "confirmation"
        ? buildConfirmationChecks(input.tree)
        : buildFollowupChecks(input.tree),
  };
}
