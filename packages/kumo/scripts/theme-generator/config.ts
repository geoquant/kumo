/**
 * Kumo Theme Configuration
 *
 * Single source of truth for all semantic color tokens and typography.
 * This config is used to generate:
 * - theme-kumo.css (base theme)
 * - theme-fedramp.css (fedramp overrides)
 * - Any future theme files
 *
 * Token naming:
 * - Key = current token name used in codebase
 * - newName = future name (empty string = no migration planned)
 */

import type { ThemeConfig } from "./types.js";

export const THEME_CONFIG: ThemeConfig = {
  /**
   * Text color tokens
   * Used with: text-{token}
   * CSS variable: --text-color-{token}
   */
  text: {
    "kumo-default": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-neutral-900, oklch(21% 0.006 285.885))",
          dark: "var(--color-neutral-100, oklch(97% 0 0))",
        },
      },
    },
    "kumo-inverse": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-neutral-100, oklch(97% 0 0))",
          dark: "var(--color-neutral-900, oklch(20.5% 0 0))",
        },
      },
    },
    "kumo-strong": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-neutral-600, oklch(43.9% 0 0))",
          dark: "var(--color-neutral-400, oklch(70.8% 0 0))",
        },
      },
    },
    "kumo-subtle": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-neutral-500, oklch(55.6% 0 0))",
          dark: "var(--color-kumo-neutral-50, oklch(97.5% 0 0))",
        },
      },
    },
    "kumo-inactive": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-neutral-400, oklch(70.8% 0 0))",
          dark: "var(--color-neutral-600, oklch(70.8% 0 0))",
        },
      },
    },
    "kumo-placeholder": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-neutral-400, oklch(70.8% 0 0))",
          dark: "var(--color-neutral-500, oklch(55.6% 0 0))",
        },
      },
    },
    "kumo-brand": {
      newName: "",
      theme: {
        kumo: {
          light: "#f6821f",
          dark: "#f6821f",
        },
      },
    },
    "kumo-link": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-blue-800, oklch(42.4% 0.199 265.638))",
          dark: "var(--color-blue-400, oklch(70.7% 0.165 254.624))",
        },
      },
    },
    "kumo-success": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-green-500, oklch(72.3% 0.219 149.579))",
          dark: "var(--color-green-400, oklch(79.2% 0.209 151.711))",
        },
      },
    },
    "kumo-danger": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-red-500, oklch(63.7% 0.237 25.331))",
          dark: "var(--color-red-400, oklch(70.4% 0.191 22.216))",
        },
      },
    },
    "kumo-warning": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-yellow-800, oklch(47.6% 0.114 61.907))",
          dark: "var(--color-yellow-400, oklch(85.2% 0.199 91.936))",
        },
      },
    },
  },

  /**
   * Color tokens
   * Used with: bg-{token}, border-{token}, ring-{token}, etc.
   * CSS variable: --color-{token}
   */
  color: {
    "kumo-surface": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-kumo-neutral-25, oklch(99% 0 0))",
          dark: "var(--color-kumo-neutral-975, oklch(8.5% 0 0))",
        },
        fedramp: {
          light: "#5b697c",
          dark: "#5b697c",
        },
      },
    },
    "kumo-recessed": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-kumo-neutral-50, oklch(97.5% 0 0))",
          dark: "var(--color-kumo-neutral-925, oklch(18% 0 0))",
        },
      },
    },
    "kumo-base": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-white, #fff)",
          dark: "var(--color-kumo-neutral-850, oklch(22.4% 0 0))",
        },
        fedramp: {
          light: "#5b697c",
          dark: "#5b697c",
        },
      },
    },
    "kumo-tint": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-kumo-neutral-75, oklch(96.7% 0 0))",
          dark: "var(--color-kumo-neutral-800, oklch(26.9% 0 0))",
        },
      },
    },
    "kumo-contrast": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-kumo-neutral-975, oklch(8.5% 0 0))",
          dark: "var(--color-kumo-neutral-25, oklch(99% 0 0))",
        },
      },
    },
    /**
     * TO DEPRECIATE
     * In an effort to reduce the amount of greyscale tokens used in Kumo & Stratus, these tokens will be replaced and depreciated
     */
    "kumo-elevated": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-kumo-neutral-25, oklch(98.5% 0 0))",
          dark: "var(--color-neutral-950, oklch(14.5% 0 0))",
        },
      },
    },
    "kumo-overlay": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-kumo-neutral-50, oklch(97.5% 0 0))",
          dark: "var(--color-neutral-800, oklch(26.9% 0 0))",
        },
      },
    },
    "kumo-control": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-white, #fff)",
          dark: "var(--color-neutral-900, oklch(21% 0.006 285.885))",
        },
      },
    },
    "kumo-interact": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-neutral-300, oklch(87% 0 0))",
          dark: "var(--color-neutral-700, oklch(37.1% 0 0))",
        },
      },
    },
    "kumo-fill": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-neutral-200, oklch(92.2% 0 0))",
          dark: "var(--color-neutral-800, oklch(26.9% 0 0))",
        },
      },
    },
    "kumo-fill-hover": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-neutral-200, oklch(92.2% 0 0))",
          dark: "var(--color-neutral-700, oklch(37.1% 0 0))",
        },
      },
    },
    "kumo-brand": {
      newName: "",
      theme: {
        kumo: {
          light: "oklch(0.5772 0.2324 260)",
          dark: "oklch(0.5772 0.2324 260)",
        },
      },
    },
    "kumo-brand-hover": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-blue-700, oklch(48.8% 0.243 264.376))",
          dark: "var(--color-blue-700, oklch(48.8% 0.243 264.376))",
        },
      },
    },
    "kumo-line": {
      newName: "",
      theme: {
        kumo: {
          light: "oklch(14.5% 0 0 / 0.1)",
          dark: "var(--color-neutral-800, oklch(26.9% 0 0))",
        },
      },
    },
    "kumo-ring": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-kumo-neutral-150, oklch(93.5% 0 0))",
          dark: "var(--color-neutral-700, oklch(37.1% 0 0))",
        },
        fedramp: {
          light: "#c8d4e5",
          dark: "#c8d4e5",
        },
      },
    },
    "kumo-tip-shadow": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-gray-200, oklch(92.8% 0.006 264.531))",
          dark: "transparent",
        },
      },
    },
    "kumo-tip-stroke": {
      newName: "",
      theme: {
        kumo: {
          light: "transparent",
          dark: "var(--color-neutral-800, oklch(26.9% 0 0))",
        },
      },
    },
    "kumo-info": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-blue-500, oklch(62.3% 0.214 259.815))",
          dark: "var(--color-blue-400, oklch(70.7% 0.165 254.624))",
        },
      },
    },
    "kumo-info-tint": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-blue-300, oklch(80.9% 0.105 251.813))",
          dark: "var(--color-blue-900, oklch(37.9% 0.146 265.522))",
        },
      },
    },
    "kumo-warning": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-yellow-500, oklch(79.5% 0.184 86.047))",
          dark: "var(--color-yellow-700, oklch(55.4% 0.135 66.442))",
        },
      },
    },
    "kumo-warning-tint": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-yellow-300, oklch(90.5% 0.182 98.111))",
          dark: "var(--color-yellow-900, oklch(42.1% 0.095 57.708))",
        },
      },
    },
    "kumo-danger": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-red-500, oklch(63.7% 0.237 25.331))",
          dark: "var(--color-red-700, oklch(50.5% 0.213 27.518))",
        },
      },
    },
    "kumo-danger-tint": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-red-300, oklch(80.8% 0.114 19.571))",
          dark: "var(--color-red-900, oklch(39.6% 0.141 25.723))",
        },
      },
    },
    "kumo-success": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-green-500, oklch(72.3% 0.219 149.579))",
          dark: "var(--color-green-700, oklch(52.7% 0.154 150.069))",
        },
      },
    },
    "kumo-success-tint": {
      newName: "",
      theme: {
        kumo: {
          light: "var(--color-green-300, oklch(87.1% 0.15 154.449))",
          dark: "var(--color-green-900, oklch(39.3% 0.095 152.535))",
        },
      },
    },
    "kumo-chart-series-blue": {
      newName: "",
      description: "Primary categorical chart series color.",
      theme: {
        kumo: {
          light: "#086FFF",
          dark: "#086FFFE6",
        },
      },
    },
    "kumo-chart-series-violet": {
      newName: "",
      description: "Secondary categorical chart series color.",
      theme: {
        kumo: {
          light: "#CF7EE9",
          dark: "#CF7EE9E6",
        },
      },
    },
    "kumo-chart-series-cyan": {
      newName: "",
      description: "Categorical chart series color for tertiary datasets.",
      theme: {
        kumo: {
          light: "#73CEE6",
          dark: "#73CEE6E6",
        },
      },
    },
    "kumo-chart-series-indigo": {
      newName: "",
      description: "Categorical chart series color for additional datasets.",
      theme: {
        kumo: {
          light: "#5B5FEF",
          dark: "#5B5FEFE6",
        },
      },
    },
    "kumo-chart-series-light-blue": {
      newName: "",
      description: "Light blue categorical chart series color.",
      theme: {
        kumo: {
          light: "#82B6FF",
          dark: "#82B6FFE6",
        },
      },
    },
    "kumo-chart-series-pink": {
      newName: "",
      description: "Pink categorical chart series color.",
      theme: {
        kumo: {
          light: "#F5609F",
          dark: "#F5609FE6",
        },
      },
    },
    "kumo-chart-series-indigo-soft": {
      newName: "",
      description: "Soft indigo categorical chart series color.",
      theme: {
        kumo: {
          light: "#C2BDF3",
          dark: "#C2BDF3E6",
        },
      },
    },
    "kumo-chart-series-violet-strong": {
      newName: "",
      description: "Strong violet categorical chart series color.",
      theme: {
        kumo: {
          light: "#8D1EB1",
          dark: "#8D1EB1E6",
        },
      },
    },
    "kumo-chart-series-violet-soft": {
      newName: "",
      description: "Soft violet categorical chart series color.",
      theme: {
        kumo: {
          light: "#EBCAF6",
          dark: "#EBCAF6E6",
        },
      },
    },
    "kumo-chart-series-indigo-muted": {
      newName: "",
      description: "Muted indigo categorical chart series color.",
      theme: {
        kumo: {
          light: "#7366E4",
          dark: "#7366E4E6",
        },
      },
    },
    "kumo-chart-attention": {
      newName: "",
      description: "Semantic chart color for attention or error states.",
      theme: {
        kumo: {
          light: "#FC574A",
          dark: "#FC574AE6",
        },
      },
    },
    "kumo-chart-warning": {
      newName: "",
      description: "Semantic chart color for warning states.",
      theme: {
        kumo: {
          light: "#F8A054",
          dark: "#F8A054E6",
        },
      },
    },
    "kumo-chart-neutral": {
      newName: "",
      description: "Semantic chart color for neutral highlighted series.",
      theme: {
        kumo: {
          light: "#82B6FF",
          dark: "#82B6FFE6",
        },
      },
    },
    "kumo-chart-neutral-light": {
      newName: "",
      description: "Lighter semantic chart color for neutral comparison series.",
      theme: {
        kumo: {
          light: "#B9D6FF",
          dark: "#B9D6FFE6",
        },
      },
    },
    "kumo-chart-disabled": {
      newName: "",
      description: "Semantic chart color for disabled or de-emphasized series.",
      theme: {
        kumo: {
          light: "#B6B6B6",
          dark: "#B6B6B6E6",
        },
      },
    },
    "kumo-chart-disabled-light": {
      newName: "",
      description: "Lighter disabled chart color for secondary de-emphasis.",
      theme: {
        kumo: {
          light: "#D9D9D9",
          dark: "#D9D9D9E6",
        },
      },
    },
    "kumo-chart-brush-fill": {
      newName: "",
      description: "Brush selection fill color used in timeseries charts.",
      theme: {
        kumo: {
          light: "rgba(120,140,180,0.3)",
          dark: "rgba(120,140,180,0.3)",
        },
      },
    },
    "kumo-chart-brush-stroke": {
      newName: "",
      description: "Brush selection border color used in timeseries charts.",
      theme: {
        kumo: {
          light: "rgba(120,140,180,0.8)",
          dark: "rgba(120,140,180,0.8)",
        },
      },
    },
    "kumo-chart-loader-stroke": {
      newName: "",
      description: "Loading skeleton stroke color used in timeseries charts.",
      theme: {
        kumo: {
          light: "rgba(0,0,0,0.2)",
          dark: "rgba(255,255,255,0.5)",
        },
      },
    },
  },

  /**
   * Typography tokens
   * Used with: text-{size} utilities
   * CSS variables: --text-{size}, --text-{size}--line-height
   *
   * Note: Typography is NOT theme-dependent (no light/dark mode).
   * Values are the same across color modes but may differ per theme.
   */
  typography: {
    xs: {
      newName: "",
      theme: {
        kumo: "12px",
      },
    },
    "xs--line-height": {
      newName: "",
      theme: {
        kumo: "calc(1 / 0.75)",
      },
    },
    sm: {
      newName: "",
      theme: {
        kumo: "13px",
      },
    },
    "sm--line-height": {
      newName: "",
      theme: {
        kumo: "calc(1 / 0.85)",
      },
    },
    base: {
      newName: "",
      theme: {
        kumo: "14px",
      },
    },
    "base--line-height": {
      newName: "",
      theme: {
        kumo: "calc(1.25 / 0.875)",
      },
    },
    lg: {
      newName: "",
      theme: {
        kumo: "16px",
      },
    },
    "lg--line-height": {
      newName: "",
      theme: {
        kumo: "calc(1.25 / 1)",
      },
    },
  },
};

/** List of all available themes */
export const AVAILABLE_THEMES = ["kumo", "fedramp"] as const;
export type AvailableTheme = (typeof AVAILABLE_THEMES)[number];
