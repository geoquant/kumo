/**
 * @a2ui-bridge/react-kumo - Card adapter
 * Maps A2UI Card nodes to a Kumo-styled card using Surface
 */

import type { CardNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { renderChild, renderChildren } from "@a2ui-bridge/react";

export function Card({
  node,
  onAction,
  components,
  surfaceId,
}: A2UIComponentProps<CardNode>): JSX.Element {
  const { properties } = node;

  return (
    <div className="rounded-lg border border-kumo-line bg-kumo-elevated p-4 shadow-sm">
      {properties.child
        ? renderChild(properties.child, components, onAction, surfaceId)
        : renderChildren(
            properties.children ?? [],
            components,
            onAction,
            surfaceId,
          )}
    </div>
  );
}
