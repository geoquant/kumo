/**
 * Composition eval harness ��� deterministic grading of generated JSONL.
 *
 * Gated behind `EVAL_ENABLED` env var. When enabled, loads eval prompts
 * and either:
 *   1. **Offline mode** (default): reads pre-generated JSONL from
 *      `tests/generative/eval/fixtures/<prompt-id>.jsonl`
 *   2. **Online mode** (`EVAL_ONLINE=1`): placeholder for future API
 *      integration — currently throws to prevent accidental LLM calls.
 *
 * Each prompt's JSONL is parsed to a UITree, then graded with both
 * structural (gradeTree) and composition (gradeComposition) graders.
 * Required elements and patterns are verified. An aggregate score
 * is reported at the end.
 *
 * Run: EVAL_ENABLED=1 pnpm --filter @cloudflare/kumo test -- --run tests/generative/eval/
 */
import { describe, it, expect, afterAll } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import {
  parseJsonlToTree,
  gradeTree,
} from "../../../src/generative/structural-graders";
import { gradeComposition } from "../../../src/generative/composition-graders";
import {
  EVAL_PROMPTS,
  type EvalPrompt,
  type RequiredPattern,
} from "../../../src/generative/eval/eval-prompts";
import type { UITree } from "../../../src/streaming/types";

// =============================================================================
// Configuration
// =============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURE_DIR = resolve(__dirname, "fixtures");

const evalEnabled = !!process.env["EVAL_ENABLED"];
const onlineMode = !!process.env["EVAL_ONLINE"];

// =============================================================================
// Fixture loading
// =============================================================================

/**
 * Load a pre-generated JSONL fixture for a given eval prompt ID.
 * Returns `null` if the fixture file does not exist.
 */
function loadFixture(promptId: string): string | null {
  const path = resolve(FIXTURE_DIR, `${promptId}.jsonl`);
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

/**
 * Resolve JSONL for a prompt — offline (fixture) or online (API).
 *
 * Online mode is a placeholder; it throws so we never accidentally
 * make LLM calls in tests. When ready, replace the throw with an
 * actual API call that returns JSONL.
 */
function resolveJsonl(prompt: EvalPrompt): string {
  if (onlineMode) {
    throw new Error(
      `[eval] Online mode not yet implemented. ` +
        `Generate fixtures offline and place them in ${FIXTURE_DIR}/${prompt.id}.jsonl`,
    );
  }

  const fixture = loadFixture(prompt.id);
  if (fixture === null) {
    throw new Error(
      `[eval] Missing fixture for "${prompt.id}". ` +
        `Expected file: ${FIXTURE_DIR}/${prompt.id}.jsonl`,
    );
  }
  return fixture;
}

// =============================================================================
// Pattern checkers
// =============================================================================

/** Verify a RequiredPattern is present in the tree. */
function checkPattern(tree: UITree, pattern: RequiredPattern): boolean {
  const elements = Object.values(tree.elements);

  switch (pattern) {
    case "two-column": {
      return elements.some(
        (el) =>
          el.type === "Grid" &&
          (el.props as Record<string, unknown>)["variant"] === "2up",
      );
    }

    case "tabs": {
      return elements.some((el) => el.type === "Tabs");
    }

    case "stat-grid": {
      return elements.some(
        (el) =>
          el.type === "Grid" &&
          typeof (el.props as Record<string, unknown>)["variant"] === "string",
      );
    }

    case "header-actions": {
      const hasHeading = elements.some(
        (el) =>
          el.type === "Text" &&
          typeof (el.props as Record<string, unknown>)["variant"] ===
            "string" &&
          (
            (el.props as Record<string, unknown>)["variant"] as string
          ).startsWith("heading"),
      );
      const hasButton = elements.some((el) => el.type === "Button");
      return hasHeading && hasButton;
    }

    case "empty-state": {
      return elements.some((el) => el.type === "Empty");
    }

    case "form-with-submit": {
      const formTypes = new Set([
        "Input",
        "Select",
        "Textarea",
        "Checkbox",
        "Switch",
      ]);
      const hasFormEl = elements.some((el) => formTypes.has(el.type));
      const hasBtn = elements.some((el) => el.type === "Button");
      return hasFormEl && hasBtn;
    }

    case "table-with-header": {
      const hasTable = elements.some((el) => el.type === "Table");
      const hasHeader = elements.some((el) => el.type === "TableHeader");
      return hasTable && hasHeader;
    }

    case "surface-hierarchy": {
      const surfaceCount = elements.filter(
        (el) => el.type === "Surface",
      ).length;
      return surfaceCount >= 2;
    }
  }
}

// =============================================================================
// Aggregate score tracking
// =============================================================================

interface PromptResult {
  readonly id: string;
  readonly expectedPattern: string;
  readonly structuralPass: boolean;
  readonly compositionPass: boolean;
  readonly requiredElementsPass: boolean;
  readonly requiredPatternsPass: boolean;
  readonly overallPass: boolean;
}

const results: PromptResult[] = [];

// =============================================================================
// Test suite
// =============================================================================

describe.skipIf(!evalEnabled)("composition eval harness", () => {
  for (const prompt of EVAL_PROMPTS) {
    describe(prompt.id, () => {
      let tree: UITree;

      it("loads and parses JSONL to valid UITree", () => {
        const jsonl = resolveJsonl(prompt);
        tree = parseJsonlToTree(jsonl);
        expect(tree.root).toBeTruthy();
        expect(Object.keys(tree.elements).length).toBeGreaterThan(0);
      });

      it("passes gradeTree() structural grading", () => {
        const report = gradeTree(tree);
        for (const r of report.results) {
          expect(r.violations, `rule "${r.rule}" failed`).toEqual([]);
        }
        expect(report.allPass).toBe(true);
      });

      it("passes gradeComposition() composition grading", () => {
        const report = gradeComposition(tree);
        for (const r of report.results) {
          expect(r.violations, `rule "${r.rule}" failed`).toEqual([]);
        }
        expect(report.allPass).toBe(true);
      });

      it("contains all required element types", () => {
        const presentTypes = new Set(
          Object.values(tree.elements).map((el) => el.type),
        );
        const missing = prompt.requiredElements.filter(
          (t) => !presentTypes.has(t),
        );
        expect(missing, "missing required elements").toEqual([]);
      });

      it("satisfies all required structural patterns", () => {
        if (prompt.requiredPatterns.length === 0) return;
        const failing = prompt.requiredPatterns.filter(
          (p) => !checkPattern(tree, p),
        );
        expect(failing, "failing required patterns").toEqual([]);
      });

      // Record result for aggregate reporting
      afterAll(() => {
        if (!tree) return; // parse failed — skip recording
        const structural = gradeTree(tree);
        const composition = gradeComposition(tree);
        const presentTypes = new Set(
          Object.values(tree.elements).map((el) => el.type),
        );
        const requiredElementsPass = prompt.requiredElements.every((t) =>
          presentTypes.has(t),
        );
        const requiredPatternsPass = prompt.requiredPatterns.every((p) =>
          checkPattern(tree, p),
        );
        results.push({
          id: prompt.id,
          expectedPattern: prompt.expectedPattern,
          structuralPass: structural.allPass,
          compositionPass: composition.allPass,
          requiredElementsPass,
          requiredPatternsPass,
          overallPass:
            structural.allPass &&
            composition.allPass &&
            requiredElementsPass &&
            requiredPatternsPass,
        });
      });
    });
  }

  // ── Aggregate report ────────────────────────────────────────────────────

  afterAll(() => {
    if (results.length === 0) return;

    const total = results.length;
    const passed = results.filter((r) => r.overallPass).length;
    const score = Math.round((passed / total) * 100);

    console.log("\n╔══════════════════════════════════════╗");
    console.log("║     COMPOSITION EVAL REPORT          ║");
    console.log("╚══════════════════════════════════════╝\n");

    for (const r of results) {
      const status = r.overallPass ? "PASS" : "FAIL";
      const details = [
        r.structuralPass ? null : "structural",
        r.compositionPass ? null : "composition",
        r.requiredElementsPass ? null : "elements",
        r.requiredPatternsPass ? null : "patterns",
      ].filter(Boolean);
      const suffix = details.length > 0 ? ` (${details.join(", ")})` : "";
      console.log(`  [${status}] ${r.id} (${r.expectedPattern})${suffix}`);
    }

    console.log(`\n  Score: ${passed}/${total} (${score}%)\n`);
  });
});
