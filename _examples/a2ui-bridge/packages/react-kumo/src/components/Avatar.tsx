/**
 * @a2ui-bridge/react-kumo - Avatar adapter
 */

import type { JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { cn } from "../utils.js";

const sizeClasses: Record<string, string> = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-base",
};

export function Avatar({
  node,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as any;
  const src = properties.src?.literalString ?? properties.src?.literal ?? "";
  const alt = properties.alt?.literalString ?? properties.alt?.literal ?? "";
  const name = properties.name?.literalString ?? properties.name?.literal ?? "";
  const size = properties.size ?? "md";

  const initials = name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={alt || name}
        className={cn(
          "rounded-full object-cover",
          sizeClasses[size] ?? sizeClasses.md,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full bg-kumo-recessed text-kumo-subtle flex items-center justify-center font-medium",
        sizeClasses[size] ?? sizeClasses.md,
      )}
    >
      {initials || "?"}
    </div>
  );
}
