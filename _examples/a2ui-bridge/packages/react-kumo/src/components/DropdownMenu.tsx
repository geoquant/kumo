/**
 * @a2ui-bridge/react-kumo - DropdownMenu adapter
 */

import type { JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";

export function DropdownMenu({
  children,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  return <div className="relative inline-block">{children}</div>;
}
