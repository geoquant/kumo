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
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Button,
  Empty,
  InputArea,
  Loader,
  Select,
  Tabs,
} from "@cloudflare/kumo";
import type { TabsItem } from "@cloudflare/kumo";
import {
  CheckIcon,
  CircleIcon,
  CopyIcon,
  LockKeyIcon,
  PaperPlaneRightIcon,
  SpinnerIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import {
  useUITree,
  useRuntimeValueStore,
  createJsonlParser,
  type RuntimeValueStore,
} from "@cloudflare/kumo/streaming";
import type { UITree } from "@cloudflare/kumo/streaming";
import {
  UITreeRenderer,
  isRenderableTree,
  uiTreeToJsx,
  gradeTree,
  walkTree,
} from "@cloudflare/kumo/generative";
import type { GradeReport } from "@cloudflare/kumo/generative";
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

/** Playground tab identifiers. */
type PlaygroundTab = "preview" | "code" | "grading" | "system-prompt";

/** Tab definitions for the playground content area. */
const PLAYGROUND_TABS: TabsItem[] = [
  { value: "preview", label: "Preview" },
  { value: "code", label: "Code" },
  { value: "grading", label: "Grading" },
  { value: "system-prompt", label: "System Prompt" },
];

const PLAYGROUND_TAB_VALUES = new Set<string>(
  PLAYGROUND_TABS.map((t) => t.value),
);

/** Type guard for PlaygroundTab values. */
function isPlaygroundTab(value: string): value is PlaygroundTab {
  return PLAYGROUND_TAB_VALUES.has(value);
}

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

/** Extract `prompt` string from an unknown JSON body, or null. */
function extractPromptString(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  if (!("prompt" in body)) return null;
  const val: unknown = (body as { prompt: unknown }).prompt;
  return typeof val === "string" ? val : null;
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

/** Main playground UI. Renders top bar + tabbed content area. */
function AuthenticatedState({ apiKey }: { apiKey: string | null }) {
  // --- Input state ---
  const [inputValue, setInputValue] = useState("");
  const [followUpValue, setFollowUpValue] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);

  // --- Tab state (persists across generations) ---
  const [activeTab, setActiveTab] = useState<PlaygroundTab>("preview");

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

  /** Whether a prior generation has completed (show follow-up bar). */
  const hasConversation = messages.length > 0;

  /** Submit from the follow-up bar at the bottom. */
  const handleFollowUp = useCallback(
    (e?: FormEvent, overrideMessage?: string) => {
      const msg = overrideMessage ?? followUpValue.trim();
      if (!msg) return;
      setFollowUpValue("");
      handleSubmit(e, msg);
    },
    [followUpValue, handleSubmit],
  );

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

      {/* Tabbed content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Tab bar */}
        <div className="shrink-0 border-b border-kumo-line px-4 pt-2">
          <Tabs
            variant="underline"
            tabs={PLAYGROUND_TABS}
            value={activeTab}
            onValueChange={(v) => {
              if (isPlaygroundTab(v)) setActiveTab(v);
            }}
          />
        </div>

        {/* Tab content — fills remaining viewport height */}
        <div className="flex-1 overflow-auto">
          <PlaygroundTabContent
            activeTab={activeTab}
            showTree={showTree}
            tree={tree}
            runtimeValueStore={runtimeValueStore}
            isStreaming={isStreaming}
            status={status}
            errorMessage={errorMessage}
            apiKey={apiKey}
          />
        </div>

        {/* Bottom bar: follow-up input + status (visible after first generation) */}
        {hasConversation && (
          <PlaygroundBottomBar
            followUpValue={followUpValue}
            onFollowUpChange={setFollowUpValue}
            isStreaming={isStreaming}
            status={status}
            onSubmit={handleFollowUp}
            turnCount={messages.length}
          />
        )}
      </div>
    </>
  );
}

// =============================================================================
// Tab content
// =============================================================================

interface PlaygroundTabContentProps {
  readonly activeTab: PlaygroundTab;
  readonly showTree: boolean;
  readonly tree: UITree;
  readonly runtimeValueStore: RuntimeValueStore;
  readonly isStreaming: boolean;
  readonly status: StreamStatus;
  readonly errorMessage: string | null;
  readonly apiKey: string | null;
}

/**
 * Renders the active tab's content panel.
 * Each tab's full implementation is in subsequent tasks (ui-6 through ui-8).
 */
function PlaygroundTabContent({
  activeTab,
  showTree,
  tree,
  runtimeValueStore,
  isStreaming,
  status,
  errorMessage,
  apiKey,
}: PlaygroundTabContentProps) {
  // Error banner takes priority in any tab
  if (status === "error" && errorMessage) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-kumo-danger">{errorMessage}</p>
      </div>
    );
  }

  switch (activeTab) {
    case "preview":
      return showTree ? (
        <div className="p-4">
          <UITreeRenderer
            tree={tree}
            streaming={isStreaming}
            runtimeValueStore={runtimeValueStore}
          />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
          <p className="text-kumo-subtle">Enter a prompt to generate UI</p>
        </div>
      );

    case "code":
      return <CodeTabContent tree={tree} showTree={showTree} />;

    case "grading":
      return (
        <GradingTabContent
          tree={tree}
          showTree={showTree}
          isStreaming={isStreaming}
        />
      );

    case "system-prompt":
      return <SystemPromptTabContent apiKey={apiKey} />;
  }
}

// =============================================================================
// System Prompt tab
// =============================================================================

/** Fetch state for the system prompt. */
type PromptFetchState =
  | { readonly status: "loading" }
  | { readonly status: "loaded"; readonly prompt: string }
  | { readonly status: "error"; readonly message: string };

/**
 * Fetches and displays the assembled system prompt from /api/chat/prompt.
 * Read-only — shows the exact prompt that would be sent to Workers AI.
 */
function SystemPromptTabContent({
  apiKey,
}: {
  readonly apiKey: string | null;
}) {
  const [state, setState] = useState<PromptFetchState>({ status: "loading" });

  useEffect(() => {
    if (!apiKey) {
      setState({ status: "error", message: "No API key available." });
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading" });

    fetch("/api/chat/prompt", {
      headers: { "X-Playground-Key": apiKey },
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const body: unknown = await res.json().catch(() => null);
          const errMsg =
            extractErrorMessage(body) ??
            `Failed to fetch prompt (${String(res.status)})`;
          throw new Error(errMsg);
        }
        const data: unknown = await res.json();
        const prompt = extractPromptString(data);
        if (prompt === null) {
          throw new Error("Unexpected response format.");
        }
        setState({ status: "loaded", prompt });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setState({
          status: "error",
          message:
            err instanceof Error ? err.message : "Failed to fetch prompt.",
        });
      });

    return () => controller.abort();
  }, [apiKey]);

  if (state.status === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader size="sm" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-kumo-danger">{state.message}</p>
      </div>
    );
  }

  return (
    <pre className="h-full overflow-auto whitespace-pre-wrap p-4 font-mono text-sm text-kumo-default">
      {state.prompt}
    </pre>
  );
}

// =============================================================================
// Code tab
// =============================================================================

/** Renders live uiTreeToJsx() output with a copy-to-clipboard button. */
function CodeTabContent({
  tree,
  showTree,
}: {
  readonly tree: UITree;
  readonly showTree: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const jsxCode = useMemo(
    () => (showTree ? uiTreeToJsx(tree) : ""),
    [tree, showTree],
  );

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(jsxCode).then(() => {
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }, [jsxCode]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  if (!showTree) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-kumo-subtle">Generate UI to see code</p>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        icon={copied ? <CheckIcon /> : <CopyIcon />}
        className="absolute right-4 top-4 z-10"
      >
        {copied ? "Copied" : "Copy"}
      </Button>
      <pre className="h-full overflow-auto p-4 font-mono text-sm text-kumo-default">
        {jsxCode}
      </pre>
    </div>
  );
}

// =============================================================================
// Grading tab
// =============================================================================

/** Tree statistics: element count and max depth. */
interface TreeStats {
  readonly elementCount: number;
  readonly maxDepth: number;
}

/** Compute element count and max depth via walkTree. */
function computeTreeStats(tree: UITree): TreeStats {
  let elementCount = 0;
  let maxDepth = 0;
  walkTree(tree, (_element, depth) => {
    elementCount++;
    if (depth > maxDepth) maxDepth = depth;
  });
  return { elementCount, maxDepth };
}

/** Debounce interval for grading during streaming (ms). */
const GRADE_DEBOUNCE_MS = 500;

/**
 * Renders gradeTree() results with debouncing during streaming.
 *
 * During streaming, grades are recomputed at most every 500ms.
 * A final run fires when streaming completes to ensure accuracy.
 */
function GradingTabContent({
  tree,
  showTree,
  isStreaming,
}: {
  readonly tree: UITree;
  readonly showTree: boolean;
  readonly isStreaming: boolean;
}) {
  const [report, setReport] = useState<GradeReport | null>(null);
  const [stats, setStats] = useState<TreeStats | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGradedRef = useRef(0);

  useEffect(() => {
    if (!showTree) {
      setReport(null);
      setStats(null);
      return;
    }

    const runGrade = () => {
      setReport(gradeTree(tree));
      setStats(computeTreeStats(tree));
      lastGradedRef.current = Date.now();
    };

    if (!isStreaming) {
      // Final run — no debounce
      if (debounceRef.current) clearTimeout(debounceRef.current);
      runGrade();
      return;
    }

    // Debounce during streaming
    const elapsed = Date.now() - lastGradedRef.current;
    if (elapsed >= GRADE_DEBOUNCE_MS) {
      runGrade();
    } else if (!debounceRef.current) {
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        runGrade();
      }, GRADE_DEBOUNCE_MS - elapsed);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [tree, showTree, isStreaming]);

  if (!showTree || !report) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-kumo-subtle">Generate UI to see grading</p>
      </div>
    );
  }

  const passCount = report.results.filter((r) => r.pass).length;
  const totalRules = report.results.length;

  return (
    <div className="space-y-4 p-4">
      {/* Overall score + stats */}
      <div className="flex items-baseline gap-4">
        <span className="text-2xl font-semibold text-kumo-default">
          {passCount}/{totalRules}
        </span>
        <span className="text-sm text-kumo-subtle">rules passing</span>
        {stats && (
          <span className="ml-auto text-sm text-kumo-subtle">
            {stats.elementCount} elements &middot; max depth {stats.maxDepth}
          </span>
        )}
      </div>

      {/* Per-rule breakdown */}
      <div className="space-y-2">
        {report.results.map((result) => (
          <div
            key={result.rule}
            className="rounded-lg border border-kumo-line p-3"
          >
            <div className="flex items-center gap-2">
              <span
                className={
                  result.pass ? "text-kumo-success" : "text-kumo-danger"
                }
              >
                {result.pass ? "PASS" : "FAIL"}
              </span>
              <span className="font-mono text-sm text-kumo-default">
                {result.rule}
              </span>
            </div>
            {result.violations.length > 0 && (
              <ul className="mt-2 space-y-1">
                {result.violations.map((v, i) => (
                  <li key={i} className="font-mono text-xs text-kumo-subtle">
                    {v}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
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

// =============================================================================
// Bottom bar
// =============================================================================

/** Status indicator label + icon mapping. */
const STATUS_CONFIG: Record<
  StreamStatus,
  { label: string; className: string; icon: React.ReactNode }
> = {
  idle: {
    label: "Ready",
    className: "text-kumo-subtle",
    icon: <CircleIcon size={12} weight="fill" />,
  },
  streaming: {
    label: "Streaming…",
    className: "text-kumo-brand",
    icon: <SpinnerIcon size={12} className="animate-spin" />,
  },
  error: {
    label: "Error",
    className: "text-kumo-danger",
    icon: <WarningCircleIcon size={12} weight="fill" />,
  },
};

interface PlaygroundBottomBarProps {
  readonly followUpValue: string;
  readonly onFollowUpChange: (value: string) => void;
  readonly isStreaming: boolean;
  readonly status: StreamStatus;
  readonly onSubmit: (e?: FormEvent, overrideMessage?: string) => void;
  readonly turnCount: number;
}

/** Bottom bar: follow-up input for multi-turn + streaming status indicator. */
function PlaygroundBottomBar({
  followUpValue,
  onFollowUpChange,
  isStreaming,
  status,
  onSubmit,
  turnCount,
}: PlaygroundBottomBarProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSubmit();
      }
    },
    [onSubmit],
  );

  const statusInfo = STATUS_CONFIG[status];

  return (
    <div className="shrink-0 border-t border-kumo-line bg-kumo-elevated px-4 py-2 space-y-1.5">
      {/* Follow-up input row */}
      <form onSubmit={(e) => onSubmit(e)} className="flex items-end gap-2">
        <div className="flex-1">
          <InputArea
            value={followUpValue}
            onValueChange={onFollowUpChange}
            onKeyDown={handleKeyDown}
            placeholder="Follow-up message…"
            disabled={isStreaming}
            aria-label="Follow-up prompt"
            rows={1}
            size="sm"
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={isStreaming || !followUpValue.trim()}
          icon={<PaperPlaneRightIcon />}
        >
          Send
        </Button>
      </form>

      {/* Status indicator + turn count */}
      <div className="flex items-center gap-3 text-xs">
        <span className={`flex items-center gap-1.5 ${statusInfo.className}`}>
          {statusInfo.icon}
          {statusInfo.label}
        </span>
        <span className="text-kumo-subtle">
          {Math.ceil(turnCount / 2)}{" "}
          {Math.ceil(turnCount / 2) === 1 ? "turn" : "turns"}
        </span>
      </div>
    </div>
  );
}
