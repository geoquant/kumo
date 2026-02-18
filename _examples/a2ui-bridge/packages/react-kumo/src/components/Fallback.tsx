/**
 * @a2ui-bridge/react-kumo - Fallback component for unknown types
 */

import type { JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";

export function Fallback({
  node,
  children,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const componentType = node.type ?? "Unknown";

  return (
    <div className="border-2 border-dashed border-yellow-500/50 rounded p-3 bg-yellow-50/10">
      <div className="text-xs text-yellow-600 mb-2 font-mono">
        Unknown component:{" "}
        <code className="bg-yellow-100 px-1 rounded">{componentType}</code>
      </div>
      {children && <div className="mt-2">{children}</div>}
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-kumo-subtle hover:text-kumo-default">
          Component data
        </summary>
        <pre className="mt-2 p-2 bg-kumo-recessed rounded text-xs overflow-auto max-h-40">
          {JSON.stringify(node, null, 2)}
        </pre>
      </details>
    </div>
  );
}
