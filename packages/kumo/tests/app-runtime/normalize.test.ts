import { describe, expect, it } from "vitest";

import {
  APP_SPEC_VERSION,
  flattenNestedAppSpec,
  normalizeAppSpec,
  repairAppSpec,
} from "../../src/app-runtime";

describe("app runtime normalize and repair", () => {
  it("flattens nested authoring input into AppSpec", () => {
    const spec = flattenNestedAppSpec({
      root: {
        key: "screen",
        type: "Stack",
        children: [
          {
            type: "Text",
            props: { children: "Hello" },
          },
          {
            key: "cta",
            type: "Button",
            props: { children: "Save" },
          },
        ],
      },
      state: { count: 1 },
    });

    expect(spec).toEqual({
      version: APP_SPEC_VERSION,
      root: "screen",
      state: { count: 1 },
      elements: {
        screen: {
          key: "screen",
          type: "Stack",
          children: ["text-1", "cta"],
        },
        "text-1": {
          key: "text-1",
          type: "Text",
          props: { children: "Hello" },
        },
        cta: {
          key: "cta",
          type: "Button",
          props: { children: "Save" },
        },
      },
    });
  });

  it("normalizes flat specs and repairs missing references before render", () => {
    const normalized = normalizeAppSpec({
      version: APP_SPEC_VERSION,
      root: "missing",
      state: {},
      elements: {
        shell: {
          key: "wrong-key",
          type: "Stack",
          children: ["existing", "missing-child", "shell"],
        },
        existing: {
          key: "existing",
          type: "Text",
          props: { children: "Hi" },
        },
      },
    });

    const repaired = repairAppSpec(normalized);

    expect(repaired.repaired).toBe(true);
    expect(repaired.spec.root).toBe("shell");
    expect(repaired.spec.elements.shell).toEqual({
      key: "shell",
      type: "Stack",
      children: ["existing"],
    });
    expect(repaired.issues.map((issue) => issue.kind)).toEqual([
      "missing-child",
      "missing-child",
      "mismatched-key",
      "missing-root",
    ]);
  });
});
