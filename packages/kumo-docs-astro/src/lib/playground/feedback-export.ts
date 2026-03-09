import type { GradeReport } from "@cloudflare/kumo/generative/graders";
import type { UIElement, UITree } from "@cloudflare/kumo/streaming";

import {
  PLAYGROUND_FEEDBACK_EXPORT_FORMAT,
  type ComparisonSummary,
  type EvalArtifactStageId,
  type EvalMetrics,
  type PlaygroundFeedbackExport,
  type RegressionWarning,
  type ScenarioCheckResult,
  type ScenarioRunPair,
  type ScenarioStageArtifact,
  type StageScorePair,
} from "~/lib/playground/eval-types";
import type { PanelId } from "~/lib/playground/types";

export function createPlaygroundFeedbackExport(input: {
  readonly branch: string;
  readonly exportedAt: string;
  readonly runs: readonly ScenarioRunPair[];
}): PlaygroundFeedbackExport {
  return {
    format: PLAYGROUND_FEEDBACK_EXPORT_FORMAT,
    branch: input.branch,
    exportedAt: input.exportedAt,
    runs: input.runs,
  };
}

export function parsePlaygroundFeedbackExport(
  value: unknown,
): PlaygroundFeedbackExport | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.format !== PLAYGROUND_FEEDBACK_EXPORT_FORMAT) {
    return null;
  }

  const branch = readString(value, "branch");
  const exportedAt = readString(value, "exportedAt");
  const runs = parseRuns(value.runs);

  if (branch === null || exportedAt === null || runs === null) {
    return null;
  }

  return createPlaygroundFeedbackExport({
    branch,
    exportedAt,
    runs,
  });
}

export function parsePlaygroundFeedbackExportText(
  text: string,
): PlaygroundFeedbackExport | null {
  try {
    return parsePlaygroundFeedbackExport(JSON.parse(text));
  } catch {
    return null;
  }
}

function parseRuns(value: unknown): readonly ScenarioRunPair[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const runs: ScenarioRunPair[] = [];
  for (const item of value) {
    const run = parseRun(item);
    if (run === null) {
      return null;
    }
    runs.push(run);
  }

  return runs;
}

function parseRun(value: unknown): ScenarioRunPair | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value, "id");
  const scenarioId = value.scenarioId;
  const timestamp = readString(value, "timestamp");
  const model = readString(value, "model");
  const initialPrompt = readString(value, "initialPrompt");
  const stages = parseRunStages(value.stages);
  const comparison =
    value.comparison === null
      ? null
      : value.comparison === undefined
        ? null
        : parseComparisonSummary(value.comparison);

  if (
    id === null ||
    scenarioId !== "create-worker" ||
    timestamp === null ||
    model === null ||
    initialPrompt === null ||
    stages === null ||
    (value.comparison !== null &&
      value.comparison !== undefined &&
      comparison === null)
  ) {
    return null;
  }

  return {
    id,
    scenarioId,
    timestamp,
    model,
    initialPrompt,
    stages,
    comparison,
  };
}

function parseRunStages(value: unknown): ScenarioRunPair["stages"] | null {
  if (!isRecord(value)) {
    return null;
  }

  const confirmation = parseStagePair(value.confirmation);
  const followup = parseStagePair(value.followup);

  if (confirmation === null || followup === null) {
    return null;
  }

  return {
    confirmation,
    followup,
  };
}

function parseStagePair(
  value: unknown,
): ScenarioRunPair["stages"][EvalArtifactStageId] | null {
  if (!isRecord(value)) {
    return null;
  }

  const a = parseNullableStageArtifact(value.a);
  const b = parseNullableStageArtifact(value.b);

  if (a === undefined || b === undefined) {
    return null;
  }

  return { a, b };
}

function parseNullableStageArtifact(
  value: unknown,
): ScenarioStageArtifact | null | undefined {
  if (value === null) {
    return null;
  }

  if (value === undefined) {
    return undefined;
  }

  return parseStageArtifact(value);
}

function parseStageArtifact(value: unknown): ScenarioStageArtifact | null {
  if (!isRecord(value)) {
    return null;
  }

  const stage = parseStageId(value.stage);
  const panelId = parsePanelId(value.panelId);
  const promptText = readString(value, "promptText");
  const rawJsonl = readString(value, "rawJsonl");
  const tree = parseTree(value.tree);
  const structuralReport = parseGradeReport(value.structuralReport);
  const compositionReport = parseGradeReport(value.compositionReport);
  const metrics = parseMetrics(value.metrics);
  const checks = parseChecks(value.checks);

  if (
    stage === null ||
    panelId === null ||
    promptText === null ||
    rawJsonl === null ||
    tree === null ||
    structuralReport === null ||
    compositionReport === null ||
    metrics === null ||
    checks === null
  ) {
    return null;
  }

  return {
    stage,
    panelId,
    promptText,
    rawJsonl,
    tree,
    structuralReport,
    compositionReport,
    metrics,
    checks,
  };
}

function parseComparisonSummary(value: unknown): ComparisonSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  const warnings = parseWarnings(value.warnings);
  const winner = parseWinner(value.winner);
  const stageScores = parseStageScores(value.stageScores);

  if (warnings === null || winner === null || stageScores === null) {
    return null;
  }

  return {
    warnings,
    winner,
    stageScores,
  };
}

function parseWarnings(value: unknown): readonly RegressionWarning[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const warnings: RegressionWarning[] = [];
  for (const item of value) {
    const warning = parseWarning(item);
    if (warning === null) {
      return null;
    }
    warnings.push(warning);
  }

  return warnings;
}

function parseWarning(value: unknown): RegressionWarning | null {
  if (!isRecord(value)) {
    return null;
  }

  const kind = value.kind;
  const stage = parseEvalStageId(value.stage);
  const rule = readString(value, "rule");
  const message = readString(value, "message");
  const delta = parseNullableNumber(value.delta);

  if (
    (kind !== "regression" &&
      kind !== "threshold" &&
      kind !== "missing-stage") ||
    stage === null ||
    rule === null ||
    message === null ||
    delta === undefined
  ) {
    return null;
  }

  return {
    kind,
    stage,
    rule,
    message,
    delta,
  };
}

function parseStageScores(
  value: unknown,
): ComparisonSummary["stageScores"] | null {
  if (!isRecord(value)) {
    return null;
  }

  const confirmation = parseStageScorePair(value.confirmation);
  const followup = parseStageScorePair(value.followup);
  const combined = parseStageScorePair(value.combined);

  if (confirmation === null || followup === null || combined === null) {
    return null;
  }

  return {
    confirmation,
    followup,
    combined,
  };
}

function parseStageScorePair(value: unknown): StageScorePair | null {
  if (!isRecord(value)) {
    return null;
  }

  const a = readNumber(value, "a");
  const b = readNumber(value, "b");

  if (a === null || b === null) {
    return null;
  }

  return { a, b };
}

function parseMetrics(value: unknown): EvalMetrics | null {
  if (!isRecord(value)) {
    return null;
  }

  const structuralPassRate = readNumber(value, "structuralPassRate");
  const compositionPassRate = readNumber(value, "compositionPassRate");
  const combinedPassRate = readNumber(value, "combinedPassRate");
  const elementCount = readNumber(value, "elementCount");
  const maxDepth = readNumber(value, "maxDepth");
  const jsonlLineCount = readNumber(value, "jsonlLineCount");
  const parseable = readBoolean(value, "parseable");
  const actionCount = readNumber(value, "actionCount");

  if (
    structuralPassRate === null ||
    compositionPassRate === null ||
    combinedPassRate === null ||
    elementCount === null ||
    maxDepth === null ||
    jsonlLineCount === null ||
    parseable === null ||
    actionCount === null
  ) {
    return null;
  }

  return {
    structuralPassRate,
    compositionPassRate,
    combinedPassRate,
    elementCount,
    maxDepth,
    jsonlLineCount,
    parseable,
    actionCount,
  };
}

function parseChecks(value: unknown): readonly ScenarioCheckResult[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const checks: ScenarioCheckResult[] = [];
  for (const item of value) {
    const check = parseCheck(item);
    if (check === null) {
      return null;
    }
    checks.push(check);
  }

  return checks;
}

function parseCheck(value: unknown): ScenarioCheckResult | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value, "id");
  const label = readString(value, "label");
  const pass = readBoolean(value, "pass");
  const message = readString(value, "message");

  if (id === null || label === null || pass === null || message === null) {
    return null;
  }

  return {
    id,
    label,
    pass,
    message,
  };
}

function parseGradeReport(value: unknown): GradeReport | null {
  if (!isRecord(value)) {
    return null;
  }

  const allPass = readBoolean(value, "allPass");
  const results = parseGradeResults(value.results);

  if (allPass === null || results === null) {
    return null;
  }

  return {
    allPass,
    results,
  };
}

function parseGradeResults(
  value: unknown,
): readonly GradeReport["results"][number][] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const results: GradeReport["results"][number][] = [];
  for (const item of value) {
    const result = parseGradeResult(item);
    if (result === null) {
      return null;
    }
    results.push(result);
  }

  return results;
}

function parseGradeResult(
  value: unknown,
): GradeReport["results"][number] | null {
  if (!isRecord(value)) {
    return null;
  }

  const rule = readString(value, "rule");
  const pass = readBoolean(value, "pass");
  const violations = parseStringArray(value.violations);

  if (rule === null || pass === null || violations === null) {
    return null;
  }

  return {
    rule,
    pass,
    violations,
  };
}

function parseTree(value: unknown): UITree | null {
  if (!isRecord(value)) {
    return null;
  }

  const root = readString(value, "root");
  const elements = parseElements(value.elements);

  if (root === null || elements === null) {
    return null;
  }

  return {
    root,
    elements,
  };
}

function parseElements(value: unknown): UITree["elements"] | null {
  if (!isRecord(value)) {
    return null;
  }

  const elements: UITree["elements"] = {};
  for (const [key, entry] of Object.entries(value)) {
    const element = parseElement(entry);
    if (element === null || element.key !== key) {
      return null;
    }
    elements[key] = element;
  }

  return elements;
}

function parseElement(value: unknown): UIElement | null {
  if (!isRecord(value)) {
    return null;
  }

  const key = readString(value, "key");
  const type = readString(value, "type");
  const props = parseUnknownRecord(value.props);
  const children = parseOptionalStringArray(value.children);
  const parentKey = parseOptionalString(value.parentKey);
  const action = parseOptionalAction(value.action);

  if (
    key === null ||
    type === null ||
    props === null ||
    children === undefined ||
    parentKey === undefined ||
    action === undefined
  ) {
    return null;
  }

  const element: UIElement = {
    key,
    type,
    props,
  };

  if (children !== null) {
    element.children = children;
  }
  if (parentKey !== null) {
    element.parentKey = parentKey;
  }
  if (action !== null) {
    element.action = action;
  }

  return element;
}

function parseOptionalAction(
  value: unknown,
): UIElement["action"] | null | undefined {
  if (value === undefined) {
    return null;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const name = readString(value, "name");
  const params = parseOptionalUnknownRecord(value.params);

  if (name === null || params === undefined) {
    return undefined;
  }

  return params === null ? { name } : { name, params };
}

function parseUnknownRecord(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  const record: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const parsed = parseJsonValue(item);
    if (parsed === undefined) {
      return null;
    }
    record[key] = parsed;
  }

  return record;
}

function parseOptionalUnknownRecord(
  value: unknown,
): Record<string, unknown> | null | undefined {
  if (value === undefined) {
    return null;
  }

  return parseUnknownRecord(value);
}

function parseJsonValue(value: unknown): unknown | undefined {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    const next: unknown[] = [];
    for (const item of value) {
      const parsed = parseJsonValue(item);
      if (parsed === undefined) {
        return undefined;
      }
      next.push(parsed);
    }
    return next;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const parsed = parseJsonValue(item);
    if (parsed === undefined) {
      return undefined;
    }
    next[key] = parsed;
  }

  return next;
}

function parseStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return null;
  }

  return [...value];
}

function parseOptionalStringArray(value: unknown): string[] | null | undefined {
  if (value === undefined) {
    return null;
  }

  return parseStringArray(value);
}

function parseOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) {
    return null;
  }

  return typeof value === "string" ? value : undefined;
}

function parsePanelId(value: unknown): PanelId | null {
  return value === "a" || value === "b" ? value : null;
}

function parseStageId(value: unknown): EvalArtifactStageId | null {
  return value === "confirmation" || value === "followup" ? value : null;
}

function parseEvalStageId(value: unknown): RegressionWarning["stage"] | null {
  return value === "confirmation" ||
    value === "followup" ||
    value === "combined"
    ? value
    : null;
}

function parseWinner(value: unknown): ComparisonSummary["winner"] | null {
  return value === "a" || value === "b" || value === "tie" ? value : null;
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
): number | null {
  const value = record[key];
  return typeof value === "number" ? value : null;
}

function readBoolean(
  record: Record<string, unknown>,
  key: string,
): boolean | null {
  const value = record[key];
  return typeof value === "boolean" ? value : null;
}

function parseNullableNumber(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }

  return typeof value === "number" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
