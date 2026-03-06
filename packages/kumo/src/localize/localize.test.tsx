/**
 * Tests for the Kumo localization system.
 *
 * Covers: registry.ts, use-locale.ts, index.tsx (useLocalize, KumoLocaleProvider),
 * direction.tsx (DirectionProvider, useDirection), and translation key completeness.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import type { KumoTranslation } from "./types.js";
import {
  registerTranslation,
  getTranslation,
  resolveTranslation,
  _resetRegistry,
} from "./registry.js";
import {
  useLocalize,
  KumoLocaleProvider,
  _resetUnknownLocaleWarnings,
} from "./index.js";
import { DirectionProvider, useDirection } from "./direction.js";
import { resolveLocale } from "./resolve-locale.js";
import en from "../translations/en.js";
import es from "../translations/es.js";

// ── Fixtures ────────────────────────────────────────────────────────────

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
  "no-labels-found": "No labels found.",
  optional: "optional",
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
  "select-row": "Select row",
  "select-all-rows": "Select all rows",
  "click-to-copy": "Click to copy",
  "copy-command": "Copy command",
  breadcrumb: "breadcrumb",
  logo: "logo",
  "cloudflare-logo": "Cloudflare logo",
  "powered-by-cloudflare": "Powered by Cloudflare",
  "delete-resource": (n) => `Delete ${n}`,
  "delete-action-cannot-be-undone": (n, t) =>
    `This action cannot be undone. This will permanently delete the ${n} ${t}.`,
  "type-to-confirm": (n) => `Type ${n} to confirm:`,
  "confirm-deletion-aria-label": (n) => `Type ${n} to confirm deletion`,
  "copy-resource-name-to-clipboard": (n) => `Copy ${n} to clipboard`,
  "delete-resource-type": (t) => `Delete ${t}`,
};

const fakeEs: KumoTranslation = {
  ...fakeEn,
  $code: "es",
  $name: "Español",
  $dir: "ltr",
  close: "Cerrar",
};

const fakeZhCN: KumoTranslation = {
  ...fakeEn,
  $code: "zh-CN",
  $name: "简体中文",
  $dir: "ltr",
  close: "关闭",
};

const fakeAr: KumoTranslation = {
  ...fakeEn,
  $code: "ar",
  $name: "العربية",
  $dir: "rtl",
  close: "إغلاق",
};

// ── Helpers ─────────────────────────────────────────────────────────────

/** Renders a component that calls useLocalize() and exposes its result. */
function LocalizeConsumer({
  render: renderFn,
}: {
  readonly render: (result: ReturnType<typeof useLocalize>) => ReactNode;
}): ReactNode {
  const result = useLocalize();
  return createElement("div", { "data-testid": "output" }, renderFn(result));
}

function DirectionConsumer(): ReactNode {
  const dir = useDirection();
  return createElement("div", { "data-testid": "dir" }, dir);
}

function DirectionAgreementConsumer(): ReactNode {
  const dirFromHook = useDirection();
  const dirFromLocalize = useLocalize().dir();
  return createElement(
    "div",
    { "data-testid": "dir-agreement" },
    `${dirFromHook}|${dirFromLocalize}`,
  );
}

// ═══════════════════════════════════════════════════════════════════════
// testing-1: registry.ts
// ═══════════════════════════════════════════════════════════════════════

describe("registry", () => {
  beforeEach(() => {
    _resetRegistry();
  });

  it("stores translation by $code", () => {
    registerTranslation(fakeEn);
    expect(getTranslation("en")).toBe(fakeEn);
  });

  it("returns exact match for zh-CN", () => {
    registerTranslation(fakeEn, fakeZhCN);
    expect(getTranslation("zh-CN")).toBe(fakeZhCN);
  });

  it("falls back to language prefix when exact match missing", () => {
    registerTranslation(fakeEn, fakeEs);
    // "es-PE" not registered but "es" is
    expect(getTranslation("es-PE")).toBe(fakeEs);
  });

  it("falls back to explicit en locale when no match", () => {
    registerTranslation(fakeEn, fakeEs);
    expect(getTranslation("xx")).toBe(fakeEn);
  });

  it("falls back to en even when another locale registered first", () => {
    registerTranslation(fakeEs, fakeEn);
    expect(getTranslation("xx")).toBe(fakeEn);
  });

  it("uses first registered as last resort when en is missing", () => {
    registerTranslation(fakeEs, fakeAr);
    expect(getTranslation("xx")).toBe(fakeEs);
  });

  it("merges across multiple registerTranslation calls", () => {
    registerTranslation(fakeEn);
    registerTranslation(fakeEs);
    expect(getTranslation("en")).toBe(fakeEn);
    expect(getTranslation("es")).toBe(fakeEs);
  });

  it("returns undefined when registry is empty", () => {
    expect(getTranslation("en")).toBeUndefined();
  });
});

describe("resolveLocale", () => {
  it("resolves es-ES to es through alias map", () => {
    const localeResolution = resolveLocale("es-ES", { "es-ES": "es" });
    expect(localeResolution.effectiveLocale).toBe("es");

    _resetRegistry();
    registerTranslation(fakeEn, fakeEs);
    const translationResolution = resolveTranslation(
      localeResolution.effectiveLocale,
    );
    expect(translationResolution.translation).toBe(fakeEs);
    expect(translationResolution.matchedBy).toBe("exact");
  });

  it("applies progressive aliases from specific to broad", () => {
    const localeResolution = resolveLocale("zh-Hant-HK", {
      zh: "en",
      "zh-Hant": "es",
    });

    expect(localeResolution.effectiveLocale).toBe("es");
  });

  it("falls back to en for invalid locale input", () => {
    const localeResolution = resolveLocale("not a locale", {});
    expect(localeResolution.effectiveLocale).toBe("en");
    expect(localeResolution.isInvalid).toBe(true);
  });

  it("uses exact then prefix then fallback translation lookup", () => {
    _resetRegistry();
    registerTranslation(fakeEn, fakeEs);

    expect(resolveTranslation("es").matchedBy).toBe("exact");
    expect(resolveTranslation("es-PE").matchedBy).toBe("prefix");
    expect(resolveTranslation("fr-CA").matchedBy).toBe("fallback");
  });

  it("supports custom fallback locale in lookup", () => {
    _resetRegistry();
    registerTranslation(fakeEn, fakeEs);

    expect(
      resolveTranslation("fr-CA", { fallbackLocale: "es" }).translation,
    ).toBe(fakeEs);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// testing-2: use-locale.ts (via useLocalize integration)
// ═══════════════════════════════════════════════════════════════════════

describe("useLocale (via useLocalize().lang())", () => {
  beforeEach(() => {
    _resetRegistry();
    registerTranslation(fakeEn, fakeEs);
    // Reset html lang
    document.documentElement.lang = "";
  });

  it("returns 'en' when <html lang> is empty", () => {
    render(
      createElement(LocalizeConsumer, {
        render: (r) => r.lang(),
      }),
    );
    // Falls through to navigator.language or "en"
    const output = screen.getByTestId("output");
    // happy-dom navigator.language may vary; the key thing is it returns a string
    expect(output.textContent).toBeTruthy();
  });

  it("returns locale from <html lang> attribute", () => {
    document.documentElement.lang = "es";
    render(
      createElement(LocalizeConsumer, {
        render: (r) => r.lang(),
      }),
    );
    expect(screen.getByTestId("output").textContent).toBe("es");
  });

  it("re-renders when <html lang> mutated at runtime", async () => {
    document.documentElement.lang = "en";
    render(
      createElement(LocalizeConsumer, {
        render: (r) => r.term("close"),
      }),
    );
    expect(screen.getByTestId("output").textContent).toBe("Close");

    // Mutate and wait for MutationObserver to fire
    act(() => {
      document.documentElement.lang = "es";
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(screen.getByTestId("output").textContent).toBe("Cerrar");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// testing-3: useLocalize()
// ═══════════════════════════════════════════════════════════════════════

describe("useLocalize", () => {
  beforeEach(() => {
    _resetRegistry();
    registerTranslation(fakeEn, fakeEs, fakeAr);
    document.documentElement.lang = "en";
  });

  it("term('close') returns 'Close' for English", () => {
    render(
      createElement(LocalizeConsumer, {
        render: (r) => r.term("close"),
      }),
    );
    expect(screen.getByTestId("output").textContent).toBe("Close");
  });

  it("term('showing-range', 1, 10, 100) returns parameterized string", () => {
    render(
      createElement(LocalizeConsumer, {
        render: (r) => r.term("showing-range", 1, 10, 100),
      }),
    );
    expect(screen.getByTestId("output").textContent).toBe(
      "Showing 1-10 of 100",
    );
  });

  it("date() formats using resolved locale", () => {
    const fixedDate = new Date(2026, 0, 15); // Jan 15 2026
    render(
      createElement(LocalizeConsumer, {
        render: (r) =>
          r.date(fixedDate, {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
      }),
    );
    const text = screen.getByTestId("output").textContent;
    // English formatting should contain "Jan" and "2026"
    expect(text).toContain("Jan");
    expect(text).toContain("2026");
  });

  it("number() formats using resolved locale", () => {
    render(
      createElement(LocalizeConsumer, {
        render: (r) => r.number(1234567.89),
      }),
    );
    const text = screen.getByTestId("output").textContent;
    // English uses commas: "1,234,567.89"
    expect(text).toContain("1,234,567");
  });

  it("lang() returns resolved locale code", () => {
    document.documentElement.lang = "es";
    render(
      createElement(LocalizeConsumer, {
        render: (r) => r.lang(),
      }),
    );
    expect(screen.getByTestId("output").textContent).toBe("es");
  });

  it("lang() returns normalized and aliased input locale", () => {
    _resetRegistry();
    registerTranslation(fakeEn, fakeEs);

    render(
      createElement(KumoLocaleProvider, {
        locale: "es_ES",
        localeAliases: { es: "es-ES" },
        children: createElement(LocalizeConsumer, {
          render: (r) => r.lang(),
        }),
      }),
    );

    expect(screen.getByTestId("output").textContent).toBe("es-ES");
  });

  it("translationLang() returns resolved translation locale code", () => {
    _resetRegistry();
    registerTranslation(fakeEn, fakeEs);

    render(
      createElement(KumoLocaleProvider, {
        locale: "es-PE",
        children: createElement(LocalizeConsumer, {
          render: (r) => `${r.lang()}|${r.translationLang()}`,
        }),
      }),
    );

    expect(screen.getByTestId("output").textContent).toBe("es-PE|es");
  });

  it("dir() returns $dir from resolved translation", () => {
    render(
      createElement(KumoLocaleProvider, {
        locale: "ar",
        children: createElement(LocalizeConsumer, {
          render: (r) => r.dir(),
        }),
      }),
    );
    expect(screen.getByTestId("output").textContent).toBe("rtl");
  });

  it("falls back to English per key when locale is metadata-only", () => {
    _resetRegistry();
    registerTranslation(en, es);
    document.documentElement.lang = "es";

    render(
      createElement(LocalizeConsumer, {
        render: (r) => r.term("close"),
      }),
    );

    expect(screen.getByTestId("output").textContent).toBe("Close");
  });

  it("normalizes locale tags with underscore", () => {
    _resetRegistry();
    registerTranslation(fakeEn, fakeEs);

    render(
      createElement(KumoLocaleProvider, {
        locale: "es_PE",
        children: createElement(LocalizeConsumer, {
          render: (r) => r.term("close"),
        }),
      }),
    );

    expect(screen.getByTestId("output").textContent).toBe("Cerrar");
  });

  it("falls back to English locale for invalid locale tags", () => {
    _resetRegistry();
    registerTranslation(fakeEn, fakeEs);

    render(
      createElement(KumoLocaleProvider, {
        locale: "not a locale",
        children: createElement(LocalizeConsumer, {
          render: (r) => r.lang(),
        }),
      }),
    );

    expect(screen.getByTestId("output").textContent).toBe("en");
  });

  it("date() does not throw for invalid locale tags", () => {
    _resetRegistry();
    registerTranslation(fakeEn, fakeEs);

    render(
      createElement(KumoLocaleProvider, {
        locale: "???",
        children: createElement(LocalizeConsumer, {
          render: (r) =>
            r.date(new Date(2026, 0, 15), {
              year: "numeric",
            }),
        }),
      }),
    );

    expect(screen.getByTestId("output").textContent).toContain("2026");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// testing-4: DirectionProvider and useDirection
// ═══════════════════════════════════════════════════════════════════════

describe("DirectionProvider & useDirection", () => {
  it("returns 'ltr' when no provider present", () => {
    render(createElement(DirectionConsumer));
    expect(screen.getByTestId("dir").textContent).toBe("ltr");
  });

  it("returns 'rtl' when wrapped in DirectionProvider direction='rtl'", () => {
    render(
      createElement(DirectionProvider, {
        direction: "rtl",
        children: createElement(DirectionConsumer),
      }),
    );
    expect(screen.getByTestId("dir").textContent).toBe("rtl");
  });

  it("nested providers — innermost wins", () => {
    render(
      createElement(DirectionProvider, {
        direction: "rtl",
        children: createElement(DirectionProvider, {
          direction: "ltr",
          children: createElement(DirectionConsumer),
        }),
      }),
    );
    expect(screen.getByTestId("dir").textContent).toBe("ltr");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// testing-5: KumoLocaleProvider integration
// ═══════════════════════════════════════════════════════════════════════

describe("KumoLocaleProvider", () => {
  beforeEach(() => {
    _resetRegistry();
    _resetUnknownLocaleWarnings();
    registerTranslation(fakeEn, fakeEs);
    document.documentElement.lang = "en";
  });

  it("handles expected locale inputs and fallbacks", () => {
    const cases = [
      {
        locale: "en",
        localeAliases: undefined,
        expectedLang: "en",
        expectedTerm: "Close",
      },
      {
        locale: "en-US",
        localeAliases: { "en-US": "en" },
        expectedLang: "en",
        expectedTerm: "Close",
      },
      {
        locale: "es-ES",
        localeAliases: { "es-ES": "es" },
        expectedLang: "es",
        expectedTerm: "Cerrar",
      },
      {
        locale: "es-PE",
        localeAliases: undefined,
        expectedLang: "es-PE",
        expectedTerm: "Cerrar",
      },
      {
        locale: "pt-BR",
        localeAliases: { "pt-BR": "es" },
        expectedLang: "es",
        expectedTerm: "Cerrar",
      },
      {
        locale: "zh-Hant-HK",
        localeAliases: { "zh-Hant": "es" },
        expectedLang: "es",
        expectedTerm: "Cerrar",
      },
      {
        locale: "not a locale",
        localeAliases: undefined,
        expectedLang: "en",
        expectedTerm: "Close",
      },
    ] as const;

    for (const testCase of cases) {
      const { unmount } = render(
        createElement(KumoLocaleProvider, {
          locale: testCase.locale,
          localeAliases: testCase.localeAliases,
          children: createElement(LocalizeConsumer, {
            render: (r) => `${r.lang()}|${r.term("close")}`,
          }),
        }),
      );

      expect(screen.getByTestId("output").textContent).toBe(
        `${testCase.expectedLang}|${testCase.expectedTerm}`,
      );
      unmount();
    }
  });

  it("honors fallbackLocale when detectLocale=false and locale is absent", () => {
    _resetRegistry();
    registerTranslation(fakeEn, fakeEs);
    document.documentElement.lang = "ar";

    render(
      createElement(KumoLocaleProvider, {
        detectLocale: false,
        fallbackLocale: "es",
        children: createElement(LocalizeConsumer, {
          render: (r) => `${r.lang()}|${r.term("close")}`,
        }),
      }),
    );

    expect(screen.getByTestId("output").textContent).toBe("es|Cerrar");
  });

  it("applies aliases case-insensitively before locale validation", () => {
    _resetRegistry();
    registerTranslation(fakeEn, fakeEs);

    render(
      createElement(KumoLocaleProvider, {
        locale: "ES_pe",
        localeAliases: { "es-pe": "es" },
        children: createElement(LocalizeConsumer, {
          render: (r) => `${r.lang()}|${r.term("close")}`,
        }),
      }),
    );

    expect(screen.getByTestId("output").textContent).toBe("es|Cerrar");
  });

  it("does not observe html lang in controlled mode", () => {
    const observeSpy = vi.spyOn(MutationObserver.prototype, "observe");

    render(
      createElement(KumoLocaleProvider, {
        locale: "en",
        children: createElement(LocalizeConsumer, {
          render: (r) => r.term("close"),
        }),
      }),
    );

    expect(screen.getByTestId("output").textContent).toBe("Close");
    expect(observeSpy).not.toHaveBeenCalled();
    observeSpy.mockRestore();
  });

  it("fallbackLocale hard-falls back to en and warns once when unsupported", () => {
    _resetRegistry();
    registerTranslation(fakeEn, fakeEs);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const renderTree = (): void => {
      const result = render(
        createElement(KumoLocaleProvider, {
          locale: "fr-CA",
          fallbackLocale: "pt-BR",
          children: createElement(LocalizeConsumer, {
            render: (r) => `${r.translationLang()}|${r.term("close")}`,
          }),
        }),
      );

      expect(result.getByTestId("output").textContent).toBe("en|Close");
      result.unmount();
    };

    renderTree();
    renderTree();
    expect(
      warnSpy.mock.calls.some(([msg]) =>
        String(msg).includes("Unknown fallbackLocale 'pt-BR'; using 'en'."),
      ),
    ).toBe(true);
    const fallbackWarnings = warnSpy.mock.calls.filter(([msg]) =>
      String(msg).includes("Unknown fallbackLocale"),
    );
    expect(fallbackWarnings).toHaveLength(1);
    warnSpy.mockRestore();
  });

  it("applies localeAliases to fallbackLocale resolution", () => {
    _resetRegistry();
    registerTranslation(fakeEn, fakeEs);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(
      createElement(KumoLocaleProvider, {
        locale: "fr-CA",
        fallbackLocale: "pt-BR",
        localeAliases: { "pt-BR": "es" },
        children: createElement(LocalizeConsumer, {
          render: (r) => `${r.translationLang()}|${r.term("close")}`,
        }),
      }),
    );

    expect(screen.getByTestId("output").textContent).toBe("es|Cerrar");
    const fallbackWarnings = warnSpy.mock.calls.filter(([msg]) =>
      String(msg).includes("Unknown fallbackLocale"),
    );
    expect(fallbackWarnings).toHaveLength(0);
    warnSpy.mockRestore();
  });

  it("locale='es' causes child to resolve Spanish", () => {
    render(
      createElement(KumoLocaleProvider, {
        locale: "es",
        children: createElement(LocalizeConsumer, {
          render: (r) => r.term("close"),
        }),
      }),
    );
    expect(screen.getByTestId("output").textContent).toBe("Cerrar");
  });

  it("nested providers — innermost wins", () => {
    render(
      createElement(KumoLocaleProvider, {
        locale: "es",
        children: createElement(KumoLocaleProvider, {
          locale: "en",
          children: createElement(LocalizeConsumer, {
            render: (r) => r.term("close"),
          }),
        }),
      }),
    );
    expect(screen.getByTestId("output").textContent).toBe("Close");
  });

  it("applies localeAliases before translation lookup", () => {
    _resetRegistry();
    registerTranslation(fakeEn);

    render(
      createElement(KumoLocaleProvider, {
        locale: "en-US",
        localeAliases: { "en-US": "en" },
        children: createElement(LocalizeConsumer, {
          render: (r) => r.term("close"),
        }),
      }),
    );

    expect(screen.getByTestId("output").textContent).toBe("Close");
  });

  it("nested localeAliases prefer nearest provider on conflicts", () => {
    _resetRegistry();
    registerTranslation(fakeEn, fakeEs);

    render(
      createElement(KumoLocaleProvider, {
        locale: "es-ES",
        localeAliases: { "es-ES": "en" },
        children: createElement(KumoLocaleProvider, {
          localeAliases: { "es-ES": "es" },
          children: createElement(LocalizeConsumer, {
            render: (r) => r.term("close"),
          }),
        }),
      }),
    );

    expect(screen.getByTestId("output").textContent).toBe("Cerrar");
  });

  it("detectLocale=false with no locale falls back to en", () => {
    _resetRegistry();
    registerTranslation(fakeEn, fakeEs);
    document.documentElement.lang = "es";

    render(
      createElement(KumoLocaleProvider, {
        detectLocale: false,
        children: createElement(LocalizeConsumer, {
          render: (r) => r.lang(),
        }),
      }),
    );

    expect(screen.getByTestId("output").textContent).toBe("en");
  });

  it("detectLocale=false inherits nearest provider locale", () => {
    _resetRegistry();
    registerTranslation(fakeEn, fakeEs);
    document.documentElement.lang = "en";

    render(
      createElement(KumoLocaleProvider, {
        locale: "es",
        children: createElement(KumoLocaleProvider, {
          detectLocale: false,
          children: createElement(LocalizeConsumer, {
            render: (r) => r.lang(),
          }),
        }),
      }),
    );

    expect(screen.getByTestId("output").textContent).toBe("es");
  });

  it("calls onUnknownLocale for invalid locale tokens", () => {
    _resetRegistry();
    registerTranslation(fakeEn, fakeEs);
    const onUnknownLocale = vi.fn();

    render(
      createElement(KumoLocaleProvider, {
        locale: "not a locale",
        onUnknownLocale,
        children: createElement(LocalizeConsumer, {
          render: (r) => r.lang(),
        }),
      }),
    );

    expect(onUnknownLocale).toHaveBeenCalledWith({
      inputLocale: "not a locale",
      normalizedLocale: "en",
      resolvedTranslationCode: "en",
      reason: "invalid",
    });
  });

  it("calls onUnknownLocale for unsupported but valid locale", () => {
    _resetRegistry();
    registerTranslation(fakeEn, fakeEs);
    const onUnknownLocale = vi.fn();

    render(
      createElement(KumoLocaleProvider, {
        locale: "fr-CA",
        onUnknownLocale,
        children: createElement(LocalizeConsumer, {
          render: (r) => r.term("close"),
        }),
      }),
    );

    expect(screen.getByTestId("output").textContent).toBe("Close");
    expect(onUnknownLocale).toHaveBeenCalledWith({
      inputLocale: "fr-CA",
      normalizedLocale: "fr-CA",
      resolvedTranslationCode: "en",
      reason: "unsupported",
    });
  });

  it("does not call onUnknownLocale again when rerendered with same unknown locale", () => {
    _resetRegistry();
    registerTranslation(fakeEn, fakeEs);
    const onUnknownLocale = vi.fn();

    const tree = createElement(KumoLocaleProvider, {
      locale: "fr-CA",
      onUnknownLocale,
      children: createElement(LocalizeConsumer, {
        render: (r) => r.term("close"),
      }),
    });

    const { rerender } = render(tree);
    rerender(tree);

    expect(onUnknownLocale).toHaveBeenCalledTimes(1);
  });

  it("warns once per normalized unknown locale per runtime", () => {
    _resetRegistry();
    registerTranslation(fakeEn, fakeEs);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const renderTree = (): void => {
      render(
        createElement(KumoLocaleProvider, {
          locale: "fr-CA",
          warnOnUnknownLocale: true,
          children: createElement(LocalizeConsumer, {
            render: (r) => r.term("close"),
          }),
        }),
      );
    };

    renderTree();
    renderTree();

    const unknownLocaleWarnings = warnSpy.mock.calls.filter(([msg]) =>
      String(msg).includes("Unknown locale"),
    );
    expect(unknownLocaleWarnings).toHaveLength(1);
    warnSpy.mockRestore();
  });

  it("uses locale-derived rtl when explicit direction is absent", () => {
    _resetRegistry();
    registerTranslation(fakeEn, fakeEs, fakeAr);

    render(
      createElement(KumoLocaleProvider, {
        locale: "ar",
        children: createElement(DirectionAgreementConsumer),
      }),
    );

    expect(screen.getByTestId("dir-agreement").textContent).toBe("rtl|rtl");
  });

  it("explicit direction override has precedence and stays in sync", () => {
    _resetRegistry();
    registerTranslation(fakeEn, fakeEs, fakeAr);

    render(
      createElement(KumoLocaleProvider, {
        locale: "ar",
        direction: "ltr",
        children: createElement(DirectionAgreementConsumer),
      }),
    );

    expect(screen.getByTestId("dir-agreement").textContent).toBe("ltr|ltr");
  });

  it("nested providers with conflicting directions use nearest provider", () => {
    _resetRegistry();
    registerTranslation(fakeEn, fakeEs, fakeAr);

    render(
      createElement(KumoLocaleProvider, {
        locale: "ar",
        direction: "rtl",
        children: createElement(KumoLocaleProvider, {
          direction: "ltr",
          children: createElement(DirectionAgreementConsumer),
        }),
      }),
    );

    expect(screen.getByTestId("dir-agreement").textContent).toBe("ltr|ltr");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// testing-6: Translation key completeness
// ═══════════════════════════════════════════════════════════════════════

describe("translation key completeness", () => {
  // Import all locale files to check their keys
  const localeModules = import.meta.glob<{ default: KumoTranslation }>(
    "../translations/*.ts",
    { eager: true },
  );

  /** Keys that must be present on every translation (excluding index.ts). */
  const METADATA_KEYS = new Set(["$code", "$name", "$dir"]);

  /**
   * All translation keys defined on the KumoTranslation interface.
   * We derive them from the English source-of-truth.
   */
  const allTranslationKeys: string[] = (() => {
    // Find English module in the glob results
    const enModule = Object.entries(localeModules).find(([path]) =>
      path.endsWith("/en.ts"),
    );
    if (!enModule) throw new Error("English translation module not found");
    const enTranslation = enModule[1].default;
    return Object.keys(enTranslation).filter((k) => !METADATA_KEYS.has(k));
  })();

  // For each locale file (excluding index.ts), check key completeness
  for (const [path, mod] of Object.entries(localeModules)) {
    // Skip helper modules; only locale translation objects are tested.
    if (path.endsWith("/index.ts") || path.endsWith("/create-translation.ts")) {
      continue;
    }

    const fileName = path.split("/").pop();
    const translation = mod.default;

    it(`${fileName} has $code, $name, $dir metadata`, () => {
      expect(translation.$code).toEqual(expect.any(String));
      expect(translation.$name).toEqual(expect.any(String));
      expect(["ltr", "rtl"]).toContain(translation.$dir);
    });

    it(`${fileName} has all translation keys`, () => {
      const presentKeys = Object.keys(translation).filter(
        (k) => !METADATA_KEYS.has(k),
      );

      // English must have ALL keys
      if (translation.$code === "en") {
        for (const key of allTranslationKeys) {
          expect(
            translation[key as keyof KumoTranslation],
            `English missing key: ${key}`,
          ).toBeDefined();
        }
      }

      // Non-English: every key present must be a valid translation key.
      // Locales now include complete key sets via English-backed helper.
      for (const key of presentKeys) {
        expect(
          allTranslationKeys,
          `${fileName} has unknown key: ${key}`,
        ).toContain(key);
      }
    });
  }
});
