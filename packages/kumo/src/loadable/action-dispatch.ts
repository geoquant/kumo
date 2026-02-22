/**
 * Action event dispatch for the cross-boundary (UMD) API.
 *
 * Provides a pub/sub mechanism for ActionEvents: host pages subscribe via
 * `onAction(handler)` and receive events when users interact with components
 * that have `action` fields. Every event also fires as a
 * `CustomEvent('kumo-action')` on `window` for non-JS framework consumers.
 *
 * SSR-safe: CustomEvent dispatch is guarded by `typeof window !== 'undefined'`.
 */

import type { ActionEvent, ActionDispatch } from "../streaming/action-types";

// =============================================================================
// Subscriber registry
// =============================================================================

const _subscribers = new Set<ActionDispatch>();

// =============================================================================
// Dispatch
// =============================================================================

/**
 * Dispatch an ActionEvent to all registered subscribers and fire a
 * CustomEvent on window. This function is passed as the `onAction`
 * callback to `UITreeRenderer`.
 */
export function dispatch(event: ActionEvent): void {
  // Fan out to all subscribers
  for (const handler of _subscribers) {
    try {
      handler(event);
    } catch (err) {
      console.error("[CloudflareKumo] onAction handler threw:", err);
    }
  }

  // Fire CustomEvent for non-framework consumers
  if (typeof window !== "undefined") {
    const customEvent = new CustomEvent("kumo-action", {
      detail: {
        actionName: event.actionName,
        sourceKey: event.sourceKey,
        ...(event.params != null ? { params: event.params } : undefined),
        ...(event.context != null ? { context: event.context } : undefined),
      },
    });
    window.dispatchEvent(customEvent);
  }
}

// =============================================================================
// Subscription
// =============================================================================

/**
 * Register a callback to receive ActionEvents from component interactions.
 * Returns an unsubscribe function.
 *
 * @example
 * ```js
 * const unsub = CloudflareKumo.onAction((event) => {
 *   console.log('Action:', event.actionName, event.sourceKey);
 * });
 * // Later:
 * unsub();
 * ```
 */
export function onAction(handler: ActionDispatch): () => void {
  _subscribers.add(handler);
  return () => {
    _subscribers.delete(handler);
  };
}

// =============================================================================
// Testing utility
// =============================================================================

/** Clear all subscribers. Exported for test cleanup only. */
export function _clearSubscribers(): void {
  _subscribers.clear();
}
