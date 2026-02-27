/**
 * uiTreeToJsx — converts UITree structures to idiomatic JSX source code.
 *
 * Validates the full contract: normalization, import generation, prop
 * serialization, compound-component dot notation, internal-prop exclusion,
 * and edge cases (empty trees, Div synthetic type, TYPE_ALIASES).
 */

import { describe, it, expect } from "vitest";
import type { UIElement, UITree } from "@/catalog/types";
import { uiTreeToJsx } from "@/generative/ui-tree-to-jsx";

// =============================================================================
// Helpers
// =============================================================================

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

function tree(root: string, ...elements: UIElement[]): UITree {
  const map: Record<string, UIElement> = {};
  for (const e of elements) {
    map[e.key] = e;
  }
  return { root, elements: map };
}

// =============================================================================
// Empty / missing trees
// =============================================================================

describe("empty/missing trees", () => {
  it("returns null component for null tree", () => {
    const result = uiTreeToJsx(null);
    expect(result).toBe(`export function GeneratedUI() {\n  return null;\n}`);
  });

  it("returns null component for undefined tree", () => {
    const result = uiTreeToJsx(undefined);
    expect(result).toBe(`export function GeneratedUI() {\n  return null;\n}`);
  });

  it("returns null component for tree with empty elements", () => {
    const result = uiTreeToJsx({ root: "x", elements: {} });
    expect(result).toBe(`export function GeneratedUI() {\n  return null;\n}`);
  });

  it("returns null component for tree with empty root", () => {
    const result = uiTreeToJsx({ root: "", elements: {} });
    expect(result).toBe(`export function GeneratedUI() {\n  return null;\n}`);
  });

  it("uses custom component name", () => {
    const result = uiTreeToJsx(null, { componentName: "MyPage" });
    expect(result).toBe(`export function MyPage() {\n  return null;\n}`);
  });
});

// =============================================================================
// Basic rendering
// =============================================================================

describe("basic rendering", () => {
  it("renders a single self-closing element", () => {
    const t = tree("root", el("root", "Loader"));
    const result = uiTreeToJsx(t, { skipNormalization: true });
    expect(result).toContain('import { Loader } from "@cloudflare/kumo";');
    expect(result).toContain("<Loader />");
  });

  it("renders element with text children prop", () => {
    const t = tree("root", el("root", "Text", { children: "Hello world" }));
    const result = uiTreeToJsx(t, { skipNormalization: true });
    expect(result).toContain("<Text>Hello world</Text>");
  });

  it("renders element with structural children", () => {
    const t = tree(
      "stack",
      el("stack", "Stack", { gap: "md" }, ["text", "btn"]),
      el("text", "Text", { children: "Hello" }),
      el("btn", "Button", { children: "Click" }),
    );
    const result = uiTreeToJsx(t, { skipNormalization: true });
    expect(result).toContain('<Stack gap="md">');
    expect(result).toContain("<Text>Hello</Text>");
    expect(result).toContain("<Button>Click</Button>");
    expect(result).toContain("</Stack>");
  });

  it("renders nested tree: Surface > Stack > [Text, Button]", () => {
    const t = tree(
      "surface",
      el("surface", "Surface", { heading: "Settings" }, ["stack"]),
      el("stack", "Stack", { gap: "md" }, ["text", "btn"]),
      el("text", "Text", { children: "Enter your name" }),
      el("btn", "Button", { children: "Save" }),
    );
    const result = uiTreeToJsx(t, { skipNormalization: true });
    expect(result).toContain(
      'import { Button, Stack, Surface, Text } from "@cloudflare/kumo";',
    );
    expect(result).toContain('<Surface heading="Settings">');
    expect(result).toContain('<Stack gap="md">');
    expect(result).toContain("<Text>Enter your name</Text>");
    expect(result).toContain("<Button>Save</Button>");
  });
});

// =============================================================================
// Compound components (dot notation via SUB_COMPONENT_ALIASES)
// =============================================================================

describe("compound components", () => {
  it("uses dot notation for Table sub-components", () => {
    const t = tree(
      "table",
      el("table", "Table", {}, ["head", "body"]),
      el("head", "TableHead", {}, ["hrow"]),
      el("hrow", "TableRow", {}, ["hcell"]),
      el("hcell", "TableHeader", { children: "Name" }),
      el("body", "TableBody", {}, ["brow"]),
      el("brow", "TableRow", {}, ["bcell"]),
      el("bcell", "TableCell", { children: "Alice" }),
    );
    const result = uiTreeToJsx(t, { skipNormalization: true });
    expect(result).toContain("<Table.Head>");
    expect(result).toContain("<Table.Row>");
    expect(result).toContain("<Table.Header>Name</Table.Header>");
    expect(result).toContain("<Table.Body>");
    expect(result).toContain("<Table.Cell>Alice</Table.Cell>");
    // Import should be deduplicated to just "Table"
    expect(result).toContain('import { Table } from "@cloudflare/kumo";');
  });

  it("uses dot notation for Select.Option", () => {
    const t = tree(
      "sel",
      el("sel", "Select", { label: "Color" }, ["opt1", "opt2"]),
      el("opt1", "SelectOption", { children: "Red", value: "red" }),
      el("opt2", "SelectOption", { children: "Blue", value: "blue" }),
    );
    const result = uiTreeToJsx(t, { skipNormalization: true });
    expect(result).toContain("<Select.Option");
    expect(result).toContain('import { Select } from "@cloudflare/kumo";');
  });

  it("uses dot notation for Radio sub-components", () => {
    const t = tree(
      "rg",
      el("rg", "RadioGroup", { label: "Size" }, ["r1"]),
      el("r1", "RadioItem", { children: "Small", value: "sm" }),
    );
    const result = uiTreeToJsx(t, { skipNormalization: true });
    expect(result).toContain("<Radio.Group");
    expect(result).toContain("<Radio.Item");
    expect(result).toContain('import { Radio } from "@cloudflare/kumo";');
  });

  it("uses dot notation for Breadcrumbs sub-components", () => {
    const t = tree(
      "bc",
      el("bc", "Breadcrumbs", {}, ["bl", "bs", "bcur"]),
      el("bl", "BreadcrumbsLink", { children: "Home", href: "/" }),
      el("bs", "BreadcrumbsSeparator", {}),
      el("bcur", "BreadcrumbsCurrent", { children: "Settings" }),
    );
    const result = uiTreeToJsx(t, { skipNormalization: true });
    expect(result).toContain("<Breadcrumbs.Link");
    expect(result).toContain("<Breadcrumbs.Separator />");
    expect(result).toContain(
      "<Breadcrumbs.Current>Settings</Breadcrumbs.Current>",
    );
    expect(result).toContain('import { Breadcrumbs } from "@cloudflare/kumo";');
  });
});

// =============================================================================
// Imports
// =============================================================================

describe("imports", () => {
  it("deduplicates imports", () => {
    const t = tree(
      "stack",
      el("stack", "Stack", {}, ["t1", "t2"]),
      el("t1", "Text", { children: "A" }),
      el("t2", "Text", { children: "B" }),
    );
    const result = uiTreeToJsx(t, { skipNormalization: true });
    // "Text" should appear once in imports
    const importLine = result.split("\n")[0]!;
    expect(importLine).toBe('import { Stack, Text } from "@cloudflare/kumo";');
  });

  it("sorts imports alphabetically", () => {
    const t = tree(
      "stack",
      el("stack", "Stack", {}, ["btn", "text", "badge"]),
      el("btn", "Button", { children: "Go" }),
      el("text", "Text", { children: "Hi" }),
      el("badge", "Badge", { children: "New" }),
    );
    const result = uiTreeToJsx(t, { skipNormalization: true });
    const importLine = result.split("\n")[0]!;
    expect(importLine).toBe(
      'import { Badge, Button, Stack, Text } from "@cloudflare/kumo";',
    );
  });

  it("omits import line for Div-only trees", () => {
    const t = tree("root", el("root", "Div", { className: "wrapper" }));
    const result = uiTreeToJsx(t, { skipNormalization: true });
    expect(result).not.toContain("import");
    expect(result).toContain('<div className="wrapper" />');
  });
});

// =============================================================================
// Internal-only props exclusion
// =============================================================================

describe("internal props exclusion", () => {
  it("excludes action prop", () => {
    const t = tree(
      "root",
      el("root", "Button", {
        children: "Delete",
        action: { name: "delete", params: { id: "123" } },
      }),
    );
    const result = uiTreeToJsx(t, { skipNormalization: true });
    expect(result).not.toContain("action");
    expect(result).toContain("<Button>Delete</Button>");
  });

  it("excludes visible prop", () => {
    const t = tree(
      "root",
      el("root", "Text", { children: "Secret", visible: { path: "/auth" } }),
    );
    const result = uiTreeToJsx(t, { skipNormalization: true });
    expect(result).not.toContain("visible");
  });

  it("excludes parentKey prop", () => {
    const t = tree(
      "root",
      el("root", "Text", { children: "Hi", parentKey: "some-parent" }),
    );
    const result = uiTreeToJsx(t, { skipNormalization: true });
    expect(result).not.toContain("parentKey");
  });

  it("excludes key prop from props (element key is structural)", () => {
    const t = tree("root", el("root", "Text", { children: "Hi", key: "root" }));
    const result = uiTreeToJsx(t, { skipNormalization: true });
    // key= should not appear as an attribute
    expect(result).not.toMatch(/key="/);
    expect(result).not.toMatch(/key=\{/);
  });
});

// =============================================================================
// Prop serialization
// =============================================================================

describe("prop serialization", () => {
  it("serializes string props as quoted attributes", () => {
    const t = tree(
      "root",
      el("root", "Input", { label: "Email", placeholder: "you@example.com" }),
    );
    const result = uiTreeToJsx(t, { skipNormalization: true });
    expect(result).toContain('label="Email"');
    expect(result).toContain('placeholder="you@example.com"');
  });

  it("serializes boolean true as shorthand", () => {
    const t = tree(
      "root",
      el("root", "Input", { label: "Name", disabled: true }),
    );
    const result = uiTreeToJsx(t, { skipNormalization: true });
    expect(result).toContain("disabled");
    expect(result).not.toContain("disabled={true}");
  });

  it("serializes boolean false as expression", () => {
    const t = tree(
      "root",
      el("root", "Input", { label: "Name", disabled: false }),
    );
    const result = uiTreeToJsx(t, { skipNormalization: true });
    expect(result).toContain("disabled={false}");
  });

  it("serializes numbers as expressions", () => {
    const t = tree("root", el("root", "Meter", { value: 75, max: 100 }));
    const result = uiTreeToJsx(t, { skipNormalization: true });
    expect(result).toContain("value={75}");
    expect(result).toContain("max={100}");
  });

  it("omits null and undefined props", () => {
    const t = tree(
      "root",
      el("root", "Text", { children: "Hi", color: null, size: undefined }),
    );
    const result = uiTreeToJsx(t, { skipNormalization: true });
    expect(result).not.toContain("color");
    expect(result).not.toContain("size");
  });

  it("serializes string values containing double quotes", () => {
    const t = tree(
      "root",
      el("root", "Text", { children: 'She said "hello"' }),
    );
    const result = uiTreeToJsx(t, { skipNormalization: true });
    // Double quotes are valid in JSX text content — no escaping needed
    expect(result).toContain('She said "hello"');
  });
});

// =============================================================================
// Synthetic Div type
// =============================================================================

describe("Div synthetic type", () => {
  it("maps Div to <div> in output", () => {
    const t = tree(
      "root",
      el("root", "Div", { className: "container" }, ["child"]),
      el("child", "Text", { children: "Inside div" }),
    );
    const result = uiTreeToJsx(t, { skipNormalization: true });
    expect(result).toContain('<div className="container">');
    expect(result).toContain("</div>");
    // Only Text should be imported, not Div
    expect(result).toContain('import { Text } from "@cloudflare/kumo";');
  });
});

// =============================================================================
// TYPE_ALIASES (Textarea → InputArea)
// =============================================================================

describe("type aliases", () => {
  it("maps Textarea to InputArea", () => {
    const t = tree("root", el("root", "Textarea", { label: "Notes" }));
    const result = uiTreeToJsx(t, { skipNormalization: true });
    expect(result).toContain('<InputArea label="Notes" />');
    expect(result).toContain('import { InputArea } from "@cloudflare/kumo";');
    expect(result).not.toContain("Textarea");
  });
});

// =============================================================================
// 8-pass normalization
// =============================================================================

describe("normalization pipeline", () => {
  it("applies normalization by default", () => {
    // Surface with two direct children (no Stack wrapper) triggers
    // normalizeSurfaceOrphans: wraps them in a synthetic Stack.
    const t = tree(
      "surface",
      el("surface", "Surface", { heading: "Test" }, ["t1", "t2"]),
      el("t1", "Text", { children: "A" }),
      el("t2", "Text", { children: "B" }),
    );
    const result = uiTreeToJsx(t);
    // After normalization, Surface's children should be wrapped in a Stack
    expect(result).toContain("<Stack");
    expect(result).toContain(
      'import { Stack, Surface, Text } from "@cloudflare/kumo";',
    );
  });

  it("skips normalization when skipNormalization is true", () => {
    const t = tree(
      "surface",
      el("surface", "Surface", { heading: "Test" }, ["t1", "t2"]),
      el("t1", "Text", { children: "A" }),
      el("t2", "Text", { children: "B" }),
    );
    const result = uiTreeToJsx(t, { skipNormalization: true });
    // Without normalization, no injected Stack
    expect(result).not.toContain("<Stack");
  });
});

// =============================================================================
// Custom component name
// =============================================================================

describe("componentName option", () => {
  it("uses custom component name in export", () => {
    const t = tree("root", el("root", "Text", { children: "Hi" }));
    const result = uiTreeToJsx(t, {
      componentName: "SettingsPage",
      skipNormalization: true,
    });
    expect(result).toContain("export function SettingsPage()");
    expect(result).not.toContain("GeneratedUI");
  });
});

// =============================================================================
// Output structure validation
// =============================================================================

describe("output structure", () => {
  it("produces valid JSX function component structure", () => {
    const t = tree(
      "surface",
      el("surface", "Surface", { heading: "Form" }, ["input"]),
      el("input", "Input", { label: "Email" }),
    );
    const result = uiTreeToJsx(t, { skipNormalization: true });

    // Has import
    expect(result).toMatch(/^import \{.*\} from "@cloudflare\/kumo";/);
    // Has function export
    expect(result).toContain("export function GeneratedUI()");
    // Has return with JSX
    expect(result).toContain("return (");
    // Properly closed
    expect(result).toMatch(/\n  \);\n\}$/);
  });

  it("skips children elements that are missing from tree", () => {
    const t = tree(
      "stack",
      el("stack", "Stack", {}, ["exists", "missing"]),
      el("exists", "Text", { children: "I exist" }),
      // "missing" element not provided
    );
    const result = uiTreeToJsx(t, { skipNormalization: true });
    expect(result).toContain("<Text>I exist</Text>");
    // Should not crash, just skip the missing child
    expect(result).not.toContain("missing");
  });
});
