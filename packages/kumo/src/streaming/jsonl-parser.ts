/**
 * JSONL (newline-delimited JSON) streaming parser for RFC 6902 patch operations.
 *
 * Accumulates text chunks from an LLM streaming response, splits on newlines,
 * and parses each complete line into a JsonPatchOp via parsePatchLine.
 *
 * Design:
 * - push(chunk) buffers partial lines, returns parsed ops from complete lines
 * - flush() attempts to parse whatever remains in the buffer
 * - Empty lines, invalid JSON, and markdown fences are silently skipped
 */

import { parsePatchLine, type JsonPatchOp } from "./rfc6902";

// =============================================================================
// Types
// =============================================================================

export interface JsonlParser {
  /** Feed a text chunk. Returns parsed patch ops from any complete lines. */
  readonly push: (chunk: string) => readonly JsonPatchOp[];
  /** Parse whatever remains in the buffer. Returns 0 or 1 ops. */
  readonly flush: () => readonly JsonPatchOp[];
}

// =============================================================================
// Truncation repair
// =============================================================================

/**
 * Attempt to repair truncated JSON by appending missing closing delimiters.
 *
 * LLM responses are sometimes cut off mid-token, leaving valid-prefix JSON
 * that fails `JSON.parse`. This function walks the string respecting JSON
 * string literals and tracks unclosed `{` / `[` delimiters, then appends
 * the missing closers in LIFO order.
 *
 * Only called on the **last** buffer line during `flush()` — never on
 * mid-stream lines where truncation would indicate a real protocol error.
 *
 * Returns `null` when the input doesn't look like repairable JSON
 * (e.g. doesn't start with `{`).
 */
export function repairTruncatedJson(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed[0] !== "{") return null;

  // Strip trailing comma that may appear before truncation.
  const cleaned = trimmed.replace(/,\s*$/, "");

  // Track unclosed delimiters as a stack of expected closers.
  const stack: string[] = [];
  let inString = false;
  let escape = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i]!;

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === "\\") {
      if (inString) escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") stack.pop();
  }

  if (stack.length === 0) return null; // already balanced or not repairable

  // If we're still inside a string, close it first. This handles truncation
  // mid-string-value (e.g. `"children":"Save pref`).
  const suffix = (inString ? '"' : "") + stack.reverse().join("");
  return cleaned + suffix;
}

// =============================================================================
// Implementation
// =============================================================================

/** Returns true for lines that should be silently discarded. */
function isSkippable(line: string): boolean {
  const trimmed = line.trim();
  return trimmed === "" || trimmed.startsWith("```");
}

/**
 * Create a stateful JSONL parser that accumulates text chunks and emits
 * parsed JsonPatchOp arrays on each complete line boundary.
 */
export function createJsonlParser(): JsonlParser {
  let buffer = "";

  function push(chunk: string): readonly JsonPatchOp[] {
    buffer += chunk;

    const nlIndex = buffer.indexOf("\n");
    if (nlIndex === -1) {
      // No complete line yet — keep buffering
      return [];
    }

    // Split on all newlines; last segment becomes the new buffer
    const segments = buffer.split("\n");
    buffer = segments[segments.length - 1] ?? "";

    const ops: JsonPatchOp[] = [];
    // Process all complete lines (everything except the last segment)
    for (let i = 0; i < segments.length - 1; i++) {
      const line = segments[i] ?? "";
      if (isSkippable(line)) continue;

      const parsed = parsePatchLine(line);
      if (parsed !== null) {
        ops.push(parsed);
      }
    }

    return ops;
  }

  function flush(): readonly JsonPatchOp[] {
    if (buffer.trim() === "") {
      buffer = "";
      return [];
    }

    const line = buffer;
    buffer = "";

    if (isSkippable(line)) return [];

    // Try parsing the line as-is first.
    const parsed = parsePatchLine(line);
    if (parsed !== null) return [parsed];

    // If the line looks like truncated JSON (starts with `{` but fails
    // to parse), attempt to repair it by closing unclosed delimiters.
    // This recovers the last element when the LLM's output is cut off
    // by a token limit — a common issue with reasoning models that
    // consume completion tokens on chain-of-thought.
    const repaired = repairTruncatedJson(line);
    if (repaired !== null) {
      const repairedParsed = parsePatchLine(repaired);
      if (repairedParsed !== null) return [repairedParsed];
    }

    return [];
  }

  return { push, flush };
}
