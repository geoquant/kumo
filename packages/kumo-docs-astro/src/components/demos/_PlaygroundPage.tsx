/**
 * PlaygroundPage — full-page streaming UI playground.
 *
 * Provides a 4-tab interface (Preview, Code, Grading, System Prompt) for
 * generating, inspecting, and grading Kumo UI via the /api/chat endpoint.
 *
 * Loaded at /playground with client:load — all logic is client-side.
 * Auth is gated by ?key= query param validated against /api/chat/prompt.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Button, Empty, InputArea, Loader, Select } from "@cloudflare/kumo";
import { LockKeyIcon, PaperPlaneRightIcon } from "@phosphor-icons/react";
import {
  useUITree,
  useRuntimeValueStore,
  createJsonlParser,
} from "@cloudflare/kumo/streaming";
import { isRenderableTree } from "@cloudflare/kumo/generative";
import { readSSEStream } from "~/lib/read-sse-stream";

// =============================================================================
// Types
// =============================================================================

/**
 * Auth gate state machine:
 * - `checking`: reading ?key= from URL and validating via API
 * - `authenticated`: key valid, playground features unlocked
 * - `denied`: no key or invalid key, access restricted
 */
type AuthState = "checking" | "authenticated" | "denied";

/** Streaming lifecycle state. */
type StreamStatus = "idle" | "streaming" | "error";

/** Conversation message for multi-turn. */
interface ChatMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

// =============================================================================
// Helpers
// =============================================================================

/** Extract `error` string from an unknown JSON error body, or null. */
function extractErrorMessage(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  if (!("error" in body)) return null;
  // After `in` check, TS knows `body` has an `error` property.
  const err: unknown = (body as { error: unknown }).error;
  return typeof err === "string" ? err : null;
}

// =============================================================================
// Constants
// =============================================================================

/** Models available in the playground, matching ALLOWED_MODELS in /api/chat. */
const MODELS = [
  { value: "glm-4.7-flash", label: "GLM 4.7 Flash" },
  { value: "llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout 17B" },
  { value: "gemma-3-27b-it", label: "Gemma 3 27B" },
] as const;

const DEFAULT_MODEL = MODELS[0].value;

/**
 * Preset prompts: 5 card-level (from _StreamingDemo) + 3 page-level.
 * Card-level generate single component cards; page-level generate full layouts.
 */
const PRESET_PROMPTS = [
  // Card-level presets (from existing demo)
  {
    label: "User card",
    prompt: "Show me a user profile card with name, email, and role",
  },
  {
    label: "Settings form",
    prompt:
      "Build a notification preferences form with a text input for name, a select dropdown for email frequency (realtime, daily, weekly), checkboxes for notification channels, and a submit button",
  },
  {
    label: "Counter",
    prompt:
      "Create a simple counter UI: show the current count, and include exactly two buttons labeled Increment and Decrement",
  },
  {
    label: "Pricing table",
    prompt: "Display a pricing comparison table with 3 tiers",
  },
  {
    label: "Custom",
    prompt:
      'Show a "Theme Picker" heading, a short description about choosing a theme with custom DemoButton components, then a button group with two DemoButtons: "Light" (variant "light") and "Dark" (variant "dark"), each with a select_theme action and a theme param matching its variant',
  },
  // Page-level presets
  {
    label: "DNS management",
    prompt:
      "Build a DNS management dashboard with a table listing DNS records (type, name, content, TTL, proxy status), an add record form with type select, name input, content input, TTL select, and proxy toggle, plus a search/filter input at the top",
  },
  {
    label: "Tunnel config",
    prompt:
      "Create a Cloudflare Tunnel configuration page with a tunnel status card showing connection health, a public hostnames table with hostname, service, and path columns, plus an add route form with hostname input, service URL input, and path prefix input",
  },
  {
    label: "WAF overview",
    prompt:
      "Design a WAF overview dashboard with a summary card showing total requests, blocked threats, and challenge rate as meters, a recent events table with timestamp, action, rule, IP, and path columns, plus toggle switches for managed rulesets",
  },
] as const;

// =============================================================================
// Auth hook
// =============================================================================

/**
 * Reads ?key= from URL on mount, validates against /api/chat/prompt.
 * Returns auth state and the validated key (null if denied).
 */
function usePlaygroundAuth(): { auth: AuthState; apiKey: string | null } {
  const [auth, setAuth] = useState<AuthState>("checking");
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get("key");

    if (!key) {
      setAuth("denied");
      return;
    }

    // Validate key by hitting the prompt endpoint which requires auth.
    const controller = new AbortController();

    fetch("/api/chat/prompt", {
      headers: { "X-Playground-Key": key },
      signal: controller.signal,
    })
      .then((res) => {
        if (res.ok) {
          setApiKey(key);
          setAuth("authenticated");
        } else {
          setAuth("denied");
        }
      })
      .catch((err: unknown) => {
        // AbortError is expected on cleanup — ignore it.
        if (err instanceof DOMException && err.name === "AbortError") return;
        setAuth("denied");
      });

    return () => controller.abort();
  }, []);

  return { auth, apiKey };
}

// =============================================================================
// Component
// =============================================================================

export function PlaygroundPage() {
  const { auth, apiKey } = usePlaygroundAuth();

  return (
    <div className="flex h-screen flex-col bg-kumo-base text-kumo-default">
      {auth === "checking" && <CheckingState />}
      {auth === "denied" && <DeniedState />}
      {auth === "authenticated" && <AuthenticatedState apiKey={apiKey} />}
    </div>
  );
}

// =============================================================================
// State views
// =============================================================================

/** Spinner while key validation is in-flight. */
function CheckingState() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader size="lg" />
    </div>
  );
}

/** Access restricted — no key or invalid key. */
function DeniedState() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Empty
        icon={<LockKeyIcon size={32} />}
        title="Access restricted"
        description="This playground requires a valid access key. Add ?key=<your-key> to the URL to continue."
      />
    </div>
  );
}

// =============================================================================
// Authenticated playground
// =============================================================================

/** Main playground UI. Renders top bar + content area (tabs in future tasks). */
function AuthenticatedState({ apiKey }: { apiKey: string | null }) {
  // --- Input state ---
  const [inputValue, setInputValue] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);

  // --- Streaming state ---
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // --- Refs ---
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);

  // --- UITree hooks ---
  const runtimeValueStore = useRuntimeValueStore();
  const { tree, applyPatches, reset } = useUITree({ batchPatches: true });

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const isStreaming = status === "streaming";

  // --- Submit handler ---
  const handleSubmit = useCallback(
    (e?: FormEvent, overrideMessage?: string) => {
      if (e) e.preventDefault();
      const msg = overrideMessage ?? inputValue.trim();
      if (!msg) return;

      // Abort any in-flight stream
      abortRef.current?.abort();

      const runId = runIdRef.current + 1;
      runIdRef.current = runId;

      // Reset tree for fresh generation
      runtimeValueStore.clear();
      reset();
      setErrorMessage(null);
      setStatus("streaming");
      setInputValue("");

      // Track conversation
      const newUserMessage: ChatMessage = { role: "user", content: msg };
      setMessages((prev) => [...prev, newUserMessage]);

      // Build history from previous messages (exclude the current one)
      const history = messages.length > 0 ? messages : undefined;

      const parser = createJsonlParser();
      const controller = new AbortController();
      abortRef.current = controller;

      (async () => {
        try {
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "text/event-stream",
              ...(apiKey ? { "X-Playground-Key": apiKey } : {}),
            },
            body: JSON.stringify({
              message: msg,
              model: selectedModel,
              ...(history ? { history } : {}),
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

          let fullResponse = "";

          await readSSEStream(
            response,
            (token) => {
              fullResponse += token;
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

          if (runIdRef.current === runId) {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: fullResponse },
            ]);
            setStatus("idle");
          }
        } catch (err: unknown) {
          if (err instanceof DOMException && err.name === "AbortError") return;

          // Flush partial ops even on error
          try {
            const remaining = parser.flush();
            if (remaining.length > 0) applyPatches(remaining);
          } catch {
            // Ignore flush errors
          }

          if (runIdRef.current === runId) {
            setErrorMessage(
              err instanceof Error ? err.message : "Something went wrong",
            );
            setStatus("error");
          }
        } finally {
          if (runIdRef.current === runId) {
            abortRef.current = null;
          }
        }
      })();
    },
    [
      inputValue,
      selectedModel,
      messages,
      apiKey,
      runtimeValueStore,
      reset,
      applyPatches,
    ],
  );

  const showTree = isRenderableTree(tree);

  return (
    <>
      {/* Top bar */}
      <PlaygroundTopBar
        inputValue={inputValue}
        onInputChange={setInputValue}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        isStreaming={isStreaming}
        onSubmit={handleSubmit}
      />

      {/* Content area — tabs will be added in ui-4 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {!showTree && status !== "error" && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-kumo-subtle">Enter a prompt to generate UI</p>
          </div>
        )}

        {status === "error" && errorMessage && (
          <div className="flex flex-1 items-center justify-center p-4">
            <p className="text-kumo-danger">{errorMessage}</p>
          </div>
        )}
      </div>
    </>
  );
}

// =============================================================================
// Top bar
// =============================================================================

interface PlaygroundTopBarProps {
  readonly inputValue: string;
  readonly onInputChange: (value: string) => void;
  readonly selectedModel: string;
  readonly onModelChange: (value: string) => void;
  readonly isStreaming: boolean;
  readonly onSubmit: (e?: FormEvent, overrideMessage?: string) => void;
}

/** Top bar: prompt input, model selector, send button, preset pills. */
function PlaygroundTopBar({
  inputValue,
  onInputChange,
  selectedModel,
  onModelChange,
  isStreaming,
  onSubmit,
}: PlaygroundTopBarProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSubmit();
      }
    },
    [onSubmit],
  );

  return (
    <div className="shrink-0 border-b border-kumo-line bg-kumo-elevated px-4 py-3 space-y-2">
      {/* Input row: prompt + model selector + send button */}
      <form onSubmit={(e) => onSubmit(e)} className="flex items-end gap-2">
        <div className="flex-1">
          <InputArea
            value={inputValue}
            onValueChange={onInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Describe the UI you want..."
            disabled={isStreaming}
            aria-label="Prompt"
            rows={1}
            size="sm"
          />
        </div>
        <div className="w-48 shrink-0">
          <Select
            value={selectedModel}
            onValueChange={(v) => {
              if (typeof v === "string") onModelChange(v);
            }}
            disabled={isStreaming}
            aria-label="Model"
          >
            {MODELS.map((m) => (
              <Select.Option key={m.value} value={m.value}>
                {m.label}
              </Select.Option>
            ))}
          </Select>
        </div>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={isStreaming || !inputValue.trim()}
          icon={<PaperPlaneRightIcon />}
        >
          {isStreaming ? "Streaming..." : "Send"}
        </Button>
      </form>

      {/* Preset prompt pills */}
      <div className="flex flex-wrap gap-1.5">
        {PRESET_PROMPTS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            disabled={isStreaming}
            onClick={() => onSubmit(undefined, preset.prompt)}
            className="rounded-full border border-kumo-line bg-kumo-base px-2.5 py-1 text-xs text-kumo-subtle transition-colors hover:border-kumo-brand hover:text-kumo-brand disabled:cursor-not-allowed disabled:opacity-50"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
