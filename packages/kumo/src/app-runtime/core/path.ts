import type { JsonPointer } from "./types";

function decodeSegment(segment: string): string {
  return segment.replaceAll("~1", "/").replaceAll("~0", "~");
}

function encodeSegment(segment: string): string {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isArrayIndexSegment(segment: string): boolean {
  return segment === "0" || /^[1-9]\d*$/.test(segment);
}

function parseArrayIndex(segment: string): number | null {
  if (!isArrayIndexSegment(segment)) {
    return null;
  }

  const parsed = Number(segment);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function isJsonPointer(value: unknown): value is JsonPointer {
  return value === "/" || (typeof value === "string" && value.startsWith("/"));
}

export function parseJsonPointer(path: JsonPointer): string[] {
  if (path === "/") {
    return [];
  }

  return path
    .slice(1)
    .split("/")
    .map((segment) => decodeSegment(segment));
}

export function joinJsonPointers(
  base: JsonPointer,
  next: JsonPointer | undefined,
): JsonPointer {
  if (next == null || next === "/") {
    return base;
  }

  if (base === "/") {
    return next;
  }

  return `${base}/${parseJsonPointer(next).map(encodeSegment).join("/")}`;
}

export function getValueAtPointer(value: unknown, path: JsonPointer): unknown {
  const segments = parseJsonPointer(path);
  let current = value;

  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = parseArrayIndex(segment);
      if (index === null) {
        return undefined;
      }
      current = current[index];
      continue;
    }

    if (isObjectRecord(current)) {
      current = current[segment];
      continue;
    }

    return undefined;
  }

  return current;
}

function setValueAtSegments(
  value: unknown,
  segments: readonly string[],
  nextValue: unknown,
): unknown {
  if (segments.length === 0) {
    return nextValue;
  }

  const [head, ...tail] = segments;

  if (isArrayIndexSegment(head)) {
    const index = parseArrayIndex(head);
    if (index === null) {
      return value;
    }

    const base = Array.isArray(value) ? value.slice() : [];
    base[index] = setValueAtSegments(base[index], tail, nextValue);
    return base;
  }

  const base = isObjectRecord(value) ? { ...value } : {};
  base[head] = setValueAtSegments(base[head], tail, nextValue);
  return base;
}

export function setValueAtPointer(
  value: Record<string, unknown>,
  path: JsonPointer,
  nextValue: unknown,
): Record<string, unknown> {
  if (path === "/") {
    return isObjectRecord(nextValue) ? { ...nextValue } : value;
  }

  const updated = setValueAtSegments(value, parseJsonPointer(path), nextValue);
  return isObjectRecord(updated) ? updated : value;
}
