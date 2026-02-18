/**
 * @a2ui-bridge/react-kumo - Breadcrumb adapter
 */

import type { JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";

export function Breadcrumb({
  node,
  children,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as any;
  const items = properties.items ?? [];

  if (items.length > 0) {
    return (
      <nav aria-label="breadcrumb">
        <ol className="flex items-center gap-2 text-sm text-kumo-subtle">
          {items.map((item: any, index: number) => (
            <li key={index} className="flex items-center gap-2">
              {index > 0 && <span className="text-kumo-subtle">/</span>}
              {item.href ? (
                <a href={item.href} className="text-kumo-brand hover:underline">
                  {item.label ?? item.text}
                </a>
              ) : (
                <span className="text-kumo-default font-medium">
                  {item.label ?? item.text}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    );
  }

  return (
    <nav aria-label="breadcrumb" className="text-sm text-kumo-subtle">
      {children}
    </nav>
  );
}
