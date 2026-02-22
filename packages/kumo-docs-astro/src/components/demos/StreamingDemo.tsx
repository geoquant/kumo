/**
 * StreamingDemo — live generative UI chat demo for the docs site.
 *
 * Composes @cloudflare/kumo/streaming (useUITree, createJsonlParser, action system)
 * and @cloudflare/kumo/generative (UITreeRenderer, COMPONENT_MAP) to render
 * Kumo components from AI-generated JSONL/RFC6902 patch streams.
 *
 * Fetches from /api/chat (Workers AI SSE endpoint). Theme-aware via docs site
 * data-mode attribute.
 */

import {
  useCallback,
  useRef,
  useState,
  useEffect,
  type FormEvent,
} from "react";
import { Button, InputArea, Badge, Surface, Loader } from "@cloudflare/kumo";
import {
  useUITree,
  useRuntimeValueStore,
  createJsonlParser,
  BUILTIN_HANDLERS,
  dispatchAction,
  processActionResult,
  type ActionEvent,
  type UITree,
  type JsonPatchOp,
} from "@cloudflare/kumo/streaming";
import { UITreeRenderer, isRenderableTree } from "@cloudflare/kumo/generative";

// =============================================================================
// Types
// =============================================================================

type DemoStatus = "idle" | "streaming" | "error";

// =============================================================================
// Constants
// =============================================================================

const PRESET_PROMPTS = [
  {
    label: "User card",
    prompt: "Show me a user profile card with name, email, and role",
  },
  {
    label: "Settings form",
    prompt: "Build a notification preferences form with toggles",
  },
  {
    label: "Counter",
    prompt: "Create a simple counter with increment and decrement buttons",
  },
  {
    label: "Pricing table",
    prompt: "Display a pricing comparison table with 3 tiers",
  },
] as const;

// =============================================================================
// SSE stream reader
// =============================================================================

/**
 * Parse Workers AI SSE stream.
 *
 * Wire format: `data: {"response":"...token..."}\n\n` ending with `data: [DONE]\n\n`
 */
async function readSSEStream(
  response: Response,
  onToken: (token: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const body = response.body;
  if (!body) throw new Error("No response body");

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      if (signal.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE lines
      const lines = buffer.split("\n");
      // Keep last (possibly incomplete) line in buffer
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;

        const payload = trimmed.slice(6); // strip "data: "
        if (payload === "[DONE]") return;

        try {
          const parsed: unknown = JSON.parse(payload);
          if (typeof parsed !== "object" || parsed === null) continue;

          const obj = parsed as Record<string, unknown>;

          // Workers AI legacy format: { response: "..." }
          if ("response" in obj && typeof obj.response === "string") {
            onToken(obj.response);
            continue;
          }

          // OpenAI-compatible chat completion format:
          // { choices: [{ delta: { content: "..." } }] }
          if ("choices" in obj && Array.isArray(obj.choices)) {
            const choice = obj.choices[0] as
              | Record<string, unknown>
              | undefined;
            if (choice && typeof choice.delta === "object" && choice.delta) {
              const delta = choice.delta as Record<string, unknown>;
              if (typeof delta.content === "string" && delta.content) {
                onToken(delta.content);
              }
            }
          }
        } catch {
          // Skip malformed JSON chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// =============================================================================
// Main component
// =============================================================================

/** Live streaming generative UI demo. */
export function StreamingDemo() {
  // --- State ---
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const [status, setStatus] = useState<DemoStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");

  // --- Refs ---
  const abortRef = useRef<AbortController | null>(null);
  const accumulatedTextRef = useRef("");

  // --- Hooks ---
  const runtimeValueStore = useRuntimeValueStore();

  // Stable ref for tree — avoids stale closure in handleAction
  const treeRef = useRef<UITree>({ root: "", elements: {} });
  // Stable ref for applyPatches
  const applyPatchesRef = useRef<(patches: readonly JsonPatchOp[]) => void>(
    () => {},
  );
  // Stable ref for handleSubmit (for form submission action)
  const handleSubmitRef = useRef<
    (e?: FormEvent, overrideMessage?: string) => void
  >(() => {});

  const handleAction = useCallback((event: ActionEvent) => {
    const result = dispatchAction(BUILTIN_HANDLERS, event, treeRef.current);
    if (result === null) return;
    processActionResult(result, {
      applyPatches: (patches: readonly JsonPatchOp[]) => {
        applyPatchesRef.current(patches);
      },
      sendMessage: (content: string) => {
        handleSubmitRef.current(undefined, content);
      },
      openExternal: (url: string, target: string) => {
        window.open(url, target);
      },
    });
  }, []);

  const { tree, applyPatches, reset } = useUITree({
    batchPatches: true,
    onAction: handleAction,
  });

  // Keep refs in sync
  treeRef.current = tree;
  applyPatchesRef.current = applyPatches;

  // --- Submit handler ---
  const handleSubmit = useCallback(
    (e?: FormEvent, overrideMessage?: string) => {
      if (e) e.preventDefault();
      const msg = overrideMessage ?? inputValue.trim();
      if (!msg || status === "streaming") return;

      // Abort any in-flight stream
      abortRef.current?.abort();

      // Reset everything for a fresh response
      setLastPrompt(msg);
      runtimeValueStore.clear();
      reset();
      setErrorMessage(null);
      setStatus("streaming");
      setInputValue("");
      accumulatedTextRef.current = "";

      // Create fresh parser for this stream
      const parser = createJsonlParser();
      const controller = new AbortController();
      abortRef.current = controller;

      (async () => {
        try {
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: msg }),
            signal: controller.signal,
          });

          if (!response.ok) {
            const errBody = await response.json().catch(() => null);
            const errMsg =
              typeof errBody === "object" &&
              errBody !== null &&
              "error" in errBody &&
              typeof (errBody as Record<string, unknown>).error === "string"
                ? ((errBody as Record<string, unknown>).error as string)
                : `Request failed (${String(response.status)})`;
            throw new Error(errMsg);
          }

          await readSSEStream(
            response,
            (token) => {
              accumulatedTextRef.current += token;
              const ops = parser.push(token);
              if (ops.length > 0) {
                applyPatches(ops);
              }
            },
            controller.signal,
          );

          // Flush remaining buffer
          const remaining = parser.flush();
          if (remaining.length > 0) {
            applyPatches(remaining);
          }

          setStatus("idle");
        } catch (err: unknown) {
          if (err instanceof DOMException && err.name === "AbortError") return;

          // Flush partial ops even on error
          try {
            const remaining = parser.flush();
            if (remaining.length > 0) applyPatches(remaining);
          } catch {
            // Ignore flush errors
          }

          const errMessage =
            err instanceof Error ? err.message : "Something went wrong";
          setErrorMessage(errMessage);
          setStatus("error");
        }
      })();
    },
    [inputValue, status, runtimeValueStore, reset, applyPatches],
  );

  // Keep handleSubmitRef in sync
  handleSubmitRef.current = handleSubmit;

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const isStreaming = status === "streaming";
  const showCurrentTree = isRenderableTree(tree);

  return (
    <div className="flex flex-col rounded-lg border border-kumo-line bg-kumo-base overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-kumo-line bg-kumo-elevated px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-kumo-default">
            Generative UI
          </span>
          <Badge variant="primary">Live</Badge>
        </div>
        {isStreaming && (
          <div className="flex items-center gap-2 text-xs text-kumo-subtle">
            <Loader size="sm" />
            Streaming...
          </div>
        )}
      </div>

      {/* Generated UI area */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-3"
        style={{ minHeight: "200px", maxHeight: "520px" }}
      >
        {/* Empty state */}
        {!lastPrompt && !showCurrentTree && !isStreaming && (
          <div className="flex items-center justify-center py-12 text-center">
            <span className="text-sm text-kumo-subtle">
              Pick a preset or type a prompt below to generate UI.
            </span>
          </div>
        )}

        {/* Last user prompt */}
        {lastPrompt && (
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-lg bg-kumo-brand/10 px-3 py-2 text-sm text-kumo-default">
              {lastPrompt}
            </div>
          </div>
        )}

        {/* Current streaming/rendered tree */}
        {showCurrentTree && (
          <div className="rounded-lg border border-kumo-line bg-kumo-base p-4">
            <UITreeRenderer
              tree={tree}
              streaming={isStreaming}
              onAction={handleAction}
              runtimeValueStore={runtimeValueStore}
            />
          </div>
        )}

        {/* Error display */}
        {status === "error" && errorMessage && (
          <Surface className="rounded-lg border border-kumo-danger bg-kumo-danger-tint p-3">
            <span className="text-sm text-kumo-danger">{errorMessage}</span>
          </Surface>
        )}
      </div>

      {/* Controls — always visible */}
      <div className="border-t border-kumo-line bg-kumo-elevated p-3 space-y-2">
        {/* Preset pills — always shown */}
        <div className="flex flex-wrap gap-1.5">
          {PRESET_PROMPTS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              disabled={isStreaming}
              onClick={() => handleSubmit(undefined, preset.prompt)}
              className="rounded-full border border-kumo-line bg-kumo-base px-2.5 py-1 text-xs text-kumo-subtle transition-colors hover:border-kumo-brand hover:text-kumo-brand disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <form onSubmit={(e) => handleSubmit(e)}>
          <InputArea
            value={inputValue}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setInputValue(e.target.value)
            }
            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Describe the UI you want..."
            disabled={isStreaming}
            aria-label="Chat message"
            rows={2}
            className="w-full"
          />
          <div className="mt-2 flex justify-end">
            <Button
              type="submit"
              variant="primary"
              disabled={isStreaming || !inputValue.trim()}
            >
              {isStreaming ? "Streaming..." : "Send"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
