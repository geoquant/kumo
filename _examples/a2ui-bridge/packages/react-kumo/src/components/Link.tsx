/**
 * @a2ui-bridge/react-kumo - Link adapter
 */

import type { JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";

export function Link({
  node,
  children,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as any;
  const href =
    properties.href?.literalString ??
    properties.href?.literal ??
    properties.url?.literalString ??
    properties.url?.literal ??
    "#";
  const text = properties.text?.literalString ?? properties.text?.literal ?? "";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-kumo-brand underline underline-offset-4 hover:text-kumo-brand-hover transition-colors"
    >
      {text || children}
    </a>
  );
}
