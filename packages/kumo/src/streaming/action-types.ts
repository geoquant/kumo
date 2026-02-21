/**
 * Action event types for LLM-generated UIs.
 *
 * Type-only definitions used by hooks and the renderer. The full action
 * system (factories, registry, built-in handlers) lives in action-handler.ts
 * and action-registry.ts.
 */

/**
 * Event dispatched when a user interacts with a component that has an
 * `action` field. Carries enough context for the host to identify
 * what happened, which element triggered it, and any parameters.
 */
export interface ActionEvent {
  /** Name of the action (from Action.name) */
  readonly actionName: string;
  /** Key of the UIElement that triggered the action */
  readonly sourceKey: string;
  /** Static params declared on the action definition */
  readonly params?: Record<string, unknown>;
  /** Runtime context from the stateful wrapper (e.g. { value, checked }) */
  readonly context?: Record<string, unknown>;
}

/** Callback signature for the host's action dispatch handler. */
export type ActionDispatch = (event: ActionEvent) => void;
