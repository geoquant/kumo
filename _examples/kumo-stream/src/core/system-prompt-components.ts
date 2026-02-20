import registryJson from "@cloudflare/kumo/ai/component-registry.json";
import { ComponentPropsSchemas } from "@cloudflare/kumo/ai/schemas";
import { z } from "zod";
import { KNOWN_TYPES } from "./component-map";

type SchemaKey = keyof typeof ComponentPropsSchemas;

interface RegistryProp {
  readonly type: string;
  readonly optional?: boolean;
  readonly values?: readonly string[];
  readonly default?: unknown;
  readonly description?: string;
}

interface RegistrySubComponent {
  readonly description: string;
  readonly props: Record<string, RegistryProp>;
}

interface RegistryComponent {
  readonly description: string;
  readonly category: string;
  readonly props: Record<string, RegistryProp>;
  readonly subComponents?: Record<string, RegistrySubComponent>;
}

interface ParsedRegistry {
  readonly components: Record<string, RegistryComponent>;
}

interface RegistryRef {
  readonly component: string;
  readonly subComponent?: string;
}

type PromptGroup =
  | "Layout"
  | "Content"
  | "Interactive"
  | "Data Display"
  | "Navigation"
  | "Action"
  | "Feedback"
  | "Brand"
  | "Other";

// ---------------------------------------------------------------------------
// Parsing (avoid trusting JSON module typing)
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown, path: string): string {
  if (typeof value === "string") return value;
  throw new Error(`[system-prompt] Expected string at ${path}`);
}

function getBooleanOptional(value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  return undefined;
}

function getStringArrayOptional(value: unknown): readonly string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return undefined;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return undefined;
    out.push(item);
  }
  return out;
}

function parseRegistryProp(value: unknown, path: string): RegistryProp {
  if (!isRecord(value)) {
    throw new Error(`[system-prompt] Expected object at ${path}`);
  }

  return {
    type: getString(value.type, `${path}.type`),
    optional: getBooleanOptional(value.optional),
    values: getStringArrayOptional(value.values),
    default: value.default,
    description:
      typeof value.description === "string" ? value.description : undefined,
  };
}

function parsePropsRecord(
  value: unknown,
  path: string,
): Record<string, RegistryProp> {
  if (!isRecord(value)) {
    throw new Error(`[system-prompt] Expected object at ${path}`);
  }

  const out: Record<string, RegistryProp> = {};
  for (const [key, prop] of Object.entries(value)) {
    out[key] = parseRegistryProp(prop, `${path}.${key}`);
  }
  return out;
}

function parseSubComponents(
  value: unknown,
  path: string,
): Record<string, RegistrySubComponent> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) return undefined;

  const out: Record<string, RegistrySubComponent> = {};
  for (const [key, sub] of Object.entries(value)) {
    if (!isRecord(sub)) continue;
    if (!isRecord(sub.props)) continue;

    out[key] = {
      description: typeof sub.description === "string" ? sub.description : "",
      props: parsePropsRecord(sub.props, `${path}.${key}.props`),
    };
  }
  return out;
}

function parseRegistry(raw: unknown): ParsedRegistry {
  if (!isRecord(raw)) {
    throw new Error("[system-prompt] Registry JSON is not an object");
  }
  if (!isRecord(raw.components)) {
    throw new Error("[system-prompt] Registry JSON missing components object");
  }

  const components: Record<string, RegistryComponent> = {};

  for (const [name, comp] of Object.entries(raw.components)) {
    if (!isRecord(comp)) continue;
    if (!isRecord(comp.props)) continue;

    components[name] = {
      description: typeof comp.description === "string" ? comp.description : "",
      category: typeof comp.category === "string" ? comp.category : "Other",
      props: parsePropsRecord(comp.props, `components.${name}.props`),
      subComponents: parseSubComponents(
        comp.subComponents,
        `components.${name}.subComponents`,
      ),
    };
  }

  return { components };
}

const REGISTRY_RAW: unknown = registryJson;
const REGISTRY: ParsedRegistry = parseRegistry(REGISTRY_RAW);

// ---------------------------------------------------------------------------
// Supported types + resolution
// ---------------------------------------------------------------------------

const UI_TYPE_TO_REGISTRY_REF: Readonly<Record<string, RegistryRef>> = {
  // Aliases (kumo-stream UI type -> kumo component)
  Textarea: { component: "InputArea" },
  RadioGroup: { component: "Radio" },

  // Sub-components (kumo-stream UI type -> parent.subComponent)
  SelectOption: { component: "Select", subComponent: "Option" },

  BreadcrumbsLink: { component: "Breadcrumbs", subComponent: "Link" },
  BreadcrumbsCurrent: { component: "Breadcrumbs", subComponent: "Current" },
  BreadcrumbsSeparator: { component: "Breadcrumbs", subComponent: "Separator" },

  TableHeader: { component: "Table", subComponent: "Header" },
  TableHead: { component: "Table", subComponent: "Head" },
  TableBody: { component: "Table", subComponent: "Body" },
  TableRow: { component: "Table", subComponent: "Row" },
  TableCell: { component: "Table", subComponent: "Cell" },
  TableFooter: { component: "Table", subComponent: "Footer" },
};

const UI_TYPE_TO_SCHEMA_KEY: Readonly<Record<string, SchemaKey>> = {
  Textarea: "InputArea",
  RadioGroup: "Radio",
};

function isSchemaKey(key: string): key is SchemaKey {
  return Object.prototype.hasOwnProperty.call(ComponentPropsSchemas, key);
}

function resolveRegistryRef(uiType: string): RegistryRef {
  return UI_TYPE_TO_REGISTRY_REF[uiType] ?? { component: uiType };
}

function getSchemaKeyForType(uiType: string): SchemaKey | null {
  const alias = UI_TYPE_TO_SCHEMA_KEY[uiType];
  if (alias) return alias;
  if (isSchemaKey(uiType)) return uiType;
  return null;
}

function resolveRegistryEntry(ref: RegistryRef): {
  readonly description: string;
  readonly category: string;
  readonly props: Record<string, RegistryProp>;
} {
  const comp = REGISTRY.components[ref.component];
  if (!comp) {
    throw new Error(
      `[system-prompt] Missing registry entry for component "${ref.component}"`,
    );
  }

  if (ref.subComponent) {
    const sub = comp.subComponents?.[ref.subComponent];
    if (!sub) {
      throw new Error(
        `[system-prompt] Missing registry sub-component "${ref.component}.${ref.subComponent}"`,
      );
    }
    return {
      description: sub.description,
      category: comp.category,
      props: sub.props,
    };
  }

  return {
    description: comp.description,
    category: comp.category,
    props: comp.props,
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const PROMPT_GROUP_ORDER: readonly PromptGroup[] = [
  "Layout",
  "Content",
  "Interactive",
  "Data Display",
  "Navigation",
  "Action",
  "Feedback",
  "Brand",
  "Other",
];

function groupForType(uiType: string, category: string): PromptGroup {
  if (uiType === "CloudflareLogo") return "Brand";
  if (uiType === "ClipboardText") return "Action";
  if (
    uiType === "Surface" ||
    uiType === "Stack" ||
    uiType === "Cluster" ||
    uiType === "Grid" ||
    uiType === "Div"
  ) {
    return "Layout";
  }

  if (uiType.startsWith("Table") || uiType === "Meter") return "Data Display";
  if (
    uiType === "Link" ||
    uiType === "Breadcrumbs" ||
    uiType.startsWith("Breadcrumbs")
  ) {
    return "Navigation";
  }

  switch (category) {
    case "Layout":
      return "Layout";
    case "Display":
      return "Content";
    case "Input":
      return "Interactive";
    case "Navigation":
      return "Navigation";
    case "Action":
      return "Action";
    case "Feedback":
      return "Feedback";
    default:
      return "Other";
  }
}

function formatPropType(prop: RegistryProp): string {
  if (prop.type === "enum" && prop.values && prop.values.length > 0) {
    return prop.values.map((v) => `"${v}"`).join(" | ");
  }
  return prop.type;
}

function shouldSkipProp(name: string): boolean {
  if (
    name === "className" ||
    name === "id" ||
    name === "lang" ||
    name === "title"
  ) {
    return true;
  }
  if (name.startsWith("on")) return true;
  if (name.startsWith("set")) return true;
  return false;
}

const INTERESTING_PROP_NAMES: ReadonlySet<string> = new Set([
  "children",
  "label",
  "aria-label",
  "placeholder",
  "defaultValue",
  "value",
  "variant",
  "size",
  "gap",
  "align",
  "justify",
  "wrap",
  "href",
  "tabs",
  "code",
  "text",
  "legend",
  "orientation",
  "error",
  "description",
  "customValue",
  "max",
]);

function scoreProp(name: string, prop: RegistryProp): number {
  const optional = prop.optional === true;
  const requiredScore = optional ? 0 : 3;
  const enumScore = prop.type === "enum" ? 2 : 0;

  const nameScore = INTERESTING_PROP_NAMES.has(name) ? 1 : 0;
  return requiredScore + enumScore + nameScore;
}

function allowedPropKeys(
  schemaKey: SchemaKey | null,
): ReadonlySet<string> | null {
  if (!schemaKey) return null;
  const schema = ComponentPropsSchemas[schemaKey];
  if (schema instanceof z.ZodObject) {
    return new Set(Object.keys(schema.shape));
  }
  return null;
}

function renderPropsLines(
  props: Record<string, RegistryProp>,
  allowedKeys: ReadonlySet<string> | null,
): string[] {
  const entries: Array<{ name: string; prop: RegistryProp; score: number }> =
    [];

  for (const [name, prop] of Object.entries(props)) {
    if (allowedKeys && !allowedKeys.has(name)) continue;
    if (shouldSkipProp(name)) continue;

    const score = scoreProp(name, prop);
    if (score <= 0) continue;

    entries.push({ name, prop, score });
  }

  entries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.name.localeCompare(b.name);
  });

  return entries.slice(0, 10).map(({ name, prop }) => {
    const optional = prop.optional === true;
    const defaultPart =
      prop.default === undefined
        ? ""
        : typeof prop.default === "string"
          ? ` (default "${prop.default}")`
          : ` (default ${String(prop.default)})`;
    return `  - ${name}${optional ? "?" : ""}: ${formatPropType(prop)}${defaultPart}`;
  });
}

function supportedUiTypes(): readonly string[] {
  const types = Array.from(KNOWN_TYPES).sort((a, b) => a.localeCompare(b));
  return ["Div", ...types];
}

function renderSynthetic(uiType: string): {
  description: string;
  propsLines: string[];
} {
  if (uiType === "Div") {
    return {
      description:
        "Generic HTML container. Props are restricted to className plus safe attributes (style/id/role/aria-*/data-*).",
      propsLines: [
        "  - className?: string",
        "  - style?: Record<string, unknown>",
        "  - id?: string",
        "  - role?: string",
        "  - aria-*: string",
        "  - data-*: string",
      ],
    };
  }

  if (uiType === "RadioItem") {
    return {
      description:
        "Radio option item (used as a child of RadioGroup). Not schema-validated in kumo-stream.",
      propsLines: [
        "  - label: string",
        "  - value: string",
        "  - disabled?: boolean",
      ],
    };
  }

  throw new Error(`[system-prompt] Unknown synthetic type: ${uiType}`);
}

function renderAvailableComponentsSection(): string {
  const types = supportedUiTypes();
  const grouped = new Map<PromptGroup, string[]>();
  for (const group of PROMPT_GROUP_ORDER) grouped.set(group, []);

  for (const uiType of types) {
    if (uiType === "Div" || uiType === "RadioItem") {
      const synth = renderSynthetic(uiType);
      const group = groupForType(uiType, "Other");
      const lines = grouped.get(group);
      if (!lines) continue;

      lines.push(`- **${uiType}** — ${synth.description}`);
      lines.push(...synth.propsLines);
      continue;
    }

    const ref = resolveRegistryRef(uiType);
    const entry = resolveRegistryEntry(ref);
    const schemaKey = getSchemaKeyForType(uiType);
    const allowedKeys = allowedPropKeys(schemaKey);

    const aliasNote =
      uiType === "Textarea"
        ? " (alias of InputArea)"
        : uiType === "RadioGroup"
          ? " (alias of Radio)"
          : "";

    const group = groupForType(uiType, entry.category);
    const lines = grouped.get(group);
    if (!lines) continue;

    lines.push(`- **${uiType}**${aliasNote} — ${entry.description}`);
    const propLines = renderPropsLines(entry.props, allowedKeys);
    if (propLines.length > 0) lines.push(...propLines);
  }

  const out: string[] = [];
  for (const group of PROMPT_GROUP_ORDER) {
    const lines = grouped.get(group);
    if (!lines || lines.length === 0) continue;
    out.push(`### ${group}`);
    out.push(...lines);
    out.push("");
  }

  return out.join("\n").trimEnd();
}

export const AVAILABLE_COMPONENTS_SECTION = renderAvailableComponentsSection();

export function getAvailableComponentsSection(): string {
  return AVAILABLE_COMPONENTS_SECTION;
}

export function getPromptSupportedTypes(): readonly string[] {
  return supportedUiTypes();
}
