/**
 * @a2ui-bridge/react-kumo - Toast adapter
 */

import type { JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";

export function Toast({
  node,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as any;
  const title =
    properties.title?.literalString ?? properties.title?.literal ?? "";
  const description =
    properties.description?.literalString ??
    properties.description?.literal ??
    "";

  return (
    <div className="rounded-lg border border-kumo-line bg-kumo-elevated p-4 shadow-md">
      {title && (
        <p className="text-sm font-medium text-kumo-default">{title}</p>
      )}
      {description && (
        <p className="mt-1 text-sm text-kumo-subtle">{description}</p>
      )}
    </div>
  );
}
