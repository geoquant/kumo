/**
 * @a2ui-bridge/react-kumo - DateTimeInput adapter
 */

import { useState, useId, type JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { Input as KumoInput } from "@cloudflare/kumo";

export function DateTimeInput({
  node,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as any;
  const id = useId();
  const label =
    properties.label?.literalString ?? properties.label?.literal ?? "";
  const [value, setValue] = useState("");

  return (
    <KumoInput
      id={id}
      label={label || undefined}
      type="date"
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}
