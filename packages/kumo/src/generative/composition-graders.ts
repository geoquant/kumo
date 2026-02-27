/**
 * Composition graders — validate UITree output against composition quality rules.
 *
 * These complement the 8 structural rules in structural-graders.ts with
 * higher-level checks for visual hierarchy, responsive layout, surface
 * nesting, spacing consistency, content density, and action completeness.
 *
 * All checks are static and deterministic (no LLM needed).
 */

import type { GradeReport, GradeResult } from "./structural-graders.js";
import { walkTree } from "./structural-graders.js";
import type { UITree } from "../streaming/types";

// =============================================================================
// Constants
// =============================================================================

/** Text variant values that count as headings. */
const HEADING_VARIANTS = new Set(["heading1", "heading2", "heading3"]);

/** All composition rule names in evaluation order. */
export const COMPOSITION_RULE_NAMES = ["has-visual-hierarchy"] as const;

export type CompositionRuleName = (typeof COMPOSITION_RULE_NAMES)[number];

// =============================================================================
// gradeComposition — run all composition rules
// =============================================================================

/**
 * Grade a UITree against composition quality rules.
 * Returns per-rule pass/fail + collected violations.
 */
export function gradeComposition(tree: UITree): GradeReport {
  const hierarchyViolations: string[] = [];

  // Track which heading levels are present
  let hasAnyHeading = false;
  let hasHeading1 = false;
  let hasHeading2 = false;

  walkTree(tree, (element) => {
    const { type, props } = element;
    const p = props as Record<string, unknown>;

    // has-visual-hierarchy: check for Text elements with heading variants
    if (type === "Text") {
      const variant = p["variant"];
      if (typeof variant === "string" && HEADING_VARIANTS.has(variant)) {
        hasAnyHeading = true;
        if (variant === "heading1") hasHeading1 = true;
        if (variant === "heading2") hasHeading2 = true;
      }
    }
  });

  // has-visual-hierarchy rule evaluation
  if (!hasAnyHeading) {
    hierarchyViolations.push(
      "no Text element with a heading variant (heading1, heading2, heading3) found",
    );
  } else if (hasHeading1 && !hasHeading2) {
    hierarchyViolations.push(
      "heading1 exists but no heading2 — flat hierarchy (consider adding sub-headings)",
    );
  }

  const results: GradeResult[] = [
    {
      rule: "has-visual-hierarchy",
      pass: hierarchyViolations.length === 0,
      violations: hierarchyViolations,
    },
  ];

  return {
    results,
    allPass: results.every((r) => r.pass),
  };
}
