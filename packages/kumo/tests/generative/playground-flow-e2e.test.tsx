/**
 * End-to-end verification: Flow in playground.
 *
 * Tests the full generative pipeline for a "Workers flow" page preset:
 * JSONL fixture → parseJsonlToTree → structural grading → composition
 * grading → element validation → UITreeRenderer rendering.
 *
 * Verifies that a realistic LLM-generated Workers flow page (Flow diagram +
 * Table) parses, grades, validates, and renders correctly through every
 * stage of the pipeline.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import React from "react";
import { render } from "@testing-library/react";

import {
  parseJsonlToTree,
  gradeTree,
  walkTree,
} from "../../src/generative/structural-graders";
import { gradeComposition } from "../../src/generative/composition-graders";
import {
  validateElement,
  coerceElementProps,
} from "../../src/generative/element-validator";
import { COMPONENT_MAP, KNOWN_TYPES } from "../../src/generative/component-map";
import {
  UITreeRenderer,
  isRenderableTree,
  getUnknownTypes,
} from "../../src/generative/ui-tree-renderer";
import type { UITree, UIElement } from "../../src/streaming/types";

// =============================================================================
// Fixture loading
// =============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURE_DIR = resolve(__dirname, "fixtures");

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURE_DIR, `${name}.jsonl`), "utf-8");
}

// =============================================================================
// Helpers
// =============================================================================

function elementsByType(tree: UITree, type: string): UIElement[] {
  return Object.values(tree.elements).filter((el) => el.type === type);
}

function el(
  key: string,
  type: string,
  props: Record<string, unknown> = {},
  children?: string[],
): UIElement {
  return {
    key,
    type,
    props,
    ...(children != null ? { children } : {}),
  };
}

function mkTree(root: string, elements: Record<string, UIElement>): UITree {
  return { root, elements };
}

// =============================================================================
// Stage 1: JSONL parsing
// =============================================================================

describe("playground flow e2e: JSONL parsing", () => {
  it("workers-flow fixture parses to a valid UITree", () => {
    const tree = parseJsonlToTree(loadFixture("workers-flow"));

    expect(tree.root).toBe("page");
    expect(Object.keys(tree.elements).length).toBeGreaterThan(0);
    expect(tree.elements["page"]).toBeDefined();
  });

  it("parsed tree contains Flow, FlowNode, and FlowParallel elements", () => {
    const tree = parseJsonlToTree(loadFixture("workers-flow"));

    const flowElements = elementsByType(tree, "Flow");
    const flowNodes = elementsByType(tree, "FlowNode");
    const flowParallels = elementsByType(tree, "FlowParallel");

    expect(flowElements).toHaveLength(1);
    expect(flowNodes.length).toBeGreaterThanOrEqual(5); // client, waf, rate, worker, kv, d1, response
    expect(flowParallels).toHaveLength(2); // security + storage
  });

  it("parsed tree contains structural Table element for bindings", () => {
    const tree = parseJsonlToTree(loadFixture("workers-flow"));

    const tables = elementsByType(tree, "Table");
    expect(tables).toHaveLength(1);
    expect(tables[0].props).toHaveProperty("layout", "fixed");
    expect(tables[0].children).toBeDefined();

    // Structural children: TableHeader + TableBody
    const headers = elementsByType(tree, "TableHeader");
    const bodies = elementsByType(tree, "TableBody");
    expect(headers).toHaveLength(1);
    expect(bodies).toHaveLength(1);

    // 4 data rows (MY_KV, MY_DB, AUTH_SERVICE, ASSETS)
    const bodyRows = bodies[0].children ?? [];
    expect(bodyRows).toHaveLength(4);
  });

  it("preserves parent-child relationships through parsing", () => {
    const tree = parseJsonlToTree(loadFixture("workers-flow"));

    // Flow's children should include FlowNodes and FlowParallels
    const flow = elementsByType(tree, "Flow")[0];
    expect(flow.children).toBeDefined();
    expect(flow.children!.length).toBeGreaterThanOrEqual(3);

    // Each FlowParallel should have FlowNode children
    const parallels = elementsByType(tree, "FlowParallel");
    for (const parallel of parallels) {
      expect(parallel.children).toBeDefined();
      expect(parallel.children!.length).toBeGreaterThanOrEqual(2);
      for (const childKey of parallel.children!) {
        const child = tree.elements[childKey];
        expect(child).toBeDefined();
        expect(child.type).toBe("FlowNode");
      }
    }
  });
});

// =============================================================================
// Stage 2: Structural grading
// =============================================================================

describe("playground flow e2e: structural grading", () => {
  it("workers-flow fixture passes all structural rules", () => {
    const tree = parseJsonlToTree(loadFixture("workers-flow"));
    const report = gradeTree(tree);

    for (const result of report.results) {
      expect(result.violations, `${result.rule} violations`).toEqual([]);
    }
    expect(report.allPass).toBe(true);
  });

  it("all element types are recognized (valid-component-types)", () => {
    const tree = parseJsonlToTree(loadFixture("workers-flow"));
    const unknownTypes = getUnknownTypes(tree);

    expect(unknownTypes).toEqual([]);
  });

  it("no orphan nodes exist", () => {
    const tree = parseJsonlToTree(loadFixture("workers-flow"));
    const reachable = new Set<string>();

    walkTree(tree, (element) => {
      reachable.add(element.key);
    });

    // Every element in the tree should be reachable from root
    for (const key of Object.keys(tree.elements)) {
      expect(reachable.has(key), `element "${key}" is reachable`).toBe(true);
    }
  });
});

// =============================================================================
// Stage 3: Composition grading
// =============================================================================

describe("playground flow e2e: composition grading", () => {
  it("workers-flow fixture has visual hierarchy", () => {
    const tree = parseJsonlToTree(loadFixture("workers-flow"));
    const report = gradeComposition(tree);

    const hierarchyResult = report.results.find(
      (r) => r.rule === "has-visual-hierarchy",
    );
    expect(hierarchyResult?.pass).toBe(true);
  });

  it("workers-flow fixture has correct surface hierarchy", () => {
    const tree = parseJsonlToTree(loadFixture("workers-flow"));
    const report = gradeComposition(tree);

    const surfaceResult = report.results.find(
      (r) => r.rule === "surface-hierarchy-correct",
    );
    expect(surfaceResult?.pass).toBe(true);
  });

  it("fixture contains section headings (heading2)", () => {
    const tree = parseJsonlToTree(loadFixture("workers-flow"));

    const headings = elementsByType(tree, "Text").filter(
      (el) => el.props["variant"] === "heading2",
    );
    expect(headings.length).toBeGreaterThanOrEqual(2);
  });
});

// =============================================================================
// Stage 4: Element validation
// =============================================================================

describe("playground flow e2e: element validation", () => {
  it("all elements pass coercion without errors", () => {
    const tree = parseJsonlToTree(loadFixture("workers-flow"));

    for (const element of Object.values(tree.elements)) {
      // coerceElementProps should not throw
      const coerced = coerceElementProps(element);
      expect(coerced).toBeDefined();
    }
  });

  it("Flow/FlowNode/FlowParallel elements validate or pass through", () => {
    const tree = parseJsonlToTree(loadFixture("workers-flow"));

    const flowTypes = ["Flow", "FlowNode", "FlowParallel"];
    for (const element of Object.values(tree.elements)) {
      if (flowTypes.includes(element.type)) {
        // These may not have schemas (sub-components) — validation should
        // either succeed or return null (pass-through), never throw
        expect(() => validateElement(element)).not.toThrow();
      }
    }
  });

  it("Table element validates against schema", () => {
    const tree = parseJsonlToTree(loadFixture("workers-flow"));

    const tableEl = elementsByType(tree, "Table")[0];
    expect(() => validateElement(tableEl)).not.toThrow();
  });
});

// =============================================================================
// Stage 5: UITreeRenderer rendering
// =============================================================================

describe("playground flow e2e: UITreeRenderer rendering", () => {
  it("workers-flow fixture is renderable", () => {
    const tree = parseJsonlToTree(loadFixture("workers-flow"));
    expect(isRenderableTree(tree)).toBe(true);
  });

  it("renders without 'Unknown component' warnings", () => {
    const tree = parseJsonlToTree(loadFixture("workers-flow"));
    const { container } = render(<UITreeRenderer tree={tree} />);

    // The renderer adds .text-kumo-warning for unknown types
    const unknownWarning = container.querySelector(".text-kumo-warning");
    expect(unknownWarning).toBeNull();
  });

  it("all Flow types resolve to COMPONENT_MAP entries", () => {
    expect(COMPONENT_MAP.Flow).toBeDefined();
    expect(COMPONENT_MAP.FlowNode).toBeDefined();
    expect(COMPONENT_MAP.FlowParallel).toBeDefined();
    expect(COMPONENT_MAP.Table).toBeDefined();
  });

  it("all Flow types are in KNOWN_TYPES", () => {
    expect(KNOWN_TYPES.has("Flow")).toBe(true);
    expect(KNOWN_TYPES.has("FlowNode")).toBe(true);
    expect(KNOWN_TYPES.has("FlowParallel")).toBe(true);
  });
});

// =============================================================================
// Stage 6: Inline tree rendering (manual tree, bypassing fixture)
// =============================================================================

describe("playground flow e2e: inline tree rendering", () => {
  it("renders a minimal Flow → FlowNode → FlowParallel tree", () => {
    const tree = mkTree("flow", {
      flow: el("flow", "Flow", {}, ["n1", "par", "n2"]),
      n1: el("n1", "FlowNode", { children: "Start" }),
      par: el("par", "FlowParallel", {}, ["b1", "b2"]),
      b1: el("b1", "FlowNode", { children: "Branch A" }),
      b2: el("b2", "FlowNode", { children: "Branch B" }),
      n2: el("n2", "FlowNode", { children: "End" }),
    });

    const { container } = render(<UITreeRenderer tree={tree} />);
    const unknownWarning = container.querySelector(".text-kumo-warning");
    expect(unknownWarning).toBeNull();
  });

  it("renders Flow with disabled node prop", () => {
    const tree = mkTree("flow", {
      flow: el("flow", "Flow", {}, ["active", "disabled"]),
      active: el("active", "FlowNode", { children: "Active" }),
      disabled: el("disabled", "FlowNode", {
        children: "Disabled",
        disabled: true,
      }),
    });

    const { container } = render(<UITreeRenderer tree={tree} />);
    const unknownWarning = container.querySelector(".text-kumo-warning");
    expect(unknownWarning).toBeNull();
  });

  it("renders composite page with Flow + Table (playground preset shape)", () => {
    const tree = mkTree("page", {
      page: el("page", "Stack", { gap: "xl" }, ["flow-card", "table-card"]),
      "flow-card": el("flow-card", "Surface", {}, ["diagram"]),
      diagram: el("diagram", "Flow", {}, ["s1", "p1", "s2"]),
      s1: el("s1", "FlowNode", { children: "Request" }),
      p1: el("p1", "FlowParallel", {}, ["b1", "b2"]),
      b1: el("b1", "FlowNode", { children: "Cache" }),
      b2: el("b2", "FlowNode", { children: "Origin" }),
      s2: el("s2", "FlowNode", { children: "Response" }),
      "table-card": el("table-card", "Surface", {}, ["tbl"]),
      tbl: el("tbl", "Table", { layout: "fixed" }, ["thead", "tbody"]),
      thead: el("thead", "TableHeader", {}, ["hrow"]),
      hrow: el("hrow", "TableRow", {}, ["h1", "h2"]),
      h1: el("h1", "TableHead", { children: "Name" }),
      h2: el("h2", "TableHead", { children: "Value" }),
      tbody: el("tbody", "TableBody", {}, ["row1"]),
      row1: el("row1", "TableRow", {}, ["c1", "c2"]),
      c1: el("c1", "TableCell", { children: "KEY" }),
      c2: el("c2", "TableCell", { children: "val" }),
    });

    const { container } = render(<UITreeRenderer tree={tree} />);
    const unknownWarning = container.querySelector(".text-kumo-warning");
    expect(unknownWarning).toBeNull();
  });
});

// =============================================================================
// Stage 7: Cross-cutting — full pipeline coherence
// =============================================================================

describe("playground flow e2e: full pipeline coherence", () => {
  it("fixture survives parse → grade → validate → render without errors", () => {
    // 1. Parse
    const tree = parseJsonlToTree(loadFixture("workers-flow"));
    expect(isRenderableTree(tree)).toBe(true);

    // 2. Grade structural
    const structural = gradeTree(tree);
    expect(structural.allPass).toBe(true);

    // 3. Grade composition (visual hierarchy + surface)
    const composition = gradeComposition(tree);
    const surfaceResult = composition.results.find(
      (r) => r.rule === "surface-hierarchy-correct",
    );
    expect(surfaceResult?.pass).toBe(true);

    // 4. Validate all elements
    for (const element of Object.values(tree.elements)) {
      expect(() => coerceElementProps(element)).not.toThrow();
      expect(() => validateElement(element)).not.toThrow();
    }

    // 5. Render
    const { container } = render(<UITreeRenderer tree={tree} />);
    const unknownWarning = container.querySelector(".text-kumo-warning");
    expect(unknownWarning).toBeNull();

    // 6. No unknown types
    expect(getUnknownTypes(tree)).toEqual([]);
  });

  it("element count matches expected structure", () => {
    const tree = parseJsonlToTree(loadFixture("workers-flow"));

    // Expected: 1 page Stack, 2 Surfaces, 2 headings, 1 Flow,
    // 7 FlowNodes, 2 FlowParallels, 1 Table + 1 TableHeader +
    // 1 TableRow(header) + 3 TableHead + 1 TableBody +
    // 4 TableRow(body) + 12 TableCell = 38 elements
    expect(Object.keys(tree.elements)).toHaveLength(38);
  });
});
