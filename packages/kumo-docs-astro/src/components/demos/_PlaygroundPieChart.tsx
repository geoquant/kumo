import { Chart, Stack, Text } from "@cloudflare/kumo";
import * as echarts from "echarts/core";
import type { EChartsOption } from "echarts";
import { PieChart as EchartsPieChart } from "echarts/charts";
import { useEffect, useMemo, useState } from "react";
import {
  AriaComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { LabelLayout, UniversalTransition } from "echarts/features";

echarts.use([
  EchartsPieChart,
  TooltipComponent,
  LegendComponent,
  AriaComponent,
  LabelLayout,
  UniversalTransition,
  CanvasRenderer,
]);

const PIE_SLICE_VALUES = [42, 27, 18, 13] as const;
const PIE_SLICE_LABELS = [
  "Cache hits",
  "Origin fetches",
  "API requests",
  "Scheduled jobs",
] as const;
const PIE_SLICE_COLORS = ["#f97316", "#f59e0b", "#0ea5e9", "#6366f1"] as const;

export interface PlaygroundPieChartProps {
  readonly title?: string;
  readonly description?: string;
  readonly variant?: "pie" | "donut";
}

export function PlaygroundPieChart({
  title = "Traffic mix",
  description = "Distribution across the latest request categories.",
  variant = "pie",
}: PlaygroundPieChartProps) {
  const isDarkMode = useIsDarkMode();

  const options = useMemo(() => {
    const radius = variant === "donut" ? ["42%", "72%"] : "72%";

    return {
      tooltip: { trigger: "item" },
      legend: { show: false },
      series: [
        {
          type: "pie",
          radius,
          avoidLabelOverlap: true,
          label: { show: true, formatter: "{b}" },
          labelLine: { show: true },
          data: PIE_SLICE_VALUES.map((value, index) => ({
            value,
            name: PIE_SLICE_LABELS[index],
            itemStyle: { color: PIE_SLICE_COLORS[index] },
          })),
        },
      ],
    } satisfies EChartsOption;
  }, [variant]);

  return (
    <Stack gap="sm">
      <Text variant="heading3">{title}</Text>
      <Text variant="secondary">{description}</Text>
      <Chart
        echarts={echarts}
        options={options}
        height={320}
        isDarkMode={isDarkMode}
      />
    </Stack>
  );
}

function useIsDarkMode() {
  const getIsDark = () => {
    if (typeof document === "undefined") return false;

    const root = document.documentElement;
    const mode = root.getAttribute("data-mode");

    if (mode === "dark") return true;
    if (mode === "light") return false;
    if (root.classList.contains("dark")) return true;
    if (root.classList.contains("light")) return false;

    return (
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false
    );
  };

  const [isDark, setIsDark] = useState(getIsDark);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(getIsDark());
    const observer = new MutationObserver(update);

    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-mode", "class"],
    });

    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
    mediaQuery?.addEventListener("change", update);

    return () => {
      mediaQuery?.removeEventListener("change", update);
      observer.disconnect();
    };
  }, []);

  return isDark;
}
