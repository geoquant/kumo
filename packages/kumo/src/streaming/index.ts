/**
 * Kumo Streaming Module
 *
 * JSONL parser and RFC 6902 patch engine for streaming LLM-generated UI.
 *
 * @example
 * ```ts
 * import { createJsonlParser, applyPatch, EMPTY_TREE } from '@cloudflare/kumo/streaming';
 *
 * const parser = createJsonlParser();
 * let tree = EMPTY_TREE;
 *
 * for await (const chunk of stream) {
 *   const ops = parser.push(chunk);
 *   for (const op of ops) {
 *     tree = applyPatch(tree, op);
 *   }
 * }
 *
 * // Flush remaining buffer
 * for (const op of parser.flush()) {
 *   tree = applyPatch(tree, op);
 * }
 * ```
 */

// Types
export type {
  UITree,
  UIElement,
  DataModel,
  AuthState,
  Action,
  ActionHandlers,
  VisibilityCondition,
} from "./types";

// Constants
export { EMPTY_TREE, EMPTY_DATA } from "./types";

// RFC 6902 patch engine
export { applyPatch, parsePatchLine } from "./rfc6902";
export type { JsonPatchOp } from "./rfc6902";

// JSONL parser
export { createJsonlParser } from "./jsonl-parser";
export type { JsonlParser } from "./jsonl-parser";
