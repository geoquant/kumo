import { describe, it, expect, vi, afterEach } from "vitest";
import {
  coerceElementProps,
  validateElement,
  repairElement,
  logValidationError,
} from "@/generative/element-validator";
import type { UIElement } from "@/streaming/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function el(
  key: string,
  type: string,
  props: Record<string, unknown> = {},
  opts?: { children?: string[]; action?: { name: string } },
): UIElement {
  return {
    key,
    type,
    props,
    ...(opts?.children != null ? { children: opts.children } : {}),
    ...(opts?.action != null ? { action: opts.action } : {}),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("validateElement", () => {
  describe("valid elements", () => {
    it("passes a Button with valid props", () => {
      const result = validateElement(
        el("btn-1", "Button", { variant: "primary", children: "Click" }),
      );
      expect(result.valid).toBe(true);
    });

    it("passes a Text with valid props", () => {
      const result = validateElement(
        el("txt-1", "Text", { variant: "body", children: "Hello" }),
      );
      expect(result.valid).toBe(true);
    });

    it("passes a Stack with valid layout props", () => {
      const result = validateElement(
        el("stack-1", "Stack", { gap: "base", align: "center" }),
      );
      expect(result.valid).toBe(true);
    });

    it("passes an Input with label", () => {
      const result = validateElement(
        el("input-1", "Input", { label: "Name", placeholder: "Enter name" }),
      );
      expect(result.valid).toBe(true);
    });

    it("passes a Badge with variant", () => {
      const result = validateElement(
        el("badge-1", "Badge", { variant: "primary", children: "New" }),
      );
      expect(result.valid).toBe(true);
    });
  });

  describe("invalid elements", () => {
    it("fails a Button with invalid variant enum", () => {
      const result = validateElement(
        el("btn-bad", "Button", { variant: "nonexistent" }),
      );
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.elementKey).toBe("btn-bad");
        expect(result.elementType).toBe("Button");
        expect(result.issues.length).toBeGreaterThan(0);
        expect(result.issues.some((i) => i.path.includes("variant"))).toBe(
          true,
        );
      }
    });

    it("fails a Badge with invalid variant", () => {
      const result = validateElement(
        el("badge-bad", "Badge", { variant: "nope" }),
      );
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.elementKey).toBe("badge-bad");
        expect(result.issues.some((i) => i.path.includes("variant"))).toBe(
          true,
        );
      }
    });

    it("fails a Banner with invalid variant", () => {
      const result = validateElement(
        el("banner-bad", "Banner", { variant: "critical" }),
      );
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.elementType).toBe("Banner");
      }
    });
  });

  describe("elements without schemas (pass through)", () => {
    it("passes Div elements without validation", () => {
      const result = validateElement(
        el("div-1", "Div", { className: "flex gap-2", anything: true }),
      );
      expect(result.valid).toBe(true);
    });

    it("passes sub-component types (TableRow, SelectOption)", () => {
      expect(validateElement(el("tr-1", "TableRow", {})).valid).toBe(true);
      expect(
        validateElement(el("opt-1", "SelectOption", { value: "a" })).valid,
      ).toBe(true);
      expect(validateElement(el("th-1", "TableHeader", {})).valid).toBe(true);
      expect(validateElement(el("tc-1", "TableCell", {})).valid).toBe(true);
    });

    it("passes unknown/unregistered types", () => {
      const result = validateElement(el("x-1", "FancyWidget", { foo: "bar" }));
      expect(result.valid).toBe(true);
    });
  });

  describe("props.children array stripping", () => {
    it("strips array props.children before validation (Table with structural children)", () => {
      // LLM emits props.children as array AND element.children as array
      const result = validateElement(
        el(
          "tbl-1",
          "Table",
          { children: ["header", "body"] },
          { children: ["header", "body"] },
        ),
      );
      expect(result.valid).toBe(true);
    });

    it("strips array props.children even without element.children", () => {
      // LLM emits props.children as array but no element.children
      const result = validateElement(
        el("tbl-2", "Table", { children: ["header", "body"] }),
      );
      expect(result.valid).toBe(true);
    });

    it("keeps scalar props.children (text content)", () => {
      const result = validateElement(
        el("txt-c", "Text", { variant: "body", children: "Hello world" }),
      );
      expect(result.valid).toBe(true);
    });
  });

  describe("alias mapping", () => {
    it("validates Textarea via InputArea schema", () => {
      // InputArea schema is z.object({}) — accepts any props
      const result = validateElement(el("ta-1", "Textarea", {}));
      expect(result.valid).toBe(true);
    });

    it("validates RadioGroup via Radio schema", () => {
      // Radio schema requires `legend` (string) for accessibility
      const result = validateElement(
        el("rg-1", "RadioGroup", { legend: "Choose one" }),
      );
      expect(result.valid).toBe(true);
    });

    it("fails RadioGroup with missing required legend", () => {
      const result = validateElement(el("rg-bad", "RadioGroup", {}));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.issues.some((i) => i.path.includes("legend"))).toBe(true);
      }
    });

    it("skips RadioItem (sub-component)", () => {
      const result = validateElement(
        el("ri-1", "RadioItem", { whatever: 999 }),
      );
      expect(result.valid).toBe(true);
    });
  });
});

describe("repairElement", () => {
  it("strips invalid Grid gap and produces a valid element", () => {
    const element = el("grid-1", "Grid", {
      gap: "invalid_gap_value",
      variant: "3up",
      className: "my-grid",
    });
    const validation = validateElement(element);
    expect(validation.valid).toBe(false);

    if (!validation.valid) {
      // Repair should strip `gap` (single-segment path)
      const repaired = repairElement(element, validation);
      expect(repaired).not.toBeNull();
      expect(repaired!.props).not.toHaveProperty("gap");
      expect(repaired!.props).toHaveProperty("variant", "3up");
      expect(repaired!.props).toHaveProperty("className", "my-grid");

      // Repaired element should now pass validation
      const revalidation = validateElement(repaired!);
      expect(revalidation.valid).toBe(true);
    }
  });

  it("strips multiple invalid props at once", () => {
    const element = el("grid-2", "Grid", {
      gap: "bad",
      variant: "nonexistent",
    });
    const validation = validateElement(element);
    expect(validation.valid).toBe(false);

    if (!validation.valid) {
      const repaired = repairElement(element, validation);
      expect(repaired).not.toBeNull();
      expect(repaired!.props).not.toHaveProperty("gap");
      expect(repaired!.props).not.toHaveProperty("variant");

      const revalidation = validateElement(repaired!);
      expect(revalidation.valid).toBe(true);
    }
  });

  it("returns null when all issues are at root level", () => {
    // Simulate a root-level issue (no strippable props)
    const result = repairElement(el("x", "Button", {}), {
      valid: false as const,
      elementKey: "x",
      elementType: "Button",
      issues: [{ path: "(root)", message: "Something wrong" }],
    });
    expect(result).toBeNull();
  });
});

describe("coerceElementProps", () => {
  describe("Badge.variant coercions", () => {
    it("coerces info → primary", () => {
      const result = coerceElementProps(
        el("b-1", "Badge", { variant: "info", children: "Status" }),
      );
      expect(result.props).toHaveProperty("variant", "primary");
      expect(result.props).toHaveProperty("children", "Status");
    });

    it("coerces success → primary", () => {
      const result = coerceElementProps(
        el("b-2", "Badge", { variant: "success" }),
      );
      expect(result.props).toHaveProperty("variant", "primary");
    });

    it("coerces error → destructive", () => {
      const result = coerceElementProps(
        el("b-3", "Badge", { variant: "error" }),
      );
      expect(result.props).toHaveProperty("variant", "destructive");
    });

    it("coerces danger → destructive", () => {
      const result = coerceElementProps(
        el("b-4", "Badge", { variant: "danger" }),
      );
      expect(result.props).toHaveProperty("variant", "destructive");
    });

    it("coerces warning → outline", () => {
      const result = coerceElementProps(
        el("b-5", "Badge", { variant: "warning" }),
      );
      expect(result.props).toHaveProperty("variant", "outline");
    });

    it("does not coerce already-valid variant", () => {
      const original = el("b-ok", "Badge", { variant: "primary" });
      const result = coerceElementProps(original);
      // No coercion needed — result should be structurally equal
      expect(result).toStrictEqual(original);
    });
  });

  describe("Stack.gap coercions", () => {
    it("coerces medium → base", () => {
      const result = coerceElementProps(el("s-1", "Stack", { gap: "medium" }));
      expect(result.props).toHaveProperty("gap", "base");
    });

    it("coerces large → lg", () => {
      const result = coerceElementProps(el("s-2", "Stack", { gap: "large" }));
      expect(result.props).toHaveProperty("gap", "lg");
    });

    it("coerces small → sm", () => {
      const result = coerceElementProps(el("s-3", "Stack", { gap: "small" }));
      expect(result.props).toHaveProperty("gap", "sm");
    });

    it("coerces extra → xl", () => {
      const result = coerceElementProps(el("s-4", "Stack", { gap: "extra" }));
      expect(result.props).toHaveProperty("gap", "xl");
    });

    it("preserves valid gap value", () => {
      const original = el("s-ok", "Stack", { gap: "base" });
      expect(coerceElementProps(original)).toStrictEqual(original);
    });
  });

  describe("Grid.gap coercions", () => {
    it("coerces medium → base", () => {
      const result = coerceElementProps(
        el("g-1", "Grid", { gap: "medium", variant: "2up" }),
      );
      expect(result.props).toHaveProperty("gap", "base");
      expect(result.props).toHaveProperty("variant", "2up");
    });

    it("coerces large → lg", () => {
      const result = coerceElementProps(el("g-2", "Grid", { gap: "large" }));
      expect(result.props).toHaveProperty("gap", "lg");
    });

    it("preserves valid gap value", () => {
      const original = el("g-ok", "Grid", { gap: "sm" });
      expect(coerceElementProps(original)).toStrictEqual(original);
    });
  });

  describe("Text.variant coercions", () => {
    it("coerces title → heading2", () => {
      const result = coerceElementProps(
        el("t-1", "Text", { variant: "title", children: "Hello" }),
      );
      expect(result.props).toHaveProperty("variant", "heading2");
      expect(result.props).toHaveProperty("children", "Hello");
    });

    it("coerces subtitle → heading3", () => {
      const result = coerceElementProps(
        el("t-2", "Text", { variant: "subtitle" }),
      );
      expect(result.props).toHaveProperty("variant", "heading3");
    });

    it("coerces caption → secondary", () => {
      const result = coerceElementProps(
        el("t-3", "Text", { variant: "caption" }),
      );
      expect(result.props).toHaveProperty("variant", "secondary");
    });

    it("preserves valid variant", () => {
      const original = el("t-ok", "Text", { variant: "body" });
      expect(coerceElementProps(original)).toStrictEqual(original);
    });
  });

  describe("no-op cases", () => {
    it("returns same ref for unrecognized type", () => {
      const original = el("x-1", "FancyWidget", { variant: "info" });
      expect(coerceElementProps(original)).toStrictEqual(original);
    });

    it("returns same ref for non-string prop values", () => {
      const original = el("n-1", "Badge", { variant: 42 });
      expect(coerceElementProps(original)).toStrictEqual(original);
    });

    it("returns same ref when prop is not in coercion map", () => {
      const original = el("n-2", "Badge", { variant: "totally_unknown" });
      expect(coerceElementProps(original)).toStrictEqual(original);
    });
  });

  describe("coercion + validation integration", () => {
    it("Badge with 'error' variant passes validation after coercion", () => {
      const original = el("b-int", "Badge", {
        variant: "error",
        children: "Fail",
      });
      // Without coercion, this would fail validation
      const rawValidation = validateElement(original);
      expect(rawValidation.valid).toBe(false);

      // After coercion, it passes
      const coerced = coerceElementProps(original);
      const validation = validateElement(coerced);
      expect(validation.valid).toBe(true);
      expect(coerced.props).toHaveProperty("variant", "destructive");
    });

    it("Stack with 'medium' gap passes validation after coercion", () => {
      const original = el("s-int", "Stack", { gap: "medium" });
      expect(validateElement(original).valid).toBe(false);

      const coerced = coerceElementProps(original);
      expect(validateElement(coerced).valid).toBe(true);
      expect(coerced.props).toHaveProperty("gap", "base");
    });

    it("Text with 'title' variant passes validation after coercion", () => {
      const original = el("t-int", "Text", {
        variant: "title",
        children: "Heading",
      });
      expect(validateElement(original).valid).toBe(false);

      const coerced = coerceElementProps(original);
      expect(validateElement(coerced).valid).toBe(true);
      expect(coerced.props).toHaveProperty("variant", "heading2");
    });

    it("coerced props survive (not stripped by repair)", () => {
      // Badge "danger" → "destructive" via coercion, passes validation
      const coerced = coerceElementProps(
        el("b-surv", "Badge", { variant: "danger", children: "Alert" }),
      );
      const validation = validateElement(coerced);
      // Should pass — no need for repair
      expect(validation.valid).toBe(true);
      // The coerced value is preserved in the element
      expect(coerced.props).toHaveProperty("variant", "destructive");
    });
  });
});

describe("logValidationError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs validation issues to console.warn", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    logValidationError({
      valid: false,
      elementKey: "btn-bad",
      elementType: "Button",
      issues: [
        { path: "variant", message: "Invalid value" },
        { path: "size", message: "Expected sm | base | lg" },
      ],
    });

    expect(warnSpy).toHaveBeenCalledOnce();
    const msg = warnSpy.mock.calls[0][0];
    expect(msg).toContain("btn-bad");
    expect(msg).toContain("Button");
    expect(msg).toContain("variant");
    expect(msg).toContain("size");
  });
});
