/**
 * Extract UITree JSON from streamed LLM text.
 *
 * The LLM is instructed to respond with raw JSON, but may include
 * markdown fences or preamble text. This module extracts the first
 * valid JSON object from the accumulated text buffer.
 */

import type { UITree } from "./types";

/**
 * Attempt to extract a complete UITree JSON from accumulated text.
 *
 * Handles common LLM output quirks:
 * - Markdown code fences (```json ... ```)
 * - Leading/trailing whitespace or text
 * - Incomplete JSON (returns null — try again later)
 *
 * @returns Parsed UITree if valid JSON found, null otherwise.
 */
export function extractUITree(text: string): UITree | null {
  const cleaned = stripMarkdownFences(text).trim();

  // Find the first { character
  const start = cleaned.indexOf("{");
  if (start === -1) return null;

  // Find the matching closing brace by counting depth
  let depth = 0;
  let inString = false;
  let escape = false;
  let end = -1;

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (inString && ch === "\\") {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  // JSON not yet complete
  if (end === -1) return null;

  const jsonStr = cleaned.slice(start, end + 1);

  try {
    const parsed: unknown = JSON.parse(jsonStr);
    if (isUITree(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
}

/** Strip markdown code fences from LLM output. */
function stripMarkdownFences(text: string): string {
  // Remove ```json ... ``` or ``` ... ```
  return text.replace(/^```(?:json)?\s*\n?/gm, "").replace(/\n?```\s*$/gm, "");
}

/** Minimal runtime check that an object looks like a UITree. */
function isUITree(value: unknown): value is UITree {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.root === "string" &&
    typeof obj.elements === "object" &&
    obj.elements !== null
  );
}
