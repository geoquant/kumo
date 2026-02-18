/**
 * @a2ui-bridge/react-kumo - Blockquote adapter
 */

import type { JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";

export function Blockquote({
  node,
  children,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as any;
  const text = properties.text?.literalString ?? properties.text?.literal ?? "";

  return (
    <blockquote className="border-l-4 border-kumo-line pl-4 italic text-kumo-subtle">
      {text || children}
    </blockquote>
  );
}
