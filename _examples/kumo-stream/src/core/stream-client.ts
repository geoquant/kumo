/**
 * Anthropic streaming client for browser-side JSONL UI generation.
 *
 * Wraps the Anthropic SDK's MessageStream with callbacks for text deltas,
 * completion, and errors. Provides an AbortController handle for stop.
 *
 * WARNING: This runs the API key client-side. For production, proxy
 * through a backend. This is a prototype/demo pattern only.
 */

import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./system-prompt";

// =============================================================================
// Types
// =============================================================================

export interface StreamCallbacks {
  /** Called for each text delta from the LLM. */
  readonly onText: (delta: string) => void;
  /** Called when the stream completes normally. */
  readonly onDone: () => void;
  /** Called on stream error or abort. */
  readonly onError: (error: Error) => void;
}

export interface StreamHandle {
  /** Abort the in-flight stream. */
  readonly abort: () => void;
}

export interface StreamClientConfig {
  readonly apiKey: string;
  readonly model?: string;
}

// =============================================================================
// Client
// =============================================================================

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

/**
 * Start a streaming message to the Anthropic API.
 *
 * Returns a handle with an `abort()` method to cancel the stream.
 * Text deltas are delivered via `callbacks.onText`, which the caller
 * feeds into a JSONL parser.
 */
export function startStream(
  config: StreamClientConfig,
  messages: Anthropic.MessageParam[],
  callbacks: StreamCallbacks,
): StreamHandle {
  const client = new Anthropic({
    apiKey: config.apiKey,
    dangerouslyAllowBrowser: true,
  });

  const stream = client.messages.stream({
    model: config.model ?? DEFAULT_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages,
  });

  stream.on("text", (delta) => {
    callbacks.onText(delta);
  });

  stream.on("finalMessage", () => {
    callbacks.onDone();
  });

  stream.on("error", (error) => {
    callbacks.onError(
      error instanceof Error ? error : new Error(String(error)),
    );
  });

  return {
    abort: () => {
      stream.controller.abort();
    },
  };
}
