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
  Checkbox,
  CloudflareLogo,
  Empty,
  InputArea,
  Loader,
  Select,
  Stack,
  Tabs,
} from "@cloudflare/kumo";
import type { TabsItem } from "@cloudflare/kumo";
import {
  ArrowCounterClockwiseIcon,
  CaretDownIcon,
  CaretUpIcon,
  CheckIcon,
  CircleIcon,
  CopyIcon,
  LightningIcon,
  LockKeyIcon,
  PaperPlaneRightIcon,
  SpinnerIcon,
  StopCircleIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import {
  useUITree,
  useRuntimeValueStore,
  createJsonlParser,
  BUILTIN_HANDLERS,
  dispatchAction,
  processActionResult,
  type ActionEvent,
  type JsonPatchOp,
  type RuntimeValueStore,
} from "@cloudflare/kumo/streaming";
import type { UITree, UIElement } from "@cloudflare/kumo/streaming";
import {
  UITreeRenderer,
  isRenderableTree,
  uiTreeToJsx,
  gradeTree,
  walkTree,
  defineCustomComponent,
} from "@cloudflare/kumo/generative";
import type { GradeReport } from "@cloudflare/kumo/generative";
import type { CustomComponentDefinition } from "@cloudflare/kumo/catalog";
import { DemoButton } from "./DemoButton";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { readSSEStream } from "~/lib/read-sse-stream";
import { HighlightedCode } from "~/components/HighlightedCode";
import { ThemeToggle } from "~/components/ThemeToggle";
import type { BundledLanguage } from "shiki";

// =============================================================================
// Custom components — must match the metadata in lib/playground.ts so the
// renderer can instantiate what the LLM is told about in the system prompt.
// =============================================================================

const demoButtonDef = defineCustomComponent({
  component: DemoButton,
  description: "A fancy button with a rainbow conic-gradient hover effect",
  props: {
    children: { type: "string", description: "Button label text" },
    variant: {
      type: "string",
      description: "Visual variant",
      values: ["light", "dark"] as const,
      default: "light",
      optional: true,
    },
  },
});

const CUSTOM_COMPONENTS: Readonly<Record<string, CustomComponentDefinition>> = {
  DemoButton: demoButtonDef,
};

/** Custom type names for the grader so it doesn't flag them as unknown. */
const CUSTOM_COMPONENT_TYPES: ReadonlySet<string> = new Set(
  Object.keys(CUSTOM_COMPONENTS),
);

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
type PlaygroundTab =
  | "preview"
  | "code"
  | "jsonl"
  | "system-prompt"
  | "actions"
  | "grading";

/** Tab definitions for the playground content area. */
const PLAYGROUND_TABS: TabsItem[] = [
  { value: "preview", label: "Preview" },
  { value: "code", label: "Code" },
  { value: "jsonl", label: "JSONL" },
  { value: "system-prompt", label: "System Prompt" },
  { value: "actions", label: "Actions" },
  { value: "grading", label: "Grading" },
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

/** Logged action event with timestamp. */
interface ActionLogEntry {
  readonly timestamp: string;
  readonly event: ActionEvent;
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
  { value: "gpt-oss-120b", label: "GPT OSS 120B" },
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
    prompt:
      "Show a user profile card: heading with the person's name, a role Badge and department text on one line (Cluster), and a 2-column Grid for email and join date key-value pairs. No buttons.",
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
// Skills hook
// =============================================================================

/** Skill metadata returned by /api/chat/skills. */
interface SkillMeta {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

/**
 * Fetches available skills from the API on mount.
 * Returns the list of skills (empty array on failure).
 */
function usePlaygroundSkills(apiKey: string | null): readonly SkillMeta[] {
  const [skills, setSkills] = useState<readonly SkillMeta[]>([]);

  useEffect(() => {
    if (!apiKey) return;

    const controller = new AbortController();

    fetch("/api/chat/skills", {
      headers: { "X-Playground-Key": apiKey },
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) return;
        const data: unknown = await res.json();
        if (
          typeof data === "object" &&
          data !== null &&
          "skills" in data &&
          Array.isArray((data as { skills: unknown }).skills)
        ) {
          setSkills((data as { skills: SkillMeta[] }).skills);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.warn("[playground] Failed to load skills:", err);
      });

    return () => controller.abort();
  }, [apiKey]);

  return skills;
}

// =============================================================================
// Component
// =============================================================================

export function PlaygroundPage() {
  const { auth, apiKey } = usePlaygroundAuth();

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-kumo-base text-kumo-default">
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

/** Main playground UI. Side-by-side layout: content left, chat right. */
function AuthenticatedState({ apiKey }: { apiKey: string | null }) {
  // --- Skills ---
  const availableSkills = usePlaygroundSkills(apiKey);
  const [enabledSkillIds, setEnabledSkillIds] = useState<ReadonlySet<string>>(
    new Set(),
  );

  // --- Input state ---
  const [inputValue, setInputValue] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);

  // --- Tab state (persists across generations) ---
  const [activeTab, setActiveTab] = useState<PlaygroundTab>("preview");

  // --- Streaming state ---
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [rawJsonl, setRawJsonl] = useState("");
  const lastSubmittedRef = useRef<string | null>(null);

  // --- Action log ---
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);
  const clearActionLog = useCallback(() => setActionLog([]), []);

  // --- Refs ---
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Stable refs for action handler closures (avoids stale captures)
  const treeRef = useRef<UITree>({ root: "", elements: {} });
  const applyPatchesRef = useRef<(patches: readonly JsonPatchOp[]) => void>(
    () => {},
  );
  const handleSubmitRef = useRef<
    (e?: FormEvent, overrideMessage?: string) => void
  >(() => {});

  // --- Action handler ---
  const handleAction = useCallback((event: ActionEvent) => {
    setActionLog((prev) => [
      ...prev,
      { timestamp: new Date().toISOString(), event },
    ]);

    // Don't actually submit forms in the playground — just log + preview
    if (event.actionName === "submit_form") return;

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
        const safeTarget = target === "_self" ? "_self" : "_blank";
        const w = window.open(url, safeTarget, "noopener,noreferrer");
        if (w) w.opener = null;
      },
    });
  }, []);

  // --- UITree hooks ---
  const runtimeValueStore = useRuntimeValueStore();
  const { tree, applyPatches, reset } = useUITree({
    batchPatches: true,
    onAction: handleAction,
  });

  // Keep stable refs in sync
  treeRef.current = tree;
  applyPatchesRef.current = applyPatches;

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // --- Auto-scroll chat to bottom on new messages ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const isStreaming = status === "streaming";

  // --- Cancel in-flight stream ---
  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
  }, []);

  // --- Dismiss error banner ---
  const handleDismissError = useCallback(() => {
    setErrorMessage(null);
    setStatus("idle");
  }, []);

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
      setRawJsonl("");
      setActionLog([]);
      lastSubmittedRef.current = msg;

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
              ...(enabledSkillIds.size > 0
                ? { skillIds: [...enabledSkillIds] }
                : {}),
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
              setRawJsonl((prev) => prev + token);
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
            // Roll back the user message added at submit — retry will re-add it
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === "user") return prev.slice(0, -1);
              return prev;
            });
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
      enabledSkillIds,
      runtimeValueStore,
      reset,
      applyPatches,
    ],
  );

  // Keep handleSubmit ref in sync for action dispatch
  handleSubmitRef.current = handleSubmit;

  // --- Auto-regenerate when skills change ---
  // Tracks whether the initial mount has passed so the effect only fires
  // on actual skill toggle changes, not on the initial render.
  const skillsInitRef = useRef(false);
  useEffect(() => {
    if (!skillsInitRef.current) {
      skillsInitRef.current = true;
      return;
    }
    const lastPrompt = lastSubmittedRef.current;
    if (lastPrompt && !isStreaming) {
      // Clear conversation history so regeneration is a fresh single-turn
      // with the same prompt but different skills context.
      setMessages([]);
      handleSubmit(undefined, lastPrompt);
    }
    // Only fire when enabledSkillIds changes — handleSubmit and isStreaming
    // are intentionally omitted to avoid looping.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledSkillIds]);

  const showTree = isRenderableTree(tree);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left: tabbed content area */}
      <div className="flex flex-1 min-w-0 flex-col">
        {/* Tab bar — h-[61px] matches sidebar header */}
        <div className="flex h-[61px] shrink-0 items-center justify-between border-b border-kumo-line px-4">
          <div className="flex items-center gap-3">
            <CloudflareLogo variant="glyph" className="h-5 w-auto shrink-0" />
            <Tabs
              variant="segmented"
              tabs={PLAYGROUND_TABS}
              value={activeTab}
              onValueChange={(v) => {
                if (isPlaygroundTab(v)) setActiveTab(v);
              }}
            />
          </div>
          <ThemeToggle />
        </div>

        {/* Preset pills — always visible, horizontally scrollable */}
        <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-kumo-line px-4 py-2">
          {PRESET_PROMPTS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              disabled={isStreaming}
              onClick={() => handleSubmit(undefined, preset.prompt)}
              className="shrink-0 rounded-full border border-kumo-line bg-kumo-base px-2.5 py-1 text-xs text-kumo-subtle transition-colors hover:border-kumo-brand hover:text-kumo-brand disabled:cursor-not-allowed disabled:opacity-50"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Error banner */}
        {status === "error" && errorMessage && (
          <ErrorBanner
            message={errorMessage}
            onDismiss={handleDismissError}
            onRetry={() => {
              const retryMsg = lastSubmittedRef.current;
              if (retryMsg) {
                handleDismissError();
                handleSubmit(undefined, retryMsg);
              }
            }}
            canRetry={lastSubmittedRef.current !== null}
          />
        )}

        {/* Tab content */}
        <div className="relative flex-1 overflow-auto">
          {/* Streaming progress indicator — pinned to top of content area */}
          {isStreaming && (
            <div
              className="sticky top-0 z-10 h-0.5 w-full bg-kumo-brand/30"
              aria-label="Streaming in progress"
            >
              <div
                className="h-full w-1/3 bg-kumo-brand"
                style={{
                  animation: "shimmer 1.5s ease-in-out infinite",
                }}
              />
            </div>
          )}
          <PlaygroundTabContent
            activeTab={activeTab}
            showTree={showTree}
            tree={tree}
            runtimeValueStore={runtimeValueStore}
            isStreaming={isStreaming}
            apiKey={apiKey}
            rawJsonl={rawJsonl}
            actionLog={actionLog}
            onClearActionLog={clearActionLog}
          />
        </div>
      </div>

      {/* Right: chat sidebar */}
      <PlaygroundChatSidebar
        inputValue={inputValue}
        onInputChange={setInputValue}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        isStreaming={isStreaming}
        status={status}
        messages={messages}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        messagesEndRef={messagesEndRef}
        availableSkills={availableSkills}
        enabledSkillIds={enabledSkillIds}
        onSkillToggle={setEnabledSkillIds}
      />
    </div>
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
  readonly apiKey: string | null;
  readonly rawJsonl: string;
  readonly actionLog: readonly ActionLogEntry[];
  readonly onClearActionLog: () => void;
}

/**
 * Renders the active tab's content panel.
 * Error handling is done via the ErrorBanner above, not here.
 */
function PlaygroundTabContent({
  activeTab,
  showTree,
  tree,
  runtimeValueStore,
  isStreaming,
  apiKey,
  rawJsonl,
  actionLog,
  onClearActionLog,
}: PlaygroundTabContentProps) {
  switch (activeTab) {
    case "preview":
      return showTree ? (
        <div className="p-4">
          <UITreeRenderer
            tree={tree}
            streaming={isStreaming}
            runtimeValueStore={runtimeValueStore}
            customComponents={CUSTOM_COMPONENTS}
          />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
          <p className="text-kumo-subtle">Enter a prompt to generate UI</p>
        </div>
      );

    case "code":
      return <CodeTabContent tree={tree} showTree={showTree} />;

    case "jsonl":
      return <JsonTabContent rawJsonl={rawJsonl} />;

    case "system-prompt":
      return <SystemPromptTabContent apiKey={apiKey} />;

    case "actions":
      return (
        <ActionsTabContent
          tree={tree}
          runtimeValueStore={runtimeValueStore}
          actionLog={actionLog}
          onClearActionLog={onClearActionLog}
        />
      );

    case "grading":
      return (
        <GradingTabContent
          tree={tree}
          showTree={showTree}
          isStreaming={isStreaming}
        />
      );
  }
}

// =============================================================================
// Actions tab
// =============================================================================

/** Format ISO timestamp as HH:MM:SS.mmm. */
function formatActionTimestamp(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

/** Single action log row with timestamp, action name, source, params. */
function ActionLogRow({ entry }: { readonly entry: ActionLogEntry }) {
  const { event, timestamp } = entry;
  const ts = formatActionTimestamp(timestamp);

  const detailParts: string[] = [];
  if (event.params != null) {
    detailParts.push(`params=${JSON.stringify(event.params)}`);
  }
  if (event.context != null) {
    detailParts.push(`ctx=${JSON.stringify(event.context)}`);
  }
  const detail = detailParts.length > 0 ? ` ${detailParts.join(" ")}` : "";

  return (
    <div className="flex flex-col gap-0.5 border-b border-kumo-line py-1.5 font-mono text-xs last:border-0">
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className="text-kumo-subtle">{ts}</span>
        <span className="font-semibold text-kumo-brand">
          {event.actionName}
        </span>
        <span className="text-kumo-subtle">from</span>
        <span className="text-kumo-default">{event.sourceKey}</span>
        {detail && <span className="text-kumo-subtle break-all">{detail}</span>}
      </div>
      {event.actionName === "submit_form" && (
        <div className="mt-0.5 text-kumo-subtle">
          {"-> POST /api/actions "}
          {JSON.stringify({
            actionName: event.actionName,
            sourceKey: event.sourceKey,
            ...(event.params != null ? { params: event.params } : undefined),
            ...(event.context != null ? { context: event.context } : undefined),
          })}
        </div>
      )}
    </div>
  );
}

/** Finds the first submit_form action in the tree. */
function findSubmitAction(tree: UITree): {
  readonly sourceKey: string;
  readonly action: NonNullable<UIElement["action"]>;
} | null {
  for (const [key, el] of Object.entries(tree.elements)) {
    if (!el?.action) continue;
    if (el.action.name !== "submit_form") continue;
    return { sourceKey: key, action: el.action };
  }
  return null;
}

/**
 * Actions tab: split view with action event log (top) and live submit
 * payload preview (bottom). Mirrors the action panels from _StreamingDemo.
 */
function ActionsTabContent({
  tree,
  runtimeValueStore,
  actionLog,
  onClearActionLog,
}: {
  readonly tree: UITree;
  readonly runtimeValueStore: RuntimeValueStore;
  readonly actionLog: readonly ActionLogEntry[];
  readonly onClearActionLog: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll action log
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [actionLog]);

  // --- Submit payload preview ---
  const submit = useMemo(() => findSubmitAction(tree), [tree]);

  const [runtimeValues, setRuntimeValues] = useState<
    Readonly<Record<string, unknown>>
  >({});

  useEffect(() => {
    const update = () => setRuntimeValues(runtimeValueStore.snapshotAll());
    update();
    return runtimeValueStore.subscribe(update);
  }, [runtimeValueStore]);

  const payloadText = useMemo(() => {
    if (!submit) return "";
    const body: Record<string, unknown> = {
      actionName: "submit_form",
      sourceKey: submit.sourceKey,
      context: { runtimeValues },
    };
    if (submit.action.params != null) {
      body.params = submit.action.params;
    }
    return JSON.stringify(body, null, 2);
  }, [submit, runtimeValues]);

  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopyPayload = useCallback(() => {
    if (!payloadText) return;
    void navigator.clipboard.writeText(payloadText).then(() => {
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }, [payloadText]);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* Action event log */}
      <div className="flex flex-1 flex-col rounded-lg border border-kumo-line bg-kumo-elevated overflow-hidden">
        <div className="flex items-center justify-between border-b border-kumo-line px-3 py-2">
          <span className="text-xs font-semibold text-kumo-default">
            Action Events
          </span>
          <button
            type="button"
            onClick={onClearActionLog}
            className="text-[10px] text-kumo-subtle hover:text-kumo-default"
          >
            Clear
          </button>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-1.5">
          {actionLog.length === 0 ? (
            <span className="text-xs text-kumo-subtle">
              Interact with generated UI to see action events here.
            </span>
          ) : (
            actionLog.map((entry, i) => <ActionLogRow key={i} entry={entry} />)
          )}
        </div>
      </div>

      {/* Submit payload preview */}
      <div className="flex flex-1 flex-col rounded-lg border border-kumo-line bg-kumo-elevated overflow-hidden">
        <div className="flex items-center justify-between border-b border-kumo-line px-3 py-2">
          <span className="text-xs font-semibold text-kumo-default">
            Submit Payload
          </span>
          <button
            type="button"
            onClick={handleCopyPayload}
            disabled={!payloadText}
            className="text-[10px] text-kumo-subtle hover:text-kumo-default disabled:opacity-40"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {payloadText ? (
            <HighlightedCode code={payloadText} lang="json" />
          ) : (
            <p className="px-3 py-1.5 text-xs text-kumo-subtle">
              No submit_form action in current tree.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// JSON tab
// =============================================================================

/**
 * Pretty-prints each JSONL line and renders with syntax highlighting.
 * Shows the raw RFC 6902 JSON Patch operations streamed from the LLM.
 */
function JsonTabContent({ rawJsonl }: { readonly rawJsonl: string }) {
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const formattedJson = useMemo(() => {
    if (!rawJsonl.trim()) return "";
    return rawJsonl
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        try {
          return JSON.stringify(JSON.parse(line), null, 2);
        } catch {
          return line;
        }
      })
      .join("\n");
  }, [rawJsonl]);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(formattedJson).then(() => {
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }, [formattedJson]);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  if (!formattedJson) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-kumo-subtle">Generate UI to see JSON output</p>
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
      <div className="h-full overflow-auto">
        <HighlightedCode code={formattedJson} lang="json" />
      </div>
    </div>
  );
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
 * Languages loaded in the Shiki highlighter. If the markdown fenced block
 * specifies an unknown language we fall back to plain text rendering.
 */
const LOADED_LANGS = new Set<string>([
  "tsx",
  "typescript",
  "json",
  "markdown",
  "bash",
  "css",
  "html",
]);

/** Markdown code-block renderer — uses HighlightedCode for fenced blocks. */
function MarkdownCodeBlock({
  className,
  children,
}: {
  readonly className?: string;
  readonly children?: React.ReactNode;
}) {
  const match = /language-(\w+)/.exec(className ?? "");
  const code = String(children).replace(/\n$/, "");

  if (match && LOADED_LANGS.has(match[1])) {
    return <HighlightedCode code={code} lang={match[1] as BundledLanguage} />;
  }
  // Inline code or unknown language — render as plain <code>
  return <code className={className}>{children}</code>;
}

/** Shared remark plugins — stable reference to avoid re-renders. */
const REMARK_PLUGINS = [remarkGfm];

/** Shared component overrides for react-markdown. */
const MARKDOWN_COMPONENTS = {
  code: MarkdownCodeBlock,
} as const;

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
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleCopy = useCallback(() => {
    if (state.status !== "loaded") return;
    void navigator.clipboard.writeText(state.prompt).then(() => {
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }, [state]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

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
      <div className="markdown-prose h-full overflow-auto p-4 text-kumo-default">
        <Markdown
          remarkPlugins={REMARK_PLUGINS}
          components={MARKDOWN_COMPONENTS}
        >
          {state.prompt}
        </Markdown>
      </div>
    </div>
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
      <div className="h-full overflow-auto">
        <HighlightedCode code={jsxCode} lang="tsx" />
      </div>
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

/** Human-readable description for each grading rule. */
const RULE_DESCRIPTIONS: Readonly<Record<string, string>> = {
  "valid-component-types": "Every element's type is in KNOWN_TYPES",
  "valid-prop-values": "Enum prop values pass Zod schema validation",
  "required-props": "Text has children; form elements have label/aria-label",
  "canonical-layout": "Root Surface wraps children in a single Stack",
  "no-orphan-nodes":
    "Every non-root element is referenced by a parent's children",
  "a11y-labels":
    "Form elements (Input, Textarea, Select, Checkbox, Switch, RadioGroup) have labels",
  "depth-limit": "No element exceeds depth 8",
  "no-redundant-children":
    "props.children is never an array (structural children go in UIElement.children)",
};

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
      setReport(gradeTree(tree, { customTypes: CUSTOM_COMPONENT_TYPES }));
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
            {RULE_DESCRIPTIONS[result.rule] && (
              <p className="mt-1 text-xs text-kumo-subtle">
                {RULE_DESCRIPTIONS[result.rule]}
              </p>
            )}
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
// Error banner
// =============================================================================

interface ErrorBannerProps {
  readonly message: string;
  readonly onDismiss: () => void;
  readonly onRetry: () => void;
  readonly canRetry: boolean;
}

/** Dismissible error banner with retry action. Renders between tab bar and content. */
function ErrorBanner({
  message,
  onDismiss,
  onRetry,
  canRetry,
}: ErrorBannerProps) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-kumo-line bg-kumo-recessed px-4 py-2">
      <WarningCircleIcon
        size={16}
        weight="fill"
        className="shrink-0 text-kumo-danger"
      />
      <p className="flex-1 text-sm text-kumo-danger">{message}</p>
      {canRetry && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          icon={<ArrowCounterClockwiseIcon />}
        >
          Retry
        </Button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded p-1 text-kumo-subtle transition-colors hover:bg-kumo-elevated hover:text-kumo-default"
        aria-label="Dismiss error"
      >
        <XCircleIcon size={16} />
      </button>
    </div>
  );
}

// =============================================================================
// Assistant message summary
// =============================================================================

/**
 * Summarises an assistant JSONL response as a short human-readable line
 * instead of dumping the raw patch operations into the chat bubble.
 */
function AssistantMessageSummary({ content }: { readonly content: string }) {
  const summary = useMemo(() => {
    const lines = content.split("\n").filter((l) => l.trim());
    const types = new Set<string>();

    for (const line of lines) {
      try {
        const parsed: unknown = JSON.parse(line);
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          "op" in parsed &&
          (parsed as { op: string }).op === "add" &&
          "value" in parsed
        ) {
          const value: unknown = (parsed as { value: unknown }).value;
          if (typeof value === "object" && value !== null && "type" in value) {
            types.add((value as { type: string }).type);
          }
        }
      } catch {
        // not JSON — skip
      }
    }

    if (types.size === 0) return `Generated ${String(lines.length)} patch ops`;
    const typeList = [...types].slice(0, 4).join(", ");
    const suffix = types.size > 4 ? `, +${String(types.size - 4)} more` : "";
    return `Generated UI with ${typeList}${suffix}`;
  }, [content]);

  return <p className="text-kumo-subtle italic text-xs">{summary}</p>;
}

// =============================================================================
// Chat sidebar (right panel)
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

interface PlaygroundChatSidebarProps {
  readonly inputValue: string;
  readonly onInputChange: (value: string) => void;
  readonly selectedModel: string;
  readonly onModelChange: (value: string) => void;
  readonly isStreaming: boolean;
  readonly status: StreamStatus;
  readonly messages: readonly ChatMessage[];
  readonly onSubmit: (e?: FormEvent, overrideMessage?: string) => void;
  readonly onCancel: () => void;
  readonly messagesEndRef: React.RefObject<HTMLDivElement | null>;
  readonly availableSkills: readonly SkillMeta[];
  readonly enabledSkillIds: ReadonlySet<string>;
  readonly onSkillToggle: (
    updater: (prev: ReadonlySet<string>) => ReadonlySet<string>,
  ) => void;
}

/** Right-hand chat panel: model selector, messages, skills, input. */
function PlaygroundChatSidebar({
  inputValue,
  onInputChange,
  selectedModel,
  onModelChange,
  isStreaming,
  status,
  messages,
  onSubmit,
  onCancel,
  messagesEndRef,
  availableSkills,
  enabledSkillIds,
  onSkillToggle,
}: PlaygroundChatSidebarProps) {
  const [skillsExpanded, setSkillsExpanded] = useState(false);
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
  const turnCount = messages.length;
  const hasMessages = messages.length > 0;

  return (
    <aside
      className="hidden md:flex h-full w-[380px] shrink-0 flex-col border-l border-kumo-line bg-kumo-overlay"
      aria-label="Chat sidebar"
    >
      {/* Header: model selector + status — h-[61px] matches left panel tab bar */}
      <div className="flex h-[61px] shrink-0 items-center gap-2 px-4">
        <div className="flex-1">
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
        <span
          className={`flex items-center gap-1.5 text-xs ${statusInfo.className}`}
        >
          {statusInfo.icon}
          {statusInfo.label}
        </span>
        {turnCount > 0 && (
          <span className="text-xs text-kumo-subtle">
            {Math.ceil(turnCount / 2)}{" "}
            {Math.ceil(turnCount / 2) === 1 ? "turn" : "turns"}
          </span>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
        {!hasMessages && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-kumo-subtle">
              Describe the UI you want to generate
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={
              msg.role === "user" ? "flex justify-end" : "flex justify-start"
            }
          >
            <div
              className={
                msg.role === "user"
                  ? "max-w-[85%] rounded-lg bg-kumo-brand px-3 py-2 text-sm text-white"
                  : "max-w-[85%] rounded-lg bg-kumo-elevated border border-kumo-line px-3 py-2 text-sm text-kumo-default"
              }
            >
              {msg.role === "assistant" ? (
                <AssistantMessageSummary content={msg.content} />
              ) : (
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {/* Streaming indicator in chat */}
        {isStreaming && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-kumo-elevated border border-kumo-line px-3 py-2">
              <SpinnerIcon size={14} className="animate-spin text-kumo-brand" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Skills panel */}
      {availableSkills.length > 0 && (
        <div className="shrink-0 border-t border-kumo-line">
          <button
            type="button"
            onClick={() => setSkillsExpanded((prev) => !prev)}
            className="flex w-full items-center gap-2 px-4 py-2 text-xs text-kumo-subtle transition-colors hover:text-kumo-default"
          >
            <LightningIcon size={14} />
            <span className="flex-1 text-left font-medium">
              Skills
              {enabledSkillIds.size > 0 && (
                <span className="ml-1.5 text-kumo-brand">
                  ({String(enabledSkillIds.size)})
                </span>
              )}
            </span>
            {skillsExpanded ? (
              <CaretUpIcon size={12} />
            ) : (
              <CaretDownIcon size={12} />
            )}
          </button>
          {skillsExpanded && (
            <div className="max-h-[200px] overflow-auto px-4 pb-2">
              <Stack gap="xs">
                {availableSkills.map((skill) => {
                  const checked = enabledSkillIds.has(skill.id);
                  return (
                    <Checkbox
                      key={skill.id}
                      label={
                        <span title={skill.description}>{skill.name}</span>
                      }
                      checked={checked}
                      onCheckedChange={() => {
                        onSkillToggle((prev) => {
                          const next = new Set(prev);
                          if (checked) {
                            next.delete(skill.id);
                          } else {
                            next.add(skill.id);
                          }
                          return next;
                        });
                      }}
                      disabled={isStreaming}
                      aria-label={`Enable ${skill.name} skill`}
                    />
                  );
                })}
              </Stack>
            </div>
          )}
        </div>
      )}

      {/* Input area at bottom */}
      <div className="shrink-0 border-t border-kumo-line px-4 py-3 space-y-2">
        <form onSubmit={(e) => onSubmit(e)} className="flex flex-col gap-2">
          <InputArea
            value={inputValue}
            onValueChange={onInputChange}
            onKeyDown={handleKeyDown}
            placeholder={
              hasMessages ? "Follow up…" : "Describe the UI you want..."
            }
            disabled={isStreaming}
            aria-label="Prompt"
            rows={2}
          />
          <div className="flex justify-end">
            {isStreaming ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCancel}
                icon={<StopCircleIcon />}
              >
                Cancel
              </Button>
            ) : (
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!inputValue.trim()}
                icon={<PaperPlaneRightIcon />}
              >
                Send
              </Button>
            )}
          </div>
        </form>
      </div>
    </aside>
  );
}
