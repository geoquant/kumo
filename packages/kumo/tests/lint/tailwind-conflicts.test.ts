import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join, dirname, relative } from "path";
import { fileURLToPath } from "url";
import ts from "typescript";

const __dirname = dirname(fileURLToPath(import.meta.url));

const componentsDir = join(__dirname, "../../src/components");
const blocksDir = join(__dirname, "../../src/blocks");

/**
 * Tailwind Class Conflict Lint
 *
 * Uses the TypeScript compiler API to parse component source files,
 * find all cn() calls, extract string literal arguments, and check
 * for conflicting Tailwind class pairs within the same cn() call.
 *
 * A conflict occurs when two classes in the same cn() call ALWAYS
 * co-occur and set the same CSS property to different values. Classes
 * in opposite branches of a ternary are excluded since they're
 * mutually exclusive at runtime.
 *
 * To add a conflict pair:
 *   1. Add an entry to CONFLICT_PAIRS below
 *   2. Run: pnpm --filter @cloudflare/kumo test -- tests/lint/tailwind-conflicts
 */

/**
 * Each pair represents two Tailwind classes that set the same CSS property
 * to different values. If both appear in the same cn() call (outside of
 * mutually-exclusive conditional branches), it's a conflict.
 *
 * This list is intentionally narrow to minimize false positives. It covers
 * the highest-risk conflicts that are hard to spot in code review (overflow,
 * display, visibility). Expand as real bugs are found.
 *
 * Candidates for future expansion:
 *   - position: relative vs absolute vs fixed vs sticky
 *   - text-align: text-left vs text-center vs text-right
 *   - flex-direction: flex-row vs flex-col
 *   - align-items: items-start vs items-center vs items-end
 *   - justify-content: justify-start vs justify-center vs justify-between
 */
const CONFLICT_PAIRS: ReadonlyArray<readonly [string, string]> = [
  // overflow conflicts — overflow-hidden cancels overflow-y-auto, etc.
  ["overflow-hidden", "overflow-y-auto"],
  ["overflow-hidden", "overflow-x-auto"],
  ["overflow-hidden", "overflow-auto"],
  ["overflow-visible", "overflow-hidden"],
  // display conflicts — hidden (display:none) vs visible display values
  ["hidden", "block"],
  ["hidden", "flex"],
  ["hidden", "inline-flex"],
  ["hidden", "grid"],
  ["hidden", "inline"],
  ["hidden", "inline-block"],
  // visibility conflicts
  ["invisible", "visible"],
] as const;

interface CnCallInfo {
  /** Relative file path from components dir */
  file: string;
  /** 1-based line number of the cn() call */
  line: number;
  /**
   * Classes that can co-occur within this cn() call. Includes:
   * - Unconditional string literal args (always present)
   * - Right-hand side of `&&` expressions (present when condition is truthy)
   *
   * Excludes ternary branches (mutually exclusive at runtime).
   * Note: two classes behind different `&&` guards with mutually exclusive
   * conditions will still be flagged — data-flow analysis is out of scope.
   */
  coOccurringClasses: string[];
}

interface Conflict {
  file: string;
  line: number;
  classA: string;
  classB: string;
}

/** Recursively collect all .tsx files under a directory */
function collectTsxFiles(dir: string): string[] {
  const results: string[] = [];

  function walk(currentDir: string): void {
    for (const entry of readdirSync(currentDir)) {
      const fullPath = join(currentDir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (entry.endsWith(".tsx")) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

/**
 * Extract classes from a cn() argument, respecting conditional branching.
 *
 * Returns classes that will "always co-occur" when this arg is active.
 * For ternary expressions (cond ? a : b), we DON'T include both branches
 * in the same set — they're mutually exclusive.
 *
 * For logical-and (cond && "classes"), we DO include the classes because
 * when the condition is true, these classes co-occur with unconditional ones.
 * This is where conflicts matter (e.g. cn("overflow-hidden", x && "overflow-y-auto")).
 */
function extractUnconditionalClasses(node: ts.Node): string[] {
  // Direct string literal — always present
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text.split(/\s+/).filter(Boolean);
  }

  // Ternary: cond ? whenTrue : whenFalse
  // Genuinely mutually exclusive branches — skip both to avoid false positives.
  // Exception: when one branch is "" (empty string), the other is effectively
  // conditional (like `cond && "classes"`), so we extract it.
  // e.g. cn("overflow-y-auto", cond ? "overflow-hidden" : "") — the "overflow-hidden"
  // can co-occur with "overflow-y-auto" and should be checked for conflicts.
  if (ts.isConditionalExpression(node)) {
    const trueIsEmpty =
      ts.isStringLiteral(node.whenTrue) && node.whenTrue.text.trim() === "";
    const falseIsEmpty =
      ts.isStringLiteral(node.whenFalse) && node.whenFalse.text.trim() === "";
    if (falseIsEmpty) return extractUnconditionalClasses(node.whenTrue);
    if (trueIsEmpty) return extractUnconditionalClasses(node.whenFalse);
    return [];
  }

  // Logical AND: cond && "classes"
  // The right side's classes ARE present when condition is true,
  // so they can conflict with unconditional classes.
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
  ) {
    return extractUnconditionalClasses(node.right);
  }

  // Object literal: cn({ "class-a": condition, "class-b": true })
  // All property name strings are extracted — they co-occur when their conditions
  // are true. This is conservative (two keys with mutually exclusive conditions
  // will still be flagged), matching how we treat `&&` expressions.
  if (ts.isObjectLiteralExpression(node)) {
    const classes: string[] = [];
    for (const prop of node.properties) {
      if (ts.isPropertyAssignment(prop)) {
        let key: string | undefined;
        if (ts.isStringLiteral(prop.name)) {
          key = prop.name.text;
        } else if (ts.isIdentifier(prop.name)) {
          key = prop.name.text;
        }
        if (key) {
          classes.push(...key.split(/\s+/).filter(Boolean));
        }
      }
    }
    return classes;
  }

  // Parenthesized expression: (expr) — unwrap
  if (ts.isParenthesizedExpression(node)) {
    return extractUnconditionalClasses(node.expression);
  }

  // Nested cn() call — recurse into its arguments
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "cn"
  ) {
    const classes: string[] = [];
    for (const arg of node.arguments) {
      classes.push(...extractUnconditionalClasses(arg));
    }
    return classes;
  }

  // Anything else (variables, function calls, template literals) — can't analyze
  return [];
}

/**
 * Find all cn() call expressions in a source file and extract classes
 * that can co-occur (excluding mutually-exclusive ternary branches).
 */
function findCnCalls(sourceFile: ts.SourceFile): CnCallInfo[] {
  const calls: CnCallInfo[] = [];
  const relPath = relative(componentsDir, sourceFile.fileName);

  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "cn"
    ) {
      const allClasses: string[] = [];
      for (const arg of node.arguments) {
        allClasses.push(...extractUnconditionalClasses(arg));
      }

      if (allClasses.length > 0) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(),
        );
        calls.push({
          file: relPath,
          line: line + 1, // 1-based
          coOccurringClasses: allClasses,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return calls;
}

/**
 * Check a set of classes from a single cn() call against all conflict pairs.
 */
function findConflicts(location: CnCallInfo): Conflict[] {
  const conflicts: Conflict[] = [];
  const classSet = new Set(location.coOccurringClasses);

  for (const [classA, classB] of CONFLICT_PAIRS) {
    if (classSet.has(classA) && classSet.has(classB)) {
      conflicts.push({
        file: location.file,
        line: location.line,
        classA,
        classB,
      });
    }
  }

  return conflicts;
}

/** Collect tsx files from all scanned directories */
function collectAllTsxFiles(): string[] {
  const files = collectTsxFiles(componentsDir);
  if (existsSync(blocksDir)) {
    files.push(...collectTsxFiles(blocksDir));
  }
  return files;
}

describe("Tailwind Class Conflict Lint", () => {
  it("should not have conflicting Tailwind classes in cn() calls", () => {
    const tsxFiles = collectAllTsxFiles();
    expect(tsxFiles.length).toBeGreaterThan(0);

    const allConflicts: Conflict[] = [];

    for (const filePath of tsxFiles) {
      const source = readFileSync(filePath, "utf-8");
      const sourceFile = ts.createSourceFile(
        filePath,
        source,
        ts.ScriptTarget.Latest,
        /* setParentNodes */ true,
        ts.ScriptKind.TSX,
      );

      const cnCalls = findCnCalls(sourceFile);
      for (const call of cnCalls) {
        allConflicts.push(...findConflicts(call));
      }
    }

    if (allConflicts.length > 0) {
      const report = allConflicts
        .map(
          (c) =>
            `  ${c.file}:${c.line} — "${c.classA}" conflicts with "${c.classB}"`,
        )
        .join("\n");

      console.error(
        `\n  Found ${allConflicts.length} Tailwind class conflict(s) in cn() calls:\n\n${report}`,
        `\n\n  These classes set the same CSS property to different values.`,
        `\n  The later class always wins, making the earlier one dead code.`,
        `\n  Fix: remove the overridden class, or move to a conditional/separate cn() call.`,
      );
    }

    expect(allConflicts).toEqual([]);
  });

  it("should scan a meaningful number of component files", () => {
    const tsxFiles = collectAllTsxFiles();
    // Sanity check: should have many .tsx component + block files
    expect(tsxFiles.length).toBeGreaterThan(20);
  });
});
