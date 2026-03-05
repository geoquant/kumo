/**
 * Tool middleware — pure functions for intercepting and routing
 * tool-related messages in the playground chat.
 *
 * Extracted from `_PlaygroundPage.tsx` so tool logic can be tested
 * and reused without pulling in the entire playground component.
 */

import type {
  ChatMessage,
  ToolChatMessage,
  ToolMessageStatus,
} from "~/lib/chat-types";

// =============================================================================
// Status updates
// =============================================================================

/**
 * Immutably update the status of a tool message identified by `toolId`.
 *
 * Returns a new messages array with the targeted tool message replaced.
 * Non-tool messages and tool messages with different IDs are unchanged.
 *
 * This is a pure function — the React `setMessages` wrapper stays in the
 * component so this module remains framework-agnostic.
 */
export function updateToolMessageStatus(
  messages: readonly ChatMessage[],
  toolId: string,
  newStatus: ToolMessageStatus,
): ChatMessage[] {
  return messages.map((m) =>
    m.role === "tool" && m.toolId === toolId ? { ...m, status: newStatus } : m,
  );
}

// =============================================================================
// Utilities
// =============================================================================

/** Type guard for non-null, non-array objects. */
export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Find a tool message by `toolId` in a messages array.
 *
 * Returns the matching {@link ToolChatMessage} or `undefined`.
 */
export function findToolMessage(
  messages: readonly ChatMessage[],
  toolId: string,
): ToolChatMessage | undefined {
  return messages.find(
    (m): m is ToolChatMessage => m.role === "tool" && m.toolId === toolId,
  );
}
