/**
 * @a2ui-bridge/react-kumo - Label adapter
 * Maps A2UI Label nodes to @cloudflare/kumo Label
 */

import type { JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { Label as KumoLabel } from "@cloudflare/kumo";

export function Label({
  node,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as any;
  const text =
    properties.text?.literalString ??
    properties.text?.literal ??
    properties.label?.literalString ??
    properties.label?.literal ??
    "";

  return <KumoLabel>{text}</KumoLabel>;
}
