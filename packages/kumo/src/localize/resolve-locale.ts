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
  const entries: Array<readonly [string, string]> = Object.entries(aliases).map(
    ([source, target]) => [normalizeLocale(source), normalizeLocale(target)],
  );
  return new Map(entries);
}

function findAliasTarget(
  locale: string,
  aliases: ReadonlyMap<string, string>,
): string | undefined {
  for (const candidate of aliasCandidates(locale)) {
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
  const normalization = normalizeWithValidity(inputLocale);
  const normalizedAliases = normalizeAliases(aliases);
  const effectiveLocale = resolveAliasedLocale(
    normalization.normalizedLocale,
    normalizedAliases,
  );

  return {
    inputLocale,
    normalizedLocale: normalization.normalizedLocale,
    effectiveLocale,
    isInvalid: normalization.isInvalid,
  };
}
