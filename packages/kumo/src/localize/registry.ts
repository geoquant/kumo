import type { KumoTranslation } from "./types.js";

const DEFAULT_FALLBACK_LOCALE = "en";

export type TranslationMatchKind = "exact" | "prefix" | "fallback" | "none";

export interface TranslationResolution {
  readonly translation: KumoTranslation | undefined;
  readonly matchedBy: TranslationMatchKind;
  readonly normalizedLocale: string;
}

interface TranslationResolveOptions {
  readonly fallbackLocale?: string;
}

export interface TranslationRegistry {
  readonly registerTranslation: (
    ...translations: readonly KumoTranslation[]
  ) => void;
  readonly getTranslation: (
    lang: string,
    options?: TranslationResolveOptions,
  ) => KumoTranslation | undefined;
  readonly resolveTranslation: (
    lang: string,
    options?: TranslationResolveOptions,
  ) => TranslationResolution;
  readonly reset: () => void;
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

function createTranslationRegistry(
  ...initialTranslations: readonly KumoTranslation[]
): TranslationRegistry {
  const store = new Map<string, KumoTranslation>();
  let firstCode: string | undefined;

  function registerTranslation(
    ...translations: readonly KumoTranslation[]
  ): void {
    for (const translation of translations) {
      const normalizedCode = normalizeLookupLocale(translation.$code);
      const normalizedTranslation: KumoTranslation =
        normalizedCode === translation.$code
          ? translation
          : {
              ...translation,
              $code: normalizedCode,
            };

      if (firstCode === undefined) {
        firstCode = normalizedCode;
      }
      store.set(normalizedCode, normalizedTranslation);
    }
  }

  function lookupExactOrPrefix(locale: string): KumoTranslation | undefined {
    const exact = store.get(locale);
    if (exact !== undefined) return exact;

    const segments = locale.split("-");
    for (let i = segments.length - 1; i > 0; i -= 1) {
      const candidate = segments.slice(0, i).join("-");
      const prefixed = store.get(candidate);
      if (prefixed !== undefined) return prefixed;
    }

    return undefined;
  }

  function resolveTranslation(
    lang: string,
    options?: TranslationResolveOptions,
  ): TranslationResolution {
    const normalizedLang = normalizeLookupLocale(lang);

    const exact = store.get(normalizedLang);
    if (exact !== undefined) {
      return {
        translation: exact,
        matchedBy: "exact",
        normalizedLocale: normalizedLang,
      };
    }

    const prefixed = lookupExactOrPrefix(normalizedLang);
    if (prefixed !== undefined) {
      return {
        translation: prefixed,
        matchedBy: "prefix",
        normalizedLocale: normalizedLang,
      };
    }

    const configuredFallbackLocale =
      options?.fallbackLocale ?? DEFAULT_FALLBACK_LOCALE;
    const normalizedFallbackLocale = normalizeLookupLocale(
      configuredFallbackLocale,
    );
    const configuredFallbackTranslation = lookupExactOrPrefix(
      normalizedFallbackLocale,
    );
    if (configuredFallbackTranslation !== undefined) {
      return {
        translation: configuredFallbackTranslation,
        matchedBy: "fallback",
        normalizedLocale: normalizedLang,
      };
    }

    if (firstCode !== undefined) {
      return {
        translation: store.get(firstCode),
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

  function getTranslation(
    lang: string,
    options?: TranslationResolveOptions,
  ): KumoTranslation | undefined {
    return resolveTranslation(lang, options).translation;
  }

  function reset(): void {
    store.clear();
    firstCode = undefined;
  }

  registerTranslation(...initialTranslations);

  return {
    registerTranslation,
    getTranslation,
    resolveTranslation,
    reset,
  };
}

const defaultTranslationRegistry = createTranslationRegistry();

export function createScopedTranslationRegistry(
  ...translations: readonly KumoTranslation[]
): TranslationRegistry {
  return createTranslationRegistry(...translations);
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
  defaultTranslationRegistry.registerTranslation(...translations);
}

/**
 * Resolve a translation for the given BCP 47 language tag.
 *
 * Resolution order:
 * 1. **Exact match** — e.g. `"zh-CN"` → registered `"zh-CN"`.
 * 2. **Language prefix** — e.g. `"es-PE"` → registered `"es"`.
 * 3. **Fallback** — configured fallback locale (default `"en"`).
 * 4. **Last resort** — first translation that was ever registered.
 *
 * Returns `undefined` only when the registry is completely empty.
 */
export function getTranslation(
  lang: string,
  options?: TranslationResolveOptions,
): KumoTranslation | undefined {
  return defaultTranslationRegistry.getTranslation(lang, options);
}

export function resolveTranslation(
  lang: string,
  options?: TranslationResolveOptions,
): TranslationResolution {
  return defaultTranslationRegistry.resolveTranslation(lang, options);
}

/**
 * Reset the registry. **Only for tests.**
 * @internal
 */
export function _resetRegistry(): void {
  defaultTranslationRegistry.reset();
}
