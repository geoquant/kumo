/**
 * @a2ui-bridge/react-kumo - TextField adapter
 * Maps A2UI TextField nodes to @cloudflare/kumo Input
 */

import { useState, useId } from "react";
import type { TextFieldNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { Input, InputArea } from "@cloudflare/kumo";

export function TextField({
  node,
}: A2UIComponentProps<TextFieldNode>): JSX.Element {
  const { properties } = node;
  const props = properties as Record<string, any>;
  const id = useId();

  const label =
    properties.label.literalString ?? properties.label.literal ?? "";
  const initialValue =
    properties.text?.literalString ?? properties.text?.literal ?? "";
  const placeholder =
    props.placeholder?.literalString ?? props.placeholder?.literal ?? undefined;
  const [value, setValue] = useState(initialValue);

  if (properties.type === "longText") {
    return (
      <InputArea
        id={id}
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    );
  }

  return (
    <Input
      id={id}
      label={label}
      placeholder={placeholder}
      type={
        properties.type === "number"
          ? "number"
          : properties.type === "date"
            ? "date"
            : "text"
      }
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}
