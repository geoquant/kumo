/**
 * Converts a UITree into idiomatic JSX source code with `@cloudflare/kumo` imports.
 *
 * Applies the same 8-pass normalization pipeline as UITreeRenderer before
 * serialization, ensuring visual parity between rendered and generated output.
 */

import type { UIElement, UITree } from "../catalog/types.js";
import {
  SUB_COMPONENT_ALIASES,
  TYPE_ALIASES,
  SYNTHETIC_TYPES,
} from "./component-manifest.js";
import {
  normalizeNestedSurfaces,
  normalizeEmptySelects,
  normalizeDuplicateFieldLabels,
  normalizeCheckboxGroupGrids,
  normalizeSiblingFormRowGrids,
  normalizeSurfaceOrphans,
  normalizeCounterStacks,
  normalizeFormActionBars,
} from "./ui-tree-renderer.js";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface UiTreeToJsxOptions {
  /**
   * Name of the exported React component.
   * @default "GeneratedUI"
   */
  readonly componentName?: string;

  /**
   * When `true`, skip the 8-pass normalization pipeline.
   * Useful when the tree has already been normalized.
   * @default false
   */
  readonly skipNormalization?: boolean;
}

/**
 * Convert a {@link UITree} into a self-contained JSX module string.
 *
 * The output includes a named `@cloudflare/kumo` import for every component
 * referenced in the tree (deduplicated, sorted) and a single default-exported
 * function component rendering the tree.
 *
 * @example
 * ```ts
 * const jsx = uiTreeToJsx(tree);
 * // import { Button, Stack, Surface } from "@cloudflare/kumo";
 * //
 * // export function GeneratedUI() {
 * //   return (
 * //     <Surface heading="Settings">
 * //       <Stack gap="md">
 * //         <Button>Save</Button>
 * //       </Stack>
 * //     </Surface>
 * //   );
 * // }
 * ```
 */
export function uiTreeToJsx(
  tree: UITree | null | undefined,
  options?: UiTreeToJsxOptions,
): string {
  const componentName = options?.componentName ?? "GeneratedUI";

  // Empty / missing tree → render-nothing component
  if (!tree || !tree.root || Object.keys(tree.elements).length === 0) {
    return `export function ${componentName}() {\n  return null;\n}`;
  }

  // --- Normalize (same pipeline as UITreeRenderer) -------------------------
  const normalized = options?.skipNormalization ? tree : normalizeTree(tree);

  const rootEl = normalized.elements[normalized.root];
  if (!rootEl) {
    return `export function ${componentName}() {\n  return null;\n}`;
  }

  // --- Serialize -----------------------------------------------------------
  const imports = new Set<string>();
  const body = serializeElement(normalized, rootEl, imports, 2);

  // Build import statement
  const importLine = buildImportLine(imports);
  const importBlock = importLine ? `${importLine}\n\n` : "";

  return (
    `${importBlock}export function ${componentName}() {\n` +
    `  return (\n${body}\n  );\n}`
  );
}

// ---------------------------------------------------------------------------
// Normalization (mirrors UITreeRenderer pipeline exactly)
// ---------------------------------------------------------------------------

function normalizeTree(tree: UITree): UITree {
  return normalizeFormActionBars(
    normalizeCounterStacks(
      normalizeSurfaceOrphans(
        normalizeSiblingFormRowGrids(
          normalizeCheckboxGroupGrids(
            normalizeDuplicateFieldLabels(
              normalizeEmptySelects(normalizeNestedSurfaces(tree)),
            ),
          ),
        ),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/** Props that are structural / internal to UIElement and must not appear in JSX output. */
const INTERNAL_PROPS = new Set(["action", "visible", "parentKey", "key"]);

/**
 * Recursively serialize a single element and its children to JSX.
 *
 * @param indent - number of leading spaces for the opening tag
 */
function serializeElement(
  tree: UITree,
  el: UIElement,
  imports: Set<string>,
  indent: number,
): string {
  const pad = " ".repeat(indent);
  const tag = resolveTag(el.type, imports);

  // Collect serializable props (exclude internal-only fields)
  const propEntries: Array<[string, unknown]> = [];
  for (const [key, value] of Object.entries(el.props)) {
    if (INTERNAL_PROPS.has(key)) continue;
    propEntries.push([key, value]);
  }

  // `props.children` that is a string becomes text content inside the tag.
  const textContent =
    typeof el.props.children === "string" ? el.props.children : null;

  // Remove `children` from prop entries — it's rendered as content, not a prop.
  const filteredProps =
    textContent !== null
      ? propEntries.filter(([k]) => k !== "children")
      : propEntries;

  const propsStr = serializeProps(filteredProps);
  const openTag = propsStr ? `<${tag} ${propsStr}` : `<${tag}`;

  // Structural children (element keys)
  const childKeys = el.children ?? [];
  const hasStructuralChildren = childKeys.length > 0;
  const hasTextContent = textContent !== null;

  // Self-closing: no children at all
  if (!hasStructuralChildren && !hasTextContent) {
    return `${pad}${openTag} />`;
  }

  // Text-only children (no structural children)
  if (!hasStructuralChildren && hasTextContent) {
    // Short text �� single line
    if (textContent.length <= 60 && !textContent.includes("\n")) {
      return `${pad}${openTag}>${escapeJsxText(textContent)}</${tag}>`;
    }
    // Long text → multiline
    return (
      `${pad}${openTag}>\n` +
      `${pad}  ${escapeJsxText(textContent)}\n` +
      `${pad}</${tag}>`
    );
  }

  // Structural children (may also have text content)
  const lines: string[] = [];
  lines.push(`${pad}${openTag}>`);

  if (hasTextContent) {
    lines.push(`${pad}  ${escapeJsxText(textContent)}`);
  }

  for (const childKey of childKeys) {
    const childEl = tree.elements[childKey];
    if (!childEl) continue;
    lines.push(serializeElement(tree, childEl, imports, indent + 2));
  }

  lines.push(`${pad}</${tag}>`);
  return lines.join("\n");
}

/**
 * Resolve the JSX tag name from a UIElement type and track the import.
 *
 * - Sub-component aliases → dot notation (e.g. `Table.Header`)
 * - Type aliases → canonical name (e.g. `Textarea` → `InputArea`)
 * - Synthetic `Div` → `<div>` (no import)
 * - Everything else → direct component name
 */
function resolveTag(type: string, imports: Set<string>): string {
  // Synthetic types
  if (type in SYNTHETIC_TYPES) {
    return "div";
  }

  // Type aliases (e.g. Textarea → InputArea)
  const aliasedType =
    type in TYPE_ALIASES
      ? TYPE_ALIASES[type as keyof typeof TYPE_ALIASES]
      : type;

  // Sub-component aliases (e.g. TableHeader → Table.Header)
  if (aliasedType in SUB_COMPONENT_ALIASES) {
    const alias =
      SUB_COMPONENT_ALIASES[aliasedType as keyof typeof SUB_COMPONENT_ALIASES];
    imports.add(alias.parent);
    return `${alias.parent}.${alias.sub}`;
  }

  // Direct component
  imports.add(aliasedType);
  return aliasedType;
}

/**
 * Serialize an array of `[key, value]` prop entries to a JSX attribute string.
 */
function serializeProps(entries: ReadonlyArray<[string, unknown]>): string {
  if (entries.length === 0) return "";

  const parts: string[] = [];
  for (const [key, value] of entries) {
    const serialized = serializePropValue(key, value);
    if (serialized !== null) {
      parts.push(serialized);
    }
  }
  return parts.join(" ");
}

/**
 * Serialize a single prop to JSX attribute syntax.
 *
 * - `string` → `key="value"`
 * - `true` → `key` (shorthand)
 * - `false` → `key={false}`
 * - `number` → `key={123}`
 * - `null | undefined` → omitted
 * - object/array → `key={JSON.stringify(...)}`
 */
function serializePropValue(key: string, value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    return `${key}=${quoteAttr(value)}`;
  }

  if (typeof value === "boolean") {
    return value ? key : `${key}={false}`;
  }

  if (typeof value === "number") {
    return `${key}={${value}}`;
  }

  // Arrays and objects → JSON expression
  if (typeof value === "object") {
    return `${key}={${JSON.stringify(value)}}`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Import builder
// ---------------------------------------------------------------------------

/**
 * Build a sorted, deduplicated import line from the collected component names.
 * Returns empty string when the set is empty (e.g. tree is only `<div>`s).
 */
function buildImportLine(imports: Set<string>): string {
  if (imports.size === 0) return "";
  const sorted = [...imports].sort((a, b) => a.localeCompare(b));
  return `import { ${sorted.join(", ")} } from "@cloudflare/kumo";`;
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

/** Escape JSX-significant characters in text content. */
function escapeJsxText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/{/g, "&#123;")
    .replace(/}/g, "&#125;");
}

/** Quote a string attribute value, choosing between `"` and `{...}`. */
function quoteAttr(value: string): string {
  // If the value contains double quotes, use JSX expression syntax
  if (value.includes('"')) {
    // Escape backticks and ${} in template literal
    const escaped = value
      .replace(/\\/g, "\\\\")
      .replace(/`/g, "\\`")
      .replace(/\$\{/g, "\\${");
    return "{`" + escaped + "`}";
  }
  return `"${value}"`;
}
