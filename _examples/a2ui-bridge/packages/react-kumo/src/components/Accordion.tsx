/**
 * @a2ui-bridge/react-kumo - Accordion adapter
 */

import type { JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";

export function Accordion({
  children,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  return (
    <div className="divide-y divide-kumo-line border border-kumo-line rounded-lg">
      {children}
    </div>
  );
}

export function AccordionItem({
  node,
  children,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as any;
  const title =
    properties.title?.literalString ?? properties.title?.literal ?? "";

  return (
    <details className="group">
      <summary className="flex items-center justify-between cursor-pointer px-4 py-3 text-sm font-medium text-kumo-default hover:bg-kumo-recessed">
        {title}
        <svg
          className="h-4 w-4 transition-transform group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </summary>
      <div className="px-4 py-3 text-sm text-kumo-default">{children}</div>
    </details>
  );
}
