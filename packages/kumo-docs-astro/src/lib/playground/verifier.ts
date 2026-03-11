import {
  getUnknownTypes,
  isRenderableTree,
  normalizeTree,
  validateElement,
} from "@cloudflare/kumo/generative";
import {
  gradeComposition,
  gradeTree,
  type GradeReport,
} from "@cloudflare/kumo/generative/graders";
import {
  EMPTY_TREE,
  applyPatch,
  parsePatchLine,
  type JsonPatchOp,
  type UITree,
} from "@cloudflare/kumo/streaming";

export type PlaygroundVerifierStatus = "pass" | "warn" | "fail";

export interface PlaygroundVerifierThresholds {
  readonly maxPromptChars: number;
  readonly maxPromptTokensEstimate: number;
  readonly maxSseBytes: number;
  readonly maxAssistantChars: number;
  readonly maxPatchOps: number;
  readonly maxTreeDepth: number;
  readonly maxRepairCount: number;
  readonly maxStrippedProps: number;
  readonly maxMalformedStructureCount: number;
  readonly maxUnknownTypes: number;
  readonly maxDroppedLines: number;
}

export interface PlaygroundVerifierRequest {
  readonly message: string;
  readonly model: string;
  readonly promptText?: string;
}

export interface PlaygroundVerifierReport {
  readonly prompt: {
    readonly message: string;
    readonly model: string;
    readonly promptChars: number;
    readonly promptTokenEstimate: number;
  };
  readonly stream: {
    readonly sseBytes: number;
    readonly assistantChars: number;
    readonly jsonlLineCount: number;
    readonly patchOpCount: number;
    readonly droppedLineCount: number;
  };
  readonly tree: {
    readonly renderable: boolean;
    readonly elementCount: number;
    readonly maxDepth: number;
    readonly unknownTypeCount: number;
    readonly missingChildRefCount: number;
    readonly malformedStructureCount: number;
  };
  readonly validation: {
    readonly repairedElementCount: number;
    readonly strippedPropCount: number;
    readonly unrepairedInvalidElementCount: number;
    readonly normalizationDiffCount: number;
  };
  readonly grading: {
    readonly structuralScore: number;
    readonly compositionScore: number;
    readonly structuralViolations: number;
    readonly compositionViolations: number;
    readonly structuralReport: GradeReport;
    readonly compositionReport: GradeReport;
  };
  readonly status: PlaygroundVerifierStatus;
  readonly reasons: readonly string[];
  readonly assistantJsonl: string;
}

interface ParsedAssistantStream {
  readonly assistantJsonl: string;
  readonly sseBytes: number;
  readonly assistantChars: number;
}

interface ReplayedJsonl {
  readonly tree: UITree;
  readonly patchOps: readonly JsonPatchOp[];
  readonly jsonlLineCount: number;
  readonly droppedLineCount: number;
}

interface ValidationMetrics {
  readonly repairedElementCount: number;
  readonly strippedPropCount: number;
  readonly unrepairedInvalidElementCount: number;
}

interface TreeMetrics {
  readonly elementCount: number;
  readonly maxDepth: number;
  readonly missingChildRefCount: number;
}

const DEFAULT_PLAYGROUND_VERIFIER_THRESHOLDS: PlaygroundVerifierThresholds = {
  maxPromptChars: 100_000,
  maxPromptTokensEstimate: 25_000,
  maxSseBytes: 2_000_000,
  maxAssistantChars: 500_000,
  maxPatchOps: 250,
  maxTreeDepth: 12,
  maxRepairCount: 12,
  maxStrippedProps: 24,
  maxMalformedStructureCount: 0,
  maxUnknownTypes: 0,
  maxDroppedLines: 0,
};

const TABLE_ALLOWED_CHILDREN: Readonly<Record<string, ReadonlySet<string>>> = {
  Table: new Set(["TableHeader", "TableBody"]),
  TableHeader: new Set(["TableRow"]),
  TableBody: new Set(["TableRow"]),
  TableRow: new Set(["TableHead", "TableCell"]),
  TableHead: new Set([]),
  TableCell: new Set([]),
};

const STRUCTURAL_CHILDREN_RULES: Readonly<Record<string, ReadonlySet<string>>> =
  {
    ...TABLE_ALLOWED_CHILDREN,
    Select: new Set(["SelectOption"]),
    RadioGroup: new Set(["RadioItem"]),
  };

function countUtf8Bytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

function estimateTokens(value: string): number {
  return Math.ceil(value.length / 4);
}

function countPassedRules(report: GradeReport): number {
  return report.results.reduce(
    (count, result) => count + (result.pass ? 1 : 0),
    0,
  );
}

function countViolations(report: GradeReport): number {
  return report.results.reduce(
    (count, result) => count + result.violations.length,
    0,
  );
}

function parseSseDataBlock(payload: string): string {
  const trimmed = payload.trim();
  if (trimmed === "" || trimmed === "[DONE]") {
    return "";
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null) {
      return "";
    }

    const record = parsed as Record<string, unknown>;
    if (typeof record.response === "string") {
      return record.response;
    }

    if (!Array.isArray(record.choices) || record.choices.length === 0) {
      return "";
    }

    const firstChoice = record.choices[0];
    if (typeof firstChoice !== "object" || firstChoice === null) {
      return "";
    }

    const choice = firstChoice as Record<string, unknown>;
    if (typeof choice.text === "string") {
      return choice.text;
    }

    if (typeof choice.delta !== "object" || choice.delta === null) {
      return "";
    }

    const delta = choice.delta as Record<string, unknown>;
    if (typeof delta.content === "string") {
      return delta.content;
    }
    if (typeof delta.text === "string") {
      return delta.text;
    }

    return "";
  } catch {
    return payload;
  }
}

export function extractAssistantJsonlFromSse(rawSse: string): string {
  const tokens: string[] = [];
  let pendingDataLines: string[] = [];

  function flushPending(): void {
    if (pendingDataLines.length === 0) {
      return;
    }
    const token = parseSseDataBlock(pendingDataLines.join("\n"));
    if (token !== "") {
      tokens.push(token);
    }
    pendingDataLines = [];
  }

  for (const rawLine of rawSse.split("\n")) {
    const line = rawLine.replace(/\r/g, "");
    if (line.trim() === "") {
      flushPending();
      continue;
    }
    if (line.startsWith(":")) {
      continue;
    }
    if (!line.startsWith("data:")) {
      continue;
    }
    pendingDataLines.push(line.slice("data:".length).trimStart());
  }

  flushPending();
  return tokens.join("");
}

function buildAssistantStream(input: {
  readonly rawSse?: string;
  readonly assistantJsonl?: string;
}): ParsedAssistantStream {
  const assistantJsonl =
    input.assistantJsonl ??
    (input.rawSse ? extractAssistantJsonlFromSse(input.rawSse) : "");

  return {
    assistantJsonl,
    sseBytes: input.rawSse ? countUtf8Bytes(input.rawSse) : 0,
    assistantChars: assistantJsonl.length,
  };
}

function replayJsonl(assistantJsonl: string): ReplayedJsonl {
  const trimmedLines = assistantJsonl
    .split("\n")
    .filter((line) => line.trim() !== "" && !line.trim().startsWith("```"));

  const patchOps: JsonPatchOp[] = [];
  let droppedLineCount = 0;

  for (const line of trimmedLines) {
    const parsed = parsePatchLine(line);
    if (parsed === null) {
      droppedLineCount += 1;
      continue;
    }
    patchOps.push(parsed);
  }

  let tree: UITree = { ...EMPTY_TREE, elements: {} };
  for (const patchOp of patchOps) {
    tree = applyPatch(tree, patchOp);
  }

  return {
    tree,
    patchOps,
    jsonlLineCount: trimmedLines.length,
    droppedLineCount,
  };
}

function countNormalizationDiffs(before: UITree, after: UITree): number {
  let diffCount = before.root === after.root ? 0 : 1;
  const keys = new Set([
    ...Object.keys(before.elements),
    ...Object.keys(after.elements),
  ]);

  for (const key of keys) {
    const left = before.elements[key] ?? null;
    const right = after.elements[key] ?? null;
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      diffCount += 1;
    }
  }

  return diffCount;
}

function measureTree(tree: UITree): TreeMetrics {
  if (tree.root === "" || tree.elements[tree.root] === undefined) {
    return {
      elementCount: 0,
      maxDepth: 0,
      missingChildRefCount: 0,
    };
  }

  let elementCount = 0;
  let maxDepth = 0;
  let missingChildRefCount = 0;
  const visited = new Set<string>();

  function visit(key: string, depth: number): void {
    if (visited.has(key)) {
      return;
    }
    visited.add(key);

    const element = tree.elements[key];
    if (element === undefined) {
      missingChildRefCount += 1;
      return;
    }

    elementCount += 1;
    maxDepth = Math.max(maxDepth, depth);

    for (const childKey of element.children ?? []) {
      if (tree.elements[childKey] === undefined) {
        missingChildRefCount += 1;
        continue;
      }
      visit(childKey, depth + 1);
    }
  }

  visit(tree.root, 0);

  return {
    elementCount,
    maxDepth,
    missingChildRefCount,
  };
}

function countMalformedStructures(tree: UITree): number {
  let count = 0;

  for (const element of Object.values(tree.elements)) {
    const allowedChildren = STRUCTURAL_CHILDREN_RULES[element.type];
    if (allowedChildren === undefined) {
      continue;
    }

    for (const childKey of element.children ?? []) {
      const child = tree.elements[childKey];
      if (child === undefined) {
        continue;
      }
      if (!allowedChildren.has(child.type)) {
        count += 1;
      }
    }

    if (
      TABLE_ALLOWED_CHILDREN[element.type] !== undefined &&
      (element.children ?? []).length === 0 &&
      (element.type === "Table" ||
        element.type === "TableHeader" ||
        element.type === "TableBody" ||
        element.type === "TableRow")
    ) {
      count += 1;
    }
  }

  return count;
}

function buildValidationMetrics(tree: UITree): ValidationMetrics {
  let repairedElementCount = 0;
  let strippedPropCount = 0;
  let unrepairedInvalidElementCount = 0;

  for (const element of Object.values(tree.elements)) {
    const validation = validateElement(element);
    if (validation.valid) {
      continue;
    }

    const topLevelProps = new Set(
      validation.issues
        .map((issue) => issue.path)
        .filter((path) => path !== "(root)" && !path.includes(".")),
    );

    if (topLevelProps.size === 0) {
      unrepairedInvalidElementCount += 1;
      continue;
    }

    repairedElementCount += 1;
    strippedPropCount += topLevelProps.size;
  }

  return {
    repairedElementCount,
    strippedPropCount,
    unrepairedInvalidElementCount,
  };
}

function buildStatus(input: {
  readonly report: Omit<PlaygroundVerifierReport, "status" | "reasons">;
  readonly thresholds: PlaygroundVerifierThresholds;
}): {
  readonly status: PlaygroundVerifierStatus;
  readonly reasons: readonly string[];
} {
  const failReasons: string[] = [];
  const warnReasons: string[] = [];
  const { report, thresholds } = input;

  if (report.stream.patchOpCount === 0) {
    failReasons.push("No patch ops generated.");
  }
  if (!report.tree.renderable) {
    failReasons.push("Tree is not renderable.");
  }
  if (report.prompt.promptChars > thresholds.maxPromptChars) {
    failReasons.push("Prompt chars exceed verifier budget.");
  }
  if (report.prompt.promptTokenEstimate > thresholds.maxPromptTokensEstimate) {
    failReasons.push("Prompt token estimate exceeds verifier budget.");
  }
  if (report.stream.sseBytes > thresholds.maxSseBytes) {
    failReasons.push("SSE bytes exceed verifier budget.");
  }
  if (report.stream.assistantChars > thresholds.maxAssistantChars) {
    failReasons.push("Assistant content exceeds verifier budget.");
  }
  if (report.stream.patchOpCount > thresholds.maxPatchOps) {
    failReasons.push("Patch op count exceeds verifier budget.");
  }
  if (report.stream.droppedLineCount > thresholds.maxDroppedLines) {
    failReasons.push("Dropped JSONL lines exceed verifier budget.");
  }
  if (report.tree.maxDepth > thresholds.maxTreeDepth) {
    failReasons.push("Tree depth exceeds verifier budget.");
  }
  if (report.tree.unknownTypeCount > thresholds.maxUnknownTypes) {
    failReasons.push("Unknown component types exceed verifier budget.");
  }
  if (
    report.tree.malformedStructureCount > thresholds.maxMalformedStructureCount
  ) {
    failReasons.push("Malformed compound structure exceeds verifier budget.");
  }
  if (report.validation.repairedElementCount > thresholds.maxRepairCount) {
    failReasons.push("Repair count exceeds verifier budget.");
  }
  if (report.validation.strippedPropCount > thresholds.maxStrippedProps) {
    failReasons.push("Stripped prop count exceeds verifier budget.");
  }
  if (report.validation.unrepairedInvalidElementCount > 0) {
    failReasons.push("Unrepaired invalid elements remain.");
  }

  if (report.validation.repairedElementCount > 0) {
    warnReasons.push("Element repairs were required.");
  }
  if (report.validation.normalizationDiffCount > 0) {
    warnReasons.push("Tree normalization changed generated output.");
  }
  if (report.grading.structuralViolations > 0) {
    warnReasons.push("Structural grading found violations.");
  }
  if (report.grading.compositionViolations > 0) {
    warnReasons.push("Composition grading found violations.");
  }

  if (failReasons.length > 0) {
    return { status: "fail", reasons: failReasons };
  }
  if (warnReasons.length > 0) {
    return { status: "warn", reasons: warnReasons };
  }
  return { status: "pass", reasons: [] };
}

export function buildPlaygroundVerifierReport(input: {
  readonly request: PlaygroundVerifierRequest;
  readonly rawSse?: string;
  readonly assistantJsonl?: string;
  readonly thresholds?: Partial<PlaygroundVerifierThresholds>;
}): PlaygroundVerifierReport {
  const thresholds: PlaygroundVerifierThresholds = {
    ...DEFAULT_PLAYGROUND_VERIFIER_THRESHOLDS,
    ...input.thresholds,
  };
  const promptText = input.request.promptText ?? input.request.message;
  const assistantStream = buildAssistantStream({
    rawSse: input.rawSse,
    assistantJsonl: input.assistantJsonl,
  });
  const replayed = replayJsonl(assistantStream.assistantJsonl);
  const normalizedTree = normalizeTree(replayed.tree);
  const treeMetrics = measureTree(normalizedTree);
  const structuralReport = gradeTree(normalizedTree);
  const compositionReport = gradeComposition(normalizedTree);
  const validationMetrics = buildValidationMetrics(normalizedTree);

  const baseReport = {
    prompt: {
      message: input.request.message,
      model: input.request.model,
      promptChars: promptText.length,
      promptTokenEstimate: estimateTokens(promptText),
    },
    stream: {
      sseBytes: assistantStream.sseBytes,
      assistantChars: assistantStream.assistantChars,
      jsonlLineCount: replayed.jsonlLineCount,
      patchOpCount: replayed.patchOps.length,
      droppedLineCount: replayed.droppedLineCount,
    },
    tree: {
      renderable: isRenderableTree(normalizedTree),
      elementCount: treeMetrics.elementCount,
      maxDepth: treeMetrics.maxDepth,
      unknownTypeCount: getUnknownTypes(normalizedTree).length,
      missingChildRefCount: treeMetrics.missingChildRefCount,
      malformedStructureCount: countMalformedStructures(normalizedTree),
    },
    validation: {
      ...validationMetrics,
      normalizationDiffCount: countNormalizationDiffs(
        replayed.tree,
        normalizedTree,
      ),
    },
    grading: {
      structuralScore: countPassedRules(structuralReport),
      compositionScore: countPassedRules(compositionReport),
      structuralViolations: countViolations(structuralReport),
      compositionViolations: countViolations(compositionReport),
      structuralReport,
      compositionReport,
    },
    assistantJsonl: assistantStream.assistantJsonl,
  };

  const status = buildStatus({ report: baseReport, thresholds });

  return {
    ...baseReport,
    status: status.status,
    reasons: status.reasons,
  };
}

export { DEFAULT_PLAYGROUND_VERIFIER_THRESHOLDS };
