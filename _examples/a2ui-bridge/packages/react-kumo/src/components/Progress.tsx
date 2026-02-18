/**
 * @a2ui-bridge/react-kumo - Progress adapter
 * Maps A2UI Progress nodes to @cloudflare/kumo Meter
 */

import type { JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { Meter } from "@cloudflare/kumo";

export function Progress({
  node,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as any;
  const value = properties.value ?? 0;
  const max = properties.max ?? 100;
  const label =
    properties.label?.literalString ?? properties.label?.literal ?? "Progress";
  const showValue = properties.showValue ?? true;

  return <Meter value={value} max={max} label={label} showValue={showValue} />;
}
