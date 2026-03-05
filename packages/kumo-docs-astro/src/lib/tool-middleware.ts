/**
 * Tool middleware — pure functions for intercepting and routing
 * tool-related messages in the playground chat.
 *
 * Extracted from `_PlaygroundPage.tsx` so tool logic can be tested
 * and reused without pulling in the entire playground component.
 */

import {
  createJsonlParser,
  applyPatch,
  type UITree,
  type JsonPatchOp,
} from "@cloudflare/kumo/streaming";
import { readSSEStream } from "~/lib/read-sse-stream";
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

/**
 * Immutably update the UITree of a tool message identified by `toolId`.
 */
export function updateToolMessageTree(
  messages: readonly ChatMessage[],
  toolId: string,
  tree: UITree,
): ChatMessage[] {
  return messages.map((m) =>
    m.role === "tool" && m.toolId === toolId ? { ...m, tree } : m,
  );
}

// =============================================================================
// Stream tool confirmation card
// =============================================================================

/** Callbacks for `streamToolConfirmation`. */
export interface StreamToolCallbacks {
  /** Called each time the UITree is updated with new patches. */
  readonly onTreeUpdate: (tree: UITree) => void;
  /** Called when the stream completes and the card is ready. */
  readonly onComplete: (tree: UITree) => void;
  /** Called if an error occurs during streaming. */
  readonly onError: (error: Error) => void;
}

/** Options for `streamToolConfirmation`. */
export interface StreamToolOptions {
  /** User message forwarded to the chat API. */
  readonly message: string;
  /** System prompt override (the tool confirmation prompt with TOOL_ID replaced). */
  readonly systemPrompt: string;
  /** AI model. Defaults to `"glm-4.7-flash"`. */
  readonly model?: string;
  /** AbortSignal to cancel the stream. */
  readonly signal?: AbortSignal;
}

/**
 * Stream a tool confirmation card inline using the same JSONL pipeline
 * the A/B panels use: `fetch /api/chat` → `readSSEStream` → `createJsonlParser` → `applyPatch`.
 *
 * The caller provides callbacks for progressive tree updates.
 */
export async function streamToolConfirmation(
  options: StreamToolOptions,
  callbacks: StreamToolCallbacks,
): Promise<void> {
  const { message, systemPrompt, model = "glm-4.7-flash", signal } = options;

  const controller = new AbortController();
  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), {
      once: true,
    });
  }

  const parser = createJsonlParser();
  let tree: UITree = { root: "", elements: {} };

  function applyOps(ops: readonly JsonPatchOp[]): void {
    if (ops.length === 0) return;
    for (const op of ops) {
      tree = applyPatch(tree, op);
    }
    callbacks.onTreeUpdate(tree);
  }

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        message,
        model,
        skipSystemPrompt: true,
        systemPromptOverride: systemPrompt,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(
        `Chat API failed (${String(response.status)}): ${errText}`,
      );
    }

    await readSSEStream(
      response,
      (token) => {
        const ops = parser.push(token);
        applyOps(ops);
      },
      controller.signal,
    );

    // Flush remaining buffer.
    const remaining = parser.flush();
    applyOps(remaining);

    callbacks.onComplete(tree);
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") return;

    // Flush partial ops on error.
    try {
      const remaining = parser.flush();
      applyOps(remaining);
    } catch {
      // Ignore flush errors.
    }

    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  }
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
