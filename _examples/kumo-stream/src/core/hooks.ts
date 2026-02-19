/**
 * React hook for managing UITree state via RFC 6902 JSON Patch operations.
 *
 * Provides immutable tree updates with batched patch application.
 * No DataModel — data model concerns are dropped per PRD non-goals.
 */

import { useCallback, useState } from "react";
import { applyPatch as applyRfc6902Patch, type JsonPatchOp } from "./rfc6902";
import { EMPTY_TREE, type UITree } from "./types";

// =============================================================================
// Types
// =============================================================================

export interface UseUITreeReturn {
  /** Current UITree state. */
  readonly tree: UITree;
  /** Apply a single RFC 6902 patch and trigger re-render. */
  readonly applyPatch: (patch: JsonPatchOp) => void;
  /** Apply multiple RFC 6902 patches in a single setState call. */
  readonly applyPatches: (patches: readonly JsonPatchOp[]) => void;
  /** Reset tree to empty state `{ root: '', elements: {} }`. */
  readonly reset: () => void;
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
 *
 * All updaters use functional setState so they are safe to call from
 * streaming callbacks without stale-closure issues.
 */
export function useUITree(): UseUITreeReturn {
  const [tree, setTree] = useState<UITree>(EMPTY_TREE);

  const applyPatch = useCallback((patch: JsonPatchOp): void => {
    setTree((prev: UITree) => applyRfc6902Patch(prev, patch));
  }, []);

  const applyPatches = useCallback((patches: readonly JsonPatchOp[]): void => {
    if (patches.length === 0) return;
    setTree((prev: UITree) => {
      let current = prev;
      for (const patch of patches) {
        current = applyRfc6902Patch(current, patch);
      }
      return current;
    });
  }, []);

  const reset = useCallback((): void => {
    setTree(EMPTY_TREE);
  }, []);

  return { tree, applyPatch, applyPatches, reset };
}
