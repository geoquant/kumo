import type { KumoTranslation } from "../localize/types";

/**
 * English translations — source of truth for all Kumo UI strings.
 *
 * Every value here matches the string currently hardcoded in the
 * corresponding component source file.
 */
const en: KumoTranslation = {
  // ── Metadata ──────────────────────────────────────────────────────────
  $code: "en",
  $name: "English",
  $dir: "ltr",

  // ── General ───────────────────────────────────────────────────────────
  close: "Close",
  copy: "Copy",
  copied: "Copied",
  "copy-to-clipboard": "Copy to clipboard",
  "copied-to-clipboard": "Copied to clipboard",
  loading: "Loading",
  "no-results-found": "No results found",
  "no-labels-found": "No labels found.",
  optional: "optional",
  "more-information": "More information",
  cancel: "Cancel",

  // ── Pagination ────────────────────────────────────────────────────────
  "first-page": "First page",
  "previous-page": "Previous page",
  "next-page": "Next page",
  "last-page": "Last page",
  "page-number": "Page number",
  "page-size": "Page size",
  "per-page": "Per page:",
  "showing-range": (start, end, total) => `Showing ${start}-${end} of ${total}`,

  // ── Sensitive Input ───────────────────────────────────────────────────
  "sensitive-value": "Sensitive value",
  "click-to-reveal": "Click to reveal",
  "hide-value": "Hide value",
  "reveal-value": "Reveal value",
  "value-masked": "masked",
  "value-hidden": "Value hidden",
  "click-or-press-enter-to-reveal": "Click or press Enter to reveal.",

  // ── Date Range Picker ─────────────────────────────────────────────────
  "previous-month": "Previous month",
  "next-month": "Next month",
  "edit-month-and-year": "Edit month and year",
  "reset-dates": "Reset Dates",
  timezone: (tz) => `Timezone: ${tz}`,
  "selected-as-start-date": (date) => `${date}, selected as start date`,
  "selected-as-end-date": (date) => `${date}, selected as end date`,
  "within-selected-range": (date) => `${date}, within selected range`,

  // ── Table ─────────────────────────────────────────────────────────────
  "resize-column": "Resize column",
  "select-row": "Select row",
  "select-all-rows": "Select all rows",

  // ── Breadcrumbs / Empty ───────────────────────────────────────────────
  "click-to-copy": "Click to copy",
  "copy-command": "Copy command",

  // ── Cloudflare Logo ───────────────────────────────────────────────────
  logo: "logo",
  "powered-by-cloudflare": "Powered by Cloudflare",

  // ── Delete Resource Block ─────────────────────────────────────────────
  "delete-resource": (resourceName) => `Delete ${resourceName}`,
  "delete-action-cannot-be-undone": (resourceName, resourceType) =>
    `This action cannot be undone. This will permanently delete the ${resourceName} ${resourceType}.`,
  "type-to-confirm": (resourceName) => `Type ${resourceName} to confirm:`,
  "confirm-deletion-aria-label": (resourceName) =>
    `Type ${resourceName} to confirm deletion`,
  "copy-resource-name-to-clipboard": (resourceName) =>
    `Copy ${resourceName} to clipboard`,
  "delete-resource-type": (resourceType) => `Delete ${resourceType}`,
};

export default en;
