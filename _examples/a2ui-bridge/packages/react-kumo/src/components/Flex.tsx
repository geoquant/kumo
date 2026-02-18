/**
 * @a2ui-bridge/react-kumo - Flex adapter
 */

import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { renderChildren } from "@a2ui-bridge/react";
import { cn } from "../utils.js";

export function Flex({
  node,
  onAction,
  components,
  surfaceId,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as any;
  const direction = properties.direction ?? "row";
  const gap = properties.gap ?? 3;

  return (
    <div
      className={cn(
        "flex",
        direction === "column" ? "flex-col" : "flex-row",
        `gap-${gap}`,
      )}
    >
      {renderChildren(
        properties.children ?? [],
        components,
        onAction,
        surfaceId,
      )}
    </div>
  );
}
