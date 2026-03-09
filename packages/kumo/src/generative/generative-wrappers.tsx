/**
 * Generative UI wrappers — default styling/behavior for LLM-generated components.
 *
 * These wrappers apply sensible defaults that LLMs typically omit:
 * - Surface: rounded corners and padding (card-like appearance)
 * - Input/InputArea: full-width by default
 * - CloudflareLogo: default dimensions when not specified
 * - Select: visible label by default
 * - Grid: defaults variant="2up" (when no variant/columns) and gap="base"
 * - Stack: defaults gap="base" (16px vertical rhythm)
 * - Text: defaults variant="body"
 */

import React, { forwardRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import {
  AriaComponent,
  AxisPointerComponent,
  BrushComponent,
  GridComponent,
  ToolboxComponent,
  TooltipComponent,
} from "echarts/components";
import { LabelLayout, UniversalTransition } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";
import {
  CloudflareLogo,
  Grid,
  Input,
  InputArea,
  Stack,
  Surface,
  Text,
  TimeseriesChart,
} from "../index.js";
import { cn } from "../utils/index.js";
import { StatefulSelect } from "./stateful-wrappers.js";

echarts.use([
  LineChart,
  BarChart,
  AxisPointerComponent,
  BrushComponent,
  GridComponent,
  ToolboxComponent,
  TooltipComponent,
  AriaComponent,
  LabelLayout,
  UniversalTransition,
  CanvasRenderer,
]);

// =============================================================================
// Helpers
// =============================================================================

function readClassName(props: Record<string, unknown>): string | undefined {
  const value = props["className"];
  return typeof value === "string" ? value : undefined;
}

function stripClassName(
  props: Record<string, unknown>,
): Record<string, unknown> {
  const { className: _, ...rest } = props;
  return rest;
}

type TimeseriesPoint = [number, number];

type TimeseriesSeries = {
  readonly name: string;
  readonly data: TimeseriesPoint[];
  readonly color: string;
};

const DEFAULT_CHART_COLORS = ["#f38020", "#0ea5e9", "#8b5cf6", "#10b981"];

function readStringProp(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function readNumberProp(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTimestamp(value: unknown, fallbackIndex: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }

    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return Date.now() + fallbackIndex * 60_000;
}

function parseValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }

  return null;
}

function normalizePoint(value: unknown, index: number): TimeseriesPoint | null {
  if (Array.isArray(value) && value.length >= 2) {
    const y = parseValue(value[1]);
    if (y === null) {
      return null;
    }
    return [parseTimestamp(value[0], index), y];
  }

  if (typeof value === "number" || typeof value === "string") {
    const y = parseValue(value);
    if (y === null) {
      return null;
    }
    return [parseTimestamp(undefined, index), y];
  }

  if (isRecord(value)) {
    const x =
      value["x"] ?? value["timestamp"] ?? value["time"] ?? value["date"];
    const y = parseValue(value["y"] ?? value["value"] ?? value["count"]);
    if (y === null) {
      return null;
    }
    return [parseTimestamp(x, index), y];
  }

  return null;
}

function normalizeSeriesData(value: unknown): TimeseriesPoint[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((point, index) => normalizePoint(point, index))
    .filter((point): point is TimeseriesPoint => point !== null);
}

function buildFallbackSeries(name: string, color: string): TimeseriesSeries {
  const base = Date.now() - 4 * 60_000;
  return {
    name,
    color,
    data: [0, 1, 2, 3, 4].map(
      (offset) => [base + offset * 60_000, 12 + offset * 4] as const,
    ),
  };
}

function normalizeSeries(
  value: unknown,
  index: number,
): TimeseriesSeries | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = readStringProp(value["name"]) ?? `Series ${index + 1}`;
  const color =
    readStringProp(value["color"]) ??
    DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length] ??
    "#f38020";
  const data = normalizeSeriesData(
    value["data"] ?? value["points"] ?? value["values"],
  );

  return {
    name,
    color,
    data: data.length > 0 ? data : buildFallbackSeries(name, color).data,
  };
}

function normalizeTimeseriesData(value: unknown): TimeseriesSeries[] {
  if (Array.isArray(value)) {
    const first = value[0];

    if (
      isRecord(first) &&
      ("data" in first || "points" in first || "values" in first)
    ) {
      const series = value
        .map((entry, index) => normalizeSeries(entry, index))
        .filter((entry): entry is TimeseriesSeries => entry !== null);

      return series.length > 0
        ? series
        : [
            buildFallbackSeries(
              "Requests",
              DEFAULT_CHART_COLORS[0] ?? "#f38020",
            ),
          ];
    }

    const points = normalizeSeriesData(value);
    return [
      {
        name: "Requests",
        color: DEFAULT_CHART_COLORS[0] ?? "#f38020",
        data:
          points.length > 0
            ? points
            : buildFallbackSeries(
                "Requests",
                DEFAULT_CHART_COLORS[0] ?? "#f38020",
              ).data,
      },
    ];
  }

  if (isRecord(value)) {
    if (Array.isArray(value["series"])) {
      return normalizeTimeseriesData(value["series"]);
    }

    if (
      Array.isArray(value["data"]) ||
      Array.isArray(value["points"]) ||
      Array.isArray(value["values"])
    ) {
      return [
        {
          name: readStringProp(value["name"]) ?? "Requests",
          color:
            readStringProp(value["color"]) ??
            DEFAULT_CHART_COLORS[0] ??
            "#f38020",
          data:
            normalizeSeriesData(
              value["data"] ?? value["points"] ?? value["values"],
            ).length > 0
              ? normalizeSeriesData(
                  value["data"] ?? value["points"] ?? value["values"],
                )
              : buildFallbackSeries(
                  "Requests",
                  DEFAULT_CHART_COLORS[0] ?? "#f38020",
                ).data,
        },
      ];
    }
  }

  return [
    buildFallbackSeries("Requests", DEFAULT_CHART_COLORS[0] ?? "#f38020"),
  ];
}

// =============================================================================
// GenerativeSurface
// =============================================================================

/**
 * Surface wrapper that adds default padding and border-radius.
 *
 * The base Surface component ships with no padding or radius by design
 * (consumers add them via className). In generative UI the LLM rarely
 * includes those classes, so we bake in sensible card defaults here.
 */
export const GenerativeSurface = forwardRef<
  HTMLDivElement,
  Record<string, unknown>
>(function GenerativeSurface(props, ref) {
  const { className, ...rest } = props;
  return React.createElement(Surface, {
    ref,
    className: cn("rounded-lg p-6", className as string),
    ...rest,
  });
});
GenerativeSurface.displayName = "GenerativeSurface";

// =============================================================================
// GenerativeInput
// =============================================================================

export const GenerativeInput = forwardRef<
  HTMLInputElement,
  Record<string, unknown>
>(function GenerativeInput(props, ref) {
  return React.createElement(Input, {
    ref,
    className: cn("w-full", readClassName(props)),
    ...stripClassName(props),
  });
});
GenerativeInput.displayName = "GenerativeInput";

// =============================================================================
// GenerativeInputArea
// =============================================================================

export const GenerativeInputArea = forwardRef<
  HTMLTextAreaElement,
  Record<string, unknown>
>(function GenerativeInputArea(props, ref) {
  return React.createElement(InputArea, {
    ref,
    className: cn("w-full", readClassName(props)),
    ...stripClassName(props),
  });
});
GenerativeInputArea.displayName = "GenerativeInputArea";

// =============================================================================
// GenerativeCloudflareLogo
// =============================================================================

export const GenerativeCloudflareLogo = forwardRef<
  SVGSVGElement,
  Record<string, unknown>
>(function GenerativeCloudflareLogo(props, ref) {
  const variant = props["variant"];
  const isGlyph = variant === "glyph";

  const width = props["width"];
  const height = props["height"];
  const hasWidth = typeof width === "number" || typeof width === "string";
  const hasHeight = typeof height === "number" || typeof height === "string";

  const defaultSizeProps: Record<string, unknown> =
    hasWidth || hasHeight
      ? {}
      : isGlyph
        ? { width: 72, height: 32 }
        : { width: 180, height: 60 };

  return React.createElement(CloudflareLogo, {
    ref,
    className: cn(readClassName(props)),
    ...defaultSizeProps,
    ...stripClassName(props),
  });
});
GenerativeCloudflareLogo.displayName = "GenerativeCloudflareLogo";

// =============================================================================
// GenerativeGrid
// =============================================================================

/**
 * Grid wrapper that defaults `variant` and `gap` when the LLM omits them.
 *
 * Without a variant the Grid renders a single-column stack (useless).
 * Defaults `variant="2up"` only when BOTH `variant` AND `columns` are missing
 * so that an explicit `columns` prop is never overridden.
 */
export const GenerativeGrid = forwardRef<
  HTMLDivElement,
  Record<string, unknown>
>(function GenerativeGrid(props, ref) {
  const variant = props["variant"];
  const columns = props["columns"];
  const gap = props["gap"];

  const defaults: Record<string, unknown> = {};

  if (variant == null && columns == null) {
    defaults["variant"] = "2up";
  }
  if (gap == null) {
    defaults["gap"] = "base";
  }

  return React.createElement(Grid, {
    ref,
    className: cn(readClassName(props)),
    ...defaults,
    ...stripClassName(props),
  });
});
GenerativeGrid.displayName = "GenerativeGrid";

// =============================================================================
// GenerativeStack
// =============================================================================

/**
 * Stack wrapper that defaults `gap` when the LLM omits it.
 *
 * Without a gap value, Stack items collapse with no spacing. Defaulting
 * to `"base"` (16px) provides a reasonable vertical rhythm.
 */
export const GenerativeStack = forwardRef<
  HTMLDivElement,
  Record<string, unknown>
>(function GenerativeStack(props, ref) {
  const gap = props["gap"];

  const defaults: Record<string, unknown> = {};

  if (gap == null) {
    defaults["gap"] = "base";
  }

  return React.createElement(Stack, {
    ref,
    className: cn(readClassName(props)),
    ...defaults,
    ...stripClassName(props),
  });
});
GenerativeStack.displayName = "GenerativeStack";

// =============================================================================
// GenerativeText
// =============================================================================

/**
 * Text wrapper that defaults `variant` when the LLM omits it.
 *
 * Without a variant the Text component uses its own default, but being
 * explicit about `"body"` ensures consistent rendering when the LLM
 * generates Text elements without specifying a style.
 *
 * Note: Text uses `DANGEROUS_className` not `className`, so we skip
 * the className merge pattern used by other generative wrappers.
 */
export const GenerativeText = forwardRef<
  HTMLSpanElement,
  Record<string, unknown>
>(function GenerativeText(props, ref) {
  const variant = props["variant"];

  const defaults: Record<string, unknown> = {};

  if (variant == null) {
    defaults["variant"] = "body";
  }

  return React.createElement(
    Text as React.ComponentType<Record<string, unknown>>,
    {
      ref,
      ...defaults,
      ...props,
    },
  );
});
GenerativeText.displayName = "GenerativeText";

export function GenerativeTimeseriesChart(
  props: Record<string, unknown>,
): React.JSX.Element {
  const data = normalizeTimeseriesData(props["data"] ?? props["series"]);
  const chartType = props["type"] === "bar" ? "bar" : "line";

  return React.createElement(TimeseriesChart, {
    echarts,
    data,
    type: chartType,
    xAxisName: readStringProp(props["xAxisName"]) ?? "Time",
    yAxisName: readStringProp(props["yAxisName"]) ?? "Value",
    height: readNumberProp(props["height"]) ?? 280,
    gradient: props["gradient"] === true ? true : chartType === "line",
    isDarkMode: props["isDarkMode"] === true,
  });
}

// =============================================================================
// GenerativeSelect
// =============================================================================

/**
 * Select wrapper that defaults hideLabel to false when a label is provided.
 *
 * Kumo Select defaults `hideLabel=true` (sr-only). In generative forms,
 * the model typically provides `label` but not `hideLabel`, which makes
 * fields look unlabeled and breaks layout expectations.
 */
export function GenerativeSelect(
  props: Record<string, unknown>,
): React.JSX.Element {
  const passthrough = stripClassName(props);
  const label = passthrough["label"];
  const hideLabel = passthrough["hideLabel"];

  const shouldDefaultShowLabel =
    label != null && typeof hideLabel !== "boolean";

  return React.createElement(StatefulSelect, {
    className: cn("w-full", readClassName(props)),
    ...passthrough,
    ...(shouldDefaultShowLabel ? { hideLabel: false } : null),
  });
}
GenerativeSelect.displayName = "GenerativeSelect";
