/**
 * @a2ui-bridge/react-kumo - TextArea adapter
 */

import { useState, useId } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { InputArea } from "@cloudflare/kumo";

interface TextAreaProperties {
  label?: { literalString?: string; literal?: string };
  placeholder?: { literalString?: string; literal?: string };
  text?: { literalString?: string; literal?: string };
  value?: { literalString?: string; literal?: string };
  disabled?: boolean;
  rows?: number;
}

export function TextArea({
  node,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as TextAreaProperties;
  const id = useId();

  const label =
    properties.label?.literalString ?? properties.label?.literal ?? "";
  const placeholder =
    properties.placeholder?.literalString ??
    properties.placeholder?.literal ??
    undefined;
  const initialValue =
    properties.text?.literalString ??
    properties.text?.literal ??
    properties.value?.literalString ??
    properties.value?.literal ??
    "";
  const [value, setValue] = useState(initialValue);

  return (
    <InputArea
      id={id}
      label={label || undefined}
      placeholder={placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      disabled={properties.disabled}
    />
  );
}
