import type { KumoTranslation } from "./types.js";

/**
 * Internal translation registry.
 *
 * Translations are stored in a `Map` keyed by their BCP 47 `$code`.
 * The **first** translation registered becomes the fallback when no
 * match is found during resolution.
 */
const registry = new Map<string, KumoTranslation>();

/** BCP 47 code of the first translation ever registered (the fallback). */
let fallbackCode: string | undefined;

export type TranslationMatchKind = "exact" | "prefix" | "fallback" | "none";

export interface TranslationResolution {
  readonly translation: KumoTranslation | undefined;
  readonly matchedBy: TranslationMatchKind;
  readonly normalizedLocale: string;
}

function normalizeLookupLocale(locale: string): string {
  const normalizedSeparators = locale.replaceAll("_", "-").trim();
  if (normalizedSeparators === "") return "en";

  try {
    const canonical = Intl.getCanonicalLocales(normalizedSeparators)[0];
    return canonical ?? normalizedSeparators;
  } catch {
    return normalizedSeparators;
  }
}

/**
 * Register one or more translation objects.
 *
 * Each translation is keyed by its `$code` field. Calling this function
 * multiple times **merges** new translations into the registry without
 * removing previously registered entries.
 *
 * The very first translation registered (across all calls) becomes the
 * fallback returned by {@link getTranslation} when no match is found.
 *
 * @example
 * ```ts
 * import { en } from "../translations/en.js";
 * import { de } from "../translations/de.js";
 *
 * registerTranslation(en, de);
 * ```
 */
export function registerTranslation(
  ...translations: readonly KumoTranslation[]
): void {
  for (const translation of translations) {
    if (fallbackCode === undefined) {
      fallbackCode = translation.$code;
    }
    registry.set(translation.$code, translation);
  }
}

/**
 * Resolve a translation for the given BCP 47 language tag.
 *
 * Resolution order:
 * 1. **Exact match** — e.g. `"zh-CN"` → registered `"zh-CN"`.
 * 2. **Language prefix** — e.g. `"es-PE"` → registered `"es"`.
 * 3. **Fallback** — the first translation that was ever registered.
 *
 * Returns `undefined` only when the registry is completely empty.
 */
export function getTranslation(lang: string): KumoTranslation | undefined {
  return resolveTranslation(lang).translation;
}

export function resolveTranslation(lang: string): TranslationResolution {
  const normalizedLang = normalizeLookupLocale(lang);

  // 1. Exact match
  const exact = registry.get(normalizedLang);
  if (exact) {
    return {
      translation: exact,
      matchedBy: "exact",
      normalizedLocale: normalizedLang,
    };
  }

  // 2. Language prefix — take everything before the first hyphen
  const hyphenIdx = normalizedLang.indexOf("-");
  if (hyphenIdx > 0) {
    const prefix = normalizedLang.slice(0, hyphenIdx);
    const prefixed = registry.get(prefix);
    if (prefixed) {
      return {
        translation: prefixed,
        matchedBy: "prefix",
        normalizedLocale: normalizedLang,
      };
    }
  }

  // 3. Fallback to first registered
  if (fallbackCode !== undefined) {
    return {
      translation: registry.get(fallbackCode),
      matchedBy: "fallback",
      normalizedLocale: normalizedLang,
    };
  }

  return {
    translation: undefined,
    matchedBy: "none",
    normalizedLocale: normalizedLang,
  };
}

/**
 * Reset the registry. **Only for tests.**
 * @internal
 */
export function _resetRegistry(): void {
  registry.clear();
  fallbackCode = undefined;
}
