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

    const parsed = parsePatchLine(line);
    return parsed !== null ? [parsed] : [];
  }

  return { push, flush };
}
