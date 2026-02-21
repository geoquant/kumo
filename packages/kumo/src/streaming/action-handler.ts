/**
 * Action event dispatching for LLM-generated UIs.
 *
 * UIElements can declare an `action` field (from the catalog's Action type).
 * When a stateful wrapper fires its onAction callback, the renderer creates
 * an ActionEvent and dispatches it to the host application.
 *
 * Flow:
 *   UIElement.action -> createActionHandler(action, sourceKey, dispatch)
 *     -> wrapper fires onAction(context) -> dispatch(ActionEvent)
 */

import type { Action } from "./types";
import type { ActionEvent, ActionDispatch } from "./action-types";

// Re-export from action-types so consumers can import from either module
export type { ActionEvent, ActionDispatch } from "./action-types";

// =============================================================================
// Factory
// =============================================================================

/**
 * Creates a handler function that stateful wrappers call via their
 * `onAction` prop. The returned function closes over the action definition,
 * element key, and dispatch callback — producing a well-formed ActionEvent
 * on every invocation.
 *
 * @param action   - The Action definition from UIElement.action
 * @param sourceKey - The key of the element that owns this action
 * @param dispatch - Host callback that receives the ActionEvent
 * @returns A function matching the OnActionCallback signature:
 *          `(context?: Record<string, unknown>) => void`
 */
export function createActionHandler(
  action: Action,
  sourceKey: string,
  dispatch: ActionDispatch,
): (context?: Record<string, unknown>) => void {
  return (context?: Record<string, unknown>): void => {
    const event: ActionEvent = {
      actionName: action.name,
      sourceKey,
      ...(action.params != null ? { params: action.params } : undefined),
      ...(context != null ? { context } : undefined),
    };

    dispatch(event);
  };
}

/**
 * Creates an onClick handler for components that don't support onAction
 * (e.g. Button, Link). Dispatches the same ActionEvent as createActionHandler
 * but accepts any arguments (compatible with React's onClick signature)
 * and optionally chains an existing onClick.
 *
 * @param action     - The Action definition from UIElement.action
 * @param sourceKey  - The key of the element that owns this action
 * @param dispatch   - Host callback that receives the ActionEvent
 * @param existingOnClick - Optional existing onClick handler from LLM props
 * @returns An onClick handler that dispatches the action event
 */
export function createClickHandler(
  action: Action,
  sourceKey: string,
  dispatch: ActionDispatch,
  existingOnClick?: unknown,
): (...args: unknown[]) => void {
  return (...args: unknown[]): void => {
    // Chain existing onClick if it's a function (preserve LLM-specified handlers)
    if (typeof existingOnClick === "function") {
      (existingOnClick as (...a: unknown[]) => void)(...args);
    }

    const actionEvent: ActionEvent = {
      actionName: action.name,
      sourceKey,
      ...(action.params != null ? { params: action.params } : undefined),
    };

    dispatch(actionEvent);
  };
}
