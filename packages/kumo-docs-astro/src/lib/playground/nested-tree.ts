import type { UITree } from "@cloudflare/kumo/streaming";

import type { NestedTreeNode } from "~/lib/playground/types";

function buildNestedNode(
  tree: UITree,
  key: string,
  seen: ReadonlySet<string>,
): NestedTreeNode | null {
  if (seen.has(key)) {
    return null;
  }

  const element = tree.elements[key];
  if (element === undefined) {
    return null;
  }

  const nextSeen = new Set(seen);
  nextSeen.add(key);

  const children: NestedTreeNode[] = [];
  for (const childKey of element.children ?? []) {
    const childNode = buildNestedNode(tree, childKey, nextSeen);
    if (childNode !== null) {
      children.push(childNode);
    }
  }

  return {
    key: element.key,
    type: element.type,
    props: element.props,
    action: element.action ?? null,
    children,
  };
}

export function buildNestedTree(tree: UITree): NestedTreeNode | null {
  if (!tree.root) {
    return null;
  }

  return buildNestedNode(tree, tree.root, new Set<string>());
}
