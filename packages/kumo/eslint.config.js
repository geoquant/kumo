import jsxA11y from "eslint-plugin-jsx-a11y";
import tailwind from "eslint-plugin-tailwindcss";
import tseslint from "typescript-eslint";

/**
 * ESLint config — supplements oxlint with rules it can't handle:
 * - jsx-a11y: 7 rules not yet implemented in oxlint
 * - tailwindcss: class ordering + shorthand enforcement
 *
 * @see https://github.com/oxc-project/oxc/issues/1141
 */
export default [
  // jsx-a11y rules only
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "jsx-a11y": jsxA11y,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      // ============================================
      // 7 MISSING jsx-a11y rules (6 recommended + 1 not recommended)
      // These are not yet implemented in oxlint
      // https://github.com/oxc-project/oxc/issues/1141
      // ============================================

      // Validates ARIA state and property values
      "jsx-a11y/aria-proptypes": "error",

      // Interactive elements must be focusable
      "jsx-a11y/interactive-supports-focus": "error",

      // Don't assign non-interactive roles to interactive elements
      "jsx-a11y/no-interactive-element-to-noninteractive-role": "error",

      // Non-interactive elements should not have event handlers
      "jsx-a11y/no-noninteractive-element-interactions": "error",

      // Don't assign interactive roles to non-interactive elements
      "jsx-a11y/no-noninteractive-element-to-interactive-role": "error",

      // Static elements (div, span) should not have event handlers
      "jsx-a11y/no-static-element-interactions": "error",

      // Note: control-has-associated-label is not in jsx-a11y's recommended set
      // due to false positives (doesn't detect aria-label, aria-labelledby, etc.)
      "jsx-a11y/control-has-associated-label": "warn",
    },
  },
  // Tailwind CSS class ordering + shorthand enforcement
  // Uses beta (v4) for Tailwind v4 compatibility.
  // Skipped rules:
  //   no-contradicting-classname — known false positives with Tailwind v4
  //   no-custom-classname — would flag all kumo semantic tokens (bg-kumo-*, etc.)
  //   no-arbitrary-value — kumo uses arbitrary values legitimately
  //   migration-from-tailwind-2 — irrelevant (already on v4)
  {
    files: ["src/components/**/*.tsx"],
    plugins: {
      tailwindcss: tailwind,
    },
    settings: {
      tailwindcss: {
        // Tailwind v4 has no JS config; empty object suppresses the
        // "Cannot resolve default config path" warning.
        config: {},
        // Include cn() (kumo's className composer) alongside defaults
        callees: ["classnames", "clsx", "ctl", "cva", "tv", "cn"],
      },
    },
    rules: {
      "tailwindcss/classnames-order": "warn",
      "tailwindcss/enforces-shorthand": "warn",
      "tailwindcss/enforces-negative-arbitrary-values": "warn",
      "tailwindcss/no-unnecessary-arbitrary-value": "warn",
    },
  },
  // Ignore patterns
  {
    ignores: ["dist/**", "node_modules/**", "*.config.*"],
  },
];
