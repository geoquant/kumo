import { describe, expect, it } from "vitest";

import {
  buildChartFallbackJsonl,
  buildChartFallbackTree,
  detectChartFallbackScenario,
} from "~/pages/api/chat/chart-fallback";

describe("chart fallback", () => {
  it("detects simple chart prompts", () => {
    expect(detectChartFallbackScenario("line chart")).toBe("line");
    expect(detectChartFallbackScenario("bar chart")).toBe("bar");
    expect(detectChartFallbackScenario("pie chart")).toBe("pie");
    expect(detectChartFallbackScenario("donut chart")).toBe("donut");
    expect(detectChartFallbackScenario("area chart")).toBe("area");
  });

  it("detects chart showcase prompts", () => {
    expect(
      detectChartFallbackScenario(
        "show basic chart examples with a line chart, bar chart, and donut chart",
      ),
    ).toBe("showcase");
  });

  it("builds a showcase tree with multiple chart types", () => {
    const tree = buildChartFallbackTree("showcase");

    expect(tree.root).toBe("page");
    expect(tree.elements["line-card-chart"]?.type).toBe("TimeseriesChart");
    expect(tree.elements["bar-card-chart"]?.props).toMatchObject({
      type: "bar",
    });
    expect(tree.elements["pie-card-chart"]?.type).toBe("PieChart");
  });

  it("serializes fallback trees as JSONL patch ops", () => {
    const jsonl = buildChartFallbackJsonl("line");
    const lines = jsonl.split("\n");

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('"/root"');
    expect(lines[1]).toContain('"/elements"');
  });
});
