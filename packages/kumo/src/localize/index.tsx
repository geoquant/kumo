import { createContext, useContext, useMemo, type ReactNode } from "react";

import { getTranslation } from "./registry.js";
import type { KumoTranslation } from "./types.js";
import { useLocale } from "./use-locale.js";

// Side-effect: eagerly register all 12 built-in translations.
import "../translations/index.js";

// Re-exports for public API
export { registerTranslation } from "./registry.js";
export type { KumoTranslation } from "./types.js";

// ── Types ──────────────────────────────────────────────────────────────

/**
 * Translation keys whose value is a string (not a function).
 */
type SimpleKey = {
  [K in keyof KumoTranslation]: KumoTranslation[K] extends string ? K : never;
}[keyof KumoTranslation];

/**
 * Translation keys whose value is a function returning a string.
 *
 * Uses negation of `string` rather than direct function matching to avoid
 * contravariance issues with function parameter types.
 */
type ParameterizedKey = {
  [K in keyof KumoTranslation]: KumoTranslation[K] extends string ? never : K;
}[keyof KumoTranslation];

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
  /** Format a date using the resolved locale. */
  readonly date: (
    value: Date | number,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
  /** Format a number using the resolved locale. */
  readonly number: (
    value: number,
    options?: Intl.NumberFormatOptions,
  ) => string;
  /** Resolved BCP 47 locale code. */
  readonly lang: () => string;
  /** Text direction from the resolved translation. */
  readonly dir: () => "ltr" | "rtl";
}

// ── Context ────────────────────────────────────────────────────────────

/**
 * Context value is the locale override string, or `undefined` when no
 * provider is present (fall through to `useLocale()`).
 */
const LocaleOverrideContext = createContext<string | undefined>(undefined);

// ── KumoLocaleProvider ─────────────────────────────────────────────────

interface KumoLocaleProviderProps {
  /** BCP 47 locale code to force for this subtree. */
  readonly locale?: string;
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
  children,
}: KumoLocaleProviderProps): ReactNode {
  return (
    <LocaleOverrideContext.Provider value={locale}>
      {children}
    </LocaleOverrideContext.Provider>
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
 * return <p>{term('showingRange', 1, 10, 100)}</p>;
 * ```
 */
export function useLocalize(): LocalizeResult {
  const override = useContext(LocaleOverrideContext);
  const detected = useLocale();
  const resolvedLocale = override ?? detected;

  return useMemo(() => {
    const translation = getTranslation(resolvedLocale);

    const term: TermFn = ((key: string, ...args: readonly unknown[]) => {
      if (translation === undefined) return key;
      const value = translation[key as keyof KumoTranslation];
      if (typeof value === "function") {
        return (value as (...a: readonly unknown[]) => string)(...args);
      }
      return typeof value === "string" ? value : key;
    }) as TermFn;

    const date = (
      value: Date | number,
      options?: Intl.DateTimeFormatOptions,
    ): string => new Intl.DateTimeFormat(resolvedLocale, options).format(value);

    const number = (
      value: number,
      options?: Intl.NumberFormatOptions,
    ): string => new Intl.NumberFormat(resolvedLocale, options).format(value);

    const lang = (): string => resolvedLocale;

    const dir = (): "ltr" | "rtl" => translation?.$dir ?? "ltr";

    return { term, date, number, lang, dir };
  }, [resolvedLocale]);
}
