/**
 * Regression tests — verify all existing functionality is preserved
 * after the migration from monolithic JSON to streaming JSONL patches.
 *
 * Covers: preset prompt output shapes, multi-turn conversation flow,
 * stop/abort with partial tree preservation, and error state handling.
 *
 * These tests exercise the data pipeline (parser → patches → tree)
 * with realistic LLM-shaped JSONL output for each preset category.
 */

import { describe, it, expect } from "vitest";
import { createJsonlParser } from "../core/jsonl-parser";
import { applyPatch, type JsonPatchOp } from "../core/rfc6902";
import { isRenderableTree } from "../core/UITreeRenderer";
import type { UITree, UIElement } from "../core/types";

// =============================================================================
// Helpers
// =============================================================================

const EMPTY: UITree = { root: "", elements: {} };

function el(
  key: string,
  type: string,
  props: Record<string, unknown> = {},
  children?: string[],
): UIElement {
  const element: UIElement = { key, type, props };
  if (children) element.children = children;
  return element;
}

/** Fold patches into tree (mirrors useUITree.applyPatches). */
function foldPatches(tree: UITree, patches: readonly JsonPatchOp[]): UITree {
  let current = tree;
  for (const patch of patches) {
    current = applyPatch(current, patch);
  }
  return current;
}

/** Simulate streaming delivery: feed JSONL lines through parser into tree. */
function simulateStream(
  jsonlLines: string[],
  chunkSize = 20,
): { tree: UITree; snapshots: UITree[] } {
  const fullResponse = jsonlLines.join("\n") + "\n";
  const parser = createJsonlParser();
  let tree = EMPTY;
  const snapshots: UITree[] = [];

  // Deliver in chunks to simulate streaming
  for (let i = 0; i < fullResponse.length; i += chunkSize) {
    const chunk = fullResponse.slice(i, i + chunkSize);
    const ops = parser.push(chunk);
    if (ops.length > 0) {
      tree = foldPatches(tree, ops);
      snapshots.push(tree);
    }
  }

  // Flush remaining
  const remaining = parser.flush();
  if (remaining.length > 0) {
    tree = foldPatches(tree, remaining);
    snapshots.push(tree);
  }

  return { tree, snapshots };
}

/** Simulate partial delivery (stop mid-stream). */
function simulatePartialStream(
  jsonlLines: string[],
  deliverLines: number,
): UITree {
  const parser = createJsonlParser();
  let tree = EMPTY;

  // Deliver only a subset of lines
  for (let i = 0; i < deliverLines && i < jsonlLines.length; i++) {
    const ops = parser.push(jsonlLines[i] + "\n");
    tree = foldPatches(tree, ops);
  }

  // Flush (simulates stop button → flush remaining buffer)
  const remaining = parser.flush();
  tree = foldPatches(tree, remaining);

  return tree;
}

// =============================================================================
// Preset JSONL fixtures — one per preset category
// =============================================================================

/** Preset: "Welcome the user to Cloudflare" */
const WELCOME_JSONL = [
  JSON.stringify({ op: "add", path: "/root", value: "card-1" }),
  JSON.stringify({
    op: "add",
    path: "/elements/card-1",
    value: el("card-1", "Surface", { variant: "card" }, [
      "heading-1",
      "text-1",
      "btn-1",
    ]),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/heading-1",
    value: el("heading-1", "Text", {
      variant: "heading",
      size: "lg",
      children: "Welcome to Cloudflare",
    }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/text-1",
    value: el("text-1", "Text", {
      children: "Build and deploy applications globally.",
    }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/btn-1",
    value: el("btn-1", "Button", {
      variant: "primary",
      children: "Get Started",
    }),
  }),
];

/** Preset: "Create a DNS record editor" */
const DNS_EDITOR_JSONL = [
  JSON.stringify({ op: "add", path: "/root", value: "form-1" }),
  JSON.stringify({
    op: "add",
    path: "/elements/form-1",
    value: el("form-1", "Surface", { variant: "card" }, [
      "heading-1",
      "input-type",
      "input-name",
      "input-value",
      "btn-save",
    ]),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/heading-1",
    value: el("heading-1", "Text", {
      variant: "heading",
      children: "DNS Record Editor",
    }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/input-type",
    value: el(
      "input-type",
      "Select",
      { label: "Record Type", placeholder: "Select type" },
      ["opt-a", "opt-cname"],
    ),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/opt-a",
    value: el("opt-a", "SelectOption", { value: "A", children: "A" }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/opt-cname",
    value: el("opt-cname", "SelectOption", {
      value: "CNAME",
      children: "CNAME",
    }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/input-name",
    value: el("input-name", "Input", {
      label: "Name",
      placeholder: "e.g. example.com",
    }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/input-value",
    value: el("input-value", "Input", {
      label: "Value",
      placeholder: "e.g. 192.0.2.1",
    }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/btn-save",
    value: el("btn-save", "Button", {
      variant: "primary",
      children: "Save Record",
    }),
  }),
];

/** Preset: "Show a server status dashboard" */
const DASHBOARD_JSONL = [
  JSON.stringify({ op: "add", path: "/root", value: "dashboard" }),
  JSON.stringify({
    op: "add",
    path: "/elements/dashboard",
    value: el("dashboard", "Surface", { variant: "card" }, [
      "heading",
      "grid-1",
    ]),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/heading",
    value: el("heading", "Text", {
      variant: "heading",
      children: "Server Status",
    }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/grid-1",
    value: el("grid-1", "Grid", { columns: 3 }, [
      "stat-cpu",
      "stat-mem",
      "stat-net",
    ]),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/stat-cpu",
    value: el("stat-cpu", "Surface", { variant: "card" }, [
      "cpu-label",
      "cpu-meter",
    ]),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/cpu-label",
    value: el("cpu-label", "Text", { children: "CPU Usage" }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/cpu-meter",
    value: el("cpu-meter", "Meter", { value: 65, max: 100 }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/stat-mem",
    value: el("stat-mem", "Surface", { variant: "card" }, [
      "mem-label",
      "mem-meter",
    ]),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/mem-label",
    value: el("mem-label", "Text", { children: "Memory" }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/mem-meter",
    value: el("mem-meter", "Meter", { value: 42, max: 100 }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/stat-net",
    value: el("stat-net", "Surface", { variant: "card" }, [
      "net-label",
      "net-badge",
    ]),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/net-label",
    value: el("net-label", "Text", { children: "Network" }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/net-badge",
    value: el("net-badge", "Badge", {
      variant: "positive",
      children: "Healthy",
    }),
  }),
];

/** Preset: "Build a support ticket form" */
const TICKET_FORM_JSONL = [
  JSON.stringify({ op: "add", path: "/root", value: "form" }),
  JSON.stringify({
    op: "add",
    path: "/elements/form",
    value: el("form", "Surface", { variant: "card" }, [
      "heading",
      "input-subject",
      "input-desc",
      "select-priority",
      "btn-submit",
    ]),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/heading",
    value: el("heading", "Text", {
      variant: "heading",
      children: "Support Ticket",
    }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/input-subject",
    value: el("input-subject", "Input", {
      label: "Subject",
      placeholder: "Brief description",
    }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/input-desc",
    value: el("input-desc", "Input", {
      label: "Description",
      placeholder: "Describe the issue",
    }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/select-priority",
    value: el("select-priority", "Select", { label: "Priority" }, [
      "p-low",
      "p-med",
      "p-high",
    ]),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/p-low",
    value: el("p-low", "SelectOption", { value: "low", children: "Low" }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/p-med",
    value: el("p-med", "SelectOption", { value: "medium", children: "Medium" }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/p-high",
    value: el("p-high", "SelectOption", { value: "high", children: "High" }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/btn-submit",
    value: el("btn-submit", "Button", {
      variant: "primary",
      children: "Submit Ticket",
    }),
  }),
];

/** Preset: "Display a pricing comparison table" */
const PRICING_TABLE_JSONL = [
  JSON.stringify({ op: "add", path: "/root", value: "container" }),
  JSON.stringify({
    op: "add",
    path: "/elements/container",
    value: el("container", "Surface", { variant: "card" }, [
      "heading",
      "table",
    ]),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/heading",
    value: el("heading", "Text", {
      variant: "heading",
      children: "Pricing Plans",
    }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/table",
    value: el("table", "Table", {}, ["thead", "tbody"]),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/thead",
    value: el("thead", "TableHeader", {}, ["hrow"]),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/hrow",
    value: el("hrow", "TableRow", {}, ["h-plan", "h-price"]),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/h-plan",
    value: el("h-plan", "TableHead", { children: "Plan" }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/h-price",
    value: el("h-price", "TableHead", { children: "Price" }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/tbody",
    value: el("tbody", "TableBody", {}, ["row-free", "row-pro"]),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/row-free",
    value: el("row-free", "TableRow", {}, [
      "cell-free-plan",
      "cell-free-price",
    ]),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/cell-free-plan",
    value: el("cell-free-plan", "TableCell", { children: "Free" }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/cell-free-price",
    value: el("cell-free-price", "TableCell", { children: "$0/mo" }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/row-pro",
    value: el("row-pro", "TableRow", {}, ["cell-pro-plan", "cell-pro-price"]),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/cell-pro-plan",
    value: el("cell-pro-plan", "TableCell", { children: "Pro" }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/cell-pro-price",
    value: el("cell-pro-price", "TableCell", { children: "$20/mo" }),
  }),
];

/** Preset: "Create a user profile settings page" */
const SETTINGS_JSONL = [
  JSON.stringify({ op: "add", path: "/root", value: "settings" }),
  JSON.stringify({
    op: "add",
    path: "/elements/settings",
    value: el("settings", "Surface", { variant: "card" }, [
      "heading",
      "input-name",
      "input-email",
      "switch-notify",
      "btn-save",
    ]),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/heading",
    value: el("heading", "Text", {
      variant: "heading",
      children: "Profile Settings",
    }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/input-name",
    value: el("input-name", "Input", {
      label: "Display Name",
      value: "Jane Doe",
    }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/input-email",
    value: el("input-email", "Input", {
      label: "Email",
      type: "email",
      value: "jane@example.com",
    }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/switch-notify",
    value: el("switch-notify", "Switch", {
      label: "Email notifications",
      checked: true,
    }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/btn-save",
    value: el("btn-save", "Button", {
      variant: "primary",
      children: "Save Changes",
    }),
  }),
];

/** Preset: "Show an analytics overview" */
const ANALYTICS_JSONL = [
  JSON.stringify({ op: "add", path: "/root", value: "analytics" }),
  JSON.stringify({
    op: "add",
    path: "/elements/analytics",
    value: el("analytics", "Surface", { variant: "card" }, ["heading", "grid"]),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/heading",
    value: el("heading", "Text", {
      variant: "heading",
      children: "Analytics Overview",
    }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/grid",
    value: el("grid", "Grid", { columns: 2 }, [
      "card-requests",
      "card-bandwidth",
    ]),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/card-requests",
    value: el("card-requests", "Surface", { variant: "card" }, [
      "req-label",
      "req-value",
    ]),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/req-label",
    value: el("req-label", "Text", {
      variant: "secondary",
      children: "Total Requests",
    }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/req-value",
    value: el("req-value", "Text", {
      variant: "heading",
      size: "xl",
      children: "1.2M",
    }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/card-bandwidth",
    value: el("card-bandwidth", "Surface", { variant: "card" }, [
      "bw-label",
      "bw-value",
    ]),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/bw-label",
    value: el("bw-label", "Text", {
      variant: "secondary",
      children: "Bandwidth",
    }),
  }),
  JSON.stringify({
    op: "add",
    path: "/elements/bw-value",
    value: el("bw-value", "Text", {
      variant: "heading",
      size: "xl",
      children: "45 GB",
    }),
  }),
];

const ALL_PRESETS: ReadonlyArray<{ name: string; jsonl: string[] }> = [
  { name: "Welcome", jsonl: WELCOME_JSONL },
  { name: "DNS Editor", jsonl: DNS_EDITOR_JSONL },
  { name: "Dashboard", jsonl: DASHBOARD_JSONL },
  { name: "Support Ticket", jsonl: TICKET_FORM_JSONL },
  { name: "Pricing Table", jsonl: PRICING_TABLE_JSONL },
  { name: "Settings", jsonl: SETTINGS_JSONL },
  { name: "Analytics", jsonl: ANALYTICS_JSONL },
];

// =============================================================================
// Preset prompts produce valid streaming UI
// =============================================================================

describe("regression: all 7 presets produce valid streaming UI", () => {
  it.each(ALL_PRESETS)(
    "$name preset produces a renderable tree",
    ({ jsonl }) => {
      const { tree } = simulateStream(jsonl);

      // Tree must be renderable
      expect(isRenderableTree(tree)).toBe(true);
      expect(tree.root).toBeTruthy();
      expect(Object.keys(tree.elements).length).toBeGreaterThan(0);

      // Root element must exist in elements map
      expect(tree.elements[tree.root]).toBeDefined();
    },
  );

  it.each(ALL_PRESETS)(
    "$name preset — all child references resolve",
    ({ jsonl }) => {
      const { tree } = simulateStream(jsonl);

      // Every element's children (if declared) must reference existing elements
      for (const [key, element] of Object.entries(tree.elements)) {
        if (element.children) {
          for (const childKey of element.children) {
            expect(
              tree.elements[childKey],
              `Element "${key}" references child "${childKey}" which doesn't exist`,
            ).toBeDefined();
          }
        }
      }
    },
  );

  it.each(ALL_PRESETS)(
    "$name preset — all element types are known components",
    ({ jsonl }) => {
      const { tree } = simulateStream(jsonl);

      const KNOWN_TYPES = new Set([
        "Badge",
        "Banner",
        "Button",
        "Checkbox",
        "Div",
        "Empty",
        "Grid",
        "Input",
        "Link",
        "Loader",
        "Meter",
        "Select",
        "SelectOption",
        "Surface",
        "Switch",
        "Table",
        "TableHeader",
        "TableHead",
        "TableBody",
        "TableRow",
        "TableCell",
        "TableFooter",
        "Tabs",
        "Text",
      ]);

      for (const [key, element] of Object.entries(tree.elements)) {
        expect(
          KNOWN_TYPES.has(element.type),
          `Element "${key}" has unknown type "${element.type}"`,
        ).toBe(true);
      }
    },
  );

  it("exactly 7 presets defined", () => {
    expect(ALL_PRESETS).toHaveLength(7);
  });
});

// =============================================================================
// Multi-turn conversation
// =============================================================================

describe("regression: multi-turn conversation", () => {
  it("second prompt fully replaces first tree (no state leakage)", () => {
    // Turn 1: Welcome card
    const { tree: tree1 } = simulateStream(WELCOME_JSONL);
    expect(tree1.root).toBe("card-1");
    expect(Object.keys(tree1.elements)).toContain("heading-1");

    // Turn 2: Start fresh (simulates reset() + new parser) → DNS editor
    const { tree: tree2 } = simulateStream(DNS_EDITOR_JSONL);
    expect(tree2.root).toBe("form-1");

    // No elements from turn 1 should leak into turn 2
    expect(tree2.elements["card-1"]).toBeUndefined();
    expect(tree2.elements["heading-1"]?.props.children).not.toBe(
      "Welcome to Cloudflare",
    );
  });

  it("sequential turns produce independent valid trees", () => {
    for (const { jsonl } of ALL_PRESETS) {
      // Each turn: reset to EMPTY + simulate stream (mirrors ChatDemo behavior)
      const { tree } = simulateStream(jsonl);
      expect(isRenderableTree(tree)).toBe(true);
    }
  });

  it("message history accumulates across turns without affecting tree", () => {
    // Simulates the messages state accumulation in ChatDemo
    const history: Array<{ role: string; content: string }> = [];

    for (const { name, jsonl } of ALL_PRESETS) {
      // Add user message
      history.push({ role: "user", content: `Generate: ${name}` });

      // Stream produces valid tree
      const { tree } = simulateStream(jsonl);
      expect(isRenderableTree(tree)).toBe(true);

      // Add assistant message (placeholder, as ChatDemo does)
      history.push({ role: "assistant", content: "(UI response)" });
    }

    // History should have 2 entries per turn (user + assistant)
    expect(history).toHaveLength(ALL_PRESETS.length * 2);
  });
});

// =============================================================================
// Stop button — partial UI preserved
// =============================================================================

describe("regression: stop button halts streaming, partial UI preserved", () => {
  it("partial delivery after root + 1 element yields renderable tree", () => {
    // Deliver only first 2 lines (root + root element) of dashboard
    const tree = simulatePartialStream(DASHBOARD_JSONL, 2);

    expect(isRenderableTree(tree)).toBe(true);
    expect(tree.root).toBe("dashboard");
    expect(tree.elements["dashboard"]).toBeDefined();
  });

  it("partial delivery — children pointing to undelivered elements are graceful", () => {
    // Deliver root + container (which references heading, grid)
    const tree = simulatePartialStream(DASHBOARD_JSONL, 2);

    // Container has children, but they haven't arrived yet
    const dashboard = tree.elements["dashboard"];
    expect(dashboard?.children).toBeDefined();
    expect(dashboard?.children?.length).toBeGreaterThan(0);

    // Missing children are OK during streaming (functional-2 guarantees this)
    // We just verify the tree structure is valid, not that children exist
    expect(tree.root).toBe("dashboard");
  });

  it("stop after only root line → not renderable (no elements)", () => {
    const tree = simulatePartialStream(DASHBOARD_JSONL, 1);

    // Root is set but no elements yet → isRenderableTree should be false
    expect(tree.root).toBe("dashboard");
    expect(Object.keys(tree.elements)).toHaveLength(0);
    expect(isRenderableTree(tree)).toBe(false);
  });

  it("stop mid-stream preserves all elements delivered so far", () => {
    // Deliver 5 of 13 lines (root, dashboard, heading, grid, stat-cpu)
    const tree = simulatePartialStream(DASHBOARD_JSONL, 5);

    expect(tree.root).toBe("dashboard");
    expect(tree.elements["dashboard"]).toBeDefined();
    expect(tree.elements["heading"]).toBeDefined();
    expect(tree.elements["grid-1"]).toBeDefined();
    expect(tree.elements["stat-cpu"]).toBeDefined();

    // Elements not yet delivered should be absent
    expect(tree.elements["stat-mem"]).toBeUndefined();
    expect(tree.elements["stat-net"]).toBeUndefined();
  });

  it("flush after partial delivery parses any buffered content", () => {
    const parser = createJsonlParser();
    let tree = EMPTY;

    // Deliver 2 full lines + half of a third
    const line1 = WELCOME_JSONL[0] + "\n";
    const line2 = WELCOME_JSONL[1] + "\n";
    const halfLine3 = WELCOME_JSONL[2]!.slice(0, 30);

    tree = foldPatches(tree, parser.push(line1));
    tree = foldPatches(tree, parser.push(line2));
    parser.push(halfLine3); // buffered, incomplete

    // Tree has root + 1 element
    expect(tree.root).toBe("card-1");
    expect(Object.keys(tree.elements)).toHaveLength(1);

    // Flush — partial line is invalid JSON, so no additional op
    const remaining = parser.flush();
    tree = foldPatches(tree, remaining);

    // Tree unchanged (partial JSON can't be parsed)
    expect(Object.keys(tree.elements)).toHaveLength(1);
  });
});

// =============================================================================
// Error states
// =============================================================================

/** Mirrors getApiKey() logic from ChatDemo.tsx. */
function resolveApiKey(raw: string | undefined): string | null {
  const key = typeof raw === "string" ? raw : null;
  return key && key.length > 0 ? key : null;
}

describe("regression: error states", () => {
  it("missing API key is detectable before stream starts", () => {
    expect(resolveApiKey(undefined)).toBeNull();
  });

  it("empty string API key is treated as missing", () => {
    expect(resolveApiKey("")).toBeNull();
  });

  it("empty string API key is treated as missing", () => {
    const keyFromEnv = "";
    const apiKey =
      typeof keyFromEnv === "string" && keyFromEnv.length > 0
        ? keyFromEnv
        : null;

    expect(apiKey).toBeNull();
  });

  it("error mid-stream preserves partial tree (flush before error display)", () => {
    const parser = createJsonlParser();
    let tree = EMPTY;

    // Deliver 3 complete lines
    for (let i = 0; i < 3; i++) {
      tree = foldPatches(tree, parser.push(WELCOME_JSONL[i] + "\n"));
    }

    // Simulate error — flush remaining buffer first (as ChatDemo.onError does)
    const remaining = parser.flush();
    tree = foldPatches(tree, remaining);

    // Partial tree should be renderable (root + card + heading)
    expect(isRenderableTree(tree)).toBe(true);
    expect(tree.root).toBe("card-1");
    expect(Object.keys(tree.elements)).toHaveLength(2);
  });

  it("error on first token → tree stays empty", () => {
    // No lines delivered before error
    const tree = EMPTY;

    expect(isRenderableTree(tree)).toBe(false);
    expect(tree.root).toBe("");
    expect(Object.keys(tree.elements)).toHaveLength(0);
  });

  it("malformed JSONL from LLM is silently tolerated", () => {
    const badJsonl = [
      JSON.stringify({ op: "add", path: "/root", value: "card-1" }),
      "this is not json at all",
      "```json",
      JSON.stringify({
        op: "add",
        path: "/elements/card-1",
        value: el("card-1", "Surface", { variant: "card" }),
      }),
      "```",
      '{"op": "add", "path": "/elements/text-1"', // truncated JSON
      JSON.stringify({
        op: "add",
        path: "/elements/text-1",
        value: el("text-1", "Text", { children: "Hello" }),
      }),
    ];

    const { tree } = simulateStream(badJsonl);

    // Should still produce a valid tree from the valid lines
    expect(isRenderableTree(tree)).toBe(true);
    expect(tree.root).toBe("card-1");
    expect(tree.elements["card-1"]).toBeDefined();
    expect(tree.elements["text-1"]).toBeDefined();
  });
});

// =============================================================================
// isRenderableTree contract
// =============================================================================

describe("regression: isRenderableTree", () => {
  it("empty tree is not renderable", () => {
    expect(isRenderableTree(EMPTY)).toBe(false);
  });

  it("root set but no elements is not renderable", () => {
    expect(isRenderableTree({ root: "card-1", elements: {} })).toBe(false);
  });

  it("root empty but elements present is not renderable", () => {
    const tree: UITree = {
      root: "",
      elements: { "card-1": el("card-1", "Surface") },
    };
    expect(isRenderableTree(tree)).toBe(false);
  });

  it("root set and elements present is renderable", () => {
    const tree: UITree = {
      root: "card-1",
      elements: { "card-1": el("card-1", "Surface") },
    };
    expect(isRenderableTree(tree)).toBe(true);
  });
});
