/**
 * @a2ui-bridge/react-kumo - Badge adapter
 * Maps A2UI Badge nodes to @cloudflare/kumo Badge
 *
 * Handles both protocol-style `variant` prop and snippet-style `color` prop.
 * Values can be raw strings or wrapped in `{ literalString }`.
 */

import type { BadgeNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { Badge as KumoBadge } from "@cloudflare/kumo";

/** Maps semantic variant names to Kumo badge variants */
const variantMap: Record<
  string,
  "primary" | "secondary" | "destructive" | "outline" | "beta"
> = {
  // A2UI protocol variants
  primary: "primary",
  success: "primary",
  warning: "beta",
  danger: "destructive",
  error: "destructive",
  neutral: "secondary",
  default: "secondary",
  info: "primary",
  outline: "outline",
  secondary: "secondary",
  // Mantine variants
  filled: "primary",
  light: "secondary",
  transparent: "outline",
  dot: "secondary",
  gradient: "primary",
  white: "secondary",
  // shadcn variants
  ghost: "outline",
};

/** Maps color names (from snippets/Mantine) to Kumo badge variants */
const colorToVariantMap: Record<
  string,
  "primary" | "secondary" | "destructive" | "outline" | "beta"
> = {
  blue: "primary",
  green: "primary",
  red: "destructive",
  yellow: "beta",
  orange: "beta",
  gray: "secondary",
  grey: "secondary",
  cyan: "primary",
  teal: "primary",
  violet: "primary",
  purple: "primary",
  pink: "destructive",
  indigo: "primary",
};

/** Unwrap a value that may be a raw string or `{ literalString }` object */
function unwrap(val: unknown): string | undefined {
  if (typeof val === "string") return val;
  if (val && typeof val === "object" && "literalString" in val) {
    return (val as { literalString?: string }).literalString ?? undefined;
  }
  return undefined;
}

export function Badge({ node }: A2UIComponentProps<BadgeNode>): JSX.Element {
  const { properties } = node;
  const props = properties as unknown as Record<string, unknown>;
  const text = properties.text.literalString ?? properties.text.literal ?? "";

  // Try protocol variant first, then snippet color as fallback
  const variant = unwrap(props.variant) ?? unwrap(props.color);

  let kumoVariant:
    | "primary"
    | "secondary"
    | "destructive"
    | "outline"
    | "beta" = "secondary";
  if (variant) {
    kumoVariant =
      variantMap[variant] ?? colorToVariantMap[variant] ?? "secondary";
  }

  return <KumoBadge variant={kumoVariant}>{text}</KumoBadge>;
}
