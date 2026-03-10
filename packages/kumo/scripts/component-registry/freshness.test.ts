import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { generateDemoMetadata } from "../../../kumo-docs-astro/scripts/extract-demo-examples";
import { generateAIContext } from "./markdown-generator";
import { generateSchemasFile } from "./schema-generator";
import { generateComponentBehaviorManifest } from "./behavior-generator";
import { generateComponentManifest } from "./generative-map-generator";
import { generateRegistry } from "./index";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("catalog freshness", () => {
  it("demo metadata matches current demo source files", () => {
    const expected = generateDemoMetadata();
    const actualPath = resolve(
      __dirname,
      "../../../kumo-docs-astro/dist/demo-metadata.json",
    );
    const actual = JSON.parse(readFileSync(actualPath, "utf-8")) as {
      version: string;
      components: unknown;
    };

    expect(actual.version).toBe(expected.version);
    expect(actual.components).toEqual(expected.components);
  });

  it("all committed registry artifacts match the current codegen workflow", async () => {
    const { registry, componentColors } = await generateRegistry();

    const expectedMarkdown = generateAIContext(registry, componentColors);
    const expectedSchemas = generateSchemasFile(registry);
    const expectedBehavior = generateComponentBehaviorManifest(registry);
    const expectedManifest = generateComponentManifest(registry);

    const registryPath = resolve(__dirname, "../../ai/component-registry.json");
    const markdownPath = resolve(__dirname, "../../ai/component-registry.md");
    const schemasPath = resolve(__dirname, "../../ai/schemas.ts");
    const behaviorPath = resolve(__dirname, "../../ai/component-behavior.json");
    const manifestPath = resolve(
      __dirname,
      "../../src/generative/component-manifest.ts",
    );

    const actualRegistry = JSON.parse(readFileSync(registryPath, "utf-8"));
    const actualMarkdown = readFileSync(markdownPath, "utf-8");
    const actualSchemas = readFileSync(schemasPath, "utf-8");
    const actualBehavior = JSON.parse(readFileSync(behaviorPath, "utf-8"));
    const actualManifest = readFileSync(manifestPath, "utf-8");

    expect(actualRegistry).toEqual(registry);
    expect(actualMarkdown).toBe(expectedMarkdown);
    expect(actualSchemas).toBe(expectedSchemas);
    expect(actualBehavior).toEqual(expectedBehavior);
    expect(actualManifest).toBe(expectedManifest);
  }, 15_000);
});
