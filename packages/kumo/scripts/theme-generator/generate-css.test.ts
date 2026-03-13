import { describe, expect, it } from "vitest";
import { THEME_CONFIG } from "./config";
import {
  generateKumoThemeCSS,
  generateThemeMetadata,
  generateThemeOverrideCSS,
} from "./generate-css";

function countOccurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

describe("theme css generator", () => {
  it("emits kumo runtime fallback selectors inside base layer", () => {
    const css = generateKumoThemeCSS(THEME_CONFIG);

    expect(css).toContain("@layer base {");
    expect(css).toContain(':root, [data-theme="kumo"] {');
    expect(css).toContain(
      ':root[data-mode="dark"], [data-mode="dark"]:not([data-theme]), [data-mode="dark"] [data-theme="kumo"], [data-theme="kumo"][data-mode="dark"], [data-theme="kumo"] [data-mode="dark"] {',
    );
  });

  it("emits override theme runtime fallbacks in base layers only", () => {
    const css = generateThemeOverrideCSS(THEME_CONFIG, "fedramp");

    expect(countOccurrences(css, "@layer base {")).toBe(2);
    expect(css).toContain('  [data-theme="fedramp"] {');
    expect(css).toContain(
      '  [data-mode="dark"] [data-theme="fedramp"], [data-theme="fedramp"][data-mode="dark"], [data-theme="fedramp"] [data-mode="dark"] {',
    );
    expect(css).not.toMatch(/\n\[data-theme="fedramp"\] \{/);
  });

  it("builds exportable theme metadata from config", () => {
    const metadata = generateThemeMetadata(THEME_CONFIG);

    expect(metadata.themes).toEqual(["kumo", "fedramp"]);
    expect(metadata.tokens.length).toBe(
      Object.keys(THEME_CONFIG.text).length +
        Object.keys(THEME_CONFIG.color).length +
        Object.keys(THEME_CONFIG.typography ?? {}).length,
    );
    expect(metadata.tokens[0]).toMatchObject({
      defaultTheme: "kumo",
    });
    expect(metadata.tokens).toContainEqual(
      expect.objectContaining({
        name: "kumo-default",
        cssVariable: "--text-color-kumo-default",
        tailwindUtilityFamily: "text",
        kind: "text",
      }),
    );
    expect(metadata.tokens).toContainEqual(
      expect.objectContaining({
        name: "kumo-base",
        cssVariable: "--color-kumo-base",
        tailwindUtilityFamily: "bg-border-ring",
        kind: "color",
      }),
    );
    expect(metadata.tokens).toContainEqual(
      expect.objectContaining({
        name: "base",
        cssVariable: "--text-base",
        tailwindUtilityFamily: "typography",
        kind: "typography",
      }),
    );
  });
});
