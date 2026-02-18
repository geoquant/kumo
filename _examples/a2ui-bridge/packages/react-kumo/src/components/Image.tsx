/**
 * @a2ui-bridge/react-kumo - Image adapter
 */

import type { JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { cn } from "../utils.js";

const sizeClasses: Record<string, string> = {
  icon: "w-6 h-6",
  avatar: "w-10 h-10 rounded-full",
  smallFeature: "w-16 h-16",
  mediumFeature: "w-32 h-32",
  largeFeature: "w-full max-w-md",
  header: "w-full",
};

export function Image({
  node,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as any;
  const src =
    properties.url?.literalString ??
    properties.url?.literal ??
    properties.src?.literalString ??
    properties.src?.literal ??
    "";
  const alt =
    properties.alt?.literalString ??
    properties.alt?.literal ??
    properties.description?.literalString ??
    properties.description?.literal ??
    "";
  // Unwrap usageHint from raw string or { literalString } object
  const usageHintRaw = properties.usageHint;
  const usageHint =
    typeof usageHintRaw === "string"
      ? usageHintRaw
      : ((usageHintRaw as { literalString?: string })?.literalString ??
        "mediumFeature");

  return (
    <img
      src={src}
      alt={alt}
      className={cn(
        "object-cover",
        sizeClasses[usageHint] ?? sizeClasses.mediumFeature,
      )}
    />
  );
}
