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
  /** Optional structured payload (e.g. submit_form submission body). */
  readonly payload?: SubmitFormPayload;
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
// submit_form payload
// =============================================================================

export interface SubmitFormPayload {
  readonly actionName: "submit_form";
  readonly sourceKey: string;
  /** Static metadata declared by the LLM (scoping keys removed). */
  readonly params: Readonly<Record<string, unknown>>;
  /** Runtime-captured field values (touched-only, field-like, scope-filtered). */
  readonly fields: Readonly<Record<string, unknown>>;
  /** Optional scoping used to select included fields. */
  readonly scope?: {
    readonly formKey?: string;
    readonly fieldKeys?: readonly string[];
  };
}

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

/** Default element key for counter display text (single-counter fallback). */
const DEFAULT_COUNT_DISPLAY_KEY = "count-display";

const SUBMIT_FORM_FIELD_TYPES = new Set([
  "Input",
  "Textarea",
  "InputArea",
  "Select",
  "Checkbox",
  "Switch",
  "Radio",
]);

const SUBMIT_FORM_RUNTIME_VALUES_KEY = "runtimeValues";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sortedRecord(
  input: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(input).sort()) {
    out[key] = input[key];
  }
  return out;
}

function parseStringArray(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || item.length === 0) continue;
    out.push(item);
  }
  const unique = [...new Set(out)].sort();
  return unique.length > 0 ? unique : null;
}

function parseSubmitFormScope(params?: Readonly<Record<string, unknown>>): {
  readonly formKey?: string;
  readonly fieldKeys?: readonly string[];
} {
  const formKeyRaw = params?.formKey;
  const formKey =
    typeof formKeyRaw === "string" && formKeyRaw.length > 0
      ? formKeyRaw
      : undefined;

  const fieldKeys = parseStringArray(params?.fieldKeys) ?? undefined;

  return {
    ...(formKey != null ? { formKey } : undefined),
    ...(fieldKeys != null ? { fieldKeys } : undefined),
  };
}

function stripSubmitFormScopeKeys(
  params?: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  if (params == null) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (key === "formKey" || key === "fieldKeys") continue;
    if (value === undefined) continue;
    out[key] = value;
  }
  return sortedRecord(out);
}

function countSubmitFormActions(tree: UITree): number {
  let count = 0;
  for (const el of Object.values(tree.elements)) {
    if (el?.action?.name === "submit_form") count += 1;
  }
  return count;
}

function collectDescendantKeys(tree: UITree, rootKey: string): Set<string> {
  const root = tree.elements[rootKey];
  if (root == null) return new Set();

  const visited = new Set<string>();
  const stack: string[] = [rootKey];

  while (stack.length > 0) {
    const key = stack.pop();
    if (key == null) continue;
    if (visited.has(key)) continue;
    visited.add(key);

    const el = tree.elements[key];
    if (el?.children == null) continue;
    for (const childKey of el.children) {
      if (typeof childKey === "string" && childKey.length > 0) {
        stack.push(childKey);
      }
    }
  }

  return visited;
}

function readRuntimeValuesFromEventContext(
  context?: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  if (context == null) return {};
  const v = context[SUBMIT_FORM_RUNTIME_VALUES_KEY];
  if (isRecord(v)) return v;
  // Back-compat: some callers may pass the field map directly as context.
  return context;
}

/**
 * Resolve the target counter display key from an action event.
 *
 * Supports two patterns:
 *   1. `action.params.target` — explicit target key (multi-counter)
 *   2. Fallback to "count-display" (single-counter, backward compatible)
 */
function resolveCounterKey(event: ActionEvent): string {
  const target = event.params?.target;
  return typeof target === "string" && target.length > 0
    ? target
    : DEFAULT_COUNT_DISPLAY_KEY;
}

/**
 * Read the current numeric value from a counter display element.
 * Returns 0 for non-numeric text, or null for missing elements.
 */
function readCounterValue(tree: UITree, key: string): number | null {
  const element = tree.elements[key];
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

/** Build a patch result that sets the counter display to a new value. */
function counterPatchResult(key: string, nextValue: number): PatchResult {
  return {
    type: "patch",
    patches: [
      {
        op: "replace",
        path: `/elements/${key}/props/children`,
        value: String(nextValue),
      },
    ],
  };
}

/** Increment the counter display by 1. */
function handleIncrement(
  event: ActionEvent,
  tree: UITree,
): ActionResult | null {
  const key = resolveCounterKey(event);
  const current = readCounterValue(tree, key);
  if (current == null) return null;

  return counterPatchResult(key, current + 1);
}

/** Decrement the counter display by 1. */
function handleDecrement(
  event: ActionEvent,
  tree: UITree,
): ActionResult | null {
  const key = resolveCounterKey(event);
  const current = readCounterValue(tree, key);
  if (current == null) return null;

  return counterPatchResult(key, current - 1);
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
  tree: UITree,
): ActionResult | null {
  const scope = parseSubmitFormScope(event.params);
  const hasExplicitScope = scope.formKey != null || scope.fieldKeys != null;

  if (!hasExplicitScope && countSubmitFormActions(tree) > 1) {
    console.warn(
      "[kumo-stream] submit_form ambiguous: multiple submit_form actions in container; add params.formKey or params.fieldKeys",
    );
    return { type: "none" };
  }

  const params = stripSubmitFormScopeKeys(event.params);
  const runtimeValues = readRuntimeValuesFromEventContext(event.context);

  const scopeSet =
    scope.fieldKeys != null
      ? new Set(scope.fieldKeys)
      : scope.formKey != null
        ? collectDescendantKeys(tree, scope.formKey)
        : null;

  const fieldsOut: Record<string, unknown> = {};
  for (const [elementKey, value] of Object.entries(runtimeValues)) {
    if (value === undefined) continue;
    if (scopeSet != null && !scopeSet.has(elementKey)) continue;
    const el = tree.elements[elementKey];
    if (el == null) continue;
    if (!SUBMIT_FORM_FIELD_TYPES.has(el.type)) continue;
    fieldsOut[elementKey] = value;
  }

  const fields = sortedRecord(fieldsOut);

  if (Object.keys(params).length === 0 && Object.keys(fields).length === 0) {
    return { type: "none" };
  }

  const payload: SubmitFormPayload = {
    actionName: "submit_form",
    sourceKey: event.sourceKey,
    params,
    fields,
    ...(hasExplicitScope ? { scope } : undefined),
  };

  return {
    type: "message",
    content: JSON.stringify(payload),
    payload,
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
