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
  copyToClipboard: "Copy to clipboard",
  copiedToClipboard: "Copied to clipboard",
  loading: "Loading",
  noResultsFound: "No results found",
  optional: "(optional)",
  moreInformation: "More information",
  cancel: "Cancel",

  // ── Pagination ────────────────────────────────────────────────────────
  firstPage: "First page",
  previousPage: "Previous page",
  nextPage: "Next page",
  lastPage: "Last page",
  pageNumber: "Page number",
  pageSize: "Page size",
  perPage: "Per page:",
  showingRange: (start, end, total) => `Showing ${start}-${end} of ${total}`,

  // ── Sensitive Input ───────────────────────────────────────────────────
  sensitiveValue: "Sensitive value",
  clickToReveal: "Click to reveal",
  hideValue: "Hide value",
  revealValue: "Reveal value",
  valueMasked: "masked",
  valueHidden: "Value hidden",
  clickOrPressEnterToReveal: "Click or press Enter to reveal.",

  // ── Date Range Picker ─────────────────────────────────────────────────
  previousMonth: "Previous month",
  nextMonth: "Next month",
  editMonthAndYear: "Edit month and year",
  resetDates: "Reset Dates",
  timezone: (tz) => `Timezone: ${tz}`,
  selectedAsStartDate: (date) => `${date}, selected as start date`,
  selectedAsEndDate: (date) => `${date}, selected as end date`,
  withinSelectedRange: (date) => `${date}, within selected range`,

  // ── Table ─────────────────────────────────────────────────────────────
  resizeColumn: "Resize column",

  // ── Breadcrumbs / Empty ───────────────────────────────────────────────
  clickToCopy: "Click to copy",
  copyCommand: "Copy command",

  // ── Cloudflare Logo ───────────────────────────────────────────────────
  cloudflareLogo: "Cloudflare logo",

  // ── Delete Resource Block ─────────────────────────────────────────────
  deleteResource: (resourceName) => `Delete ${resourceName}`,
  deleteActionCannotBeUndone: (resourceName, resourceType) =>
    `This action cannot be undone. This will permanently delete the ${resourceName} ${resourceType}.`,
  typeToConfirm: (resourceName) => `Type ${resourceName} to confirm:`,
  confirmDeletionAriaLabel: (resourceName) =>
    `Type ${resourceName} to confirm deletion`,
  copyResourceNameToClipboard: (resourceName) =>
    `Copy ${resourceName} to clipboard`,
  deleteResourceType: (resourceType) => `Delete ${resourceType}`,
};

export default en;
