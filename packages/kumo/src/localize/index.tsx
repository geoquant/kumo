import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

import { resolveTranslation } from "./registry.js";
import type { KumoTranslation } from "./types.js";
import { useLocale } from "./use-locale.js";
import { DirectionProvider, type Direction } from "./direction.js";
import { resolveLocale } from "./resolve-locale.js";
import { registerBuiltInTranslations } from "../translations/index.js";

registerBuiltInTranslations();

// Re-exports for public API
export { registerTranslation } from "./registry.js";
export type { KumoTranslation } from "./types.js";

// ── Types ──────────────────────────────────────────────────────────────

/**
 * Translation keys whose value is a string (not a function).
 */
type TermKey = Exclude<Extract<keyof KumoTranslation, string>, `$${string}`>;

type SimpleKey = {
  [K in TermKey]: KumoTranslation[K] extends string ? K : never;
}[TermKey];

/**
 * Translation keys whose value is a function returning a string.
 *
 * Uses negation of `string` rather than direct function matching to avoid
 * contravariance issues with function parameter types.
 */
type ParameterizedKey = {
  [K in TermKey]: KumoTranslation[K] extends (...args: infer _A) => string
    ? K
    : never;
}[TermKey];

/**
 * Extract the parameter types from a parameterized translation key.
 */
type TermArgs<K extends ParameterizedKey> = KumoTranslation[K] extends (
  ...args: infer A
) => string
  ? A
  : never;

/**
 * Type-safe term lookup function.
 *
 * - For simple keys: `term('close')` returns `string`.
 * - For parameterized keys: `term('showingRange', 1, 10, 100)` requires the
 *   function's parameters and returns `string`.
 */
export interface TermFn {
  (key: SimpleKey): string;
  <K extends ParameterizedKey>(key: K, ...args: TermArgs<K>): string;
}

/**
 * Object returned by {@link useLocalize}.
 */
export interface LocalizeResult {
  /** Look up a translation term by key. */
  readonly term: TermFn;
  /**
   * @deprecated Use `new Intl.DateTimeFormat(lang(), options).format(value)`.
   * Kept for backward compatibility in v1; planned removal in the next major.
   */
  readonly date: (
    value: Date | number,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
  /**
   * @deprecated Use `new Intl.NumberFormat(lang(), options).format(value)`.
   * Kept for backward compatibility in v1; planned removal in the next major.
   */
  readonly number: (
    value: number,
    options?: Intl.NumberFormatOptions,
  ) => string;
  /** Normalized input locale after aliasing. */
  readonly lang: () => string;
  /** Translation locale code currently backing term lookup. */
  readonly translationLang: () => string;
  /**
   * Text direction for this Kumo subtree.
   *
   * Does not mutate `document.documentElement.dir`.
   */
  readonly dir: () => "ltr" | "rtl";
}

export type UnknownLocaleReason = "invalid" | "unsupported";

export interface UnknownLocaleDiagnostic {
  readonly inputLocale: string;
  readonly normalizedLocale: string;
  readonly resolvedTranslationCode: string;
  readonly reason: UnknownLocaleReason;
}

export type UnknownLocaleCallback = (
  diagnostic: UnknownLocaleDiagnostic,
) => void;

const DEFAULT_LOCALE = "en";
const warnedUnknownLocales = new Set<string>();
const warnedFallbackLocales = new Set<string>();

function validateFallbackLocale(inputFallbackLocale: string): {
  readonly effectiveFallbackLocale: string;
  readonly shouldWarn: boolean;
  readonly normalizedInputFallbackLocale: string;
} {
  const normalized = resolveLocale(inputFallbackLocale, {}).effectiveLocale;
  const resolution = resolveTranslation(normalized, {
    fallbackLocale: normalized,
  });

  const isSupported =
    resolution.matchedBy === "exact" || resolution.matchedBy === "prefix";

  if (isSupported) {
    return {
      effectiveFallbackLocale: normalized,
      shouldWarn: false,
      normalizedInputFallbackLocale: normalized,
    };
  }

  return {
    effectiveFallbackLocale: DEFAULT_LOCALE,
    shouldWarn: normalized !== DEFAULT_LOCALE,
    normalizedInputFallbackLocale: normalized,
  };
}

function getTermValue(
  translation: KumoTranslation | undefined,
  key: string,
): unknown {
  if (translation === undefined) return undefined;
  if (!Object.hasOwn(translation, key)) return undefined;
  return Reflect.get(translation, key);
}

function isTermFunction(
  value: unknown,
): value is (...args: readonly unknown[]) => string {
  return typeof value === "function";
}

// ── Context ────────────────────────────────────────────────────────────

/**
 * Context value is the locale override string, or `undefined` when no
 * provider is present (fall through to `useLocale()`).
 */
interface LocaleProviderConfig {
  readonly locale?: string;
  readonly fallbackLocale: string;
  readonly localeAliases: Readonly<Record<string, string>>;
  readonly detectLocale: boolean;
  readonly warnOnUnknownLocale: boolean;
  readonly direction?: Direction;
  readonly onUnknownLocale?: UnknownLocaleCallback;
}

const LocaleConfigContext = createContext<LocaleProviderConfig | undefined>(
  undefined,
);

// ── KumoLocaleProvider ─────────────────────────────────────────────────

interface KumoLocaleProviderProps {
  /** BCP 47 locale code to force for this subtree. */
  readonly locale?: string;
  /** Locale used when no translation is matched (default: "en"). */
  readonly fallbackLocale?: string;
  /** Locale alias mapping applied before translation lookup. */
  readonly localeAliases?: Readonly<Record<string, string>>;
  /** Toggle browser/html locale detection fallback when `locale` is absent. */
  readonly detectLocale?: boolean;
  /** Emit a development warning once per normalized unknown locale. */
  readonly warnOnUnknownLocale?: boolean;
  /**
   * Explicit direction override for this subtree.
   *
   * This does not mutate `document.documentElement.dir`; app shells should
   * sync the document direction separately when needed.
   */
  readonly direction?: Direction;
  /** Callback fired when locale input is invalid or unsupported. */
  readonly onUnknownLocale?: UnknownLocaleCallback;
  readonly children: ReactNode;
}

/**
 * Override locale detection for a subtree.
 *
 * When `locale` is provided, all `useLocalize()` calls within this
 * subtree resolve translations against that locale instead of reading
 * `<html lang>` or `navigator.language`.
 *
 * Nestable — the innermost provider wins.
 */
export function KumoLocaleProvider({
  locale,
  fallbackLocale,
  localeAliases,
  detectLocale,
  warnOnUnknownLocale,
  direction,
  onUnknownLocale,
  children,
}: KumoLocaleProviderProps): ReactNode {
  const parentConfig = useContext(LocaleConfigContext);
  const mergedLocale = locale ?? parentConfig?.locale;
  const mergedDetectLocale = detectLocale ?? parentConfig?.detectLocale ?? true;
  const fallbackInput =
    fallbackLocale ?? parentConfig?.fallbackLocale ?? DEFAULT_LOCALE;
  const fallbackValidation = useMemo(
    () => validateFallbackLocale(fallbackInput),
    [fallbackInput],
  );
  const shouldDetectLocale = mergedLocale === undefined && mergedDetectLocale;
  const detected = useLocale(shouldDetectLocale);

  const value = useMemo<LocaleProviderConfig>(
    () => ({
      locale: mergedLocale,
      fallbackLocale: fallbackValidation.effectiveFallbackLocale,
      localeAliases:
        parentConfig === undefined
          ? (localeAliases ?? {})
          : {
              ...parentConfig.localeAliases,
              ...localeAliases,
            },
      detectLocale: mergedDetectLocale,
      warnOnUnknownLocale:
        warnOnUnknownLocale ?? parentConfig?.warnOnUnknownLocale ?? false,
      direction: direction ?? parentConfig?.direction,
      onUnknownLocale: onUnknownLocale ?? parentConfig?.onUnknownLocale,
    }),
    [
      fallbackLocale,
      fallbackValidation.effectiveFallbackLocale,
      direction,
      locale,
      localeAliases,
      mergedDetectLocale,
      mergedLocale,
      onUnknownLocale,
      parentConfig,
      warnOnUnknownLocale,
    ],
  );

  const providerInputLocale =
    value.locale ?? (!value.detectLocale ? value.fallbackLocale : detected);
  const providerLocaleResolution = useMemo(
    () => resolveLocale(providerInputLocale, value.localeAliases),
    [providerInputLocale, value.localeAliases],
  );
  const providerDirection =
    value.direction ??
    resolveTranslation(providerLocaleResolution.effectiveLocale, {
      fallbackLocale: value.fallbackLocale,
    }).translation?.$dir ??
    "ltr";

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (!fallbackValidation.shouldWarn) return;

    const warnKey = fallbackValidation.normalizedInputFallbackLocale;
    if (warnedFallbackLocales.has(warnKey)) return;

    warnedFallbackLocales.add(warnKey);
    console.warn(
      `[kumo] Unknown fallbackLocale '${fallbackInput}'; using '${DEFAULT_LOCALE}'.`,
    );
  }, [
    fallbackInput,
    fallbackValidation.normalizedInputFallbackLocale,
    fallbackValidation.shouldWarn,
  ]);

  return (
    <LocaleConfigContext.Provider value={value}>
      <DirectionProvider direction={providerDirection}>
        {children}
      </DirectionProvider>
    </LocaleConfigContext.Provider>
  );
}
KumoLocaleProvider.displayName = "KumoLocaleProvider";

// ── useLocalize ────────────────────────────────────────────────────────

/**
 * React hook providing localized term lookup and Intl formatting.
 *
 * **Locale resolution order:**
 * 1. Nearest `KumoLocaleProvider` `locale` prop
 * 2. `<html lang>` attribute (reactive via `MutationObserver`)
 * 3. `navigator.language`
 * 4. `"en"`
 *
 * @example
 * ```tsx
 * const { term, date, number } = useLocalize();
 * return <p>{term('showing-range', 1, 10, 100)}</p>;
 * ```
 */
export function useLocalize(): LocalizeResult {
  const config = useContext(LocaleConfigContext);
  const shouldDetectLocale =
    config?.locale === undefined && config?.detectLocale !== false;
  const detected = useLocale(shouldDetectLocale);
  const fallbackLocale = config?.fallbackLocale ?? DEFAULT_LOCALE;
  const inputLocale =
    config?.locale ??
    (config?.detectLocale === false ? fallbackLocale : detected);
  const localeAliases = config?.localeAliases ?? {};
  const localeResolution = useMemo(
    () => resolveLocale(inputLocale, localeAliases),
    [inputLocale, localeAliases],
  );
  const resolvedLocale = localeResolution.effectiveLocale;
  const resolution = useMemo(
    () => resolveTranslation(resolvedLocale, { fallbackLocale }),
    [fallbackLocale, resolvedLocale],
  );

  const unknownLocaleDiagnostic = useMemo<
    UnknownLocaleDiagnostic | undefined
  >(() => {
    const resolvedTranslationCode =
      resolution.translation?.$code ?? fallbackLocale;

    if (localeResolution.isInvalid) {
      return {
        inputLocale: localeResolution.inputLocale,
        normalizedLocale: localeResolution.normalizedLocale,
        resolvedTranslationCode,
        reason: "invalid",
      };
    }

    if (resolution.matchedBy === "fallback") {
      return {
        inputLocale: localeResolution.inputLocale,
        normalizedLocale: resolvedLocale,
        resolvedTranslationCode,
        reason: "unsupported",
      };
    }

    return undefined;
  }, [
    localeResolution.inputLocale,
    localeResolution.isInvalid,
    localeResolution.normalizedLocale,
    fallbackLocale,
    resolution.matchedBy,
    resolution.translation,
    resolvedLocale,
  ]);

  const lastUnknownLocaleCallbackKeyRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (unknownLocaleDiagnostic === undefined) {
      lastUnknownLocaleCallbackKeyRef.current = undefined;
      return;
    }

    const callbackKey = `${unknownLocaleDiagnostic.reason}|${unknownLocaleDiagnostic.inputLocale}|${unknownLocaleDiagnostic.normalizedLocale}|${unknownLocaleDiagnostic.resolvedTranslationCode}`;

    if (config?.onUnknownLocale !== undefined) {
      if (lastUnknownLocaleCallbackKeyRef.current !== callbackKey) {
        config.onUnknownLocale(unknownLocaleDiagnostic);
      }
    }

    lastUnknownLocaleCallbackKeyRef.current = callbackKey;

    if (config?.warnOnUnknownLocale !== true) return;

    const warnedKey = unknownLocaleDiagnostic.normalizedLocale;
    if (warnedUnknownLocales.has(warnedKey)) return;

    warnedUnknownLocales.add(warnedKey);
    console.warn(
      `[kumo] Unknown locale '${unknownLocaleDiagnostic.inputLocale}' (${unknownLocaleDiagnostic.reason}); using '${unknownLocaleDiagnostic.resolvedTranslationCode}'.`,
    );
  }, [
    config?.onUnknownLocale,
    config?.warnOnUnknownLocale,
    unknownLocaleDiagnostic,
  ]);

  return useMemo(() => {
    const translation = resolution.translation;
    const fallbackResolution = resolveTranslation(fallbackLocale, {
      fallbackLocale,
    });
    const fallbackTranslation = fallbackResolution.translation ?? translation;
    const translationLocaleCode =
      translation?.$code ?? fallbackTranslation?.$code ?? fallbackLocale;

    function term(key: SimpleKey): string;
    function term<K extends ParameterizedKey>(
      key: K,
      ...args: TermArgs<K>
    ): string;
    function term(
      key: SimpleKey | ParameterizedKey,
      ...args: readonly unknown[]
    ): string {
      const keyName = String(key);
      const value =
        getTermValue(translation, keyName) ??
        getTermValue(fallbackTranslation, keyName);
      if (isTermFunction(value)) {
        return value(...args);
      }
      return typeof value === "string" ? value : keyName;
    }

    const date = (
      value: Date | number,
      options?: Intl.DateTimeFormatOptions,
    ): string => new Intl.DateTimeFormat(resolvedLocale, options).format(value);

    const number = (
      value: number,
      options?: Intl.NumberFormatOptions,
    ): string => new Intl.NumberFormat(resolvedLocale, options).format(value);

    const lang = (): string => resolvedLocale;

    const translationLang = (): string => translationLocaleCode;

    const dir = (): "ltr" | "rtl" =>
      config?.direction ?? translation?.$dir ?? "ltr";

    return { term, date, number, lang, translationLang, dir };
  }, [
    config?.direction,
    fallbackLocale,
    resolution.translation,
    resolvedLocale,
  ]);
}

// Test helper: reset warn-once cache.
// Only intended for test suites.
export function _resetUnknownLocaleWarnings(): void {
  warnedUnknownLocales.clear();
  warnedFallbackLocales.clear();
}
