/**
 * @a2ui-bridge/react-kumo - Container adapter
 */

import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { renderChildren } from "@a2ui-bridge/react";

export function Container({
  node,
  onAction,
  components,
  surfaceId,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as any;

  return (
    <div className="mx-auto max-w-4xl w-full">
      {renderChildren(
        properties.children ?? [],
        components,
        onAction,
        surfaceId,
      )}
    </div>
  );
}
