import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, dirname, relative } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const distDir = join(__dirname, "../../dist");
const isBuilt = existsSync(join(distDir, "index.js"));

/**
 * Browser Compatibility Post-Build Test
 *
 * Scans all JS files in dist/ for APIs that are too new for our browser
 * support target (ES2022). This catches cases where source code uses
 * ES2023+ APIs that esbuild/Vite won't downlevel (they're runtime APIs,
 * not syntax).
 *
 * The build target (es2022 in vite.config.ts) handles syntax downleveling,
 * but runtime APIs like Array.prototype.toSorted() are NOT polyfilled or
 * transformed by the build — they'll throw at runtime in older browsers.
 *
 * To add a new banned API:
 *   1. Add an entry to BANNED_APIS below
 *   2. Run `pnpm --filter @cloudflare/kumo build && pnpm --filter @cloudflare/kumo test -- tests/build`
 *
 * If a banned API is intentionally needed:
 *   1. Add it to KNOWN_EXCEPTIONS with the file and justification
 *   2. Ensure a runtime guard or polyfill is in place
 */

interface BannedAPI {
  /** Human-readable name of the API */
  readonly name: string;
  /**
   * Regex pattern to match the API usage in built JS.
   * Must be crafted to avoid false positives in minified code.
   */
  readonly pattern: RegExp;
  /** ES version that introduced this API */
  readonly since: string;
}

/**
 * APIs banned from dist output. Each pattern is tested against every line
 * of every JS file in dist/. Patterns should match the minified form —
 * esbuild preserves method names but may remove whitespace.
 *
 * This list is NOT exhaustive — it covers the most commonly encountered
 * ES2023+ runtime APIs. Notable omissions: Object.groupBy, Map.groupBy,
 * Promise.withResolvers, Set.prototype.{difference,intersection,union}.
 * Extend as needed when new APIs are encountered in the wild.
 */
const BANNED_APIS: readonly BannedAPI[] = [
  // ES2023 Array methods (immutable alternatives)
  {
    name: "Array.prototype.toSorted()",
    pattern: /\.toSorted\(/,
    since: "ES2023",
  },
  {
    name: "Array.prototype.toReversed()",
    pattern: /\.toReversed\(/,
    since: "ES2023",
  },
  {
    name: "Array.prototype.toSpliced()",
    pattern: /\.toSpliced\(/,
    since: "ES2023",
  },
  {
    name: "Array.prototype.findLast()",
    pattern: /\.findLast\(/,
    since: "ES2023",
  },
  {
    name: "Array.prototype.findLastIndex()",
    pattern: /\.findLastIndex\(/,
    since: "ES2023",
  },
  // ES2023 Array.prototype.with() — immutable index replacement
  // Match `.with(` preceded by ] or ) or word char (likely array/call context)
  // but NOT "startsWith(", "endsWith(", "replaceWith(" etc.
  {
    name: "Array.prototype.with()",
    pattern: /(?:[\])]|\w)\.with\(\s*\d/,
    since: "ES2023",
  },
  // Web platform globals not available in older browsers
  {
    name: "structuredClone()",
    pattern: /\bstructuredClone\(/,
    since: "HTML spec (Safari 15.4+, 2022)",
  },
  {
    name: "Array.fromAsync()",
    pattern: /\bArray\.fromAsync\(/,
    since: "ES2024",
  },
] as const;

/**
 * Known exceptions — files that legitimately contain a banned pattern.
 * Each entry must include a justification. Keep this list empty if possible.
 */
const KNOWN_EXCEPTIONS: ReadonlyArray<{
  readonly file: string;
  readonly api: string;
  readonly reason: string;
}> = [
  // Example:
  // { file: "vendor-utils-xxx.js", api: "structuredClone()", reason: "polyfilled at runtime" },
];

/** Recursively collect all .js files under a directory */
function collectJsFiles(dir: string): string[] {
  const results: string[] = [];

  function walk(currentDir: string): void {
    const entries = readdirSync(currentDir);
    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (entry.endsWith(".js") && !entry.endsWith(".js.map")) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

interface Violation {
  file: string;
  line: number;
  api: string;
  snippet: string;
}

describe.skipIf(!isBuilt)("Browser Compatibility (Post-Build)", () => {
  it("should not contain banned ES2023+ APIs in dist JS files", () => {
    const jsFiles = collectJsFiles(distDir);
    expect(jsFiles.length).toBeGreaterThan(0);

    const violations: Violation[] = [];

    for (const filePath of jsFiles) {
      const relPath = relative(distDir, filePath);
      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const banned of BANNED_APIS) {
          const match = banned.pattern.exec(line);
          if (match) {
            // Check if this is a known exception
            const isException = KNOWN_EXCEPTIONS.some(
              (ex) => relPath.includes(ex.file) && ex.api === banned.name,
            );
            if (!isException) {
              // Extract a snippet around the match for diagnostics
              const matchIndex = match.index;
              const start = Math.max(0, matchIndex - 30);
              const end = Math.min(line.length, matchIndex + 50);
              const snippet = line.slice(start, end).trim();

              violations.push({
                file: relPath,
                line: i + 1,
                api: banned.name,
                snippet,
              });
            }
          }
        }
      }
    }

    if (violations.length > 0) {
      const report = violations
        .map(
          (v) =>
            `  ${v.api} in ${v.file}:${v.line}\n    ...${v.snippet}...`,
        )
        .join("\n\n");

      console.error(
        `\n  Found ${violations.length} banned API usage(s) in dist/:\n\n${report}`,
        `\n\n  These APIs are not available in ES2022 browsers.`,
        `\n  Fix: use ES2022-compatible alternatives or add to KNOWN_EXCEPTIONS with justification.`,
      );
    }

    expect(violations).toEqual([]);
  });

  it("should scan a meaningful number of JS files", () => {
    const jsFiles = collectJsFiles(distDir);
    // Sanity check: dist should have many JS files (currently ~134)
    // If this drops drastically, the build output structure changed
    expect(jsFiles.length).toBeGreaterThan(50);
  });
});
