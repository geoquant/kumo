import type { KumoTranslation } from "../localize/types";

/**
 * Korean translations for Kumo UI strings.
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

const ko: Omit<KumoTranslation, PendingStrings> = {
  $code: "ko",
  $name: "한국어",
  $dir: "ltr",
};

export default ko as KumoTranslation;
