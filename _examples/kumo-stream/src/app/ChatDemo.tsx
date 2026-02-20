/**
 * ChatDemo — streaming generative UI chat interface.
 *
 * Wires together the streaming pipeline:
 *   1. User types a prompt
 *   2. POST /api/chat returns SSE frames with text deltas
 *   3. createJsonlParser() accumulates deltas into complete JSONL lines
 *   4. useUITree() applies parsed RFC 6902 patches to build the UITree
 *   5. UITreeRenderer renders the tree incrementally
 *
 * Each new message resets the tree and creates a fresh parser instance.
 *
 * Styled to match public/cross-boundary.html via cross-boundary.css classes.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { useRuntimeValueStore, useUITree } from "../core/hooks";
import { createJsonlParser, type JsonlParser } from "../core/jsonl-parser";
import type { JsonPatchOp } from "../core/rfc6902";
import { createSseParser } from "../core/sse-parser";
import { UITreeRenderer, isRenderableTree } from "../core/UITreeRenderer";
import type { ActionEvent } from "../core/action-handler";
import type { UITree } from "../core/types";
import { BUILTIN_HANDLERS, dispatchAction } from "../core/action-registry";
import { processActionResult } from "../core/process-action-result";
import { ActionPanel, type ActionLogEntry } from "./ActionPanel";
import { SubmitPanel } from "./SubmitPanel";

// =============================================================================
// Constants
// =============================================================================

const PRESET_PROMPTS = [
  {
    label: "Welcome",
    prompt: "Welcome the user to Cloudflare",
  },
  {
    label: "Form",
    prompt: "Create a notification preferences form",
  },
  {
    label: "Counters",
    prompt: "Two counters",
  },
  {
    label: "Table",
    prompt: "Display a pricing comparison table",
  },
] as const;

// =============================================================================
// Helpers
// =============================================================================

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type ChatSseEvent =
  | { readonly type: "text"; readonly delta: string }
  | { readonly type: "done" }
  | { readonly type: "error"; readonly message: string };

function parseChatSseEvent(value: unknown): ChatSseEvent | null {
  if (!isRecord(value)) return null;
  const type = value["type"];
  if (type === "text" && typeof value["delta"] === "string") {
    return { type: "text", delta: value["delta"] };
  }
  if (type === "done") return { type: "done" };
  if (type === "error" && typeof value["message"] === "string") {
    return { type: "error", message: value["message"] };
  }
  return null;
}

function parseSseDataLinesAsEvents(
  dataLines: readonly string[],
): ChatSseEvent[] {
  const candidates = [dataLines.join("\n"), dataLines.join("")];
  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      const ev = parseChatSseEvent(parsed);
      if (ev) return [ev];
    } catch {
      // try next
    }
  }

  // Fallback: parse each data line independently.
  const out: ChatSseEvent[] = [];
  for (const line of dataLines) {
    try {
      const parsed: unknown = JSON.parse(line);
      const ev = parseChatSseEvent(parsed);
      if (ev) out.push(ev);
    } catch {
      // ignore
    }
  }
  return out;
}

// =============================================================================
// State types
// =============================================================================

type StreamingStatus = "idle" | "streaming" | "error";

interface ErrorInfo {
  readonly message: string;
}

/** A single turn in the conversation history. */
type ChatHistoryEntry =
  | { readonly role: "user"; readonly content: string }
  | { readonly role: "assistant"; readonly tree: UITree };

type ChatMessage = {
  readonly role: "user" | "assistant";
  readonly content: string;
};

// =============================================================================
// ChatHistory sub-components
// =============================================================================

function UserBubble({ content }: { readonly content: string }) {
  return (
    <div className="cb-history-user-bubble">
      <div>{content}</div>
    </div>
  );
}

function AssistantSnapshot({ tree }: { readonly tree: UITree }) {
  return (
    <div className="cb-history-assistant-snapshot">
      <UITreeRenderer tree={tree} streaming={false} />
    </div>
  );
}

function ChatHistoryView({
  entries,
}: {
  readonly entries: readonly ChatHistoryEntry[];
}) {
  if (entries.length === 0) return null;
  return (
    <div>
      {entries.map((entry, i) =>
        entry.role === "user" ? (
          <UserBubble key={i} content={entry.content} />
        ) : (
          <AssistantSnapshot key={i} tree={entry.tree} />
        ),
      )}
    </div>
  );
}

// =============================================================================
// Component
// =============================================================================

export interface ChatDemoProps {
  readonly isDark: boolean;
}

export function ChatDemo({ isDark: _isDark }: ChatDemoProps) {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<StreamingStatus>("idle");
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatHistoryEntry[]>([]);
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);

  const runtimeValueStore = useRuntimeValueStore();

  // Refs for values needed inside handleAction without stale closures.
  // Declared before useUITree so the onAction callback can close over them.
  const treeRef = useRef<UITree>({ root: "", elements: {} });
  const statusRef = useRef<StreamingStatus>(status);
  const applyPatchesRef = useRef<(patches: readonly JsonPatchOp[]) => void>(
    () => {},
  );
  const handleSubmitRef = useRef<(text: string) => void>(() => {});

  const handleAction = useCallback((event: ActionEvent) => {
    // Always log the action
    setActionLog((prev) => [
      ...prev,
      { timestamp: new Date().toISOString(), event },
    ]);

    // During streaming, log but don't apply patches or process results
    if (statusRef.current === "streaming") return;

    // Dispatch through registry → typed ActionResult
    const result = dispatchAction(BUILTIN_HANDLERS, event, treeRef.current);

    // null = unregistered action; already logged above, nothing else to do
    if (result == null) return;

    processActionResult(result, {
      applyPatches: applyPatchesRef.current,
      sendMessage: handleSubmitRef.current,
    });
  }, []);

  const { tree, applyPatches, reset, onAction } = useUITree({
    onAction: handleAction,
    // Streaming patch batches keep React responsive during fast token streams.
    batchPatches: true,
  });

  // Keep refs in sync with latest values
  // (handleSubmitRef is synced below after handleSubmit is defined)
  treeRef.current = tree;
  statusRef.current = status;
  applyPatchesRef.current = applyPatches;

  const clearActionLog = useCallback(() => {
    setActionLog([]);
  }, []);

  // Mutable refs for the parser and stream handle — not part of render state
  const parserRef = useRef<JsonlParser | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom when history or tree changes
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [chatHistory, tree]);

  const handleSubmit = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed === "") return;

      // Snapshot current tree into history before resetting
      if (isRenderableTree(tree)) {
        setChatHistory((prev) => [
          ...prev,
          { role: "assistant" as const, tree: structuredClone(tree) },
        ]);
      }

      // Add user message to visible history
      setChatHistory((prev) => [
        ...prev,
        { role: "user" as const, content: trimmed },
      ]);

      // Reset UI for new message
      runtimeValueStore.clear();
      reset();
      setError(null);
      setStatus("streaming");
      setPrompt("");

      // Create fresh parser for this stream
      const parser = createJsonlParser();
      parserRef.current = parser;

      // Build message history with new user message
      const newMessages: ChatMessage[] = [
        ...messages,
        { role: "user" as const, content: trimmed },
      ];

      const abort = new AbortController();
      abortRef.current = abort;

      fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history: newMessages }),
        signal: abort.signal,
      })
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(`Server responded with ${res.status}`);
          }
          if (!res.body) {
            throw new Error("Missing response body");
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();

          let sawDone = false;

          const sse = createSseParser((dataLines) => {
            const events = parseSseDataLinesAsEvents(dataLines);
            for (const event of events) {
              if (event.type === "text") {
                const ops = parser.push(event.delta);
                if (ops.length > 0) applyPatches(ops);
                continue;
              }

              if (event.type === "error") {
                throw new Error(event.message);
              }

              if (event.type === "done") {
                sawDone = true;
                return;
              }
            }
          });

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            sse.push(decoder.decode(value, { stream: true }));
            if (sawDone) break;
          }

          sse.flush();
        })
        .then(() => {
          const remaining = parser.flush();
          if (remaining.length > 0) applyPatches(remaining);

          parserRef.current = null;
          abortRef.current = null;

          setMessages([
            ...newMessages,
            { role: "assistant" as const, content: "(UI response)" },
          ]);
          setStatus("idle");
        })
        .catch((err: unknown) => {
          // Flush what we have so partial UI remains visible
          const remaining = parser.flush();
          if (remaining.length > 0) applyPatches(remaining);

          parserRef.current = null;
          abortRef.current = null;

          if (err instanceof DOMException && err.name === "AbortError") {
            setStatus("idle");
            return;
          }

          const msg = err instanceof Error ? err.message : "Unknown error";
          setError({ message: msg });
          setStatus("error");
        });
    },
    [messages, tree, reset, applyPatches, runtimeValueStore],
  );

  // Sync handleSubmitRef so handleAction (defined above) can call it
  handleSubmitRef.current = handleSubmit;

  const handleStop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    // Flush partial content so it stays visible
    if (parserRef.current) {
      const remaining = parserRef.current.flush();
      if (remaining.length > 0) {
        applyPatches(remaining);
      }
      parserRef.current = null;
    }

    setStatus("idle");
  }, [applyPatches]);

  const handleReset = useCallback(() => {
    // Abort any in-flight stream
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    parserRef.current = null;

    runtimeValueStore.clear();
    reset();
    setMessages([]);
    setChatHistory([]);
    setActionLog([]);
    setError(null);
    setStatus("idle");
    setPrompt("");
  }, [reset, runtimeValueStore]);

  const handleFormSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      handleSubmit(prompt);
    },
    [handleSubmit, prompt],
  );

  const isStreaming = status === "streaming";

  const hasHistory = chatHistory.length > 0;
  const hasCurrentContent =
    isRenderableTree(tree) || (isStreaming && !isRenderableTree(tree));

  // Status text for the dedicated status line
  const statusText = isStreaming
    ? "Generating UI..."
    : error
      ? `Error: ${error.message}`
      : status === "idle" && isRenderableTree(tree)
        ? "Done."
        : null;

  return (
    <>
      {/* Preset prompts — pill buttons */}
      <div className="cb-presets">
        {PRESET_PROMPTS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            disabled={isStreaming}
            onClick={() => handleSubmit(preset.prompt)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Controls row: input + Generate + Stop + Reset */}
      <form onSubmit={handleFormSubmit} className="cb-controls">
        <input
          type="text"
          value={prompt}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setPrompt(e.target.value)
          }
          placeholder="Describe a UI to generate..."
          disabled={isStreaming}
        />
        <button type="submit" disabled={isStreaming} className="primary">
          Generate
        </button>
        <button
          type="button"
          disabled={!isStreaming}
          onClick={handleStop}
          className="danger"
        >
          Stop
        </button>
        <button type="button" onClick={handleReset}>
          Reset
        </button>
      </form>

      {/* Status line */}
      <div className="cb-status">{statusText}</div>

      {/* Scrollable conversation area */}
      <div ref={scrollRef} className="cb-conversation-area">
        {/* Conversation history (past turns) */}
        <ChatHistoryView entries={chatHistory} />

        {/* Separator between history and current turn */}
        {hasHistory && hasCurrentContent && (
          <hr className="cb-history-separator" />
        )}

        {/* Current turn's rendered UITree (interactive) */}
        <div id="kumo-container">
          {isRenderableTree(tree) && (
            <UITreeRenderer
              tree={tree}
              streaming={isStreaming}
              onAction={onAction}
              runtimeValueStore={runtimeValueStore}
            />
          )}
        </div>
      </div>

      {/* Action + submit panels */}
      <div className="cb-panels-row">
        <ActionPanel entries={actionLog} onClear={clearActionLog} />
        <SubmitPanel tree={tree} runtimeValueStore={runtimeValueStore} />
      </div>
    </>
  );
}
