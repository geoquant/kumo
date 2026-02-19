/**
 * Re-export catalog types from @cloudflare/kumo and define renderer-specific types.
 */

import type {
  UITree,
  UIElement,
  DataModel,
  AuthState,
  Action,
  ActionHandlers,
  VisibilityCondition,
} from "@cloudflare/kumo/catalog";

export type {
  UITree,
  UIElement,
  DataModel,
  AuthState,
  Action,
  ActionHandlers,
  VisibilityCondition,
};

/** Empty UITree constant for initial state */
export const EMPTY_TREE: UITree = {
  root: "",
  elements: {},
};

/** Empty DataModel constant for initial state */
export const EMPTY_DATA: DataModel = {};
