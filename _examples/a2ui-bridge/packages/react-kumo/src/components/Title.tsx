/**
 * @a2ui-bridge/react-kumo - Title/Heading adapter
 */

import type { JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { Text as KumoText } from "@cloudflare/kumo";

export function Title({
  node,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as any;
  const text = properties.text?.literalString ?? properties.text?.literal ?? "";
  const level = properties.level ?? properties.order ?? 2;

  const variantMap: Record<number, "heading1" | "heading2" | "heading3"> = {
    1: "heading1",
    2: "heading2",
    3: "heading3",
    4: "heading3",
    5: "heading3",
    6: "heading3",
  };

  return <KumoText variant={variantMap[level] ?? "heading2"}>{text}</KumoText>;
}
