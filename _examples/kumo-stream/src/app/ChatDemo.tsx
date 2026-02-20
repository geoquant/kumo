/**
 * ChatDemo — streaming generative UI chat interface.
 *
 * Wires together the streaming pipeline:
 *   1. User types a prompt
 *   2. startStream() sends it to Anthropic and streams text deltas
 *   3. createJsonlParser() accumulates deltas into complete JSONL lines
 *   4. useUITree() applies parsed RFC 6902 patches to build the UITree
 *   5. UITreeRenderer renders the tree incrementally
 *
 * Each new message resets the tree and creates a fresh parser instance.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Anthropic from "@anthropic-ai/sdk";
import { Button, Input, Text, Surface } from "@cloudflare/kumo";

import { useUITree } from "../core/hooks";
import { createJsonlParser, type JsonlParser } from "../core/jsonl-parser";
import type { JsonPatchOp } from "../core/rfc6902";
import { startStream, type StreamHandle } from "../core/stream-client";
import { UITreeRenderer, isRenderableTree } from "../core/UITreeRenderer";
import type { ActionEvent } from "../core/action-handler";
import type { UITree } from "../core/types";
import { actionToPatch } from "../core/action-patch-bridge";
import { ActionPanel, type ActionLogEntry } from "./ActionPanel";

// =============================================================================
// Constants
// =============================================================================

const PRESET_PROMPTS = [
  "Welcome the user to Cloudflare",
  "Create a DNS record editor",
  "Show a server status dashboard",
  "Build a support ticket form",
  "Display a pricing comparison table",
  "Create a user profile settings page",
  "Show an analytics overview",
  "Build a counter",
] as const;

// =============================================================================
// Helpers
// =============================================================================

function getApiKey(): string | null {
  const key =
    typeof import.meta.env?.VITE_ANTHROPIC_API_KEY === "string"
      ? import.meta.env.VITE_ANTHROPIC_API_KEY
      : null;
  return key && key.length > 0 ? key : null;
}

function getModel(): string | undefined {
  const model =
    typeof import.meta.env?.VITE_ANTHROPIC_MODEL === "string"
      ? import.meta.env.VITE_ANTHROPIC_MODEL
      : undefined;
  return model && model.length > 0 ? model : undefined;
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

// =============================================================================
// ChatHistory sub-components
// =============================================================================

function UserBubble({ content }: { readonly content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-lg bg-kumo-brand-subtle px-3 py-2 text-sm text-kumo-default">
        {content}
      </div>
    </div>
  );
}

function AssistantSnapshot({ tree }: { readonly tree: UITree }) {
  return (
    <div className="rounded-lg border border-kumo-line bg-kumo-elevated p-3 opacity-80">
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
    <div className="flex flex-col gap-4">
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

export function ChatDemo() {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<StreamingStatus>("idle");
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [messages, setMessages] = useState<Anthropic.MessageParam[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatHistoryEntry[]>([]);
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);

  // Refs for values needed inside handleAction without stale closures.
  // Declared before useUITree so the onAction callback can close over them.
  const treeRef = useRef<UITree>({ root: "", elements: {} });
  const statusRef = useRef<StreamingStatus>(status);
  const applyPatchesRef = useRef<(patches: readonly JsonPatchOp[]) => void>(
    () => {},
  );

  const handleAction = useCallback((event: ActionEvent) => {
    // Always log the action
    setActionLog((prev) => [
      ...prev,
      { timestamp: new Date().toISOString(), event },
    ]);

    // During streaming, log but don't apply patches
    if (statusRef.current === "streaming") return;

    // Attempt to map action → patch for known interactions
    const patch = actionToPatch(event, treeRef.current);
    if (patch != null) {
      applyPatchesRef.current([patch]);
    }
  }, []);

  const { tree, applyPatches, reset, onAction } = useUITree({
    onAction: handleAction,
  });

  // Keep refs in sync with latest values
  treeRef.current = tree;
  statusRef.current = status;
  applyPatchesRef.current = applyPatches;

  const clearActionLog = useCallback(() => {
    setActionLog([]);
  }, []);

  // Mutable refs for the parser and stream handle — not part of render state
  const parserRef = useRef<JsonlParser | null>(null);
  const streamRef = useRef<StreamHandle | null>(null);
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
      const apiKey = getApiKey();
      if (!apiKey) {
        setError({
          message:
            "Missing VITE_ANTHROPIC_API_KEY. Add it to .env and restart the dev server.",
        });
        setStatus("error");
        return;
      }

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
      reset();
      setError(null);
      setStatus("streaming");
      setPrompt("");

      // Create fresh parser for this stream
      const parser = createJsonlParser();
      parserRef.current = parser;

      // Build message history with new user message
      const newMessages: Anthropic.MessageParam[] = [
        ...messages,
        { role: "user" as const, content: trimmed },
      ];

      const handle = startStream({ apiKey, model: getModel() }, newMessages, {
        onText: (delta) => {
          const ops = parser.push(delta);
          if (ops.length > 0) {
            applyPatches(ops);
          }
        },
        onDone: () => {
          // Flush remaining buffer
          const remaining = parser.flush();
          if (remaining.length > 0) {
            applyPatches(remaining);
          }
          parserRef.current = null;
          streamRef.current = null;

          // Persist conversation history for multi-turn
          setMessages([
            ...newMessages,
            {
              role: "assistant" as const,
              content: "(UI response)",
            },
          ]);
          setStatus("idle");
        },
        onError: (err) => {
          // Flush what we have so partial UI remains visible
          const remaining = parser.flush();
          if (remaining.length > 0) {
            applyPatches(remaining);
          }
          parserRef.current = null;
          streamRef.current = null;

          setError({ message: err.message });
          setStatus("error");
        },
      });

      streamRef.current = handle;
    },
    [messages, tree, reset, applyPatches],
  );

  const handleStop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.abort();
      streamRef.current = null;
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
    if (streamRef.current) {
      streamRef.current.abort();
      streamRef.current = null;
    }
    parserRef.current = null;

    reset();
    setMessages([]);
    setChatHistory([]);
    setActionLog([]);
    setError(null);
    setStatus("idle");
    setPrompt("");
  }, [reset]);

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

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      {/* Left column: chat (60-65%) */}
      <div className="flex min-w-0 flex-col gap-6 md:w-[62%]">
        {/* Preset prompts */}
        <div className="flex flex-wrap gap-2">
          {PRESET_PROMPTS.map((preset) => (
            <Button
              key={preset}
              variant="outline"
              size="sm"
              disabled={isStreaming}
              onClick={() => handleSubmit(preset)}
            >
              {preset}
            </Button>
          ))}
        </div>

        {/* Input form */}
        <form onSubmit={handleFormSubmit} className="flex gap-2">
          <div className="flex-1">
            <Input
              value={prompt}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setPrompt(e.target.value)
              }
              placeholder="Describe a UI to generate..."
              disabled={isStreaming}
            />
          </div>
          {isStreaming ? (
            <Button variant="destructive" onClick={handleStop} type="button">
              Stop
            </Button>
          ) : (
            <Button
              variant="primary"
              type="submit"
              disabled={prompt.trim() === ""}
            >
              Generate
            </Button>
          )}
          <Button variant="ghost" onClick={handleReset} type="button">
            Reset
          </Button>
        </form>

        {/* Error display */}
        {error && (
          <Surface>
            <Text variant="error">{error.message}</Text>
          </Surface>
        )}

        {/* Scrollable conversation area */}
        <div
          ref={scrollRef}
          className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto"
        >
          {/* Conversation history (past turns) */}
          <ChatHistoryView entries={chatHistory} />

          {/* Separator between history and current turn */}
          {hasHistory && hasCurrentContent && (
            <hr className="border-kumo-line" />
          )}

          {/* Current streaming indicator */}
          {isStreaming && !isRenderableTree(tree) && (
            <Text variant="secondary" size="sm">
              Generating UI...
            </Text>
          )}

          {/* Current turn's rendered UITree (interactive) */}
          {isRenderableTree(tree) && (
            <UITreeRenderer
              tree={tree}
              streaming={isStreaming}
              onAction={onAction}
            />
          )}
        </div>
      </div>

      {/* Right column: action events panel (35-40%) */}
      <div className="md:w-[38%]">
        <ActionPanel entries={actionLog} onClear={clearActionLog} />
      </div>
    </div>
  );
}
