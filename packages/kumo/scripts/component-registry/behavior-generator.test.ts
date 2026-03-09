import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import registryJson from "../../ai/component-registry.json";
import { generateComponentBehaviorManifest } from "./behavior-generator";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("generateComponentBehaviorManifest", () => {
  const manifest = generateComponentBehaviorManifest(registryJson);

  it("marks excluded components with an explicit generative reason", () => {
    expect(manifest.components.Dialog.generativeSupport).toEqual({
      status: "excluded",
      reason: "Portal-based overlay; LLM-generated content should be inline",
    });
  });

  it("captures representative wrapper, binding, event, and validation hints", () => {
    expect(manifest.components.Select.wrapperKind).toBe("stateful+generative");
    expect(manifest.components.Select.bindableProps).toContain("value");
    expect(manifest.components.Select.emittedEvents).toContainEqual({
      prop: "onValueChange",
      event: "value-change",
      payload: "value",
    });
    expect(
      manifest.components.Checkbox.validation.enumProps["variant"],
    ).toEqual(["default", "error"]);
    expect(
      manifest.components.ClipboardText.validation.requiredProps,
    ).toContain("text");

    expect(manifest.components.Collapsible.bindableProps).toContain("open");

    expect(manifest.components.TimeseriesChart.wrapperKind).toBe("generative");
    expect(manifest.components.TimeseriesChart.layoutRole).toBe("data-display");
    expect(manifest.components.TimeseriesChart.generativeSupport.status).toBe(
      "supported",
    );
    expect(manifest.components.TimeseriesChart.emittedEvents).toContainEqual({
      prop: "onTimeRangeChange",
      event: "time-range-change",
      payload: "from,to",
    });
  });

  it("matches the committed behavior artifact", () => {
    const behaviorPath = resolve(__dirname, "../../ai/component-behavior.json");
    const actualContent = readFileSync(behaviorPath, "utf-8");
    const actualManifest: unknown = JSON.parse(actualContent);

    expect(actualManifest).toEqual(manifest);
  });
});
