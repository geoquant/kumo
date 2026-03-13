import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import { extractSemanticColors, parseSemanticColorNames } from "./utils";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("component registry semantic color utilities", () => {
  it("reads semantic color names from exported theme metadata", () => {
    const colorNames = parseSemanticColorNames();

    expect(colorNames).toContain("kumo-base");
    expect(colorNames).toContain("kumo-default");
    expect(colorNames).not.toContain("base");
  });

  it("extracts semantic utility classes from source files", () => {
    const dir = mkdtempSync(join(tmpdir(), "kumo-semantic-colors-"));
    tempDirs.push(dir);
    const filePath = join(dir, "example.tsx");

    writeFileSync(
      filePath,
      `<div className="bg-kumo-base hover:bg-kumo-fill text-kumo-default border-kumo-line" />`,
      "utf-8",
    );

    expect(extractSemanticColors(filePath)).toEqual([
      "bg-kumo-base",
      "bg-kumo-fill",
      "border-kumo-line",
      "text-kumo-default",
    ]);
  });
});
