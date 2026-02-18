/**
 * @a2ui-bridge/react-kumo - Divider adapter
 * Uses a Kumo-styled separator
 */

import type { DividerNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { cn } from "../utils.js";

export function Divider({
  node,
}: A2UIComponentProps<DividerNode>): JSX.Element {
  const { properties } = node;
  const isVertical = properties.axis === "vertical";

  return (
    <hr
      className={cn(
        "border-kumo-line",
        isVertical ? "h-full w-px border-l" : "w-full border-t",
      )}
    />
  );
}
