import { kumoRegistryJson } from "virtual:kumo-registry";

interface VariantComponent {
  readonly name: string;
  readonly variants: readonly string[];
}

const VARIANT_COMPONENT_NAMES = [
  "Badge",
  "Banner",
  "Button",
  "Checkbox",
  "CloudflareLogo",
  "Grid",
  "Input",
  "Link",
  "Switch",
  "Table",
  "Tabs",
  "Text",
] as const;

const VARIANT_COMPONENTS: readonly VariantComponent[] =
  VARIANT_COMPONENT_NAMES.flatMap((name) => {
    const component = kumoRegistryJson.components[name];
    const variant = component?.props?.variant;

    if (
      variant?.type !== "enum" ||
      variant.values === undefined ||
      variant.values.length === 0
    ) {
      return [];
    }

    return [{ name, variants: variant.values }];
  });

export function isExhaustiveVariantShowcasePrompt(prompt: string): boolean {
  const normalized = prompt.toLowerCase();

  return (
    normalized.includes("kumo") &&
    normalized.includes("component") &&
    normalized.includes("variant") &&
    (normalized.includes("every") || normalized.includes("all"))
  );
}

export function buildVariantShowcasePromptSupplement(): string {
  return [
    "# Exhaustive Variant Showcase",
    "",
    "The user wants an exhaustive panel A showcase.",
    "- Render every supported variant for every generative Kumo component listed below.",
    "- Use real component instances, not text-only labels pretending to be components.",
    "- Group output by component name.",
    "- Keep layout compact, but do not omit any listed variant.",
    "- Do not invent components or variants not listed here.",
    "",
    ...VARIANT_COMPONENTS.map(
      (component) => `- ${component.name}: ${component.variants.join(" | ")}`,
    ),
  ].join("\n");
}
