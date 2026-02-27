/**
 * Structural graders — validate UITree output against 8 quality rules.
 *
 * These are static, deterministic checks (no LLM needed) that verify
 * a UITree follows the canonical layout and prop conventions.
 *
 * Extracted from tests/generative/structural-graders.test.ts so they
 * can be reused by the eval harness and other tooling.
 */

import { createJsonlParser } from "../streaming/jsonl-parser.js";
import { applyPatch } from "../streaming/rfc6902.js";
import { KNOWN_TYPES } from "./component-map.js";
import { validateElement } from "./element-validator.js";
import type { UITree, UIElement } from "../streaming/types";
import { EMPTY_TREE } from "../streaming/types";

// =============================================================================
// Types
// =============================================================================

/** Callback signature for walkTree depth-first traversal. */
export interface WalkVisitor {
  (element: UIElement, depth: number, parentKey: string | null): void;
}

/** A single grading rule result. */
export interface GradeResult {
  readonly rule: string;
  readonly pass: boolean;
  readonly violations: ReadonlyArray<string>;
}

/** Result of grading an entire tree. */
export interface GradeReport {
  readonly results: ReadonlyArray<GradeResult>;
  readonly allPass: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/** Form-element types that require accessibility labels. */
export const A11Y_LABEL_TYPES = new Set([
  "Input",
  "Textarea",
  "InputArea",
  "Select",
  "Checkbox",
  "Switch",
  "RadioGroup",
]);

/** Maximum allowed nesting depth. */
export const MAX_DEPTH = 8;

/** All rule names in evaluation order. */
export const RULE_NAMES = [
  "valid-component-types",
  "valid-prop-values",
  "required-props",
  "canonical-layout",
  "no-orphan-nodes",
  "a11y-labels",
  "depth-limit",
  "no-redundant-children",
] as const;

export type RuleName = (typeof RULE_NAMES)[number];

// =============================================================================
// parseJsonlToTree — build UITree from JSONL string
// =============================================================================

/**
 * Parse a JSONL string into a UITree by feeding it through
 * createJsonlParser + applyPatch — the same pipeline used in production.
 */
export function parseJsonlToTree(jsonl: string): UITree {
  const parser = createJsonlParser();
  const ops = [...parser.push(jsonl), ...parser.flush()];

  let tree: UITree = { ...EMPTY_TREE, elements: {} };
  for (const op of ops) {
    tree = applyPatch(tree, op);
  }
  return tree;
}

// =============================================================================
// walkTree — depth-first traversal
// =============================================================================

/**
 * Depth-first walk of a UITree starting from the root.
 * Visitor receives each element, its depth, and its parent key.
 */
export function walkTree(tree: UITree, visitor: WalkVisitor): void {
  function visit(key: string, depth: number, parentKey: string | null): void {
    const element = tree.elements[key];
    if (!element) return;
    visitor(element, depth, parentKey);
    const children = element.children;
    if (children) {
      for (const childKey of children) {
        visit(childKey, depth + 1, key);
      }
    }
  }

  if (tree.root) {
    visit(tree.root, 0, null);
  }
}

// =============================================================================
// gradeTree — run all 8 structural rules
// =============================================================================

/** Options for gradeTree. */
export interface GradeOptions {
  /**
   * Additional component types to accept as valid beyond the built-in
   * KNOWN_TYPES set. Useful for custom components registered via
   * defineCustomComponent.
   */
  readonly customTypes?: ReadonlySet<string>;
}

/**
 * Grade a UITree against all 8 structural rules.
 * Returns per-rule pass/fail + collected violations.
 */
export function gradeTree(tree: UITree, options?: GradeOptions): GradeReport {
  const knownTypes =
    options?.customTypes && options.customTypes.size > 0
      ? new Set([...KNOWN_TYPES, ...options.customTypes])
      : KNOWN_TYPES;
  // Accumulators for each rule
  const validComponentViolations: string[] = [];
  const validPropViolations: string[] = [];
  const requiredPropViolations: string[] = [];
  const canonicalLayoutViolations: string[] = [];
  const orphanViolations: string[] = [];
  const a11yViolations: string[] = [];
  const depthViolations: string[] = [];
  const redundantChildrenViolations: string[] = [];

  // Build set of keys referenced as children
  const referencedKeys = new Set<string>();
  const allElements = Object.values(tree.elements) as UIElement[];
  for (const element of allElements) {
    if (element.children) {
      for (const childKey of element.children) {
        referencedKeys.add(childKey);
      }
    }
  }

  walkTree(tree, (element, depth, _parentKey) => {
    const { key, type, props } = element;
    const p = props as Record<string, unknown>;

    // 1. valid-component-types
    if (!knownTypes.has(type)) {
      validComponentViolations.push(`${key}: unknown type "${type}"`);
    }

    // 2. valid-prop-values (enum props via Zod)
    const validation = validateElement(element);
    if (!validation.valid) {
      const issues = validation.issues
        .map((i) => `${i.path}: ${i.message}`)
        .join("; ");
      validPropViolations.push(`${key} (${type}): ${issues}`);
    }

    // 3. required-props
    if (type === "Text" && p["children"] == null) {
      requiredPropViolations.push(`${key}: Text missing children`);
    }
    if (A11Y_LABEL_TYPES.has(type)) {
      // Also checked in rule 6, but rule 3 is about required-props broadly
      if (p["label"] == null && p["aria-label"] == null) {
        requiredPropViolations.push(
          `${key}: ${type} missing label or aria-label`,
        );
      }
    }

    // 4. canonical-layout: root Surface wraps children in Stack
    if (depth === 0 && type === "Surface") {
      const children = element.children ?? [];
      if (children.length > 0) {
        const onlyChild =
          children.length === 1 ? tree.elements[children[0]!] : null;
        if (!onlyChild || onlyChild.type !== "Stack") {
          canonicalLayoutViolations.push(
            `${key}: root Surface should wrap children in a single Stack`,
          );
        }
      }
    }

    // (orphan check moved below walkTree — orphans aren't reachable from root)

    // 6. a11y-labels
    if (A11Y_LABEL_TYPES.has(type)) {
      if (p["label"] == null && p["aria-label"] == null) {
        a11yViolations.push(`${key}: ${type} missing label/aria-label`);
      }
    }

    // 7. depth-limit
    if (depth > MAX_DEPTH) {
      depthViolations.push(`${key}: depth ${depth} exceeds max ${MAX_DEPTH}`);
    }

    // 8. no-redundant-children: props.children should not be an array
    if (Array.isArray(p["children"])) {
      redundantChildrenViolations.push(
        `${key}: props.children is an array (use UIElement.children for structural children)`,
      );
    }
  });

  // 5. no-orphan-nodes: every non-root element must be referenced by a parent's children.
  // Checked outside walkTree because orphans are by definition unreachable from root.
  for (const key of Object.keys(tree.elements)) {
    if (key !== tree.root && !referencedKeys.has(key)) {
      orphanViolations.push(`${key}: not referenced by any parent's children`);
    }
  }

  const results: GradeResult[] = [
    {
      rule: "valid-component-types",
      pass: validComponentViolations.length === 0,
      violations: validComponentViolations,
    },
    {
      rule: "valid-prop-values",
      pass: validPropViolations.length === 0,
      violations: validPropViolations,
    },
    {
      rule: "required-props",
      pass: requiredPropViolations.length === 0,
      violations: requiredPropViolations,
    },
    {
      rule: "canonical-layout",
      pass: canonicalLayoutViolations.length === 0,
      violations: canonicalLayoutViolations,
    },
    {
      rule: "no-orphan-nodes",
      pass: orphanViolations.length === 0,
      violations: orphanViolations,
    },
    {
      rule: "a11y-labels",
      pass: a11yViolations.length === 0,
      violations: a11yViolations,
    },
    {
      rule: "depth-limit",
      pass: depthViolations.length === 0,
      violations: depthViolations,
    },
    {
      rule: "no-redundant-children",
      pass: redundantChildrenViolations.length === 0,
      violations: redundantChildrenViolations,
    },
  ];

  return {
    results,
    allPass: results.every((r) => r.pass),
  };
}
