// @vitest-environment node

import { describe, it, expect, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

import type { KumoTranslation } from "./types.js";
import { _resetRegistry, registerTranslation } from "./registry.js";
import { KumoLocaleProvider, useLocalize } from "./index.js";

const fakeEn: KumoTranslation = {
  $code: "en",
  $name: "English",
  $dir: "ltr",
  close: "Close",
  copy: "Copy",
  copied: "Copied",
  "copy-to-clipboard": "Copy to clipboard",
  "copied-to-clipboard": "Copied to clipboard",
  loading: "Loading",
  "no-results-found": "No results found",
  optional: "(optional)",
  "more-information": "More information",
  cancel: "Cancel",
  "first-page": "First page",
  "previous-page": "Previous page",
  "next-page": "Next page",
  "last-page": "Last page",
  "page-number": "Page number",
  "page-size": "Page size",
  "per-page": "Per page:",
  "showing-range": (s, e, t) => `Showing ${s}-${e} of ${t}`,
  "sensitive-value": "Sensitive value",
  "click-to-reveal": "Click to reveal",
  "hide-value": "Hide value",
  "reveal-value": "Reveal value",
  "value-masked": "masked",
  "value-hidden": "Value hidden",
  "click-or-press-enter-to-reveal": "Click or press Enter to reveal.",
  "previous-month": "Previous month",
  "next-month": "Next month",
  "edit-month-and-year": "Edit month and year",
  "reset-dates": "Reset Dates",
  timezone: (tz) => `Timezone: ${tz}`,
  "selected-as-start-date": (d) => `${d}, selected as start date`,
  "selected-as-end-date": (d) => `${d}, selected as end date`,
  "within-selected-range": (d) => `${d}, within selected range`,
  "resize-column": "Resize column",
  "click-to-copy": "Click to copy",
  "copy-command": "Copy command",
  logo: "logo",
  "delete-resource": (n) => `Delete ${n}`,
  "delete-action-cannot-be-undone": (n, t) =>
    `This action cannot be undone. This will permanently delete the ${n} ${t}.`,
  "type-to-confirm": (n) => `Type ${n} to confirm:`,
  "confirm-deletion-aria-label": (n) => `Type ${n} to confirm deletion`,
  "copy-resource-name-to-clipboard": (n) => `Copy ${n} to clipboard`,
  "delete-resource-type": (t) => `Delete ${t}`,
};

function Consumer() {
  const localize = useLocalize();
  return createElement("div", undefined, localize.term("close"));
}

describe("localize SSR", () => {
  beforeEach(() => {
    _resetRegistry();
    registerTranslation(fakeEn);
  });

  it("does not touch document or MutationObserver in controlled mode", () => {
    const html = renderToString(
      createElement(KumoLocaleProvider, {
        locale: "en",
        detectLocale: false,
        children: createElement(Consumer),
      }),
    );

    expect(html).toContain("Close");
  });
});
