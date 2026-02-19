/**
 * RFC 6902 JSON Patch operations applied to UITree (Spec).
 *
 * Subset: only add/replace/remove. No move/copy/test.
 * Every applyPatch call returns a new shallow copy — input is never mutated.
 *
 * JSON Pointer paths follow RFC 6901:
 *   /root          → tree.root
 *   /elements/key  → tree.elements[key]
 *   /elements/key/children/- → append to children array
 */

import type { UITree, UIElement } from "./types";

// =============================================================================
// Types
// =============================================================================

export interface JsonPatchOp {
  readonly op: "add" | "replace" | "remove";
  readonly path: string;
  readonly value?: unknown;
}

// =============================================================================
// Internal type helpers
// =============================================================================

/**
 * Loosely-typed record for navigating nested structures.
 * UIElement is an interface without an index signature, so we convert
 * at the boundary and convert back when storing into the elements map.
 */
type AnyRecord = { [k: string]: unknown };

function toRecord(el: UIElement): AnyRecord {
  return el as unknown as AnyRecord;
}

function toElement(rec: AnyRecord): UIElement {
  return rec as unknown as UIElement;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Apply a single RFC 6902 patch operation to a UITree.
 * Returns a new shallow copy — never mutates the input.
 */
export function applyPatch(spec: UITree, patch: JsonPatchOp): UITree {
  const segments = parsePath(patch.path);

  switch (patch.op) {
    case "add":
      return applyAdd(spec, segments, patch.value);
    case "replace":
      return applyReplace(spec, segments, patch.value);
    case "remove":
      return applyRemove(spec, segments);
  }
}

/**
 * Parse a single JSONL line into a JsonPatchOp.
 * Returns null for invalid JSON or missing required fields.
 */
export function parsePatchLine(line: string): JsonPatchOp | null {
  const trimmed = line.trim();
  if (trimmed === "") return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj.op !== "string" || typeof obj.path !== "string") {
    return null;
  }

  const op = obj.op;
  if (op !== "add" && op !== "replace" && op !== "remove") {
    return null;
  }

  // add and replace require a value field; remove does not
  if ((op === "add" || op === "replace") && !("value" in obj)) {
    return null;
  }

  return { op, path: obj.path, value: obj.value };
}

// =============================================================================
// Path parsing
// =============================================================================

/** Parse a JSON Pointer path into segments. Leading "/" is stripped. */
function parsePath(path: string): string[] {
  if (path === "" || path === "/") return [];
  const raw = path.startsWith("/") ? path.slice(1) : path;
  // RFC 6901: ~1 → /, ~0 → ~
  return raw.split("/").map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
}

// =============================================================================
// Operation implementations
// =============================================================================

function applyAdd(spec: UITree, segments: string[], value: unknown): UITree {
  if (segments.length === 0) {
    return { ...spec };
  }

  const [first, ...rest] = segments;

  if (first === "root") {
    return { ...spec, root: value as string };
  }

  if (first === "elements") {
    return addToElements(spec, rest, value);
  }

  return { ...spec, [first as string]: value };
}

function addToElements(
  spec: UITree,
  segments: string[],
  value: unknown,
): UITree {
  if (segments.length === 0) {
    return { ...spec, elements: value as UITree["elements"] };
  }

  const [key, ...rest] = segments;

  if (rest.length === 0) {
    return {
      ...spec,
      elements: {
        ...spec.elements,
        [key as string]: value as UIElement,
      },
    };
  }

  // Nested path within an element, e.g. /elements/{key}/children/-
  const existing = spec.elements[key as string];
  if (existing === undefined) {
    return { ...spec };
  }

  const updated = setNestedValue(toRecord(existing), rest, value);
  return {
    ...spec,
    elements: { ...spec.elements, [key as string]: toElement(updated) },
  };
}

/**
 * Immutably set a value at a nested path within a record.
 * Handles the /- array-append convention from RFC 6902.
 */
function setNestedValue(
  obj: AnyRecord,
  segments: string[],
  value: unknown,
): AnyRecord {
  if (segments.length === 0) return obj;

  const [head, ...tail] = segments;

  if (tail.length === 0) {
    if (head === "-") {
      // /- at top level of an object — not meaningful
      return { ...obj };
    }
    return { ...obj, [head as string]: value };
  }

  // /prop/- → append to array at prop
  if (tail.length === 1 && tail[0] === "-") {
    const current = obj[head as string];
    const arr = Array.isArray(current) ? current : [];
    return { ...obj, [head as string]: [...arr, value] };
  }

  // Recurse into nested object
  const current = obj[head as string];
  if (
    typeof current === "object" &&
    current !== null &&
    !Array.isArray(current)
  ) {
    const updated = setNestedValue(current as AnyRecord, tail, value);
    return { ...obj, [head as string]: updated };
  }

  return { ...obj };
}

function applyReplace(
  spec: UITree,
  segments: string[],
  value: unknown,
): UITree {
  if (segments.length === 0) {
    return value as UITree;
  }

  const [first, ...rest] = segments;

  if (first === "root") {
    return { ...spec, root: value as string };
  }

  if (first === "elements") {
    return replaceInElements(spec, rest, value);
  }

  return { ...spec, [first as string]: value };
}

function replaceInElements(
  spec: UITree,
  segments: string[],
  value: unknown,
): UITree {
  if (segments.length === 0) {
    return { ...spec, elements: value as UITree["elements"] };
  }

  const [key, ...rest] = segments;

  if (rest.length === 0) {
    return {
      ...spec,
      elements: {
        ...spec.elements,
        [key as string]: value as UIElement,
      },
    };
  }

  const existing = spec.elements[key as string];
  if (existing === undefined) return { ...spec };

  const updated = replaceNestedValue(toRecord(existing), rest, value);
  return {
    ...spec,
    elements: { ...spec.elements, [key as string]: toElement(updated) },
  };
}

function replaceNestedValue(
  obj: AnyRecord,
  segments: string[],
  value: unknown,
): AnyRecord {
  if (segments.length === 0) return value as AnyRecord;

  const [head, ...tail] = segments;

  if (tail.length === 0) {
    return { ...obj, [head as string]: value };
  }

  const current = obj[head as string];
  if (
    typeof current === "object" &&
    current !== null &&
    !Array.isArray(current)
  ) {
    const updated = replaceNestedValue(current as AnyRecord, tail, value);
    return { ...obj, [head as string]: updated };
  }

  return { ...obj };
}

function applyRemove(spec: UITree, segments: string[]): UITree {
  if (segments.length === 0) {
    return { root: "", elements: {} };
  }

  const [first, ...rest] = segments;

  if (first === "root") {
    return { ...spec, root: "" };
  }

  if (first === "elements") {
    return removeFromElements(spec, rest);
  }

  if (!((first as string) in spec)) return { ...spec };

  const copy = { ...spec };
  delete (copy as AnyRecord)[first as string];
  return copy;
}

function removeFromElements(spec: UITree, segments: string[]): UITree {
  if (segments.length === 0) {
    return { ...spec, elements: {} };
  }

  const [key, ...rest] = segments;

  if (rest.length === 0) {
    if (!((key as string) in spec.elements)) return { ...spec };

    const elements = { ...spec.elements };
    delete elements[key as string];
    return { ...spec, elements };
  }

  const existing = spec.elements[key as string];
  if (existing === undefined) return { ...spec };

  const updated = removeNestedValue(toRecord(existing), rest);
  return {
    ...spec,
    elements: { ...spec.elements, [key as string]: toElement(updated) },
  };
}

function removeNestedValue(obj: AnyRecord, segments: string[]): AnyRecord {
  if (segments.length === 0) return obj;

  const [head, ...tail] = segments;

  if (tail.length === 0) {
    if (!((head as string) in obj)) return obj;
    const copy = { ...obj };
    delete copy[head as string];
    return copy;
  }

  const current = obj[head as string];
  if (
    typeof current === "object" &&
    current !== null &&
    !Array.isArray(current)
  ) {
    const updated = removeNestedValue(current as AnyRecord, tail);
    return { ...obj, [head as string]: updated };
  }

  return obj;
}
