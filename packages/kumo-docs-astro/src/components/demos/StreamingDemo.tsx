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
import { Button, Input, Badge, Surface, Loader } from "@cloudflare/kumo";
import {
  useUITree,
  useRuntimeValueStore,
  createJsonlParser,
  BUILTIN_HANDLERS,
  dispatchAction,
  processActionResult,
  createRuntimeValueStore,
  type ActionEvent,
  type UITree,
  type JsonPatchOp,
} from "@cloudflare/kumo/streaming";
import { UITreeRenderer, isRenderableTree } from "@cloudflare/kumo/generative";

// =============================================================================
// Types
// =============================================================================

type ChatRole = "user" | "assistant";

interface ChatHistoryEntry {
  readonly role: ChatRole;
  /** User messages store text; assistant messages store a snapshot of the rendered tree. */
  readonly content: string;
  readonly tree?: UITree;
}

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

const MAX_VISUAL_HISTORY = 10;

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
          if (
            typeof parsed === "object" &&
            parsed !== null &&
            "response" in parsed &&
            typeof (parsed as Record<string, unknown>).response === "string"
          ) {
            onToken((parsed as Record<string, unknown>).response as string);
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
// Sub-components
// =============================================================================

function ChatBubble({
  entry,
  runtimeValueStore,
}: {
  readonly entry: ChatHistoryEntry;
  readonly runtimeValueStore?: ReturnType<typeof createRuntimeValueStore>;
}) {
  if (entry.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-lg bg-kumo-brand/10 px-3 py-2 text-sm text-kumo-default">
          {entry.content}
        </div>
      </div>
    );
  }

  // Assistant message — render tree snapshot (non-interactive)
  if (entry.tree && isRenderableTree(entry.tree)) {
    return (
      <div className="pointer-events-none opacity-80">
        <UITreeRenderer
          tree={entry.tree}
          streaming={false}
          runtimeValueStore={runtimeValueStore}
        />
      </div>
    );
  }

  // Fallback text for assistant
  return <div className="text-sm text-kumo-subtle italic">{entry.content}</div>;
}

// =============================================================================
// Main component
// =============================================================================

/** Live streaming generative UI demo. */
export function StreamingDemo() {
  // --- State ---
  const [chatHistory, setChatHistory] = useState<readonly ChatHistoryEntry[]>(
    [],
  );
  const [apiHistory, setApiHistory] = useState<
    readonly { role: string; content: string }[]
  >([]);
  const [status, setStatus] = useState<DemoStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");

  // --- Refs ---
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const accumulatedTextRef = useRef("");

  // --- Hooks ---
  const runtimeValueStore = useRuntimeValueStore();
  const historyRuntimeStore = useRef(createRuntimeValueStore());

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

  // --- Auto-scroll ---
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, tree, status]);

  // --- Submit handler ---
  const handleSubmit = useCallback(
    (e?: FormEvent, overrideMessage?: string) => {
      if (e) e.preventDefault();
      const msg = overrideMessage ?? inputValue.trim();
      if (!msg || status === "streaming") return;

      // Abort any in-flight stream
      abortRef.current?.abort();

      // Snapshot current tree into history before resetting
      if (isRenderableTree(tree)) {
        setChatHistory((prev) => [
          ...prev.slice(-MAX_VISUAL_HISTORY),
          {
            role: "assistant" as const,
            content: "",
            tree: structuredClone(tree),
          },
        ]);
      }

      // Add user message to visual history
      setChatHistory((prev) => [
        ...prev.slice(-MAX_VISUAL_HISTORY),
        { role: "user" as const, content: msg },
      ]);

      // Reset UI state for new response
      runtimeValueStore.clear();
      reset();
      setErrorMessage(null);
      setStatus("streaming");
      setInputValue("");
      accumulatedTextRef.current = "";

      // Build API history for this request
      const nextApiHistory = [...apiHistory, { role: "user", content: msg }];

      // Create fresh parser for this stream
      const parser = createJsonlParser();
      const controller = new AbortController();
      abortRef.current = controller;

      (async () => {
        try {
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: msg,
              history: nextApiHistory.slice(-20),
            }),
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

          // Update API history with assistant response
          setApiHistory([
            ...nextApiHistory,
            { role: "assistant", content: "(UI response)" },
          ]);
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
    [
      inputValue,
      status,
      tree,
      apiHistory,
      runtimeValueStore,
      reset,
      applyPatches,
    ],
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

      {/* Chat area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{ minHeight: "320px", maxHeight: "520px" }}
      >
        {/* Empty state */}
        {chatHistory.length === 0 && !showCurrentTree && !isStreaming && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="mb-2 text-lg font-semibold text-kumo-default">
              Try it out
            </span>
            <span className="mb-6 text-sm text-kumo-subtle max-w-sm">
              Ask the AI to generate a UI using Kumo components. Pick a preset
              or type your own prompt.
            </span>
            <div className="flex flex-wrap justify-center gap-2">
              {PRESET_PROMPTS.map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  disabled={isStreaming}
                  onClick={() => handleSubmit(undefined, preset.prompt)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Chat history */}
        {chatHistory.map((entry, i) => (
          <ChatBubble
            key={`${entry.role}-${String(i)}`}
            entry={entry}
            runtimeValueStore={historyRuntimeStore.current}
          />
        ))}

        {/* Current streaming tree */}
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

        {/* Streaming placeholder */}
        {isStreaming && !showCurrentTree && (
          <div className="flex items-center gap-2 text-sm text-kumo-subtle">
            <Loader size="sm" />
            Generating UI...
          </div>
        )}

        {/* Error display */}
        {status === "error" && errorMessage && (
          <Surface className="rounded-lg border border-kumo-danger bg-kumo-danger-tint p-3">
            <span className="text-sm text-kumo-danger">{errorMessage}</span>
          </Surface>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-kumo-line bg-kumo-elevated p-3">
        {/* Preset pills (shown when there's history) */}
        {chatHistory.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
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
        )}

        <form
          onSubmit={(e) => handleSubmit(e)}
          className="flex items-center gap-2"
        >
          <div className="flex-1">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Describe the UI you want..."
              disabled={isStreaming}
              aria-label="Chat message"
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={isStreaming || !inputValue.trim()}
          >
            {isStreaming ? "Streaming..." : "Send"}
          </Button>
        </form>
      </div>
    </div>
  );
}
