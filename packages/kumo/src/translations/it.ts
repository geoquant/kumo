import type { KumoTranslation } from "../localize/types";

/**
 * Italian translations for Kumo UI strings.
 *
 * Keys listed in `PENDING_STRINGS` are not yet translated and will
 * fall back to English via the translation registry.
 */

/** Keys awaiting professional translation. */
type PendingStrings =
  | "close"
  | "copy"
  | "copied"
  | "copyToClipboard"
  | "copiedToClipboard"
  | "loading"
  | "noResultsFound"
  | "optional"
  | "moreInformation"
  | "cancel"
  | "firstPage"
  | "previousPage"
  | "nextPage"
  | "lastPage"
  | "pageNumber"
  | "pageSize"
  | "perPage"
  | "showingRange"
  | "sensitiveValue"
  | "clickToReveal"
  | "hideValue"
  | "revealValue"
  | "valueMasked"
  | "valueHidden"
  | "clickOrPressEnterToReveal"
  | "previousMonth"
  | "nextMonth"
  | "editMonthAndYear"
  | "resetDates"
  | "timezone"
  | "selectedAsStartDate"
  | "selectedAsEndDate"
  | "withinSelectedRange"
  | "resizeColumn"
  | "clickToCopy"
  | "copyCommand"
  | "cloudflareLogo"
  | "deleteResource"
  | "deleteActionCannotBeUndone"
  | "typeToConfirm"
  | "confirmDeletionAriaLabel"
  | "copyResourceNameToClipboard"
  | "deleteResourceType";

const it: Omit<KumoTranslation, PendingStrings> = {
  $code: "it",
  $name: "Italiano",
  $dir: "ltr",
};

export default it as KumoTranslation;
