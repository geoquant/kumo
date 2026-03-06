import { describe, expect, it } from "vitest";
import {
  collectSpreadAttributeStrings,
  collectStringLiterals,
  isConsumerSurfaceFile,
  isTermCallee,
  isTextBearingAttributeName,
} from "../../lint/no-unlocalized-strings.js";

describe("no-unlocalized-strings scope", () => {
  it("includes consumer components", () => {
    expect(
      isConsumerSurfaceFile(
        "/repo/packages/kumo/src/components/button/button.tsx",
      ),
    ).toBe(true);
  });

  it("includes installable blocks", () => {
    expect(
      isConsumerSurfaceFile(
        "/repo/packages/kumo/src/blocks/delete-resource/delete-resource.tsx",
      ),
    ).toBe(true);
  });

  it("includes code entrypoint components", () => {
    expect(
      isConsumerSurfaceFile(
        "/repo/packages/kumo/src/code/code-highlighted.tsx",
      ),
    ).toBe(true);
  });

  it("excludes non-consumer surfaces", () => {
    expect(
      isConsumerSurfaceFile(
        "/repo/packages/kumo/src/command-line/commands/add.ts",
      ),
    ).toBe(false);
  });

  it("excludes tests and stories", () => {
    expect(
      isConsumerSurfaceFile(
        "/repo/packages/kumo/src/components/button/button.test.tsx",
      ),
    ).toBe(false);
    expect(
      isConsumerSurfaceFile(
        "/repo/packages/kumo/src/components/button/button.stories.tsx",
      ),
    ).toBe(false);
  });
});

describe("no-unlocalized-strings attribute detection", () => {
  it("includes clear text-bearing attributes", () => {
    expect(isTextBearingAttributeName("aria-label")).toBe(true);
    expect(isTextBearingAttributeName("aria-valuetext")).toBe(true);
    expect(isTextBearingAttributeName("label")).toBe(true);
    expect(isTextBearingAttributeName("helperText")).toBe(true);
  });

  it("excludes non-text structural attributes", () => {
    expect(isTextBearingAttributeName("className")).toBe(false);
    expect(isTextBearingAttributeName("aria-hidden")).toBe(false);
    expect(isTextBearingAttributeName("aria-labelledby")).toBe(false);
    expect(isTextBearingAttributeName("data-testid")).toBe(false);
    expect(isTextBearingAttributeName("onClick")).toBe(false);
  });

  it("does not blanket-ignore non-event on* text props", () => {
    expect(isTextBearingAttributeName("onboardingText")).toBe(true);
  });
});

describe("no-unlocalized-strings expression helpers", () => {
  it("treats direct term() and localize.term() as localized", () => {
    expect(isTermCallee({ type: "Identifier", name: "term" })).toBe(true);
    expect(
      isTermCallee({
        type: "MemberExpression",
        computed: false,
        property: { type: "Identifier", name: "term" },
      }),
    ).toBe(true);
    expect(
      isTermCallee({
        type: "MemberExpression",
        computed: true,
        property: { type: "Literal", value: "term" },
      }),
    ).toBe(false);
  });

  it("only ignores direct term() call arguments", () => {
    const collected: string[] = [];

    collectStringLiterals(
      {
        type: "CallExpression",
        callee: {
          type: "Identifier",
          name: "term",
        },
        arguments: [{ type: "Literal", value: "Delete" }],
      },
      collected,
    );

    expect(collected).toEqual([]);
  });

  it("ignores member .term() call arguments", () => {
    const collected: string[] = [];

    collectStringLiterals(
      {
        type: "CallExpression",
        callee: {
          type: "MemberExpression",
          computed: false,
          property: { type: "Identifier", name: "term" },
        },
        arguments: [{ type: "Literal", value: "Delete" }],
      },
      collected,
    );

    expect(collected).toEqual([]);
  });

  it("collects literals from logical expressions", () => {
    const collected: string[] = [];

    collectStringLiterals(
      {
        type: "LogicalExpression",
        left: { type: "Identifier", name: "isOpen" },
        right: { type: "Literal", value: "Delete" },
      },
      collected,
    );

    expect(collected).toEqual(["Delete"]);
  });

  it("does not collect literals used only in comparisons", () => {
    const collected: string[] = [];

    collectStringLiterals(
      {
        type: "BinaryExpression",
        operator: "===",
        left: { type: "Identifier", name: "controls" },
        right: { type: "Literal", value: "full" },
      },
      collected,
    );

    expect(collected).toEqual([]);
  });

  it("collects literals from function arguments", () => {
    const collected: string[] = [];

    collectStringLiterals(
      {
        type: "CallExpression",
        callee: { type: "Identifier", name: "formatLabel" },
        arguments: [{ type: "Literal", value: "Delete" }],
      },
      collected,
    );

    expect(collected).toEqual(["Delete"]);
  });

  it("collects text-bearing literals from JSX spread object props", () => {
    const collected: string[] = [];

    collectSpreadAttributeStrings(
      {
        type: "ObjectExpression",
        properties: [
          {
            type: "Property",
            computed: false,
            key: { type: "Identifier", name: "title" },
            value: { type: "Literal", value: "Delete" },
          },
          {
            type: "Property",
            computed: false,
            key: { type: "Identifier", name: "className" },
            value: { type: "Literal", value: "btn-danger" },
          },
        ],
      },
      collected,
    );

    expect(collected).toEqual(["Delete"]);
  });
});
