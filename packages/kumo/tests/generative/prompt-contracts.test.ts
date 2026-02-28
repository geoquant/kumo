import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import {
  parseJsonlToTree,
  gradeTree,
} from "../../src/generative/structural-graders";
import { buildSystemPrompt } from "../../src/catalog/system-prompt";
import { buildComponentDocs } from "../../src/catalog/prompt-builder";
import type { UITree } from "../../src/streaming/types";

import registryJson from "../../ai/component-registry.json";

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

describe("PAGE_COMPOSITION section", () => {
  const prompt = buildSystemPrompt();

  it("includes PAGE_COMPOSITION section in output", () => {
    expect(prompt).toContain("Page Composition");
  });

  it("is positioned between COMPOSITION_RECIPES and ACCESSIBILITY", () => {
    const recipesIdx = prompt.indexOf("Composition Recipes");
    const pageCompIdx = prompt.indexOf("Page Composition");
    const a11yIdx = prompt.indexOf("Accessibility (Required)");
    expect(recipesIdx).toBeGreaterThan(-1);
    expect(pageCompIdx).toBeGreaterThan(-1);
    expect(a11yIdx).toBeGreaterThan(-1);
    expect(pageCompIdx).toBeGreaterThan(recipesIdx);
    expect(pageCompIdx).toBeLessThan(a11yIdx);
  });

  it("includes surface hierarchy rules", () => {
    expect(prompt).toContain("Root Surface");
    expect(prompt).toContain('Surface(color="neutral")');
    expect(prompt).toContain("No direct Surface > Surface nesting");
  });

  it("includes page-level layout rules", () => {
    expect(prompt).toContain("Single-column page");
    expect(prompt).toContain("Two-column layout");
    expect(prompt).toContain('Grid(variant="2up")');
    expect(prompt).toContain("sidebar");
  });

  it("includes spacing density grammar", () => {
    expect(prompt).toContain("Spacing Density Grammar");
    expect(prompt).toContain("xs");
    expect(prompt).toContain("Key-value pairs");
    expect(prompt).toContain("sm");
    expect(prompt).toContain("base");
    expect(prompt).toContain("lg");
    expect(prompt).toContain("Top-level page divisions");
  });

  it("includes content reading order", () => {
    expect(prompt).toContain("Content Reading Order");
    const titleIdx = prompt.indexOf("**Title**");
    const contextIdx = prompt.indexOf("**Context**");
    const dataIdx = prompt.indexOf("**Data**");
    const actionsIdx = prompt.indexOf("**Actions**");
    expect(titleIdx).toBeGreaterThan(-1);
    expect(contextIdx).toBeGreaterThan(titleIdx);
    expect(dataIdx).toBeGreaterThan(contextIdx);
    expect(actionsIdx).toBeGreaterThan(dataIdx);
  });
});

describe("Flow prompt docs", () => {
  const docs = buildComponentDocs(registryJson, {
    components: ["Flow", "FlowNode", "FlowParallel"],
  });

  it("includes Flow with composition hint", () => {
    expect(docs).toContain("**Flow**");
    expect(docs).toContain("FlowNode");
    expect(docs).toContain("FlowParallel");
  });

  it("includes FlowNode synthetic props", () => {
    expect(docs).toContain("**FlowNode**");
    expect(docs).toContain("disabled");
  });

  it("includes FlowParallel synthetic props", () => {
    expect(docs).toContain("**FlowParallel**");
    expect(docs).toContain("align");
  });

  it("groups Flow types under Layout", () => {
    expect(docs).toContain("### Layout");
    // All three should appear after the Layout heading
    const layoutIdx = docs.indexOf("### Layout");
    expect(docs.indexOf("**Flow**", layoutIdx)).toBeGreaterThan(layoutIdx);
    expect(docs.indexOf("**FlowNode**", layoutIdx)).toBeGreaterThan(layoutIdx);
    expect(docs.indexOf("**FlowParallel**", layoutIdx)).toBeGreaterThan(
      layoutIdx,
    );
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
