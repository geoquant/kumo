/**
 * Shape of a Kumo translation object.
 *
 * Every locale must implement this interface. The `$`-prefixed fields are
 * metadata; the rest are translation keys consumed by `useLocalize().term()`.
 *
 * **Simple keys** are plain strings.
 * **Parameterized keys** are functions that accept runtime arguments and return
 * a string — this keeps consumers type-safe without a MessageFormat runtime.
 */
export interface KumoTranslation {
  // ── Metadata ──────────────────────────────────────────────────────────
  /** BCP 47 language code, e.g. `"en"`, `"zh-CN"`. */
  readonly $code: string;
  /** Human-readable language name, e.g. `"English"`. */
  readonly $name: string;
  /** Text direction. */
  readonly $dir: "ltr" | "rtl";

  // ── General ───────────────────────────────────────────────────────────
  readonly close: string;
  readonly copy: string;
  readonly copied: string;
  readonly copyToClipboard: string;
  readonly copiedToClipboard: string;
  readonly loading: string;
  readonly noResultsFound: string;
  readonly optional: string;
  readonly moreInformation: string;
  readonly cancel: string;

  // ── Pagination ────────────────────────────────────────────────────────
  readonly firstPage: string;
  readonly previousPage: string;
  readonly nextPage: string;
  readonly lastPage: string;
  readonly pageNumber: string;
  readonly pageSize: string;
  readonly perPage: string;
  readonly showingRange: (start: number, end: number, total: number) => string;

  // ── Sensitive Input ───────────────────────────────────────────────────
  readonly sensitiveValue: string;
  readonly clickToReveal: string;
  readonly hideValue: string;
  readonly revealValue: string;
  readonly valueMasked: string;
  readonly valueHidden: string;
  readonly clickOrPressEnterToReveal: string;

  // ── Date Range Picker ─────────────────────────────────────────────────
  readonly previousMonth: string;
  readonly nextMonth: string;
  readonly editMonthAndYear: string;
  readonly resetDates: string;
  readonly timezone: (tz: string) => string;
  readonly selectedAsStartDate: (date: string) => string;
  readonly selectedAsEndDate: (date: string) => string;
  readonly withinSelectedRange: (date: string) => string;

  // ── Table ─────────────────────────────────────────────────────────────
  readonly resizeColumn: string;

  // ── Breadcrumbs / Empty ───────────────────────────────────────────────
  readonly clickToCopy: string;
  readonly copyCommand: string;

  // ── Cloudflare Logo ───────────────────────────────────────────────────
  readonly cloudflareLogo: string;

  // ── Delete Resource Block ─────────────────────────────────────────────
  readonly deleteResource: (resourceName: string) => string;
  readonly deleteActionCannotBeUndone: (
    resourceName: string,
    resourceType: string,
  ) => string;
  readonly typeToConfirm: (resourceName: string) => string;
  readonly confirmDeletionAriaLabel: (resourceName: string) => string;
  readonly copyResourceNameToClipboard: (resourceName: string) => string;
  readonly deleteResourceType: (resourceType: string) => string;
}
