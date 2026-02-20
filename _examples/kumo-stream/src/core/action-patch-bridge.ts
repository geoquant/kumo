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

/** Well-known element key for counter display text. */
const COUNT_DISPLAY_KEY = "count-display";

/** Actions recognized by the bridge. */
const COUNTER_ACTIONS = new Set(["increment", "decrement"]);

// =============================================================================
// Public API
// =============================================================================

/**
 * Map an action event to a JSON Patch operation, if the action is recognized.
 *
 * @returns A replace patch for known patterns, or `null` if the action is
 *          unrecognized or the target element is missing from the tree.
 */
export function actionToPatch(
  event: ActionEvent,
  tree: UITree,
): JsonPatchOp | null {
  if (COUNTER_ACTIONS.has(event.actionName)) {
    return counterPatch(event.actionName, tree);
  }

  return null;
}

// =============================================================================
// Internals
// =============================================================================

/**
 * Build a replace patch that increments or decrements the count-display
 * element's text content by 1.
 *
 * - Missing count-display element → null
 * - Non-numeric text → treated as 0
 */
function counterPatch(actionName: string, tree: UITree): JsonPatchOp | null {
  const element = tree.elements[COUNT_DISPLAY_KEY];
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
    path: `/elements/${COUNT_DISPLAY_KEY}/props/children`,
    value: String(next),
  };
}
