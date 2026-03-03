/**
 * _EvalReportPage — Eval report page for grading Kumo generative UI quality.
 *
 * Two modes:
 * - **Live eval** (authenticated): Runs all 13 EVAL_PROMPTS against /api/chat,
 *   grades each progressively, and builds a baseline.
 * - **Upload** (anyone): Drag-drop baseline JSON files for viewing and comparison.
 *
 * Features:
 * - Per-prompt pass/fail matrix (13 prompts x 14 rules)
 * - A/B comparison with delta highlighting when two baselines loaded
 * - Trend chart (SVG) when 3+ baselines loaded
 * - Auth gating: unauthenticated users see upload-only mode
 *
 * Loaded at /playground/report with client:load.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, CloudflareLogo, Empty, Loader } from "@cloudflare/kumo";
import {
  CheckCircleIcon,
  LightningIcon,
  LockKeyIcon,
  UploadSimpleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { createJsonlParser } from "@cloudflare/kumo/streaming";
import {
  EVAL_PROMPTS,
  gradeTree,
  gradeComposition,
  RULE_NAMES,
  COMPOSITION_RULE_NAMES,
  parseJsonlToTree,
} from "@cloudflare/kumo/generative";
import type { GradeReport } from "@cloudflare/kumo/generative";
import { readSSEStream } from "~/lib/read-sse-stream";
import { ThemeToggle } from "~/components/ThemeToggle";

// =============================================================================
// Types
// =============================================================================

/** Per-prompt aggregate from a baseline (matches CLI Baseline.prompts shape). */
interface PromptAggregate {
  readonly promptName: string;
  readonly totalRuns: number;
  readonly successfulRuns: number;
  readonly errors: number;
  readonly rulePassRates: Readonly<Record<string, number>>;
  readonly compositionPassRates: Readonly<Record<string, number>>;
  readonly allPassRate: number;
}

/** Baseline JSON shape (matches CLI eval --save-baseline output). */
interface Baseline {
  readonly timestamp: string;
  readonly args: Readonly<Record<string, unknown>>;
  readonly prompts: readonly PromptAggregate[];
  readonly overall: Readonly<Record<string, number>>;
  readonly overallComposition?: Readonly<Record<string, number>>;
  readonly overallAllPass: number;
}

/** A loaded baseline with a display name. */
interface NamedBaseline {
  readonly name: string;
  readonly baseline: Baseline;
}

type AuthState = "checking" | "authenticated" | "denied";

/** Live eval progress for a single prompt. */
interface PromptEvalResult {
  readonly promptId: string;
  readonly status: "pending" | "running" | "done" | "error";
  readonly structuralReport: GradeReport | null;
  readonly compositionReport: GradeReport | null;
  readonly error: string | null;
}

// All 14 rule names (8 structural + 6 composition) in order.
const ALL_RULE_NAMES: readonly string[] = [
  ...RULE_NAMES,
  ...COMPOSITION_RULE_NAMES,
];

// =============================================================================
// Auth hook (reuses pattern from playground)
// =============================================================================

function useReportAuth(): { auth: AuthState; apiKey: string | null } {
  const [auth, setAuth] = useState<AuthState>("checking");
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get("key");

    if (!key) {
      setAuth("denied");
      return;
    }

    const controller = new AbortController();

    fetch("/api/chat/prompt", {
      headers: { "X-Playground-Key": key },
      signal: controller.signal,
    })
      .then((res) => {
        if (res.ok) {
          setApiKey(key);
          setAuth("authenticated");
        } else {
          setAuth("denied");
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setAuth("denied");
      });

    return () => controller.abort();
  }, []);

  return { auth, apiKey };
}

// =============================================================================
// Live eval runner
// =============================================================================

/** Run a single prompt through /api/chat, parse JSONL, grade the tree. */
async function runSinglePrompt(
  promptText: string,
  apiKey: string,
  signal: AbortSignal,
): Promise<{
  structural: GradeReport | null;
  composition: GradeReport | null;
  error: string | null;
}> {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "X-Playground-Key": apiKey,
      },
      body: JSON.stringify({ message: promptText }),
      signal,
    });

    if (!response.ok) {
      return {
        structural: null,
        composition: null,
        error: `HTTP ${String(response.status)}`,
      };
    }

    let jsonl = "";
    const parser = createJsonlParser();

    await readSSEStream(
      response,
      (token) => {
        jsonl += token;
        parser.push(token);
      },
      signal,
    );

    parser.flush();

    if (!jsonl.trim()) {
      return { structural: null, composition: null, error: "Empty response" };
    }

    const tree = parseJsonlToTree(jsonl);
    const structural = gradeTree(tree);
    const composition = gradeComposition(tree);

    return { structural, composition, error: null };
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { structural: null, composition: null, error: "Aborted" };
    }
    return {
      structural: null,
      composition: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/** Convert live eval results into a Baseline-compatible structure. */
function resultsToBaseline(results: readonly PromptEvalResult[]): Baseline {
  const timestamp = new Date().toISOString();
  const prompts: PromptAggregate[] = [];

  for (const r of results) {
    const rulePassRates: Record<string, number> = {};
    const compositionPassRates: Record<string, number> = {};

    if (r.structuralReport) {
      for (const gr of r.structuralReport.results) {
        rulePassRates[gr.rule] = gr.pass ? 1 : 0;
      }
    }
    if (r.compositionReport) {
      for (const gr of r.compositionReport.results) {
        compositionPassRates[gr.rule] = gr.pass ? 1 : 0;
      }
    }

    const allPass =
      r.structuralReport !== null &&
      r.compositionReport !== null &&
      r.structuralReport.allPass &&
      r.compositionReport.allPass;

    prompts.push({
      promptName: r.promptId,
      totalRuns: 1,
      successfulRuns: r.error === null ? 1 : 0,
      errors: r.error !== null ? 1 : 0,
      rulePassRates,
      compositionPassRates,
      allPassRate: allPass ? 1 : 0,
    });
  }

  // Aggregate overall pass rates
  const overall: Record<string, number> = {};
  const overallComposition: Record<string, number> = {};

  for (const ruleName of RULE_NAMES) {
    const rates = prompts
      .map((p) => p.rulePassRates[ruleName])
      .filter((v): v is number => v !== undefined);
    overall[ruleName] =
      rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  }

  for (const ruleName of COMPOSITION_RULE_NAMES) {
    const rates = prompts
      .map((p) => p.compositionPassRates[ruleName])
      .filter((v): v is number => v !== undefined);
    overallComposition[ruleName] =
      rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  }

  const overallAllPass =
    prompts.length > 0
      ? prompts.reduce((a, p) => a + p.allPassRate, 0) / prompts.length
      : 0;

  return {
    timestamp,
    args: { url: window.location.origin, runs: 1, delay: 0 },
    prompts,
    overall,
    overallComposition,
    overallAllPass,
  };
}

// =============================================================================
// Component: Pass/Fail Matrix
// =============================================================================

/** Renders a 13x14 grid showing pass/fail per prompt per rule. */
function PassFailMatrix({ baseline }: { readonly baseline: Baseline }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-kumo-base px-2 py-1 text-left font-mono text-kumo-subtle">
              Prompt
            </th>
            {ALL_RULE_NAMES.map((rule) => (
              <th
                key={rule}
                className="px-1 py-1 text-center font-mono text-kumo-subtle"
                title={rule}
              >
                <span className="inline-block max-w-[60px] truncate">
                  {rule.replace(/-/g, "\u2011")}
                </span>
              </th>
            ))}
            <th className="px-2 py-1 text-center font-mono text-kumo-subtle">
              All
            </th>
          </tr>
        </thead>
        <tbody>
          {baseline.prompts.map((p) => {
            const allRates = { ...p.rulePassRates, ...p.compositionPassRates };
            return (
              <tr key={p.promptName} className="border-t border-kumo-line">
                <td className="sticky left-0 z-10 bg-kumo-base px-2 py-1 font-mono text-kumo-default">
                  <span
                    className="inline-block max-w-[200px] truncate"
                    title={p.promptName}
                  >
                    {p.promptName}
                  </span>
                </td>
                {ALL_RULE_NAMES.map((rule) => {
                  const rate = allRates[rule];
                  const pass = rate !== undefined && rate >= 1;
                  const partial = rate !== undefined && rate > 0 && rate < 1;
                  return (
                    <td key={rule} className="px-1 py-1 text-center">
                      {rate === undefined ? (
                        <span className="text-kumo-subtle">&mdash;</span>
                      ) : pass ? (
                        <span className="text-kumo-success">&#x2713;</span>
                      ) : partial ? (
                        <span className="text-kumo-warning">
                          {Math.round(rate * 100)}%
                        </span>
                      ) : (
                        <span className="text-kumo-danger">&#x2717;</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-1 text-center">
                  {p.allPassRate >= 1 ? (
                    <span className="font-semibold text-kumo-success">
                      PASS
                    </span>
                  ) : (
                    <span className="font-semibold text-kumo-danger">
                      {Math.round(p.allPassRate * 100)}%
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// Component: A/B Comparison
// =============================================================================

/** Two-baseline comparison with delta highlighting. */
function ABComparison({
  baselineA,
  baselineB,
}: {
  readonly baselineA: NamedBaseline;
  readonly baselineB: NamedBaseline;
}) {
  const a = baselineA.baseline;
  const b = baselineB.baseline;

  const allOverallA = { ...a.overall, ...(a.overallComposition ?? {}) };
  const allOverallB = { ...b.overall, ...(b.overallComposition ?? {}) };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-sm text-kumo-subtle">
        <span>
          <strong className="text-kumo-default">A:</strong> {baselineA.name}
        </span>
        <span>vs</span>
        <span>
          <strong className="text-kumo-default">B:</strong> {baselineB.name}
        </span>
      </div>

      {/* Overall pass rate comparison */}
      <div className="rounded-lg border border-kumo-line p-4">
        <h3 className="mb-3 text-sm font-medium text-kumo-subtle">
          Overall Pass Rate
        </h3>
        <div className="flex items-baseline gap-4">
          <span className="text-2xl font-semibold text-kumo-default">
            {Math.round(a.overallAllPass * 100)}%
          </span>
          <span className="text-kumo-subtle">vs</span>
          <span className="text-2xl font-semibold text-kumo-default">
            {Math.round(b.overallAllPass * 100)}%
          </span>
          <DeltaBadge delta={b.overallAllPass - a.overallAllPass} asPercent />
        </div>
      </div>

      {/* Per-rule comparison */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left font-mono text-kumo-subtle">
                Rule
              </th>
              <th className="px-3 py-2 text-center text-kumo-subtle">
                {baselineA.name}
              </th>
              <th className="px-3 py-2 text-center text-kumo-subtle">
                {baselineB.name}
              </th>
              <th className="px-3 py-2 text-center text-kumo-subtle">Delta</th>
            </tr>
          </thead>
          <tbody>
            {ALL_RULE_NAMES.map((rule) => {
              const rateA = allOverallA[rule];
              const rateB = allOverallB[rule];
              const delta =
                rateA !== undefined && rateB !== undefined
                  ? rateB - rateA
                  : null;

              return (
                <tr key={rule} className="border-t border-kumo-line">
                  <td className="px-3 py-2 font-mono text-kumo-default">
                    {rule}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {rateA !== undefined ? (
                      <span>{Math.round(rateA * 100)}%</span>
                    ) : (
                      <span className="text-kumo-subtle">N/A</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {rateB !== undefined ? (
                      <span>{Math.round(rateB * 100)}%</span>
                    ) : (
                      <span className="text-kumo-subtle">N/A</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {delta !== null ? (
                      <DeltaBadge delta={delta} asPercent />
                    ) : (
                      <span className="text-kumo-subtle">N/A</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Signed delta badge with color coding. */
function DeltaBadge({
  delta,
  asPercent,
}: {
  readonly delta: number;
  readonly asPercent?: boolean;
}) {
  const display = asPercent
    ? `${delta >= 0 ? "+" : ""}${Math.round(delta * 100)}pp`
    : `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}`;

  const color =
    Math.abs(delta) < 0.005
      ? "text-kumo-subtle"
      : delta > 0
        ? "text-kumo-success"
        : "text-kumo-danger";

  return <span className={`font-mono text-sm ${color}`}>{display}</span>;
}

// =============================================================================
// Component: Trend Chart (SVG)
// =============================================================================

/** Simple SVG line chart of overall pass rate across 3+ baselines. */
function TrendChart({
  baselines,
}: {
  readonly baselines: readonly NamedBaseline[];
}) {
  if (baselines.length < 3) return null;

  const width = 600;
  const height = 200;
  const padX = 60;
  const padY = 30;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const points = baselines.map((b, i) => ({
    x:
      padX +
      (baselines.length > 1 ? (i / (baselines.length - 1)) * plotW : plotW / 2),
    y: padY + plotH - b.baseline.overallAllPass * plotH,
    label: b.name,
    value: b.baseline.overallAllPass,
  }));

  const polyline = points.map((p) => `${String(p.x)},${String(p.y)}`).join(" ");

  return (
    <div className="rounded-lg border border-kumo-line p-4">
      <h3 className="mb-3 text-sm font-medium text-kumo-subtle">
        Overall Pass Rate Trend
      </h3>
      <svg
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        className="w-full"
        aria-label="Trend chart of overall pass rate"
      >
        {/* Y-axis labels */}
        {[0, 25, 50, 75, 100].map((pct) => {
          const y = padY + plotH - (pct / 100) * plotH;
          return (
            <g key={pct}>
              <line
                x1={padX}
                y1={y}
                x2={width - padX}
                y2={y}
                className="stroke-kumo-line"
                strokeWidth={1}
              />
              <text
                x={padX - 8}
                y={y + 4}
                textAnchor="end"
                className="text-kumo-subtle text-[10px]"
                fill="currentColor"
              >
                {pct}%
              </text>
            </g>
          );
        })}

        {/* Line */}
        <polyline
          points={polyline}
          fill="none"
          className="stroke-kumo-brand"
          strokeWidth={2}
        />

        {/* Data points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4} className="fill-kumo-brand" />
            <text
              x={p.x}
              y={height - 6}
              textAnchor="middle"
              className="text-kumo-subtle text-[9px]"
              fill="currentColor"
            >
              {p.label.length > 12 ? p.label.slice(0, 12) + "\u2026" : p.label}
            </text>
            <text
              x={p.x}
              y={p.y - 10}
              textAnchor="middle"
              className="text-kumo-default text-[10px] font-medium"
              fill="currentColor"
            >
              {Math.round(p.value * 100)}%
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// =============================================================================
// Component: File Drop Zone
// =============================================================================

function FileDropZone({
  onBaselineLoaded,
}: {
  readonly onBaselineLoaded: (named: NamedBaseline) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed: unknown = JSON.parse(reader.result as string);
          if (
            typeof parsed !== "object" ||
            parsed === null ||
            !("prompts" in parsed) ||
            !("overall" in parsed)
          ) {
            setError("Invalid baseline JSON — missing 'prompts' or 'overall'");
            return;
          }
          const name = file.name.replace(/\.json$/i, "");
          onBaselineLoaded({ name, baseline: parsed as Baseline });
        } catch {
          setError("Failed to parse JSON");
        }
      };
      reader.readAsText(file);
    },
    [onBaselineLoaded],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
        isDragging
          ? "border-kumo-brand bg-kumo-elevated"
          : "border-kumo-line bg-kumo-base"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <UploadSimpleIcon size={32} className="mb-2 text-kumo-subtle" />
      <p className="mb-2 text-sm text-kumo-subtle">
        Drop a baseline JSON file here
      </p>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => inputRef.current?.click()}
      >
        Browse files
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleInputChange}
      />
      {error && <p className="mt-2 text-xs text-kumo-danger">{error}</p>}
    </div>
  );
}

// =============================================================================
// Component: Live Eval Panel
// =============================================================================

function LiveEvalPanel({
  apiKey,
  onBaselineCreated,
}: {
  readonly apiKey: string;
  readonly onBaselineCreated: (named: NamedBaseline) => void;
}) {
  const [results, setResults] = useState<readonly PromptEvalResult[]>(
    EVAL_PROMPTS.map((p) => ({
      promptId: p.id,
      status: "pending" as const,
      structuralReport: null,
      compositionReport: null,
      error: null,
    })),
  );
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleRun = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsRunning(true);

    // Reset all to pending
    const initial: PromptEvalResult[] = EVAL_PROMPTS.map((p) => ({
      promptId: p.id,
      status: "pending" as const,
      structuralReport: null,
      compositionReport: null,
      error: null,
    }));
    setResults(initial);

    const finalResults: PromptEvalResult[] = [...initial];

    for (let i = 0; i < EVAL_PROMPTS.length; i++) {
      if (controller.signal.aborted) break;

      const prompt = EVAL_PROMPTS[i];

      // Mark running
      finalResults[i] = { ...finalResults[i], status: "running" };
      setResults([...finalResults]);

      const { structural, composition, error } = await runSinglePrompt(
        prompt.prompt,
        apiKey,
        controller.signal,
      );

      if (controller.signal.aborted) break;

      finalResults[i] = {
        promptId: prompt.id,
        status: error !== null ? "error" : "done",
        structuralReport: structural,
        compositionReport: composition,
        error,
      };
      setResults([...finalResults]);
    }

    setIsRunning(false);

    // Build baseline from results
    if (!controller.signal.aborted) {
      const doneResults = finalResults.filter((r) => r.status === "done");
      if (doneResults.length > 0) {
        const baseline = resultsToBaseline(finalResults);
        const name = `live-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-")}`;
        onBaselineCreated({ name, baseline });
      }
    }
  }, [apiKey, onBaselineCreated]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsRunning(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const doneCount = results.filter(
    (r) => r.status === "done" || r.status === "error",
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          onClick={isRunning ? handleCancel : handleRun}
          icon={isRunning ? <XCircleIcon /> : <LightningIcon />}
        >
          {isRunning ? "Cancel" : "Run Eval"}
        </Button>
        {isRunning && (
          <span className="text-sm text-kumo-subtle">
            {doneCount}/{EVAL_PROMPTS.length} prompts
          </span>
        )}
      </div>

      {/* Progress list */}
      <div className="space-y-1">
        {results.map((r) => (
          <div
            key={r.promptId}
            className="flex items-center gap-2 rounded px-2 py-1 font-mono text-xs"
          >
            {r.status === "pending" && (
              <span className="text-kumo-subtle">&bull;</span>
            )}
            {r.status === "running" && <Loader size="sm" />}
            {r.status === "done" && (
              <CheckCircleIcon className="text-kumo-success" size={14} />
            )}
            {r.status === "error" && (
              <XCircleIcon className="text-kumo-danger" size={14} />
            )}
            <span
              className={
                r.status === "pending"
                  ? "text-kumo-subtle"
                  : "text-kumo-default"
              }
            >
              {r.promptId}
            </span>
            {r.status === "done" &&
              r.structuralReport &&
              r.compositionReport && (
                <span className="ml-auto text-kumo-subtle">
                  {r.structuralReport.results.filter((g) => g.pass).length +
                    r.compositionReport.results.filter((g) => g.pass).length}
                  /
                  {r.structuralReport.results.length +
                    r.compositionReport.results.length}
                </span>
              )}
            {r.error !== null && (
              <span className="ml-auto text-kumo-danger">{r.error}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Component: Baseline List
// =============================================================================

function BaselineList({
  baselines,
  selectedIndices,
  onToggleSelect,
  onRemove,
}: {
  readonly baselines: readonly NamedBaseline[];
  readonly selectedIndices: ReadonlySet<number>;
  readonly onToggleSelect: (index: number) => void;
  readonly onRemove: (index: number) => void;
}) {
  if (baselines.length === 0) return null;

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-medium text-kumo-subtle">Loaded Baselines</h3>
      {baselines.map((b, i) => (
        <div
          key={`${b.name}-${String(i)}`}
          className={`flex items-center gap-2 rounded border px-3 py-2 text-sm ${
            selectedIndices.has(i)
              ? "border-kumo-brand bg-kumo-elevated"
              : "border-kumo-line bg-kumo-base"
          }`}
        >
          <button
            type="button"
            className="flex-1 text-left font-mono text-kumo-default"
            onClick={() => onToggleSelect(i)}
          >
            {b.name}
          </button>
          <span className="text-xs text-kumo-subtle">
            {Math.round(b.baseline.overallAllPass * 100)}% overall
          </span>
          <button
            type="button"
            className="text-kumo-subtle hover:text-kumo-danger"
            onClick={() => onRemove(i)}
            aria-label={`Remove ${b.name}`}
          >
            <XCircleIcon size={14} />
          </button>
        </div>
      ))}
      <p className="text-xs text-kumo-subtle">
        Click to select for comparison (select 2 for A/B, 3+ for trend chart)
      </p>
    </div>
  );
}

// =============================================================================
// Main page component
// =============================================================================

export function EvalReportPage() {
  const { auth, apiKey } = useReportAuth();

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-kumo-base text-kumo-default">
      {/* Header */}
      <header className="flex h-[61px] shrink-0 items-center justify-between border-b border-kumo-line px-6">
        <div className="flex items-center gap-3">
          <CloudflareLogo variant="glyph" className="h-5 w-auto shrink-0" />
          <h1 className="text-lg font-semibold text-kumo-default">
            Eval Report
          </h1>
          <a
            href="/playground"
            className="text-sm text-kumo-subtle hover:text-kumo-default"
          >
            &larr; Playground
          </a>
        </div>
        <ThemeToggle />
      </header>

      {/* Body */}
      <main className="flex-1 overflow-auto">
        {auth === "checking" && (
          <div className="flex h-full items-center justify-center">
            <Loader size="lg" />
          </div>
        )}
        {auth === "denied" && <UploadOnlyMode />}
        {auth === "authenticated" && apiKey !== null && (
          <AuthenticatedMode apiKey={apiKey} />
        )}
      </main>
    </div>
  );
}

// =============================================================================
// Upload-only mode (no auth)
// =============================================================================

function UploadOnlyMode() {
  const [baselines, setBaselines] = useState<NamedBaseline[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<ReadonlySet<number>>(
    new Set(),
  );

  const handleBaselineLoaded = useCallback((named: NamedBaseline) => {
    setBaselines((prev) => [...prev, named]);
  }, []);

  const handleToggleSelect = useCallback((index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleRemove = useCallback((index: number) => {
    setBaselines((prev) => prev.filter((_, i) => i !== index));
    setSelectedIndices((prev) => {
      const next = new Set<number>();
      for (const i of prev) {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      }
      return next;
    });
  }, []);

  const selectedBaselines = [...selectedIndices]
    .sort((a, b) => a - b)
    .map((i) => baselines[i])
    .filter((b): b is NamedBaseline => b !== undefined);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center gap-3 rounded-lg border border-kumo-line bg-kumo-elevated p-4">
        <LockKeyIcon size={20} className="text-kumo-subtle" />
        <p className="text-sm text-kumo-subtle">
          Add <code className="text-kumo-default">?key=&lt;your-key&gt;</code>{" "}
          to the URL to enable live eval mode. Upload-only mode is available
          without authentication.
        </p>
      </div>

      <FileDropZone onBaselineLoaded={handleBaselineLoaded} />

      <BaselineList
        baselines={baselines}
        selectedIndices={selectedIndices}
        onToggleSelect={handleToggleSelect}
        onRemove={handleRemove}
      />

      <ReportBody baselines={baselines} selectedBaselines={selectedBaselines} />
    </div>
  );
}

// =============================================================================
// Authenticated mode
// =============================================================================

function AuthenticatedMode({ apiKey }: { readonly apiKey: string }) {
  const [baselines, setBaselines] = useState<NamedBaseline[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<ReadonlySet<number>>(
    new Set(),
  );

  const handleBaselineLoaded = useCallback(
    (named: NamedBaseline) => {
      setBaselines((prev) => {
        const next = [...prev, named];
        return next;
      });
      // Auto-select newly added baseline
      setSelectedIndices((prev) => {
        const next = new Set(prev);
        next.add(baselines.length);
        return next;
      });
    },
    [baselines.length],
  );

  const handleToggleSelect = useCallback((index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleRemove = useCallback((index: number) => {
    setBaselines((prev) => prev.filter((_, i) => i !== index));
    setSelectedIndices((prev) => {
      const next = new Set<number>();
      for (const i of prev) {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      }
      return next;
    });
  }, []);

  const selectedBaselines = [...selectedIndices]
    .sort((a, b) => a - b)
    .map((i) => baselines[i])
    .filter((b): b is NamedBaseline => b !== undefined);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Live eval section */}
      <div className="rounded-lg border border-kumo-line p-4">
        <h2 className="mb-3 text-sm font-semibold text-kumo-default">
          Live Eval
        </h2>
        <p className="mb-3 text-xs text-kumo-subtle">
          Runs {EVAL_PROMPTS.length} prompts against /api/chat, grades each, and
          creates a baseline.
        </p>
        <LiveEvalPanel
          apiKey={apiKey}
          onBaselineCreated={handleBaselineLoaded}
        />
      </div>

      {/* Upload section */}
      <FileDropZone onBaselineLoaded={handleBaselineLoaded} />

      <BaselineList
        baselines={baselines}
        selectedIndices={selectedIndices}
        onToggleSelect={handleToggleSelect}
        onRemove={handleRemove}
      />

      <ReportBody baselines={baselines} selectedBaselines={selectedBaselines} />
    </div>
  );
}

// =============================================================================
// Report body: matrix, A/B, trend
// =============================================================================

function ReportBody({
  baselines,
  selectedBaselines,
}: {
  readonly baselines: readonly NamedBaseline[];
  readonly selectedBaselines: readonly NamedBaseline[];
}) {
  if (baselines.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Empty
          icon={<UploadSimpleIcon size={32} />}
          title="No baselines loaded"
          description="Run an eval or upload baseline JSON files to see results."
        />
      </div>
    );
  }

  // Show matrix for the first selected baseline (or the most recent)
  const primaryBaseline =
    selectedBaselines.length > 0
      ? selectedBaselines[0]
      : baselines[baselines.length - 1];

  return (
    <div className="space-y-6">
      {/* Pass/Fail Matrix */}
      <div className="rounded-lg border border-kumo-line p-4">
        <h2 className="mb-3 text-sm font-semibold text-kumo-default">
          Pass/Fail Matrix &mdash; {primaryBaseline.name}
        </h2>
        <PassFailMatrix baseline={primaryBaseline.baseline} />
      </div>

      {/* A/B Comparison */}
      {selectedBaselines.length === 2 && (
        <div className="rounded-lg border border-kumo-line p-4">
          <h2 className="mb-3 text-sm font-semibold text-kumo-default">
            A/B Comparison
          </h2>
          <ABComparison
            baselineA={selectedBaselines[0]}
            baselineB={selectedBaselines[1]}
          />
        </div>
      )}

      {/* Trend Chart */}
      {selectedBaselines.length >= 3 && (
        <TrendChart baselines={selectedBaselines} />
      )}
    </div>
  );
}
