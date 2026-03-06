import en from "./en";

import type { KumoTranslation } from "../localize/types";

type TranslationMetadata = Pick<KumoTranslation, "$code" | "$name" | "$dir">;
type TranslationCatalog = Readonly<Record<string, string>>;
type TranslationOverrides = Partial<
  Omit<KumoTranslation, keyof TranslationMetadata>
>;
type MutableTranslation = {
  -readonly [K in keyof KumoTranslation]: KumoTranslation[K];
};

function getTemplate(
  catalog: TranslationCatalog | TranslationOverrides,
  key: string,
): string | undefined {
  const value = Reflect.get(catalog, key);
  return typeof value === "string" ? value : undefined;
}

function formatTemplate(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return template.replace(/\{([^}]+)\}/g, (match, token) => {
    const replacement = Reflect.get(values, token);
    if (typeof replacement === "string" || typeof replacement === "number") {
      return String(replacement);
    }

    return match;
  });
}

export function createTranslation(
  metadata: TranslationMetadata,
  catalog: TranslationCatalog | TranslationOverrides = {},
): KumoTranslation {
  const translation: MutableTranslation = {
    ...en,
    ...metadata,
  };

  for (const [key, value] of Object.entries(catalog)) {
    if (key.startsWith("$")) continue;

    const englishValue = Reflect.get(en, key);
    if (typeof englishValue === "function" && typeof value === "function") {
      Reflect.set(translation, key, value);
      continue;
    }

    if (typeof englishValue !== "string" || typeof value !== "string") continue;

    Reflect.set(translation, key, value);
  }

  const showingRangeTemplate = getTemplate(catalog, "showing-range");
  if (showingRangeTemplate !== undefined) {
    translation["showing-range"] = (
      start: string | number,
      end: string | number,
      total: string | number,
    ) => formatTemplate(showingRangeTemplate, { start, end, total });
  }

  const maskedSensitiveValueTemplate = getTemplate(
    catalog,
    "masked-sensitive-value",
  );
  if (maskedSensitiveValueTemplate !== undefined) {
    translation["masked-sensitive-value"] = (label: string) =>
      formatTemplate(maskedSensitiveValueTemplate, { label });
  }

  const timezoneTemplate = getTemplate(catalog, "timezone");
  if (timezoneTemplate !== undefined) {
    translation.timezone = (tz: string) =>
      formatTemplate(timezoneTemplate, { tz });
  }

  const selectedAsStartDateTemplate = getTemplate(
    catalog,
    "selected-as-start-date",
  );
  if (selectedAsStartDateTemplate !== undefined) {
    translation["selected-as-start-date"] = (date: string) =>
      formatTemplate(selectedAsStartDateTemplate, { date });
  }

  const selectedAsEndDateTemplate = getTemplate(
    catalog,
    "selected-as-end-date",
  );
  if (selectedAsEndDateTemplate !== undefined) {
    translation["selected-as-end-date"] = (date: string) =>
      formatTemplate(selectedAsEndDateTemplate, { date });
  }

  const withinSelectedRangeTemplate = getTemplate(
    catalog,
    "within-selected-range",
  );
  if (withinSelectedRangeTemplate !== undefined) {
    translation["within-selected-range"] = (date: string) =>
      formatTemplate(withinSelectedRangeTemplate, { date });
  }

  const deleteResourceTemplate = getTemplate(catalog, "delete-resource");
  if (deleteResourceTemplate !== undefined) {
    translation["delete-resource"] = (resourceName: string) =>
      formatTemplate(deleteResourceTemplate, { resourceName });
  }

  const deleteActionCannotBeUndoneTemplate = getTemplate(
    catalog,
    "delete-action-cannot-be-undone",
  );
  if (deleteActionCannotBeUndoneTemplate !== undefined) {
    translation["delete-action-cannot-be-undone"] = (
      resourceName: string,
      resourceType: string,
    ) =>
      formatTemplate(deleteActionCannotBeUndoneTemplate, {
        resourceName,
        resourceType,
      });
  }

  const typeToConfirmTemplate = getTemplate(catalog, "type-to-confirm");
  if (typeToConfirmTemplate !== undefined) {
    translation["type-to-confirm"] = (resourceName: string) =>
      formatTemplate(typeToConfirmTemplate, { resourceName });
  }

  const confirmDeletionAriaLabelTemplate = getTemplate(
    catalog,
    "confirm-deletion-aria-label",
  );
  if (confirmDeletionAriaLabelTemplate !== undefined) {
    translation["confirm-deletion-aria-label"] = (resourceName: string) =>
      formatTemplate(confirmDeletionAriaLabelTemplate, { resourceName });
  }

  const copyResourceNameToClipboardTemplate = getTemplate(
    catalog,
    "copy-resource-name-to-clipboard",
  );
  if (copyResourceNameToClipboardTemplate !== undefined) {
    translation["copy-resource-name-to-clipboard"] = (resourceName: string) =>
      formatTemplate(copyResourceNameToClipboardTemplate, { resourceName });
  }

  const deleteResourceTypeTemplate = getTemplate(
    catalog,
    "delete-resource-type",
  );
  if (deleteResourceTypeTemplate !== undefined) {
    translation["delete-resource-type"] = (resourceType: string) =>
      formatTemplate(deleteResourceTypeTemplate, { resourceType });
  }

  return translation;
}
