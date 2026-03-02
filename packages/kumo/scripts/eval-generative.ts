#!/usr/bin/env tsx
/**
 * Eval harness — tests actual LLM output against structural + composition graders.
 *
 * Sends eval prompts to the /api/chat SSE endpoint, parses SSE → JSONL → UITree,
 * runs gradeTree() + gradeComposition(), and reports per-rule pass rates.
 *
 * Usage:
 *   tsx scripts/eval-generative.ts [options]
 *
 * Options:
 *   --url <endpoint>        Chat endpoint (default: http://localhost:4321/api/chat)
 *   --runs <N>              Runs per prompt (default: 3)
 *   --delay <ms>            Delay between requests (default: 3500)
 *   --save-baseline <name>  Save results as named baseline
 *   --compare <name>        Compare against saved baseline
 *   --save-jsonl            Save raw JSONL outputs to .eval-outputs/
 *   --verbose               Print per-run violations
 *   --skills                Enable skills (fetches skill IDs, sends with each request)
 *   --playground-key <key>  Playground API key (falls back to PLAYGROUND_SECRET env)
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseJsonlToTree,
  gradeTree,
  RULE_NAMES,
} from "../src/generative/structural-graders.js";
import type { GradeReport } from "../src/generative/structural-graders.js";
import {
  gradeComposition,
  COMPOSITION_RULE_NAMES,
} from "../src/generative/composition-graders.js";
import { EVAL_PROMPTS } from "../src/generative/eval/eval-prompts.js";

// =============================================================================
// Config
// =============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PKG_ROOT = resolve(__dirname, "..");
const BASELINES_DIR = resolve(PKG_ROOT, ".eval-baselines");
const OUTPUTS_DIR = resolve(PKG_ROOT, ".eval-outputs");

// =============================================================================
// CLI arg parsing
// =============================================================================

interface CliArgs {
  url: string;
  runs: number;
  delay: number;
  saveBaseline: string | null;
  compare: string | null;
  saveJsonl: boolean;
  verbose: boolean;
  skills: boolean;
  playgroundKey: string | null;
}

function parseArgs(argv: ReadonlyArray<string>): CliArgs {
  const args: CliArgs = {
    url: "http://localhost:4321/api/chat",
    runs: 3,
    delay: 3500,
    saveBaseline: null,
    compare: null,
    saveJsonl: false,
    verbose: false,
    skills: false,
    playgroundKey: null,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--url":
        args.url = argv[++i] ?? args.url;
        break;
      case "--runs":
        args.runs = parseInt(argv[++i] ?? "3", 10);
        break;
      case "--delay":
        args.delay = parseInt(argv[++i] ?? "3500", 10);
        break;
      case "--save-baseline":
        args.saveBaseline = argv[++i] ?? null;
        break;
      case "--compare":
        args.compare = argv[++i] ?? null;
        break;
      case "--save-jsonl":
        args.saveJsonl = true;
        break;
      case "--verbose":
        args.verbose = true;
        break;
      case "--skills":
        args.skills = true;
        break;
      case "--playground-key":
        args.playgroundKey = argv[++i] ?? null;
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        process.exit(1);
    }
  }

  // --playground-key falls back to PLAYGROUND_SECRET env var
  if (args.playgroundKey == null) {
    const envKey = process.env["PLAYGROUND_SECRET"];
    if (typeof envKey === "string" && envKey.length > 0) {
      args.playgroundKey = envKey;
    }
  }

  return args;
}

// =============================================================================
// Skills fetching
// =============================================================================

/**
 * Fetch available skill IDs from the /api/chat/skills endpoint.
 * Requires a valid playground key for authentication.
 */
async function fetchSkillIds(
  baseUrl: string,
  playgroundKey: string,
): Promise<ReadonlyArray<string>> {
  // Derive skills URL from chat URL (e.g. /api/chat → /api/chat/skills)
  const skillsUrl = baseUrl.replace(/\/?$/, "/skills");

  const response = await fetch(skillsUrl, {
    method: "GET",
    headers: { "X-Playground-Key": playgroundKey },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch skills: HTTP ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as {
    skills?: ReadonlyArray<{ id: string; name: string; description: string }>;
  };

  if (!Array.isArray(data.skills)) {
    throw new Error("Unexpected skills response: missing skills array");
  }

  return data.skills.map((s) => s.id);
}

// =============================================================================
// SSE → JSONL extraction
// =============================================================================

/** Extra options for authenticated/skills-enabled requests. */
interface FetchJsonlOptions {
  readonly playgroundKey?: string;
  readonly skillIds?: ReadonlyArray<string>;
}

/**
 * Send a message to the chat endpoint and extract the JSONL response.
 * Reads the SSE stream, concatenates all `data: {"response":"..."}` payloads.
 */
async function fetchJsonl(
  url: string,
  message: string,
  options?: FetchJsonlOptions,
): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options?.playgroundKey) {
    headers["X-Playground-Key"] = options.playgroundKey;
  }

  const body: Record<string, unknown> = { message };
  if (options?.skillIds && options.skillIds.length > 0) {
    body["skillIds"] = options.skillIds;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const responseBody = response.body;
  if (!responseBody) {
    throw new Error("No response body");
  }

  const reader = responseBody.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let jsonl = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete SSE lines
    const lines = buffer.split("\n");
    // Keep incomplete last line in buffer
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === "data: [DONE]") continue;
      if (!trimmed.startsWith("data: ")) continue;

      const payload = trimmed.slice(6); // strip "data: "
      try {
        const parsed = JSON.parse(payload) as { response?: string };
        if (typeof parsed.response === "string") {
          jsonl += parsed.response;
        }
      } catch {
        // Skip malformed SSE data lines
      }
    }
  }

  // Process any remaining buffer
  if (buffer.trim().startsWith("data: ") && buffer.trim() !== "data: [DONE]") {
    const payload = buffer.trim().slice(6);
    try {
      const parsed = JSON.parse(payload) as { response?: string };
      if (typeof parsed.response === "string") {
        jsonl += parsed.response;
      }
    } catch {
      // Skip
    }
  }

  return jsonl;
}

// =============================================================================
// Run evaluation
// =============================================================================

interface RunResult {
  promptName: string;
  runIndex: number;
  report: GradeReport | null;
  compositionReport: GradeReport | null;
  error: string | null;
  jsonl: string;
}

interface PromptAggregate {
  promptName: string;
  totalRuns: number;
  successfulRuns: number;
  errors: number;
  rulePassRates: Record<string, number>;
  compositionPassRates: Record<string, number>;
  allPassRate: number;
}

interface Baseline {
  timestamp: string;
  args: Omit<
    CliArgs,
    | "saveBaseline"
    | "compare"
    | "saveJsonl"
    | "verbose"
    | "skills"
    | "playgroundKey"
  >;
  prompts: ReadonlyArray<PromptAggregate>;
  overall: Record<string, number>;
  overallComposition: Record<string, number>;
  overallAllPass: number;
}

async function runEval(args: CliArgs): Promise<void> {
  const {
    url,
    runs,
    delay,
    saveBaseline,
    compare,
    saveJsonl,
    verbose,
    skills,
    playgroundKey,
  } = args;

  // --skills requires a playground key
  if (skills && playgroundKey == null) {
    console.error(
      "Error: --skills requires a playground key. Provide --playground-key <key> or set PLAYGROUND_SECRET env var.",
    );
    process.exit(1);
  }

  // Fetch skill IDs at startup when --skills is set
  let skillIds: ReadonlyArray<string> = [];
  if (skills && playgroundKey != null) {
    console.log("Fetching skill IDs...");
    skillIds = await fetchSkillIds(url, playgroundKey);
    console.log(`  Found ${skillIds.length} skills: ${skillIds.join(", ")}`);
  }

  console.log(
    `\nEval harness — ${EVAL_PROMPTS.length} prompts × ${runs} runs = ${EVAL_PROMPTS.length * runs} requests`,
  );
  console.log(`Endpoint: ${url}`);
  if (skills) {
    console.log(`Skills: enabled (${skillIds.length} skills)`);
  }
  console.log(`Delay: ${delay}ms (~${Math.floor(60000 / delay)} req/min)\n`);

  if (saveJsonl) {
    mkdirSync(OUTPUTS_DIR, { recursive: true });
  }

  // Build fetch options — reused for every request
  const fetchOptions: FetchJsonlOptions | undefined =
    skills && playgroundKey != null ? { playgroundKey, skillIds } : undefined;

  const allResults: RunResult[] = [];
  let requestCount = 0;

  for (const prompt of EVAL_PROMPTS) {
    process.stdout.write(`  ${prompt.id.padEnd(30)}`);

    for (let run = 0; run < runs; run++) {
      // Rate limit delay (skip before first request)
      if (requestCount > 0) {
        await sleep(delay);
      }
      requestCount++;

      try {
        const jsonl = await fetchJsonl(url, prompt.prompt, fetchOptions);

        if (saveJsonl) {
          const filename = `${prompt.id}-run${run}.jsonl`;
          writeFileSync(resolve(OUTPUTS_DIR, filename), jsonl, "utf-8");
        }

        const tree = parseJsonlToTree(jsonl);
        const report = gradeTree(tree);
        const compositionReport = gradeComposition(tree);

        allResults.push({
          promptName: prompt.id,
          runIndex: run,
          report,
          compositionReport,
          error: null,
          jsonl,
        });

        const bothPass = report.allPass && compositionReport.allPass;
        process.stdout.write(bothPass ? " ✓" : " ✗");

        if (verbose && !bothPass) {
          const failures = [
            ...report.results.filter((r) => !r.pass),
            ...compositionReport.results.filter((r) => !r.pass),
          ];
          for (const f of failures) {
            console.log(`\n    [${f.rule}] ${f.violations.join("; ")}`);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        allResults.push({
          promptName: prompt.id,
          runIndex: run,
          report: null,
          compositionReport: null,
          error: message,
          jsonl: "",
        });
        process.stdout.write(" E");

        if (verbose) {
          console.log(`\n    [error] ${message}`);
        }
      }
    }

    console.log();
  }

  // ==========================================================================
  // Aggregate results
  // ==========================================================================

  const promptAggregates: PromptAggregate[] = [];

  for (const prompt of EVAL_PROMPTS) {
    const promptResults = allResults.filter((r) => r.promptName === prompt.id);
    const successful = promptResults.filter((r) => r.report !== null);

    const rulePassRates: Record<string, number> = {};
    for (const rule of RULE_NAMES) {
      if (successful.length === 0) {
        rulePassRates[rule] = 0;
      } else {
        const passing = successful.filter(
          (r) => r.report?.results.find((res) => res.rule === rule)?.pass,
        ).length;
        rulePassRates[rule] = passing / successful.length;
      }
    }

    const compositionPassRates: Record<string, number> = {};
    for (const rule of COMPOSITION_RULE_NAMES) {
      if (successful.length === 0) {
        compositionPassRates[rule] = 0;
      } else {
        const passing = successful.filter(
          (r) =>
            r.compositionReport?.results.find((res) => res.rule === rule)?.pass,
        ).length;
        compositionPassRates[rule] = passing / successful.length;
      }
    }

    const allPassCount = successful.filter(
      (r) => r.report?.allPass && r.compositionReport?.allPass,
    ).length;

    promptAggregates.push({
      promptName: prompt.id,
      totalRuns: promptResults.length,
      successfulRuns: successful.length,
      errors: promptResults.length - successful.length,
      rulePassRates,
      compositionPassRates,
      allPassRate: successful.length > 0 ? allPassCount / successful.length : 0,
    });
  }

  // Overall per-rule pass rates
  const overall: Record<string, number> = {};
  const successfulResults = allResults.filter((r) => r.report !== null);

  for (const rule of RULE_NAMES) {
    if (successfulResults.length === 0) {
      overall[rule] = 0;
    } else {
      const passing = successfulResults.filter(
        (r) => r.report?.results.find((res) => res.rule === rule)?.pass,
      ).length;
      overall[rule] = passing / successfulResults.length;
    }
  }

  const overallComposition: Record<string, number> = {};
  for (const rule of COMPOSITION_RULE_NAMES) {
    if (successfulResults.length === 0) {
      overallComposition[rule] = 0;
    } else {
      const passing = successfulResults.filter(
        (r) =>
          r.compositionReport?.results.find((res) => res.rule === rule)?.pass,
      ).length;
      overallComposition[rule] = passing / successfulResults.length;
    }
  }

  const overallAllPass =
    successfulResults.length > 0
      ? successfulResults.filter(
          (r) => r.report?.allPass && r.compositionReport?.allPass,
        ).length / successfulResults.length
      : 0;

  // ==========================================================================
  // Print report
  // ==========================================================================

  const ALL_RULES = [...RULE_NAMES, ...COMPOSITION_RULE_NAMES];
  const COL_W = 32; // prompt ID column width
  const RULE_COL_W = 9;
  const LINE_W = COL_W + 6 + ALL_RULES.length * RULE_COL_W + 4;

  console.log("\n" + "═".repeat(LINE_W));
  console.log("  RESULTS");
  console.log("═".repeat(LINE_W));

  // Per-prompt summary — structural rules
  console.log("\n  Structural rules (8):");
  console.log("  " + "─".repeat(COL_W + 6 + RULE_NAMES.length * RULE_COL_W));
  console.log(
    `  ${"Prompt".padEnd(COL_W)} ${"All".padStart(6)} ${RULE_NAMES.map((r) => r.slice(0, 8).padStart(RULE_COL_W)).join("")}`,
  );
  console.log("  " + "─".repeat(COL_W + 6 + RULE_NAMES.length * RULE_COL_W));

  for (const agg of promptAggregates) {
    const allStr = pct(agg.allPassRate);
    const ruleStrs = RULE_NAMES.map((r) =>
      pct(agg.rulePassRates[r] ?? 0).padStart(RULE_COL_W),
    );
    const errSuffix = agg.errors > 0 ? ` (${agg.errors}E)` : "";
    console.log(
      `  ${(agg.promptName + errSuffix).padEnd(COL_W)} ${allStr.padStart(6)} ${ruleStrs.join("")}`,
    );
  }

  console.log("  " + "─".repeat(COL_W + 6 + RULE_NAMES.length * RULE_COL_W));
  const overallStructStrs = RULE_NAMES.map((r) =>
    pct(overall[r] ?? 0).padStart(RULE_COL_W),
  );
  console.log(
    `  ${"OVERALL".padEnd(COL_W)} ${pct(overallAllPass).padStart(6)} ${overallStructStrs.join("")}`,
  );

  // Per-prompt summary — composition rules
  console.log("\n  Composition rules (6):");
  console.log(
    "  " + "─".repeat(COL_W + 6 + COMPOSITION_RULE_NAMES.length * RULE_COL_W),
  );
  console.log(
    `  ${"Prompt".padEnd(COL_W)} ${"All".padStart(6)} ${COMPOSITION_RULE_NAMES.map((r) => r.slice(0, 8).padStart(RULE_COL_W)).join("")}`,
  );
  console.log(
    "  " + "��".repeat(COL_W + 6 + COMPOSITION_RULE_NAMES.length * RULE_COL_W),
  );

  for (const agg of promptAggregates) {
    const allStr = pct(agg.allPassRate);
    const compStrs = COMPOSITION_RULE_NAMES.map((r) =>
      pct(agg.compositionPassRates[r] ?? 0).padStart(RULE_COL_W),
    );
    const errSuffix = agg.errors > 0 ? ` (${agg.errors}E)` : "";
    console.log(
      `  ${(agg.promptName + errSuffix).padEnd(COL_W)} ${allStr.padStart(6)} ${compStrs.join("")}`,
    );
  }

  console.log(
    "  " + "─".repeat(COL_W + 6 + COMPOSITION_RULE_NAMES.length * RULE_COL_W),
  );
  const overallCompStrs = COMPOSITION_RULE_NAMES.map((r) =>
    pct(overallComposition[r] ?? 0).padStart(RULE_COL_W),
  );
  console.log(
    `  ${"OVERALL".padEnd(COL_W)} ${pct(overallAllPass).padStart(6)} ${overallCompStrs.join("")}`,
  );
  console.log(
    "  " + "─".repeat(COL_W + 6 + COMPOSITION_RULE_NAMES.length * RULE_COL_W),
  );

  // Error summary
  const totalErrors = allResults.filter((r) => r.error !== null).length;
  if (totalErrors > 0) {
    console.log(
      `\n  Errors: ${totalErrors}/${allResults.length} requests failed`,
    );
  }

  // ==========================================================================
  // Baseline save/compare
  // ==========================================================================

  const baseline: Baseline = {
    timestamp: new Date().toISOString(),
    args: { url, runs, delay },
    prompts: promptAggregates,
    overall,
    overallComposition,
    overallAllPass,
  };

  if (saveBaseline) {
    mkdirSync(BASELINES_DIR, { recursive: true });
    const path = resolve(BASELINES_DIR, `${saveBaseline}.json`);
    writeFileSync(path, JSON.stringify(baseline, null, 2), "utf-8");
    console.log(`\n  Baseline saved: ${path}`);
  }

  if (compare) {
    const path = resolve(BASELINES_DIR, `${compare}.json`);
    if (!existsSync(path)) {
      console.error(`\n  Baseline not found: ${path}`);
      console.error(`  Available: run with --save-baseline <name> first`);
    } else {
      const prev = JSON.parse(readFileSync(path, "utf-8")) as Partial<Baseline>;
      console.log(
        `\n  Comparison vs "${compare}" (${prev.timestamp ?? "unknown"}):`,
      );
      console.log("  " + "─".repeat(50));

      const allDelta = overallAllPass - (prev.overallAllPass ?? 0);
      console.log(
        `  ${"All-pass".padEnd(25)} ${pct(prev.overallAllPass ?? 0).padStart(7)} → ${pct(overallAllPass).padStart(7)}  ${delta(allDelta)}`,
      );

      // Structural rules
      for (const rule of RULE_NAMES) {
        const prevRate = prev.overall?.[rule] ?? 0;
        const currRate = overall[rule] ?? 0;
        const d = currRate - prevRate;
        console.log(
          `  ${rule.padEnd(25)} ${pct(prevRate).padStart(7)} → ${pct(currRate).padStart(7)}  ${delta(d)}`,
        );
      }

      // Composition rules — backward compat: show N/A for old baselines
      const hasComposition = prev.overallComposition != null;
      for (const rule of COMPOSITION_RULE_NAMES) {
        const currRate = overallComposition[rule] ?? 0;
        if (hasComposition) {
          const prevRate = prev.overallComposition?.[rule] ?? 0;
          const d = currRate - prevRate;
          console.log(
            `  ${rule.padEnd(25)} ${pct(prevRate).padStart(7)} → ${pct(currRate).padStart(7)}  ${delta(d)}`,
          );
        } else {
          console.log(
            `  ${rule.padEnd(25)} ${"N/A".padStart(7)} → ${pct(currRate).padStart(7)}`,
          );
        }
      }
      console.log("  " + "─".repeat(50));
    }
  }

  console.log();
}

// =============================================================================
// Helpers
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function delta(d: number): string {
  const pctStr = `${Math.abs(Math.round(d * 100))}%`;
  if (d > 0.005) return `▲ +${pctStr}`;
  if (d < -0.005) return `▼ -${pctStr}`;
  return `  =${pctStr}`;
}

// =============================================================================
// Main
// =============================================================================

const args = parseArgs(process.argv);
runEval(args).catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
