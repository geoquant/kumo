import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRecordProperty(
  value: unknown,
  property: string,
): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  const next = value[property];
  return isRecord(next) ? next : null;
}

function readArrayProperty(value: unknown, property: string): unknown[] {
  if (!isRecord(value)) {
    return [];
  }

  const next = value[property];
  return Array.isArray(next) ? next : [];
}

describe("TimeseriesChart registry metadata", () => {
  it("captures bar-chart props and chart demos in generated artifacts", () => {
    const registry = JSON.parse(
      readFileSync(
        resolve(__dirname, "../../ai/component-registry.json"),
        "utf-8",
      ),
    );

    expect(isRecord(registry)).toBe(true);
    expect(isRecord(registry.components)).toBe(true);
    const chart =
      isRecord(registry) && isRecord(registry.components)
        ? registry.components.TimeseriesChart
        : null;

    expect(isRecord(chart)).toBe(true);
    const props = readRecordProperty(chart, "props");
    const examples = readArrayProperty(chart, "examples");

    expect(props).not.toBeNull();
    expect(examples.length).toBeGreaterThan(0);

    expect(isRecord(chart) ? chart.category : undefined).toBe("Display");
    expect(props?.type).toEqual(
      expect.objectContaining({
        type: "enum",
        values: ["line", "bar"],
        default: "line",
      }),
    );
    const dataProp = props == null ? null : readRecordProperty(props, "data");
    expect(dataProp?.required).toBe(true);
    expect(
      examples.some(
        (example) =>
          typeof example === "string" && example.includes('type="bar"'),
      ),
    ).toBe(true);
  });
});
