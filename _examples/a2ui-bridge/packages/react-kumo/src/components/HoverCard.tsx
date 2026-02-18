/**
 * @a2ui-bridge/react-kumo - HoverCard adapter
 */

import type { JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";

export function HoverCard({
  children,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  return <div className="inline-block">{children}</div>;
}
