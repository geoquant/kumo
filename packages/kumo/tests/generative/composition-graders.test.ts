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
      // Tree that passes has-visual-hierarchy (simple layout, so responsive exempt)
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

  // ===========================================================================
  // has-responsive-layout
  // ===========================================================================

  describe("has-responsive-layout", () => {
    it("passes when tree contains Grid with variant prop", () => {
      const tree = buildTree("root", {
        root: { type: "Surface", children: ["stack"] },
        stack: { type: "Stack", children: ["heading", "grid"] },
        heading: {
          type: "Text",
          props: { variant: "heading2", children: "Dashboard" },
        },
        grid: {
          type: "Grid",
          props: { variant: "2up", gap: "base" },
          children: ["card1", "card2"],
        },
        card1: { type: "Surface", children: ["s1"] },
        s1: { type: "Stack", children: ["t1", "t2"] },
        t1: {
          type: "Text",
          props: { variant: "heading3", children: "Card 1" },
        },
        t2: {
          type: "Text",
          props: { variant: "body", children: "Content 1" },
        },
        card2: { type: "Surface", children: ["s2"] },
        s2: { type: "Stack", children: ["t3", "t4"] },
        t3: {
          type: "Text",
          props: { variant: "heading3", children: "Card 2" },
        },
        t4: {
          type: "Text",
          props: { variant: "body", children: "Content 2" },
        },
      });

      const report = gradeComposition(tree);
      const rule = report.results.find(
        (r) => r.rule === "has-responsive-layout",
      );
      expect(rule?.pass).toBe(true);
      expect(rule?.violations).toHaveLength(0);
    });

    it("fails when Grid exists without variant prop (complex layout)", () => {
      const tree = buildTree("root", {
        root: { type: "Surface", children: ["stack"] },
        stack: { type: "Stack", children: ["heading", "grid"] },
        heading: {
          type: "Text",
          props: { variant: "heading2", children: "Dashboard" },
        },
        grid: {
          type: "Grid",
          props: { gap: "base" },
          children: ["c1", "c2"],
        },
        c1: { type: "Surface", children: ["s1"] },
        s1: { type: "Stack", children: ["t1", "t2"] },
        t1: {
          type: "Text",
          props: { variant: "heading3", children: "Card 1" },
        },
        t2: {
          type: "Text",
          props: { variant: "body", children: "Content 1" },
        },
        c2: { type: "Surface", children: ["s2"] },
        s2: { type: "Stack", children: ["t3", "t4"] },
        t3: {
          type: "Text",
          props: { variant: "heading3", children: "Card 2" },
        },
        t4: {
          type: "Text",
          props: { variant: "body", children: "Content 2" },
        },
      });

      const report = gradeComposition(tree);
      const rule = report.results.find(
        (r) => r.rule === "has-responsive-layout",
      );
      expect(rule?.pass).toBe(false);
      expect(rule?.violations[0]).toContain("no variant prop");
    });

    it("passes for simple card layouts (Grid not required)", () => {
      // A small tree (<=12 elements) is exempt from needing a Grid
      const tree = buildTree("root", {
        root: { type: "Surface", children: ["stack"] },
        stack: { type: "Stack", children: ["heading", "body", "btn"] },
        heading: {
          type: "Text",
          props: { variant: "heading2", children: "Welcome" },
        },
        body: {
          type: "Text",
          props: { variant: "body", children: "Simple card content" },
        },
        btn: { type: "Button", props: { children: "Action" } },
      });

      const report = gradeComposition(tree);
      const rule = report.results.find(
        (r) => r.rule === "has-responsive-layout",
      );
      expect(rule?.pass).toBe(true);
      expect(rule?.violations).toHaveLength(0);
    });

    it("fails for complex layout without any Grid element", () => {
      // Build a tree with >12 elements but no Grid
      const tree = buildTree("root", {
        root: { type: "Surface", children: ["stack"] },
        stack: {
          type: "Stack",
          children: ["h", "s1", "s2", "s3", "s4"],
        },
        h: {
          type: "Text",
          props: { variant: "heading2", children: "Page" },
        },
        s1: { type: "Surface", children: ["sk1"] },
        sk1: { type: "Stack", children: ["t1", "t2"] },
        t1: {
          type: "Text",
          props: { variant: "heading3", children: "Sec 1" },
        },
        t2: { type: "Text", props: { variant: "body", children: "A" } },
        s2: { type: "Surface", children: ["sk2"] },
        sk2: { type: "Stack", children: ["t3", "t4"] },
        t3: {
          type: "Text",
          props: { variant: "heading3", children: "Sec 2" },
        },
        t4: { type: "Text", props: { variant: "body", children: "B" } },
        s3: { type: "Surface", children: ["sk3"] },
        sk3: { type: "Stack", children: ["t5"] },
        t5: { type: "Text", props: { variant: "body", children: "C" } },
        s4: { type: "Surface", children: ["sk4"] },
        sk4: { type: "Stack", children: ["t6"] },
        t6: { type: "Text", props: { variant: "body", children: "D" } },
      });

      const report = gradeComposition(tree);
      const rule = report.results.find(
        (r) => r.rule === "has-responsive-layout",
      );
      expect(rule?.pass).toBe(false);
      expect(rule?.violations[0]).toContain("no Grid element with variant");
    });

    it("still fails for simple layout with misconfigured Grid (no variant)", () => {
      // Even small trees fail if Grid is present but missing variant
      const tree = buildTree("root", {
        root: { type: "Surface", children: ["stack"] },
        stack: { type: "Stack", children: ["h", "grid"] },
        h: {
          type: "Text",
          props: { variant: "heading2", children: "Small" },
        },
        grid: {
          type: "Grid",
          props: {},
          children: ["c1"],
        },
        c1: { type: "Text", props: { variant: "body", children: "Item" } },
      });

      const report = gradeComposition(tree);
      const rule = report.results.find(
        (r) => r.rule === "has-responsive-layout",
      );
      expect(rule?.pass).toBe(false);
      expect(rule?.violations[0]).toContain("no variant prop");
    });
  });

  // ===========================================================================
  // surface-hierarchy-correct
  // ===========================================================================

  describe("surface-hierarchy-correct", () => {
    it("passes when Surface children are Stack, Grid, or other non-Surface types", () => {
      const tree = buildTree("root", {
        root: { type: "Surface", children: ["stack"] },
        stack: { type: "Stack", children: ["heading", "inner"] },
        heading: {
          type: "Text",
          props: { variant: "heading2", children: "Title" },
        },
        inner: { type: "Surface", children: ["s2"] },
        s2: { type: "Stack", children: ["body"] },
        body: {
          type: "Text",
          props: { variant: "body", children: "Content" },
        },
      });

      const report = gradeComposition(tree);
      const rule = report.results.find(
        (r) => r.rule === "surface-hierarchy-correct",
      );
      expect(rule?.pass).toBe(true);
      expect(rule?.violations).toHaveLength(0);
    });

    it("passes when Surface > Stack > Surface (layout element between)", () => {
      const tree = buildTree("root", {
        root: { type: "Surface", children: ["stack"] },
        stack: { type: "Stack", children: ["card1", "card2"] },
        card1: { type: "Surface", children: ["s1"] },
        s1: { type: "Stack", children: ["h1"] },
        h1: {
          type: "Text",
          props: { variant: "heading2", children: "Card 1" },
        },
        card2: { type: "Surface", children: ["s2"] },
        s2: { type: "Stack", children: ["h2"] },
        h2: {
          type: "Text",
          props: { variant: "heading3", children: "Card 2" },
        },
      });

      const report = gradeComposition(tree);
      const rule = report.results.find(
        (r) => r.rule === "surface-hierarchy-correct",
      );
      expect(rule?.pass).toBe(true);
    });

    it("fails when Surface has a direct Surface child", () => {
      const tree = buildTree("root", {
        root: { type: "Surface", children: ["nested"] },
        nested: { type: "Surface", children: ["stack"] },
        stack: { type: "Stack", children: ["h"] },
        h: {
          type: "Text",
          props: { variant: "heading2", children: "Nested" },
        },
      });

      const report = gradeComposition(tree);
      const rule = report.results.find(
        (r) => r.rule === "surface-hierarchy-correct",
      );
      expect(rule?.pass).toBe(false);
      expect(rule?.violations).toHaveLength(1);
      expect(rule?.violations[0]).toContain("direct child of Surface");
    });

    it("reports multiple violations for multiple direct Surface>Surface nesting", () => {
      const tree = buildTree("root", {
        root: { type: "Surface", children: ["a", "b"] },
        a: { type: "Surface", children: ["sa"] },
        sa: { type: "Stack", children: ["h1"] },
        h1: {
          type: "Text",
          props: { variant: "heading2", children: "A" },
        },
        b: { type: "Surface", children: ["sb"] },
        sb: { type: "Stack", children: ["h2"] },
        h2: {
          type: "Text",
          props: { variant: "heading3", children: "B" },
        },
      });

      const report = gradeComposition(tree);
      const rule = report.results.find(
        (r) => r.rule === "surface-hierarchy-correct",
      );
      expect(rule?.pass).toBe(false);
      expect(rule?.violations).toHaveLength(2);
    });

    it("passes when Surface > Grid > Surface (Grid separates them)", () => {
      const tree = buildTree("root", {
        root: { type: "Surface", children: ["grid"] },
        grid: {
          type: "Grid",
          props: { variant: "2up" },
          children: ["card1", "card2"],
        },
        card1: { type: "Surface", children: ["s1"] },
        s1: { type: "Stack", children: ["h1"] },
        h1: {
          type: "Text",
          props: { variant: "heading2", children: "Left" },
        },
        card2: { type: "Surface", children: ["s2"] },
        s2: { type: "Stack", children: ["h2"] },
        h2: {
          type: "Text",
          props: { variant: "heading3", children: "Right" },
        },
      });

      const report = gradeComposition(tree);
      const rule = report.results.find(
        (r) => r.rule === "surface-hierarchy-correct",
      );
      expect(rule?.pass).toBe(true);
    });
  });
});
