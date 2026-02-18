/**
 * @a2ui-bridge/react-kumo - Column adapter
 * Maps A2UI Column nodes to vertical flex layout with Kumo tokens
 *
 * Handles both protocol-style props (`distribution`, `alignment`) and
 * snippet-style aliases (`justify`, `align`, `gap`).
 * Values can be raw strings or wrapped in `{ literalString }`.
 */

import type { ColumnNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { renderChildren } from "@a2ui-bridge/react";
import { cn } from "../utils.js";

const distributionClasses: Record<string, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  spaceBetween: "justify-between",
  spaceAround: "justify-around",
  spaceEvenly: "justify-evenly",
};

const alignmentClasses: Record<string, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
};

const gapClasses: Record<string, string> = {
  xs: "gap-1",
  sm: "gap-2",
  md: "gap-3",
  lg: "gap-4",
  xl: "gap-6",
};

/** Unwrap a value that may be a raw string or `{ literalString }` object */
function unwrap(val: unknown): string | undefined {
  if (typeof val === "string") return val;
  if (val && typeof val === "object" && "literalString" in val) {
    return (val as { literalString?: string }).literalString ?? undefined;
  }
  return undefined;
}

export function Column({
  node,
  onAction,
  components,
  surfaceId,
}: A2UIComponentProps<ColumnNode>): JSX.Element {
  const { properties } = node;
  const props = properties as unknown as Record<string, unknown>;

  // Protocol: distribution/alignment; Snippet alias: justify/align
  const distribution =
    properties.distribution ?? unwrap(props.justify) ?? "start";
  const alignment = properties.alignment ?? unwrap(props.align) ?? "stretch";
  const gap = unwrap(props.gap) ?? "md";

  return (
    <div
      className={cn(
        "flex flex-col",
        gapClasses[gap] ?? "gap-3",
        distributionClasses[distribution],
        alignmentClasses[alignment],
      )}
    >
      {renderChildren(
        properties.children ?? [],
        components,
        onAction,
        surfaceId,
      )}
    </div>
  );
}
