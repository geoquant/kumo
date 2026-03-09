import { compareScenarioPair } from "~/lib/playground/eval-compare";
import type {
  EvalArtifactStageId,
  RegressionWarning,
  ScenarioRunPair,
  ScenarioStageArtifact,
} from "~/lib/playground/eval-types";
import type { PanelId } from "~/lib/playground/types";

export function createScenarioRunPair(input: {
  readonly id: string;
  readonly scenarioId: ScenarioRunPair["scenarioId"];
  readonly timestamp: string;
  readonly model: string;
  readonly initialPrompt: string;
}): ScenarioRunPair {
  return {
    id: input.id,
    scenarioId: input.scenarioId,
    timestamp: input.timestamp,
    model: input.model,
    initialPrompt: input.initialPrompt,
    stages: {
      confirmation: { a: null, b: null },
      followup: { a: null, b: null },
    },
    comparison: null,
  };
}

export function updateScenarioRunStage(
  run: ScenarioRunPair,
  input: {
    readonly stage: EvalArtifactStageId;
    readonly panelId: PanelId;
    readonly artifact: ScenarioStageArtifact;
  },
): ScenarioRunPair {
  const nextRun: ScenarioRunPair = {
    ...run,
    stages: {
      ...run.stages,
      [input.stage]: {
        ...run.stages[input.stage],
        [input.panelId]: input.artifact,
      },
    },
  };

  return {
    ...nextRun,
    comparison: compareScenarioPair(nextRun),
  };
}

export function isScenarioRunComplete(run: ScenarioRunPair): boolean {
  return run.stages.followup.a !== null && run.stages.followup.b !== null;
}

export function getScenarioRunWarnings(
  run: ScenarioRunPair | null,
): readonly RegressionWarning[] {
  return run?.comparison?.warnings ?? [];
}
