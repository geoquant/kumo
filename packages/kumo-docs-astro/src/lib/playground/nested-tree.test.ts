import { describe, expect, it } from "vitest";

import { buildNestedTree } from "~/lib/playground/nested-tree";

describe("buildNestedTree", () => {
  it("builds a nested tree with props, actions, and children", () => {
    const tree = {
      root: "root",
      elements: {
        root: {
          key: "root",
          type: "Surface",
          props: { heading: "Hello" },
          children: ["body", "cta"],
        },
        body: {
          key: "body",
          type: "Text",
          props: { children: "Body" },
        },
        cta: {
          key: "cta",
          type: "Button",
          props: { children: "Open" },
          action: { name: "navigate", params: { url: "/docs" } },
        },
      },
    };

    expect(buildNestedTree(tree)).toEqual({
      key: "root",
      type: "Surface",
      props: { heading: "Hello" },
      action: null,
      children: [
        {
          key: "body",
          type: "Text",
          props: { children: "Body" },
          action: null,
          children: [],
        },
        {
          key: "cta",
          type: "Button",
          props: { children: "Open" },
          action: { name: "navigate", params: { url: "/docs" } },
          children: [],
        },
      ],
    });
  });

  it("returns null for empty trees and ignores cycles", () => {
    expect(buildNestedTree({ root: "", elements: {} })).toBeNull();

    const cyclicalTree = {
      root: "root",
      elements: {
        root: {
          key: "root",
          type: "Surface",
          props: {},
          children: ["child"],
        },
        child: {
          key: "child",
          type: "Stack",
          props: {},
          children: ["root"],
        },
      },
    };

    expect(buildNestedTree(cyclicalTree)).toEqual({
      key: "root",
      type: "Surface",
      props: {},
      action: null,
      children: [
        {
          key: "child",
          type: "Stack",
          props: {},
          action: null,
          children: [],
        },
      ],
    });
  });
});
