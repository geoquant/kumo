import { describe, expect, it } from "vitest";

import {
  DEFAULT_PLAYGROUND_VERIFIER_CONFIG,
  buildPlaygroundVerifierReport,
  extractAssistantJsonlFromSse,
} from "~/lib/playground/verifier";
import {
  buildExcessiveRepairVerifierTree,
  buildHealthyVerifierTree,
  buildMalformedVerifierTree,
  buildNonRenderableVerifierTree,
  buildRepairWarnVerifierTree,
  buildVerifierJsonl,
  buildVerifierSse,
} from "~/lib/playground/verifier-fixtures";

describe("playground verifier", () => {
  it("extracts assistant JSONL and ignores reasoning chunks", () => {
    const rawSse = [
      `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: "think" } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: '{"op":"replace","path":"/root","value":"surface"}\n' } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { reasoning: "more" } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: '{"op":"replace","path":"/elements","value":{}}' } }] })}\n\n`,
      "data: [DONE]\n\n",
    ].join("");

    expect(extractAssistantJsonlFromSse(rawSse)).toBe(
      '{"op":"replace","path":"/root","value":"surface"}\n{"op":"replace","path":"/elements","value":{}}',
    );
  });

  it("builds a normalized report for a healthy generated tree", () => {
    const tree = buildHealthyVerifierTree();

    const report = buildPlaygroundVerifierReport({
      request: {
        message: "show me a badge",
        model: "gpt-oss-120b",
        promptText: "effective prompt text",
      },
      rawSse: buildVerifierSse([buildVerifierJsonl(tree)]),
    });

    expect(report.prompt.promptChars).toBe("effective prompt text".length);
    expect(report.stream.patchOpCount).toBe(2);
    expect(report.tree.renderable).toBe(true);
    expect(report.tree.elementCount).toBe(5);
    expect(report.validation.repairedElementCount).toBe(0);
    expect(report.grading.structuralScore).toBeGreaterThan(0);
    expect(report.grading.compositionScore).toBeGreaterThan(0);
    expect(report.status).toBe("pass");
  });

  it("fails zero-op streams without needing browser render", () => {
    const report = buildPlaygroundVerifierReport({
      request: {
        message: "show me every kumo component variant",
        model: "gpt-oss-120b",
      },
      rawSse: buildVerifierSse([]),
    });

    expect(report.stream.patchOpCount).toBe(0);
    expect(report.status).toBe("fail");
    expect(report.reasons).toContain("No patch ops generated.");
  });

  it("counts malformed compound structure failures", () => {
    const tree = buildMalformedVerifierTree();

    const report = buildPlaygroundVerifierReport({
      request: {
        message: "render a broken table",
        model: "gpt-oss-120b",
      },
      assistantJsonl: buildVerifierJsonl(tree),
    });

    expect(report.tree.malformedStructureCount).toBeGreaterThan(0);
    expect(report.status).toBe("fail");
    expect(report.reasons).toContain(
      "Malformed compound structure exceeds verifier budget.",
    );
  });

  it("reports repair counts for invalid props", () => {
    const tree = buildRepairWarnVerifierTree();

    const report = buildPlaygroundVerifierReport({
      request: {
        message: "render a stack",
        model: "gpt-oss-120b",
      },
      assistantJsonl: buildVerifierJsonl(tree),
    });

    expect(report.validation.repairedElementCount).toBe(1);
    expect(report.validation.strippedPropCount).toBe(1);
    expect(report.status).toBe("warn");
    expect(report.reasons).toContain("Repair count exceeds warning budget.");
    expect(report.reasons).toContain(
      "Stripped prop count exceeds warning budget.",
    );
  });

  it("fails non-renderable trees without requiring preview mount", () => {
    const report = buildPlaygroundVerifierReport({
      request: {
        message: "render a missing root",
        model: "gpt-oss-120b",
      },
      assistantJsonl: buildVerifierJsonl(buildNonRenderableVerifierTree()),
    });

    expect(report.tree.renderable).toBe(false);
    expect(report.status).toBe("fail");
    expect(report.reasons).toContain("Tree is not renderable.");
  });

  it("fails oversized streamed responses when budgets are exceeded", () => {
    const tree = buildHealthyVerifierTree();
    const rawSse = buildVerifierSse([buildVerifierJsonl(tree)]);
    const report = buildPlaygroundVerifierReport({
      request: {
        message: "render a large response",
        model: "gpt-oss-120b",
      },
      rawSse,
      config: {
        failThresholds: {
          maxSseBytes: rawSse.length - 1,
        },
      },
    });

    expect(report.stream.sseBytes).toBe(rawSse.length);
    expect(report.status).toBe("fail");
    expect(report.reasons).toContain("SSE bytes exceed verifier budget.");
  });

  it("fails when repair counts exceed configured limits", () => {
    const report = buildPlaygroundVerifierReport({
      request: {
        message: "render too many repairs",
        model: "gpt-oss-120b",
      },
      assistantJsonl: buildVerifierJsonl(buildExcessiveRepairVerifierTree()),
      config: {
        failThresholds: {
          maxRepairCount: 1,
        },
      },
    });

    expect(report.validation.repairedElementCount).toBeGreaterThan(1);
    expect(report.status).toBe("fail");
    expect(report.reasons).toContain("Repair count exceeds verifier budget.");
  });

  it("exposes named verifier budgets for every tracked back-pressure metric", () => {
    expect(DEFAULT_PLAYGROUND_VERIFIER_CONFIG.warnThresholds).toMatchObject({
      maxPromptChars: expect.any(Number),
      maxPromptTokensEstimate: expect.any(Number),
      maxSseBytes: expect.any(Number),
      maxAssistantChars: expect.any(Number),
      maxPatchOps: expect.any(Number),
      maxTreeDepth: expect.any(Number),
      maxRepairCount: expect.any(Number),
      maxStrippedProps: expect.any(Number),
      maxMalformedStructureCount: expect.any(Number),
      maxUnknownTypes: expect.any(Number),
      maxDroppedLines: expect.any(Number),
    });
    expect(DEFAULT_PLAYGROUND_VERIFIER_CONFIG.failThresholds).toMatchObject({
      maxPromptChars: expect.any(Number),
      maxPromptTokensEstimate: expect.any(Number),
      maxSseBytes: expect.any(Number),
      maxAssistantChars: expect.any(Number),
      maxPatchOps: expect.any(Number),
      maxTreeDepth: expect.any(Number),
      maxRepairCount: expect.any(Number),
      maxStrippedProps: expect.any(Number),
      maxMalformedStructureCount: expect.any(Number),
      maxUnknownTypes: expect.any(Number),
      maxDroppedLines: expect.any(Number),
    });
  });

  it("changes pass warn fail outcomes when verifier budgets change", () => {
    const tree = buildHealthyVerifierTree();

    const baseInput = {
      request: {
        message: "render a stack",
        model: "gpt-oss-120b",
        promptText: "1234567890",
      },
      assistantJsonl: buildVerifierJsonl(tree),
    };

    const passReport = buildPlaygroundVerifierReport({
      ...baseInput,
      config: {
        warnThresholds: {
          maxPromptChars: 10,
        },
        failThresholds: {
          maxPromptChars: 11,
        },
      },
    });
    const warnReport = buildPlaygroundVerifierReport({
      ...baseInput,
      config: {
        warnThresholds: {
          maxPromptChars: 9,
        },
        failThresholds: {
          maxPromptChars: 11,
        },
      },
    });
    const failReport = buildPlaygroundVerifierReport({
      ...baseInput,
      config: {
        warnThresholds: {
          maxPromptChars: 9,
        },
        failThresholds: {
          maxPromptChars: 9,
        },
      },
    });

    expect(passReport.status).toBe("pass");
    expect(warnReport.status).toBe("warn");
    expect(failReport.status).toBe("fail");
  });
});
