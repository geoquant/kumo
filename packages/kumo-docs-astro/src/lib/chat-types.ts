/**
 * Chat message types for the playground's multi-turn conversation.
 *
 * Extracted from `_PlaygroundPage.tsx` so they can be shared across
 * modules without pulling in the entire playground component.
 */

import type { ToolIframeStatus } from "~/components/McpToolIframe";

/**
 * Status state machine for tool confirmation messages.
 * Aliased from {@link ToolIframeStatus} — both types must stay in sync.
 */
export type ToolMessageStatus = ToolIframeStatus;

/** A text message from the user or assistant. */
export interface TextChatMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

/** An iframe-based tool confirmation card rendered in the chat sidebar. */
export interface ToolChatMessage {
  readonly role: "tool";
  readonly toolId: string;
  readonly iframeUrl: string;
  readonly renderData: Record<string, unknown>;
  readonly status: ToolMessageStatus;
}

/** Conversation message for multi-turn. */
export type ChatMessage = TextChatMessage | ToolChatMessage;
