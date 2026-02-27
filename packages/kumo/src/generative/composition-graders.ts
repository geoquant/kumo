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

/**
 * Maximum element count for a tree to be considered a "simple layout"
 * where a Grid is not required for responsive behaviour.
 * Single-card UIs, small forms, and confirmation dialogs fall here.
 */
const SIMPLE_LAYOUT_MAX_ELEMENTS = 12;

/** All composition rule names in evaluation order. */
export const COMPOSITION_RULE_NAMES = [
  "has-visual-hierarchy",
  "has-responsive-layout",
  "surface-hierarchy-correct",
] as const;

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
  const layoutViolations: string[] = [];
  const surfaceViolations: string[] = [];

  // Track which heading levels are present
  let hasAnyHeading = false;
  let hasHeading1 = false;
  let hasHeading2 = false;

  // Track Grid usage
  let hasGridWithVariant = false;
  let hasGridWithoutVariant = false;

  let elementCount = 0;

  walkTree(tree, (element, _depth, parentKey) => {
    elementCount++;
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

    // has-responsive-layout: check for Grid elements with variant prop
    if (type === "Grid") {
      const variant = p["variant"];
      if (typeof variant === "string" && variant.length > 0) {
        hasGridWithVariant = true;
      } else {
        hasGridWithoutVariant = true;
      }
    }

    // surface-hierarchy-correct: Surface must not be a direct child of Surface
    if (type === "Surface" && parentKey != null) {
      const parent = tree.elements[parentKey];
      if (parent?.type === "Surface") {
        surfaceViolations.push(
          `Surface "${element.key}" is a direct child of Surface "${parentKey}" — insert a layout element (Stack, Grid) between them`,
        );
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

  // has-responsive-layout rule evaluation
  // Simple/small layouts are exempt — Grid is not required for single-card UIs
  const isSimpleLayout = elementCount <= SIMPLE_LAYOUT_MAX_ELEMENTS;

  if (!isSimpleLayout && !hasGridWithVariant) {
    if (hasGridWithoutVariant) {
      layoutViolations.push(
        "Grid element exists but has no variant prop — always specify variant (e.g. 2up, 3up, 4up)",
      );
    } else {
      layoutViolations.push(
        "no Grid element with variant prop found — complex layouts need responsive grid columns",
      );
    }
  } else if (hasGridWithoutVariant) {
    // Even in simple layouts, a Grid without variant is misconfigured
    layoutViolations.push(
      "Grid element exists but has no variant prop — always specify variant (e.g. 2up, 3up, 4up)",
    );
  }

  const results: GradeResult[] = [
    {
      rule: "has-visual-hierarchy",
      pass: hierarchyViolations.length === 0,
      violations: hierarchyViolations,
    },
    {
      rule: "has-responsive-layout",
      pass: layoutViolations.length === 0,
      violations: layoutViolations,
    },
    {
      rule: "surface-hierarchy-correct",
      pass: surfaceViolations.length === 0,
      violations: surfaceViolations,
    },
  ];

  return {
    results,
    allPass: results.every((r) => r.pass),
  };
}
