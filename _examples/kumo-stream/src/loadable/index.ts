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
 *   CloudflareKumo.applyPatchBatched(op, containerId)   — apply patch, batch render (rAF)
 *   CloudflareKumo.applyPatchesBatched(ops, containerId) — apply patches, batch render (rAF)
 *   CloudflareKumo.renderTree(tree, containerId)  — wholesale tree replacement
 *   CloudflareKumo.createParser()                 — JSONL streaming parser
 *   CloudflareKumo.setTheme(mode)                 — light/dark toggle
 *   CloudflareKumo.getTree(containerId)            — read current UITree state
 *   CloudflareKumo.getRuntimeValues(containerId)   — read current runtime-captured values
 *   CloudflareKumo.subscribeTree(containerId, cb)  — subscribe to UITree changes
 *   CloudflareKumo.subscribeRuntimeValues(containerId, cb) — subscribe to runtime values
 *   CloudflareKumo.dispatchAction(event, containerId) — dispatch action registry
 *   CloudflareKumo.processActionResult(result, callbacks) — host side effects
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
import { sanitizePatch } from "../core/text-sanitizer";
import { createJsonlParser, type JsonlParser } from "../core/jsonl-parser";
import { UITreeRenderer } from "../core/UITreeRenderer";
import { EMPTY_TREE, type UITree } from "../core/types";
import type { ActionDispatch, ActionEvent } from "../core/action-handler";
import {
  createRuntimeValueStore,
  type RuntimeValueStore,
} from "../core/runtime-value-store";
import { ThemeWrapper } from "./theme";
import { dispatch as dispatchAction, onAction } from "./action-dispatch";
import {
  createHandlerMap as createHandlerMapFromRegistry,
  dispatchAction as dispatchActionFromRegistry,
  type ActionHandlerMap,
  type ActionResult,
} from "../core/action-registry";
import {
  processActionResult as processActionResultFromCore,
  type ActionResultCallbacks,
} from "../core/process-action-result";

// Import kumo standalone styles so they're included in the CSS output
import "@cloudflare/kumo/styles/standalone";

// =============================================================================
// Internal state
// =============================================================================

type MountMode = "light-dom" | "shadow-root";

interface ContainerConfig {
  readonly mountMode: MountMode;
}

type ContainerMount =
  | {
      readonly mountMode: "light-dom";
      readonly hostEl: HTMLElement;
      readonly mountEl: HTMLElement;
    }
  | {
      readonly mountMode: "shadow-root";
      readonly hostEl: HTMLElement;
      readonly shadowRoot: ShadowRoot;
      readonly mountEl: HTMLDivElement;
    };

/** Per-container UITree state. */
const _trees = new Map<string, UITree>();

/** Per-container React root — reused across renders (never destroyed/recreated). */
const _roots = new Map<string, Root>();

/** Per-container mount configuration (must be set before first render). */
const _containerConfigs = new Map<string, ContainerConfig>();

/** Per-container mount targets (light DOM vs ShadowRoot). */
const _mounts = new Map<string, ContainerMount>();

/** Per-container runtime-captured values (uncontrolled inputs, touched tracking). */
const _valueStores = new Map<string, RuntimeValueStore>();

/** Per-container UITree subscribers. */
const _treeSubscribers = new Map<string, Set<(tree: UITree) => void>>();

/** Per-container rAF render scheduling (for optional batching). */
const _renderScheduled = new Map<string, number>();

// =============================================================================
// Internal helpers
// =============================================================================

const SHADOW_STYLESHEET_ATTR = "data-kumo-shadow-stylesheet";
const SHADOW_MOUNT_ATTR = "data-kumo-shadow-mount";

function readMountModeFromAttributes(el: HTMLElement): MountMode {
  const attr = el.getAttribute("data-kumo-mount");
  if (attr === "shadow" || attr === "shadow-root") return "shadow-root";
  return "light-dom";
}

function getDesiredMountMode(
  containerId: string,
  hostEl: HTMLElement,
): MountMode {
  const configured = _containerConfigs.get(containerId);
  if (configured) return configured.mountMode;
  return readMountModeFromAttributes(hostEl);
}

function ensureShadowStylesheet(shadowRoot: ShadowRoot): void {
  const existing = shadowRoot.querySelector(
    `link[${SHADOW_STYLESHEET_ATTR}="true"]`,
  );
  if (existing) return;

  const link = document.createElement("link");
  link.setAttribute("rel", "stylesheet");
  link.setAttribute("href", "/.well-known/stylesheet.css");
  link.setAttribute(SHADOW_STYLESHEET_ATTR, "true");

  const first = shadowRoot.firstChild;
  if (first) {
    shadowRoot.insertBefore(link, first);
    return;
  }

  shadowRoot.append(link);
}

function ensureShadowMount(shadowRoot: ShadowRoot): HTMLDivElement {
  const existing = shadowRoot.querySelector(`div[${SHADOW_MOUNT_ATTR}="true"]`);
  if (existing instanceof HTMLDivElement) return existing;

  const mountEl = document.createElement("div");
  mountEl.setAttribute(SHADOW_MOUNT_ATTR, "true");
  shadowRoot.append(mountEl);
  return mountEl;
}

function getOrCreateMount(
  containerId: string,
  hostEl: HTMLElement,
): ContainerMount {
  const existing = _mounts.get(containerId);
  if (existing) return existing;

  const mountMode = getDesiredMountMode(containerId, hostEl);
  if (mountMode === "shadow-root") {
    const shadowRoot =
      hostEl.shadowRoot ?? hostEl.attachShadow({ mode: "open" });
    ensureShadowStylesheet(shadowRoot);
    const mountEl = ensureShadowMount(shadowRoot);

    const mount: ContainerMount = {
      mountMode: "shadow-root",
      hostEl,
      shadowRoot,
      mountEl,
    };
    _mounts.set(containerId, mount);
    return mount;
  }

  const mount: ContainerMount = {
    mountMode: "light-dom",
    hostEl,
    mountEl: hostEl,
  };
  _mounts.set(containerId, mount);
  return mount;
}

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

  const mount = getOrCreateMount(containerId, el);
  const root = createRoot(mount.mountEl);
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

function notifyTree(containerId: string, tree: UITree): void {
  const subs = _treeSubscribers.get(containerId);
  if (!subs) return;

  for (const cb of subs) {
    try {
      cb(tree);
    } catch (err) {
      console.error("[CloudflareKumo] Tree subscriber threw", err);
    }
  }
}

// =============================================================================
// Public API
// =============================================================================

export interface CloudflareKumoAPI {
  /** Configure a container before first render (e.g. ShadowRoot mount mode). */
  readonly configureContainer: (
    containerId: string,
    config: ContainerConfig,
  ) => void;
  /** Apply a single RFC 6902 patch op and re-render the container. */
  readonly applyPatch: (op: JsonPatchOp, containerId: string) => void;
  /** Apply multiple RFC 6902 patch ops in a single render pass. */
  readonly applyPatches: (
    ops: readonly JsonPatchOp[],
    containerId: string,
  ) => void;
  /** Apply a single patch op and batch rendering via requestAnimationFrame. */
  readonly applyPatchBatched: (op: JsonPatchOp, containerId: string) => void;
  /** Apply multiple patch ops and batch rendering via requestAnimationFrame. */
  readonly applyPatchesBatched: (
    ops: readonly JsonPatchOp[],
    containerId: string,
  ) => void;
  /** Replace the entire tree wholesale (non-streaming use case). */
  readonly renderTree: (tree: UITree, containerId: string) => void;
  /** Create a new JSONL streaming parser instance. */
  readonly createParser: () => JsonlParser;
  /** Set light/dark theme — dispatches CustomEvent and sets data-mode on body. */
  readonly setTheme: (mode: "light" | "dark") => void;
  /** Read the current UITree state for a container. */
  readonly getTree: (containerId: string) => UITree;

  /** Read current runtime-captured values for a container. */
  readonly getRuntimeValues: (
    containerId: string,
  ) => Readonly<Record<string, unknown>>;

  /** Subscribe to runtime-captured value updates. Returns unsubscribe. */
  readonly subscribeRuntimeValues: (
    containerId: string,
    cb: (values: Readonly<Record<string, unknown>>) => void,
  ) => () => void;
  /** Subscribe to per-container UITree updates. Returns an unsubscribe function. */
  readonly subscribeTree: (
    containerId: string,
    cb: (tree: UITree) => void,
  ) => () => void;
  /** Clear tree state and unmount the container. */
  readonly reset: (containerId: string) => void;
  /**
   * Subscribe to action events from component interactions.
   * Returns an unsubscribe function. Actions also fire as
   * `CustomEvent('kumo-action')` on window.
   */
  readonly onAction: (handler: ActionDispatch) => () => void;

  /** Create a merged handler map (built-ins + custom). */
  readonly createHandlerMap: (
    custom?: Readonly<ActionHandlerMap>,
  ) => Readonly<ActionHandlerMap>;

  /** Dispatch an ActionEvent against the current per-container UITree. */
  readonly dispatchAction: (
    event: ActionEvent,
    containerId: string,
    customHandlers?: Readonly<ActionHandlerMap>,
  ) => ActionResult | null;

  /** Process an ActionResult by dispatching host callbacks. */
  readonly processActionResult: (
    result: ActionResult,
    callbacks: ActionResultCallbacks,
  ) => void;
}

const api: CloudflareKumoAPI = {
  configureContainer(containerId: string, config: ContainerConfig): void {
    if (_roots.has(containerId)) {
      console.warn(
        `[CloudflareKumo] configureContainer("${containerId}") called after mount; call reset() first to change mountMode.`,
      );
      return;
    }

    _containerConfigs.set(containerId, config);
  },

  applyPatch(op: JsonPatchOp, containerId: string): void {
    const current = _trees.get(containerId) ?? EMPTY_TREE;
    const next = applyRfc6902Patch(current, sanitizePatch(op));
    _trees.set(containerId, next);
    notifyTree(containerId, next);
    renderContainer(containerId);
  },

  applyPatchBatched(op: JsonPatchOp, containerId: string): void {
    const current = _trees.get(containerId) ?? EMPTY_TREE;
    const next = applyRfc6902Patch(current, sanitizePatch(op));
    _trees.set(containerId, next);
    notifyTree(containerId, next);

    const scheduled = _renderScheduled.get(containerId);
    if (scheduled) return;

    const rafId = requestAnimationFrame(() => {
      _renderScheduled.delete(containerId);
      renderContainer(containerId);
    });

    _renderScheduled.set(containerId, rafId);
  },

  applyPatches(ops: readonly JsonPatchOp[], containerId: string): void {
    if (ops.length === 0) return;
    let current = _trees.get(containerId) ?? EMPTY_TREE;
    for (const op of ops) {
      current = applyRfc6902Patch(current, sanitizePatch(op));
    }
    _trees.set(containerId, current);
    notifyTree(containerId, current);
    renderContainer(containerId);
  },

  applyPatchesBatched(ops: readonly JsonPatchOp[], containerId: string): void {
    if (ops.length === 0) return;
    let current = _trees.get(containerId) ?? EMPTY_TREE;
    for (const op of ops) {
      current = applyRfc6902Patch(current, sanitizePatch(op));
    }
    _trees.set(containerId, current);
    notifyTree(containerId, current);

    const scheduled = _renderScheduled.get(containerId);
    if (scheduled) return;

    const rafId = requestAnimationFrame(() => {
      _renderScheduled.delete(containerId);
      renderContainer(containerId);
    });

    _renderScheduled.set(containerId, rafId);
  },

  renderTree(tree: UITree, containerId: string): void {
    _trees.set(containerId, tree);
    notifyTree(containerId, tree);
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
    // Canonical: kumo-theme-change
    window.dispatchEvent(
      new CustomEvent("kumo-theme-change", { detail: { mode } }),
    );
    // Compat: theme-change (legacy/event-name drift)
    window.dispatchEvent(new CustomEvent("theme-change", { detail: { mode } }));
  },

  getTree(containerId: string): UITree {
    return _trees.get(containerId) ?? EMPTY_TREE;
  },

  getRuntimeValues(containerId: string): Readonly<Record<string, unknown>> {
    return getOrCreateValueStore(containerId).snapshotAll();
  },

  subscribeRuntimeValues(
    containerId: string,
    cb: (values: Readonly<Record<string, unknown>>) => void,
  ): () => void {
    const store = getOrCreateValueStore(containerId);
    const notify = () => {
      cb(store.snapshotAll());
    };
    notify();
    return store.subscribe(notify);
  },

  subscribeTree(containerId: string, cb: (tree: UITree) => void): () => void {
    const existing = _treeSubscribers.get(containerId);
    const subs = existing ?? new Set<(tree: UITree) => void>();
    if (!existing) _treeSubscribers.set(containerId, subs);

    subs.add(cb);
    return () => {
      const current = _treeSubscribers.get(containerId);
      if (!current) return;
      current.delete(cb);
      if (current.size === 0) {
        _treeSubscribers.delete(containerId);
      }
    };
  },

  reset(containerId: string): void {
    _trees.set(containerId, EMPTY_TREE);
    notifyTree(containerId, EMPTY_TREE);

    const store = _valueStores.get(containerId);
    if (store) store.clear();

    const scheduled = _renderScheduled.get(containerId);
    if (scheduled != null) {
      cancelAnimationFrame(scheduled);
      _renderScheduled.delete(containerId);
    }

    const root = _roots.get(containerId);
    if (root) {
      root.unmount();
      _roots.delete(containerId);
    }

    const mount = _mounts.get(containerId);
    if (mount?.mountMode === "shadow-root") {
      mount.mountEl.remove();
      const link = mount.shadowRoot.querySelector(
        `link[${SHADOW_STYLESHEET_ATTR}="true"]`,
      );
      if (link) link.remove();
    }

    _mounts.delete(containerId);
  },

  onAction,

  createHandlerMap(
    custom?: Readonly<ActionHandlerMap>,
  ): Readonly<ActionHandlerMap> {
    return createHandlerMapFromRegistry(custom);
  },

  dispatchAction(
    event: ActionEvent,
    containerId: string,
    customHandlers?: Readonly<ActionHandlerMap>,
  ): ActionResult | null {
    const tree = _trees.get(containerId) ?? EMPTY_TREE;
    const handlers = createHandlerMapFromRegistry(customHandlers);
    return dispatchActionFromRegistry(handlers, event, tree);
  },

  processActionResult(
    result: ActionResult,
    callbacks: ActionResultCallbacks,
  ): void {
    processActionResultFromCore(result, callbacks);
  },
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
