/**
 * @a2ui-bridge/react-kumo - Grid adapter
 * Maps A2UI Grid nodes to @cloudflare/kumo Grid
 */

import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { renderChildren } from "@a2ui-bridge/react";
import { Grid as KumoGrid } from "@cloudflare/kumo";

export function Grid({
  node,
  onAction,
  components,
  surfaceId,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as any;
  const columns = properties.columns ?? 2;

  // Map column count to kumo Grid variant
  const variantMap: Record<number, "2up" | "3up" | "4up" | "6up"> = {
    2: "2up",
    3: "3up",
    4: "4up",
    6: "6up",
  };

  return (
    <KumoGrid variant={variantMap[columns] ?? "2up"}>
      {renderChildren(
        properties.children ?? [],
        components,
        onAction,
        surfaceId,
      )}
    </KumoGrid>
  );
}
