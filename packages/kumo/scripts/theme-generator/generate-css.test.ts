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
  it("emits kumo theme aliases with explicit mode resolution", () => {
    const css = generateKumoThemeCSS(THEME_CONFIG);

    expect(css).toContain(
      "--text-color-kumo-default: var(--_text-color-kumo-default);",
    );
    expect(css).toContain("--color-kumo-surface: var(--_color-kumo-surface);");
    expect(css).toContain("@layer base {");
    expect(css).toContain(':root, [data-theme="kumo"] {');
    expect(css).toContain("@media (prefers-color-scheme: dark) {");
    expect(css).toContain(':root:not([data-mode]), [data-theme="kumo"] {');
    expect(css).toContain(
      "--_text-color-kumo-default-light: var(--color-neutral-900, oklch(21% 0.006 285.885));",
    );
    expect(css).toContain(
      "--_text-color-kumo-default-dark: var(--color-neutral-100, oklch(97% 0 0));",
    );
    expect(css).toContain(
      '[data-mode="light"]:not([data-theme]), [data-mode="light"] [data-theme="kumo"], [data-theme="kumo"][data-mode="light"] {',
    );
    expect(css).toContain(
      '[data-mode="dark"]:not([data-theme]), [data-mode="dark"] [data-theme="kumo"], [data-theme="kumo"][data-mode="dark"] {',
    );
    expect(css).not.toContain(':root[data-mode="light"]');
    expect(css).not.toContain(':root[data-mode="dark"]');
    expect(css).not.toContain('[data-theme="kumo"] [data-mode="light"]');
    expect(css).not.toContain('[data-theme="kumo"] [data-mode="dark"]');
    expect(css).not.toContain("--text-color-kumo-default: light-dark(");
    expect(css).not.toContain("--color-kumo-surface: light-dark(");
    expect(css).toContain(
      "--_color-kumo-surface: var(--_color-kumo-surface-light);",
    );
  });

  it("emits override theme runtime fallbacks in base layers only", () => {
    const css = generateThemeOverrideCSS(THEME_CONFIG, "fedramp");

    expect(countOccurrences(css, "@layer base {")).toBe(1);
    expect(css).toContain('[data-theme="fedramp"] {');
    expect(css).toContain("@media (prefers-color-scheme: dark) {");
    expect(css).toContain(
      '  [data-mode="light"] [data-theme="fedramp"], [data-theme="fedramp"][data-mode="light"] {',
    );
    expect(css).toContain(
      '  [data-mode="dark"] [data-theme="fedramp"], [data-theme="fedramp"][data-mode="dark"] {',
    );
    expect(css).not.toContain('[data-theme="fedramp"] [data-mode="light"]');
    expect(css).not.toContain('[data-theme="fedramp"] [data-mode="dark"]');
    expect(css).not.toMatch(/\n\[data-theme="fedramp"\] \{/);
    expect(css).not.toContain("--color-kumo-surface: light-dark(");
    expect(css).toContain("--_color-kumo-surface-light: #5b697c;");
    expect(css).toContain("--_color-kumo-surface-dark: #5b697c;");
  });

  it("covers the unset, explicit light, and explicit dark mode matrix", () => {
    const kumoCss = generateKumoThemeCSS(THEME_CONFIG);
    const fedrampCss = generateThemeOverrideCSS(THEME_CONFIG, "fedramp");

    expect(
      countOccurrences(kumoCss, "@media (prefers-color-scheme: dark) {"),
    ).toBe(1);
    expect(kumoCss).toMatch(
      /:root, \[data-theme="kumo"\] \{[\s\S]*?--_color-kumo-surface-light: var\(--color-kumo-neutral-25, oklch\(99% 0 0\)\);[\s\S]*?--_color-kumo-surface: var\(--_color-kumo-surface-light\);/,
    );
    expect(kumoCss).toMatch(
      /:root:not\(\[data-mode\]\), \[data-theme="kumo"\] \{[\s\S]*?--_text-color-kumo-default: var\(--_text-color-kumo-default-dark\);/,
    );
    expect(kumoCss).toMatch(
      /\[data-mode="light"\]:not\(\[data-theme\]\), \[data-mode="light"\] \[data-theme="kumo"\], \[data-theme="kumo"\]\[data-mode="light"\] \{[\s\S]*?--_color-kumo-surface: var\(--_color-kumo-surface-light\);/,
    );
    expect(kumoCss).toMatch(
      /\[data-mode="dark"\]:not\(\[data-theme\]\), \[data-mode="dark"\] \[data-theme="kumo"\], \[data-theme="kumo"\]\[data-mode="dark"\] \{[\s\S]*?--_color-kumo-surface: var\(--_color-kumo-surface-dark\);/,
    );

    expect(
      countOccurrences(fedrampCss, "@media (prefers-color-scheme: dark) {"),
    ).toBe(1);
    expect(fedrampCss).toMatch(
      /\[data-theme="fedramp"\] \{[\s\S]*?--_color-kumo-surface-light: #5b697c;[\s\S]*?--_color-kumo-surface: var\(--_color-kumo-surface-light\);/,
    );
    expect(fedrampCss).toMatch(
      /@media \(prefers-color-scheme: dark\) \{[\s\S]*?\[data-theme="fedramp"\] \{[\s\S]*?--_color-kumo-surface: var\(--_color-kumo-surface-dark\);/,
    );
    expect(fedrampCss).toMatch(
      /\[data-mode="light"\] \[data-theme="fedramp"\], \[data-theme="fedramp"\]\[data-mode="light"\] \{[\s\S]*?--_color-kumo-surface: var\(--_color-kumo-surface-light\);/,
    );
    expect(fedrampCss).toMatch(
      /\[data-mode="dark"\] \[data-theme="fedramp"\], \[data-theme="fedramp"\]\[data-mode="dark"\] \{[\s\S]*?--_color-kumo-surface: var\(--_color-kumo-surface-dark\);/,
    );

    expect(kumoCss).not.toContain("light-dark(");
    expect(fedrampCss).not.toContain("light-dark(");
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
