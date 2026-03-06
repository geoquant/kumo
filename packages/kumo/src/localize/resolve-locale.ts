const DEFAULT_LOCALE = "en";
const MAX_ALIAS_STEPS = 8;

export interface LocaleResolutionResult {
  readonly inputLocale: string;
  readonly normalizedLocale: string;
  readonly effectiveLocale: string;
  readonly isInvalid: boolean;
}

function normalizeLocale(locale: string): string {
  const normalizedSeparators = locale.replaceAll("_", "-").trim();
  if (normalizedSeparators === "") return DEFAULT_LOCALE;

  try {
    const canonical = Intl.getCanonicalLocales(normalizedSeparators)[0];
    return canonical ?? DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

function normalizeAliasToken(locale: string): string {
  return locale.replaceAll("_", "-").trim().toLowerCase();
}

function normalizeWithValidity(locale: string): {
  readonly normalizedLocale: string;
  readonly isInvalid: boolean;
} {
  const normalizedSeparators = locale.replaceAll("_", "-").trim();
  if (normalizedSeparators === "") {
    return { normalizedLocale: DEFAULT_LOCALE, isInvalid: true };
  }

  try {
    const canonical = Intl.getCanonicalLocales(normalizedSeparators)[0];
    return {
      normalizedLocale: canonical ?? DEFAULT_LOCALE,
      isInvalid: canonical === undefined,
    };
  } catch {
    return { normalizedLocale: DEFAULT_LOCALE, isInvalid: true };
  }
}

function aliasCandidates(locale: string): readonly string[] {
  const segments = locale.split("-");
  const candidates: string[] = [];

  for (let i = segments.length; i > 0; i -= 1) {
    candidates.push(segments.slice(0, i).join("-"));
  }

  return candidates;
}

function normalizeAliases(
  aliases: Readonly<Record<string, string>>,
): ReadonlyMap<string, string> {
  const entries: Array<readonly [string, string]> = [];

  for (const [source, target] of Object.entries(aliases)) {
    const normalizedSource = normalizeAliasToken(source);
    if (normalizedSource === "") continue;
    entries.push([normalizedSource, normalizeLocale(target)]);
  }

  return new Map(entries);
}

function findAliasTarget(
  locale: string,
  aliases: ReadonlyMap<string, string>,
): string | undefined {
  for (const candidate of aliasCandidates(normalizeAliasToken(locale))) {
    const target = aliases.get(candidate);
    if (target !== undefined) return target;
  }

  return undefined;
}

function resolveAliasedLocale(
  locale: string,
  aliases: ReadonlyMap<string, string>,
): string {
  const seen = new Set<string>();
  let current = locale;

  for (let step = 0; step < MAX_ALIAS_STEPS; step += 1) {
    if (seen.has(current)) return current;
    seen.add(current);

    const target = findAliasTarget(current, aliases);
    if (target === undefined) return current;
    current = target;
  }

  return current;
}

export function resolveLocale(
  inputLocale: string,
  aliases: Readonly<Record<string, string>>,
): LocaleResolutionResult {
  // Alias order is deterministic:
  // 1) case-insensitive alias matching (most-specific to broad)
  // 2) canonical locale validation
  // 3) translation lookup (performed by registry resolver)
  const normalizedAliases = normalizeAliases(aliases);
  const aliasedLocale = resolveAliasedLocale(inputLocale, normalizedAliases);
  const normalization = normalizeWithValidity(aliasedLocale);

  return {
    inputLocale,
    normalizedLocale: normalization.normalizedLocale,
    effectiveLocale: normalization.normalizedLocale,
    isInvalid: normalization.isInvalid,
  };
}
