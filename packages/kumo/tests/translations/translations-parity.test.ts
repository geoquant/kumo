import { describe, expect, it } from "vitest";

const OPTIONAL_KEYS = new Set<string>(["cloudflare-logo"]);

function isStringRecord(
  value: unknown,
): value is Readonly<Record<string, string>> {
  if (typeof value !== "object" || value === null) return false;

  for (const entryValue of Object.values(value)) {
    if (typeof entryValue !== "string") {
      return false;
    }
  }

  return true;
}

function getFileName(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1] ?? path;
}

function getPlaceholderTokens(template: string): readonly string[] {
  const tokens = new Set<string>();
  const tokenPattern = /\{([^{}]+)\}/g;

  for (const match of template.matchAll(tokenPattern)) {
    const token = match[1]?.trim();
    if (token) {
      tokens.add(token);
    }
  }

  return Array.from(tokens).sort();
}

describe("translation JSON parity", () => {
  const translationModules = import.meta.glob<{ default: unknown }>(
    "../../src/translations/*.json",
    { eager: true },
  );

  const translations: Array<{
    fileName: string;
    values: Readonly<Record<string, string>>;
  }> = [];

  for (const [path, module] of Object.entries(translationModules)) {
    const fileName = getFileName(path);
    if (!isStringRecord(module.default)) {
      throw new Error(
        `${fileName} must export a string-only translation object`,
      );
    }

    translations.push({
      fileName,
      values: module.default,
    });
  }

  const englishTranslation = translations.find(
    (translation) => translation.fileName === "en.json",
  );

  if (englishTranslation === undefined) {
    throw new Error("en.json translation source not found");
  }

  const requiredEnglishKeys = Object.keys(englishTranslation.values)
    .filter((key) => !OPTIONAL_KEYS.has(key))
    .sort();

  for (const translation of translations) {
    if (translation.fileName === "en.json") continue;

    it(`${translation.fileName} has all required keys from en.json`, () => {
      const localeKeys = Object.keys(translation.values).sort();

      for (const key of requiredEnglishKeys) {
        expect(
          localeKeys,
          `${translation.fileName} missing required key '${key}'`,
        ).toContain(key);
      }
    });

    it(`${translation.fileName} preserves placeholder token names`, () => {
      for (const key of requiredEnglishKeys) {
        const englishValue = englishTranslation.values[key];
        const localeValue = translation.values[key];

        const englishTokens = getPlaceholderTokens(englishValue);
        const localeTokens = getPlaceholderTokens(localeValue);

        expect(
          localeTokens,
          `${translation.fileName} key '${key}' placeholder mismatch`,
        ).toEqual(englishTokens);
      }
    });
  }
});
