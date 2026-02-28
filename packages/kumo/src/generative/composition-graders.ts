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

/**
 * Ordered gap scale for Stack elements (smallest ��� largest).
 * Index distance ≤ 1 = consistent; >1 = inconsistent.
 */
const GAP_SCALE = ["none", "xs", "sm", "base", "lg", "xl"] as const;

type GapValue = (typeof GAP_SCALE)[number];

/** Return the index of a gap value in the ordered scale, or -1 if unknown. */
function gapIndex(value: unknown): number {
  if (typeof value !== "string") return -1;
  return GAP_SCALE.indexOf(value as GapValue);
}

/** Minimum element count — below this the UI is too trivial. */
const MIN_ELEMENTS = 3;

/** Maximum element count — above this the UI is too complex. */
const MAX_ELEMENTS = 100;

/** Form element types that imply the UI needs an action (Button). */
const FORM_ELEMENT_TYPES = new Set([
  "Input",
  "Select",
  "Textarea",
  "Checkbox",
  "Switch",
]);

/** All composition rule names in evaluation order. */
export const COMPOSITION_RULE_NAMES = [
  "has-visual-hierarchy",
  "has-responsive-layout",
  "surface-hierarchy-correct",
  "spacing-consistency",
  "content-density",
  "action-completeness",
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
  const spacingViolations: string[] = [];
  const densityViolations: string[] = [];
  const actionViolations: string[] = [];

  // Track which heading levels are present
  let hasAnyHeading = false;
  let hasHeading1 = false;
  let hasHeading2 = false;

  // Track Grid usage
  let hasGridWithVariant = false;
  let hasGridWithoutVariant = false;

  // Track Stack gap values grouped by parent key for spacing-consistency
  const stackGapsByParent = new Map<string, { key: string; gap: string }[]>();

  // Track form elements and buttons for action-completeness
  let hasFormElement = false;
  let hasButton = false;

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

    // spacing-consistency: collect Stack gap values grouped by parent
    if (type === "Stack" && parentKey != null) {
      const gap = p["gap"];
      if (typeof gap === "string" && gap.length > 0) {
        let siblings = stackGapsByParent.get(parentKey);
        if (siblings == null) {
          siblings = [];
          stackGapsByParent.set(parentKey, siblings);
        }
        siblings.push({ key: element.key, gap });
      }
    }

    // action-completeness: track form elements and buttons
    if (FORM_ELEMENT_TYPES.has(type)) hasFormElement = true;
    if (type === "Button") hasButton = true;

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

  // spacing-consistency rule evaluation
  // For each parent, check that all sibling Stack gap values are within one step
  for (const [parentKey, siblings] of stackGapsByParent) {
    if (siblings.length < 2) continue;

    const indices = siblings.map((s) => ({
      key: s.key,
      gap: s.gap,
      idx: gapIndex(s.gap),
    }));

    // Skip unknown gap values (they'll be caught by element-validator)
    const known = indices.filter((s) => s.idx >= 0);
    if (known.length < 2) continue;

    const minIdx = Math.min(...known.map((s) => s.idx));
    const maxIdx = Math.max(...known.map((s) => s.idx));

    if (maxIdx - minIdx > 1) {
      const gapList = known.map((s) => `${s.key}(gap=${s.gap})`).join(", ");
      spacingViolations.push(
        `sibling Stacks under "${parentKey}" have inconsistent gaps: ${gapList} — keep gap values within one step (e.g. sm+base, not xs+lg)`,
      );
    }
  }

  // content-density rule evaluation
  if (elementCount < MIN_ELEMENTS) {
    densityViolations.push(
      `tree has only ${elementCount} element(s) — minimum is ${MIN_ELEMENTS} (too simple to be a useful UI)`,
    );
  } else if (elementCount > MAX_ELEMENTS) {
    densityViolations.push(
      `tree has ${elementCount} elements — maximum is ${MAX_ELEMENTS} (too complex, consider splitting into sub-pages)`,
    );
  }

  // action-completeness rule evaluation
  // Form elements without a Button means the user cannot submit/act
  if (hasFormElement && !hasButton) {
    actionViolations.push(
      "form elements (Input, Select, Textarea, Checkbox, Switch) exist but no Button found — add a Button for the user to act",
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
    {
      rule: "spacing-consistency",
      pass: spacingViolations.length === 0,
      violations: spacingViolations,
    },
    {
      rule: "content-density",
      pass: densityViolations.length === 0,
      violations: densityViolations,
    },
    {
      rule: "action-completeness",
      pass: actionViolations.length === 0,
      violations: actionViolations,
    },
  ];

  return {
    results,
    allPass: results.every((r) => r.pass),
  };
}
