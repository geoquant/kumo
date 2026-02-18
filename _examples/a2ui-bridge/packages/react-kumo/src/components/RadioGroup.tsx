/**
 * @a2ui-bridge/react-kumo - RadioGroup adapter
 * Maps A2UI RadioGroup nodes to Kumo-styled radio inputs
 */

import { useState, type JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { cn } from "../utils.js";

interface RadioGroupProperties {
  label?: { literalString?: string; literal?: string };
  value?: { literalString?: string; literal?: string };
  options?: Array<string | { label: string; value?: string }>;
  disabled?: boolean;
  action?: { name: string };
}

export function RadioGroup({
  node,
  onAction,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as RadioGroupProperties;
  const label =
    properties.label?.literalString ?? properties.label?.literal ?? "";
  const initialValue =
    properties.value?.literalString ?? properties.value?.literal ?? "";
  const disabled = properties.disabled ?? false;
  const rawOptions = properties.options ?? [];

  const options = rawOptions.map((opt) => {
    if (typeof opt === "string") return { label: opt, value: opt };
    return { label: opt.label, value: opt.value ?? opt.label };
  });

  const [selectedValue, setSelectedValue] = useState(initialValue);

  const handleChange = (value: string) => {
    setSelectedValue(value);
    if (properties.action?.name) {
      onAction({
        actionName: properties.action.name,
        sourceComponentId: node.id,
        timestamp: new Date().toISOString(),
        context: { value },
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
        <label
          key={option.value}
          className={cn(
            "flex items-center gap-2 cursor-pointer",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          <input
            type="radio"
            name={node.id}
            value={option.value}
            checked={selectedValue === option.value}
            onChange={() => handleChange(option.value)}
            disabled={disabled}
            className="h-4 w-4 accent-[var(--kumo-brand)]"
          />
          <span className="text-sm text-kumo-default">{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
