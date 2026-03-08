/**
 * RFC 6902 JSON Patch operations.
 *
 * Supports add, replace, remove, move, copy, and test.
 * Applies patches immutably to JSON-like documents such as UITree and AppSpec.
 */

type AnyRecord = Record<string, unknown>;

type AddPatch = {
  readonly op: "add" | "replace" | "test";
  readonly path: string;
  readonly value: unknown;
};

type RemovePatch = {
  readonly op: "remove";
  readonly path: string;
};

type MoveCopyPatch = {
  readonly op: "move" | "copy";
  readonly path: string;
  readonly from: string;
};

export type JsonPatchOp = AddPatch | RemovePatch | MoveCopyPatch;

const BLOCKED_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);
const MISSING = Symbol("missing");

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodePointerSegment(segment: string): string {
  return segment.replaceAll("~1", "/").replaceAll("~0", "~");
}

function parsePath(path: string): string[] | null {
  if (path === "" || path === "/") {
    return [];
  }

  const segments = (path.startsWith("/") ? path.slice(1) : path)
    .split("/")
    .map((segment) => decodePointerSegment(segment));

  for (const segment of segments) {
    if (BLOCKED_SEGMENTS.has(segment)) {
      return null;
    }
  }

  return segments;
}

function parseArrayIndex(segment: string): number | null {
  if (segment === "0" || /^[1-9]\d*$/.test(segment)) {
    const parsed = Number(segment);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }

  return null;
}

function cloneDocument<T>(value: T): T {
  if (Array.isArray(value)) {
    return [...value] as T;
  }

  if (isRecord(value)) {
    return { ...value } as T;
  }

  return value;
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((entry, index) => deepEqual(entry, right[index]))
    );
  }

  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);

    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every((key) => key in right && deepEqual(left[key], right[key]))
    );
  }

  return false;
}

function clonePatchValue<T>(value: T): T {
  return structuredClone(value);
}

function getValueAtSegments(
  value: unknown,
  segments: readonly string[],
): unknown {
  let current: unknown = value;

  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = parseArrayIndex(segment);
      if (index === null || index >= current.length) {
        return MISSING;
      }
      current = current[index];
      continue;
    }

    if (isRecord(current)) {
      if (!(segment in current)) {
        return MISSING;
      }
      current = current[segment];
      continue;
    }

    return MISSING;
  }

  return current;
}

function addAtSegments(
  value: unknown,
  segments: readonly string[],
  nextValue: unknown,
): { changed: boolean; value: unknown } {
  if (segments.length === 0) {
    return { changed: false, value };
  }

  const [head, ...tail] = segments;

  if (Array.isArray(value)) {
    if (tail.length === 0 && head === "-") {
      return { changed: true, value: [...value, nextValue] };
    }

    const index = parseArrayIndex(head);
    if (index === null || index > value.length) {
      return { changed: false, value };
    }

    if (tail.length === 0) {
      const nextArray = [...value];
      nextArray.splice(index, 0, nextValue);
      return { changed: true, value: nextArray };
    }

    if (index >= value.length) {
      return { changed: false, value };
    }

    const updated = addAtSegments(value[index], tail, nextValue);
    if (!updated.changed) {
      return { changed: false, value };
    }

    const nextArray = [...value];
    nextArray[index] = updated.value;
    return { changed: true, value: nextArray };
  }

  if (!isRecord(value)) {
    return { changed: false, value };
  }

  if (tail.length === 0) {
    return {
      changed: true,
      value: {
        ...value,
        [head]: nextValue,
      },
    };
  }

  if (tail.length === 1 && tail[0] === "-" && !(head in value)) {
    return {
      changed: true,
      value: {
        ...value,
        [head]: [nextValue],
      },
    };
  }

  if (!(head in value)) {
    return { changed: false, value };
  }

  const updated = addAtSegments(value[head], tail, nextValue);
  if (!updated.changed) {
    return { changed: false, value };
  }

  return {
    changed: true,
    value: {
      ...value,
      [head]: updated.value,
    },
  };
}

function replaceAtSegments(
  value: unknown,
  segments: readonly string[],
  nextValue: unknown,
): { changed: boolean; value: unknown } {
  if (segments.length === 0) {
    return { changed: false, value };
  }

  const [head, ...tail] = segments;

  if (Array.isArray(value)) {
    const index = parseArrayIndex(head);
    if (index === null || index >= value.length) {
      return { changed: false, value };
    }

    if (tail.length === 0) {
      const nextArray = [...value];
      nextArray[index] = nextValue;
      return { changed: true, value: nextArray };
    }

    const updated = replaceAtSegments(value[index], tail, nextValue);
    if (!updated.changed) {
      return { changed: false, value };
    }

    const nextArray = [...value];
    nextArray[index] = updated.value;
    return { changed: true, value: nextArray };
  }

  if (!isRecord(value) || !(head in value)) {
    return { changed: false, value };
  }

  if (tail.length === 0) {
    return {
      changed: true,
      value: {
        ...value,
        [head]: nextValue,
      },
    };
  }

  const updated = replaceAtSegments(value[head], tail, nextValue);
  if (!updated.changed) {
    return { changed: false, value };
  }

  return {
    changed: true,
    value: {
      ...value,
      [head]: updated.value,
    },
  };
}

function removeAtSegments(
  value: unknown,
  segments: readonly string[],
): { changed: boolean; value: unknown } {
  if (segments.length === 0) {
    return { changed: false, value };
  }

  const [head, ...tail] = segments;

  if (Array.isArray(value)) {
    const index = parseArrayIndex(head);
    if (index === null || index >= value.length) {
      return { changed: false, value };
    }

    if (tail.length === 0) {
      const nextArray = [...value];
      nextArray.splice(index, 1);
      return { changed: true, value: nextArray };
    }

    const updated = removeAtSegments(value[index], tail);
    if (!updated.changed) {
      return { changed: false, value };
    }

    const nextArray = [...value];
    nextArray[index] = updated.value;
    return { changed: true, value: nextArray };
  }

  if (!isRecord(value) || !(head in value)) {
    return { changed: false, value };
  }

  if (tail.length === 0) {
    const { [head]: _removed, ...nextRecord } = value;
    return { changed: true, value: nextRecord };
  }

  const updated = removeAtSegments(value[head], tail);
  if (!updated.changed) {
    return { changed: false, value };
  }

  return {
    changed: true,
    value: {
      ...value,
      [head]: updated.value,
    },
  };
}

export function applyPatch<T>(spec: T, patch: JsonPatchOp): T {
  const pathSegments = parsePath(patch.path);
  if (pathSegments === null) {
    return spec;
  }

  switch (patch.op) {
    case "add": {
      if (pathSegments.length === 0) {
        return cloneDocument(spec);
      }

      const updated = addAtSegments(spec, pathSegments, patch.value);
      return updated.changed ? (updated.value as T) : spec;
    }
    case "replace": {
      if (pathSegments.length === 0) {
        return cloneDocument(spec);
      }

      const updated = replaceAtSegments(spec, pathSegments, patch.value);
      return updated.changed ? (updated.value as T) : spec;
    }
    case "remove": {
      if (pathSegments.length === 0) {
        return cloneDocument(spec);
      }

      const updated = removeAtSegments(spec, pathSegments);
      return updated.changed ? (updated.value as T) : spec;
    }
    case "copy": {
      const fromSegments = parsePath(patch.from);
      if (fromSegments === null || pathSegments.length === 0) {
        return spec;
      }

      const value = getValueAtSegments(spec, fromSegments);
      if (value === MISSING) {
        return spec;
      }

      const updated = addAtSegments(spec, pathSegments, clonePatchValue(value));
      return updated.changed ? (updated.value as T) : spec;
    }
    case "move": {
      const fromSegments = parsePath(patch.from);
      if (fromSegments === null || pathSegments.length === 0) {
        return spec;
      }

      const value = getValueAtSegments(spec, fromSegments);
      if (value === MISSING) {
        return spec;
      }

      const removed = removeAtSegments(spec, fromSegments);
      if (!removed.changed) {
        return spec;
      }

      const added = addAtSegments(removed.value, pathSegments, value);
      return added.changed ? (added.value as T) : spec;
    }
    case "test": {
      const value = getValueAtSegments(spec, pathSegments);
      if (value === MISSING || !deepEqual(value, patch.value)) {
        throw new Error(`JSON Patch test failed at ${patch.path}`);
      }
      return spec;
    }
  }
}

function hasField(
  value: AnyRecord,
  field: string,
): value is AnyRecord & Record<typeof field, unknown> {
  return field in value;
}

export function parsePatchLine(line: string): JsonPatchOp | null {
  const trimmed = line.trim();
  if (trimmed === "") {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  if (typeof parsed.op !== "string" || typeof parsed.path !== "string") {
    return null;
  }

  if (parsed.path === "" || parsed.path === "/") {
    return null;
  }

  switch (parsed.op) {
    case "add":
    case "replace":
    case "test":
      return hasField(parsed, "value")
        ? { op: parsed.op, path: parsed.path, value: parsed.value }
        : null;
    case "remove":
      return { op: "remove", path: parsed.path };
    case "move":
    case "copy":
      return typeof parsed.from === "string"
        ? { op: parsed.op, path: parsed.path, from: parsed.from }
        : null;
    default:
      return null;
  }
}
