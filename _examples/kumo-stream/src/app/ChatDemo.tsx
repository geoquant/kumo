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

import { useCallback, useRef, useState } from "react";
import type { FormEvent } from "react";
import Anthropic from "@anthropic-ai/sdk";
import { Button, Input, Text, Surface } from "@cloudflare/kumo";

import { useUITree } from "../core/hooks";
import { createJsonlParser, type JsonlParser } from "../core/jsonl-parser";
import { startStream, type StreamHandle } from "../core/stream-client";
import { UITreeRenderer, isRenderableTree } from "../core/UITreeRenderer";

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

// =============================================================================
// Component
// =============================================================================

export function ChatDemo() {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<StreamingStatus>("idle");
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [messages, setMessages] = useState<Anthropic.MessageParam[]>([]);

  const { tree, applyPatches, reset } = useUITree();

  // Mutable refs for the parser and stream handle — not part of render state
  const parserRef = useRef<JsonlParser | null>(null);
  const streamRef = useRef<StreamHandle | null>(null);

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
    [messages, reset, applyPatches],
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

  return (
    <div className="flex flex-col gap-6">
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

      {/* Streaming indicator */}
      {isStreaming && !isRenderableTree(tree) && (
        <Text variant="secondary" size="sm">
          Generating UI...
        </Text>
      )}

      {/* Rendered UITree */}
      {isRenderableTree(tree) && <UITreeRenderer tree={tree} />}
    </div>
  );
}
