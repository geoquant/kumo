/**
 * @a2ui-bridge/react-kumo - AspectRatio adapter
 */

import type { JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";

export function AspectRatio({
  node,
  children,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as any;
  const ratio = properties.ratio ?? 16 / 9;

  return (
    <div style={{ aspectRatio: ratio }} className="relative overflow-hidden">
      {children}
    </div>
  );
}
