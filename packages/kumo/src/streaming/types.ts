/**
 * Re-export catalog types used by the streaming engine.
 *
 * Consumers of `@cloudflare/kumo/streaming` get these types without
 * needing a separate import from `@cloudflare/kumo/catalog`.
 */

import type {
  UITree,
  UIElement,
  DataModel,
  AuthState,
  Action,
  ActionHandlers,
  VisibilityCondition,
} from "../catalog/types";

export type {
  UITree,
  UIElement,
  DataModel,
  AuthState,
  Action,
  ActionHandlers,
  VisibilityCondition,
};

/** Empty UITree constant for initial state. */
export const EMPTY_TREE: UITree = {
  root: "",
  elements: {},
};

/** Empty DataModel constant for initial state. */
export const EMPTY_DATA: DataModel = {};
