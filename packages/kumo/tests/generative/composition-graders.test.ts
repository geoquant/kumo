/**
 * Composition graders — validate UITree output against composition quality rules.
 *
 * Tests use inline UITree fixtures for clarity and isolation.
 */

import { describe, it, expect } from "vitest";
import { gradeComposition } from "@/generative/composition-graders";
import type { UITree } from "@/streaming/types";

// =============================================================================
// Helpers
// =============================================================================

/** Build a minimal UITree from a flat element spec. */
function buildTree(
  rootKey: string,
  elements: Record<
    string,
    {
      type: string;
      props?: Record<string, unknown>;
      children?: string[];
    }
  >,
): UITree {
  const entries = Object.fromEntries(
    Object.entries(elements).map(([key, el]) => [
      key,
      {
        key,
        type: el.type,
        props: el.props ?? {},
        children: el.children,
      },
    ]),
  );
  return { root: rootKey, elements: entries };
}

// =============================================================================
// has-visual-hierarchy
// =============================================================================

describe("gradeComposition", () => {
  describe("has-visual-hierarchy", () => {
    it("passes when tree has a Text element with heading2 variant", () => {
      const tree = buildTree("root", {
        root: {
          type: "Surface",
          children: ["stack"],
        },
        stack: {
          type: "Stack",
          children: ["heading", "body"],
        },
        heading: {
          type: "Text",
          props: { variant: "heading2", children: "Section Title" },
        },
        body: {
          type: "Text",
          props: { variant: "body", children: "Some content" },
        },
      });

      const report = gradeComposition(tree);
      const rule = report.results.find(
        (r) => r.rule === "has-visual-hierarchy",
      );
      expect(rule?.pass).toBe(true);
      expect(rule?.violations).toHaveLength(0);
    });

    it("passes when tree has heading3 variant", () => {
      const tree = buildTree("root", {
        root: {
          type: "Surface",
          children: ["h"],
        },
        h: {
          type: "Text",
          props: { variant: "heading3", children: "Subsection" },
        },
      });

      const report = gradeComposition(tree);
      const rule = report.results.find(
        (r) => r.rule === "has-visual-hierarchy",
      );
      expect(rule?.pass).toBe(true);
    });

    it("passes when tree has both heading1 and heading2 (proper hierarchy)", () => {
      const tree = buildTree("root", {
        root: {
          type: "Surface",
          children: ["stack"],
        },
        stack: {
          type: "Stack",
          children: ["h1", "h2"],
        },
        h1: {
          type: "Text",
          props: { variant: "heading1", children: "Page Title" },
        },
        h2: {
          type: "Text",
          props: { variant: "heading2", children: "Section" },
        },
      });

      const report = gradeComposition(tree);
      const rule = report.results.find(
        (r) => r.rule === "has-visual-hierarchy",
      );
      expect(rule?.pass).toBe(true);
      expect(report.allPass).toBe(true);
    });

    it("fails when tree has only body Text (no headings)", () => {
      const tree = buildTree("root", {
        root: {
          type: "Surface",
          children: ["text"],
        },
        text: {
          type: "Text",
          props: { variant: "body", children: "Just body text" },
        },
      });

      const report = gradeComposition(tree);
      const rule = report.results.find(
        (r) => r.rule === "has-visual-hierarchy",
      );
      expect(rule?.pass).toBe(false);
      expect(rule?.violations[0]).toContain("no Text element with a heading");
    });

    it("warns (fails) when heading1 exists but no heading2 (flat hierarchy)", () => {
      const tree = buildTree("root", {
        root: {
          type: "Surface",
          children: ["stack"],
        },
        stack: {
          type: "Stack",
          children: ["h1", "body"],
        },
        h1: {
          type: "Text",
          props: { variant: "heading1", children: "Page Title" },
        },
        body: {
          type: "Text",
          props: { variant: "body", children: "No sub-headings" },
        },
      });

      const report = gradeComposition(tree);
      const rule = report.results.find(
        (r) => r.rule === "has-visual-hierarchy",
      );
      expect(rule?.pass).toBe(false);
      expect(rule?.violations[0]).toContain("heading1 exists but no heading2");
    });

    it("fails when tree has no Text elements at all", () => {
      const tree = buildTree("root", {
        root: {
          type: "Surface",
          children: ["stack"],
        },
        stack: {
          type: "Stack",
          children: [],
        },
      });

      const report = gradeComposition(tree);
      const rule = report.results.find(
        (r) => r.rule === "has-visual-hierarchy",
      );
      expect(rule?.pass).toBe(false);
    });

    it("correctly reports allPass based on all rules", () => {
      // Tree that passes has-visual-hierarchy
      const passingTree = buildTree("root", {
        root: {
          type: "Surface",
          children: ["h"],
        },
        h: {
          type: "Text",
          props: { variant: "heading2", children: "Title" },
        },
      });

      expect(gradeComposition(passingTree).allPass).toBe(true);

      // Tree that fails has-visual-hierarchy
      const failingTree = buildTree("root", {
        root: {
          type: "Surface",
          children: ["t"],
        },
        t: {
          type: "Text",
          props: { variant: "body", children: "No heading" },
        },
      });

      expect(gradeComposition(failingTree).allPass).toBe(false);
    });
  });
});
