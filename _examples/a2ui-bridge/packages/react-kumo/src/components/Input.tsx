/**
 * @a2ui-bridge/react-kumo - Input adapter
 * Maps A2UI Input nodes to @cloudflare/kumo Input
 */

import { useState, useId, type JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { Input as KumoInput } from "@cloudflare/kumo";

interface InputProperties {
  label?: { literalString?: string; literal?: string };
  placeholder?: { literalString?: string; literal?: string };
  value?: { literalString?: string; literal?: string };
  type?: string;
  disabled?: boolean;
}

export function Input({
  node,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as InputProperties;
  const id = useId();
  const label =
    properties.label?.literalString ?? properties.label?.literal ?? "";
  const placeholder =
    properties.placeholder?.literalString ??
    properties.placeholder?.literal ??
    "";
  const initialValue =
    properties.value?.literalString ?? properties.value?.literal ?? "";
  const [value, setValue] = useState(initialValue);

  return (
    <KumoInput
      id={id}
      label={label || undefined}
      placeholder={placeholder || undefined}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      disabled={properties.disabled}
    />
  );
}
