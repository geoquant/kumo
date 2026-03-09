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
import { Button, CloudflareLogo, cn, Empty, Loader } from "@cloudflare/kumo";
import {
  CheckCircleIcon,
  LightningIcon,
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
} from "@cloudflare/kumo/generative/graders";
import type { GradeReport } from "@cloudflare/kumo/generative/graders";
import { readSSEStream } from "~/lib/read-sse-stream";
import { parsePlaygroundFeedbackExport } from "~/lib/playground/feedback-export";
import type {
  PlaygroundFeedbackExport,
  RegressionWarning,
  ScenarioRunPair,
  ScenarioStageArtifact,
} from "~/lib/playground/eval-types";
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

interface NamedPlaygroundFeedbackExport {
  readonly name: string;
  readonly feedbackExport: PlaygroundFeedbackExport;
}

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

/** Human-readable descriptions for each grading rule. */
const RULE_DESCRIPTIONS: Readonly<Record<string, string>> = {
  "valid-component-types": "All component types are known Kumo components",
  "valid-prop-values": "Prop values match allowed variants/types",
  "required-props": "Mandatory props (e.g. label, children) are present",
  "canonical-layout": "Layout follows standard Kumo patterns",
  "no-orphan-nodes": "Every node is reachable from the root",
  "a11y-labels": "Form elements have accessibility labels",
  "depth-limit": "Nesting depth stays within limits",
  "no-redundant-children": "No unnecessary wrapper nodes",
  "has-visual-hierarchy": "Page has clear heading/content hierarchy",
  "has-responsive-layout": "Layout uses responsive patterns",
  "surface-hierarchy-correct": "Surface nesting (base → elevated) is correct",
  "spacing-consistency": "Spacing values are consistent across siblings",
  "content-density": "Content density is appropriate for the layout",
  "action-completeness": "Action areas have proper button/link elements",
};

/** Per-prompt violation details, keyed by promptName then rule name. */
type ViolationMap = ReadonlyMap<string, ReadonlyMap<string, readonly string[]>>;

// =============================================================================
// Live eval runner
// =============================================================================

/** Run a single prompt through /api/chat, parse JSONL, grade the tree. */
async function runSinglePrompt(
  promptText: string,
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

/** Renders a 13x14 grid showing pass/fail per prompt per rule.
 *  - Row click expands to show violation messages (when available).
 *  - Column headers show full rule description on hover.
 *  - Column header click opens a per-rule drill-down view.
 */
function PassFailMatrix({
  baseline,
  violations,
}: {
  readonly baseline: Baseline;
  readonly violations?: ViolationMap | undefined;
}) {
  const [expandedRows, setExpandedRows] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [drillDownRule, setDrillDownRule] = useState<string | null>(null);

  const toggleRow = useCallback((promptName: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(promptName)) {
        next.delete(promptName);
      } else {
        next.add(promptName);
      }
      return next;
    });
  }, []);

  // Drill-down view: single rule across all prompts
  if (drillDownRule !== null) {
    return (
      <RuleDrillDown
        rule={drillDownRule}
        baseline={baseline}
        violations={violations}
        onBack={() => setDrillDownRule(null)}
      />
    );
  }

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
              >
                <button
                  type="button"
                  className="inline-block max-w-[60px] cursor-pointer truncate underline decoration-dotted underline-offset-2 hover:text-kumo-default"
                  title={RULE_DESCRIPTIONS[rule] ?? rule}
                  onClick={() => setDrillDownRule(rule)}
                >
                  {rule.replace(/-/g, "\u2011")}
                </button>
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
            const isExpanded = expandedRows.has(p.promptName);
            const promptViolations = violations?.get(p.promptName);
            const hasViolations =
              promptViolations !== undefined && promptViolations.size > 0;

            return (
              <MatrixRow
                key={p.promptName}
                prompt={p}
                allRates={allRates}
                isExpanded={isExpanded}
                hasViolations={hasViolations}
                promptViolations={promptViolations}
                onToggle={() => toggleRow(p.promptName)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** A single row in the matrix, plus an expansion row for violations. */
function MatrixRow({
  prompt,
  allRates,
  isExpanded,
  hasViolations,
  promptViolations,
  onToggle,
}: {
  readonly prompt: PromptAggregate;
  readonly allRates: Readonly<Record<string, number>>;
  readonly isExpanded: boolean;
  readonly hasViolations: boolean;
  readonly promptViolations: ReadonlyMap<string, readonly string[]> | undefined;
  readonly onToggle: () => void;
}) {
  return (
    <>
      <tr
        className={cn(
          "border-t border-kumo-line",
          hasViolations && "cursor-pointer hover:bg-kumo-elevated",
        )}
        onClick={hasViolations ? onToggle : undefined}
      >
        <td className="sticky left-0 z-10 bg-kumo-base px-2 py-1 font-mono text-kumo-default">
          <span className="flex items-center gap-1">
            {hasViolations && (
              <span
                className="inline-block text-[10px] text-kumo-subtle transition-transform"
                style={{
                  transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                }}
              >
                &#x25B6;
              </span>
            )}
            <span
              className="inline-block max-w-[200px] truncate"
              title={prompt.promptName}
            >
              {prompt.promptName}
            </span>
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
          {prompt.allPassRate >= 1 ? (
            <span className="font-semibold text-kumo-success">PASS</span>
          ) : (
            <span className="font-semibold text-kumo-danger">
              {Math.round(prompt.allPassRate * 100)}%
            </span>
          )}
        </td>
      </tr>
      {isExpanded && promptViolations !== undefined && (
        <tr className="border-t border-kumo-line/50">
          <td
            colSpan={ALL_RULE_NAMES.length + 2}
            className="bg-kumo-recessed px-4 py-3"
          >
            <ViolationDetails violations={promptViolations} />
          </td>
        </tr>
      )}
    </>
  );
}

/** Renders violation messages grouped by rule for an expanded row. */
function ViolationDetails({
  violations,
}: {
  readonly violations: ReadonlyMap<string, readonly string[]>;
}) {
  const failingRules = [...violations.entries()].filter(
    ([, msgs]) => msgs.length > 0,
  );

  if (failingRules.length === 0) {
    return (
      <p className="text-xs text-kumo-subtle italic">
        No violation details available.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {failingRules.map(([rule, messages]) => (
        <div key={rule}>
          <p className="text-xs font-medium text-kumo-danger">{rule}</p>
          <ul className="ml-4 list-disc">
            {messages.map((msg, i) => (
              <li key={i} className="text-xs text-kumo-subtle">
                {msg}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Per-rule drill-down: shows one rule across all prompts with violations. */
function RuleDrillDown({
  rule,
  baseline,
  violations,
  onBack,
}: {
  readonly rule: string;
  readonly baseline: Baseline;
  readonly violations?: ViolationMap | undefined;
  readonly onBack: () => void;
}) {
  const description = RULE_DESCRIPTIONS[rule] ?? rule;
  const isStructural = (RULE_NAMES as readonly string[]).includes(rule);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="text-sm text-kumo-subtle hover:text-kumo-default"
          onClick={onBack}
        >
          &larr; Back to matrix
        </button>
        <h3 className="text-sm font-semibold text-kumo-default">{rule}</h3>
        <span className="rounded bg-kumo-elevated px-2 py-0.5 text-xs text-kumo-subtle">
          {isStructural ? "structural" : "composition"}
        </span>
      </div>
      <p className="text-xs text-kumo-subtle">{description}</p>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="px-2 py-1 text-left font-mono text-kumo-subtle">
              Prompt
            </th>
            <th className="px-2 py-1 text-center font-mono text-kumo-subtle">
              Result
            </th>
            <th className="px-2 py-1 text-left font-mono text-kumo-subtle">
              Violations
            </th>
          </tr>
        </thead>
        <tbody>
          {baseline.prompts.map((p) => {
            const rate = isStructural
              ? p.rulePassRates[rule]
              : p.compositionPassRates[rule];
            const pass = rate !== undefined && rate >= 1;
            const promptViolations = violations?.get(p.promptName)?.get(rule);

            return (
              <tr key={p.promptName} className="border-t border-kumo-line">
                <td className="px-2 py-1 font-mono text-kumo-default">
                  <span
                    className="inline-block max-w-[300px] truncate"
                    title={p.promptName}
                  >
                    {p.promptName}
                  </span>
                </td>
                <td className="px-2 py-1 text-center">
                  {rate === undefined ? (
                    <span className="text-kumo-subtle">&mdash;</span>
                  ) : pass ? (
                    <span className="text-kumo-success">&#x2713; Pass</span>
                  ) : (
                    <span className="text-kumo-danger">&#x2717; Fail</span>
                  )}
                </td>
                <td className="px-2 py-1 text-kumo-subtle">
                  {promptViolations !== undefined &&
                  promptViolations.length > 0 ? (
                    <ul className="ml-4 list-disc">
                      {promptViolations.map((msg, i) => (
                        <li key={i}>{msg}</li>
                      ))}
                    </ul>
                  ) : pass ? (
                    <span className="italic">&mdash;</span>
                  ) : (
                    <span className="italic">No detail available</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Summary */}
      <div className="flex gap-4 text-xs text-kumo-subtle">
        <span>
          Pass:{" "}
          {
            baseline.prompts.filter((p) => {
              const rate = isStructural
                ? p.rulePassRates[rule]
                : p.compositionPassRates[rule];
              return rate !== undefined && rate >= 1;
            }).length
          }
          /{baseline.prompts.length}
        </span>
      </div>
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
  onFeedbackLoaded,
}: {
  readonly onBaselineLoaded: (named: NamedBaseline) => void;
  readonly onFeedbackLoaded: (named: NamedPlaygroundFeedbackExport) => void;
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
          const parsedFeedback = parsePlaygroundFeedbackExport(parsed);
          const name = file.name.replace(/\.json$/i, "");

          if (parsedFeedback !== null) {
            onFeedbackLoaded({ name, feedbackExport: parsedFeedback });
            return;
          }

          if (
            typeof parsed !== "object" ||
            parsed === null ||
            !("prompts" in parsed) ||
            !("overall" in parsed)
          ) {
            setError(
              "Invalid report JSON - expected baseline or playground feedback export",
            );
            return;
          }
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
        Drop a baseline or feedback JSON file here
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

function formatPercent(value: number): string {
  return `${String(Math.round(value * 100))}%`;
}

function formatDelta(a: number, b: number): string {
  const delta = Math.round((b - a) * 100);
  return `${delta > 0 ? "+" : ""}${String(delta)} pts`;
}

function getWarningCounts(
  warnings: readonly RegressionWarning[],
): Readonly<Record<RegressionWarning["kind"], number>> {
  return warnings.reduce(
    (counts, warning) => ({
      ...counts,
      [warning.kind]: counts[warning.kind] + 1,
    }),
    {
      regression: 0,
      threshold: 0,
      "missing-stage": 0,
    },
  );
}

function renderChecks(
  label: string,
  artifact: ScenarioStageArtifact | null,
): React.ReactNode {
  if (artifact === null) {
    return <p className="text-xs text-kumo-subtle">{label}: missing</p>;
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-kumo-default">{label}</p>
      {artifact.checks.map((check) => (
        <p key={`${label}-${check.id}`} className="text-xs text-kumo-subtle">
          {check.pass ? "PASS" : "FAIL"}: {check.label} - {check.message}
        </p>
      ))}
    </div>
  );
}

function isChatOnlyConfirmationRun(run: ScenarioRunPair): boolean {
  return (
    run.stages.confirmation.a === null && run.stages.confirmation.b === null
  );
}

function PlaygroundRunCard({ run }: { readonly run: ScenarioRunPair }) {
  const comparison = run.comparison;
  const warnings = comparison?.warnings ?? [];
  const warningCounts = getWarningCounts(warnings);
  const chatOnlyConfirmation = isChatOnlyConfirmationRun(run);

  return (
    <div className="rounded-lg border border-kumo-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-kumo-default">{run.id}</p>
          <p className="text-xs text-kumo-subtle">
            {run.scenarioId} - {run.model} -{" "}
            {new Date(run.timestamp).toLocaleString()}
          </p>
        </div>
        <div className="text-right text-xs text-kumo-subtle">
          {comparison === null ? (
            <p>Awaiting complete run</p>
          ) : (
            <>
              <p>
                Combined A {formatPercent(comparison.stageScores.combined.a)} /
                B {formatPercent(comparison.stageScores.combined.b)}
              </p>
              <p>Winner: {comparison.winner}</p>
            </>
          )}
        </div>
      </div>

      <p className="mt-3 text-xs text-kumo-subtle">
        Warning counts - regression: {String(warningCounts.regression)},
        threshold: {String(warningCounts.threshold)}, missing-stage:{" "}
        {String(warningCounts["missing-stage"])}
      </p>

      {comparison !== null ? (
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {!chatOnlyConfirmation ? (
            <div className="rounded-md bg-kumo-elevated p-3 text-xs text-kumo-subtle">
              <p className="font-medium text-kumo-default">Confirmation</p>
              <p>
                A {formatPercent(comparison.stageScores.confirmation.a)} / B{" "}
                {formatPercent(comparison.stageScores.confirmation.b)}
              </p>
              <p>
                Delta{" "}
                {formatDelta(
                  comparison.stageScores.confirmation.a,
                  comparison.stageScores.confirmation.b,
                )}
              </p>
            </div>
          ) : null}
          <div className="rounded-md bg-kumo-elevated p-3 text-xs text-kumo-subtle">
            <p className="font-medium text-kumo-default">Follow-up</p>
            <p>
              A {formatPercent(comparison.stageScores.followup.a)} / B{" "}
              {formatPercent(comparison.stageScores.followup.b)}
            </p>
            <p>
              Delta{" "}
              {formatDelta(
                comparison.stageScores.followup.a,
                comparison.stageScores.followup.b,
              )}
            </p>
          </div>
          <div className="rounded-md bg-kumo-elevated p-3 text-xs text-kumo-subtle">
            <p className="font-medium text-kumo-default">Combined</p>
            <p>
              A {formatPercent(comparison.stageScores.combined.a)} / B{" "}
              {formatPercent(comparison.stageScores.combined.b)}
            </p>
            <p>
              Delta{" "}
              {formatDelta(
                comparison.stageScores.combined.a,
                comparison.stageScores.combined.b,
              )}
            </p>
          </div>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="mt-3 space-y-1">
          {warnings.map((warning) => (
            <p
              key={`${warning.stage}-${warning.rule}-${warning.message}`}
              className="text-xs text-kumo-danger"
            >
              {warning.stage}: {warning.message}
            </p>
          ))}
        </div>
      ) : null}

      <details className="mt-3 rounded-md bg-kumo-elevated p-3">
        <summary className="cursor-pointer text-sm font-medium text-kumo-default">
          Raw check results
        </summary>
        {chatOnlyConfirmation ? (
          <p className="mt-2 text-xs text-kumo-subtle">
            Confirmation stays in chat; exported workspace runs only score
            follow-up UI.
          </p>
        ) : null}
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {!chatOnlyConfirmation ? (
            <div className="space-y-2">
              {renderChecks("Confirmation A", run.stages.confirmation.a)}
              {renderChecks("Confirmation B", run.stages.confirmation.b)}
            </div>
          ) : null}
          <div className="space-y-2">
            {renderChecks("Follow-up A", run.stages.followup.a)}
            {renderChecks("Follow-up B", run.stages.followup.b)}
          </div>
        </div>
      </details>
    </div>
  );
}

function PlaygroundFeedbackList({
  reports,
  onRemove,
}: {
  readonly reports: readonly NamedPlaygroundFeedbackExport[];
  readonly onRemove: (index: number) => void;
}) {
  if (reports.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-lg border border-kumo-line p-4">
      <h2 className="text-sm font-semibold text-kumo-default">
        Playground Session Files
      </h2>
      {reports.map((report, index) => (
        <div
          key={`${report.name}-${report.feedbackExport.exportedAt}`}
          className="rounded-lg border border-kumo-line p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-kumo-default">
                {report.name}
              </p>
              <p className="text-xs text-kumo-subtle">
                {report.feedbackExport.branch} -{" "}
                {report.feedbackExport.runs.length} run
                {report.feedbackExport.runs.length === 1 ? "" : "s"} - exported{" "}
                {new Date(report.feedbackExport.exportedAt).toLocaleString()}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onRemove(index)}>
              Remove
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {report.feedbackExport.runs.map((run) => (
              <PlaygroundRunCard key={run.id} run={run} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Build a ViolationMap from completed live eval results. */
function buildViolationMap(results: readonly PromptEvalResult[]): ViolationMap {
  const map = new Map<string, ReadonlyMap<string, readonly string[]>>();

  for (const r of results) {
    if (r.structuralReport === null && r.compositionReport === null) continue;

    const ruleMap = new Map<string, readonly string[]>();

    if (r.structuralReport !== null) {
      for (const gr of r.structuralReport.results) {
        ruleMap.set(gr.rule, gr.violations);
      }
    }
    if (r.compositionReport !== null) {
      for (const gr of r.compositionReport.results) {
        ruleMap.set(gr.rule, gr.violations);
      }
    }

    map.set(r.promptId, ruleMap);
  }

  return map;
}

// =============================================================================
// Component: Live Eval Panel
// =============================================================================

function LiveEvalPanel({
  onBaselineCreated,
  onViolationsUpdated,
}: {
  readonly onBaselineCreated: (named: NamedBaseline) => void;
  readonly onViolationsUpdated: (violations: ViolationMap) => void;
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

    // Build baseline and violations from results
    if (!controller.signal.aborted) {
      const doneResults = finalResults.filter((r) => r.status === "done");
      if (doneResults.length > 0) {
        const baseline = resultsToBaseline(finalResults);
        const name = `live-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-")}`;
        onBaselineCreated({ name, baseline });
        onViolationsUpdated(buildViolationMap(finalResults));
      }
    }
  }, [onBaselineCreated, onViolationsUpdated]);

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
        <EvalReportContent />
      </main>
    </div>
  );
}

// =============================================================================
// Report content
// =============================================================================

function EvalReportContent() {
  const [baselines, setBaselines] = useState<NamedBaseline[]>([]);
  const [feedbackExports, setFeedbackExports] = useState<
    NamedPlaygroundFeedbackExport[]
  >([]);
  const [selectedIndices, setSelectedIndices] = useState<ReadonlySet<number>>(
    new Set(),
  );
  const [liveViolations, setLiveViolations] = useState<ViolationMap>(new Map());

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

  const handleFeedbackLoaded = useCallback(
    (named: NamedPlaygroundFeedbackExport) => {
      setFeedbackExports((prev) => [...prev, named]);
    },
    [],
  );

  const handleRemoveFeedback = useCallback((index: number) => {
    setFeedbackExports((prev) => prev.filter((_, i) => i !== index));
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
          onBaselineCreated={handleBaselineLoaded}
          onViolationsUpdated={setLiveViolations}
        />
      </div>

      {/* Upload section */}
      <FileDropZone
        onBaselineLoaded={handleBaselineLoaded}
        onFeedbackLoaded={handleFeedbackLoaded}
      />

      <BaselineList
        baselines={baselines}
        selectedIndices={selectedIndices}
        onToggleSelect={handleToggleSelect}
        onRemove={handleRemove}
      />

      <PlaygroundFeedbackList
        reports={feedbackExports}
        onRemove={handleRemoveFeedback}
      />

      <ReportBody
        baselines={baselines}
        selectedBaselines={selectedBaselines}
        feedbackExports={feedbackExports}
        violations={liveViolations}
      />
    </div>
  );
}

// =============================================================================
// Report body: matrix, A/B, trend
// =============================================================================

function ReportBody({
  baselines,
  selectedBaselines,
  feedbackExports,
  violations,
}: {
  readonly baselines: readonly NamedBaseline[];
  readonly selectedBaselines: readonly NamedBaseline[];
  readonly feedbackExports: readonly NamedPlaygroundFeedbackExport[];
  readonly violations?: ViolationMap | undefined;
}) {
  if (baselines.length === 0 && feedbackExports.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Empty
          icon={<UploadSimpleIcon size={32} />}
          title="No reports loaded"
          description="Run an eval or upload baseline or playground feedback JSON files to see results."
        />
      </div>
    );
  }

  const primaryBaseline =
    baselines.length === 0
      ? null
      : selectedBaselines.length > 0
        ? selectedBaselines[0]
        : baselines[baselines.length - 1];

  return (
    <div className="space-y-6">
      {primaryBaseline !== null && (
        <div className="rounded-lg border border-kumo-line p-4">
          <h2 className="mb-3 text-sm font-semibold text-kumo-default">
            Pass/Fail Matrix &mdash; {primaryBaseline.name}
          </h2>
          <PassFailMatrix
            baseline={primaryBaseline.baseline}
            violations={violations}
          />
        </div>
      )}

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

      {selectedBaselines.length >= 3 && (
        <TrendChart baselines={selectedBaselines} />
      )}

      {feedbackExports.length > 0 && (
        <div className="rounded-lg border border-kumo-line p-4">
          <h2 className="mb-3 text-sm font-semibold text-kumo-default">
            Playground Sessions
          </h2>
          <p className="text-xs text-kumo-subtle">
            Uploaded `playground-feedback-v1` exports are shown here separately
            from eval baselines.
          </p>
        </div>
      )}
    </div>
  );
}
