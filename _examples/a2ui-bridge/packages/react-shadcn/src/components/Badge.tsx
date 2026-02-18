/**
 * @a2ui-bridge/react-shadcn - Badge component
 * Uses the actual shadcn Badge component with variant mapping.
 */

import type { BadgeNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { Badge as ShadcnBadge, type BadgeVariant } from "../ui/badge.js";

/** Maps A2UI / Mantine / generic variant names to shadcn badge variants */
const variantMap: Record<string, BadgeVariant> = {
  // A2UI protocol variants
  primary: "default",
  success: "default",
  warning: "secondary",
  danger: "destructive",
  neutral: "secondary",
  // shadcn-native variant names (pass through)
  default: "default",
  secondary: "secondary",
  destructive: "destructive",
  outline: "outline",
  ghost: "ghost",
  link: "link",
  // Common aliases the AI may generate
  error: "destructive",
  info: "default",
  // Mantine variant names
  filled: "default",
  light: "secondary",
  transparent: "ghost",
  dot: "secondary",
  gradient: "default",
  white: "outline",
};

export function Badge({ node }: A2UIComponentProps<BadgeNode>): JSX.Element {
  const { properties } = node;
  const text = properties.text.literalString ?? properties.text.literal ?? "";
  const variant = properties.variant ?? "neutral";
  const mappedVariant = variantMap[variant] ?? "secondary";

  return <ShadcnBadge variant={mappedVariant}>{text}</ShadcnBadge>;
}
