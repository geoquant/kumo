import { THEME_CONFIG } from "../../../scripts/theme-generator/config";

const CHART_CATEGORICAL_COLOR_TOKENS = [
  "kumo-chart-series-blue",
  "kumo-chart-series-violet",
  "kumo-chart-series-cyan",
  "kumo-chart-series-indigo",
  "kumo-chart-series-light-blue",
  "kumo-chart-series-pink",
  "kumo-chart-series-indigo-soft",
  "kumo-chart-series-violet-strong",
  "kumo-chart-series-violet-soft",
  "kumo-chart-series-indigo-muted",
] as const;

type ChartSemanticName =
  | "Attention"
  | "Warning"
  | "Neutral"
  | "NeutralLight"
  | "Disabled"
  | "DisabledLight";

type ChartColorTokenName = keyof typeof THEME_CONFIG.color;

const CHART_SEMANTIC_COLOR_TOKENS: Record<ChartSemanticName, ChartColorTokenName> =
  {
    Attention: "kumo-chart-attention",
    Warning: "kumo-chart-warning",
    Neutral: "kumo-chart-neutral",
    NeutralLight: "kumo-chart-neutral-light",
    Disabled: "kumo-chart-disabled",
    DisabledLight: "kumo-chart-disabled-light",
  };

function getChartColorToken(
  tokenName: ChartColorTokenName,
  isDarkMode = false,
): string {
  const token = THEME_CONFIG.color[tokenName];

  if (!token) {
    throw new Error(`Unknown chart color token: ${tokenName}`);
  }

  return isDarkMode ? token.theme.kumo.dark : token.theme.kumo.light;
}

/**
 * Ordered list of categorical colors for light mode, indexed by series position.
 * Used as the default ECharts color palette when `isDarkMode` is `false`.
 */
export const CHART_LIGHT_COLORS = CHART_CATEGORICAL_COLOR_TOKENS.map(
  (tokenName) => getChartColorToken(tokenName),
);

/**
 * Ordered list of categorical colors for dark mode, indexed by series position.
 * Used as the default ECharts color palette when `isDarkMode` is `true`.
 */
export const CHART_DARK_COLORS = CHART_CATEGORICAL_COLOR_TOKENS.map(
  (tokenName) => getChartColorToken(tokenName, true),
);

/**
 * Utilities for resolving Kumo chart colors by semantic name or series index.
 * Both functions accept an `isDarkMode` flag and return the appropriate color.
 */
export namespace ChartPalette {
  /**
   * Returns the color for a named semantic value (status, severity, etc.).
   *
   * @example
   * ```ts
   * ChartPalette.semantic("Attention")           // kumo chart attention color (light)
   * ChartPalette.semantic("Warning", true)       // kumo chart warning color (dark)
   * ```
   */
  export function semantic(name: ChartSemanticName, isDarkMode = false) {
    return getChartColorToken(CHART_SEMANTIC_COLOR_TOKENS[name], isDarkMode);
  }

  /**
   * Returns the categorical color for a given series index.
   * Wraps around via modulo when `index` exceeds the palette length (10 colors).
   *
   * @example
   * ```ts
   * ChartPalette.color(0)        // first categorical color (light)
   * ChartPalette.color(0, true)  // first categorical color (dark)
   * ChartPalette.color(10)       // wraps back to the first color
   * ```
   */
  export function color(index: number, isDarkMode = false) {
    return isDarkMode
      ? CHART_DARK_COLORS[index % CHART_DARK_COLORS.length]
      : CHART_LIGHT_COLORS[index % CHART_LIGHT_COLORS.length];
  }
}

export function getChartThemeColor(
  tokenName: ChartColorTokenName,
  isDarkMode = false,
) {
  return getChartColorToken(tokenName, isDarkMode);
}
