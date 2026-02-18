/**
 * @a2ui-bridge/react-kumo - Checkbox adapter
 * Maps A2UI Checkbox nodes to @cloudflare/kumo Checkbox
 */

import { useState } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { Checkbox as KumoCheckbox } from "@cloudflare/kumo";

interface CheckboxProperties {
  label?: { literalString?: string; literal?: string };
  /** A2UI protocol sends `value` (BooleanValue), not `checked` */
  value?: { literalBoolean?: boolean; path?: string };
  /** Some adapters may also pass `checked` directly */
  checked?: boolean;
  disabled?: boolean;
  action?: { name: string };
}

function extractChecked(properties: CheckboxProperties): boolean {
  if (properties.value != null) {
    if (typeof properties.value === "boolean") return properties.value;
    if (
      typeof properties.value === "object" &&
      "literalBoolean" in properties.value
    ) {
      return properties.value.literalBoolean ?? false;
    }
  }
  if (typeof properties.checked === "boolean") return properties.checked;
  return false;
}

export function Checkbox({
  node,
  onAction,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as CheckboxProperties;
  const label =
    properties.label?.literalString ?? properties.label?.literal ?? "";
  const initialChecked = extractChecked(properties);
  const disabled = properties.disabled ?? false;

  const [checked, setChecked] = useState(initialChecked);

  const handleChange = (newChecked: boolean) => {
    setChecked(newChecked);
    if (properties.action?.name) {
      onAction({
        actionName: properties.action.name,
        sourceComponentId: node.id,
        timestamp: new Date().toISOString(),
        context: { checked: newChecked },
      });
    }
  };

  return (
    <KumoCheckbox
      label={label || undefined}
      checked={checked}
      disabled={disabled}
      onCheckedChange={handleChange}
    />
  );
}
