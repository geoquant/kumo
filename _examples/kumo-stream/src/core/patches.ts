/**
 * UITree patch types and application functions.
 *
 * Patches are the canonical wire format for streaming UI updates.
 * Each patch is a complete, independently parseable JSON object.
 *
 * Key invariant: applyTreePatch preserves reference identity for
 * unchanged elements (structural sharing), enabling React.memo.
 */

import type { UITree, UIElement, DataModel } from "./types";
import { EMPTY_TREE, EMPTY_DATA } from "./types";

// =============================================================================
// Patch Type (discriminated union)
// =============================================================================

export type UITreePatch =
  | { readonly type: "upsertElements"; readonly elements: Record<string, UIElement> }
  | { readonly type: "deleteElements"; readonly keys: readonly string[] }
  | { readonly type: "appendChildren"; readonly parentKey: string; readonly childKeys: readonly string[] }
  | { readonly type: "removeChildren"; readonly parentKey: string; readonly childKeys: readonly string[] }
  | { readonly type: "setRoot"; readonly root: string }
  | { readonly type: "setData"; readonly path: string; readonly value: unknown }
  | { readonly type: "replaceData"; readonly data: DataModel }
  | { readonly type: "replaceTree"; readonly tree: UITree }
  | { readonly type: "batch"; readonly patches: readonly UITreePatch[] };

// =============================================================================
// Tree Patch Application
// =============================================================================

/**
 * Apply a single patch to a UITree, returning a new tree.
 *
 * Preserves reference identity for unchanged elements (structural sharing).
 * Pure function: never mutates the input tree.
 *
 * @throws Error on invalid operations (delete root, setRoot to nonexistent key, etc.)
 */
export function applyTreePatch(prev: UITree, patch: UITreePatch): UITree {
  switch (patch.type) {
    case "upsertElements":
      return upsertElements(prev, patch.elements);

    case "deleteElements":
      return deleteElements(prev, patch.keys);

    case "appendChildren":
      return appendChildren(prev, patch.parentKey, patch.childKeys);

    case "removeChildren":
      return removeChildren(prev, patch.parentKey, patch.childKeys);

    case "setRoot":
      return setRoot(prev, patch.root);

    case "setData":
    case "replaceData":
      // Data patches don't affect the tree structure
      return prev;

    case "replaceTree":
      return patch.tree;

    case "batch":
      return applyBatch(prev, patch.patches);
  }
}

/**
 * Apply a single patch to a DataModel, returning a new model.
 *
 * Only data-related patches produce changes; tree patches pass through.
 */
export function applyDataPatch(prev: DataModel, patch: UITreePatch): DataModel {
  switch (patch.type) {
    case "setData":
      return setDataAtPath(prev, patch.path, patch.value);

    case "replaceData":
      return patch.data;

    case "replaceTree":
      // replaceTree doesn't affect data
      return prev;

    case "batch": {
      let current = prev;
      for (const sub of patch.patches) {
        current = applyDataPatch(current, sub);
      }
      return current;
    }

    default:
      return prev;
  }
}

// =============================================================================
// Internal Patch Handlers
// =============================================================================

function upsertElements(
  prev: UITree,
  newElements: Record<string, UIElement>,
): UITree {
  const keys = Object.keys(newElements);
  if (keys.length === 0) return prev;

  // Check if any element actually changed
  let changed = false;
  for (const key of keys) {
    if (prev.elements[key] !== newElements[key]) {
      changed = true;
      break;
    }
  }
  if (!changed) return prev;

  // Structural sharing: spread existing elements, overlay new ones
  const elements = { ...prev.elements };
  for (const key of keys) {
    elements[key] = newElements[key]!;
  }

  return { ...prev, elements };
}

function deleteElements(
  prev: UITree,
  keys: readonly string[],
): UITree {
  if (keys.length === 0) return prev;

  // Validate: cannot delete root
  for (const key of keys) {
    if (key === prev.root) {
      throw new Error(`Cannot delete root element "${key}"`);
    }
  }

  // Collect all descendants to delete (orphan cleanup)
  const toDelete = new Set<string>();
  const collectDescendants = (key: string) => {
    toDelete.add(key);
    const element = prev.elements[key];
    if (element?.children) {
      for (const childKey of element.children) {
        collectDescendants(childKey);
      }
    }
  };
  for (const key of keys) {
    collectDescendants(key);
  }

  // Check if any of the keys actually exist
  let anyExist = false;
  for (const key of toDelete) {
    if (key in prev.elements) {
      anyExist = true;
      break;
    }
  }
  if (!anyExist) return prev;

  // Build new elements map without deleted keys
  const elements: Record<string, UIElement> = {};
  for (const [key, element] of Object.entries(prev.elements)) {
    if (!toDelete.has(key)) {
      // Also clean up children arrays that reference deleted elements
      if (element.children?.some((c) => toDelete.has(c))) {
        elements[key] = {
          ...element,
          children: element.children.filter((c) => !toDelete.has(c)),
        };
      } else {
        elements[key] = element; // Preserve reference
      }
    }
  }

  return { ...prev, elements };
}

function appendChildren(
  prev: UITree,
  parentKey: string,
  childKeys: readonly string[],
): UITree {
  if (childKeys.length === 0) return prev;

  const parent = prev.elements[parentKey];
  if (!parent) {
    throw new Error(`Parent element "${parentKey}" not found`);
  }

  // Validate child keys exist and don't already have a different parent
  for (const childKey of childKeys) {
    const child = prev.elements[childKey];
    if (!child) {
      throw new Error(`Element "${childKey}" not found`);
    }
    if (
      child.parentKey !== undefined &&
      child.parentKey !== null &&
      child.parentKey !== parentKey
    ) {
      throw new Error(
        `Element "${childKey}" already has parent "${child.parentKey}"`,
      );
    }
  }

  const existingChildren = parent.children ?? [];
  const newChildren = [...existingChildren, ...childKeys];

  // Update parent's children array
  const updatedParent: UIElement = { ...parent, children: newChildren };

  // Update children's parentKey
  const elements = { ...prev.elements, [parentKey]: updatedParent };
  for (const childKey of childKeys) {
    const child = elements[childKey]!;
    if (child.parentKey !== parentKey) {
      elements[childKey] = { ...child, parentKey };
    }
  }

  return { ...prev, elements };
}

function removeChildren(
  prev: UITree,
  parentKey: string,
  childKeys: readonly string[],
): UITree {
  if (childKeys.length === 0) return prev;

  const parent = prev.elements[parentKey];
  if (!parent) {
    throw new Error(`Parent element "${parentKey}" not found`);
  }

  const existingChildren = parent.children ?? [];
  const toRemove = new Set(childKeys);
  const newChildren = existingChildren.filter((c) => !toRemove.has(c));

  // If nothing was actually removed, return unchanged
  if (newChildren.length === existingChildren.length) return prev;

  const updatedParent: UIElement = { ...parent, children: newChildren };

  // Removed children retain their element entry but become orphaned
  // (parentKey is NOT cleared -- callers should use deleteElements for full cleanup)
  return { ...prev, elements: { ...prev.elements, [parentKey]: updatedParent } };
}

function setRoot(prev: UITree, root: string): UITree {
  if (root === prev.root) return prev;

  // Allow setting root even if element doesn't exist yet (it may be upserted in a batch)
  // But if elements is non-empty and root doesn't exist, that's an error
  if (Object.keys(prev.elements).length > 0 && !(root in prev.elements)) {
    throw new Error(`Cannot set root to nonexistent element "${root}"`);
  }

  return { ...prev, root };
}

function applyBatch(
  prev: UITree,
  patches: readonly UITreePatch[],
): UITree {
  if (patches.length === 0) return prev;

  // Snapshot isolation: if any patch throws, return original tree
  try {
    let current = prev;
    for (const sub of patches) {
      current = applyTreePatch(current, sub);
    }
    return current;
  } catch (error) {
    // Re-throw so callers know the batch failed, but the tree is unchanged
    throw error;
  }
}

// =============================================================================
// Data Model Helpers
// =============================================================================

function setDataAtPath(
  prev: DataModel,
  path: string,
  value: unknown,
): DataModel {
  const segments = path.startsWith("/")
    ? path.slice(1).split("/")
    : path.split("/");

  if (segments.length === 0 || (segments.length === 1 && segments[0] === "")) {
    // Setting root -- replace entire model if value is an object
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return value as DataModel;
    }
    return prev;
  }

  // Immutable path update
  const result = { ...prev };
  let current: Record<string, unknown> = result;

  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i]!;
    const next = current[segment];
    if (typeof next === "object" && next !== null && !Array.isArray(next)) {
      current[segment] = { ...(next as Record<string, unknown>) };
    } else {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  }

  const lastSegment = segments[segments.length - 1]!;
  current[lastSegment] = value;

  return result;
}

// =============================================================================
// Utility: Create empty tree
// =============================================================================

export { EMPTY_TREE, EMPTY_DATA };
