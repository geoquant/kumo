import { describe, expect, it } from "vitest";

import type {
  EvalArtifactStageId,
  ScenarioRunPair,
  ScenarioStageArtifact,
} from "~/lib/playground/eval-types";
import { compareScenarioPair } from "~/lib/playground/eval-compare";

function buildArtifact(input: {
  readonly stage: EvalArtifactStageId;
  readonly panelId: "a" | "b";
  readonly combinedPassRate: number;
  readonly passedChecks: number;
  readonly totalChecks?: number;
}): ScenarioStageArtifact {
  const totalChecks = input.totalChecks ?? 4;

  return {
    stage: input.stage,
    panelId: input.panelId,
    promptText: "prompt",
    rawJsonl: '{"op":"replace"}',
    tree: {
      root: "root",
      elements: {
        root: {
          key: "root",
          type: "Surface",
          props: {},
          children: [],
        },
      },
    },
    structuralReport: {
      results: [],
      allPass: true,
    },
    compositionReport: {
      results: [],
      allPass: true,
    },
    metrics: {
      structuralPassRate: input.combinedPassRate,
      compositionPassRate: input.combinedPassRate,
      combinedPassRate: input.combinedPassRate,
      elementCount: 1,
      maxDepth: 0,
      jsonlLineCount: 1,
      parseable: true,
      actionCount: 0,
    },
    checks: Array.from({ length: totalChecks }, (_, index) => ({
      id: `check-${index + 1}`,
      label: `Check ${index + 1}`,
      pass: index < input.passedChecks,
      message: index < input.passedChecks ? "pass" : "fail",
    })),
  };
}

function buildRunPair(input: {
  readonly confirmationA: ScenarioStageArtifact | null;
  readonly confirmationB: ScenarioStageArtifact | null;
  readonly followupA: ScenarioStageArtifact | null;
  readonly followupB: ScenarioStageArtifact | null;
}): ScenarioRunPair {
  return {
    id: "run-1",
    scenarioId: "create-worker",
    timestamp: "2026-03-08T00:00:00.000Z",
    model: "gpt-5.4",
    initialPrompt: "create a new hello world worker",
    stages: {
      confirmation: {
        a: input.confirmationA,
        b: input.confirmationB,
      },
      followup: {
        a: input.followupA,
        b: input.followupB,
      },
    },
    comparison: null,
  };
}

describe("compareScenarioPair", () => {
  it("returns tie and no warnings for identical stage artifacts", () => {
    const confirmationA = buildArtifact({
      stage: "confirmation",
      panelId: "a",
      combinedPassRate: 0.8,
      passedChecks: 4,
    });
    const confirmationB = buildArtifact({
      stage: "confirmation",
      panelId: "b",
      combinedPassRate: 0.8,
      passedChecks: 4,
    });
    const followupA = buildArtifact({
      stage: "followup",
      panelId: "a",
      combinedPassRate: 0.85,
      passedChecks: 4,
    });
    const followupB = buildArtifact({
      stage: "followup",
      panelId: "b",
      combinedPassRate: 0.85,
      passedChecks: 4,
    });

    const summary = compareScenarioPair(
      buildRunPair({
        confirmationA,
        confirmationB,
        followupA,
        followupB,
      }),
    );

    expect(summary.warnings).toEqual([]);
    expect(summary.winner).toBe("tie");
    expect(summary.stageScores.confirmation.a).toBeCloseTo(0.9);
    expect(summary.stageScores.confirmation.b).toBeCloseTo(0.9);
    expect(summary.stageScores.followup.a).toBeCloseTo(0.91);
    expect(summary.stageScores.followup.b).toBeCloseTo(0.91);
    expect(summary.stageScores.combined.a).toBeCloseTo(0.907);
    expect(summary.stageScores.combined.b).toBeCloseTo(0.907);
  });

  it("emits threshold, score regression, and check regression warnings", () => {
    const summary = compareScenarioPair(
      buildRunPair({
        confirmationA: buildArtifact({
          stage: "confirmation",
          panelId: "a",
          combinedPassRate: 0.95,
          passedChecks: 4,
        }),
        confirmationB: buildArtifact({
          stage: "confirmation",
          panelId: "b",
          combinedPassRate: 0.6,
          passedChecks: 2,
        }),
        followupA: buildArtifact({
          stage: "followup",
          panelId: "a",
          combinedPassRate: 0.9,
          passedChecks: 4,
        }),
        followupB: buildArtifact({
          stage: "followup",
          panelId: "b",
          combinedPassRate: 0.6,
          passedChecks: 3,
        }),
      }),
    );

    expect(summary.winner).toBe("a");
    expect(summary.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "threshold",
          stage: "confirmation",
          rule: "threshold-confirmation",
        }),
        expect.objectContaining({
          kind: "regression",
          stage: "confirmation",
          rule: "score-regression-confirmation",
        }),
        expect.objectContaining({
          kind: "regression",
          stage: "confirmation",
          rule: "check-regression-confirmation-check-3",
        }),
        expect.objectContaining({
          kind: "threshold",
          stage: "followup",
          rule: "threshold-followup",
        }),
        expect.objectContaining({
          kind: "regression",
          stage: "followup",
          rule: "check-regression-followup-check-4",
        }),
        expect.objectContaining({
          kind: "threshold",
          stage: "combined",
          rule: "threshold-combined",
        }),
        expect.objectContaining({
          kind: "regression",
          stage: "combined",
          rule: "score-regression-combined",
        }),
      ]),
    );
  });

  it("emits only missing-stage warnings when a required stage artifact is absent", () => {
    const summary = compareScenarioPair(
      buildRunPair({
        confirmationA: buildArtifact({
          stage: "confirmation",
          panelId: "a",
          combinedPassRate: 0.8,
          passedChecks: 4,
        }),
        confirmationB: buildArtifact({
          stage: "confirmation",
          panelId: "b",
          combinedPassRate: 0.82,
          passedChecks: 4,
        }),
        followupA: buildArtifact({
          stage: "followup",
          panelId: "a",
          combinedPassRate: 0.85,
          passedChecks: 4,
        }),
        followupB: null,
      }),
    );

    expect(summary.warnings).toEqual([
      expect.objectContaining({
        kind: "missing-stage",
        stage: "followup",
        rule: "missing-followup",
      }),
    ]);
  });

  it("treats chat-only confirmation as followup-only workspace scoring", () => {
    const followupA = buildArtifact({
      stage: "followup",
      panelId: "a",
      combinedPassRate: 0.9,
      passedChecks: 4,
    });
    const followupB = buildArtifact({
      stage: "followup",
      panelId: "b",
      combinedPassRate: 0.6,
      passedChecks: 2,
    });

    const summary = compareScenarioPair(
      buildRunPair({
        confirmationA: null,
        confirmationB: null,
        followupA,
        followupB,
      }),
    );

    expect(summary.warnings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "missing-stage",
          stage: "confirmation",
        }),
      ]),
    );
    expect(summary.stageScores.combined.a).toBeCloseTo(
      summary.stageScores.followup.a,
    );
    expect(summary.stageScores.combined.b).toBeCloseTo(
      summary.stageScores.followup.b,
    );
  });
});
