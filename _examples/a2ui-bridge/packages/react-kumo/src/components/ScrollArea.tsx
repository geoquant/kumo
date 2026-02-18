/**
 * @a2ui-bridge/react-kumo - ScrollArea adapter
 */

import type { JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";

export function ScrollArea({
  children,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  return <div className="overflow-auto max-h-[400px]">{children}</div>;
}
