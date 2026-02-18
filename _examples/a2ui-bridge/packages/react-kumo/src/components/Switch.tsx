/**
 * @a2ui-bridge/react-kumo - Switch adapter
 * Maps A2UI Switch nodes to @cloudflare/kumo Switch
 */

import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { Switch as KumoSwitch } from "@cloudflare/kumo";

interface SwitchProperties {
  label?: { literalString?: string; literal?: string };
  checked?: boolean;
  disabled?: boolean;
  action?: { name: string };
}

export function Switch({
  node,
  onAction,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as SwitchProperties;
  const label =
    properties.label?.literalString ?? properties.label?.literal ?? "";
  const checked = properties.checked ?? false;
  const disabled = properties.disabled ?? false;

  const handleChange = (newChecked: boolean) => {
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
    <KumoSwitch
      label={label || undefined}
      checked={checked}
      disabled={disabled}
      onCheckedChange={handleChange}
    />
  );
}
