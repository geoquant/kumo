import {
  createJsonlParser,
  applyPatch,
  type UITree,
  type JsonPatchOp,
} from "@cloudflare/kumo/streaming";
import { readSSEStream } from "./read-sse-stream.js";

// ---------------------------------------------------------------------------
// TOOL_CONFIRMATION_PROMPT — generates compact approval card with
// tool_approve/tool_cancel actions.
// Canonical copy: packages/kumo-docs-astro/src/lib/tool-prompts.ts
// Duplicated here because kumo-mcp cannot import from kumo-docs-astro.
// ---------------------------------------------------------------------------

const TOOL_CONFIRMATION_PROMPT = `You generate confirmation cards by responding ONLY with JSONL — one JSON Patch operation per line. No plain text, no markdown fences, no explanations.

Each line is: {"op":"add","path":"<json-pointer>","value":<value>}

You build this structure: { root: "element-key", elements: { [key]: UIElement } }
Where UIElement is: { key: string, type: string, props: object, children?: string[], parentKey?: string, action?: { name: string, params?: object } }

Order:
1. First line: {"op":"add","path":"/root","value":"<root-key>"}
2. Then add elements top-down (parent before children). Parents include children array upfront.

Available types: Surface, Stack, Grid, Cluster, Text, Button, Badge, Div, Code

## Your Task

Generate a compact confirmation card that asks the user to verify an action before executing it. The card should:
- Use a Surface as root
- Include a heading (Text variant="heading3") describing what will happen
- Include a description row explaining the specifics (use Badge for key values like names, IDs)
- End with exactly two buttons in a Cluster:
  1. Cancel button (variant="outline") with action: { "name": "tool_cancel", "params": { "toolId": "TOOL_ID" } }
  2. Approve button (variant="primary") with action: { "name": "tool_approve", "params": { "toolId": "TOOL_ID" } }

The card should be concise — 6-10 elements maximum. Make it visually clear what the user is approving.

Rules: unique kebab-case keys, key field matches path, compact JSON, one object per line.`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Status of the confirmation card lifecycle. */
export type ConfirmationCardStatus =
  | "streaming"
  | "pending"
  | "applying"
  | "completed"
  | "cancelled"
  | "error";

/** Callbacks for streaming progress updates. */
export interface StreamCallbacks {
  /** Called each time the UITree is updated with new patches. */
  readonly onTreeUpdate: (tree: UITree) => void;
  /** Called when the stream completes and the card is ready. */
  readonly onComplete: (tree: UITree) => void;
  /** Called if an error occurs during streaming. */
  readonly onError: (error: Error, partialTree: UITree) => void;
}

/** Configuration for the streaming request. */
export interface StreamConfirmationCardOptions {
  /** User message to include in the chat request. */
  readonly message: string;
  /** Tool ID injected into TOOL_CONFIRMATION_PROMPT. */
  readonly toolId: string;
  /** AI model to use. */
  readonly model?: string;
  /** Base URL for the chat API. Defaults to `/api/chat`. */
  readonly chatApiUrl?: string;
  /** AbortSignal to cancel the stream. */
  readonly signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// streamConfirmationCard
// ---------------------------------------------------------------------------

/**
 * Fetches `/api/chat` with `skipSystemPrompt: true` + `systemPromptOverride`
 * set to the TOOL_CONFIRMATION_PROMPT, then streams JSONL through
 * `readSSEStream` → `createJsonlParser` → `applyPatch` to progressively
 * build a UITree.
 *
 * Calls `callbacks.onTreeUpdate(tree)` on each patch batch and
 * `callbacks.onComplete(tree)` when streaming finishes.
 */
export async function streamConfirmationCard(
  options: StreamConfirmationCardOptions,
  callbacks: StreamCallbacks,
): Promise<void> {
  const { message, toolId, model, chatApiUrl = "/api/chat", signal } = options;

  const controller = new AbortController();

  // If caller passes an external signal, abort our controller when it fires.
  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      signal.addEventListener("abort", () => controller.abort(signal.reason), {
        once: true,
      });
    }
  }

  const parser = createJsonlParser();
  let tree: UITree = { root: "", elements: {} };

  const toolPrompt = TOOL_CONFIRMATION_PROMPT.split("TOOL_ID").join(toolId);

  function applyOps(ops: readonly JsonPatchOp[]): void {
    if (ops.length === 0) return;
    for (const op of ops) {
      tree = applyPatch(tree, op);
    }
    callbacks.onTreeUpdate(tree);
  }

  try {
    const response = await fetch(chatApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        message,
        model: model ?? "glm-4.7-flash",
        skipSystemPrompt: true,
        systemPromptOverride: toolPrompt,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errBody: unknown = await response.json().catch(() => null);
      const errMsg =
        extractErrorMessage(errBody) ??
        `Request failed (${String(response.status)})`;
      throw new Error(errMsg);
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

    const error = err instanceof Error ? err : new Error(String(err));
    callbacks.onError(error, tree);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractErrorMessage(body: unknown): string | null {
  if (!isRecord(body)) return null;
  if (typeof body.error === "string") return body.error;
  if (isRecord(body.error) && typeof body.error.message === "string") {
    return body.error.message;
  }
  return null;
}
