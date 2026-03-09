import type { GradeReport } from "@cloudflare/kumo/generative/graders";
import type { UITree } from "@cloudflare/kumo/streaming";

import type { PanelId } from "~/lib/playground/types";

export const PLAYGROUND_FEEDBACK_EXPORT_FORMAT = "playground-feedback-v1";

export type PlaygroundFeedbackExportFormat =
  typeof PLAYGROUND_FEEDBACK_EXPORT_FORMAT;

export type EvalScenarioId = "create-worker";

export type EvalArtifactStageId = "confirmation" | "followup";

export type EvalStageId = EvalArtifactStageId | "combined";

export interface EvalStageThresholds {
  readonly confirmation: number;
  readonly followup: number;
  readonly combined: number;
}

export interface ScenarioDefinition {
  readonly id: EvalScenarioId;
  readonly initialPrompt: string;
  readonly toolName: "execute_create_worker";
  readonly stageThresholds: EvalStageThresholds;
}

export interface EvalMetrics {
  readonly structuralPassRate: number;
  readonly compositionPassRate: number;
  readonly combinedPassRate: number;
  readonly elementCount: number;
  readonly maxDepth: number;
  readonly jsonlLineCount: number;
  readonly parseable: boolean;
  readonly actionCount: number;
}

export interface ScenarioCheckResult {
  readonly id: string;
  readonly label: string;
  readonly pass: boolean;
  readonly message: string;
}

export interface ScenarioStageArtifact {
  readonly stage: EvalArtifactStageId;
  readonly panelId: PanelId;
  readonly promptText: string;
  readonly rawJsonl: string;
  readonly tree: UITree;
  readonly structuralReport: GradeReport;
  readonly compositionReport: GradeReport;
  readonly metrics: EvalMetrics;
  readonly checks: readonly ScenarioCheckResult[];
}

export interface ScenarioStagePair {
  readonly a: ScenarioStageArtifact | null;
  readonly b: ScenarioStageArtifact | null;
}

export interface StageScorePair {
  readonly a: number;
  readonly b: number;
}

export interface RegressionWarning {
  readonly kind: "regression" | "threshold" | "missing-stage";
  readonly stage: EvalStageId;
  readonly rule: string;
  readonly message: string;
  readonly delta: number | null;
}

export interface ComparisonSummary {
  readonly warnings: readonly RegressionWarning[];
  readonly winner: PanelId | "tie";
  readonly stageScores: Readonly<Record<EvalStageId, StageScorePair>>;
}

export interface ScenarioRunPair {
  readonly id: string;
  readonly scenarioId: EvalScenarioId;
  readonly timestamp: string;
  readonly model: string;
  readonly initialPrompt: string;
  readonly stages: {
    readonly confirmation: ScenarioStagePair;
    readonly followup: ScenarioStagePair;
  };
  readonly comparison: ComparisonSummary | null;
}

export interface PlaygroundFeedbackExport {
  readonly format: PlaygroundFeedbackExportFormat;
  readonly branch: string;
  readonly exportedAt: string;
  readonly runs: readonly ScenarioRunPair[];
}
