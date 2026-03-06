import type { KumoTranslation } from "../localize/types";

/**
 * French translations for Kumo UI strings.
 *
 * Keys listed in `PENDING_STRINGS` are not yet translated and will
 * fall back to English via the translation registry.
 */

/** Keys awaiting professional translation. */
type PendingStrings =
  | "close"
  | "copy"
  | "copied"
  | "copy-to-clipboard"
  | "copied-to-clipboard"
  | "loading"
  | "no-results-found"
  | "optional"
  | "more-information"
  | "cancel"
  | "first-page"
  | "previous-page"
  | "next-page"
  | "last-page"
  | "page-number"
  | "page-size"
  | "per-page"
  | "showing-range"
  | "sensitive-value"
  | "click-to-reveal"
  | "hide-value"
  | "reveal-value"
  | "value-masked"
  | "value-hidden"
  | "click-or-press-enter-to-reveal"
  | "previous-month"
  | "next-month"
  | "edit-month-and-year"
  | "reset-dates"
  | "timezone"
  | "selected-as-start-date"
  | "selected-as-end-date"
  | "within-selected-range"
  | "resize-column"
  | "click-to-copy"
  | "copy-command"
  | "logo"
  | "delete-resource"
  | "delete-action-cannot-be-undone"
  | "type-to-confirm"
  | "confirm-deletion-aria-label"
  | "copy-resource-name-to-clipboard"
  | "delete-resource-type";

const fr: Omit<KumoTranslation, PendingStrings> = {
  $code: "fr",
  $name: "Français",
  $dir: "ltr",
};

export default fr as KumoTranslation;
