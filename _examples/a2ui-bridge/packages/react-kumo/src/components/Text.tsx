/**
 * @a2ui-bridge/react-kumo - Text adapter
 * Maps A2UI Text nodes to @cloudflare/kumo Text
 */

import type { TextNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { Text as KumoText } from "@cloudflare/kumo";

type UsageHintValue =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "caption"
  | "body"
  | "label";

const usageHintToVariant: Record<
  string,
  "heading1" | "heading2" | "heading3" | "body" | "secondary"
> = {
  h1: "heading1",
  h2: "heading2",
  h3: "heading3",
  h4: "heading3",
  h5: "heading3",
  caption: "secondary",
  label: "secondary",
  body: "body",
};

const usageHintToSize: Record<string, "xs" | "sm" | "base" | "lg"> = {
  h1: "lg",
  h2: "lg",
  h3: "base",
  h4: "sm",
  h5: "xs",
  caption: "xs",
  label: "sm",
  body: "base",
};

/** Unwrap a value that may be a raw number or `{ literalNumber }` object */
function unwrapNumber(val: unknown): number | undefined {
  if (typeof val === "number") return val;
  if (val && typeof val === "object" && "literalNumber" in val) {
    return (val as { literalNumber?: number }).literalNumber ?? undefined;
  }
  return undefined;
}

const fontWeightClasses: Record<number, string> = {
  100: "font-thin",
  200: "font-extralight",
  300: "font-light",
  400: "font-normal",
  500: "font-medium",
  600: "font-semibold",
  700: "font-bold",
  800: "font-extrabold",
  900: "font-black",
};

export function Text({ node }: A2UIComponentProps<TextNode>): JSX.Element {
  const { properties } = node;
  const props = properties as unknown as Record<string, unknown>;

  // Extract usageHint - handle both string and literalString object format
  const usageHintRaw = properties.usageHint as unknown;
  const usageHint: UsageHintValue =
    typeof usageHintRaw === "string"
      ? (usageHintRaw as UsageHintValue)
      : (((usageHintRaw as { literalString?: string; literal?: string })
          ?.literalString ??
          (usageHintRaw as { literalString?: string; literal?: string })
            ?.literal ??
          "body") as UsageHintValue);

  // Extract fontWeight - handle both raw number and { literalNumber } object
  const fontWeight = unwrapNumber(props.fontWeight);

  const text = properties.text.literalString ?? properties.text.literal ?? "";
  const variant = usageHintToVariant[usageHint] ?? "body";

  const weightClass = fontWeight ? fontWeightClasses[fontWeight] : undefined;

  // Headings can't have size prop in kumo
  if (
    variant === "heading1" ||
    variant === "heading2" ||
    variant === "heading3"
  ) {
    const el = <KumoText variant={variant}>{text}</KumoText>;
    return weightClass ? <span className={weightClass}>{el}</span> : el;
  }

  const el = (
    <KumoText variant={variant} size={usageHintToSize[usageHint] ?? "base"}>
      {text}
    </KumoText>
  );
  return weightClass ? <span className={weightClass}>{el}</span> : el;
}
