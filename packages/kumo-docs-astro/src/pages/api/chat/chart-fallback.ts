import type { UITree } from "@cloudflare/kumo/catalog";

type ChartFallbackScenario =
  | "line"
  | "area"
  | "bar"
  | "pie"
  | "donut"
  | "showcase";

const TIMESTAMPS = [
  1710000000000, 1710003600000, 1710007200000, 1710010800000, 1710014400000,
  1710018000000,
] as const;

function createTimeseriesData(
  name: string,
  values: readonly number[],
  color: string,
): {
  readonly name: string;
  readonly color: string;
  readonly data: readonly [number, number][];
} {
  return {
    name,
    color,
    data: TIMESTAMPS.map((timestamp, index) => [timestamp, values[index] ?? 0]),
  };
}

function createChartCard(input: {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly chartType: "line" | "bar";
  readonly gradient?: boolean;
  readonly series: readonly {
    readonly name: string;
    readonly color: string;
    readonly data: readonly [number, number][];
  }[];
}): UITree["elements"] {
  const stackKey = `${input.key}-stack`;
  const titleKey = `${input.key}-title`;
  const descriptionKey = `${input.key}-description`;
  const chartKey = `${input.key}-chart`;

  return {
    [input.key]: {
      key: input.key,
      type: "Surface",
      props: {},
      children: [stackKey],
    },
    [stackKey]: {
      key: stackKey,
      type: "Stack",
      props: { gap: "sm" },
      children: [titleKey, descriptionKey, chartKey],
      parentKey: input.key,
    },
    [titleKey]: {
      key: titleKey,
      type: "Text",
      props: { children: input.title, variant: "heading3" },
      parentKey: stackKey,
    },
    [descriptionKey]: {
      key: descriptionKey,
      type: "Text",
      props: { children: input.description, variant: "secondary" },
      parentKey: stackKey,
    },
    [chartKey]: {
      key: chartKey,
      type: "TimeseriesChart",
      props: {
        type: input.chartType,
        height: 240,
        xAxisName: "Time (UTC)",
        yAxisName: "Value",
        ...(input.gradient === true ? { gradient: true } : {}),
        data: input.series,
      },
      parentKey: stackKey,
    },
  };
}

function createPieCard(input: {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly variant: "pie" | "donut";
}): UITree["elements"] {
  const stackKey = `${input.key}-stack`;
  const chartKey = `${input.key}-chart`;

  return {
    [input.key]: {
      key: input.key,
      type: "Surface",
      props: {},
      children: [stackKey],
    },
    [stackKey]: {
      key: stackKey,
      type: "Stack",
      props: { gap: "sm" },
      children: [chartKey],
      parentKey: input.key,
    },
    [chartKey]: {
      key: chartKey,
      type: "PieChart",
      props: {
        title: input.title,
        description: input.description,
        variant: input.variant,
      },
      parentKey: stackKey,
    },
  };
}

export function detectChartFallbackScenario(
  message: string,
): ChartFallbackScenario | null {
  const normalized = message.toLowerCase();
  const chartMentions = [
    normalized.includes("line chart"),
    normalized.includes("bar chart"),
    normalized.includes("column chart"),
    normalized.includes("area chart"),
    normalized.includes("pie chart"),
    normalized.includes("donut chart"),
  ].filter(Boolean).length;

  if (
    normalized.includes("chart demo") ||
    normalized.includes("chart examples") ||
    normalized.includes("basic charts") ||
    normalized.includes("multiple charts") ||
    chartMentions >= 2
  ) {
    return "showcase";
  }

  if (normalized.includes("donut chart")) return "donut";
  if (normalized.includes("pie chart")) return "pie";
  if (normalized.includes("area chart")) return "area";
  if (normalized.includes("bar chart") || normalized.includes("column chart")) {
    return "bar";
  }
  if (
    normalized.includes("line chart") ||
    normalized.includes("timeseries") ||
    normalized.trim() === "chart"
  ) {
    return "line";
  }

  return null;
}

export function buildChartFallbackTree(
  scenario: ChartFallbackScenario,
): UITree {
  const heading = {
    line: "Request traffic",
    area: "Traffic trend",
    bar: "Status code volume",
    pie: "Traffic mix",
    donut: "Traffic mix",
    showcase: "Chart gallery",
  }[scenario];

  const description = {
    line: "Simple line chart fallback rendered locally while the AI backend recovers.",
    area: "Area chart fallback rendered locally while the AI backend recovers.",
    bar: "Bar chart fallback rendered locally while the AI backend recovers.",
    pie: "Pie chart fallback rendered locally while the AI backend recovers.",
    donut:
      "Donut chart fallback rendered locally while the AI backend recovers.",
    showcase:
      "Three chart types rendered locally so the playground still demos core chart patterns.",
  }[scenario];

  const baseElements: UITree["elements"] = {
    page: {
      key: "page",
      type: "Surface",
      props: {},
      children: ["stack"],
    },
    stack: {
      key: "stack",
      type: "Stack",
      props: { gap: "lg" },
      children:
        scenario === "showcase"
          ? ["heading", "description", "grid"]
          : ["heading", "description", "chart-card"],
      parentKey: "page",
    },
    heading: {
      key: "heading",
      type: "Text",
      props: { children: heading, variant: "heading2" },
      parentKey: "stack",
    },
    description: {
      key: "description",
      type: "Text",
      props: { children: description, variant: "secondary" },
      parentKey: "stack",
    },
  };

  if (scenario === "showcase") {
    return {
      root: "page",
      elements: {
        ...baseElements,
        grid: {
          key: "grid",
          type: "Grid",
          props: { variant: "3up" },
          children: ["line-card", "bar-card", "pie-card"],
          parentKey: "stack",
        },
        ...createChartCard({
          key: "line-card",
          title: "Requests",
          description: "Line chart for recent request volume.",
          chartType: "line",
          gradient: true,
          series: [
            createTimeseriesData(
              "Requests",
              [122, 156, 149, 181, 175, 204],
              "#f97316",
            ),
          ],
        }),
        ...createChartCard({
          key: "bar-card",
          title: "Status codes",
          description: "Bar chart for response counts.",
          chartType: "bar",
          series: [
            createTimeseriesData(
              "2xx",
              [98, 120, 117, 130, 128, 145],
              "#0ea5e9",
            ),
            createTimeseriesData("5xx", [6, 4, 7, 5, 8, 6], "#ef4444"),
          ],
        }),
        ...createPieCard({
          key: "pie-card",
          title: "Traffic share",
          description: "Donut chart for traffic categories.",
          variant: "donut",
        }),
      },
    };
  }

  const singleCardElements =
    scenario === "pie" || scenario === "donut"
      ? createPieCard({
          key: "chart-card",
          title: heading,
          description,
          variant: scenario === "donut" ? "donut" : "pie",
        })
      : createChartCard({
          key: "chart-card",
          title: heading,
          description,
          chartType: scenario === "bar" ? "bar" : "line",
          gradient: scenario !== "bar",
          series:
            scenario === "bar"
              ? [
                  createTimeseriesData(
                    "2xx",
                    [98, 120, 117, 130, 128, 145],
                    "#0ea5e9",
                  ),
                  createTimeseriesData("5xx", [6, 4, 7, 5, 8, 6], "#ef4444"),
                ]
              : [
                  createTimeseriesData(
                    scenario === "area" ? "Latency" : "Requests",
                    scenario === "area"
                      ? [42, 55, 48, 63, 58, 71]
                      : [122, 156, 149, 181, 175, 204],
                    scenario === "area" ? "#8b5cf6" : "#f97316",
                  ),
                ],
        });

  return {
    root: "page",
    elements: {
      ...baseElements,
      ...singleCardElements,
    },
  };
}

export function buildChartFallbackJsonl(
  scenario: ChartFallbackScenario,
): string {
  const tree = buildChartFallbackTree(scenario);

  return [
    JSON.stringify({ op: "add", path: "/root", value: tree.root }),
    JSON.stringify({ op: "add", path: "/elements", value: tree.elements }),
  ].join("\n");
}
