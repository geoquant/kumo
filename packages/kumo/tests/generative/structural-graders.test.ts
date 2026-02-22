/**
 * Structural graders — validate UITree output against 8 quality rules.
 *
 * These are static, deterministic checks (no LLM needed) that verify
 * a UITree follows the canonical layout and prop conventions.
 *
 * Test fixtures are JSONL files that get parsed into UITrees via the
 * same createJsonlParser + applyPatch pipeline used in production.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createJsonlParser } from "@/streaming/jsonl-parser";
import { applyPatch } from "@/streaming/rfc6902";
import { KNOWN_TYPES } from "@/generative/component-map";
import { validateElement } from "@/generative/element-validator";
import type { UITree, UIElement } from "@/streaming/types";
import { EMPTY_TREE } from "@/streaming/types";

// =============================================================================
// Fixture loader
// =============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURE_DIR = resolve(__dirname, "fixtures");

const FIXTURE_NAMES = [
  "user-card",
  "settings-form",
  "counter",
  "pricing-table",
] as const;

type FixtureName = (typeof FIXTURE_NAMES)[number];

function loadFixture(name: FixtureName): string {
  return readFileSync(resolve(FIXTURE_DIR, `${name}.jsonl`), "utf-8");
}

// =============================================================================
// parseJsonlToTree — build UITree from JSONL string
// =============================================================================

/**
 * Parse a JSONL string into a UITree by feeding it through
 * createJsonlParser + applyPatch — the same pipeline used in production.
 */
function parseJsonlToTree(jsonl: string): UITree {
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

interface WalkVisitor {
  (element: UIElement, depth: number, parentKey: string | null): void;
}

/**
 * Depth-first walk of a UITree starting from the root.
 * Visitor receives each element, its depth, and its parent key.
 */
function walkTree(tree: UITree, visitor: WalkVisitor): void {
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
// Grading rules
// =============================================================================

/** A single grading rule result. */
interface GradeResult {
  readonly rule: string;
  readonly pass: boolean;
  readonly violations: ReadonlyArray<string>;
}

/** Result of grading an entire tree. */
interface GradeReport {
  readonly results: ReadonlyArray<GradeResult>;
  readonly allPass: boolean;
}

// --- Form-element types that require accessibility labels ---
const A11Y_LABEL_TYPES = new Set([
  "Input",
  "Textarea",
  "InputArea",
  "Select",
  "Checkbox",
  "Switch",
  "RadioGroup",
]);

const MAX_DEPTH = 8;

/**
 * Grade a UITree against all 8 structural rules.
 * Returns per-rule pass/fail + collected violations.
 */
function gradeTree(tree: UITree): GradeReport {
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
    if (!KNOWN_TYPES.has(type)) {
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

// =============================================================================
// Tests
// =============================================================================

describe("parseJsonlToTree", () => {
  it("builds a UITree from JSONL string via createJsonlParser + applyPatch", () => {
    const tree = parseJsonlToTree(loadFixture("user-card"));
    expect(tree.root).toBe("card");
    expect(Object.keys(tree.elements).length).toBeGreaterThan(0);
    expect(tree.elements["card"]?.type).toBe("Surface");
  });

  it("builds all 4 fixtures without error", () => {
    for (const name of FIXTURE_NAMES) {
      const tree = parseJsonlToTree(loadFixture(name));
      expect(tree.root).toBeTruthy();
      expect(Object.keys(tree.elements).length).toBeGreaterThan(0);
    }
  });
});

describe("walkTree", () => {
  it("visits elements depth-first with (element, depth, parentKey)", () => {
    const tree = parseJsonlToTree(loadFixture("counter"));
    const visited: Array<{
      key: string;
      depth: number;
      parentKey: string | null;
    }> = [];

    walkTree(tree, (element, depth, parentKey) => {
      visited.push({ key: element.key, depth, parentKey });
    });

    // Root is at depth 0 with no parent
    expect(visited[0]).toEqual({ key: "card", depth: 0, parentKey: null });
    // Stack is at depth 1 with card as parent
    expect(visited[1]).toEqual({ key: "stack", depth: 1, parentKey: "card" });
    // Title is at depth 2
    expect(visited[2]?.depth).toBe(2);
    // All elements visited
    expect(visited.length).toBe(Object.keys(tree.elements).length);
  });
});

describe("gradeTree", () => {
  it("returns results for all 8 rules", () => {
    const tree = parseJsonlToTree(loadFixture("user-card"));
    const report = gradeTree(tree);
    expect(report.results.length).toBe(8);

    const ruleNames = report.results.map((r) => r.rule);
    expect(ruleNames).toEqual([
      "valid-component-types",
      "valid-prop-values",
      "required-props",
      "canonical-layout",
      "no-orphan-nodes",
      "a11y-labels",
      "depth-limit",
      "no-redundant-children",
    ]);
  });

  // --- Rule: valid-component-types ---
  describe("valid-component-types", () => {
    it("passes when all element types exist in COMPONENT_MAP", () => {
      const tree = parseJsonlToTree(loadFixture("user-card"));
      const report = gradeTree(tree);
      const rule = report.results.find(
        (r) => r.rule === "valid-component-types",
      );
      expect(rule?.pass).toBe(true);
      expect(rule?.violations).toHaveLength(0);
    });

    it("fails for unknown component types", () => {
      const tree = parseJsonlToTree(loadFixture("user-card"));
      tree.elements["bad"] = {
        key: "bad",
        type: "FakeComponent",
        props: {},
      };
      // Add to a parent so it gets walked
      tree.elements["stack"]!.children!.push("bad");
      const report = gradeTree(tree);
      const rule = report.results.find(
        (r) => r.rule === "valid-component-types",
      );
      expect(rule?.pass).toBe(false);
      expect(rule?.violations[0]).toContain("FakeComponent");
    });
  });

  // --- Rule: valid-prop-values ---
  describe("valid-prop-values", () => {
    it("passes when enum props contain only valid values", () => {
      const tree = parseJsonlToTree(loadFixture("settings-form"));
      const report = gradeTree(tree);
      const rule = report.results.find((r) => r.rule === "valid-prop-values");
      expect(rule?.pass).toBe(true);
    });

    it("fails for invalid enum values", () => {
      const tree = parseJsonlToTree(loadFixture("user-card"));
      // Corrupt a Badge variant to something invalid
      (tree.elements["role-badge"]!.props as Record<string, unknown>)[
        "variant"
      ] = "nonexistent";
      const report = gradeTree(tree);
      const rule = report.results.find((r) => r.rule === "valid-prop-values");
      expect(rule?.pass).toBe(false);
      expect(rule?.violations[0]).toContain("role-badge");
    });
  });

  // --- Rule: required-props ---
  describe("required-props", () => {
    it("passes when Text elements have children and form elements have labels", () => {
      const tree = parseJsonlToTree(loadFixture("settings-form"));
      const report = gradeTree(tree);
      const rule = report.results.find((r) => r.rule === "required-props");
      expect(rule?.pass).toBe(true);
    });

    it("fails when Text has no children", () => {
      const tree = parseJsonlToTree(loadFixture("counter"));
      // Remove children from a text element
      delete (tree.elements["title"]!.props as Record<string, unknown>)[
        "children"
      ];
      const report = gradeTree(tree);
      const rule = report.results.find((r) => r.rule === "required-props");
      expect(rule?.pass).toBe(false);
      expect(rule?.violations[0]).toContain("Text missing children");
    });

    it("fails when form element has no label", () => {
      const tree = parseJsonlToTree(loadFixture("settings-form"));
      delete (tree.elements["email-input"]!.props as Record<string, unknown>)[
        "label"
      ];
      const report = gradeTree(tree);
      const rule = report.results.find((r) => r.rule === "required-props");
      expect(rule?.pass).toBe(false);
      expect(rule?.violations[0]).toContain("missing label");
    });
  });

  // --- Rule: canonical-layout ---
  describe("canonical-layout", () => {
    it("passes when root Surface wraps children in Stack", () => {
      for (const name of FIXTURE_NAMES) {
        const tree = parseJsonlToTree(loadFixture(name));
        const report = gradeTree(tree);
        const rule = report.results.find((r) => r.rule === "canonical-layout");
        expect(rule?.pass).toBe(true);
      }
    });

    it("fails when root Surface has multiple direct children", () => {
      const tree = parseJsonlToTree(loadFixture("counter"));
      // Replace Surface's single Stack child with multiple children
      tree.elements["card"]!.children = ["title", "count"];
      const report = gradeTree(tree);
      const rule = report.results.find((r) => r.rule === "canonical-layout");
      expect(rule?.pass).toBe(false);
    });

    it("fails when root Surface's only child is not a Stack", () => {
      const tree = parseJsonlToTree(loadFixture("counter"));
      // Replace Stack with a Text
      tree.elements["card"]!.children = ["title"];
      const report = gradeTree(tree);
      const rule = report.results.find((r) => r.rule === "canonical-layout");
      expect(rule?.pass).toBe(false);
    });
  });

  // --- Rule: no-orphan-nodes ---
  describe("no-orphan-nodes", () => {
    it("passes when every non-root element is referenced by a parent", () => {
      const tree = parseJsonlToTree(loadFixture("pricing-table"));
      const report = gradeTree(tree);
      const rule = report.results.find((r) => r.rule === "no-orphan-nodes");
      expect(rule?.pass).toBe(true);
    });

    it("fails for elements not referenced in any children array", () => {
      const tree = parseJsonlToTree(loadFixture("counter"));
      // Add an orphan element
      tree.elements["orphan"] = {
        key: "orphan",
        type: "Text",
        props: { children: "I am lost" },
      };
      const report = gradeTree(tree);
      const rule = report.results.find((r) => r.rule === "no-orphan-nodes");
      expect(rule?.pass).toBe(false);
      expect(rule?.violations[0]).toContain("orphan");
    });
  });

  // --- Rule: a11y-labels ---
  describe("a11y-labels", () => {
    it("passes when form elements have label/aria-label", () => {
      const tree = parseJsonlToTree(loadFixture("settings-form"));
      const report = gradeTree(tree);
      const rule = report.results.find((r) => r.rule === "a11y-labels");
      expect(rule?.pass).toBe(true);
    });

    it("fails when Input missing label and aria-label", () => {
      const tree = parseJsonlToTree(loadFixture("settings-form"));
      const p = tree.elements["email-input"]!.props as Record<string, unknown>;
      delete p["label"];
      delete p["aria-label"];
      const report = gradeTree(tree);
      const rule = report.results.find((r) => r.rule === "a11y-labels");
      expect(rule?.pass).toBe(false);
    });

    it("passes when form element uses aria-label instead of label", () => {
      const tree = parseJsonlToTree(loadFixture("settings-form"));
      const p = tree.elements["email-input"]!.props as Record<string, unknown>;
      delete p["label"];
      p["aria-label"] = "Email address";
      const report = gradeTree(tree);
      const rule = report.results.find((r) => r.rule === "a11y-labels");
      expect(rule?.pass).toBe(true);
    });
  });

  // --- Rule: depth-limit ---
  describe("depth-limit", () => {
    it("passes when no element nesting exceeds 8 levels", () => {
      for (const name of FIXTURE_NAMES) {
        const tree = parseJsonlToTree(loadFixture(name));
        const report = gradeTree(tree);
        const rule = report.results.find((r) => r.rule === "depth-limit");
        expect(rule?.pass).toBe(true);
      }
    });

    it("fails when nesting exceeds 8 levels", () => {
      // Build a deeply nested tree: Surface > Stack > d2 > d3 > ... > d9
      let jsonl = '{"op":"add","path":"/root","value":"d0"}\n';
      jsonl +=
        '{"op":"add","path":"/elements/d0","value":{"key":"d0","type":"Surface","props":{},"children":["d1"]}}\n';

      for (let i = 1; i <= 9; i++) {
        const hasChild = i < 9;
        const el = {
          key: `d${i}`,
          type: i === 1 ? "Stack" : "Stack",
          props: { gap: "sm" },
          ...(hasChild ? { children: [`d${i + 1}`] } : {}),
          parentKey: `d${i - 1}`,
        };
        jsonl += `{"op":"add","path":"/elements/d${i}","value":${JSON.stringify(el)}}\n`;
      }

      const tree = parseJsonlToTree(jsonl);
      const report = gradeTree(tree);
      const rule = report.results.find((r) => r.rule === "depth-limit");
      expect(rule?.pass).toBe(false);
      expect(rule?.violations[0]).toContain("depth 9");
    });
  });

  // --- Rule: no-redundant-children ---
  describe("no-redundant-children", () => {
    it("passes when props.children is not an array", () => {
      for (const name of FIXTURE_NAMES) {
        const tree = parseJsonlToTree(loadFixture(name));
        const report = gradeTree(tree);
        const rule = report.results.find(
          (r) => r.rule === "no-redundant-children",
        );
        expect(rule?.pass).toBe(true);
      }
    });

    it("fails when props.children is an array", () => {
      const tree = parseJsonlToTree(loadFixture("counter"));
      (tree.elements["stack"]!.props as Record<string, unknown>)["children"] = [
        "title",
        "count",
      ];
      const report = gradeTree(tree);
      const rule = report.results.find(
        (r) => r.rule === "no-redundant-children",
      );
      expect(rule?.pass).toBe(false);
    });
  });

  // --- All 8 rules pass on all 4 fixtures ---
  describe("all rules on all fixtures", () => {
    for (const name of FIXTURE_NAMES) {
      it(`all 8 grader rules pass on ${name}`, () => {
        const tree = parseJsonlToTree(loadFixture(name));
        const report = gradeTree(tree);

        // Provide detailed failure message
        const failures = report.results.filter((r) => !r.pass);
        if (failures.length > 0) {
          const details = failures
            .map((f) => `  ${f.rule}: ${f.violations.join(", ")}`)
            .join("\n");
          expect.fail(
            `Fixture "${name}" failed ${failures.length} rule(s):\n${details}`,
          );
        }

        expect(report.allPass).toBe(true);
        expect(report.results.length).toBe(8);
      });
    }
  });
});
