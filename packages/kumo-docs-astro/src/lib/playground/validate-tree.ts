import {
  createKumoCatalog,
  initCatalog,
  type CustomComponentDefinition,
  type UITree,
} from "@cloudflare/kumo/catalog";

import type { ValidationIssue } from "~/lib/playground/types";

let validationCatalogPromise: Promise<
  ReturnType<typeof createKumoCatalog>
> | null = null;

async function getValidationCatalog(
  customComponents: Readonly<Record<string, CustomComponentDefinition>>,
) {
  if (validationCatalogPromise !== null) {
    return validationCatalogPromise;
  }

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

  return {
    success: false,
    issues: result.error ?? [{ message: "Validation failed", path: [] }],
  };
}
