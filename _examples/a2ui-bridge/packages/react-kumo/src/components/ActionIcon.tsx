/**
 * @a2ui-bridge/react-kumo - ActionIcon adapter
 * Maps to a square/icon-only Kumo Button
 */

import type { JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { Button as KumoButton } from "@cloudflare/kumo";

export function ActionIcon({
  node,
  onAction,
  children,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as any;

  const handleClick = () => {
    if (properties.action?.name) {
      onAction({
        actionName: properties.action.name,
        sourceComponentId: node.id,
        timestamp: new Date().toISOString(),
        context: {},
      });
    }
  };

  return (
    <KumoButton
      variant="ghost"
      shape="square"
      aria-label={properties.label?.literalString ?? "Action"}
      onClick={handleClick}
    >
      {children ?? "•"}
    </KumoButton>
  );
}
