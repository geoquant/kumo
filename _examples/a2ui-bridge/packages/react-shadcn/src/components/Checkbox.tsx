import { useState, type JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { useTheme } from "../theme/context.js";
import { cn, classesToString } from "../utils.js";

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
  const theme = useTheme();
  const properties = node.properties as CheckboxProperties;
  const label =
    properties.label?.literalString ?? properties.label?.literal ?? "";
  const initialChecked = extractChecked(properties);
  const disabled = properties.disabled ?? false;

  const [checked, setChecked] = useState(initialChecked);

  const handleChange = () => {
    const newChecked = !checked;
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
    <label
      className={cn(
        "flex items-center gap-2 cursor-pointer",
        disabled && "opacity-50 cursor-not-allowed",
        classesToString(
          (theme.components as Record<string, any>).Checkbox?.all ?? {},
        ),
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={handleChange}
        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
      />
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
}
