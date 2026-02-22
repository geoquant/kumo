/**
 * Post-build verification for UMD loadable CSS output.
 *
 * Validates that `pnpm build:loadable` produces a style.css file containing
 * kumo's standalone CSS -- semantic tokens, Tailwind layers, dark mode support,
 * and component utilities. The host page loads this single file and needs no
 * Tailwind build step.
 *
 * These tests read from `dist/loadable/` so they require `pnpm build:loadable`
 * to have been run first. Tests skip gracefully if the build output is missing.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const DIST_DIR = resolve(__dirname, "../../dist/loadable");
const CSS_PATH = resolve(DIST_DIR, "style.css");
const JS_PATH = resolve(DIST_DIR, "kumo-loadable.umd.js");

const isBuilt = existsSync(CSS_PATH) && existsSync(JS_PATH);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Count occurrences of a substring in text.
 * Works on minified single-line CSS where line-based tools fail.
 */
function countOccurrences(text: string, substring: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(substring, pos)) !== -1) {
    count++;
    pos += substring.length;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!isBuilt)("loadable CSS output", () => {
  let css: string;

  // Read once, reuse across tests
  beforeAll(() => {
    css = readFileSync(CSS_PATH, "utf-8");
  });

  it("style.css exists and is non-trivial (>30KB)", () => {
    // kumo standalone CSS with Tailwind utilities should be substantial
    expect(css.length).toBeGreaterThan(30_000);
  });

  it("contains all Tailwind @layer declarations", () => {
    // Tailwind v4 emits these layers in order
    for (const layer of ["properties", "theme", "base", "utilities"]) {
      expect(css).toContain(`@layer ${layer}`);
    }
  });

  it("contains kumo semantic color tokens", () => {
    // Core surface tokens
    const surfaceTokens = ["kumo-base", "kumo-elevated"];
    for (const token of surfaceTokens) {
      expect(css.includes(token), `Missing surface token: ${token}`).toBe(true);
    }

    // Core text/interaction tokens
    const interactionTokens = [
      "kumo-default",
      "kumo-brand",
      "kumo-danger",
      "kumo-ring",
    ];
    for (const token of interactionTokens) {
      expect(css.includes(token), `Missing interaction token: ${token}`).toBe(
        true,
      );
    }
  });

  it("contains light-dark() for automatic dark mode", () => {
    // kumo tokens use CSS light-dark() -- no manual dark: prefix needed
    const count = countOccurrences(css, "light-dark");
    // Theme has 30+ token definitions, each using light-dark()
    expect(count).toBeGreaterThanOrEqual(20);
  });

  it("contains data-mode selectors for dark mode switching", () => {
    // ThemeWrapper sets data-mode="light"|"dark" -- CSS must respond
    expect(css).toContain("data-mode");
    const count = countOccurrences(css, "data-mode");
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it("contains color-scheme declarations", () => {
    // Required for native dark mode support (scrollbars, form controls)
    expect(css).toContain("color-scheme");
  });

  it("contains compiled Tailwind utility classes", () => {
    // These are the utilities actually used by kumo components
    // They must be compiled into the CSS (not left as @apply directives)
    const utilities = ["flex", "gap-", "rounded", "px-", "py-"];
    for (const util of utilities) {
      expect(css.includes(util), `Missing compiled utility: ${util}`).toBe(
        true,
      );
    }
  });

  it("does not contain unprocessed Tailwind directives", () => {
    // If these appear in output, Tailwind plugin failed to process them
    expect(css).not.toContain("@tailwind");
    expect(css).not.toContain("@apply ");
  });
});

describe.skipIf(!isBuilt)("loadable JS output", () => {
  let js: string;

  beforeAll(() => {
    js = readFileSync(JS_PATH, "utf-8");
  });

  it("kumo-loadable.umd.js exists and is non-trivial (>100KB)", () => {
    // UMD bundle with React + kumo renderer should be substantial
    expect(js.length).toBeGreaterThan(100_000);
  });

  it("exposes CloudflareKumo as UMD global name", () => {
    // Vite UMD output registers the library under this name
    expect(js).toContain("CloudflareKumo");
  });

  it("bundles React (not externalized)", () => {
    // React must be bundled for cross-boundary use (host has no React)
    // Check for React internals that would only be present if bundled
    expect(js).toContain("createElement");
    expect(js).toContain("useState");
  });
});
