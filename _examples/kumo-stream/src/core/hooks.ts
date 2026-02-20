/**
 * React hook for managing UITree state via RFC 6902 JSON Patch operations.
 *
 * Provides immutable tree updates with batched patch application.
 * No DataModel — data model concerns are dropped per PRD non-goals.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { applyPatch as applyRfc6902Patch, type JsonPatchOp } from "./rfc6902";
import { EMPTY_TREE, type UITree } from "./types";
import type { ActionDispatch } from "./action-handler";
import { sanitizePatch } from "./text-sanitizer";
import {
  createRuntimeValueStore,
  type RuntimeValueStore,
} from "./runtime-value-store";

// =============================================================================
// Types
// =============================================================================

export interface UseUITreeOptions {
  /**
   * Callback invoked when a component with an `action` field triggers its
   * onAction handler. Receives a well-formed ActionEvent with actionName,
   * sourceKey, params, and context.
   *
   * Pass this through to UITreeRenderer's `onAction` prop.
   */
  readonly onAction?: ActionDispatch;

  /**
   * When true, patch application is throttled to one render per animation frame.
   * This keeps fast token streams responsive.
   */
  readonly batchPatches?: boolean;
}

export interface UseUITreeReturn {
  /** Current UITree state. */
  readonly tree: UITree;
  /** Apply a single RFC 6902 patch and trigger re-render. */
  readonly applyPatch: (patch: JsonPatchOp) => void;
  /** Apply multiple RFC 6902 patches in a single setState call. */
  readonly applyPatches: (patches: readonly JsonPatchOp[]) => void;
  /** Reset tree to empty state `{ root: '', elements: {} }`. */
  readonly reset: () => void;
  /**
   * Action dispatch callback (pass-through from options).
   * Thread this to `UITreeRenderer`'s `onAction` prop.
   * Undefined when no `onAction` was provided to the hook.
   */
  readonly onAction: ActionDispatch | undefined;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Manage a UITree via RFC 6902 JSON Patch operations.
 *
 * - `applyPatch` applies one patch per setState call
 * - `applyPatches` folds N patches into one setState call (batched)
 * - `reset` returns to the empty tree
 * - `onAction` is passed through from options for wiring to UITreeRenderer
 *
 * All updaters use functional setState so they are safe to call from
 * streaming callbacks without stale-closure issues.
 */
export function useUITree(options?: UseUITreeOptions): UseUITreeReturn {
  const [tree, setTree] = useState<UITree>(EMPTY_TREE);

  const batchPatches = options?.batchPatches ?? false;

  const pendingRef = useMemo(() => {
    return { patches: [] as JsonPatchOp[] };
  }, []);
  const scheduledRef = useMemo(() => {
    return { rafId: null as number | null };
  }, []);

  useEffect(() => {
    return () => {
      if (scheduledRef.rafId != null) {
        cancelAnimationFrame(scheduledRef.rafId);
        scheduledRef.rafId = null;
      }
      pendingRef.patches = [];
    };
  }, [pendingRef, scheduledRef]);

  const flushPending = useCallback((): void => {
    const patches = pendingRef.patches;
    pendingRef.patches = [];

    if (patches.length === 0) return;

    setTree((prev: UITree) => {
      let current = prev;
      for (const patch of patches) {
        current = applyRfc6902Patch(current, patch);
      }
      return current;
    });
  }, [pendingRef]);

  const scheduleFlush = useCallback((): void => {
    if (scheduledRef.rafId != null) return;
    scheduledRef.rafId = requestAnimationFrame(() => {
      scheduledRef.rafId = null;
      flushPending();
    });
  }, [flushPending, scheduledRef]);

  const applyPatch = useCallback(
    (patch: JsonPatchOp): void => {
      const sanitized = sanitizePatch(patch);
      if (!batchPatches) {
        setTree((prev: UITree) => applyRfc6902Patch(prev, sanitized));
        return;
      }

      pendingRef.patches.push(sanitized);
      scheduleFlush();
    },
    [batchPatches, pendingRef, scheduleFlush],
  );

  const applyPatches = useCallback(
    (patches: readonly JsonPatchOp[]): void => {
      if (patches.length === 0) return;

      const sanitized = patches.map(sanitizePatch);

      if (!batchPatches) {
        setTree((prev: UITree) => {
          let current = prev;
          for (const patch of sanitized) {
            current = applyRfc6902Patch(current, patch);
          }
          return current;
        });
        return;
      }

      pendingRef.patches.push(...sanitized);
      scheduleFlush();
    },
    [batchPatches, pendingRef, scheduleFlush],
  );

  const reset = useCallback((): void => {
    if (scheduledRef.rafId != null) {
      cancelAnimationFrame(scheduledRef.rafId);
      scheduledRef.rafId = null;
    }
    pendingRef.patches = [];
    setTree(EMPTY_TREE);
  }, [pendingRef, scheduledRef]);

  return { tree, applyPatch, applyPatches, reset, onAction: options?.onAction };
}

/** Create a per-container runtime value store; cleared on unmount. */
export function useRuntimeValueStore(): RuntimeValueStore {
  const store = useMemo(() => createRuntimeValueStore(), []);

  useEffect(() => {
    return () => {
      store.clear();
    };
  }, [store]);

  return store;
}
