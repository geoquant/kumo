import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import {
  parseJsonlToTree,
  gradeTree,
} from "../../src/generative/structural-graders";
import { buildSystemPrompt } from "../../src/catalog/system-prompt";
import type { UITree } from "../../src/streaming/types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURE_DIR = resolve(__dirname, "fixtures");

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURE_DIR, `${name}.jsonl`), "utf-8");
}

function treeHasType(tree: UITree, type: string): boolean {
  return Object.values(tree.elements).some((el) => el.type === type);
}

describe("system prompt contracts", () => {
  it("includes explicit form field selection rules", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Form Field Selection");
    expect(prompt).toContain("Use **Input** for freeform text");
    expect(prompt).toContain('NEVER use **Select** for fields labelled "Name"');
  });

  it("includes a counter example and redundancy rule", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Example (Counter with Increment/Decrement)");
    expect(prompt).toContain("No Redundant Controls");
  });
});

describe("fixture contracts", () => {
  it("notification-preferences fixture grades cleanly and includes requested controls", () => {
    const tree = parseJsonlToTree(loadFixture("notification-preferences"));
    const report = gradeTree(tree);
    expect(report.results.every((r) => r.pass)).toBe(true);

    expect(treeHasType(tree, "Input")).toBe(true);
    expect(treeHasType(tree, "Select")).toBe(true);
    expect(treeHasType(tree, "Checkbox")).toBe(true);
    expect(treeHasType(tree, "Button")).toBe(true);
  });
});
