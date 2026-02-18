/**
 * @a2ui-bridge/react-kumo - MultiSelect adapter
 * Falls back to multiple checkboxes since Kumo Select supports multiple
 */

import { useState, type JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { Checkbox as KumoCheckbox } from "@cloudflare/kumo";

interface MultiSelectProperties {
  label?: { literalString?: string; literal?: string };
  options?: Array<string | { label: string; value?: string }>;
  value?: string[];
  disabled?: boolean;
  action?: { name: string };
}

export function MultiSelect({
  node,
  onAction,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as MultiSelectProperties;
  const label =
    properties.label?.literalString ?? properties.label?.literal ?? "";
  const disabled = properties.disabled ?? false;
  const rawOptions = properties.options ?? [];
  const initialValues = properties.value ?? [];

  const options = rawOptions.map((opt) => {
    if (typeof opt === "string") return { label: opt, value: opt };
    return { label: opt.label, value: opt.value ?? opt.label };
  });

  const [selectedValues, setSelectedValues] = useState<string[]>(initialValues);

  const handleToggle = (value: string, checked: boolean) => {
    const newValues = checked
      ? [...selectedValues, value]
      : selectedValues.filter((v) => v !== value);
    setSelectedValues(newValues);
    if (properties.action?.name) {
      onAction({
        actionName: properties.action.name,
        sourceComponentId: node.id,
        timestamp: new Date().toISOString(),
        context: { values: newValues },
      });
    }
  };

  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      {label && (
        <legend className="text-sm font-medium text-kumo-default mb-1">
          {label}
        </legend>
      )}
      {options.map((option) => (
        <KumoCheckbox
          key={option.value}
          label={option.label}
          checked={selectedValues.includes(option.value)}
          onCheckedChange={(checked) => handleToggle(option.value, checked)}
          disabled={disabled}
        />
      ))}
    </fieldset>
  );
}
