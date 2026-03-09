import type {
  ComparisonSummary,
  EvalArtifactStageId,
  RegressionWarning,
  ScenarioCheckResult,
  ScenarioRunPair,
  ScenarioStageArtifact,
  StageScorePair,
} from "~/lib/playground/eval-types";
import { CREATE_WORKER_SCENARIO } from "~/lib/tool-registry";

const ARTIFACT_STAGE_IDS = ["confirmation", "followup"] as const;
const REGRESSION_DELTA_THRESHOLD = 0.1;

function hasCompleteStage(
  pair: ScenarioRunPair["stages"][EvalArtifactStageId],
): boolean {
  return pair.a !== null && pair.b !== null;
}

function isChatOnlyConfirmation(run: ScenarioRunPair): boolean {
  return (
    run.stages.confirmation.a === null &&
    run.stages.confirmation.b === null &&
    hasCompleteStage(run.stages.followup)
  );
}

function countPassedChecks(checks: readonly ScenarioCheckResult[]): number {
  return checks.reduce((count, check) => count + (check.pass ? 1 : 0), 0);
}

function buildCheckPassRate(artifact: ScenarioStageArtifact): number {
  return artifact.checks.length === 0
    ? 0
    : countPassedChecks(artifact.checks) / artifact.checks.length;
}

function buildStageScore(artifact: ScenarioStageArtifact): number {
  const checkPassRate = buildCheckPassRate(artifact);

  if (artifact.stage === "confirmation") {
    return artifact.metrics.combinedPassRate * 0.5 + checkPassRate * 0.5;
  }

  return artifact.metrics.combinedPassRate * 0.6 + checkPassRate * 0.4;
}

function buildScorePair(
  pair: ScenarioRunPair["stages"][EvalArtifactStageId],
): StageScorePair {
  return {
    a: pair.a === null ? 0 : buildStageScore(pair.a),
    b: pair.b === null ? 0 : buildStageScore(pair.b),
  };
}

function buildMissingStageWarning(
  stage: EvalArtifactStageId,
  missingPanels: readonly string[],
): RegressionWarning {
  const panelLabel = missingPanels.join(" and ");
  return {
    kind: "missing-stage",
    stage,
    rule: `missing-${stage}`,
    message: `Missing ${stage} artifact for panel ${panelLabel}.`,
    delta: null,
  };
}

function buildThresholdWarning(
  stage: EvalArtifactStageId | "combined",
  score: number,
  threshold: number,
): RegressionWarning {
  return {
    kind: "threshold",
    stage,
    rule: `threshold-${stage}`,
    message: `Panel B ${stage} score ${score.toFixed(3)} is below threshold ${threshold.toFixed(3)}.`,
    delta: threshold - score,
  };
}

function buildScoreRegressionWarning(
  stage: EvalArtifactStageId | "combined",
  aScore: number,
  bScore: number,
): RegressionWarning {
  return {
    kind: "regression",
    stage,
    rule: `score-regression-${stage}`,
    message: `Panel B ${stage} score ${bScore.toFixed(3)} trails panel A ${aScore.toFixed(3)}.`,
    delta: aScore - bScore,
  };
}

function buildCheckRegressionWarnings(
  stage: EvalArtifactStageId,
  aArtifact: ScenarioStageArtifact,
  bArtifact: ScenarioStageArtifact,
): readonly RegressionWarning[] {
  const checksById = new Map(
    bArtifact.checks.map((check) => [check.id, check]),
  );

  return aArtifact.checks.flatMap((aCheck) => {
    const bCheck = checksById.get(aCheck.id);
    if (!aCheck.pass || bCheck?.pass === true) {
      return [];
    }

    return [
      {
        kind: "regression",
        stage,
        rule: `check-regression-${stage}-${aCheck.id}`,
        message: `Panel B failed ${stage} check "${aCheck.label}" that panel A passed.`,
        delta: null,
      } satisfies RegressionWarning,
    ];
  });
}

export function compareScenarioPair(run: ScenarioRunPair): ComparisonSummary {
  const chatOnlyConfirmation = isChatOnlyConfirmation(run);
  const confirmationScores = buildScorePair(run.stages.confirmation);
  const followupScores = buildScorePair(run.stages.followup);
  const stageScores = {
    confirmation: confirmationScores,
    followup: followupScores,
    combined: {
      a: chatOnlyConfirmation
        ? followupScores.a
        : confirmationScores.a * 0.3 + followupScores.a * 0.7,
      b: chatOnlyConfirmation
        ? followupScores.b
        : confirmationScores.b * 0.3 + followupScores.b * 0.7,
    },
  };
  const warnings: RegressionWarning[] = [];

  for (const stage of ARTIFACT_STAGE_IDS) {
    const pair = run.stages[stage];

    if (stage === "confirmation" && chatOnlyConfirmation) {
      continue;
    }

    const missingPanels = [
      ...(pair.a === null ? ["A"] : []),
      ...(pair.b === null ? ["B"] : []),
    ];

    if (missingPanels.length > 0) {
      warnings.push(buildMissingStageWarning(stage, missingPanels));
      continue;
    }

    const aArtifact = pair.a;
    const bArtifact = pair.b;
    if (aArtifact === null || bArtifact === null) {
      continue;
    }

    const threshold = CREATE_WORKER_SCENARIO.stageThresholds[stage];
    if (stageScores[stage].b < threshold) {
      warnings.push(
        buildThresholdWarning(stage, stageScores[stage].b, threshold),
      );
    }

    if (
      stageScores[stage].a - stageScores[stage].b >=
      REGRESSION_DELTA_THRESHOLD
    ) {
      warnings.push(
        buildScoreRegressionWarning(
          stage,
          stageScores[stage].a,
          stageScores[stage].b,
        ),
      );
    }

    warnings.push(...buildCheckRegressionWarnings(stage, aArtifact, bArtifact));
  }

  const hasAllArtifacts = chatOnlyConfirmation
    ? hasCompleteStage(run.stages.followup)
    : ARTIFACT_STAGE_IDS.every((stage) => hasCompleteStage(run.stages[stage]));

  if (hasAllArtifacts) {
    const combinedThreshold = CREATE_WORKER_SCENARIO.stageThresholds.combined;

    if (stageScores.combined.b < combinedThreshold) {
      warnings.push(
        buildThresholdWarning(
          "combined",
          stageScores.combined.b,
          combinedThreshold,
        ),
      );
    }

    if (
      stageScores.combined.a - stageScores.combined.b >=
      REGRESSION_DELTA_THRESHOLD
    ) {
      warnings.push(
        buildScoreRegressionWarning(
          "combined",
          stageScores.combined.a,
          stageScores.combined.b,
        ),
      );
    }
  }

  return {
    warnings,
    winner:
      Math.abs(stageScores.combined.a - stageScores.combined.b) < Number.EPSILON
        ? "tie"
        : stageScores.combined.a > stageScores.combined.b
          ? "a"
          : "b",
    stageScores,
  };
}
