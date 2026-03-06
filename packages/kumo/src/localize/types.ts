/**
 * Shape of a Kumo translation object.
 *
 * Every locale must implement this interface. The `$`-prefixed fields are
 * metadata; the rest are translation keys consumed by `useLocalize().term()`.
 *
 * **Simple keys** are plain strings.
 * **Parameterized keys** are functions that accept runtime arguments and return
 * a string — this keeps consumers type-safe without a MessageFormat runtime.
 *
 * All translation keys use **kebab-case** (e.g. `"copy-to-clipboard"`).
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
  readonly "copy-to-clipboard": string;
  readonly "copied-to-clipboard": string;
  readonly loading: string;
  readonly "no-results-found": string;
  readonly "no-labels-found": string;
  readonly optional: string;
  readonly "more-information": string;
  readonly cancel: string;

  // ── Pagination ────────────────────────────────────────────────────────
  readonly "first-page": string;
  readonly "previous-page": string;
  readonly "next-page": string;
  readonly "last-page": string;
  readonly "page-number": string;
  readonly "page-size": string;
  readonly "per-page": string;
  readonly "showing-range": (
    start: number,
    end: number,
    total: number,
  ) => string;

  // ── Sensitive Input ───────────────────────────────────────────────────
  readonly "sensitive-value": string;
  readonly "click-to-reveal": string;
  readonly "hide-value": string;
  readonly "reveal-value": string;
  readonly "value-masked": string;
  readonly "masked-sensitive-value": (label: string) => string;
  readonly "value-hidden": string;
  readonly "click-or-press-enter-to-reveal": string;

  // ── Date Range Picker ─────────────────────────────────────────────────
  readonly "previous-month": string;
  readonly "next-month": string;
  readonly "edit-month-and-year": string;
  readonly "reset-dates": string;
  readonly timezone: (tz: string) => string;
  readonly "selected-as-start-date": (date: string) => string;
  readonly "selected-as-end-date": (date: string) => string;
  readonly "within-selected-range": (date: string) => string;

  // ── Table ─────────────────────────────────────────────────────────────
  readonly "resize-column": string;
  readonly "select-row": string;
  readonly "select-all-rows": string;

  // ── Breadcrumbs / Empty ───────────────────────────────────────────────
  readonly "click-to-copy": string;
  readonly "copy-command": string;
  readonly breadcrumb: string;

  // ── Cloudflare Logo ───────────────────────────────────────────────────
  readonly logo: string;
  readonly "cloudflare-logo": string;
  readonly "powered-by-cloudflare": string;

  // ── Delete Resource Block ─────────────────────────────────────────────
  readonly "delete-resource": (resourceName: string) => string;
  readonly "delete-action-cannot-be-undone": (
    resourceName: string,
    resourceType: string,
  ) => string;
  readonly "type-to-confirm": (resourceName: string) => string;
  readonly "confirm-deletion-aria-label": (resourceName: string) => string;
  readonly "copy-resource-name-to-clipboard": (resourceName: string) => string;
  readonly "delete-resource-type": (resourceType: string) => string;
}
