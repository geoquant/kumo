/**
 * @a2ui-bridge/react-kumo - List adapter
 */

import type { ListNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { renderChildren } from "@a2ui-bridge/react";
import { cn } from "../utils.js";

const directionClasses: Record<string, string> = {
  vertical: "flex-col",
  horizontal: "flex-row flex-wrap",
};

const alignmentClasses: Record<string, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
};

export function List({
  node,
  onAction,
  components,
  surfaceId,
}: A2UIComponentProps<ListNode>): JSX.Element {
  const { properties } = node;
  const direction = properties.direction ?? "vertical";
  const alignment = properties.alignment ?? "stretch";

  return (
    <div
      className={cn(
        "flex gap-2",
        directionClasses[direction],
        alignmentClasses[alignment],
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
