import type { UITree } from "@cloudflare/kumo/streaming";

export function buildVerifierJsonl(tree: UITree): string {
  return [
    JSON.stringify({ op: "replace", path: "/root", value: tree.root }),
    JSON.stringify({
      op: "replace",
      path: "/elements",
      value: tree.elements,
    }),
  ].join("\n");
}

export function buildVerifierSse(tokens: readonly string[]): string {
  return `${tokens
    .map(
      (token) =>
        `data: ${JSON.stringify({ choices: [{ delta: { content: token } }] })}\n\n`,
    )
    .join("")}data: [DONE]\n\n`;
}

export function buildHealthyVerifierTree(): UITree {
  return {
    root: "surface",
    elements: {
      surface: {
        key: "surface",
        type: "Surface",
        props: {},
        children: ["stack"],
      },
      stack: {
        key: "stack",
        type: "Stack",
        props: { gap: "base" },
        parentKey: "surface",
        children: ["heading", "subheading", "badge"],
      },
      heading: {
        key: "heading",
        type: "Text",
        props: { children: "Kumo", variant: "heading1" },
        parentKey: "stack",
      },
      subheading: {
        key: "subheading",
        type: "Text",
        props: { children: "Verifier", variant: "heading2" },
        parentKey: "stack",
      },
      badge: {
        key: "badge",
        type: "Badge",
        props: { children: "Healthy", variant: "success" },
        parentKey: "stack",
      },
    },
  };
}

export function buildMalformedVerifierTree(): UITree {
  return {
    root: "table",
    elements: {
      table: {
        key: "table",
        type: "Table",
        props: {},
        children: ["head"],
      },
      head: {
        key: "head",
        type: "TableHead",
        props: { children: "Header" },
        parentKey: "table",
      },
    },
  };
}

export function buildRepairWarnVerifierTree(): UITree {
  return {
    root: "surface",
    elements: {
      surface: {
        key: "surface",
        type: "Surface",
        props: {},
        children: ["stack"],
      },
      stack: {
        key: "stack",
        type: "Stack",
        props: { gap: "medium" },
        parentKey: "surface",
        children: ["heading"],
      },
      heading: {
        key: "heading",
        type: "Text",
        props: { children: "Kumo", variant: "heading1" },
        parentKey: "stack",
      },
    },
  };
}

export function buildNonRenderableVerifierTree(): UITree {
  return {
    root: "ghost-root",
    elements: {},
  };
}

export function buildExcessiveRepairVerifierTree(): UITree {
  return {
    root: "surface",
    elements: {
      surface: {
        key: "surface",
        type: "Surface",
        props: {},
        children: ["stack-a", "stack-b"],
      },
      "stack-a": {
        key: "stack-a",
        type: "Stack",
        props: { gap: "medium" },
        parentKey: "surface",
        children: ["heading-a"],
      },
      "heading-a": {
        key: "heading-a",
        type: "Text",
        props: { children: "A", variant: "heading2" },
        parentKey: "stack-a",
      },
      "stack-b": {
        key: "stack-b",
        type: "Stack",
        props: { gap: "medium" },
        parentKey: "surface",
        children: ["heading-b"],
      },
      "heading-b": {
        key: "heading-b",
        type: "Text",
        props: { children: "B", variant: "heading2" },
        parentKey: "stack-b",
      },
    },
  };
}
