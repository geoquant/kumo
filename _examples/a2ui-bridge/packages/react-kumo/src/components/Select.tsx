/**
 * @a2ui-bridge/react-kumo - Select adapter
 * Maps A2UI Select nodes to @cloudflare/kumo Select
 */

import { useState } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { Select as KumoSelect } from "@cloudflare/kumo";

interface SelectProperties {
  label?: { literalString?: string; literal?: string };
  placeholder?: { literalString?: string; literal?: string };
  value?: { literalString?: string; literal?: string };
  disabled?: boolean;
  options?: Array<string | { label: string; value?: string }>;
  action?: { name: string };
}

export function Select({
  node,
  onAction,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as SelectProperties;
  const label =
    properties.label?.literalString ?? properties.label?.literal ?? "";
  const currentValue =
    properties.value?.literalString ?? properties.value?.literal ?? "";
  const disabled = properties.disabled ?? false;
  const rawOptions = properties.options ?? [];

  const options = rawOptions.map((opt) => {
    if (typeof opt === "string") return { label: opt, value: opt };
    return { label: opt.label, value: opt.value ?? opt.label };
  });

  const [selectedValue, setSelectedValue] = useState(currentValue);

  const handleChange = (value: unknown) => {
    setSelectedValue(String(value));
    if (properties.action?.name) {
      onAction({
        actionName: properties.action.name,
        sourceComponentId: node.id,
        timestamp: new Date().toISOString(),
        context: { value },
      });
    }
  };

  const placeholder =
    properties.placeholder?.literalString ??
    properties.placeholder?.literal ??
    "";

  return (
    <KumoSelect
      label={label || undefined}
      hideLabel={!label}
      placeholder={placeholder || undefined}
      disabled={disabled}
      value={selectedValue || undefined}
      onValueChange={handleChange}
    >
      {options.map((option) => (
        <KumoSelect.Option key={option.value} value={option.value}>
          {option.label}
        </KumoSelect.Option>
      ))}
    </KumoSelect>
  );
}
