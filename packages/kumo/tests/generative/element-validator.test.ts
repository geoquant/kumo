import { describe, it, expect, vi, afterEach } from "vitest";
import {
  validateElement,
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
