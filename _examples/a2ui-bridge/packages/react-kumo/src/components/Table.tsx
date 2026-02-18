/**
 * @a2ui-bridge/react-kumo - Table adapter
 * Uses Kumo semantic tokens for styling
 */

import type { JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";

export function Table({
  node,
  children,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as any;
  const caption =
    properties.caption?.literalString ?? properties.caption?.literal ?? "";

  return (
    <div className="relative w-full overflow-auto">
      <table className="w-full caption-bottom text-sm text-kumo-default">
        {caption && (
          <caption className="mt-4 text-sm text-kumo-subtle">{caption}</caption>
        )}
        {children}
      </table>
    </div>
  );
}

export function TableHeader({
  children,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  return <thead className="border-b border-kumo-line">{children}</thead>;
}

export function TableBody({
  children,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  return <tbody>{children}</tbody>;
}

export function TableRow({
  children,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  return (
    <tr className="border-b border-kumo-line transition-colors hover:bg-kumo-recessed">
      {children}
    </tr>
  );
}

export function TableCell({
  node,
  children,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as any;
  const text = properties.text?.literalString ?? properties.text?.literal ?? "";
  const isHeader = properties.isHeader ?? false;

  if (isHeader) {
    return (
      <th className="h-10 px-4 text-left align-middle font-medium text-kumo-subtle">
        {text || children}
      </th>
    );
  }

  return (
    <td className="p-4 align-middle text-kumo-default">{text || children}</td>
  );
}
