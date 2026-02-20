/**
 * Text sanitizer for LLM-generated UI.
 *
 * Some models like to prefix headings/labels with emoji icons
 * (e.g. "⚡ Performance"). Kumo doesn't ship a generic icon component
 * in this demo, so we strip leading emoji tokens to keep copy clean.
 */

import type { JsonPatchOp } from "./rfc6902";

// One or more leading emoji grapheme clusters followed by whitespace.
// Covers cases with variation selectors (e.g. 🛡️) and ZWJ sequences.
const LEADING_EMOJI_TOKENS =
  /^\s*(?:(?:\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?)*)\s+)+/u;

export function stripLeadingEmojiTokens(text: string): string {
  return text.replace(LEADING_EMOJI_TOKENS, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Recursively strip leading emoji tokens from all string leaves.
 * Returns the original reference when no changes are needed.
 */
export function sanitizeUnknownText(value: unknown): unknown {
  if (typeof value === "string") {
    const next = stripLeadingEmojiTokens(value);
    return next === value ? value : next;
  }

  if (Array.isArray(value)) {
    let out: unknown[] | null = null;
    for (let i = 0; i < value.length; i++) {
      const cur = value[i];
      const next = sanitizeUnknownText(cur);
      if (out) {
        out[i] = next;
        continue;
      }
      if (next !== cur) {
        out = value.slice();
        out[i] = next;
      }
    }
    return out ?? value;
  }

  if (isRecord(value)) {
    let out: Record<string, unknown> | null = null;
    for (const [k, cur] of Object.entries(value)) {
      const next = sanitizeUnknownText(cur);
      if (out) {
        out[k] = next;
        continue;
      }
      if (next !== cur) {
        out = { ...value };
        out[k] = next;
      }
    }
    return out ?? value;
  }

  return value;
}

/** Strip leading emoji tokens anywhere inside a patch value. */
export function sanitizePatch(patch: JsonPatchOp): JsonPatchOp {
  if (patch.op === "remove") return patch;

  const nextValue = sanitizeUnknownText(patch.value);
  return nextValue === patch.value ? patch : { ...patch, value: nextValue };
}
