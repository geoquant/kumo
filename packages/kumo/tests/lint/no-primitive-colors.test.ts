import { describe, expect, it, vi } from "vitest";

import {
  findForbiddenCssValue,
  noPrimitiveColorsRule,
} from "../../lint/no-primitive-colors.js";

interface Report {
  node: unknown;
  messageId: string;
  data?: Record<string, unknown>;
}

function createMockContext() {
  const reports: Report[] = [];

  return {
    report: vi.fn((report: Report) => reports.push(report)),
    getReports: () => reports,
  };
}

function createClassAttributeNode(value: string) {
  return {
    type: "JSXAttribute",
    name: { type: "JSXIdentifier", name: "className" },
    value: {
      type: "Literal",
      value,
    },
  };
}

function hasJsxAttributeVisitor(
  value: unknown,
): value is {
  JSXAttribute(node: ReturnType<typeof createClassAttributeNode>): void;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "JSXAttribute" in value &&
    typeof value.JSXAttribute === "function"
  );
}

describe("no-primitive-colors", () => {
  it("detects forbidden light-dark usage", () => {
    expect(
      findForbiddenCssValue(
        "text-[light-dark(var(--color-amber-700),var(--color-amber-500))]",
      ),
    ).toBe("light-dark(");
  });

  it("detects forbidden raw semantic css variable usage", () => {
    expect(findForbiddenCssValue("bg-[var(--color-kumo-base)]")).toBe(
      "var(--color-kumo-base",
    );
    expect(findForbiddenCssValue("text-[var(--text-color-kumo-default)]")).toBe(
      "var(--text-color-kumo-default",
    );
  });

  it("reports forbidden css values in class strings", () => {
    const context = createMockContext();
    const createOnce = Reflect.get(noPrimitiveColorsRule, "createOnce");

    if (typeof createOnce !== "function") {
      throw new Error("Expected rule to expose createOnce");
    }

    const rule = createOnce(context);

    if (!hasJsxAttributeVisitor(rule)) {
      throw new Error("Expected rule visitor to expose JSXAttribute");
    }

    rule.JSXAttribute(
      createClassAttributeNode(
        "[&_[data-toast-icon]]:text-[light-dark(var(--color-amber-700),var(--color-amber-500))]",
      ),
    );

    const reports = context.getReports();
    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("forbiddenCssValue");
    expect(reports[0]?.data?.value).toBe("light-dark(");
  });
});
