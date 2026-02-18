/**
 * @a2ui-bridge/react-kumo - Dialog adapter
 * Maps A2UI Dialog/Modal nodes to a Kumo-styled dialog
 */

import { useState, useEffect, type JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";

export function Dialog({
  node,
  children,
  onAction,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as any;
  const title =
    properties.title?.literalString ?? properties.title?.literal ?? "";
  const description =
    properties.description?.literalString ??
    properties.description?.literal ??
    "";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60" onClick={handleClose} />
      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        className="fixed z-50 w-full max-w-lg p-6 bg-kumo-elevated rounded-lg border border-kumo-line shadow-lg"
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 text-kumo-default"
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
          <span className="sr-only">Close</span>
        </button>
        {title && (
          <h2 className="text-lg font-semibold text-kumo-default">{title}</h2>
        )}
        {description && (
          <p className="mt-2 text-sm text-kumo-subtle">{description}</p>
        )}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
