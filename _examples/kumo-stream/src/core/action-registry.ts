/**
 * Action handler registry — maps action names to typed handler functions.
 *
 * Each handler receives an ActionEvent and the current UITree, and returns
 * an ActionResult discriminated union describing the effect. The host
 * application dispatches on the result's `type` field to apply patches,
 * send messages, trigger external calls, or do nothing.
 *
 * Built-in handlers cover common patterns (counter, form, navigation).
 * Consumers can extend the registry with custom handlers.
 */

import type { ActionEvent } from "./action-handler";
import type { UITree } from "./types";
import type { JsonPatchOp } from "./rfc6902";

// =============================================================================
// Result types — discriminated union on `type`
// =============================================================================

/** Apply one or more RFC 6902 patches to the UITree. */
export interface PatchResult {
  readonly type: "patch";
  readonly patches: readonly JsonPatchOp[];
}

/** Send a message (e.g. inject form data into chat as a user message). */
export interface MessageResult {
  readonly type: "message";
  readonly content: string;
}

/** Trigger an external side effect (e.g. window.open, navigation). */
export interface ExternalResult {
  readonly type: "external";
  readonly url: string;
  readonly target?: string;
}

/** No-op — action was handled but produced no visible effect. */
export interface NoneResult {
  readonly type: "none";
}

/**
 * Discriminated union of all possible action outcomes.
 * Host code switches on `result.type` to decide what to do.
 */
export type ActionResult =
  | PatchResult
  | MessageResult
  | ExternalResult
  | NoneResult;

// =============================================================================
// Handler type
// =============================================================================

/**
 * A handler function that processes an ActionEvent against the current tree.
 * Returns an ActionResult describing the effect, or `null` if the handler
 * cannot process the event (e.g. missing target element).
 */
export type ActionHandler = (
  event: ActionEvent,
  tree: UITree,
) => ActionResult | null;

/**
 * Map of action names to their handler functions.
 * Used by the host to look up how to process a given action.
 */
export type ActionHandlerMap = Record<string, ActionHandler>;

// =============================================================================
// Built-in handlers
// =============================================================================

/** Well-known element key for counter display text. */
const COUNT_DISPLAY_KEY = "count-display";

/**
 * Read the current numeric value from the counter display element.
 * Returns 0 for missing elements, non-numeric text, or null/undefined children.
 */
function readCounterValue(tree: UITree): number | null {
  const element = tree.elements[COUNT_DISPLAY_KEY];
  if (element == null) return null;

  const props = element.props as Record<string, unknown>;
  const children = props.children;

  const text =
    typeof children === "string"
      ? children
      : typeof children === "number"
        ? String(children)
        : "0";

  const parsed = Number.parseInt(text, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Increment the counter display by 1. */
function handleIncrement(
  _event: ActionEvent,
  tree: UITree,
): ActionResult | null {
  const current = readCounterValue(tree);
  if (current == null) return null;

  return {
    type: "patch",
    patches: [
      {
        op: "replace",
        path: `/elements/${COUNT_DISPLAY_KEY}/props/children`,
        value: String(current + 1),
      },
    ],
  };
}

/** Decrement the counter display by 1. */
function handleDecrement(
  _event: ActionEvent,
  tree: UITree,
): ActionResult | null {
  const current = readCounterValue(tree);
  if (current == null) return null;

  return {
    type: "patch",
    patches: [
      {
        op: "replace",
        path: `/elements/${COUNT_DISPLAY_KEY}/props/children`,
        value: String(current - 1),
      },
    ],
  };
}

/**
 * Submit form data as a chat message.
 *
 * Expects `event.params` to contain form field values, or falls back
 * to `event.context` for runtime-collected data. Serializes the data
 * into a human-readable message string.
 */
function handleSubmitForm(
  event: ActionEvent,
  _tree: UITree,
): ActionResult | null {
  const data = event.params ?? event.context;
  if (data == null || Object.keys(data).length === 0) {
    return { type: "none" };
  }

  const lines = Object.entries(data).map(
    ([key, value]) => `${key}: ${String(value)}`,
  );

  return {
    type: "message",
    content: lines.join("\n"),
  };
}

/**
 * Navigate to a URL.
 *
 * Reads `url` and optional `target` from `event.params`.
 * Returns `null` if no URL is provided.
 */
function handleNavigate(
  event: ActionEvent,
  _tree: UITree,
): ActionResult | null {
  const url = event.params?.url;
  if (typeof url !== "string" || url.length === 0) return null;

  const target = event.params?.target;

  return {
    type: "external",
    url,
    ...(typeof target === "string" ? { target } : undefined),
  };
}

// =============================================================================
// Registry
// =============================================================================

/**
 * Built-in action handlers for common interaction patterns.
 *
 * - `increment` / `decrement`: Counter manipulation via RFC 6902 patches
 * - `submit_form`: Serialize form data into a chat message
 * - `navigate`: Open a URL (external side effect)
 */
export const BUILTIN_HANDLERS: Readonly<ActionHandlerMap> = {
  increment: handleIncrement,
  decrement: handleDecrement,
  submit_form: handleSubmitForm,
  navigate: handleNavigate,
};

/**
 * Create a merged handler map from built-in + custom handlers.
 * Custom handlers take precedence over built-ins for the same action name.
 */
export function createHandlerMap(
  custom?: Readonly<ActionHandlerMap>,
): Readonly<ActionHandlerMap> {
  if (custom == null) return BUILTIN_HANDLERS;
  return { ...BUILTIN_HANDLERS, ...custom };
}

/**
 * Dispatch an action event through a handler map.
 *
 * @returns The ActionResult from the matching handler, or `null` if no
 *          handler is registered for the action name.
 */
export function dispatchAction(
  handlers: Readonly<ActionHandlerMap>,
  event: ActionEvent,
  tree: UITree,
): ActionResult | null {
  const handler = handlers[event.actionName];
  if (handler == null) return null;
  return handler(event, tree);
}
