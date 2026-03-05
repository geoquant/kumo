/**
 * Tool registry — declarative definitions for MCP tools surfaced in the
 * playground chat sidebar.
 *
 * Each {@link ToolDefinition} encapsulates everything needed to intercept a
 * user message, stream an inline confirmation card, handle the approve/cancel
 * action, call the MCP proxy for execution, and fire a follow-up prompt.
 *
 * The registry is iterated by `handleSubmit` (message interception) and
 * `handleToolAction` (action routing) in `_PlaygroundPage.tsx`, removing
 * all hardcoded tool knowledge from the component.
 *
 * Adding a new tool is a single entry in {@link TOOL_REGISTRY} — no
 * changes to `_PlaygroundPage.tsx` required.
 */

import { TOOL_CONFIRMATION_PROMPT } from "~/lib/tool-prompts";

// =============================================================================
// Types
// =============================================================================

/** Pill preset shown at the bottom of the chat sidebar. */
export interface ToolPill {
  /** Label shown on the pill button. */
  readonly label: string;
  /** Prompt text submitted when the pill is clicked. */
  readonly prompt: string;
}

/**
 * Match result returned by a tool's {@link ToolDefinition.match} function.
 *
 * Contains the extracted parameters to pass to the MCP proxy's execution
 * tool call (e.g. `{ workerName: "hello-world" }`).
 *
 * `null` means the message didn't match this tool.
 */
export type ToolMatchResult = Record<string, string> | null;

/**
 * Declarative definition of an MCP tool surfaced in the playground.
 *
 * Encapsulates message matching, confirmation card streaming, action
 * handling, and follow-up prompt generation — everything the component
 * needs to handle the tool lifecycle generically.
 */
export interface ToolDefinition {
  /**
   * Attempt to match a user message to this tool.
   *
   * Returns extracted params (passed to `mcpExecuteToolName`) on match,
   * `null` if the message doesn't match.
   */
  readonly match: (message: string) => ToolMatchResult;

  /**
   * MCP tool name for the execution call triggered by the user's
   * approve action (e.g. `"execute_create_worker"`).
   */
  readonly mcpExecuteToolName: string;

  /**
   * Validate the structured content returned by `mcpExecuteToolName`.
   *
   * Returns `true` if execution was successful. The host transitions
   * the tool message to "completed" on success, reverts to "pending"
   * on failure so the user can retry.
   */
  readonly validateExecuteResult: (
    structuredContent: Record<string, unknown>,
  ) => boolean;

  /**
   * Build the follow-up prompt sent after successful execution.
   *
   * Receives the params extracted by {@link match} (or from
   * the action payload). Should avoid phrasing that would
   * re-trigger the tool intercept.
   */
  readonly buildFollowUpPrompt: (params: Record<string, string>) => string;

  /**
   * Derive a `toolId` from the matched params. Used for both
   * message identification and TOOL_ID placeholder replacement.
   */
  readonly deriveToolId: (params: Record<string, string>) => string;

  /**
   * Derive the MCP execution params from the toolId.
   * Called when the user clicks Approve to reconstruct the params
   * needed for the `mcpExecuteToolName` call.
   */
  readonly deriveExecuteParams: (toolId: string) => Record<string, string>;

  /**
   * Build the user-facing message forwarded to `/api/chat` for
   * confirmation card generation. Receives the matched params.
   */
  readonly buildConfirmationMessage: (params: Record<string, string>) => string;

  /**
   * Build the system prompt for the confirmation card stream.
   * Called with `toolId` already derived. Defaults can use
   * `TOOL_CONFIRMATION_PROMPT` with TOOL_ID replaced.
   */
  readonly buildConfirmationSystemPrompt: (toolId: string) => string;

  /**
   * Optional pill preset for the chat sidebar.
   * When present, a pill button is rendered that submits {@link ToolPill.prompt}.
   */
  readonly pill: ToolPill | null;
}

// =============================================================================
// Registry
// =============================================================================

/** Regex that matches a "create worker" user message. */
const CREATE_WORKER_PATTERN = /\bcreate\b.*\bworker\b/i;

/**
 * Tool registry — keyed by `mcpExecuteToolName` so action routing can
 * look up the definition in O(1) from the action payload.
 *
 * To add a new tool, add an entry here. No changes to `_PlaygroundPage.tsx`
 * are needed.
 */
export const TOOL_REGISTRY: ReadonlyMap<string, ToolDefinition> = new Map<
  string,
  ToolDefinition
>([
  [
    "execute_create_worker",
    {
      match: (message) =>
        CREATE_WORKER_PATTERN.test(message)
          ? { workerName: "hello-world" }
          : null,

      mcpExecuteToolName: "execute_create_worker",

      validateExecuteResult: (sc) => sc["success"] === true,

      buildFollowUpPrompt: (params) => {
        const name = params["workerName"] ?? "hello-world";
        return (
          `Generate a deployment dashboard for the "${name}" Workers script. ` +
          `Include CloudflareLogo at the top, a heading with the script name, ` +
          `status Badge, and a Table of recent deployments.`
        );
      },

      deriveToolId: (params) => {
        const name = params["workerName"] ?? "hello-world";
        return `create-worker-${name}`;
      },

      deriveExecuteParams: (toolId) => {
        const name = toolId.replace(/^create-worker-/, "");
        return { workerName: name };
      },

      buildConfirmationMessage: (params) => {
        const name = params["workerName"] ?? "hello-world";
        return `Create a new Cloudflare Worker named "${name}". Ask me to confirm.`;
      },

      buildConfirmationSystemPrompt: (toolId) =>
        TOOL_CONFIRMATION_PROMPT.split("TOOL_ID").join(toolId),

      pill: {
        label: "Create worker",
        prompt: "create a new hello world worker",
      },
    },
  ],
]);

// =============================================================================
// Helpers
// =============================================================================

/**
 * Find the first tool definition whose {@link ToolDefinition.match} returns
 * non-null for the given message.
 *
 * Returns `[definition, matchedParams]` or `null` if no tool matches.
 */
export function matchToolForMessage(
  message: string,
): readonly [ToolDefinition, Record<string, string>] | null {
  for (const def of TOOL_REGISTRY.values()) {
    const params = def.match(message);
    if (params !== null) return [def, params] as const;
  }
  return null;
}

/**
 * Find a tool definition by its `mcpExecuteToolName`.
 *
 * Used by action handlers to look up the definition from the
 * approve action payload.
 */
export function getToolByExecuteName(
  executeName: string,
): ToolDefinition | undefined {
  return TOOL_REGISTRY.get(executeName);
}

/**
 * Collect pill presets from all registered tools.
 *
 * Returns an array of `{ label, prompt }` in registry iteration order.
 * Tools without a pill are skipped.
 */
export function getToolPills(): readonly ToolPill[] {
  const pills: ToolPill[] = [];
  for (const def of TOOL_REGISTRY.values()) {
    if (def.pill !== null) pills.push(def.pill);
  }
  return pills;
}
