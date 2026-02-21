import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const distStylesDir = join(__dirname, "../../dist/styles");
const isBuilt = existsSync(join(distStylesDir, "kumo-standalone.css"));

/**
 * CSS Class Contract Test
 *
 * Asserts that all public CSS classes defined in kumo-binding.css survive
 * the Tailwind compilation and appear in the built output. This prevents
 * accidental removal of classes that downstream consumers depend on.
 *
 * The manifest below is the source of truth for public CSS class names.
 * When adding a new public class to kumo-binding.css, add it here.
 * When removing one, remove it here AND bump the package minor version.
 */

/**
 * Public CSS classes from kumo-binding.css and kumo.css that consumers
 * may reference directly. Each entry documents which component uses it.
 *
 * To add a class:
 *   1. Define it in kumo-binding.css (or kumo.css)
 *   2. Append an entry to this array with className, source, and usedBy
 *   3. Run: pnpm --filter @cloudflare/kumo build && pnpm --filter @cloudflare/kumo test -- tests/css-contract
 *
 * To remove a class:
 *   1. Remove the entry from this array
 *   2. Remove the class definition from source CSS
 *   3. Create a changeset (`pnpm changeset`) with a major version bump
 *      — removing a public class is a breaking change for consumers
 */
const CSS_CLASS_MANIFEST: ReadonlyArray<{
  readonly className: string;
  readonly source: "kumo-binding" | "kumo";
  readonly usedBy: string;
}> = [
  {
    className: "no-scrollbar",
    source: "kumo-binding",
    usedBy: "Utility: hide scrollbar while preserving scroll behavior",
  },
  {
    className: "no-input-spinner",
    source: "kumo-binding",
    usedBy: "NumberInput: hides native number input arrows",
  },
  {
    className: "link-current",
    source: "kumo-binding",
    usedBy: "Link: current page variant decoration",
  },
  {
    className: "link-external-icon",
    source: "kumo-binding",
    usedBy: "Link: external icon stroke width adjustment",
  },
  {
    className: "skeleton-line",
    source: "kumo-binding",
    usedBy: "Skeleton: loading placeholder line with shimmer animation",
  },
  {
    className: "animate-bounce-in",
    source: "kumo-binding",
    usedBy: "Animation: scale bounce-in effect",
  },
  {
    className: "float",
    source: "kumo-binding",
    usedBy: "Animation: gentle floating translate effect",
  },
  {
    className: "kumo-tooltip-popup",
    source: "kumo-binding",
    usedBy: "Tooltip: dark mode outline-offset adjustment",
  },
  {
    className: "kumo-popover-popup",
    source: "kumo-binding",
    usedBy: "Popover: dark mode outline-offset adjustment",
  },
] as const;

/**
 * Build a regex that matches a CSS class selector in a stylesheet.
 * Handles: `.className`, `.className:pseudo`, `.className::pseudo`,
 * `.className.other`, `[selector] .className`, etc.
 *
 * Does NOT match partial names — e.g. searching for "float" won't
 * match ".floating" because we require a word boundary after the name.
 */
function classExistsInCss(css: string, className: string): boolean {
  // Escape regex special characters in class name
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match .className followed by non-word-char (whitespace, {, :, ., comma, etc.) or end of string
  const pattern = new RegExp(`\\.${escaped}(?=[\\s{:.,>+~)\\[\\]]|$)`, "m");
  return pattern.test(css);
}

describe.skipIf(!isBuilt)("CSS Class Contract (Post-Build)", () => {
  // Also verify the raw copies exist
  const rawFiles = ["kumo.css", "kumo-binding.css"] as const;

  describe("dist/styles/ contains raw CSS copies", () => {
    for (const file of rawFiles) {
      it(`should include ${file}`, () => {
        const filePath = join(distStylesDir, file);
        expect(
          existsSync(filePath),
          `Expected ${file} in dist/styles/ — css-build.ts should copy it`,
        ).toBe(true);
      });
    }
  });

  describe("public CSS classes exist in compiled output", () => {
    // Load standalone CSS once for all assertions
    const standaloneCSS = isBuilt
      ? readFileSync(join(distStylesDir, "kumo-standalone.css"), "utf-8")
      : "";

    for (const entry of CSS_CLASS_MANIFEST) {
      it(`should contain .${entry.className} (${entry.usedBy})`, () => {
        const found = classExistsInCss(standaloneCSS, entry.className);
        if (!found) {
          // Provide actionable error message
          console.error(
            `\n  Missing CSS class: .${entry.className}`,
            `\n  Source file:       ${entry.source}.css`,
            `\n  Used by:           ${entry.usedBy}`,
            `\n`,
            `\n  If this class was intentionally removed:`,
            `\n    1. Remove it from CSS_CLASS_MANIFEST in this test`,
            `\n    2. Create a changeset with a major version bump (breaking change)`,
            `\n  If this is unexpected:`,
            `\n    Check that ${entry.source}.css still defines .${entry.className}`,
          );
        }
        expect(found).toBe(true);
      });
    }
  });

  describe("manifest completeness", () => {
    it("should cover all non-prefixed utility classes in kumo-binding.css", () => {
      // Read the source kumo-binding.css and extract class selectors
      const bindingSrc = readFileSync(
        join(__dirname, "../../src/styles/kumo-binding.css"),
        "utf-8",
      );

      // Match class selectors, excluding:
      // - Tailwind @layer internal classes
      // - Data-attribute scoped variants (e.g. [data-mode="dark"] .class)
      // We want top-level class definitions only
      const classPattern = /(?:^|\s)\.([a-zA-Z][a-zA-Z0-9_-]*)\b/gm;
      const foundClasses = new Set<string>();
      let match: RegExpExecArray | null;

      while ((match = classPattern.exec(bindingSrc)) !== null) {
        const cls = match[1];
        // Skip pseudo-element artifacts and Tailwind internals
        if (cls.startsWith("rdp-")) continue;
        foundClasses.add(cls);
      }

      const manifestClassNames = new Set(
        CSS_CLASS_MANIFEST.filter((e) => e.source === "kumo-binding").map(
          (e) => e.className,
        ),
      );

      const undocumented = [...foundClasses].filter(
        (cls) => !manifestClassNames.has(cls),
      );

      if (undocumented.length > 0) {
        console.error(
          `\n  Classes in kumo-binding.css not in manifest:`,
          `\n    ${undocumented.join(", ")}`,
          `\n`,
          `\n  If these are public: add them to CSS_CLASS_MANIFEST`,
          `\n  If these are internal: this check may need updating`,
        );
      }

      expect(
        undocumented,
        "All non-internal classes in kumo-binding.css should be in the manifest",
      ).toEqual([]);
    });
  });
});
