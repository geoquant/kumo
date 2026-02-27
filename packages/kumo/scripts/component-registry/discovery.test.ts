import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { discoverDirs, resolveMainFile } from "./discovery";

function makeTempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

describe("component discovery fallback", () => {
  it("resolves non-conventional component source from index.ts", () => {
    const root = makeTempDir("kumo-discovery-");
    try {
      const flowDir = join(root, "flow");
      mkdirSync(flowDir, { recursive: true });

      writeFileSync(
        join(flowDir, "index.ts"),
        'import { FlowDiagram } from "./diagram";\nconst Flow = Object.assign(FlowDiagram, {});\nexport { Flow };\n',
        "utf-8",
      );
      writeFileSync(
        join(flowDir, "diagram.tsx"),
        "export const FlowDiagram = () => null;\n",
        "utf-8",
      );

      expect(resolveMainFile(flowDir, "flow")).toBe(
        join(flowDir, "diagram.tsx"),
      );
      expect(discoverDirs(root)).toContain("flow");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("supports re-exports to .ts source files", () => {
    const root = makeTempDir("kumo-discovery-");
    try {
      const helperDir = join(root, "helper");
      mkdirSync(helperDir, { recursive: true });

      writeFileSync(
        join(helperDir, "index.ts"),
        'export { Helper } from "./helper";\n',
        "utf-8",
      );
      writeFileSync(
        join(helperDir, "helper.ts"),
        "export const Helper = () => null;\n",
        "utf-8",
      );

      expect(resolveMainFile(helperDir, "helper")).toBe(
        join(helperDir, "helper.ts"),
      );
      expect(discoverDirs(root)).toContain("helper");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
