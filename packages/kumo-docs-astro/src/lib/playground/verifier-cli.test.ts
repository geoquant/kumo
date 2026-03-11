import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { PlaygroundVerifierReport } from "~/lib/playground/verifier";
import {
  buildPanelAVerifierRequestArtifact,
  formatPlaygroundVerifierMarkdown,
  parsePlaygroundVerifierCliArgs,
  writePlaygroundVerifierArtifacts,
} from "~/lib/playground/verifier-cli";

describe("playground verifier cli", () => {
  it("parses CLI args", () => {
    const options = parsePlaygroundVerifierCliArgs([
      "--prompt",
      "show me every kumo component variant",
      "--model",
      "glm-4.7-flash",
      "--url",
      "http://localhost:4321",
      "--output-dir",
      "./tmp/output",
    ]);

    expect(options.prompt).toBe("show me every kumo component variant");
    expect(options.model).toBe("glm-4.7-flash");
    expect(options.baseUrl).toBe("http://localhost:4321");
    expect(options.outputRoot).toContain("tmp/output");
  });

  it("builds the same panel A request shape and adds supplements when needed", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("base prompt", { status: 200 })) as typeof fetch;

    try {
      const request = await buildPanelAVerifierRequestArtifact({
        prompt: "show me every kumo component variant",
        baseUrl: "http://localhost:4321",
        model: "gpt-oss-120b",
        outputRoot: "/tmp",
      });

      expect(request.body).toMatchObject({
        message: "show me every kumo component variant",
        model: "gpt-oss-120b",
        systemPromptSupplement: expect.stringContaining(
          "# Exhaustive Variant Showcase",
        ),
      });
      expect(request.effectivePromptText).toContain("base prompt");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("writes verifier artifacts", async () => {
    const tempRoot = await mkdtemp(
      path.join(os.tmpdir(), "playground-verify-"),
    );
    const report: PlaygroundVerifierReport = {
      prompt: {
        message: "show me a badge",
        model: "gpt-oss-120b",
        promptChars: 100,
        promptTokenEstimate: 25,
      },
      stream: {
        sseBytes: 200,
        assistantChars: 50,
        jsonlLineCount: 2,
        patchOpCount: 2,
        droppedLineCount: 0,
      },
      tree: {
        renderable: true,
        elementCount: 4,
        maxDepth: 2,
        unknownTypeCount: 0,
        missingChildRefCount: 0,
        malformedStructureCount: 0,
      },
      validation: {
        repairedElementCount: 0,
        strippedPropCount: 0,
        unrepairedInvalidElementCount: 0,
        normalizationDiffCount: 0,
      },
      grading: {
        structuralScore: 8,
        compositionScore: 6,
        structuralViolations: 0,
        compositionViolations: 0,
        structuralReport: { allPass: true, results: [] },
        compositionReport: { allPass: true, results: [] },
      },
      status: "pass",
      reasons: [],
      assistantJsonl: '{"op":"replace"}',
    };

    const artifactDir = await writePlaygroundVerifierArtifacts({
      outputRoot: tempRoot,
      request: {
        url: "http://localhost:4321/api/chat",
        body: { message: "show me a badge", model: "gpt-oss-120b" },
        effectivePromptText: "base prompt",
      },
      rawSse: "data: [DONE]\n\n",
      report,
      now: new Date("2026-03-10T12:00:00.000Z"),
    });

    const reportJson = await readFile(
      path.join(artifactDir, "report.json"),
      "utf8",
    );
    const reportMarkdown = await readFile(
      path.join(artifactDir, "report.md"),
      "utf8",
    );
    const requestJson = await readFile(
      path.join(artifactDir, "request.json"),
      "utf8",
    );

    expect(reportJson).toContain('"status": "pass"');
    expect(reportMarkdown).toContain("status: pass");
    expect(requestJson).toContain('"message": "show me a badge"');
  });

  it("formats compact markdown summary", () => {
    const markdown = formatPlaygroundVerifierMarkdown({
      prompt: {
        message: "show me a badge",
        model: "gpt-oss-120b",
        promptChars: 100,
        promptTokenEstimate: 25,
      },
      stream: {
        sseBytes: 200,
        assistantChars: 50,
        jsonlLineCount: 2,
        patchOpCount: 2,
        droppedLineCount: 0,
      },
      tree: {
        renderable: true,
        elementCount: 4,
        maxDepth: 2,
        unknownTypeCount: 0,
        missingChildRefCount: 0,
        malformedStructureCount: 0,
      },
      validation: {
        repairedElementCount: 0,
        strippedPropCount: 0,
        unrepairedInvalidElementCount: 0,
        normalizationDiffCount: 0,
      },
      grading: {
        structuralScore: 8,
        compositionScore: 6,
        structuralViolations: 0,
        compositionViolations: 0,
        structuralReport: { allPass: true, results: [] },
        compositionReport: { allPass: true, results: [] },
      },
      status: "pass",
      reasons: [],
      assistantJsonl: "{}",
    });

    expect(markdown).toContain("# Playground Panel A Verifier");
    expect(markdown).toContain("- patch ops: 2");
    expect(markdown).toContain("- reasons: none");
  });
});
