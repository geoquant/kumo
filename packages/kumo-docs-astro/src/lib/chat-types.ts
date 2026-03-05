/**
 * Chat message types for the playground's multi-turn conversation.
 *
 * Extracted from `_PlaygroundPage.tsx` so they can be shared across
 * modules without pulling in the entire playground component.
 */

import type { UITree } from "@cloudflare/kumo/streaming";

// =============================================================================
// Tool message status
// =============================================================================

/**
 * Status state machine for tool confirmation messages.
 *
 * ```
 * streaming → pending → approved → applying → completed
 *                     ↘ cancelled
 *            error (from any state)
 * ```
 */
export type ToolMessageStatus =
  | "streaming"
  | "pending"
  | "approved"
  | "cancelled"
  | "applying"
  | "completed"
  | "error";

// =============================================================================
// Message types
// =============================================================================

/** A text message from the user or assistant. */
export interface TextChatMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

/**
 * An inline tool confirmation card rendered directly in the chat sidebar.
 *
 * The `tree` is progressively built via JSONL streaming — same pipeline
 * the A/B panels use — and rendered with `UITreeRenderer` inline.
 */
export interface ToolChatMessage {
  readonly role: "tool";
  readonly toolId: string;
  /** The UITree powering the inline confirmation card. */
  readonly tree: UITree;
  readonly status: ToolMessageStatus;
}

/** Conversation message for multi-turn. */
export type ChatMessage = TextChatMessage | ToolChatMessage;
