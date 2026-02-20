/**
 * Element validator — validates LLM-generated UIElement props against Kumo Zod schemas.
 *
 * Uses the auto-generated ComponentPropsSchemas from @cloudflare/kumo/ai/schemas.
 * Elements whose type maps to a schema get validated; types without schemas
 * (sub-components, aliases, Div) pass through unchecked.
 */

import {
  ComponentPropsSchemas,
  validateElementProps,
  type SafeParseResult,
} from "@cloudflare/kumo/ai/schemas";
import type { UIElement } from "./types";

// ---------------------------------------------------------------------------
// Type → Schema Mapping
// ---------------------------------------------------------------------------

/**
 * Maps COMPONENT_MAP type names to ComponentPropsSchemas keys.
 *
 * kumo-stream uses aliases (Textarea→InputArea, RadioGroup→Radio) and
 * compound sub-components (TableRow, SelectOption) that don't have their
 * own top-level schemas. This map resolves the indirection.
 *
 * Types not in this map AND not in ComponentPropsSchemas are skipped
 * (no schema validation = pass through).
 */
const TYPE_TO_SCHEMA_KEY: Record<
  string,
  keyof typeof ComponentPropsSchemas | null
> = {
  // Aliases — kumo-stream type → kumo schema name
  Textarea: "InputArea",
  RadioGroup: "Radio",

  // Sub-components — no top-level schema exists, skip validation
  RadioItem: null,
  SelectOption: null,
  TableHeader: null,
  TableHead: null,
  TableBody: null,
  TableRow: null,
  TableCell: null,
  TableFooter: null,
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Result of validating a single element. */
export type ElementValidationResult =
  | { readonly valid: true }
  | {
      readonly valid: false;
      readonly elementKey: string;
      readonly elementType: string;
      readonly issues: ReadonlyArray<{
        readonly path: string;
        readonly message: string;
      }>;
    };

/** Sentinel for elements that pass validation or have no schema. */
const VALID: ElementValidationResult = { valid: true } as const;

/**
 * Validate an element's props against its component schema.
 *
 * Returns `{ valid: true }` when:
 * - The element's type has a schema and props conform to it
 * - The element's type has no schema (sub-components, Div, unknown types)
 *
 * Returns `{ valid: false, ... }` only when a schema exists and props
 * fail validation.
 */
export function validateElement(element: UIElement): ElementValidationResult {
  const { type, key } = element;

  // In this demo, structural children are expressed via UIElement.children (string keys).
  // Some models also emit `props.children` arrays redundantly; those fail Kumo's
  // props schema (children expects a ReactNode-ish scalar/dynamic, not arrays).
  const elementForValidation = (() => {
    const props = element.props as Record<string, unknown>;
    if (!Array.isArray(props["children"])) return element;
    if (!Array.isArray(element.children)) return element;
    const { children: _children, ...rest } = props;
    return { ...element, props: rest };
  })();

  // Div is a synthetic container — no Kumo schema
  if (type === "Div") return VALID;

  // Check our alias/sub-component map first
  if (type in TYPE_TO_SCHEMA_KEY) {
    const mapped = TYPE_TO_SCHEMA_KEY[type];
    if (mapped === null) return VALID; // sub-component, no schema

    // Build a synthetic element with the mapped type for validateElementProps
    const syntheticElement = { ...elementForValidation, type: mapped };
    return toResult(
      key,
      type,
      validateElementProps(
        syntheticElement as Parameters<typeof validateElementProps>[0],
      ),
    );
  }

  // Direct match — type exists in ComponentPropsSchemas
  if (type in ComponentPropsSchemas) {
    return toResult(
      key,
      type,
      validateElementProps(
        elementForValidation as Parameters<typeof validateElementProps>[0],
      ),
    );
  }

  // Unknown type — no schema to validate against
  return VALID;
}

/** Convert a SafeParseResult to our ElementValidationResult. */
function toResult(
  elementKey: string,
  elementType: string,
  result: SafeParseResult<unknown>,
): ElementValidationResult {
  if (result.success) return VALID;

  const issues = result.error.issues.map((issue) => ({
    path: issue.path.map(String).join(".") || "(root)",
    message: issue.message,
  }));

  return { valid: false, elementKey, elementType, issues };
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

/**
 * Log a validation failure to the console.
 * Called by the renderer when an element fails validation.
 */
export function logValidationError(
  result: ElementValidationResult & { valid: false },
): void {
  const details = result.issues
    .map((i) => `  - ${i.path}: ${i.message}`)
    .join("\n");

  console.warn(
    `[UITreeRenderer] Validation failed for element "${result.elementKey}" (${result.elementType}):\n${details}`,
  );
}
