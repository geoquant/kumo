/**
 * @a2ui-bridge/react-shadcn - Button component
 * Uses the actual shadcn Button component with variant mapping.
 */

import type { ButtonNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { renderChild } from "@a2ui-bridge/react";
import { Button as ShadcnButton, type ButtonVariant } from "../ui/button.js";

// Extended properties that may be passed by snippets
interface ExtendedButtonProps {
  variant?: { literalString?: string };
  fullWidth?: { literalBoolean?: boolean };
  compact?: { literalBoolean?: boolean };
}

/** Maps A2UI / Mantine / generic variant names to shadcn button variants */
const variantMap: Record<string, ButtonVariant> = {
  // A2UI protocol / snippet variants
  filled: "default",
  default: "default",
  primary: "default",
  // shadcn-native variant names (pass through)
  outline: "outline",
  secondary: "secondary",
  destructive: "destructive",
  ghost: "ghost",
  link: "link",
  // Mantine variant names
  subtle: "ghost",
  light: "secondary",
  transparent: "ghost",
  // Common aliases
  danger: "destructive",
  error: "destructive",
};

export function Button({
  node,
  onAction,
  components,
  surfaceId,
}: A2UIComponentProps<ButtonNode>): JSX.Element {
  const { properties } = node;
  const extendedProps = properties as typeof properties & ExtendedButtonProps;
  const variant = extendedProps.variant?.literalString ?? "default";
  const fullWidth = extendedProps.fullWidth?.literalBoolean ?? false;
  const compact = extendedProps.compact?.literalBoolean ?? false;

  const mappedVariant = variantMap[variant] ?? "default";
  const size = compact ? "sm" : "default";

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

  // Extract text content directly from the child node when it's a Text node.
  // This avoids the Text component applying its own theme color classes
  // (e.g. text-zinc-700) which override the button's text color.
  const child = properties.child;
  let childContent: JSX.Element | null = null;
  if (child && child.type === "Text" && child.properties) {
    const textProps = child.properties as {
      text?: { literalString?: string; literal?: string };
    };
    const text = textProps.text?.literalString ?? textProps.text?.literal ?? "";
    childContent = <span>{text}</span>;
  } else {
    childContent = renderChild(child, components, onAction, surfaceId);
  }

  return (
    <ShadcnButton
      variant={mappedVariant}
      size={size}
      className={fullWidth ? "w-full" : undefined}
      onClick={handleClick}
    >
      {childContent}
    </ShadcnButton>
  );
}
