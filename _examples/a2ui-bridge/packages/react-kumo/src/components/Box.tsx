/**
 * @a2ui-bridge/react-kumo - Box adapter
 */

import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { renderChildren } from "@a2ui-bridge/react";

export function Box({
  node,
  onAction,
  components,
  surfaceId,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as any;

  return (
    <div>
      {renderChildren(
        properties.children ?? [],
        components,
        onAction,
        surfaceId,
      )}
    </div>
  );
}
