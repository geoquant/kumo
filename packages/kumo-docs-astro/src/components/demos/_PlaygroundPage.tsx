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

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Button,
  Checkbox,
  CloudflareLogo,
  Cluster,
  cn,
  InputArea,
  Loader,
  Popover,
  Select,
  Stack,
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
  SlidersHorizontalIcon,
  SpinnerIcon,
  StopCircleIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import {
  useUITree,
  useRuntimeValueStore,
  createHandlerMap,
  dispatchAction,
  applyPatch,
  processActionResult,
  type ActionEvent,
  type ActionHandler,
  type ActionHandlerMap,
  type JsonPatchOp,
  type MessageResult,
  type RuntimeValueStore,
} from "@cloudflare/kumo/streaming";
import type { UITree, UIElement } from "@cloudflare/kumo/streaming";
import {
  UITreeRenderer,
  isRenderableTree,
  uiTreeToJsx,
  defineCustomComponent,
} from "@cloudflare/kumo/generative";
import {
  gradeTree,
  gradeComposition,
  COMPOSITION_RULE_NAMES,
  walkTree,
} from "@cloudflare/kumo/generative/graders";
import type { GradeReport } from "@cloudflare/kumo/generative/graders";
import type { CustomComponentDefinition } from "@cloudflare/kumo/catalog";
import { DemoButton } from "./DemoButton";
import Markdown from "react-markdown";
import {
  Group,
  Panel,
  Separator,
  type PanelImperativeHandle,
  useDefaultLayout,
} from "react-resizable-panels";
import remarkGfm from "remark-gfm";
import { streamJsonlUI } from "~/lib/stream-jsonl-ui";
import { HighlightedCode } from "~/components/HighlightedCode";
import { ThemeToggle } from "~/components/ThemeToggle";
import type { BundledLanguage } from "shiki";
import type {
  ChatMessage,
  TextChatMessage,
  ToolChatMessage,
  ToolMessageStatus,
} from "~/lib/chat-types";
import {
  updateToolMessageStatus as applyToolStatusUpdate,
  updateToolMessageTree as applyToolTreeUpdate,
  streamToolConfirmation,
} from "~/lib/tool-middleware";
import { BASELINE_PROMPT } from "~/lib/tool-prompts";
import {
  matchToolForMessage,
  getToolPills,
  TOOL_REGISTRY,
  type ToolDefinition,
} from "~/lib/tool-registry";
import {
  createInitialPlaygroundLayoutState,
  createInitialPlaygroundPanelsState,
  playgroundLayoutReducer,
  playgroundPanelsReducer,
} from "~/lib/playground/state";
import {
  playgroundCatalogActions,
  playgroundCatalogCategories,
  playgroundCatalogComponents,
  type CatalogActionEntry,
  type CatalogComponentEntry,
} from "~/lib/playground/catalog-data";
import { buildNestedTree } from "~/lib/playground/nested-tree";
import { validateEditableTree } from "~/lib/playground/validate-tree";
import type {
  ActionLogEntry,
  PanelTab,
  StreamStatus,
} from "~/lib/playground/types";

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

/** Shared className override to shrink tab text for tight panel headers. */
const PANEL_TAB_CLASS = "text-xs";

/** Tab definitions for each panel. Both panels have the same tabs. */
const PANEL_TABS: TabsItem[] = [
  { value: "preview", label: "UI", className: PANEL_TAB_CLASS },
  { value: "code", label: "TSX", className: PANEL_TAB_CLASS },
  { value: "editor", label: "Editor", className: PANEL_TAB_CLASS },
  { value: "tree", label: "Tree", className: PANEL_TAB_CLASS },
  { value: "jsonl", label: "JSONL", className: PANEL_TAB_CLASS },
  { value: "actions", label: "Actions", className: PANEL_TAB_CLASS },
  { value: "grading", label: "Grade", className: PANEL_TAB_CLASS },
  { value: "prompt", label: "Prompt", className: PANEL_TAB_CLASS },
];

const PANEL_TAB_VALUES = new Set<string>(PANEL_TABS.map((t) => t.value));

/** Type guard for PanelTab values. */
function isPanelTab(value: string): value is PanelTab {
  return PANEL_TAB_VALUES.has(value);
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

/** Extract `prompt` string from an unknown JSON body, or null. */
function extractPromptString(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  if (!("prompt" in body)) return null;
  const narrow: { prompt: unknown } = body;
  return typeof narrow.prompt === "string" ? narrow.prompt : null;
}

// =============================================================================
// Tool action handlers
// =============================================================================

/**
 * Handle `tool_approve` — returns a MessageResult with JSON content
 * containing `{ toolId, approved: true }`.
 */
const handleToolApprove: ActionHandler = (event) => {
  const toolId = event.params?.toolId;
  if (typeof toolId !== "string") return null;

  const result: MessageResult = {
    type: "message",
    content: JSON.stringify({ toolId, approved: true }),
  };
  return result;
};

/**
 * Handle `tool_cancel` — returns a MessageResult with JSON content
 * containing `{ toolId, approved: false }`.
 */
const handleToolCancel: ActionHandler = (event) => {
  const toolId = event.params?.toolId;
  if (typeof toolId !== "string") return null;

  const result: MessageResult = {
    type: "message",
    content: JSON.stringify({ toolId, approved: false }),
  };
  return result;
};

/** Custom handlers for the playground's tool confirmation flow. */
const TOOL_ACTION_HANDLERS: Readonly<ActionHandlerMap> = {
  tool_approve: handleToolApprove,
  tool_cancel: handleToolCancel,
};

/**
 * Merged handler map: built-in handlers + playground tool handlers.
 * Custom handlers take precedence over built-ins for the same action name.
 */
const PLAYGROUND_HANDLERS: Readonly<ActionHandlerMap> =
  createHandlerMap(TOOL_ACTION_HANDLERS);

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
 * Static preset prompts: card-level (single components) + page-level (full layouts).
 * Tool presets are appended from {@link TOOL_REGISTRY} via {@link getToolPills}.
 */
const STATIC_PRESETS: readonly {
  readonly label: string;
  readonly prompt: string;
}[] = [
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
];

/**
 * All preset prompts: static presets + tool pills from the registry.
 * Tool pills are appended at the end so they appear as the last pill buttons.
 */
const PRESET_PROMPTS: readonly {
  readonly label: string;
  readonly prompt: string;
}[] = [...STATIC_PRESETS, ...getToolPills()];

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
  const [panelState, dispatchPanelState] = useReducer(
    playgroundPanelsReducer,
    undefined,
    createInitialPlaygroundPanelsState,
  );
  const [layoutState, dispatchLayoutState] = useReducer(
    playgroundLayoutReducer,
    undefined,
    createInitialPlaygroundLayoutState,
  );
  const chatPanelRef = useRef<PanelImperativeHandle | null>(null);
  const rootLayoutPersistence = useDefaultLayout({
    id: "playground-root-layout",
    panelIds: ["chat", "workspace"],
  });

  // --- Input state ---
  const [inputValue, setInputValue] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);

  // --- Streaming state ---
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const rawJsonlRef = useRef("");
  const lastSubmittedRef = useRef<string | null>(null);
  /** True once at least one prompt has been submitted (gates skill Apply). */
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const noPromptRawJsonlRef = useRef("");

  const leftTab = panelState.a.activeTab;
  const rightTab = panelState.b.activeTab;
  const status = panelState.a.status;
  const leftEditor = panelState.a.editor;
  const leftLocalTreeOverride = panelState.a.localTreeOverride;
  const rawJsonl = panelState.a.rawJsonl;
  const leftActionLog = panelState.a.actionLog;
  const noPromptStatus = panelState.b.status;
  const rightEditor = panelState.b.editor;
  const rightLocalTreeOverride = panelState.b.localTreeOverride;
  const noPromptRawJsonl = panelState.b.rawJsonl;
  const rightActionLog = panelState.b.actionLog;
  const chatMinimized = layoutState.chatMinimized;
  const catalogOpen = layoutState.catalogOpen;
  const mobileView = layoutState.mobileView;
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );

  const setLeftTab = useCallback(
    (tab: PanelTab) => {
      dispatchPanelState({ type: "set-tab", panelId: "a", tab });
    },
    [dispatchPanelState],
  );
  const setRightTab = useCallback(
    (tab: PanelTab) => {
      dispatchPanelState({ type: "set-tab", panelId: "b", tab });
    },
    [dispatchPanelState],
  );
  const toggleChat = useCallback(() => {
    dispatchLayoutState({ type: "toggle-chat-minimized" });
  }, [dispatchLayoutState]);
  const setCatalogOpen = useCallback(
    (value: boolean) => {
      dispatchLayoutState({ type: "set-catalog-open", value });
    },
    [dispatchLayoutState],
  );
  const setMobileView = useCallback(
    (value: "chat" | "a" | "b" | "catalog") => {
      dispatchLayoutState({ type: "set-mobile-view", value });
    },
    [dispatchLayoutState],
  );
  const setStatus = useCallback(
    (nextStatus: StreamStatus) => {
      dispatchPanelState({
        type: "set-status",
        panelId: "a",
        status: nextStatus,
      });
    },
    [dispatchPanelState],
  );
  const setNoPromptStatus = useCallback(
    (nextStatus: StreamStatus) => {
      dispatchPanelState({
        type: "set-status",
        panelId: "b",
        status: nextStatus,
      });
    },
    [dispatchPanelState],
  );
  const setRawJsonl = useCallback(
    (nextRawJsonl: string) => {
      dispatchPanelState({
        type: "set-raw-jsonl",
        panelId: "a",
        rawJsonl: nextRawJsonl,
      });
    },
    [dispatchPanelState],
  );
  const setNoPromptRawJsonl = useCallback(
    (nextRawJsonl: string) => {
      dispatchPanelState({
        type: "set-raw-jsonl",
        panelId: "b",
        rawJsonl: nextRawJsonl,
      });
    },
    [dispatchPanelState],
  );
  const appendLeftActionLog = useCallback(
    (entry: ActionLogEntry) => {
      dispatchPanelState({
        type: "append-action-log",
        panelId: "a",
        entry,
      });
    },
    [dispatchPanelState],
  );
  const appendRightActionLog = useCallback(
    (entry: ActionLogEntry) => {
      dispatchPanelState({
        type: "append-action-log",
        panelId: "b",
        entry,
      });
    },
    [dispatchPanelState],
  );
  const clearLeftActionLog = useCallback(() => {
    dispatchPanelState({ type: "clear-action-log", panelId: "a" });
  }, [dispatchPanelState]);
  const clearRightActionLog = useCallback(() => {
    dispatchPanelState({ type: "clear-action-log", panelId: "b" });
  }, [dispatchPanelState]);
  const setLeftStreamTree = useCallback(
    (nextTree: UITree) => {
      dispatchPanelState({ type: "set-tree", panelId: "a", tree: nextTree });
    },
    [dispatchPanelState],
  );
  const setRightStreamTree = useCallback(
    (nextTree: UITree) => {
      dispatchPanelState({ type: "set-tree", panelId: "b", tree: nextTree });
    },
    [dispatchPanelState],
  );
  const setLeftLocalTreeOverride = useCallback(
    (nextTree: UITree | null) => {
      dispatchPanelState({
        type: "set-local-tree-override",
        panelId: "a",
        tree: nextTree,
      });
    },
    [dispatchPanelState],
  );
  const setRightLocalTreeOverride = useCallback(
    (nextTree: UITree | null) => {
      dispatchPanelState({
        type: "set-local-tree-override",
        panelId: "b",
        tree: nextTree,
      });
    },
    [dispatchPanelState],
  );
  const syncLeftEditorFromStream = useCallback(
    (text: string) => {
      dispatchPanelState({
        type: "set-editor-text",
        panelId: "a",
        text,
        source: "stream",
        status: "clean",
      });
    },
    [dispatchPanelState],
  );
  const syncRightEditorFromStream = useCallback(
    (text: string) => {
      dispatchPanelState({
        type: "set-editor-text",
        panelId: "b",
        text,
        source: "stream",
        status: "clean",
      });
    },
    [dispatchPanelState],
  );
  const setLeftEditorText = useCallback(
    (text: string, source: "stream" | "manual") => {
      dispatchPanelState({
        type: "set-editor-text",
        panelId: "a",
        text,
        source,
      });
    },
    [dispatchPanelState],
  );
  const setRightEditorText = useCallback(
    (text: string, source: "stream" | "manual") => {
      dispatchPanelState({
        type: "set-editor-text",
        panelId: "b",
        text,
        source,
      });
    },
    [dispatchPanelState],
  );
  const setLeftEditorValidation = useCallback(
    (
      issues: readonly {
        readonly message: string;
        readonly path: readonly (string | number)[];
      }[],
    ) => {
      dispatchPanelState({
        type: "set-editor-validation",
        panelId: "a",
        issues,
      });
    },
    [dispatchPanelState],
  );
  const setRightEditorValidation = useCallback(
    (
      issues: readonly {
        readonly message: string;
        readonly path: readonly (string | number)[];
      }[],
    ) => {
      dispatchPanelState({
        type: "set-editor-validation",
        panelId: "b",
        issues,
      });
    },
    [dispatchPanelState],
  );
  const markLeftEditorApplied = useCallback(() => {
    dispatchPanelState({
      type: "mark-editor-applied",
      panelId: "a",
      appliedAt: new Date().toISOString(),
    });
  }, [dispatchPanelState]);
  const markRightEditorApplied = useCallback(() => {
    dispatchPanelState({
      type: "mark-editor-applied",
      panelId: "b",
      appliedAt: new Date().toISOString(),
    });
  }, [dispatchPanelState]);
  const resetLeftEditor = useCallback(
    (text: string) => {
      dispatchPanelState({ type: "reset-editor", panelId: "a", text });
    },
    [dispatchPanelState],
  );
  const resetRightEditor = useCallback(
    (text: string) => {
      dispatchPanelState({ type: "reset-editor", panelId: "b", text });
    },
    [dispatchPanelState],
  );

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
  const [_appliedSkillIds, setAppliedSkillIds] = useState<ReadonlySet<string>>(
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
  /** Independent staleness guard for Panel B (comparison) stream. */
  const noPromptRunIdRef = useRef(0);
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
  const handleAction = useCallback(
    (event: ActionEvent) => {
      appendLeftActionLog({ timestamp: new Date().toISOString(), event });

      // Don't actually submit forms in the playground — just log + preview
      if (event.actionName === "submit_form") return;

      const result = dispatchAction(
        PLAYGROUND_HANDLERS,
        event,
        treeRef.current,
      );
      if (result === null) return;
      processActionResult(result, {
        applyPatches: (patches: readonly JsonPatchOp[]) => {
          if (leftLocalTreeOverride !== null) {
            let nextTree = leftLocalTreeOverride;
            for (const patch of patches) {
              nextTree = applyPatch(nextTree, patch);
            }
            setLeftLocalTreeOverride(nextTree);
            syncLeftEditorFromStream(JSON.stringify(nextTree, null, 2));
            return;
          }

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
    },
    [
      appendLeftActionLog,
      leftLocalTreeOverride,
      setLeftLocalTreeOverride,
      syncLeftEditorFromStream,
    ],
  );

  // --- UITree hooks ---
  const runtimeValueStore = useRuntimeValueStore();
  const { tree, applyPatches, reset } = useUITree({
    batchPatches: true,
    onAction: handleAction,
  });

  // --- Action handler (right panel) ---
  const handleNoPromptAction = useCallback(
    (event: ActionEvent) => {
      appendRightActionLog({ timestamp: new Date().toISOString(), event });

      if (event.actionName === "submit_form") return;

      const result = dispatchAction(
        PLAYGROUND_HANDLERS,
        event,
        noPromptTreeRef.current,
      );
      if (result === null) return;
      processActionResult(result, {
        applyPatches: (patches: readonly JsonPatchOp[]) => {
          if (rightLocalTreeOverride !== null) {
            let nextTree = rightLocalTreeOverride;
            for (const patch of patches) {
              nextTree = applyPatch(nextTree, patch);
            }
            setRightLocalTreeOverride(nextTree);
            syncRightEditorFromStream(JSON.stringify(nextTree, null, 2));
            return;
          }

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
    },
    [
      appendRightActionLog,
      rightLocalTreeOverride,
      setRightLocalTreeOverride,
      syncRightEditorFromStream,
    ],
  );

  // --- Action handler (chat sidebar tool cards) ---
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  /**
   * Immutably update the status of a tool message identified by `toolId`.
   * Delegates to the pure `applyToolStatusUpdate` from tool-middleware.
   */
  const updateToolMessageStatus = useCallback(
    (toolId: string, newStatus: ToolMessageStatus) => {
      setMessages((prev) => applyToolStatusUpdate(prev, toolId, newStatus));
    },
    [],
  );

  /**
   * Handle actions dispatched from inline tool confirmation cards.
   *
   * The UITreeRenderer fires `tool_approve` / `tool_cancel` actions
   * with `params.toolId`. On approve, we call the MCP proxy for execution
   * and fire the follow-up prompt on success.
   */
  const handleToolAction = useCallback(
    (event: ActionEvent) => {
      const actionName = event.actionName;
      const params = (event.params ?? {}) as Record<string, unknown>;
      const toolId =
        typeof params["toolId"] === "string" ? params["toolId"] : null;
      if (toolId === null) return;

      // --- Cancel path ---
      if (actionName === "tool_cancel") {
        updateToolMessageStatus(toolId, "cancelled");
        return;
      }

      // --- Approve path ---
      if (actionName !== "tool_approve") return;

      // Find the matching tool definition by scanning the registry.
      // The toolId encodes the tool type (e.g. "create-worker-hello-world").
      let matchedDef: ToolDefinition | undefined;

      for (const def of TOOL_REGISTRY.values()) {
        // Each definition's deriveExecuteParams can parse this toolId.
        // We verify by round-tripping: derive params → derive toolId → compare.
        const candidateParams = def.deriveExecuteParams(toolId);
        const candidateToolId = def.deriveToolId(candidateParams);
        if (candidateToolId === toolId) {
          matchedDef = def;
          break;
        }
      }

      if (matchedDef == null) return;

      const matchedParams = matchedDef.deriveExecuteParams(toolId);

      updateToolMessageStatus(toolId, "applying");

      void (async () => {
        try {
          // Dev shortcut: skip the MCP proxy round-trip and treat approval as a
          // successful no-op so the rest of the playground flow still works.
          /*
          const res = await fetch("/api/mcp-proxy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              toolName: matchedDef.mcpExecuteToolName,
              params: matchedParams,
            }),
          });

          if (!res.ok) {
            const errBody = (await res.json().catch(() => null)) as Record<
              string,
              unknown
            > | null;
            const errMsg =
              errBody !== null && typeof errBody["error"] === "string"
                ? errBody["error"]
                : `MCP proxy request failed (${String(res.status)})`;
            throw new Error(errMsg);
          }

          const data = (await res.json()) as Record<string, unknown>;
          if (!isRecord(data)) {
            throw new Error("Unexpected MCP proxy response shape");
          }

          const structured = isRecord(data["structuredContent"])
            ? data["structuredContent"]
            : null;
          */
          const structured = { success: true };

          if (
            structured === null ||
            !matchedDef.validateExecuteResult(structured)
          ) {
            throw new Error("Tool execution returned unsuccessful result");
          }

          updateToolMessageStatus(toolId, "completed");

          handleSubmitRef.current(
            undefined,
            matchedDef.buildFollowUpPrompt(matchedParams),
          );
        } catch (err) {
          console.error(
            `[tool-action] ${matchedDef.mcpExecuteToolName} error:`,
            err,
          );
          updateToolMessageStatus(toolId, "pending");
        }
      })();
    },
    [updateToolMessageStatus],
  );

  // "No prompt" tree — separate instance with its own action handler
  const noPromptRuntimeValueStore = useRuntimeValueStore();
  const {
    tree: noPromptTree,
    applyPatches: noPromptApplyPatches,
    reset: noPromptReset,
  } = useUITree({ batchPatches: true, onAction: handleNoPromptAction });

  const leftEffectiveTree = leftLocalTreeOverride ?? tree;
  const rightEffectiveTree = rightLocalTreeOverride ?? noPromptTree;

  // Keep stable refs in sync
  treeRef.current = leftEffectiveTree;
  noPromptTreeRef.current = rightEffectiveTree;
  applyPatchesRef.current = applyPatches;
  noPromptApplyPatchesRef.current = noPromptApplyPatches;

  useEffect(() => {
    setLeftStreamTree(tree);
    if (leftLocalTreeOverride !== null) {
      return;
    }

    const nextText = JSON.stringify(tree, null, 2);
    if (leftEditor.text !== nextText || leftEditor.source !== "stream") {
      syncLeftEditorFromStream(nextText);
    }
  }, [
    leftEditor.source,
    leftEditor.text,
    leftLocalTreeOverride,
    setLeftStreamTree,
    syncLeftEditorFromStream,
    tree,
  ]);

  useEffect(() => {
    setRightStreamTree(noPromptTree);
    if (rightLocalTreeOverride !== null) {
      return;
    }

    const nextText = JSON.stringify(noPromptTree, null, 2);
    if (rightEditor.text !== nextText || rightEditor.source !== "stream") {
      syncRightEditorFromStream(nextText);
    }
  }, [
    noPromptTree,
    rightEditor.source,
    rightEditor.text,
    rightLocalTreeOverride,
    setRightStreamTree,
    syncRightEditorFromStream,
  ]);

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

  // --- Reusable Panel B stream launcher ---
  /**
   * Fires (or re-fires) the Panel B comparison stream.
   *
   * Aborts any in-flight Panel B stream, resets its tree/JSONL/status,
   * and starts a new SSE request with `skipSystemPrompt: true`.
   *
   * Called from both `handleSubmit` (initial generation) and
   * `handleApplySkills` (skill-apply replay).
   */
  const streamPanelB = useCallback(
    (opts: {
      readonly message: string;
      readonly model: string;
      readonly history?: readonly TextChatMessage[];
      readonly currentUITree?: string;
      readonly skillIds?: readonly string[];
    }) => {
      // Abort any in-flight Panel B stream
      noPromptAbortRef.current?.abort();

      const bRunId = noPromptRunIdRef.current + 1;
      noPromptRunIdRef.current = bRunId;

      // Reset Panel B state
      noPromptRuntimeValueStore.clear();
      noPromptReset();
      resetRightEditor("");
      setNoPromptStatus("streaming");
      setNoPromptRawJsonl("");
      noPromptRawJsonlRef.current = "";
      clearRightActionLog();

      const bodyPayload: Record<string, unknown> = {
        message: opts.message,
        model: opts.model,
        skipSystemPrompt: true,
        systemPromptOverride: BASELINE_PROMPT,
      };
      if (opts.history && opts.history.length > 0) {
        bodyPayload.history = opts.history;
      }
      if (opts.currentUITree) {
        bodyPayload.currentUITree = opts.currentUITree;
      }
      if (opts.skillIds && opts.skillIds.length > 0) {
        bodyPayload.skillIds = opts.skillIds;
      }

      const noPromptController = new AbortController();
      noPromptAbortRef.current = noPromptController;

      const stream = (async () => {
        try {
          await streamJsonlUI({
            body: bodyPayload,
            signal: noPromptController.signal,
            onToken: (token) => {
              noPromptRawJsonlRef.current += token;
            },
            onPatches: (ops) => {
              noPromptApplyPatchesRef.current(ops);
            },
          });

          setNoPromptRawJsonl(noPromptRawJsonlRef.current);

          if (noPromptRunIdRef.current === bRunId) {
            setNoPromptStatus("idle");
          }
        } catch (err: unknown) {
          if (err instanceof DOMException && err.name === "AbortError") return;

          if (noPromptRunIdRef.current === bRunId) {
            setNoPromptStatus("error");
          }
        } finally {
          if (noPromptAbortRef.current === noPromptController) {
            noPromptAbortRef.current = null;
          }
        }
      })();

      void stream;
    },
    [noPromptRuntimeValueStore, noPromptReset],
  );

  // --- Submit handler ---
  const handleSubmit = useCallback(
    (e?: FormEvent, overrideMessage?: string) => {
      if (e) e.preventDefault();
      const msg = overrideMessage ?? inputValue.trim();
      if (!msg) return;

      // --- Tool middleware: intercept messages matching a registered tool ---
      // Stream a JSONL confirmation card inline in the chat sidebar using
      // the same pipeline the A/B panels use (readSSEStream → createJsonlParser → applyPatch).
      const toolMatch = matchToolForMessage(msg);
      if (toolMatch !== null) {
        const [toolDef, matchedParams] = toolMatch;
        setInputValue("");

        // Show the user message immediately.
        const userMsg: TextChatMessage = { role: "user", content: msg };
        setMessages((prev) => [...prev, userMsg]);

        const toolId = toolDef.deriveToolId(matchedParams);
        const emptyTree: UITree = { root: "", elements: {} };

        // Add the tool message with an empty tree (will be populated via streaming).
        const toolMsg: ToolChatMessage = {
          role: "tool",
          toolId,
          tree: emptyTree,
          status: "streaming",
        };
        setMessages((prev) => [...prev, toolMsg]);

        // Stream the confirmation card inline using the currently selected model.
        void streamToolConfirmation(
          {
            message: toolDef.buildConfirmationMessage(matchedParams),
            systemPrompt: toolDef.buildConfirmationSystemPrompt(toolId),
            model: selectedModel,
          },
          {
            onTreeUpdate: (tree) => {
              setMessages((prev) => applyToolTreeUpdate(prev, toolId, tree));
            },
            onComplete: (tree) => {
              setMessages((prev) => {
                const updated = applyToolTreeUpdate(prev, toolId, tree);
                return applyToolStatusUpdate(updated, toolId, "pending");
              });
            },
            onError: (error) => {
              console.error(
                `[tool-middleware] ${toolDef.mcpExecuteToolName} stream error:`,
                error,
              );
              setMessages((prev) =>
                applyToolStatusUpdate(prev, toolId, "error"),
              );
            },
          },
        );

        return;
      }

      // Abort any in-flight primary stream
      abortRef.current?.abort();

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

      // Reset Panel A state
      runtimeValueStore.clear();
      reset();
      resetLeftEditor("");
      setErrorMessage(null);
      setStatus("streaming");
      setInputValue("");
      setRawJsonl("");
      rawJsonlRef.current = "";
      clearLeftActionLog();
      lastSubmittedRef.current = msg;
      setHasSubmitted(true);

      // Track conversation
      const newUserMessage: ChatMessage = { role: "user", content: msg };
      setMessages((prev) => [...prev, newUserMessage]);

      // Build history from previous text messages (exclude tool cards and the current one)
      const textMessages = messages.filter(
        (m): m is TextChatMessage => m.role !== "tool",
      );
      const history = textMessages.length > 0 ? textMessages : undefined;

      // --- Shared request body (without skipSystemPrompt) ---
      const baseBody = {
        message: msg,
        model: selectedModel,
        ...(history ? { history } : {}),
        ...(currentUITreeJson ? { currentUITree: currentUITreeJson } : {}),
      };

      // --- Stream 1: With system prompt (primary) ---
      const controller = new AbortController();
      abortRef.current = controller;

      const primaryStream = (async () => {
        try {
          const fullResponse = await streamJsonlUI({
            body: baseBody,
            signal: controller.signal,
            onToken: (token) => {
              rawJsonlRef.current += token;
            },
            onPatches: (ops) => {
              applyPatches(ops);
            },
          });

          // Flush accumulated JSONL to state once (avoids O(n²) per-token setState)
          setRawJsonl(rawJsonlRef.current);

          if (runIdRef.current === runId) {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: fullResponse },
            ]);
            setStatus("idle");
          }
        } catch (err: unknown) {
          if (err instanceof DOMException && err.name === "AbortError") return;

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

      // --- Stream 2: Panel B (comparison) via extracted helper ---
      streamPanelB({
        message: msg,
        model: selectedModel,
        history: history ? [...history] : undefined,
        currentUITree: currentUITreeJson,
      });

      // Primary stream is already executing — suppress floating-promise lint.
      void primaryStream;
    },
    [
      inputValue,
      selectedModel,
      messages,
      runtimeValueStore,
      reset,
      applyPatches,
      streamPanelB,
    ],
  );

  // Keep handleSubmit ref in sync for action dispatch
  handleSubmitRef.current = handleSubmit;

  const showTree = isRenderableTree(leftEffectiveTree);
  const showNoPromptTree = isRenderableTree(rightEffectiveTree);
  const isNoPromptStreaming = noPromptStatus === "streaming";
  /** True when any stream is active — gates user interaction. */
  const isAnyStreaming = isStreaming || isNoPromptStreaming;

  // --- Skill picker callbacks ---
  const handleToggleSkill = useCallback((id: string, checked: boolean) => {
    setPendingSkillIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  /**
   * Apply selected skills: re-fire Panel B with the last submitted message
   * and the currently pending skill IDs. Resets Panel B history (fresh gen).
   * No-op if no message has been submitted yet.
   */
  const handleApplySkills = useCallback(() => {
    const lastMsg = lastSubmittedRef.current;
    if (lastMsg === null) return;

    setAppliedSkillIds(new Set(pendingSkillIds));

    streamPanelB({
      message: lastMsg,
      model: selectedModel,
      skillIds: Array.from(pendingSkillIds),
    });
  }, [pendingSkillIds, selectedModel, streamPanelB]);

  useEffect(() => {
    const panel = chatPanelRef.current;
    if (panel === null) {
      return;
    }

    if (chatMinimized) {
      panel.collapse();
      return;
    }

    panel.expand();
  }, [chatMinimized]);

  useEffect(() => {
    function syncViewport() {
      setIsMobileViewport(window.innerWidth < 768);
    }

    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  if (isMobileViewport) {
    return (
      <MobilePlaygroundShell
        mobileView={mobileView}
        onMobileViewChange={setMobileView}
        inputValue={inputValue}
        onInputChange={setInputValue}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        isAnyStreaming={isAnyStreaming}
        status={status}
        messages={messages}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        messagesEndRef={messagesEndRef}
        presets={PRESET_PROMPTS}
        onToolAction={handleToolAction}
        leftTab={leftTab}
        onLeftTabChange={setLeftTab}
        leftTree={leftEffectiveTree}
        leftStreamedTree={tree}
        leftShowTree={showTree}
        leftRuntimeValueStore={runtimeValueStore}
        isLeftStreaming={isStreaming}
        leftRawJsonl={rawJsonl}
        onLeftAction={handleAction}
        leftPromptText={systemPromptText}
        leftEditorText={leftEditor.text}
        leftEditorStatus={leftEditor.status}
        leftEditorIssues={leftEditor.validationIssues}
        onLeftEditorTextChange={setLeftEditorText}
        onLeftEditorValidate={setLeftEditorValidation}
        onLeftEditorReset={resetLeftEditor}
        onLeftEditorApplyTree={setLeftLocalTreeOverride}
        onLeftEditorApplied={markLeftEditorApplied}
        leftActionLog={leftActionLog}
        onClearLeftActionLog={clearLeftActionLog}
        rightTab={rightTab}
        onRightTabChange={setRightTab}
        rightTree={rightEffectiveTree}
        rightStreamedTree={noPromptTree}
        rightShowTree={showNoPromptTree}
        rightRuntimeValueStore={noPromptRuntimeValueStore}
        isRightStreaming={isNoPromptStreaming}
        rightRawJsonl={noPromptRawJsonl}
        onRightAction={handleNoPromptAction}
        rightPromptText={BASELINE_PROMPT}
        rightEditorText={rightEditor.text}
        rightEditorStatus={rightEditor.status}
        rightEditorIssues={rightEditor.validationIssues}
        onRightEditorTextChange={setRightEditorText}
        onRightEditorValidate={setRightEditorValidation}
        onRightEditorReset={resetRightEditor}
        onRightEditorApplyTree={setRightLocalTreeOverride}
        onRightEditorApplied={markRightEditorApplied}
        rightStatus={noPromptStatus}
        rightActionLog={rightActionLog}
        onClearRightActionLog={clearRightActionLog}
        skills={skills}
        pendingSkillIds={pendingSkillIds}
        onToggleSkill={handleToggleSkill}
        onApplySkills={handleApplySkills}
        isSkillApplyDisabled={isNoPromptStreaming || !hasSubmitted}
      />
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <Group
        orientation="horizontal"
        className="flex h-full w-full"
        id="playground-root-layout"
        defaultLayout={
          rootLayoutPersistence.defaultLayout ?? {
            chat: layoutState.desktopRootSizes[0],
            workspace: layoutState.desktopRootSizes[1],
          }
        }
        onLayoutChanged={(layout) => {
          rootLayoutPersistence.onLayoutChanged(layout);
          const chat = layout.chat;
          const workspace = layout.workspace;
          if (chat == null || workspace == null) {
            return;
          }
          dispatchLayoutState({
            type: "set-desktop-root-sizes",
            value: [chat, workspace],
          });
        }}
      >
        <Panel
          id="chat"
          panelRef={chatPanelRef}
          defaultSize={layoutState.desktopRootSizes[0]}
          minSize="16rem"
          collapsible
          collapsedSize="4rem"
          className="min-w-0"
        >
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
            onToolAction={handleToolAction}
          />
        </Panel>

        <PlaygroundResizeHandle orientation="vertical" />

        <Panel
          id="workspace"
          defaultSize={layoutState.desktopRootSizes[1]}
          minSize="28rem"
          className="min-w-0"
        >
          <div className="flex h-full min-w-0 flex-col">
            <div className="flex h-[61px] shrink-0 items-center justify-between border-b border-kumo-line px-4">
              <CloudflareLogo variant="glyph" className="h-5 w-auto shrink-0" />
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCatalogOpen(true)}
                >
                  Catalog
                </Button>
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

            <div className="relative flex flex-1 overflow-hidden">
              <CatalogExplorerSheet
                open={catalogOpen}
                onOpenChange={setCatalogOpen}
              />
              {(isStreaming || isNoPromptStreaming) && (
                <div
                  className="absolute top-0 left-0 right-0 z-10 h-0.5 bg-kumo-brand/30"
                  aria-label="Streaming in progress"
                >
                  <div
                    className="h-full w-1/3 bg-kumo-brand"
                    style={{ animation: "shimmer 1.5s ease-in-out infinite" }}
                  />
                </div>
              )}
              <ComparisonPanels
                tree={leftEffectiveTree}
                streamedTree={tree}
                showTree={showTree}
                runtimeValueStore={runtimeValueStore}
                isStreaming={isStreaming}
                rawJsonl={rawJsonl}
                onAction={handleAction}
                systemPromptText={systemPromptText}
                leftTab={leftTab}
                onLeftTabChange={setLeftTab}
                leftEditorText={leftEditor.text}
                leftEditorStatus={leftEditor.status}
                leftEditorIssues={leftEditor.validationIssues}
                onLeftEditorTextChange={setLeftEditorText}
                onLeftEditorValidate={setLeftEditorValidation}
                onLeftEditorReset={resetLeftEditor}
                onLeftEditorApplyTree={setLeftLocalTreeOverride}
                onLeftEditorApplied={markLeftEditorApplied}
                leftActionLog={leftActionLog}
                onClearLeftActionLog={clearLeftActionLog}
                noPromptTree={rightEffectiveTree}
                noPromptStreamedTree={noPromptTree}
                noPromptRuntimeValueStore={noPromptRuntimeValueStore}
                showNoPromptTree={showNoPromptTree}
                isNoPromptStreaming={isNoPromptStreaming}
                noPromptStatus={noPromptStatus}
                noPromptRawJsonl={noPromptRawJsonl}
                rightTab={rightTab}
                onRightTabChange={setRightTab}
                rightEditorText={rightEditor.text}
                rightEditorStatus={rightEditor.status}
                rightEditorIssues={rightEditor.validationIssues}
                onRightEditorTextChange={setRightEditorText}
                onRightEditorValidate={setRightEditorValidation}
                onRightEditorReset={resetRightEditor}
                onRightEditorApplyTree={setRightLocalTreeOverride}
                onRightEditorApplied={markRightEditorApplied}
                onNoPromptAction={handleNoPromptAction}
                rightActionLog={rightActionLog}
                onClearRightActionLog={clearRightActionLog}
                skills={skills}
                pendingSkillIds={pendingSkillIds}
                onToggleSkill={handleToggleSkill}
                onApplySkills={handleApplySkills}
                isSkillApplyDisabled={isNoPromptStreaming || !hasSubmitted}
                workspaceSizes={layoutState.workspaceSizes}
                onWorkspaceResize={(sizes: readonly [number, number]) => {
                  dispatchLayoutState({
                    type: "set-workspace-sizes",
                    value: sizes,
                  });
                }}
              />
            </div>
          </div>
        </Panel>
      </Group>
    </div>
  );
}

// =============================================================================
// Side-by-side comparison panels (each with its own tab bar)
// =============================================================================

interface ComparisonPanelsProps {
  // Primary (left) panel data
  readonly tree: UITree;
  readonly streamedTree: UITree;
  readonly showTree: boolean;
  readonly runtimeValueStore: RuntimeValueStore;
  readonly isStreaming: boolean;
  readonly rawJsonl: string;
  readonly onAction?: (event: ActionEvent) => void;
  readonly systemPromptText: string | null;
  readonly leftTab: PanelTab;
  readonly onLeftTabChange: (tab: PanelTab) => void;
  readonly leftEditorText: string;
  readonly leftEditorStatus: "clean" | "dirty" | "invalid" | "applied";
  readonly leftEditorIssues: readonly {
    readonly message: string;
    readonly path: readonly (string | number)[];
  }[];
  readonly onLeftEditorTextChange: (
    text: string,
    source: "stream" | "manual",
  ) => void;
  readonly onLeftEditorValidate: (
    issues: readonly {
      readonly message: string;
      readonly path: readonly (string | number)[];
    }[],
  ) => void;
  readonly onLeftEditorReset: (text: string) => void;
  readonly onLeftEditorApplyTree: (tree: UITree | null) => void;
  readonly onLeftEditorApplied: () => void;
  // Left panel action log
  readonly leftActionLog: readonly ActionLogEntry[];
  readonly onClearLeftActionLog: () => void;
  // Comparison (right) panel data
  readonly noPromptTree: UITree;
  readonly noPromptStreamedTree: UITree;
  readonly noPromptRuntimeValueStore: RuntimeValueStore;
  readonly showNoPromptTree: boolean;
  readonly isNoPromptStreaming: boolean;
  readonly noPromptStatus: StreamStatus;
  readonly noPromptRawJsonl: string;
  readonly rightTab: PanelTab;
  readonly onRightTabChange: (tab: PanelTab) => void;
  readonly rightEditorText: string;
  readonly rightEditorStatus: "clean" | "dirty" | "invalid" | "applied";
  readonly rightEditorIssues: readonly {
    readonly message: string;
    readonly path: readonly (string | number)[];
  }[];
  readonly onRightEditorTextChange: (
    text: string,
    source: "stream" | "manual",
  ) => void;
  readonly onRightEditorValidate: (
    issues: readonly {
      readonly message: string;
      readonly path: readonly (string | number)[];
    }[],
  ) => void;
  readonly onRightEditorReset: (text: string) => void;
  readonly onRightEditorApplyTree: (tree: UITree | null) => void;
  readonly onRightEditorApplied: () => void;
  // Right panel action handler + log
  readonly onNoPromptAction?: (event: ActionEvent) => void;
  readonly rightActionLog: readonly ActionLogEntry[];
  readonly onClearRightActionLog: () => void;
  // Skill picker (Panel B only)
  readonly skills: readonly SkillInfo[];
  readonly pendingSkillIds: ReadonlySet<string>;
  readonly onToggleSkill: (id: string, checked: boolean) => void;
  readonly onApplySkills: () => void;
  readonly isSkillApplyDisabled: boolean;
  readonly workspaceSizes: readonly [number, number];
  readonly onWorkspaceResize: (sizes: readonly [number, number]) => void;
}

/** Renders two side-by-side panels, each with its own tab bar and content. */
function ComparisonPanels({
  tree,
  streamedTree,
  showTree,
  runtimeValueStore,
  isStreaming,
  rawJsonl,
  onAction,
  systemPromptText,
  leftTab,
  onLeftTabChange,
  leftEditorText,
  leftEditorStatus,
  leftEditorIssues,
  onLeftEditorTextChange,
  onLeftEditorValidate,
  onLeftEditorReset,
  onLeftEditorApplyTree,
  onLeftEditorApplied,
  leftActionLog,
  onClearLeftActionLog,
  noPromptTree,
  noPromptStreamedTree,
  noPromptRuntimeValueStore,
  showNoPromptTree,
  isNoPromptStreaming,
  noPromptStatus,
  noPromptRawJsonl,
  rightTab,
  onRightTabChange,
  rightEditorText,
  rightEditorStatus,
  rightEditorIssues,
  onRightEditorTextChange,
  onRightEditorValidate,
  onRightEditorReset,
  onRightEditorApplyTree,
  onRightEditorApplied,
  onNoPromptAction,
  rightActionLog,
  onClearRightActionLog,
  skills,
  pendingSkillIds,
  onToggleSkill,
  onApplySkills,
  isSkillApplyDisabled,
  workspaceSizes,
  onWorkspaceResize,
}: ComparisonPanelsProps) {
  const workspaceLayoutPersistence = useDefaultLayout({
    id: "playground-workspace-layout",
    panelIds: ["a", "b"],
  });

  return (
    <Group
      orientation="horizontal"
      className="flex h-full w-full"
      id="playground-workspace-layout"
      defaultLayout={
        workspaceLayoutPersistence.defaultLayout ?? {
          a: workspaceSizes[0],
          b: workspaceSizes[1],
        }
      }
      onLayoutChanged={(layout) => {
        workspaceLayoutPersistence.onLayoutChanged(layout);
        const a = layout.a;
        const b = layout.b;
        if (a == null || b == null) {
          return;
        }
        onWorkspaceResize([a, b]);
      }}
    >
      <Panel id="a" minSize="20rem" defaultSize="50%" className="min-w-0">
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
            streamedTree={streamedTree}
            promptText={systemPromptText}
            editorText={leftEditorText}
            editorStatus={leftEditorStatus}
            editorIssues={leftEditorIssues}
            onEditorTextChange={onLeftEditorTextChange}
            onEditorValidate={onLeftEditorValidate}
            onEditorReset={onLeftEditorReset}
            onEditorApplyTree={onLeftEditorApplyTree}
            onEditorApplied={onLeftEditorApplied}
            onAction={onAction}
            actionLog={leftActionLog}
            onClearActionLog={onClearLeftActionLog}
            exportComponentName="GeneratedPanelA"
          />
        </div>
      </Panel>

      <PlaygroundResizeHandle orientation="vertical" />

      <Panel id="b" minSize="20rem" defaultSize="50%" className="min-w-0">
        <PanelHeader
          label="B"
          actions={
            <SkillPickerPopover
              skills={skills}
              pendingSkillIds={pendingSkillIds}
              onToggleSkill={onToggleSkill}
              onApply={onApplySkills}
              disabled={isSkillApplyDisabled}
            />
          }
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
            streamedTree={noPromptStreamedTree}
            promptText={BASELINE_PROMPT}
            editorText={rightEditorText}
            editorStatus={rightEditorStatus}
            editorIssues={rightEditorIssues}
            onEditorTextChange={onRightEditorTextChange}
            onEditorValidate={onRightEditorValidate}
            onEditorReset={onRightEditorReset}
            onEditorApplyTree={onRightEditorApplyTree}
            onEditorApplied={onRightEditorApplied}
            streamStatus={noPromptStatus}
            onAction={onNoPromptAction}
            actionLog={rightActionLog}
            onClearActionLog={onClearRightActionLog}
            exportComponentName="GeneratedPanelB"
          />
        </div>
      </Panel>
    </Group>
  );
}

function PlaygroundResizeHandle({
  orientation,
}: {
  readonly orientation: "horizontal" | "vertical";
}) {
  return (
    <Separator
      className={cn(
        "group relative shrink-0 bg-kumo-line/60 transition-colors hover:bg-kumo-brand/60 focus:bg-kumo-brand/60",
        orientation === "vertical" ? "w-1" : "h-1",
      )}
    >
      <div
        className={cn(
          "absolute rounded-full bg-kumo-line transition-colors group-hover:bg-kumo-brand group-focus:bg-kumo-brand",
          orientation === "vertical"
            ? "left-1/2 top-1/2 h-14 w-0.5 -translate-x-1/2 -translate-y-1/2"
            : "left-1/2 top-1/2 h-0.5 w-14 -translate-x-1/2 -translate-y-1/2",
        )}
      />
    </Separator>
  );
}

type CatalogView = "components" | "actions";

function CatalogExplorerContent() {
  const [activeView, setActiveView] = useState<CatalogView>("components");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredComponents = useMemo(() => {
    return playgroundCatalogComponents.filter((component) => {
      if (
        selectedCategory !== "all" &&
        component.category !== selectedCategory
      ) {
        return false;
      }

      if (normalizedQuery.length === 0) {
        return true;
      }

      return component.name.toLowerCase().includes(normalizedQuery);
    });
  }, [normalizedQuery, selectedCategory]);

  const filteredActions = useMemo(() => {
    return playgroundCatalogActions.filter((action) => {
      if (normalizedQuery.length === 0) {
        return true;
      }

      return action.name.toLowerCase().includes(normalizedQuery);
    });
  }, [normalizedQuery]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-kumo-line px-4 py-3">
        <button
          type="button"
          onClick={() => setActiveView("components")}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            activeView === "components"
              ? "bg-kumo-brand text-white"
              : "bg-kumo-elevated text-kumo-default hover:bg-kumo-recessed",
          )}
        >
          Components ({playgroundCatalogComponents.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveView("actions")}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            activeView === "actions"
              ? "bg-kumo-brand text-white"
              : "bg-kumo-elevated text-kumo-default hover:bg-kumo-recessed",
          )}
        >
          Actions ({playgroundCatalogActions.length})
        </button>
      </div>

      <div className="flex flex-col gap-3 border-b border-kumo-line px-4 py-3">
        <label className="flex flex-col gap-1 text-xs text-kumo-subtle">
          Search by name
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={
              activeView === "components"
                ? "Search components"
                : "Search actions"
            }
            className="rounded-md border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default outline-none focus:border-kumo-brand"
          />
        </label>

        {activeView === "components" ? (
          <label className="flex flex-col gap-1 text-xs text-kumo-subtle">
            Filter by category
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="rounded-md border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default outline-none focus:border-kumo-brand"
            >
              <option value="all">All categories</option>
              {playgroundCatalogCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="flex-1 overflow-auto px-4 py-4">
        {activeView === "components" ? (
          <CatalogComponentList components={filteredComponents} />
        ) : (
          <CatalogActionList actions={filteredActions} />
        )}
      </div>
    </div>
  );
}

function CatalogExplorerSheet({
  open,
  onOpenChange,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close catalog explorer"
        className="absolute inset-0 bg-kumo-overlay/60"
        onClick={() => onOpenChange(false)}
      />

      <div className="absolute inset-0 bg-kumo-base md:inset-y-4 md:right-4 md:left-auto md:w-[28rem] md:rounded-xl md:border md:border-kumo-line md:shadow-xl">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-kumo-line px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-kumo-default">Catalog</p>
              <p className="text-xs text-kumo-subtle">
                Components and actions available in the playground
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              icon={<XCircleIcon />}
            >
              Close
            </Button>
          </div>
          <CatalogExplorerContent />
        </div>
      </div>
    </div>
  );
}

function CatalogComponentList({
  components,
}: {
  readonly components: readonly CatalogComponentEntry[];
}) {
  if (components.length === 0) {
    return <p className="text-sm text-kumo-subtle">No matching components.</p>;
  }

  return (
    <div className="space-y-3">
      {components.map((component) => (
        <div
          key={component.name}
          className="rounded-lg border border-kumo-line bg-kumo-base p-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-kumo-default">{component.name}</p>
              <p className="text-xs text-kumo-subtle">{component.category}</p>
            </div>
            <code className="rounded bg-kumo-elevated px-2 py-1 text-[11px] text-kumo-subtle">
              {component.importPath}
            </code>
          </div>
          <p className="mt-2 text-sm text-kumo-subtle">
            {component.description}
          </p>
          <div className="mt-3 space-y-2">
            {component.props.length > 0 ? (
              component.props.slice(0, 8).map((prop) => (
                <div
                  key={prop.name}
                  className="rounded-md bg-kumo-elevated/60 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-kumo-default">
                      {prop.name}
                    </span>
                    <span className="text-xs text-kumo-subtle">
                      {prop.type}
                    </span>
                    <span className="text-xs text-kumo-subtle">
                      {prop.required ? "required" : "optional"}
                    </span>
                  </div>
                  {prop.description ? (
                    <p className="mt-1 text-xs text-kumo-subtle">
                      {prop.description}
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-xs text-kumo-subtle">No documented props.</p>
            )}
            {component.props.length > 8 ? (
              <p className="text-xs text-kumo-subtle">
                +{component.props.length - 8} more props in registry metadata
              </p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function CatalogActionList({
  actions,
}: {
  readonly actions: readonly CatalogActionEntry[];
}) {
  if (actions.length === 0) {
    return <p className="text-sm text-kumo-subtle">No matching actions.</p>;
  }

  return (
    <div className="space-y-3">
      {actions.map((action) => (
        <div
          key={action.name}
          className="rounded-lg border border-kumo-line bg-kumo-base p-3"
        >
          <p className="font-medium text-kumo-default">{action.name}</p>
          <p className="mt-1 text-sm text-kumo-subtle">{action.description}</p>
          <div className="mt-3 space-y-2">
            {action.params.length > 0 ? (
              action.params.map((param) => (
                <div
                  key={param.name}
                  className="rounded-md bg-kumo-elevated/60 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-kumo-default">
                      {param.name}
                    </span>
                    <span className="text-xs text-kumo-subtle">
                      {param.type}
                    </span>
                  </div>
                  {param.description ? (
                    <p className="mt-1 text-xs text-kumo-subtle">
                      {param.description}
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-xs text-kumo-subtle">No params required.</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function MobilePlaygroundShell({
  mobileView,
  onMobileViewChange,
  inputValue,
  onInputChange,
  selectedModel,
  onModelChange,
  isAnyStreaming,
  status,
  messages,
  onSubmit,
  onCancel,
  messagesEndRef,
  presets,
  onToolAction,
  leftTab,
  onLeftTabChange,
  leftTree,
  leftStreamedTree,
  leftShowTree,
  leftRuntimeValueStore,
  isLeftStreaming,
  leftRawJsonl,
  onLeftAction,
  leftPromptText,
  leftEditorText,
  leftEditorStatus,
  leftEditorIssues,
  onLeftEditorTextChange,
  onLeftEditorValidate,
  onLeftEditorReset,
  onLeftEditorApplyTree,
  onLeftEditorApplied,
  leftActionLog,
  onClearLeftActionLog,
  rightTab,
  onRightTabChange,
  rightTree,
  rightStreamedTree,
  rightShowTree,
  rightRuntimeValueStore,
  isRightStreaming,
  rightRawJsonl,
  onRightAction,
  rightPromptText,
  rightEditorText,
  rightEditorStatus,
  rightEditorIssues,
  onRightEditorTextChange,
  onRightEditorValidate,
  onRightEditorReset,
  onRightEditorApplyTree,
  onRightEditorApplied,
  rightStatus,
  rightActionLog,
  onClearRightActionLog,
  skills,
  pendingSkillIds,
  onToggleSkill,
  onApplySkills,
  isSkillApplyDisabled,
}: {
  readonly mobileView: "chat" | "a" | "b" | "catalog";
  readonly onMobileViewChange: (value: "chat" | "a" | "b" | "catalog") => void;
  readonly inputValue: string;
  readonly onInputChange: (value: string) => void;
  readonly selectedModel: string;
  readonly onModelChange: (value: string) => void;
  readonly isAnyStreaming: boolean;
  readonly status: StreamStatus;
  readonly messages: readonly ChatMessage[];
  readonly onSubmit: (event?: FormEvent, overrideMessage?: string) => void;
  readonly onCancel: () => void;
  readonly messagesEndRef: React.RefObject<HTMLDivElement | null>;
  readonly presets: typeof PRESET_PROMPTS;
  readonly onToolAction: (event: ActionEvent) => void;
  readonly leftTab: PanelTab;
  readonly onLeftTabChange: (tab: PanelTab) => void;
  readonly leftTree: UITree;
  readonly leftStreamedTree: UITree;
  readonly leftShowTree: boolean;
  readonly leftRuntimeValueStore: RuntimeValueStore;
  readonly isLeftStreaming: boolean;
  readonly leftRawJsonl: string;
  readonly onLeftAction?: (event: ActionEvent) => void;
  readonly leftPromptText: string | null;
  readonly leftEditorText: string;
  readonly leftEditorStatus: "clean" | "dirty" | "invalid" | "applied";
  readonly leftEditorIssues: readonly {
    readonly message: string;
    readonly path: readonly (string | number)[];
  }[];
  readonly onLeftEditorTextChange: (
    text: string,
    source: "stream" | "manual",
  ) => void;
  readonly onLeftEditorValidate: (
    issues: readonly {
      readonly message: string;
      readonly path: readonly (string | number)[];
    }[],
  ) => void;
  readonly onLeftEditorReset: (text: string) => void;
  readonly onLeftEditorApplyTree: (tree: UITree | null) => void;
  readonly onLeftEditorApplied: () => void;
  readonly leftActionLog: readonly ActionLogEntry[];
  readonly onClearLeftActionLog: () => void;
  readonly rightTab: PanelTab;
  readonly onRightTabChange: (tab: PanelTab) => void;
  readonly rightTree: UITree;
  readonly rightStreamedTree: UITree;
  readonly rightShowTree: boolean;
  readonly rightRuntimeValueStore: RuntimeValueStore;
  readonly isRightStreaming: boolean;
  readonly rightRawJsonl: string;
  readonly onRightAction?: (event: ActionEvent) => void;
  readonly rightPromptText: string | null;
  readonly rightEditorText: string;
  readonly rightEditorStatus: "clean" | "dirty" | "invalid" | "applied";
  readonly rightEditorIssues: readonly {
    readonly message: string;
    readonly path: readonly (string | number)[];
  }[];
  readonly onRightEditorTextChange: (
    text: string,
    source: "stream" | "manual",
  ) => void;
  readonly onRightEditorValidate: (
    issues: readonly {
      readonly message: string;
      readonly path: readonly (string | number)[];
    }[],
  ) => void;
  readonly onRightEditorReset: (text: string) => void;
  readonly onRightEditorApplyTree: (tree: UITree | null) => void;
  readonly onRightEditorApplied: () => void;
  readonly rightStatus: StreamStatus;
  readonly rightActionLog: readonly ActionLogEntry[];
  readonly onClearRightActionLog: () => void;
  readonly skills: readonly SkillInfo[];
  readonly pendingSkillIds: ReadonlySet<string>;
  readonly onToggleSkill: (id: string, checked: boolean) => void;
  readonly onApplySkills: () => void;
  readonly isSkillApplyDisabled: boolean;
}) {
  const shellTabs = [
    { value: "chat", label: "Chat" },
    { value: "a", label: "A" },
    { value: "b", label: "B" },
    { value: "catalog", label: "Catalog" },
  ] as const;

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden md:hidden">
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

      <div className="border-b border-kumo-line px-3 py-2">
        <div className="flex gap-2 overflow-x-auto">
          {shellTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => onMobileViewChange(tab.value)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                mobileView === tab.value
                  ? "bg-kumo-brand text-white"
                  : "bg-kumo-elevated text-kumo-default hover:bg-kumo-recessed",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {mobileView === "chat" ? (
          <MobileChatView
            inputValue={inputValue}
            onInputChange={onInputChange}
            selectedModel={selectedModel}
            onModelChange={onModelChange}
            isStreaming={isAnyStreaming}
            status={status}
            messages={messages}
            onSubmit={onSubmit}
            onCancel={onCancel}
            messagesEndRef={messagesEndRef}
            presets={presets}
            onToolAction={onToolAction}
          />
        ) : null}

        {mobileView === "a" ? (
          <div className="flex h-full flex-col overflow-hidden">
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
                tree={leftTree}
                showTree={leftShowTree}
                runtimeValueStore={leftRuntimeValueStore}
                isStreaming={isLeftStreaming}
                rawJsonl={leftRawJsonl}
                streamedTree={leftStreamedTree}
                promptText={leftPromptText}
                editorText={leftEditorText}
                editorStatus={leftEditorStatus}
                editorIssues={leftEditorIssues}
                onEditorTextChange={onLeftEditorTextChange}
                onEditorValidate={onLeftEditorValidate}
                onEditorReset={onLeftEditorReset}
                onEditorApplyTree={onLeftEditorApplyTree}
                onEditorApplied={onLeftEditorApplied}
                onAction={onLeftAction}
                actionLog={leftActionLog}
                onClearActionLog={onClearLeftActionLog}
                exportComponentName="GeneratedPanelA"
              />
            </div>
          </div>
        ) : null}

        {mobileView === "b" ? (
          <div className="flex h-full flex-col overflow-hidden">
            <PanelHeader
              label="B"
              actions={
                <SkillPickerPopover
                  skills={skills}
                  pendingSkillIds={pendingSkillIds}
                  onToggleSkill={onToggleSkill}
                  onApply={onApplySkills}
                  disabled={isSkillApplyDisabled}
                />
              }
              tabs={PANEL_TABS}
              activeTab={rightTab}
              onTabChange={(v) => {
                if (isPanelTab(v)) onRightTabChange(v);
              }}
            />
            <div className="flex-1 overflow-auto">
              <PanelContent
                tab={rightTab}
                tree={rightTree}
                showTree={rightShowTree}
                runtimeValueStore={rightRuntimeValueStore}
                isStreaming={isRightStreaming}
                rawJsonl={rightRawJsonl}
                streamedTree={rightStreamedTree}
                promptText={rightPromptText}
                editorText={rightEditorText}
                editorStatus={rightEditorStatus}
                editorIssues={rightEditorIssues}
                onEditorTextChange={onRightEditorTextChange}
                onEditorValidate={onRightEditorValidate}
                onEditorReset={onRightEditorReset}
                onEditorApplyTree={onRightEditorApplyTree}
                onEditorApplied={onRightEditorApplied}
                onAction={onRightAction}
                streamStatus={rightStatus}
                actionLog={rightActionLog}
                onClearActionLog={onClearRightActionLog}
                exportComponentName="GeneratedPanelB"
              />
            </div>
          </div>
        ) : null}

        {mobileView === "catalog" ? (
          <div className="flex h-full flex-col overflow-hidden">
            <div className="border-b border-kumo-line px-4 py-3">
              <p className="text-sm font-semibold text-kumo-default">Catalog</p>
              <p className="text-xs text-kumo-subtle">
                Components and actions available in the playground
              </p>
            </div>
            <CatalogExplorerContent />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MobileChatView({
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
  onToolAction,
}: {
  readonly inputValue: string;
  readonly onInputChange: (value: string) => void;
  readonly selectedModel: string;
  readonly onModelChange: (value: string) => void;
  readonly isStreaming: boolean;
  readonly status: StreamStatus;
  readonly messages: readonly ChatMessage[];
  readonly onSubmit: (event?: FormEvent, overrideMessage?: string) => void;
  readonly onCancel: () => void;
  readonly messagesEndRef: React.RefObject<HTMLDivElement | null>;
  readonly presets: typeof PRESET_PROMPTS;
  readonly onToolAction: (event: ActionEvent) => void;
}) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSubmit();
      }
    },
    [onSubmit],
  );

  const turnCount = messages.length;
  const hasMessages = messages.length > 0;
  const statusInfo = STATUS_CONFIG[status];

  return (
    <section className="flex h-full flex-col bg-kumo-overlay" aria-label="Chat">
      <div className="flex shrink-0 items-center gap-2 border-b border-kumo-line px-4 py-3">
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
        {turnCount > 0 ? (
          <span className="text-xs text-kumo-subtle">
            {Math.ceil(turnCount / 2)}{" "}
            {Math.ceil(turnCount / 2) === 1 ? "turn" : "turns"}
          </span>
        ) : null}
        {status !== "idle" ? (
          <span className={cn("flex items-center", statusInfo.className)}>
            {statusInfo.icon}
          </span>
        ) : null}
      </div>

      <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
        {!hasMessages ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-kumo-subtle">
              Describe the UI you want to generate
            </p>
          </div>
        ) : null}

        {messages.map((msg, i) =>
          msg.role === "tool" ? (
            <InlineToolCard
              key={msg.toolId}
              tree={msg.tree}
              status={msg.status}
              onAction={onToolAction}
            />
          ) : (
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
                    : "max-w-[85%] rounded-lg border border-kumo-line bg-kumo-elevated px-3 py-2 text-sm text-kumo-default"
                }
              >
                {msg.role === "assistant" ? (
                  <AssistantMessageSummary content={msg.content} />
                ) : (
                  <p className="whitespace-pre-wrap break-words">
                    {msg.content}
                  </p>
                )}
              </div>
            </div>
          ),
        )}

        {isStreaming ? (
          <div className="flex justify-start">
            <div className="rounded-lg border border-kumo-line bg-kumo-elevated px-3 py-2">
              <SpinnerIcon size={14} className="animate-spin text-kumo-brand" />
            </div>
          </div>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

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
              hasMessages ? "Follow up..." : "Describe the UI you want..."
            }
            disabled={isStreaming}
            aria-label="Prompt"
            rows={3}
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
    </section>
  );
}

/** Header bar for each panel: label + optional actions above underline tab bar. */
function PanelHeader({
  label,
  actions,
  tabs,
  activeTab,
  onTabChange,
}: {
  readonly label: string;
  readonly actions?: React.ReactNode;
  readonly tabs: TabsItem[];
  readonly activeTab: PanelTab;
  readonly onTabChange: (value: string) => void;
}) {
  return (
    <div className="shrink-0 bg-kumo-elevated/50">
      <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-kumo-subtle">
          {label}
        </span>
        {actions}
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

// =============================================================================
// Skill picker popover (Panel B header action)
// =============================================================================

/**
 * Popover that renders checkboxes for each available skill.
 * Manages its own open/close state. Calls `onApply` with the current
 * pending selection when the Apply button is clicked.
 */
function SkillPickerPopover({
  skills,
  pendingSkillIds,
  onToggleSkill,
  onApply,
  disabled,
}: {
  readonly skills: readonly SkillInfo[];
  readonly pendingSkillIds: ReadonlySet<string>;
  readonly onToggleSkill: (id: string, checked: boolean) => void;
  readonly onApply: () => void;
  readonly disabled: boolean;
}) {
  const [open, setOpen] = useState(false);

  const handleApply = useCallback(() => {
    setOpen(false);
    onApply();
  }, [onApply]);

  const selectedCount = pendingSkillIds.size;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-kumo-subtle transition-colors hover:bg-kumo-elevated hover:text-kumo-default"
          aria-label="Skill picker"
        >
          <SlidersHorizontalIcon size={12} />
          Skills
          {selectedCount > 0 && (
            <span className="ml-0.5 rounded-full bg-kumo-brand px-1 text-[10px] leading-tight text-white">
              {selectedCount}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Content side="bottom" align="start" sideOffset={4}>
        <div className="flex flex-col gap-2 p-3" style={{ minWidth: 240 }}>
          <Popover.Title>Skills</Popover.Title>
          <Popover.Description>
            Select design skills to augment Panel B generation.
          </Popover.Description>
          <div className="max-h-48 overflow-y-auto px-0.5 py-1">
            {skills.length === 0 && (
              <p className="text-xs text-kumo-subtle py-1">
                No skills available
              </p>
            )}
            <Stack gap="base">
              {skills.map((skill) => (
                <Checkbox
                  key={skill.id}
                  label={skill.name}
                  checked={pendingSkillIds.has(skill.id)}
                  onCheckedChange={(checked) =>
                    onToggleSkill(skill.id, checked)
                  }
                />
              ))}
            </Stack>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleApply}
            disabled={disabled}
            className="mt-1 w-full"
          >
            Apply
          </Button>
        </div>
      </Popover.Content>
    </Popover>
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
  streamedTree,
  promptText,
  editorText,
  editorStatus,
  editorIssues,
  onEditorTextChange,
  onEditorValidate,
  onEditorReset,
  onEditorApplyTree,
  onEditorApplied,
  onAction,
  streamStatus,
  actionLog,
  onClearActionLog,
  exportComponentName,
}: {
  readonly tab: PanelTab;
  readonly tree: UITree;
  readonly showTree: boolean;
  readonly runtimeValueStore: RuntimeValueStore;
  readonly isStreaming: boolean;
  readonly rawJsonl: string;
  readonly streamedTree: UITree;
  readonly promptText: string | null;
  readonly editorText: string;
  readonly editorStatus: "clean" | "dirty" | "invalid" | "applied";
  readonly editorIssues: readonly {
    readonly message: string;
    readonly path: readonly (string | number)[];
  }[];
  readonly onEditorTextChange: (
    text: string,
    source: "stream" | "manual",
  ) => void;
  readonly onEditorValidate: (
    issues: readonly {
      readonly message: string;
      readonly path: readonly (string | number)[];
    }[],
  ) => void;
  readonly onEditorReset: (text: string) => void;
  readonly onEditorApplyTree: (tree: UITree | null) => void;
  readonly onEditorApplied: () => void;
  readonly onAction?: (event: ActionEvent) => void;
  readonly streamStatus?: StreamStatus;
  readonly actionLog: readonly ActionLogEntry[];
  readonly onClearActionLog: () => void;
  readonly exportComponentName: string;
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
      return (
        <CodeTabContent
          tree={tree}
          showTree={showTree}
          exportComponentName={exportComponentName}
        />
      );
    case "editor":
      return (
        <EditorTabContent
          tree={tree}
          streamedTree={streamedTree}
          text={editorText}
          status={editorStatus}
          issues={editorIssues}
          isStreaming={isStreaming}
          onTextChange={onEditorTextChange}
          onValidate={onEditorValidate}
          onReset={onEditorReset}
          onApplyTree={onEditorApplyTree}
          onApplied={onEditorApplied}
        />
      );
    case "tree":
      return <TreeTabContent tree={tree} isStreaming={isStreaming} />;
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

/** Renders a nested JSON view of the active UITree. */
function TreeTabContent({
  tree,
  isStreaming,
}: {
  readonly tree: UITree;
  readonly isStreaming: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nestedTreeJson = useMemo(() => {
    if (!tree.root || Object.keys(tree.elements).length === 0) {
      return "";
    }

    const nestedTree = buildNestedTree(tree);
    if (nestedTree === null) {
      return "";
    }

    return JSON.stringify(nestedTree, null, 2);
  }, [tree]);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(nestedTreeJson).then(() => {
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }, [nestedTreeJson]);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  if (!nestedTreeJson) {
    if (isStreaming) {
      return (
        <div className="flex h-full items-center justify-center">
          <Loader size="sm" />
        </div>
      );
    }

    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-kumo-subtle">Generate UI to see tree output</p>
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
        <HighlightedCode code={nestedTreeJson} lang="json" />
      </div>
    </div>
  );
}

/** Editable JSON tree view with validate/apply/reset controls. */
function EditorTabContent({
  tree,
  streamedTree,
  text,
  status,
  issues,
  isStreaming,
  onTextChange,
  onValidate,
  onReset,
  onApplyTree,
  onApplied,
}: {
  readonly tree: UITree;
  readonly streamedTree: UITree;
  readonly text: string;
  readonly status: "clean" | "dirty" | "invalid" | "applied";
  readonly issues: readonly {
    readonly message: string;
    readonly path: readonly (string | number)[];
  }[];
  readonly isStreaming: boolean;
  readonly onTextChange: (text: string, source: "stream" | "manual") => void;
  readonly onValidate: (
    issues: readonly {
      readonly message: string;
      readonly path: readonly (string | number)[];
    }[],
  ) => void;
  readonly onReset: (text: string) => void;
  readonly onApplyTree: (tree: UITree | null) => void;
  readonly onApplied: () => void;
}) {
  const [isWorking, setIsWorking] = useState(false);

  const resetText = useMemo(
    () => JSON.stringify(streamedTree, null, 2),
    [streamedTree],
  );
  const currentTreeText = useMemo(() => JSON.stringify(tree, null, 2), [tree]);

  const runValidation = useCallback(async () => {
    setIsWorking(true);
    try {
      const result = await validateEditableTree(text, CUSTOM_COMPONENTS);
      if (result.success) {
        onValidate([]);
      } else {
        onValidate(result.issues);
      }
      return result;
    } finally {
      setIsWorking(false);
    }
  }, [onValidate, text]);

  const handleFormat = useCallback(() => {
    try {
      const formatted = JSON.stringify(JSON.parse(text), null, 2);
      onTextChange(formatted, "manual");
      onValidate([]);
    } catch (error) {
      onValidate([
        {
          message:
            error instanceof Error ? error.message : "Invalid JSON document",
          path: [],
        },
      ]);
    }
  }, [onTextChange, onValidate, text]);

  const handleApply = useCallback(async () => {
    const result = await runValidation();
    if (!result.success) {
      return;
    }

    const nextText = JSON.stringify(result.tree, null, 2);
    onTextChange(nextText, "manual");
    onApplyTree(result.tree);
    onApplied();
  }, [onApplied, onApplyTree, onTextChange, runValidation]);

  const handleReset = useCallback(() => {
    onApplyTree(null);
    onReset(resetText);
  }, [onApplyTree, onReset, resetText]);

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleFormat}
          disabled={isStreaming || isWorking}
        >
          Format
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void runValidation()}
          disabled={isStreaming || isWorking}
        >
          Validate
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => void handleApply()}
          disabled={isStreaming || isWorking}
        >
          Apply
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          disabled={isStreaming || isWorking}
        >
          Reset to latest streamed tree
        </Button>
        <span className="ml-auto text-xs text-kumo-subtle">
          {isWorking ? "Working..." : `Status: ${status}`}
        </span>
      </div>

      <div className="rounded-lg border border-kumo-line bg-kumo-base overflow-hidden">
        <textarea
          value={text}
          onChange={(event) => onTextChange(event.target.value, "manual")}
          spellCheck={false}
          disabled={isStreaming || isWorking}
          aria-label="Editable UI tree JSON"
          className="min-h-[320px] w-full resize-none bg-transparent px-4 py-3 font-mono text-xs leading-5 text-kumo-default outline-none"
        />
      </div>

      {issues.length > 0 ? (
        <div className="rounded-lg border border-kumo-danger/40 bg-kumo-danger/10 p-3">
          <p className="mb-2 text-xs font-medium text-kumo-danger">
            Validation issues ({issues.length})
          </p>
          <div className="space-y-1">
            {issues.map((issue, index) => (
              <p
                key={`${issue.message}-${index}`}
                className="font-mono text-xs text-kumo-danger"
              >
                {issue.path.length > 0
                  ? `${issue.path.join(".")}: ${issue.message}`
                  : issue.message}
              </p>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-kumo-subtle">
          Editing is local to this panel. Apply updates preview, TSX, grading,
          and tree views without sending a new request.
        </p>
      )}

      <details className="rounded-lg border border-kumo-line bg-kumo-elevated px-3 py-2">
        <summary className="cursor-pointer text-xs text-kumo-subtle">
          Current effective tree snapshot
        </summary>
        <div className="mt-2 max-h-40 overflow-auto">
          <HighlightedCode code={currentTreeText} lang="json" />
        </div>
      </details>
    </div>
  );
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
  exportComponentName,
}: {
  readonly tree: UITree;
  readonly showTree: boolean;
  readonly exportComponentName: string;
}) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const downloadedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const jsxCode = useMemo(
    () =>
      showTree ? uiTreeToJsx(tree, { componentName: exportComponentName }) : "",
    [exportComponentName, tree, showTree],
  );

  const includesPlaygroundOnlyComponent = useMemo(
    () => jsxCode.includes("DemoButton"),
    [jsxCode],
  );

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(jsxCode).then(() => {
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }, [jsxCode]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([jsxCode], { type: "text/tsx;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${exportComponentName}.tsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    if (downloadedTimerRef.current) clearTimeout(downloadedTimerRef.current);
    downloadedTimerRef.current = setTimeout(() => setDownloaded(false), 2000);
  }, [exportComponentName, jsxCode]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      if (downloadedTimerRef.current) clearTimeout(downloadedTimerRef.current);
    };
  }, []);

  if (!showTree) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-kumo-subtle">Generate UI to see TSX</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-kumo-line px-4 py-3">
        <div>
          <p className="text-sm font-medium text-kumo-default">
            {exportComponentName}
          </p>
          <p className="text-xs text-kumo-subtle">Exportable TSX module</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            icon={copied ? <CheckIcon /> : <CopyIcon />}
          >
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDownload}>
            {downloaded ? "Downloaded" : "Download .tsx"}
          </Button>
        </div>
      </div>
      {includesPlaygroundOnlyComponent ? (
        <div className="border-b border-kumo-line bg-kumo-warning/10 px-4 py-2">
          <p className="text-xs text-kumo-subtle">
            Warning: this export references `DemoButton`, which is
            playground-only and not shipped by `@cloudflare/kumo`.
          </p>
        </div>
      ) : null}
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

// =============================================================================
// InlineToolCard — renders a streamed tool confirmation card in the chat
// =============================================================================

interface InlineToolCardProps {
  readonly tree: UITree;
  readonly status: ToolMessageStatus;
  readonly onAction: (event: ActionEvent) => void;
}

/**
 * Renders a tool confirmation card inline in the chat sidebar using
 * `UITreeRenderer` — the same renderer the A/B panels use.
 *
 * Shows a spinner while streaming, the rendered card when pending,
 * and status overlays for applying/completed/cancelled/error states.
 */
function InlineToolCard({ tree, status, onAction }: InlineToolCardProps) {
  const hasTree = tree.root !== "" && Object.keys(tree.elements).length > 0;

  return (
    <div className="rounded-lg border border-kumo-line bg-kumo-elevated overflow-hidden">
      {/* Streaming spinner before tree is populated */}
      {status === "streaming" && !hasTree && (
        <div className="flex items-center gap-2 px-3 py-3">
          <SpinnerIcon size={14} className="animate-spin text-kumo-brand" />
          <span className="text-xs text-kumo-subtle">
            Generating confirmation…
          </span>
        </div>
      )}

      {/* Render the UITree when available */}
      {hasTree && (
        <div className="p-2">
          <UITreeRenderer tree={tree} onAction={onAction} />
        </div>
      )}

      {/* Status overlays */}
      {status === "applying" && (
        <div className="flex items-center gap-2 border-t border-kumo-line px-3 py-2">
          <SpinnerIcon size={12} className="animate-spin text-kumo-brand" />
          <span className="text-xs text-kumo-subtle">Applying…</span>
        </div>
      )}
      {status === "completed" && (
        <div className="flex items-center gap-2 border-t border-kumo-line px-3 py-2">
          <CheckIcon size={12} className="text-kumo-success" />
          <span className="text-xs text-kumo-success">Completed</span>
        </div>
      )}
      {status === "cancelled" && (
        <div className="flex items-center gap-2 border-t border-kumo-line px-3 py-2">
          <XCircleIcon size={12} className="text-kumo-subtle" />
          <span className="text-xs text-kumo-subtle">Cancelled</span>
        </div>
      )}
      {status === "error" && (
        <div className="flex items-center gap-2 border-t border-kumo-line px-3 py-2">
          <WarningCircleIcon size={12} className="text-kumo-danger" />
          <span className="text-xs text-kumo-danger">
            Failed to generate card
          </span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Chat sidebar
// =============================================================================

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
  /** Action handler for inline tool confirmation card actions (tool_approve / tool_cancel). */
  readonly onToolAction: (event: ActionEvent) => void;
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
  onToolAction,
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
        className="hidden h-full w-full min-w-0 flex-col items-center gap-3 border-r border-kumo-line bg-kumo-overlay py-3 md:flex"
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
      className="hidden h-full w-full min-w-0 flex-col border-r border-kumo-line bg-kumo-overlay md:flex"
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

        {messages.map((msg, i) =>
          msg.role === "tool" ? (
            <InlineToolCard
              key={msg.toolId}
              tree={msg.tree}
              status={msg.status}
              onAction={onToolAction}
            />
          ) : (
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
                  <p className="whitespace-pre-wrap break-words">
                    {msg.content}
                  </p>
                )}
              </div>
            </div>
          ),
        )}

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
