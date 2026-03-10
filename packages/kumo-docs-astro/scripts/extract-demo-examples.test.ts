import { describe, expect, it } from "vitest";

import { generateDemoMetadata } from "./extract-demo-examples";

describe("generateDemoMetadata", () => {
  it("discovers nested demo files such as chart demos", () => {
    const metadata = generateDemoMetadata();
    const chart = metadata.components.Chart;

    expect(chart).toBeDefined();
    expect(chart.sourceFile).toBe("Chart/ChartDemo.tsx");
    expect(chart.demos.some((demo) => demo.name === "BarChartDemo")).toBe(true);
    expect(
      chart.demos.some((demo) => demo.name === "TimeseriesChartPreviewDemo"),
    ).toBe(true);
  });
});
