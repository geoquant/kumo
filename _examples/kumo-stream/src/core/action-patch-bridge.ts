/**
 * Action-to-patch bridge — maps known ActionEvents to UITree patches.
 *
 * Translates recognized user interactions (e.g. counter increment/decrement)
 * into RFC 6902 JSON Patch operations that mutate the UITree. Unknown actions
 * return null, leaving the host to handle them via other mechanisms.
 */

import type { ActionEvent } from "./action-handler";
import type { UITree } from "./types";
import type { JsonPatchOp } from "./rfc6902";

// =============================================================================
// Constants
// =============================================================================

/** Default element key for counter display text (single-counter fallback). */
const DEFAULT_COUNT_DISPLAY_KEY = "count-display";

/** Actions recognized by the bridge. */
const COUNTER_ACTIONS = new Set(["increment", "decrement"]);

// =============================================================================
// Public API
// =============================================================================

/**
 * Map an action event to a JSON Patch operation, if the action is recognized.
 *
 * Supports multi-counter via `event.params.target` to identify which counter
 * display element to update. Falls back to "count-display" for single counters.
 *
 * @returns A replace patch for known patterns, or `null` if the action is
 *          unrecognized or the target element is missing from the tree.
 */
export function actionToPatch(
  event: ActionEvent,
  tree: UITree,
): JsonPatchOp | null {
  if (COUNTER_ACTIONS.has(event.actionName)) {
    return counterPatch(event.actionName, event, tree);
  }

  return null;
}

// =============================================================================
// Internals
// =============================================================================

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
 * Build a replace patch that increments or decrements a counter display
 * element's text content by 1.
 *
 * - Missing target element → null
 * - Non-numeric text → treated as 0
 */
function counterPatch(
  actionName: string,
  event: ActionEvent,
  tree: UITree,
): JsonPatchOp | null {
  const key = resolveCounterKey(event);
  const element = tree.elements[key];
  if (element == null) return null;

  const props = element.props as Record<string, unknown>;
  const currentText =
    typeof props.children === "string"
      ? props.children
      : typeof props.children === "number"
        ? String(props.children)
        : "0";

  const current = Number.parseInt(currentText, 10);
  const value = Number.isNaN(current) ? 0 : current;
  const next = actionName === "increment" ? value + 1 : value - 1;

  return {
    op: "replace",
    path: `/elements/${key}/props/children`,
    value: String(next),
  };
}
