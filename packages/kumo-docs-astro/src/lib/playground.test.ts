import { describe, expect, it } from "vitest";

import {
  addPlaygroundPromptSupplement,
  buildRequestPromptSupplement,
  isMultiChartRequest,
} from "~/lib/playground";

describe("playground prompt supplement", () => {
  it("removes the default 30 element cap for playground requests", () => {
    const result = addPlaygroundPromptSupplement("Base prompt");

    expect(result).toContain("Playground Overrides");
    expect(result).toContain(
      "does not use the default 30-element response cap",
    );
    expect(result).toContain("Do not limit responses to 30 elements");
    expect(result).toContain("Chart Request Mapping");
    expect(result).toContain(
      "Treat `line chart`, `trend chart`, and `timeseries`",
    );
    expect(result).toContain(
      "Treat `pie chart` or `donut chart` as `PieChart`",
    );
  });

  it("adds incremental chart guidance for multi-chart prompts", () => {
    const result = buildRequestPromptSupplement(
      "show chart examples with a line chart, bar chart, and donut chart",
    );

    expect(result).toContain("Incremental Chart Streaming");
    expect(result).toContain("Never emit a single patch to `/elements`");
    expect(result).toContain(
      "Build the first chart card completely before starting the second chart card.",
    );
  });

  it("does not add chart streaming guidance for simple non-chart prompts", () => {
    expect(
      buildRequestPromptSupplement("show a settings form"),
    ).toBeUndefined();
  });

  it("detects heavy multi-chart prompts", () => {
    expect(
      isMultiChartRequest(
        "show chart examples with a line chart, bar chart, and donut chart",
      ),
    ).toBe(true);
    expect(isMultiChartRequest("show a settings form")).toBe(false);
  });
});
