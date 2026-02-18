/**
 * @a2ui-bridge/react-kumo - Sheet/Drawer adapter
 */

import { useState, useEffect, type JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";

export function Sheet({
  node,
  children,
  onAction,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as any;
  const title =
    properties.title?.literalString ?? properties.title?.literal ?? "";
  const open = properties.open ?? false;
  const [isOpen, setIsOpen] = useState(open);

  useEffect(() => {
    setIsOpen(open);
  }, [open]);

  const handleClose = () => {
    setIsOpen(false);
    if (properties.onClose?.name && onAction) {
      onAction({
        actionName: properties.onClose.name,
        sourceComponentId: node.id,
        timestamp: new Date().toISOString(),
        context: {},
      });
    }
  };

  if (!isOpen) return <></>;

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/60" onClick={handleClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-kumo-elevated border-l border-kumo-line p-6 shadow-lg">
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 text-kumo-subtle hover:text-kumo-default"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        {title && (
          <h2 className="text-lg font-semibold text-kumo-default mb-4">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}
