/**
 * @a2ui-bridge/react-kumo - Tooltip adapter
 * Maps A2UI Tooltip nodes to @cloudflare/kumo Tooltip
 */

import type { JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { Tooltip as KumoTooltip } from "@cloudflare/kumo";

export function Tooltip({
  node,
  children,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as any;
  const content =
    properties.text?.literalString ??
    properties.text?.literal ??
    properties.content?.literalString ??
    properties.content?.literal ??
    "";

  return (
    <KumoTooltip content={content}>
      <span>{children}</span>
    </KumoTooltip>
  );
}
