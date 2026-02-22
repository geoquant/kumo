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
import {
  parseJsonlToTree,
  walkTree,
  gradeTree,
} from "@/generative/structural-graders";

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
