/**
 * @a2ui-bridge/react-kumo - Button adapter
 * Maps A2UI Button nodes to @cloudflare/kumo Button
 */

import type { ButtonNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { renderChild } from "@a2ui-bridge/react";
import { Button as KumoButton } from "@cloudflare/kumo";
import { extractLiteral } from "../utils.js";

interface ExtendedButtonProps {
  variant?: { literalString?: string };
  fullWidth?: { literalBoolean?: boolean };
  compact?: { literalBoolean?: boolean };
}

const variantMap: Record<
  string,
  "primary" | "secondary" | "ghost" | "destructive" | "outline"
> = {
  filled: "primary",
  primary: "primary",
  default: "secondary",
  secondary: "secondary",
  outline: "outline",
  subtle: "ghost",
  ghost: "ghost",
  destructive: "destructive",
  danger: "destructive",
};

/**
 * Extracts plain text from a child A2UI Text node. When the button's child is
 * a simple Text node, we render the string directly instead of going through
 * the Text adapter — because the Kumo Text component wraps content in a <p>
 * with `text-kumo-default`, which overrides the button's own text color
 * (e.g. `!text-white` on the primary variant).
 */
function extractButtonLabel(child: unknown): string | null {
  if (!child || typeof child !== "object") return null;
  const c = child as Record<string, unknown>;
  if (c.type === "Text" && c.properties) {
    const props = c.properties as Record<string, unknown>;
    if (props.text) return extractLiteral(props.text);
  }
  return null;
}

export function Button({
  node,
  onAction,
  components,
  surfaceId,
}: A2UIComponentProps<ButtonNode>): JSX.Element {
  const { properties } = node;
  const extendedProps = properties as typeof properties & ExtendedButtonProps;
  const variant = extendedProps.variant?.literalString ?? "default";
  const compact = extendedProps.compact?.literalBoolean ?? false;
  const fullWidth = extendedProps.fullWidth?.literalBoolean ?? false;

  const handleClick = () => {
    if (properties.action) {
      onAction({
        actionName: properties.action.name,
        sourceComponentId: node.id,
        timestamp: new Date().toISOString(),
        context: properties.action.context?.reduce(
          (acc, item) => {
            acc[item.key] =
              item.value.literalString ??
              item.value.literalNumber ??
              item.value.literalBoolean;
            return acc;
          },
          {} as Record<string, unknown>,
        ),
      });
    }
  };

  // Extract plain text label when the child is a Text node to avoid rendering
  // the Kumo Text component (which applies text-kumo-default and overrides the
  // button's own text color like !text-white on primary variant).
  const plainLabel = extractButtonLabel(properties.child);

  return (
    <KumoButton
      variant={variantMap[variant] ?? "secondary"}
      size={compact ? "sm" : "base"}
      onClick={handleClick}
      style={fullWidth ? { width: "100%" } : undefined}
    >
      {plainLabel ??
        renderChild(properties.child, components, onAction, surfaceId)}
    </KumoButton>
  );
}
