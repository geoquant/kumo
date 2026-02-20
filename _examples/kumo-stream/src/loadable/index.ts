/**
 * UMD loadable entry point — exposes window.CloudflareKumo.
 *
 * Provides a zero-React host API for rendering kumo components from
 * RFC 6902 JSON Patch streams. React is bundled inside the UMD output;
 * the host page only needs a <script> tag and a container <div>.
 *
 * API:
 *   CloudflareKumo.applyPatch(op, containerId)   — apply one patch, re-render
 *   CloudflareKumo.applyPatches(ops, containerId) — batch patches, one render
 *   CloudflareKumo.renderTree(tree, containerId)  — wholesale tree replacement
 *   CloudflareKumo.createParser()                 — JSONL streaming parser
 *   CloudflareKumo.setTheme(mode)                 — light/dark toggle
 *   CloudflareKumo.reset(containerId)             — clear state + unmount
 *   CloudflareKumo.onAction(handler)              — subscribe to action events
 */

import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";

import {
  applyPatch as applyRfc6902Patch,
  type JsonPatchOp,
} from "../core/rfc6902";
import { createJsonlParser, type JsonlParser } from "../core/jsonl-parser";
import { UITreeRenderer } from "../core/UITreeRenderer";
import { EMPTY_TREE, type UITree } from "../core/types";
import type { ActionDispatch } from "../core/action-handler";
import {
  createRuntimeValueStore,
  type RuntimeValueStore,
} from "../core/runtime-value-store";
import { ThemeWrapper } from "./theme";
import { dispatch as dispatchAction, onAction } from "./action-dispatch";

// Import kumo standalone styles so they're included in the CSS output
import "@cloudflare/kumo/styles/standalone";

// =============================================================================
// Internal state
// =============================================================================

/** Per-container UITree state. */
const _trees = new Map<string, UITree>();

/** Per-container React root — reused across renders (never destroyed/recreated). */
const _roots = new Map<string, Root>();

/** Per-container runtime-captured values (uncontrolled inputs, touched tracking). */
const _valueStores = new Map<string, RuntimeValueStore>();

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Get or create a React root for a container element.
 * Returns null if the container element doesn't exist in the DOM.
 */
function getOrCreateRoot(containerId: string): Root | null {
  const existing = _roots.get(containerId);
  if (existing) return existing;

  const el = document.getElementById(containerId);
  if (!el) {
    console.error(
      `[CloudflareKumo] Container element "${containerId}" not found in DOM.`,
    );
    return null;
  }

  const root = createRoot(el);
  _roots.set(containerId, root);
  return root;
}

function getOrCreateValueStore(containerId: string): RuntimeValueStore {
  const existing = _valueStores.get(containerId);
  if (existing) return existing;

  const store = createRuntimeValueStore();
  _valueStores.set(containerId, store);
  return store;
}

/**
 * Render the current tree state for a container.
 * Uses flushSync for synchronous DOM updates during progressive rendering.
 */
function renderContainer(containerId: string): void {
  const root = getOrCreateRoot(containerId);
  if (!root) return;

  const tree = _trees.get(containerId) ?? EMPTY_TREE;
  const runtimeValueStore = getOrCreateValueStore(containerId);

  flushSync(() => {
    root.render(
      React.createElement(
        ThemeWrapper,
        null,
        React.createElement(UITreeRenderer, {
          tree,
          streaming: true,
          onAction: dispatchAction,
          runtimeValueStore,
        }),
      ),
    );
  });
}

// =============================================================================
// Public API
// =============================================================================

export interface CloudflareKumoAPI {
  /** Apply a single RFC 6902 patch op and re-render the container. */
  readonly applyPatch: (op: JsonPatchOp, containerId: string) => void;
  /** Apply multiple RFC 6902 patch ops in a single render pass. */
  readonly applyPatches: (
    ops: readonly JsonPatchOp[],
    containerId: string,
  ) => void;
  /** Replace the entire tree wholesale (non-streaming use case). */
  readonly renderTree: (tree: UITree, containerId: string) => void;
  /** Create a new JSONL streaming parser instance. */
  readonly createParser: () => JsonlParser;
  /** Set light/dark theme — dispatches CustomEvent and sets data-mode on body. */
  readonly setTheme: (mode: "light" | "dark") => void;
  /** Clear tree state and unmount the container. */
  readonly reset: (containerId: string) => void;
  /**
   * Subscribe to action events from component interactions.
   * Returns an unsubscribe function. Actions also fire as
   * `CustomEvent('kumo-action')` on window.
   */
  readonly onAction: (handler: ActionDispatch) => () => void;
}

const api: CloudflareKumoAPI = {
  applyPatch(op: JsonPatchOp, containerId: string): void {
    const current = _trees.get(containerId) ?? EMPTY_TREE;
    const next = applyRfc6902Patch(current, op);
    _trees.set(containerId, next);
    renderContainer(containerId);
  },

  applyPatches(ops: readonly JsonPatchOp[], containerId: string): void {
    if (ops.length === 0) return;
    let current = _trees.get(containerId) ?? EMPTY_TREE;
    for (const op of ops) {
      current = applyRfc6902Patch(current, op);
    }
    _trees.set(containerId, current);
    renderContainer(containerId);
  },

  renderTree(tree: UITree, containerId: string): void {
    _trees.set(containerId, tree);
    // Non-streaming render — pass streaming=false for error rendering on missing keys
    const root = getOrCreateRoot(containerId);
    if (!root) return;

    const runtimeValueStore = getOrCreateValueStore(containerId);

    flushSync(() => {
      root.render(
        React.createElement(
          ThemeWrapper,
          null,
          React.createElement(UITreeRenderer, {
            tree,
            streaming: false,
            onAction: dispatchAction,
            runtimeValueStore,
          }),
        ),
      );
    });
  },

  createParser(): JsonlParser {
    return createJsonlParser();
  },

  setTheme(mode: "light" | "dark"): void {
    // 1. Set data-mode on body for portalled elements (Select dropdowns, etc.)
    document.body.setAttribute("data-mode", mode);

    // 2. Dispatch CustomEvent for ThemeWrapper listeners
    const event = new CustomEvent("kumo-theme-change", { detail: { mode } });
    window.dispatchEvent(event);
  },

  reset(containerId: string): void {
    _trees.delete(containerId);
    _valueStores.delete(containerId);

    const root = _roots.get(containerId);
    if (root) {
      root.unmount();
      _roots.delete(containerId);
    }
  },

  onAction,
};

// =============================================================================
// Window assignment
// =============================================================================

declare global {
  interface Window {
    CloudflareKumo: CloudflareKumoAPI;
  }
}

window.CloudflareKumo = api;

// Also export for UMD — Vite's lib mode uses the default export as the UMD value
export default api;
