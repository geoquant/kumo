/**
 * Kumo Streaming Module
 *
 * JSONL parser, RFC 6902 patch engine, React hooks, and runtime value store
 * for streaming LLM-generated UI.
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
 *
 * @example
 * ```tsx
 * import { useUITree } from '@cloudflare/kumo/streaming';
 *
 * function StreamingUI({ stream }) {
 *   const { tree, applyPatch, reset } = useUITree({ batchPatches: true });
 *   // ... wire stream to applyPatch
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

// Text sanitizer (pure — no React dependency)
export {
  stripLeadingEmojiTokens,
  sanitizeUnknownText,
  sanitizePatch,
} from "./text-sanitizer";

// Action types (pure — no React dependency)
export type { ActionEvent, ActionDispatch } from "./action-types";

// Runtime value store (pure — no React dependency)
export { createRuntimeValueStore } from "./runtime-value-store";
export type { RuntimeValueStore } from "./runtime-value-store";

// Runtime value store React context
export {
  RuntimeValueStoreProvider,
  useRuntimeValueStoreContext,
} from "./runtime-value-store-context";

// React hooks
export { useUITree, useRuntimeValueStore } from "./hooks";
export type { UseUITreeOptions, UseUITreeReturn } from "./hooks";
