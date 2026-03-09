import process from "node:process";
import { pathToFileURL } from "node:url";

import {
  applyPatch,
  createJsonlParser,
  type UITree,
} from "@cloudflare/kumo/streaming";

import { buildStageArtifact } from "../src/lib/playground/eval-analysis";
import { createPlaygroundFeedbackExport } from "../src/lib/playground/feedback-export";
import {
  createScenarioRunPair,
  updateScenarioRunStage,
} from "../src/lib/playground/feedback-run";
import type {
  PlaygroundFeedbackExport,
  ScenarioRunPair,
} from "../src/lib/playground/eval-types";
import { readSSEStream } from "../src/lib/read-sse-stream";
import { BASELINE_PROMPT } from "../src/lib/tool-prompts";
import {
  matchToolForMessage,
  CREATE_WORKER_SCENARIO,
} from "../src/lib/tool-registry";

const DEFAULT_BASE_URL = "http://127.0.0.1:4321";
const DEFAULT_BRANCH = "geoquant/streaming-ui";
const DEFAULT_MODEL = "gpt-oss-120b";

export interface EvalCliOptions {
  readonly baseUrl: string;
  readonly branch: string;
  readonly model: string;
  readonly json: boolean;
}

export interface ScenarioRequest {
  readonly baseUrl: string;
  readonly body: Record<string, unknown>;
}

export interface ScenarioResponse {
  readonly rawJsonl: string;
  readonly tree: UITree;
}

export type ScenarioRequester = (
  request: ScenarioRequest,
) => Promise<ScenarioResponse>;

function extractErrorMessage(body: unknown): string | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  if (!("error" in body)) {
    return null;
  }

  const error = body.error;
  return typeof error === "string" ? error : null;
}

export function parseEvalCliArgs(argv: readonly string[]): EvalCliOptions {
  let baseUrl = process.env["PLAYGROUND_EVAL_BASE_URL"] ?? DEFAULT_BASE_URL;
  let branch = process.env["PLAYGROUND_EVAL_BRANCH"] ?? DEFAULT_BRANCH;
  let model = DEFAULT_MODEL;
  let json = false;

  function readOptionValue(flag: string, value: string | undefined): string {
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for ${flag}`);
    }

    return value;
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--model") {
      model = readOptionValue(arg, next);
      index += 1;
      continue;
    }

    if (arg === "--url") {
      baseUrl = readOptionValue(arg, next);
      index += 1;
      continue;
    }

    if (arg === "--branch") {
      branch = readOptionValue(arg, next);
      index += 1;
      continue;
    }
  }

  return { baseUrl, branch, model, json };
}

export async function requestScenarioStage(
  request: ScenarioRequest,
): Promise<ScenarioResponse> {
  const response = await fetch(new URL("/api/chat", request.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(request.body),
  });

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => null);
    throw new Error(
      extractErrorMessage(errorBody) ??
        `Chat request failed (${String(response.status)})`,
    );
  }

  const parser = createJsonlParser();
  let tree: UITree = { root: "", elements: {} };
  let rawJsonl = "";

  function applyOps(): void {
    const patches = parser.flush();
    for (const patch of patches) {
      tree = applyPatch(tree, patch);
    }
  }

  await readSSEStream(
    response,
    (token) => {
      rawJsonl += token;
      const patches = parser.push(token);
      for (const patch of patches) {
        tree = applyPatch(tree, patch);
      }
    },
    new AbortController().signal,
  );

  applyOps();

  return { rawJsonl, tree };
}

export async function evaluateCreateWorkerScenario(
  options: EvalCliOptions,
  requester: ScenarioRequester = requestScenarioStage,
): Promise<ScenarioRunPair> {
  const matched = matchToolForMessage(CREATE_WORKER_SCENARIO.initialPrompt);
  if (matched === null) {
    throw new Error("Failed to resolve create-worker scenario.");
  }

  const [toolDef, matchedParams] = matched;
  const confirmationPrompt = toolDef.buildConfirmationMessage(matchedParams);

  let run = createScenarioRunPair({
    id: `create-worker-${Date.now()}`,
    scenarioId: CREATE_WORKER_SCENARIO.id,
    timestamp: new Date().toISOString(),
    model: options.model,
    initialPrompt: CREATE_WORKER_SCENARIO.initialPrompt,
  });

  const [confirmationA, confirmationB] = await Promise.all([
    requester({
      baseUrl: options.baseUrl,
      body: {
        message: confirmationPrompt,
        model: options.model,
      },
    }),
    requester({
      baseUrl: options.baseUrl,
      body: {
        message: confirmationPrompt,
        model: options.model,
        skipSystemPrompt: true,
        systemPromptOverride: BASELINE_PROMPT,
      },
    }),
  ]);

  run = updateScenarioRunStage(run, {
    stage: "confirmation",
    panelId: "a",
    artifact: buildStageArtifact({
      stage: "confirmation",
      panelId: "a",
      promptText: confirmationPrompt,
      rawJsonl: confirmationA.rawJsonl,
      tree: confirmationA.tree,
    }),
  });
  run = updateScenarioRunStage(run, {
    stage: "confirmation",
    panelId: "b",
    artifact: buildStageArtifact({
      stage: "confirmation",
      panelId: "b",
      promptText: confirmationPrompt,
      rawJsonl: confirmationB.rawJsonl,
      tree: confirmationB.tree,
    }),
  });

  const followupPrompt = toolDef.buildFollowUpPrompt(matchedParams);
  const followupHistory = [
    {
      role: "user",
      content: CREATE_WORKER_SCENARIO.initialPrompt,
    },
  ];
  const currentUITree = JSON.stringify(confirmationA.tree);

  const [followupA, followupB] = await Promise.all([
    requester({
      baseUrl: options.baseUrl,
      body: {
        message: followupPrompt,
        model: options.model,
        history: followupHistory,
        currentUITree,
      },
    }),
    requester({
      baseUrl: options.baseUrl,
      body: {
        message: followupPrompt,
        model: options.model,
        history: followupHistory,
        currentUITree,
        skipSystemPrompt: true,
        systemPromptOverride: BASELINE_PROMPT,
      },
    }),
  ]);

  run = updateScenarioRunStage(run, {
    stage: "followup",
    panelId: "a",
    artifact: buildStageArtifact({
      stage: "followup",
      panelId: "a",
      promptText: followupPrompt,
      rawJsonl: followupA.rawJsonl,
      tree: followupA.tree,
    }),
  });
  run = updateScenarioRunStage(run, {
    stage: "followup",
    panelId: "b",
    artifact: buildStageArtifact({
      stage: "followup",
      panelId: "b",
      promptText: followupPrompt,
      rawJsonl: followupB.rawJsonl,
      tree: followupB.tree,
    }),
  });

  return run;
}

export function buildScenarioExport(
  run: ScenarioRunPair,
  branch: string,
): PlaygroundFeedbackExport {
  return createPlaygroundFeedbackExport({
    branch,
    exportedAt: new Date().toISOString(),
    runs: [run],
  });
}

export function formatScenarioSummary(run: ScenarioRunPair): string {
  const comparison = run.comparison;
  if (comparison === null) {
    return "Create worker scenario incomplete";
  }

  const lines = [
    `Create worker backstop (${run.model})`,
    `- confirmation A ${Math.round(comparison.stageScores.confirmation.a * 100)}% / B ${Math.round(comparison.stageScores.confirmation.b * 100)}%`,
    `- followup A ${Math.round(comparison.stageScores.followup.a * 100)}% / B ${Math.round(comparison.stageScores.followup.b * 100)}%`,
    `- combined A ${Math.round(comparison.stageScores.combined.a * 100)}% / B ${Math.round(comparison.stageScores.combined.b * 100)}%`,
    `- warnings ${String(comparison.warnings.length)}`,
  ];

  for (const warning of comparison.warnings) {
    lines.push(`  - [${warning.kind}] ${warning.stage}: ${warning.message}`);
  }

  return lines.join("\n");
}

export async function main(argv: readonly string[]): Promise<number> {
  try {
    const options = parseEvalCliArgs(argv);
    const run = await evaluateCreateWorkerScenario(options);
    const summary = formatScenarioSummary(run);

    if (options.json) {
      const payload = buildScenarioExport(run, options.branch);
      process.stderr.write(`${summary}\n`);
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      return 0;
    }

    process.stdout.write(`${summary}\n`);
    return 0;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    return 1;
  }
}

const entryArg = process.argv[1];
if (entryArg) {
  const entryUrl = pathToFileURL(entryArg).href;
  if (import.meta.url === entryUrl) {
    void main(process.argv.slice(2)).then((code) => {
      process.exitCode = code;
    });
  }
}
