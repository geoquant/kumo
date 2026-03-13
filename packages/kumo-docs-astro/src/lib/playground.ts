/**
 * Shared playground utilities used by /api/chat and /api/chat/prompt.
 *
 * Provides system prompt generation for the playground LLM endpoints.
 */
import {
  createKumoCatalog,
  initCatalog,
  type CustomComponentDefinition,
} from "@cloudflare/kumo/catalog";
import { ALL_GENERATIVE_TYPES } from "@cloudflare/kumo/generative";

// ---------------------------------------------------------------------------
// System prompt generation
// ---------------------------------------------------------------------------

/**
 * Types excluded from playground prompt to control token budget.
 * Everything in the generative manifest is included unless listed here.
 */
const EXCLUDED_FROM_PROMPT: ReadonlySet<string> = new Set([
  "Breadcrumbs",
  "BreadcrumbsCurrent",
  "BreadcrumbsLink",
  "BreadcrumbsSeparator",
]);

const PROMPT_COMPONENTS = ALL_GENERATIVE_TYPES.filter(
  (typeName) => !EXCLUDED_FROM_PROMPT.has(typeName),
);

/**
 * Custom component metadata for prompt generation. The actual React component
 * lives in the client bundle (DemoButton.tsx); here we only need the metadata
 * so the LLM knows the type exists and what props it accepts.
 *
 * Using a no-op stub for `component` since the server never renders it.
 */
const CUSTOM_COMPONENTS: Readonly<Record<string, CustomComponentDefinition>> = {
  DemoButton: {
    component: "span",
    description: "A fancy button with a rainbow conic-gradient hover effect",
    props: {
      children: { type: "string", description: "Button label text" },
      variant: {
        type: "string",
        description: "Visual variant",
        values: ["light", "dark"],
        default: "light",
        optional: true,
      },
    },
  },
  PieChart: {
    component: "span",
    description:
      "A playground-only pie or donut chart for quick categorical chart demos",
    props: {
      title: {
        type: "string",
        description: "Chart title shown above the visualization",
        optional: true,
      },
      description: {
        type: "string",
        description: "Short supporting copy shown under the title",
        optional: true,
      },
      variant: {
        type: "string",
        description: "Chart style",
        values: ["pie", "donut"],
        default: "pie",
        optional: true,
      },
    },
  },
};

const PLAYGROUND_PROMPT_SUPPLEMENT = [
  "# Playground Overrides",
  "",
  "This playground does not use the default 30-element response cap.",
  "- Do not limit responses to 30 elements.",
  "- Render as many elements as needed to fully satisfy the request.",
  "- Prefer completeness and correct component variants over brevity.",
  "",
  "## Chart Request Mapping",
  "",
  "- For a simple chart request, render a clear chart card with a title, brief description, and the chart.",
  '- Treat `line chart`, `trend chart`, and `timeseries` as `TimeseriesChart` with `type: "line"`.',
  '- Treat `area chart` as `TimeseriesChart` with `type: "line"` and `gradient: true`.',
  '- Treat `bar chart` or `column chart` as `TimeseriesChart` with `type: "bar"`.',
  '- Treat `pie chart` or `donut chart` as `PieChart` with `variant: "pie" | "donut"`.',
].join("\n");

const INCREMENTAL_CHART_STREAMING_PROMPT_SUPPLEMENT = [
  "# Incremental Chart Streaming",
  "",
  "For multi-chart requests, optimize for visible progressive rendering in the playground preview.",
  "- Emit JSONL in strict top-down order.",
  "- Never emit a single patch to `/elements` containing the whole tree.",
  "- Only emit `add` ops to `/elements/<key>` one element per line.",
  "- Build the first chart card completely before starting the second chart card.",
  "- Build the second chart card completely before starting the third chart card.",
  "- Keep chart cards stacked vertically in one parent `Stack` unless the user explicitly asks for a grid.",
  "- Start with the outer page container and heading, then first chart card subtree, then next subtree, then final subtree.",
].join("\n");

export function addPlaygroundPromptSupplement(prompt: string): string {
  return `${prompt}\n\n${PLAYGROUND_PROMPT_SUPPLEMENT}`;
}

export function isMultiChartRequest(message: string): boolean {
  const normalized = message.toLowerCase();
  const chartMentionCount = [
    normalized.includes("line chart"),
    normalized.includes("bar chart"),
    normalized.includes("column chart"),
    normalized.includes("area chart"),
    normalized.includes("pie chart"),
    normalized.includes("donut chart"),
  ].filter(Boolean).length;

  return (
    normalized.includes("chart demo") ||
    normalized.includes("chart examples") ||
    normalized.includes("basic charts") ||
    normalized.includes("multiple charts") ||
    chartMentionCount >= 2
  );
}

export function buildRequestPromptSupplement(
  message: string,
): string | undefined {
  if (isMultiChartRequest(message)) {
    return INCREMENTAL_CHART_STREAMING_PROMPT_SUPPLEMENT;
  }

  return undefined;
}

/** Cached system prompt ��� generated once per cold start. */
let systemPromptCache: string | null = null;
let systemPromptPromise: Promise<string> | null = null;

/**
 * Generate and cache the system prompt used for Workers AI requests.
 * In dev mode, rebuilds on every call for fast iteration.
 */
export async function getSystemPrompt(): Promise<string> {
  // In dev, rebuild prompt on each request so prompt tweaks are immediately
  // reflected without needing to restart the dev server.
  if (import.meta.env.DEV) {
    const catalog = createKumoCatalog({ customComponents: CUSTOM_COMPONENTS });
    await initCatalog(catalog);
    return addPlaygroundPromptSupplement(
      catalog.generatePrompt({
        components: [...PROMPT_COMPONENTS],
        maxPropsPerComponent: 8,
      }),
    );
  }

  if (systemPromptCache) return systemPromptCache;
  if (systemPromptPromise) return systemPromptPromise;

  systemPromptPromise = (async () => {
    try {
      const catalog = createKumoCatalog({
        customComponents: CUSTOM_COMPONENTS,
      });
      await initCatalog(catalog);
      const prompt = addPlaygroundPromptSupplement(
        catalog.generatePrompt({
          components: [...PROMPT_COMPONENTS],
          maxPropsPerComponent: 8,
        }),
      );
      systemPromptCache = prompt;
      return prompt;
    } catch (err) {
      // Clear promise so next request retries instead of caching the rejection.
      systemPromptPromise = null;
      throw err;
    }
  })();

  return systemPromptPromise;
}
