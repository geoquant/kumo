/**
 * @a2ui-bridge/react-kumo - Tabs adapter
 * Maps A2UI Tabs nodes to @cloudflare/kumo Tabs
 */

import type { JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { Tabs as KumoTabs } from "@cloudflare/kumo";

export function Tabs({
  node,
  children,
  onAction,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as any;
  const tabs = properties.tabs ?? [];
  const defaultTab = properties.defaultTab ?? tabs[0]?.id ?? "";

  const kumoTabs = tabs.map((tab: any) => ({
    value: tab.id,
    label: tab.label,
  }));

  const handleChange = (value: string) => {
    if (properties.onChange?.name && onAction) {
      onAction({
        actionName: properties.onChange.name,
        sourceComponentId: node.id,
        timestamp: new Date().toISOString(),
        context: { tab: value },
      });
    }
  };

  return (
    <div className="w-full">
      <KumoTabs
        tabs={kumoTabs}
        value={defaultTab}
        onValueChange={handleChange}
      />
      <div className="mt-2">{children}</div>
    </div>
  );
}
