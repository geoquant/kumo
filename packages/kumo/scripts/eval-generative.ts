#!/usr/bin/env tsx
/**
 * Eval harness — tests actual LLM output against structural graders.
 *
 * Sends eval prompts to the /api/chat SSE endpoint, parses SSE → JSONL → UITree,
 * runs gradeTree(), and reports per-rule pass rates.
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

// =============================================================================
// Config
// =============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PKG_ROOT = resolve(__dirname, "..");
const BASELINES_DIR = resolve(PKG_ROOT, ".eval-baselines");
const OUTPUTS_DIR = resolve(PKG_ROOT, ".eval-outputs");

// =============================================================================
// Eval prompts
// =============================================================================

/** Each eval prompt has a name (for reporting) and a user message. */
interface EvalPrompt {
  readonly name: string;
  readonly message: string;
}

const EVAL_PROMPTS: ReadonlyArray<EvalPrompt> = [
  // 4 regression prompts (matching fixture types)
  {
    name: "user-card",
    message:
      "Create a user profile card showing name, email, role badge, and a bio section.",
  },
  {
    name: "settings-form",
    message:
      "Build a settings form with email input, notification toggle switch, and a save button.",
  },
  {
    name: "counter",
    message:
      "Create a simple counter with a title, a number display, and increment/decrement buttons.",
  },
  {
    name: "pricing-table",
    message:
      "Build a pricing table with 3 tiers (Basic, Pro, Enterprise) showing features and price for each.",
  },
  // 6 edge case prompts
  {
    name: "empty-state",
    message:
      "Create an empty state component for when there are no search results.",
  },
  {
    name: "dashboard",
    message:
      "Build a dashboard with a header, 3 metric cards in a grid, and a recent activity list below.",
  },
  {
    name: "complex-table",
    message:
      "Create a data table showing server status with columns: name, region, status badge, uptime meter, and actions.",
  },
  {
    name: "multi-field-form",
    message:
      "Build a contact form with name, email, subject select dropdown, message textarea, and submit button.",
  },
  {
    name: "nested-layout",
    message:
      "Create a layout with a header cluster (logo + nav links), a main content area with two columns, and a footer.",
  },
  {
    name: "alert-variants",
    message:
      "Show 4 different banner alerts: info, success, warning, and error, each with appropriate text.",
  },
];

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
      default:
        console.error(`Unknown argument: ${arg}`);
        process.exit(1);
    }
  }

  return args;
}

// =============================================================================
// SSE → JSONL extraction
// =============================================================================

/**
 * Send a message to the chat endpoint and extract the JSONL response.
 * Reads the SSE stream, concatenates all `data: {"response":"..."}` payloads.
 */
async function fetchJsonl(url: string, message: string): Promise<string> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const body = response.body;
  if (!body) {
    throw new Error("No response body");
  }

  const reader = body.getReader();
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
  error: string | null;
  jsonl: string;
}

interface PromptAggregate {
  promptName: string;
  totalRuns: number;
  successfulRuns: number;
  errors: number;
  rulePassRates: Record<string, number>;
  allPassRate: number;
}

interface Baseline {
  timestamp: string;
  args: Omit<CliArgs, "saveBaseline" | "compare" | "saveJsonl" | "verbose">;
  prompts: ReadonlyArray<PromptAggregate>;
  overall: Record<string, number>;
  overallAllPass: number;
}

async function runEval(args: CliArgs): Promise<void> {
  const { url, runs, delay, saveBaseline, compare, saveJsonl, verbose } = args;

  console.log(
    `\nEval harness — ${EVAL_PROMPTS.length} prompts × ${runs} runs = ${EVAL_PROMPTS.length * runs} requests`,
  );
  console.log(`Endpoint: ${url}`);
  console.log(`Delay: ${delay}ms (~${Math.floor(60000 / delay)} req/min)\n`);

  if (saveJsonl) {
    mkdirSync(OUTPUTS_DIR, { recursive: true });
  }

  const allResults: RunResult[] = [];
  let requestCount = 0;

  for (const prompt of EVAL_PROMPTS) {
    process.stdout.write(`  ${prompt.name.padEnd(20)}`);

    for (let run = 0; run < runs; run++) {
      // Rate limit delay (skip before first request)
      if (requestCount > 0) {
        await sleep(delay);
      }
      requestCount++;

      try {
        const jsonl = await fetchJsonl(url, prompt.message);

        if (saveJsonl) {
          const filename = `${prompt.name}-run${run}.jsonl`;
          writeFileSync(resolve(OUTPUTS_DIR, filename), jsonl, "utf-8");
        }

        const tree = parseJsonlToTree(jsonl);
        const report = gradeTree(tree);

        allResults.push({
          promptName: prompt.name,
          runIndex: run,
          report,
          error: null,
          jsonl,
        });

        process.stdout.write(report.allPass ? " ✓" : " ✗");

        if (verbose && !report.allPass) {
          const failures = report.results.filter((r) => !r.pass);
          for (const f of failures) {
            console.log(`\n    [${f.rule}] ${f.violations.join("; ")}`);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        allResults.push({
          promptName: prompt.name,
          runIndex: run,
          report: null,
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
    const promptResults = allResults.filter(
      (r) => r.promptName === prompt.name,
    );
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

    const allPassCount = successful.filter((r) => r.report?.allPass).length;

    promptAggregates.push({
      promptName: prompt.name,
      totalRuns: promptResults.length,
      successfulRuns: successful.length,
      errors: promptResults.length - successful.length,
      rulePassRates,
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

  const overallAllPass =
    successfulResults.length > 0
      ? successfulResults.filter((r) => r.report?.allPass).length /
        successfulResults.length
      : 0;

  // ==========================================================================
  // Print report
  // ==========================================================================

  console.log("\n" + "═".repeat(80));
  console.log("  RESULTS");
  console.log("═".repeat(80));

  // Per-prompt summary
  console.log("\n  Per-prompt pass rates:");
  console.log("  " + "─".repeat(76));
  console.log(
    `  ${"Prompt".padEnd(22)} ${"All".padStart(6)} ${RULE_NAMES.map((r) => r.slice(0, 8).padStart(9)).join("")}`,
  );
  console.log("  " + "─".repeat(76));

  for (const agg of promptAggregates) {
    const allStr = pct(agg.allPassRate);
    const ruleStrs = RULE_NAMES.map((r) =>
      pct(agg.rulePassRates[r] ?? 0).padStart(9),
    );
    const errSuffix = agg.errors > 0 ? ` (${agg.errors}E)` : "";
    console.log(
      `  ${(agg.promptName + errSuffix).padEnd(22)} ${allStr.padStart(6)} ${ruleStrs.join("")}`,
    );
  }

  console.log("  " + "─".repeat(76));

  // Overall
  const overallRuleStrs = RULE_NAMES.map((r) =>
    pct(overall[r] ?? 0).padStart(9),
  );
  console.log(
    `  ${"OVERALL".padEnd(22)} ${pct(overallAllPass).padStart(6)} ${overallRuleStrs.join("")}`,
  );
  console.log("  " + "─".repeat(76));

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
      const prev = JSON.parse(readFileSync(path, "utf-8")) as Baseline;
      console.log(`\n  Comparison vs "${compare}" (${prev.timestamp}):`);
      console.log("  " + "─".repeat(50));

      const allDelta = overallAllPass - prev.overallAllPass;
      console.log(
        `  ${"All-pass".padEnd(25)} ${pct(prev.overallAllPass).padStart(7)} → ${pct(overallAllPass).padStart(7)}  ${delta(allDelta)}`,
      );

      for (const rule of RULE_NAMES) {
        const prevRate = prev.overall[rule] ?? 0;
        const currRate = overall[rule] ?? 0;
        const d = currRate - prevRate;
        console.log(
          `  ${rule.padEnd(25)} ${pct(prevRate).padStart(7)} → ${pct(currRate).padStart(7)}  ${delta(d)}`,
        );
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
