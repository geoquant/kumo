import { describe, it, expect } from "vitest";
import { createJsonlParser } from "@/streaming/jsonl-parser";
import { applyPatch, type JsonPatchOp } from "@/streaming/rfc6902";
import type { UITree, UIElement } from "@/streaming/types";

// =============================================================================
// Helpers
// =============================================================================

const EMPTY: UITree = { root: "", elements: {} };

function el(
  key: string,
  type: string,
  props: Record<string, unknown> = {},
  children?: string[],
  parentKey?: string | null,
): UIElement {
  const element: UIElement = { key, type, props };
  if (children) element.children = children;
  if (parentKey !== undefined) element.parentKey = parentKey;
  return element;
}

/** Build JSONL lines for a complete multi-element UI. */
function buildGreetingJSONL(): string[] {
  return [
    JSON.stringify({ op: "add", path: "/root", value: "card-1" }),
    JSON.stringify({
      op: "add",
      path: "/elements/card-1",
      value: el("card-1", "Surface", { variant: "card" }, [
        "heading-1",
        "text-1",
      ]),
    }),
    JSON.stringify({
      op: "add",
      path: "/elements/heading-1",
      value: el("heading-1", "Heading", { level: 2, text: "Hello" }),
    }),
    JSON.stringify({
      op: "add",
      path: "/elements/text-1",
      value: el("text-1", "Text", { text: "Welcome to Kumo" }),
    }),
  ];
}

/**
 * Simulate token-by-token delivery by splitting a JSONL string into
 * fixed-size chunks (simulating how LLM streaming tokenizers deliver text).
 */
function tokenize(fullResponse: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < fullResponse.length; i += chunkSize) {
    chunks.push(fullResponse.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Apply patches to a UITree, folding like applyPatches in hooks.ts.
 */
function foldPatches(tree: UITree, patches: readonly JsonPatchOp[]): UITree {
  let current = tree;
  for (const patch of patches) {
    current = applyPatch(current, patch);
  }
  return current;
}

// =============================================================================
// Token-by-token streaming simulation
// =============================================================================

describe("streaming integration: token-by-token delivery", () => {
  it("incrementally builds tree from small token chunks", () => {
    const lines = buildGreetingJSONL();
    const fullResponse = lines.join("\n") + "\n";

    // Simulate small token chunks (~10 chars each, splitting mid-line)
    const tokens = tokenize(fullResponse, 10);
    expect(tokens.length).toBeGreaterThan(lines.length); // confirms we're actually splitting mid-line

    const parser = createJsonlParser();
    let tree = EMPTY;
    const snapshots: UITree[] = [];

    for (const token of tokens) {
      const ops = parser.push(token);
      if (ops.length > 0) {
        tree = foldPatches(tree, ops);
        snapshots.push(tree);
      }
    }

    // Flush any remaining buffer
    const remaining = parser.flush();
    if (remaining.length > 0) {
      tree = foldPatches(tree, remaining);
      snapshots.push(tree);
    }

    // Snapshots should show incremental growth
    expect(snapshots.length).toBeGreaterThanOrEqual(2);

    // First snapshot should have root set
    expect(snapshots[0]?.root).toBe("card-1");

    // Final tree should have all 3 elements
    expect(tree.root).toBe("card-1");
    expect(Object.keys(tree.elements)).toHaveLength(3);
    expect(tree.elements["card-1"]?.type).toBe("Surface");
    expect(tree.elements["heading-1"]?.type).toBe("Heading");
    expect(tree.elements["text-1"]?.type).toBe("Text");
  });

  it("handles single-character token delivery", () => {
    const lines = buildGreetingJSONL();
    const fullResponse = lines.join("\n") + "\n";

    // Extreme case: one character at a time
    const tokens = tokenize(fullResponse, 1);

    const parser = createJsonlParser();
    let tree = EMPTY;

    for (const token of tokens) {
      const ops = parser.push(token);
      tree = foldPatches(tree, ops);
    }

    const remaining = parser.flush();
    tree = foldPatches(tree, remaining);

    // Should still produce a complete tree
    expect(tree.root).toBe("card-1");
    expect(Object.keys(tree.elements)).toHaveLength(3);
  });

  it("handles whole-line token delivery", () => {
    const lines = buildGreetingJSONL();

    // Each token is a complete line + newline (best case)
    const parser = createJsonlParser();
    let tree = EMPTY;
    const elementCounts: number[] = [];

    for (const jsonl of lines) {
      const ops = parser.push(jsonl + "\n");
      tree = foldPatches(tree, ops);
      elementCounts.push(Object.keys(tree.elements).length);
    }

    // After line 1: root set, 0 elements
    expect(elementCounts[0]).toBe(0);
    // After line 2: 1 element (card-1)
    expect(elementCounts[1]).toBe(1);
    // After line 3: 2 elements (card-1, heading-1)
    expect(elementCounts[2]).toBe(2);
    // After line 4: 3 elements (card-1, heading-1, text-1)
    expect(elementCounts[3]).toBe(3);
  });
});

// =============================================================================
// Incremental tree growth verification
// =============================================================================

describe("streaming integration: incremental tree growth", () => {
  it("tree has correct shape at each stage", () => {
    const lines = buildGreetingJSONL();
    const parser = createJsonlParser();
    let tree = EMPTY;

    // Stage 0: empty
    expect(tree.root).toBe("");
    expect(Object.keys(tree.elements)).toHaveLength(0);

    // Stage 1: root set
    const ops1 = parser.push(lines[0] + "\n");
    tree = foldPatches(tree, ops1);
    expect(tree.root).toBe("card-1");
    expect(Object.keys(tree.elements)).toHaveLength(0);

    // Stage 2: card-1 added (children reference heading-1, text-1 which don't exist yet)
    const ops2 = parser.push(lines[1] + "\n");
    tree = foldPatches(tree, ops2);
    expect(tree.elements["card-1"]?.children).toEqual(["heading-1", "text-1"]);
    expect(tree.elements["heading-1"]).toBeUndefined(); // not yet delivered

    // Stage 3: heading-1 arrives
    const ops3 = parser.push(lines[2] + "\n");
    tree = foldPatches(tree, ops3);
    expect(tree.elements["heading-1"]?.type).toBe("Heading");
    expect(tree.elements["heading-1"]?.props.text).toBe("Hello");
    expect(tree.elements["text-1"]).toBeUndefined(); // still not delivered

    // Stage 4: text-1 arrives — tree complete
    const ops4 = parser.push(lines[3] + "\n");
    tree = foldPatches(tree, ops4);
    expect(tree.elements["text-1"]?.type).toBe("Text");
    expect(tree.elements["text-1"]?.props.text).toBe("Welcome to Kumo");
    expect(Object.keys(tree.elements)).toHaveLength(3);
  });
});

// =============================================================================
// Final tree structure verification
// =============================================================================

describe("streaming integration: final tree matches expected structure", () => {
  it("token-by-token delivery produces identical result to whole-line delivery", () => {
    const lines = buildGreetingJSONL();
    const fullResponse = lines.join("\n") + "\n";

    // Token-by-token (chunked)
    const tokenParser = createJsonlParser();
    let tokenTree = EMPTY;
    for (const chunk of tokenize(fullResponse, 7)) {
      const ops = tokenParser.push(chunk);
      tokenTree = foldPatches(tokenTree, ops);
    }
    tokenTree = foldPatches(tokenTree, tokenParser.flush());

    // Whole-line delivery
    const lineParser = createJsonlParser();
    let lineTree = EMPTY;
    for (const jsonl of lines) {
      const ops = lineParser.push(jsonl + "\n");
      lineTree = foldPatches(lineTree, ops);
    }

    // Both should produce identical trees
    expect(tokenTree).toEqual(lineTree);
  });

  it("final tree has correct element relationships", () => {
    const lines = buildGreetingJSONL();
    const parser = createJsonlParser();
    let tree = EMPTY;

    for (const jsonl of lines) {
      tree = foldPatches(tree, parser.push(jsonl + "\n"));
    }

    // Root points to card-1
    expect(tree.root).toBe("card-1");

    // card-1 has children referencing heading-1 and text-1
    const card = tree.elements["card-1"];
    expect(card).toBeDefined();
    expect(card?.children).toEqual(["heading-1", "text-1"]);
    expect(card?.type).toBe("Surface");

    // heading-1 has the correct text prop
    const heading = tree.elements["heading-1"];
    expect(heading).toBeDefined();
    expect(heading?.props.level).toBe(2);
    expect(heading?.props.text).toBe("Hello");

    // text-1 has the correct text prop
    const text = tree.elements["text-1"];
    expect(text).toBeDefined();
    expect(text?.props.text).toBe("Welcome to Kumo");
  });
});

// =============================================================================
// Complex multi-element streaming
// =============================================================================

describe("streaming integration: complex UI with nested children", () => {
  it("builds a dashboard layout incrementally", () => {
    // Simulate a more complex UI: layout → 2 cards, each with heading + text
    const jsonlLines = [
      JSON.stringify({ op: "add", path: "/root", value: "layout-1" }),
      JSON.stringify({
        op: "add",
        path: "/elements/layout-1",
        value: el("layout-1", "Cluster", { gap: "base", wrap: "nowrap" }, [
          "card-a",
          "card-b",
        ]),
      }),
      JSON.stringify({
        op: "add",
        path: "/elements/card-a",
        value: el("card-a", "Surface", { variant: "card" }, ["heading-a"]),
      }),
      JSON.stringify({
        op: "add",
        path: "/elements/heading-a",
        value: el("heading-a", "Heading", { level: 3, text: "Stats" }),
      }),
      JSON.stringify({
        op: "add",
        path: "/elements/card-b",
        value: el("card-b", "Surface", { variant: "card" }, ["text-b"]),
      }),
      JSON.stringify({
        op: "add",
        path: "/elements/text-b",
        value: el("text-b", "Text", { text: "Details here" }),
      }),
    ];

    const fullResponse = jsonlLines.join("\n") + "\n";
    // Use chunk size that splits mid-JSON (13 chars) to test robustness
    const tokens = tokenize(fullResponse, 13);

    const parser = createJsonlParser();
    let tree = EMPTY;
    const sizes: number[] = [];

    for (const token of tokens) {
      const ops = parser.push(token);
      if (ops.length > 0) {
        tree = foldPatches(tree, ops);
        sizes.push(Object.keys(tree.elements).length);
      }
    }
    tree = foldPatches(tree, parser.flush());

    // Element count should grow monotonically
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i - 1]!);
    }

    // Final: 5 elements total
    expect(tree.root).toBe("layout-1");
    expect(Object.keys(tree.elements)).toHaveLength(5);
    expect(tree.elements["layout-1"]?.children).toEqual(["card-a", "card-b"]);
    expect(tree.elements["card-a"]?.children).toEqual(["heading-a"]);
    expect(tree.elements["card-b"]?.children).toEqual(["text-b"]);
  });

  it("apply with replace op mid-stream updates existing element", () => {
    const jsonlLines = [
      JSON.stringify({ op: "add", path: "/root", value: "text-1" }),
      JSON.stringify({
        op: "add",
        path: "/elements/text-1",
        value: el("text-1", "Text", { text: "Loading..." }),
      }),
      // Replace text mid-stream (simulating LLM correction)
      JSON.stringify({
        op: "replace",
        path: "/elements/text-1",
        value: el("text-1", "Text", { text: "Data loaded!" }),
      }),
    ];

    const fullResponse = jsonlLines.join("\n") + "\n";
    const tokens = tokenize(fullResponse, 15);

    const parser = createJsonlParser();
    let tree = EMPTY;

    for (const token of tokens) {
      const ops = parser.push(token);
      tree = foldPatches(tree, ops);
    }
    tree = foldPatches(tree, parser.flush());

    // Replace should have updated the text
    expect(tree.elements["text-1"]?.props.text).toBe("Data loaded!");
  });
});
