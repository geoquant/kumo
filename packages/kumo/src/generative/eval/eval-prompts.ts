/**
 * Eval prompt fixtures for deterministic composition grading.
 *
 * Each prompt describes a UI in natural language. The eval harness feeds
 * these to the LLM (or loads pre-generated JSONL fixtures), parses the
 * output to a UITree, then grades with gradeTree() + gradeComposition().
 *
 * `expectedPattern` hints at the expected layout template:
 *   - Known patterns: "product-overview", "service-detail", "service-tabs",
 *     "dashboard", "form", "table"
 *   - "novel" = no template match expected; tests the LLM's ability to
 *     compose a reasonable layout from first principles.
 *
 * `requiredElements` lists element types that MUST appear in the output.
 * `requiredPatterns` lists structural patterns (e.g. "two-column", "tabs")
 * that the eval harness can verify via tree inspection.
 */

/** Known layout patterns that map to system prompt examples. */
export type ExpectedPattern =
  | "product-overview"
  | "service-detail"
  | "service-tabs"
  | "dashboard"
  | "form"
  | "table"
  | "novel";

/** Structural patterns verifiable by tree inspection. */
export type RequiredPattern =
  | "two-column"
  | "tabs"
  | "stat-grid"
  | "header-actions"
  | "empty-state"
  | "form-with-submit"
  | "table-with-header"
  | "surface-hierarchy";

export interface EvalPrompt {
  /** Unique identifier (e.g. "eval-product-overview-1"). */
  readonly id: string;
  /** Natural language prompt describing desired UI. */
  readonly prompt: string;
  /** Expected layout pattern for classification. */
  readonly expectedPattern: ExpectedPattern;
  /** Element types that must appear in the generated tree. */
  readonly requiredElements: readonly string[];
  /** Structural patterns the harness should verify. */
  readonly requiredPatterns: readonly RequiredPattern[];
}

export const EVAL_PROMPTS: ReadonlyArray<EvalPrompt> = [
  // ── Known patterns ────────────────────────────────────────────────────

  {
    id: "eval-product-overview-1",
    prompt:
      "Show a Workers product page with request volume and error rate metrics in a sidebar, a table of deployed scripts, and links to documentation",
    expectedPattern: "product-overview",
    requiredElements: ["Surface", "Grid", "Table", "Text", "Stack", "Link"],
    requiredPatterns: ["two-column", "table-with-header", "surface-hierarchy"],
  },

  {
    id: "eval-service-detail-1",
    prompt:
      "Display a KV namespace detail page with the namespace name, a description, a purge cache button, and a table of the most recent key-value reads",
    expectedPattern: "service-detail",
    requiredElements: ["Surface", "Text", "Button", "Table", "Stack"],
    requiredPatterns: ["header-actions", "table-with-header"],
  },

  {
    id: "eval-service-tabs-1",
    prompt:
      "Build a DNS zone management page with tabs for Records, Analytics, and Settings. Records shows a table of DNS entries, Analytics shows request stats, and Settings has a form to update the zone name",
    expectedPattern: "service-tabs",
    requiredElements: ["Surface", "Tabs", "Table", "Input", "Button", "Stack"],
    requiredPatterns: ["tabs", "table-with-header", "form-with-submit"],
  },

  {
    id: "eval-dashboard-1",
    prompt:
      "Create an analytics dashboard showing four key metrics — total requests, bandwidth, cache hit ratio, and error rate — each in its own stat card, with a heading at the top",
    expectedPattern: "dashboard",
    requiredElements: ["Surface", "Grid", "Text", "Stack"],
    requiredPatterns: ["stat-grid", "surface-hierarchy"],
  },

  {
    id: "eval-form-1",
    prompt:
      "Build an API token creation form with fields for token name, permission scope (read or write), an expiration date selector, and a generate button",
    expectedPattern: "form",
    requiredElements: ["Surface", "Input", "Select", "Button", "Stack"],
    requiredPatterns: ["form-with-submit"],
  },

  {
    id: "eval-table-1",
    prompt:
      "Show a list of firewall rules with columns for rule name, action (block/allow), priority, and status, with buttons to add and export rules",
    expectedPattern: "table",
    requiredElements: [
      "Surface",
      "Table",
      "TableHeader",
      "TableBody",
      "Button",
      "Text",
    ],
    requiredPatterns: ["table-with-header", "header-actions"],
  },

  {
    id: "eval-dashboard-2",
    prompt:
      "Design a Workers overview page that shows a summary of total workers, average CPU time, and invocation count in stat cards at the top, followed by a table of individual worker scripts with their last deployment time",
    expectedPattern: "dashboard",
    requiredElements: ["Surface", "Grid", "Table", "Text", "Stack"],
    requiredPatterns: ["stat-grid", "table-with-header", "surface-hierarchy"],
  },

  // ── Novel patterns ────────────────────────────────────────────────────

  {
    id: "eval-novel-1",
    prompt:
      "Show a comparison between two Cloudflare plans side by side — Free and Pro — with feature availability, pricing, and a select button for each plan",
    expectedPattern: "novel",
    requiredElements: ["Surface", "Text", "Button", "Stack"],
    requiredPatterns: [],
  },

  {
    id: "eval-novel-2",
    prompt:
      "Create a getting-started wizard that shows three numbered steps: connect your domain, configure SSL, and enable caching. Each step has a title, a short description, and a status badge",
    expectedPattern: "novel",
    requiredElements: ["Surface", "Text", "Badge", "Stack"],
    requiredPatterns: [],
  },

  {
    id: "eval-novel-3",
    prompt:
      "Display an incident timeline for a recent outage. Show the incident title, current status badge, and a vertical list of timestamped updates, each with a short description of what happened",
    expectedPattern: "novel",
    requiredElements: ["Surface", "Text", "Badge", "Stack"],
    requiredPatterns: [],
  },

  {
    id: "eval-novel-4",
    prompt:
      "Build a notification center that lists recent alerts — each with an icon-style badge, a message, a timestamp, and a dismiss button. Include a clear-all button at the top",
    expectedPattern: "novel",
    requiredElements: ["Surface", "Text", "Button", "Badge", "Stack"],
    requiredPatterns: [],
  },

  {
    id: "eval-form-2",
    prompt:
      "Design an email routing rule editor with inputs for match condition, a dropdown for the action to take (forward, drop, or mark as spam), a toggle switch to enable the rule, and save/cancel buttons",
    expectedPattern: "form",
    requiredElements: [
      "Surface",
      "Input",
      "Select",
      "Switch",
      "Button",
      "Stack",
    ],
    requiredPatterns: ["form-with-submit"],
  },

  {
    id: "eval-service-detail-2",
    prompt:
      "Show a Durable Object namespace page with the namespace ID, class name, and a count of active instances in a header area, then a table of the five most recently active object instances with their ID, last access time, and storage used",
    expectedPattern: "service-detail",
    requiredElements: ["Surface", "Text", "Table", "Stack"],
    requiredPatterns: ["header-actions", "table-with-header"],
  },
] as const;
