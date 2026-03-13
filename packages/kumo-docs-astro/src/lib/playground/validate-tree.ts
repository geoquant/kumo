import {
  createKumoCatalog,
  initCatalog,
  type CustomComponentDefinition,
  type UIElement,
  type UITree,
} from "@cloudflare/kumo/catalog";

import type { ValidationIssue } from "~/lib/playground/types";

let validationCatalogPromise: Promise<
  ReturnType<typeof createKumoCatalog>
> | null = null;
let validationCatalogKey: string | null = null;

function buildValidationCatalogKey(
  customComponents: Readonly<Record<string, CustomComponentDefinition>>,
): string {
  return Object.keys(customComponents).sort().join("|");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function buildFallbackTree(
  value: unknown,
  customComponentNames: ReadonlySet<string>,
): UITree | null {
  if (!isRecord(value)) return null;

  const root = value["root"];
  const rawElements = value["elements"];

  if (typeof root !== "string" || !isRecord(rawElements)) return null;

  const elements: Record<string, UIElement> = {};
  let hasCustomComponent = false;

  for (const [elementKey, rawElement] of Object.entries(rawElements)) {
    if (!isRecord(rawElement)) return null;

    const key = rawElement["key"];
    const type = rawElement["type"];
    const props = rawElement["props"];
    const children = rawElement["children"];
    const parentKey = rawElement["parentKey"];

    if (
      typeof key !== "string" ||
      typeof type !== "string" ||
      !isRecord(props)
    ) {
      return null;
    }

    if (children !== undefined && !isStringArray(children)) return null;
    if (
      parentKey !== undefined &&
      parentKey !== null &&
      typeof parentKey !== "string"
    ) {
      return null;
    }

    if (customComponentNames.has(type)) {
      hasCustomComponent = true;
    }

    elements[elementKey] = {
      key,
      type,
      props: { ...props },
      ...(children !== undefined ? { children: [...children] } : {}),
      ...(parentKey !== undefined ? { parentKey } : {}),
    };
  }

  if (!hasCustomComponent || elements[root] === undefined) return null;

  for (const element of Object.values(elements)) {
    if (
      element.parentKey !== undefined &&
      element.parentKey !== null &&
      elements[element.parentKey] === undefined
    ) {
      return null;
    }

    for (const childKey of element.children ?? []) {
      if (elements[childKey] === undefined) return null;
    }
  }

  return { root, elements };
}

async function getValidationCatalog(
  customComponents: Readonly<Record<string, CustomComponentDefinition>>,
) {
  const cacheKey = buildValidationCatalogKey(customComponents);

  if (validationCatalogPromise !== null && validationCatalogKey === cacheKey) {
    return validationCatalogPromise;
  }

  validationCatalogKey = cacheKey;

  validationCatalogPromise = (async () => {
    const catalog = createKumoCatalog({ customComponents });
    await initCatalog(catalog);
    return catalog;
  })();

  return validationCatalogPromise;
}

export async function validateEditableTree(
  text: string,
  customComponents: Readonly<Record<string, CustomComponentDefinition>>,
): Promise<
  | { readonly success: true; readonly tree: UITree }
  | { readonly success: false; readonly issues: readonly ValidationIssue[] }
> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      success: false,
      issues: [
        {
          message:
            error instanceof Error ? error.message : "Invalid JSON document",
          path: [],
        },
      ],
    };
  }

  const catalog = await getValidationCatalog(customComponents);
  const result = catalog.validateTree(parsed);
  if (result.success) {
    const tree = result.data;
    if (tree === undefined) {
      return {
        success: false,
        issues: [{ message: "Validation returned no tree", path: [] }],
      };
    }

    return {
      success: true,
      tree,
    };
  }

  const fallbackTree = buildFallbackTree(
    parsed,
    new Set(Object.keys(customComponents)),
  );
  if (fallbackTree !== null) {
    return {
      success: true,
      tree: fallbackTree,
    };
  }

  return {
    success: false,
    issues: result.error ?? [{ message: "Validation failed", path: [] }],
  };
}
