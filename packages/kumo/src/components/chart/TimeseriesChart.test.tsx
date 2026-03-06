import { render } from "@testing-library/react";
import * as echarts from "echarts/core";
import { describe, expect, it, vi } from "vitest";

import { KumoLocaleProvider } from "../../localize/index.js";
import { TimeseriesChart } from "./TimeseriesChart";

interface ChartTooltipPoint {
  readonly seriesName: string;
  readonly value: readonly [number, number];
  readonly marker: string;
  readonly axisValue?: number;
}

interface ChartTooltip {
  readonly formatter: (
    params: ChartTooltipPoint | readonly ChartTooltipPoint[],
  ) => string;
}

interface ChartOptionsLike {
  readonly tooltip: ChartTooltip;
}

const chartOptions: { current: ChartOptionsLike | undefined } = {
  current: undefined,
};

vi.mock("./EChart", () => ({
  Chart: ({ options }: { readonly options: unknown }) => {
    if (isChartOptionsLike(options)) {
      chartOptions.current = options;
    }

    return <div data-testid="timeseries-chart" />;
  },
}));

function isChartOptionsLike(value: unknown): value is ChartOptionsLike {
  if (typeof value !== "object" || value === null) return false;

  const tooltip = Reflect.get(value, "tooltip");
  if (typeof tooltip !== "object" || tooltip === null) return false;

  const formatter = Reflect.get(tooltip, "formatter");
  return typeof formatter === "function";
}

function getChartOptionsOrThrow(): ChartOptionsLike {
  if (chartOptions.current === undefined) {
    throw new Error("Expected chart options to be captured");
  }

  return chartOptions.current;
}

describe("TimeseriesChart", () => {
  it("localizes tooltip timestamps and numeric values", () => {
    chartOptions.current = undefined;

    const locale = "de-DE";
    const timestamp = Date.UTC(2026, 2, 5, 16, 23, 10);
    const value = 12345.6;

    render(
      <KumoLocaleProvider locale={locale}>
        <TimeseriesChart
          echarts={echarts}
          data={[
            {
              name: "Requests",
              color: "#086FFF",
              data: [[timestamp, value]],
            },
          ]}
        />
      </KumoLocaleProvider>,
    );

    const options = getChartOptionsOrThrow();

    const tooltipHtml = options.tooltip.formatter([
      {
        seriesName: "Requests",
        value: [timestamp, value],
        marker: "•",
      },
    ]);

    expect(tooltipHtml).toBeDefined();

    const expectedTimestamp = new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(timestamp);
    const expectedNumber = new Intl.NumberFormat(locale).format(value);

    expect(tooltipHtml).toContain(expectedTimestamp);
    expect(tooltipHtml).toContain(expectedNumber);
  });
});
