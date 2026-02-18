/**
 * @a2ui-bridge/react-kumo - Collapsible adapter
 */

import type { JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";

export function Collapsible({
  node,
  children,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as any;
  const title =
    properties.title?.literalString ?? properties.title?.literal ?? "Details";

  return (
    <details className="rounded-lg border border-kumo-line">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-kumo-default hover:bg-kumo-recessed">
        {title}
      </summary>
      <div className="px-4 py-3 border-t border-kumo-line">{children}</div>
    </details>
  );
}
