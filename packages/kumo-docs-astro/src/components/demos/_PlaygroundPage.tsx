/**
 * PlaygroundPage — full-page streaming UI playground.
 *
 * Side-by-side A/B comparison: each panel ("System Prompt" vs "No System
 * Prompt") has its own tab bar (Preview, Code, JSONL, Grading, Prompt)
 * so outputs can be inspected independently.
 *
 * Loaded at /playground with client:load — all logic is client-side.
 * Auth is gated by ?key= query param validated against /api/chat/prompt.
 */

/**
 * Minimal baseline prompt for the "no system prompt" comparison stream.
 *
 * Contains only the bare-minimum JSONL format spec and a single example so the
 * LLM produces parseable output. No design rules, no component docs, no
 * layout guidance — isolating the contribution of the full system prompt.
 */
const BASELINE_PROMPT = `You create user interfaces by responding ONLY with JSONL — one JSON Patch operation per line. No plain text, no markdown fences, no explanations.

Each line is: {"op":"add","path":"<json-pointer>","value":<value>}

You build this structure: { root: "element-key", elements: { [key]: UIElement } }
Where UIElement is: { key: string, type: string, props: object, children?: string[], parentKey?: string }

Order:
1. First line: {"op":"add","path":"/root","value":"<root-key>"}
2. Then add elements top-down (parent before children). Parents include children array upfront.

Available types: Surface, Stack, Grid, Cluster, Text, Button, Input, Select, SelectOption, Textarea, Badge, Switch, Checkbox, Table, TableHead, TableBody, TableRow, TableCell, TableHeader, Tabs, Code, Link, Banner, Field, Label, Empty, Loader, Meter, Flow, FlowNode, Div

Rules: unique kebab-case keys, key field matches path, compact JSON, one object per line.

Example — User: "Show a user profile card"

{"op":"add","path":"/root","value":"card"}
{"op":"add","path":"/elements/card","value":{"key":"card","type":"Surface","props":{},"children":["stack"]}}
{"op":"add","path":"/elements/stack","value":{"key":"stack","type":"Stack","props":{"gap":"lg"},"children":["name","role","actions"],"parentKey":"card"}}
{"op":"add","path":"/elements/name","value":{"key":"name","type":"Text","props":{"children":"Jane Cooper","variant":"heading2"},"parentKey":"stack"}}
{"op":"add","path":"/elements/role","value":{"key":"role","type":"Text","props":{"children":"Engineering · Admin","variant":"secondary"},"parentKey":"stack"}}
{"op":"add","path":"/elements/actions","value":{"key":"actions","type":"Cluster","props":{"gap":"sm"},"children":["edit-btn"],"parentKey":"stack"}}
{"op":"add","path":"/elements/edit-btn","value":{"key":"edit-btn","type":"Button","props":{"children":"Edit profile","variant":"primary"},"parentKey":"actions"}}`;

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
  CloudflareLogo,
  Cluster,
  Grid,
  GridItem,
  InputArea,
  Loader,
  Select,
  Tabs,
} from "@cloudflare/kumo";
import type { TabsItem } from "@cloudflare/kumo";
import {
  ArrowCounterClockwiseIcon,
  ArrowLeftIcon,
  CheckIcon,
  CircleIcon,
  CopyIcon,
  PaperPlaneRightIcon,
  SidebarSimpleIcon,
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
  gradeComposition,
  COMPOSITION_RULE_NAMES,
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

/** Streaming lifecycle state. */
type StreamStatus = "idle" | "streaming" | "error";

/** Per-panel tab identifiers (each side-by-side panel has its own tabs). */
type PanelTab = "preview" | "code" | "jsonl" | "actions" | "grading" | "prompt";

/** Shared className override to shrink tab text for tight panel headers. */
const PANEL_TAB_CLASS = "text-xs";

/** Tab definitions for each panel. Both panels have the same tabs. */
const PANEL_TABS: TabsItem[] = [
  { value: "preview", label: "UI", className: PANEL_TAB_CLASS },
  { value: "code", label: "Code", className: PANEL_TAB_CLASS },
  { value: "jsonl", label: "JSONL", className: PANEL_TAB_CLASS },
  { value: "actions", label: "Actions", className: PANEL_TAB_CLASS },
  { value: "grading", label: "Grade", className: PANEL_TAB_CLASS },
  { value: "prompt", label: "Prompt", className: PANEL_TAB_CLASS },
];

/** Logged action event with timestamp. */
interface ActionLogEntry {
  readonly timestamp: string;
  readonly event: ActionEvent;
}

const PANEL_TAB_VALUES = new Set<string>(PANEL_TABS.map((t) => t.value));

/** Type guard for PanelTab values. */
function isPanelTab(value: string): value is PanelTab {
  return PANEL_TAB_VALUES.has(value);
}

/** Conversation message for multi-turn. */
interface ChatMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

/** Skill metadata fetched from /api/chat/skills (client-side mirror of SkillMeta). */
interface SkillInfo {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

// =============================================================================
// Helpers
// =============================================================================

/** Extract `error` string from an unknown JSON error body, or null. */
function extractErrorMessage(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  if (!("error" in body)) return null;
  const narrow: { error: unknown } = body;
  return typeof narrow.error === "string" ? narrow.error : null;
}

/** Extract `prompt` string from an unknown JSON body, or null. */
function extractPromptString(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  if (!("prompt" in body)) return null;
  const narrow: { prompt: unknown } = body;
  return typeof narrow.prompt === "string" ? narrow.prompt : null;
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
 * Preset prompts: 5 card-level (from _StreamingDemo) + 1 page-level.
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
  // Page-level preset
  {
    label: "Workers flow",
    prompt:
      "Build a Cloudflare Workers page with two sections stacked vertically. " +
      "Top section: a Flow diagram showing the request lifecycle — " +
      "a 'Client Request' node, then a FlowParallel with 'WAF Rules' and 'Rate Limiting' nodes, " +
      "then a 'my-worker' node, then a FlowParallel with 'KV Store' and 'D1 Database' nodes, " +
      "then a 'Response' node. " +
      "Bottom section: a Table with columns Name, Type, and Resource showing worker bindings — " +
      "rows for MY_KV (KV Namespace, production-kv), MY_DB (D1 Database, worker-db), " +
      "AUTH_SERVICE (Service Binding, auth-worker), and ASSETS (R2 Bucket, static-assets).",
  },
] as const;

// =============================================================================
// Component
// =============================================================================

export function PlaygroundPage() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-kumo-base text-kumo-default">
      <PlaygroundContent />
    </div>
  );
}

// =============================================================================
// Playground content
// =============================================================================

/** Main playground UI. Side-by-side layout: content left, chat right. */
function PlaygroundContent() {
  // --- Input state ---
  const [inputValue, setInputValue] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);

  // --- Per-panel tab state (persists across generations) ---
  const [leftTab, setLeftTab] = useState<PanelTab>("preview");
  const [rightTab, setRightTab] = useState<PanelTab>("preview");

  // --- Chat sidebar collapse state ---
  const [chatMinimized, setChatMinimized] = useState(false);
  const toggleChat = useCallback(() => setChatMinimized((v) => !v), []);

  // --- Streaming state ---
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [rawJsonl, setRawJsonl] = useState("");
  const rawJsonlRef = useRef("");
  const lastSubmittedRef = useRef<string | null>(null);

  // --- Action logs (independent per panel) ---
  const [leftActionLog, setLeftActionLog] = useState<ActionLogEntry[]>([]);
  const clearLeftActionLog = useCallback(() => setLeftActionLog([]), []);
  const [rightActionLog, setRightActionLog] = useState<ActionLogEntry[]>([]);
  const clearRightActionLog = useCallback(() => setRightActionLog([]), []);

  // --- "No prompt" panel state ---
  const [noPromptRawJsonl, setNoPromptRawJsonl] = useState("");
  const noPromptRawJsonlRef = useRef("");
  const [noPromptStatus, setNoPromptStatus] = useState<StreamStatus>("idle");

  // --- System prompt text (fetched once for the prompt-view toggle) ---
  const [systemPromptText, setSystemPromptText] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/chat/prompt", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) return;
        const data: unknown = await res.json();
        const prompt = extractPromptString(data);
        if (prompt !== null) setSystemPromptText(prompt);
      })
      .catch(() => {
        /* ignore �� prompt view will show fallback */
      });
    return () => controller.abort();
  }, []);

  // --- Skill picker state ---
  const [skills, setSkills] = useState<readonly SkillInfo[]>([]);
  const [pendingSkillIds, setPendingSkillIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [appliedSkillIds, setAppliedSkillIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  // Fetch skill metadata on mount.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/chat/skills", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) return;
        const data: unknown = await res.json();
        if (
          typeof data === "object" &&
          data !== null &&
          "skills" in data &&
          Array.isArray((data as { skills: unknown }).skills)
        ) {
          const raw = (data as { skills: unknown[] }).skills;
          const parsed: SkillInfo[] = [];
          for (const item of raw) {
            if (
              typeof item === "object" &&
              item !== null &&
              "id" in item &&
              "name" in item &&
              "description" in item
            ) {
              const s = item as {
                id: unknown;
                name: unknown;
                description: unknown;
              };
              if (
                typeof s.id === "string" &&
                typeof s.name === "string" &&
                typeof s.description === "string"
              ) {
                parsed.push({
                  id: s.id,
                  name: s.name,
                  description: s.description,
                });
              }
            }
          }
          setSkills(parsed);
        }
      })
      .catch(() => {
        /* ignore — skill picker will be empty */
      });
    return () => controller.abort();
  }, []);

  // --- Refs ---
  const abortRef = useRef<AbortController | null>(null);
  /** Separate abort controller for the no-prompt stream. */
  const noPromptAbortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Stable refs for action handler closures (avoids stale captures)
  const treeRef = useRef<UITree>({ root: "", elements: {} });
  const noPromptTreeRef = useRef<UITree>({ root: "", elements: {} });
  const applyPatchesRef = useRef<(patches: readonly JsonPatchOp[]) => void>(
    () => {},
  );
  const noPromptApplyPatchesRef = useRef<
    (patches: readonly JsonPatchOp[]) => void
  >(() => {});
  const handleSubmitRef = useRef<
    (e?: FormEvent, overrideMessage?: string) => void
  >(() => {});

  // --- Action handler (left panel) ---
  const handleAction = useCallback((event: ActionEvent) => {
    setLeftActionLog((prev) => [
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
        // Defense-in-depth: validate URL scheme even though dispatchAction
        // already sanitizes via the action registry.
        try {
          const parsed = new URL(url, window.location.href);
          if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return;
          }
        } catch {
          return;
        }
        const safeTarget = target === "_self" ? "_self" : "_blank";
        window.open(url, safeTarget, "noopener,noreferrer");
      },
    });
  }, []);

  // --- UITree hooks ---
  const runtimeValueStore = useRuntimeValueStore();
  const { tree, applyPatches, reset } = useUITree({
    batchPatches: true,
    onAction: handleAction,
  });

  // --- Action handler (right panel) ---
  const handleNoPromptAction = useCallback((event: ActionEvent) => {
    setRightActionLog((prev) => [
      ...prev,
      { timestamp: new Date().toISOString(), event },
    ]);

    if (event.actionName === "submit_form") return;

    const result = dispatchAction(
      BUILTIN_HANDLERS,
      event,
      noPromptTreeRef.current,
    );
    if (result === null) return;
    processActionResult(result, {
      applyPatches: (patches: readonly JsonPatchOp[]) => {
        noPromptApplyPatchesRef.current(patches);
      },
      sendMessage: (content: string) => {
        handleSubmitRef.current(undefined, content);
      },
      openExternal: (url: string, target: string) => {
        try {
          const parsed = new URL(url, window.location.href);
          if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return;
          }
        } catch {
          return;
        }
        const safeTarget = target === "_self" ? "_self" : "_blank";
        window.open(url, safeTarget, "noopener,noreferrer");
      },
    });
  }, []);

  // "No prompt" tree — separate instance with its own action handler
  const noPromptRuntimeValueStore = useRuntimeValueStore();
  const {
    tree: noPromptTree,
    applyPatches: noPromptApplyPatches,
    reset: noPromptReset,
  } = useUITree({ batchPatches: true, onAction: handleNoPromptAction });

  // Keep stable refs in sync
  treeRef.current = tree;
  noPromptTreeRef.current = noPromptTree;
  applyPatchesRef.current = applyPatches;
  noPromptApplyPatchesRef.current = noPromptApplyPatches;

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      noPromptAbortRef.current?.abort();
    };
  }, []);

  // --- Auto-scroll chat to bottom on new messages ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const isStreaming = status === "streaming";

  // --- Cancel in-flight streams ---
  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    noPromptAbortRef.current?.abort();
    noPromptAbortRef.current = null;
    setStatus("idle");
    setNoPromptStatus("idle");
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

      // Abort any in-flight streams
      abortRef.current?.abort();
      noPromptAbortRef.current?.abort();

      const runId = runIdRef.current + 1;
      runIdRef.current = runId;

      // For follow-up messages, capture the current tree state so the LLM
      // knows what UI exists and can incorporate the user's requested changes.
      const isFollowUp = messages.length > 0;
      const currentTree = treeRef.current;
      const hasTree =
        isFollowUp &&
        currentTree.root !== "" &&
        Object.keys(currentTree.elements).length > 0;
      const currentUITreeJson = hasTree
        ? JSON.stringify(currentTree)
        : undefined;

      // Reset both trees for fresh generation
      runtimeValueStore.clear();
      noPromptRuntimeValueStore.clear();
      reset();
      noPromptReset();
      setErrorMessage(null);
      setStatus("streaming");
      setNoPromptStatus("streaming");
      setInputValue("");
      setRawJsonl("");
      rawJsonlRef.current = "";
      setNoPromptRawJsonl("");
      noPromptRawJsonlRef.current = "";
      setLeftActionLog([]);
      setRightActionLog([]);
      lastSubmittedRef.current = msg;

      // Track conversation
      const newUserMessage: ChatMessage = { role: "user", content: msg };
      setMessages((prev) => [...prev, newUserMessage]);

      // Build history from previous messages (exclude the current one)
      const history = messages.length > 0 ? messages : undefined;

      // --- Shared request body (without skipSystemPrompt) ---
      const baseBody = {
        message: msg,
        model: selectedModel,
        ...(history ? { history } : {}),
        ...(currentUITreeJson ? { currentUITree: currentUITreeJson } : {}),
      };

      // --- Stream 1: With system prompt (primary) ---
      const parser = createJsonlParser();
      const controller = new AbortController();
      abortRef.current = controller;

      const primaryStream = (async () => {
        try {
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "text/event-stream",
            },
            body: JSON.stringify(baseBody),
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
              rawJsonlRef.current += token;
              const ops = parser.push(token);
              if (ops.length > 0) {
                applyPatches(ops);
              }
            },
            controller.signal,
          );

          // Flush accumulated JSONL to state once (avoids O(n²) per-token setState)
          setRawJsonl(rawJsonlRef.current);

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
          // Identity-based cleanup: only null the ref if it still points to our controller.
          // Avoids orphaning the ref when a newer submit already replaced it.
          if (abortRef.current === controller) {
            abortRef.current = null;
          }
        }
      })();

      // --- Stream 2: Without system prompt (comparison) ---
      const noPromptParser = createJsonlParser();
      const noPromptController = new AbortController();
      noPromptAbortRef.current = noPromptController;

      const comparisonStream = (async () => {
        try {
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "text/event-stream",
            },
            body: JSON.stringify({
              ...baseBody,
              skipSystemPrompt: true,
              systemPromptOverride: BASELINE_PROMPT,
            }),
            signal: noPromptController.signal,
          });

          if (!response.ok) {
            // Non-critical — just mark as error, don't affect primary stream
            if (runIdRef.current === runId) {
              setNoPromptStatus("error");
            }
            return;
          }

          await readSSEStream(
            response,
            (token) => {
              // Guard: ignore tokens delivered after abort (narrow race window)
              if (noPromptController.signal.aborted) return;
              noPromptRawJsonlRef.current += token;
              const ops = noPromptParser.push(token);
              if (ops.length > 0) {
                noPromptApplyPatchesRef.current(ops);
              }
            },
            noPromptController.signal,
          );

          setNoPromptRawJsonl(noPromptRawJsonlRef.current);

          const remaining = noPromptParser.flush();
          if (remaining.length > 0) {
            noPromptApplyPatchesRef.current(remaining);
          }

          if (runIdRef.current === runId) {
            setNoPromptStatus("idle");
          }
        } catch (err: unknown) {
          if (err instanceof DOMException && err.name === "AbortError") return;

          // Flush partial ops even on error
          try {
            const remaining = noPromptParser.flush();
            if (remaining.length > 0)
              noPromptApplyPatchesRef.current(remaining);
          } catch {
            // Ignore flush errors
          }

          if (runIdRef.current === runId) {
            setNoPromptStatus("error");
          }
        } finally {
          if (noPromptAbortRef.current === noPromptController) {
            noPromptAbortRef.current = null;
          }
        }
      })();

      // Both streams are already executing — settle to suppress floating-promise lint.
      void Promise.allSettled([primaryStream, comparisonStream]);
    },
    [
      inputValue,
      selectedModel,
      messages,
      runtimeValueStore,
      noPromptRuntimeValueStore,
      reset,
      noPromptReset,
      applyPatches,
    ],
  );

  // Keep handleSubmit ref in sync for action dispatch
  handleSubmitRef.current = handleSubmit;

  const showTree = isRenderableTree(tree);
  const showNoPromptTree = isRenderableTree(noPromptTree);
  const isNoPromptStreaming = noPromptStatus === "streaming";
  /** True when any stream is active — gates user interaction. */
  const isAnyStreaming = isStreaming || isNoPromptStreaming;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left: chat sidebar */}
      <PlaygroundChatSidebar
        inputValue={inputValue}
        onInputChange={setInputValue}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        isStreaming={isAnyStreaming}
        status={status}
        messages={messages}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        messagesEndRef={messagesEndRef}
        presets={PRESET_PROMPTS}
        minimized={chatMinimized}
        onToggleMinimize={toggleChat}
      />

      {/* Right: side-by-side panels */}
      <div className="flex flex-1 min-w-0 flex-col">
        {/* Top bar: logo, nav */}
        <div className="flex h-[61px] shrink-0 items-center justify-between border-b border-kumo-line px-4">
          <CloudflareLogo variant="glyph" className="h-5 w-auto shrink-0" />
          <div className="flex items-center gap-1">
            <a
              href="/"
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-kumo-subtle hover:bg-kumo-elevated hover:text-kumo-default"
            >
              <ArrowLeftIcon className="size-4" />
              Docs
            </a>
            <ThemeToggle />
          </div>
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

        {/* Side-by-side panels */}
        <div className="relative flex flex-1 overflow-hidden">
          {/* Streaming progress indicator */}
          {(isStreaming || isNoPromptStreaming) && (
            <div
              className="absolute top-0 left-0 right-0 z-10 h-0.5 bg-kumo-brand/30"
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
          <ComparisonPanels
            tree={tree}
            showTree={showTree}
            runtimeValueStore={runtimeValueStore}
            isStreaming={isStreaming}
            rawJsonl={rawJsonl}
            onAction={handleAction}
            systemPromptText={systemPromptText}
            leftTab={leftTab}
            onLeftTabChange={setLeftTab}
            leftActionLog={leftActionLog}
            onClearLeftActionLog={clearLeftActionLog}
            noPromptTree={noPromptTree}
            noPromptRuntimeValueStore={noPromptRuntimeValueStore}
            showNoPromptTree={showNoPromptTree}
            isNoPromptStreaming={isNoPromptStreaming}
            noPromptStatus={noPromptStatus}
            noPromptRawJsonl={noPromptRawJsonl}
            rightTab={rightTab}
            onRightTabChange={setRightTab}
            onNoPromptAction={handleNoPromptAction}
            rightActionLog={rightActionLog}
            onClearRightActionLog={clearRightActionLog}
          />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Side-by-side comparison panels (each with its own tab bar)
// =============================================================================

interface ComparisonPanelsProps {
  // Primary (left) panel data
  readonly tree: UITree;
  readonly showTree: boolean;
  readonly runtimeValueStore: RuntimeValueStore;
  readonly isStreaming: boolean;
  readonly rawJsonl: string;
  readonly onAction?: (event: ActionEvent) => void;
  readonly systemPromptText: string | null;
  readonly leftTab: PanelTab;
  readonly onLeftTabChange: (tab: PanelTab) => void;
  // Left panel action log
  readonly leftActionLog: readonly ActionLogEntry[];
  readonly onClearLeftActionLog: () => void;
  // Comparison (right) panel data
  readonly noPromptTree: UITree;
  readonly noPromptRuntimeValueStore: RuntimeValueStore;
  readonly showNoPromptTree: boolean;
  readonly isNoPromptStreaming: boolean;
  readonly noPromptStatus: StreamStatus;
  readonly noPromptRawJsonl: string;
  readonly rightTab: PanelTab;
  readonly onRightTabChange: (tab: PanelTab) => void;
  // Right panel action handler + log
  readonly onNoPromptAction?: (event: ActionEvent) => void;
  readonly rightActionLog: readonly ActionLogEntry[];
  readonly onClearRightActionLog: () => void;
}

/** Renders two side-by-side panels, each with its own tab bar and content. */
function ComparisonPanels({
  tree,
  showTree,
  runtimeValueStore,
  isStreaming,
  rawJsonl,
  onAction,
  systemPromptText,
  leftTab,
  onLeftTabChange,
  leftActionLog,
  onClearLeftActionLog,
  noPromptTree,
  noPromptRuntimeValueStore,
  showNoPromptTree,
  isNoPromptStreaming,
  noPromptStatus,
  noPromptRawJsonl,
  rightTab,
  onRightTabChange,
  onNoPromptAction,
  rightActionLog,
  onClearRightActionLog,
}: ComparisonPanelsProps) {
  return (
    <Grid variant="side-by-side" gap="none" className="h-full w-full">
      {/* Left panel: Hardcoded Prompts */}
      <GridItem className="flex min-w-0 flex-col border-r border-kumo-line overflow-hidden">
        <PanelHeader
          label="A"
          tabs={PANEL_TABS}
          activeTab={leftTab}
          onTabChange={(v) => {
            if (isPanelTab(v)) onLeftTabChange(v);
          }}
        />
        <div className="flex-1 overflow-auto">
          <PanelContent
            tab={leftTab}
            tree={tree}
            showTree={showTree}
            runtimeValueStore={runtimeValueStore}
            isStreaming={isStreaming}
            rawJsonl={rawJsonl}
            promptText={systemPromptText}
            onAction={onAction}
            actionLog={leftActionLog}
            onClearActionLog={onClearLeftActionLog}
          />
        </div>
      </GridItem>

      {/* Right panel: Experiment */}
      <GridItem className="flex min-w-0 flex-col overflow-hidden">
        <PanelHeader
          label="B"
          tabs={PANEL_TABS}
          activeTab={rightTab}
          onTabChange={(v) => {
            if (isPanelTab(v)) onRightTabChange(v);
          }}
        />
        <div className="flex-1 overflow-auto">
          <PanelContent
            tab={rightTab}
            tree={noPromptTree}
            showTree={showNoPromptTree}
            runtimeValueStore={noPromptRuntimeValueStore}
            isStreaming={isNoPromptStreaming}
            rawJsonl={noPromptRawJsonl}
            promptText={BASELINE_PROMPT}
            streamStatus={noPromptStatus}
            onAction={onNoPromptAction}
            actionLog={rightActionLog}
            onClearActionLog={onClearRightActionLog}
          />
        </div>
      </GridItem>
    </Grid>
  );
}

/** Header bar for each panel: label above underline tab bar. */
function PanelHeader({
  label,
  tabs,
  activeTab,
  onTabChange,
}: {
  readonly label: string;
  readonly tabs: TabsItem[];
  readonly activeTab: PanelTab;
  readonly onTabChange: (value: string) => void;
}) {
  return (
    <div className="shrink-0 bg-kumo-elevated/50">
      <div className="px-3 pt-3 pb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-kumo-subtle">
          {label}
        </span>
      </div>
      <div className="px-3">
        <Tabs
          variant="segmented"
          tabs={tabs}
          value={activeTab}
          onValueChange={onTabChange}
          listClassName="gap-2 overflow-x-auto"
        />
      </div>
    </div>
  );
}

/** Renders the selected tab content within a single panel. */
function PanelContent({
  tab,
  tree,
  showTree,
  runtimeValueStore,
  isStreaming,
  rawJsonl,
  promptText,
  onAction,
  streamStatus,
  actionLog,
  onClearActionLog,
}: {
  readonly tab: PanelTab;
  readonly tree: UITree;
  readonly showTree: boolean;
  readonly runtimeValueStore: RuntimeValueStore;
  readonly isStreaming: boolean;
  readonly rawJsonl: string;
  readonly promptText: string | null;
  readonly onAction?: (event: ActionEvent) => void;
  readonly streamStatus?: StreamStatus;
  readonly actionLog: readonly ActionLogEntry[];
  readonly onClearActionLog: () => void;
}) {
  switch (tab) {
    case "preview":
      return (
        <PreviewContent
          tree={tree}
          showTree={showTree}
          runtimeValueStore={runtimeValueStore}
          isStreaming={isStreaming}
          onAction={onAction}
          streamStatus={streamStatus}
        />
      );
    case "code":
      return <CodeTabContent tree={tree} showTree={showTree} />;
    case "jsonl":
      return <JsonTabContent rawJsonl={rawJsonl} />;
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
    case "prompt":
      return (
        <div className="p-4">
          <PromptTextView text={promptText} />
        </div>
      );
  }
}

/** Renders the UI preview for a single panel. */
function PreviewContent({
  tree,
  showTree,
  runtimeValueStore,
  isStreaming,
  onAction,
  streamStatus,
}: {
  readonly tree: UITree;
  readonly showTree: boolean;
  readonly runtimeValueStore: RuntimeValueStore;
  readonly isStreaming: boolean;
  readonly onAction?: (event: ActionEvent) => void;
  readonly streamStatus?: StreamStatus;
}) {
  if (showTree) {
    return (
      <div className="p-4">
        <UITreeRenderer
          tree={tree}
          streaming={isStreaming}
          runtimeValueStore={runtimeValueStore}
          customComponents={CUSTOM_COMPONENTS}
          onAction={onAction}
        />
      </div>
    );
  }
  if (isStreaming) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader size="sm" />
      </div>
    );
  }
  if (streamStatus === "error") {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-kumo-danger text-sm">Comparison request failed</p>
      </div>
    );
  }
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-kumo-subtle text-sm">Enter a prompt to generate UI</p>
    </div>
  );
}

/** Approximate token count using chars/4 heuristic. */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Renders the prompt text inside a comparison panel. */
function PromptTextView({ text }: { readonly text: string | null }) {
  if (text === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader size="sm" />
      </div>
    );
  }

  const tokenCount = estimateTokenCount(text);

  return (
    <div className="markdown-prose text-kumo-default">
      <div className="mb-3 rounded-md border border-kumo-line bg-kumo-elevated px-3 py-1.5 text-xs text-kumo-subtle">
        ~{tokenCount.toLocaleString()} tokens (estimate)
      </div>
      <Markdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
        {text}
      </Markdown>
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
// Markdown rendering (shared by PromptTextView)
// =============================================================================

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
// Actions tab
// =============================================================================

/** Format an ISO timestamp as HH:MM:SS.mmm for the action log. */
function formatActionTimestamp(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

/** Renders a single row in the action event log. */
function ActionLogRow({ entry }: { readonly entry: ActionLogEntry }) {
  const { event, timestamp } = entry;
  return (
    <div className="flex items-start gap-3 border-b border-kumo-line px-3 py-2 text-xs font-mono">
      <span className="shrink-0 text-kumo-subtle">
        {formatActionTimestamp(timestamp)}
      </span>
      <span className="shrink-0 rounded bg-kumo-elevated px-1.5 py-0.5 text-kumo-brand">
        {event.actionName}
      </span>
      <span className="truncate text-kumo-default" title={event.sourceKey}>
        {event.sourceKey}
      </span>
      {event.context !== undefined && (
        <span className="ml-auto shrink-0 text-kumo-subtle">
          {JSON.stringify(event.context)}
        </span>
      )}
    </div>
  );
}

/**
 * Find the first element with a `submit_form` action in a UITree.
 * Returns null if none found.
 */
function findSubmitAction(tree: UITree): UIElement | null {
  const elements = tree.elements;
  for (const key of Object.keys(elements)) {
    const el = elements[key];
    if (el?.action?.name === "submit_form") {
      return el;
    }
  }
  return null;
}

/**
 * Actions tab: split view with action event log (top) and live submit
 * payload preview (bottom). Uses HighlightedCode for JSON display.
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
  const submitElement = useMemo(() => findSubmitAction(tree), [tree]);

  const livePayload = useMemo(() => {
    if (!submitElement?.action) return null;
    const action = submitElement.action;
    if (action.name !== "submit_form") return null;
    const formId = submitElement.parentKey ?? submitElement.key;
    // Collect runtime values for form fields
    const values: Record<string, unknown> = {};
    for (const key of Object.keys(tree.elements)) {
      const el = tree.elements[key];
      if (!el) continue;
      // Check if this element is a descendant of the form
      let isChild = el.key === formId;
      let current: UIElement | undefined = el;
      while (current?.parentKey && !isChild) {
        if (current.parentKey === formId) isChild = true;
        current = tree.elements[current.parentKey];
      }
      if (!isChild) continue;
      const runtimeValue = runtimeValueStore.getValue(el.key);
      if (runtimeValue !== undefined) {
        values[el.key] = runtimeValue;
      }
    }
    return { formId, values };
  }, [submitElement, tree, runtimeValueStore]);

  return (
    <div className="flex h-full flex-col">
      {/* Action event log (top half) */}
      <div className="flex shrink-0 items-center justify-between border-b border-kumo-line px-3 py-1.5">
        <span className="text-xs font-medium text-kumo-subtle">
          Event Log ({actionLog.length})
        </span>
        {actionLog.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClearActionLog}>
            Clear
          </Button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {actionLog.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-kumo-subtle">
              Interact with the preview to see action events
            </p>
          </div>
        ) : (
          <div>
            {actionLog.map((entry, i) => (
              <ActionLogRow key={i} entry={entry} />
            ))}
          </div>
        )}
      </div>

      {/* Live submit payload (bottom half) */}
      <div className="shrink-0 border-t border-kumo-line px-3 py-1.5">
        <span className="text-xs font-medium text-kumo-subtle">
          Submit Payload Preview
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {livePayload ? (
          <HighlightedCode
            code={JSON.stringify(livePayload, null, 2)}
            lang="json"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-kumo-subtle">
              No submit_form action found in tree
            </p>
          </div>
        )}
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

/** Human-readable description for each structural grading rule. */
const STRUCTURAL_RULE_DESCRIPTIONS: Readonly<Record<string, string>> = {
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

/** Human-readable description for each composition grading rule. */
const COMPOSITION_RULE_DESCRIPTIONS: Readonly<Record<string, string>> = {
  "has-visual-hierarchy":
    "UI contains at least one heading (Text with heading variant)",
  "has-responsive-layout":
    "Complex UIs (>12 elements) use Grid for responsive behaviour",
  "surface-hierarchy-correct":
    "Surface nesting follows base > elevated > recessed hierarchy",
  "spacing-consistency":
    "Stack gap values are within one step on the gap scale",
  "content-density": "Element count is within bounds (3–100 elements)",
  "action-completeness": "UIs with form elements include at least one Button",
};

/** Combined descriptions for all rules (structural + composition). */
const RULE_DESCRIPTIONS: Readonly<Record<string, string>> = {
  ...STRUCTURAL_RULE_DESCRIPTIONS,
  ...COMPOSITION_RULE_DESCRIPTIONS,
};

/** Reusable section that renders a titled group of grade results. */
function GradeSection({
  title,
  results,
}: {
  readonly title: string;
  readonly results: ReadonlyArray<GradeReport["results"][number]>;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-kumo-subtle">{title}</h3>
      {results.map((result) => (
        <div
          key={result.rule}
          className="rounded-lg border border-kumo-line p-3"
        >
          <div className="flex items-center gap-2">
            <span
              className={result.pass ? "text-kumo-success" : "text-kumo-danger"}
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
  );
}

/** Debounce interval for grading during streaming (ms). */
const GRADE_DEBOUNCE_MS = 500;

/**
 * Renders gradeTree() and gradeComposition() results with debouncing during streaming.
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
  const [compositionReport, setCompositionReport] =
    useState<GradeReport | null>(null);
  const [stats, setStats] = useState<TreeStats | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGradedRef = useRef(0);

  useEffect(() => {
    if (!showTree) {
      setReport(null);
      setCompositionReport(null);
      setStats(null);
      return;
    }

    const runGrade = () => {
      setReport(gradeTree(tree, { customTypes: CUSTOM_COMPONENT_TYPES }));
      setCompositionReport(gradeComposition(tree));
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

  const structuralPassCount = report.results.filter((r) => r.pass).length;
  const compositionPassCount = compositionReport
    ? compositionReport.results.filter((r) => r.pass).length
    : 0;
  const totalStructural = report.results.length;
  const totalComposition = compositionReport
    ? compositionReport.results.length
    : COMPOSITION_RULE_NAMES.length;
  const totalPass = structuralPassCount + compositionPassCount;
  const totalRules = totalStructural + totalComposition;

  return (
    <div className="space-y-4 p-4">
      {/* Overall score + stats */}
      <div className="flex items-baseline gap-4">
        <span className="text-2xl font-semibold text-kumo-default">
          {totalPass}/{totalRules}
        </span>
        <span className="text-sm text-kumo-subtle">rules passing</span>
        {stats && (
          <span className="ml-auto text-sm text-kumo-subtle">
            {stats.elementCount} elements &middot; max depth {stats.maxDepth}
          </span>
        )}
      </div>

      {/* Structural rules */}
      <GradeSection
        title={`Structural (${structuralPassCount}/${totalStructural})`}
        results={report.results}
      />

      {/* Composition rules */}
      {compositionReport && (
        <GradeSection
          title={`Composition (${compositionPassCount}/${totalComposition})`}
          results={compositionReport.results}
        />
      )}
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
          "value" in parsed
        ) {
          const narrow: { op: unknown; value: unknown } = parsed;
          if (narrow.op !== "add") continue;
          const value = narrow.value;
          if (typeof value === "object" && value !== null && "type" in value) {
            const typed: { type: unknown } = value;
            if (typeof typed.type === "string") types.add(typed.type);
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
  readonly presets: typeof PRESET_PROMPTS;
  readonly minimized: boolean;
  readonly onToggleMinimize: () => void;
}

/** Right-hand chat panel: model selector, messages, input. */
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
  presets,
  minimized,
  onToggleMinimize,
}: PlaygroundChatSidebarProps) {
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

  // --- Minimized strip: just a narrow column with expand button + status ---
  if (minimized) {
    return (
      <aside
        className="hidden md:flex h-full w-12 shrink-0 flex-col items-center border-r border-kumo-line bg-kumo-overlay py-3 gap-3"
        aria-label="Chat sidebar (minimized)"
      >
        <button
          type="button"
          onClick={onToggleMinimize}
          className="flex size-8 items-center justify-center rounded-md text-kumo-subtle hover:bg-kumo-elevated hover:text-kumo-default"
          aria-label="Expand chat"
        >
          <SidebarSimpleIcon size={18} />
        </button>
        {status !== "idle" && (
          <span className={`flex items-center ${statusInfo.className}`}>
            {statusInfo.icon}
          </span>
        )}
      </aside>
    );
  }

  return (
    <aside
      className="hidden md:flex h-full w-[380px] shrink-0 flex-col border-r border-kumo-line bg-kumo-overlay"
      aria-label="Chat sidebar"
    >
      {/* Header: model selector + minimize toggle — h-[61px] matches left panel tab bar */}
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
        {turnCount > 0 && (
          <span className="text-xs text-kumo-subtle">
            {Math.ceil(turnCount / 2)}{" "}
            {Math.ceil(turnCount / 2) === 1 ? "turn" : "turns"}
          </span>
        )}
        <button
          type="button"
          onClick={onToggleMinimize}
          className="flex size-7 items-center justify-center rounded-md text-kumo-subtle hover:bg-kumo-elevated hover:text-kumo-default"
          aria-label="Minimize chat"
        >
          <SidebarSimpleIcon size={16} />
        </button>
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

      {/* Preset pills + input area at bottom */}
      <div className="shrink-0 border-t border-kumo-line px-4 py-3 space-y-2">
        <Cluster gap="xs">
          {presets.map((preset) => (
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
        </Cluster>
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
