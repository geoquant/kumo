/**
 * @a2ui-bridge/react-kumo - Alert adapter
 * Maps A2UI Alert nodes to @cloudflare/kumo Banner
 *
 * Handles both protocol-style `description` and snippet-style `message` props.
 * Values can be raw strings or wrapped in `{ literalString }`.
 */

import type { JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { Banner } from "@cloudflare/kumo";

const variantMap: Record<string, "default" | "alert" | "error"> = {
  default: "default",
  info: "default",
  success: "default",
  warning: "alert",
  error: "error",
  destructive: "error",
  danger: "error",
};

/** Unwrap a value that may be a raw string or `{ literalString }` object */
function unwrap(val: unknown): string | undefined {
  if (typeof val === "string") return val;
  if (val && typeof val === "object") {
    const obj = val as Record<string, unknown>;
    if ("literalString" in obj)
      return (obj.literalString as string) ?? undefined;
    if ("literal" in obj) return (obj.literal as string) ?? undefined;
  }
  return undefined;
}

export function Alert({
  node,
  children,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as any;
  const title =
    properties.title?.literalString ?? properties.title?.literal ?? "";

  // Handle both protocol `description` and snippet `message`
  const description =
    properties.description?.literalString ??
    properties.description?.literal ??
    properties.message?.literalString ??
    properties.message?.literal ??
    "";

  // Unwrap variant from raw string or { literalString } object
  const variant = unwrap(properties.variant) ?? "default";

  return (
    <Banner variant={variantMap[variant] ?? "default"}>
      {title && <strong>{title}</strong>}
      {title && description && " "}
      {description}
      {children}
    </Banner>
  );
}
