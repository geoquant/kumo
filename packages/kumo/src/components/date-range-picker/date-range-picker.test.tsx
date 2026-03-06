import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DateRangePicker } from "./date-range-picker";
import {
  KumoLocaleProvider,
  registerTranslation,
} from "../../localize/index.js";
import { createTranslation } from "../../translations/create-translation.js";

function getFirstMonthInputValue(): string {
  const [firstInput] = screen.getAllByRole("textbox");
  if (!(firstInput instanceof HTMLInputElement)) {
    throw new Error("Expected month input to be HTMLInputElement");
  }

  return firstInput.value;
}

function getSecondMonthInputValue(): string {
  const [, secondInput] = screen.getAllByRole("textbox");
  if (!(secondInput instanceof HTMLInputElement)) {
    throw new Error("Expected second month input to be HTMLInputElement");
  }

  return secondInput.value;
}

function getFirstWeekdayHeaderText(container: HTMLElement): string {
  const weekdayGrid = container.querySelector(".grid.grid-cols-7");
  if (!(weekdayGrid instanceof HTMLDivElement)) {
    throw new Error("Expected weekday header grid to exist");
  }

  const firstCell = weekdayGrid.firstElementChild;
  if (!(firstCell instanceof HTMLDivElement)) {
    throw new Error("Expected first weekday cell to exist");
  }

  const value = firstCell.textContent?.trim();
  if (!value) {
    throw new Error("Expected first weekday text to exist");
  }

  return value;
}

const turkishTestTranslation = createTranslation(
  { $code: "tr-TR", $name: "Turkce Test", $dir: "ltr" },
  {
    "edit-month-and-year": "Ayi ve yili duzenle",
    "previous-month": "Onceki ay",
  },
);

const arabicTestTranslation = createTranslation(
  { $code: "ar-EG", $name: "Arabic Test", $dir: "rtl" },
  {
    "edit-month-and-year": "حرر الشهر والسنة",
    "previous-month": "الشهر السابق",
  },
);

registerTranslation(turkishTestTranslation, arabicTestTranslation);

describe("DateRangePicker", () => {
  it("keeps month editing stable for locale month names", () => {
    render(
      <KumoLocaleProvider locale="tr-TR">
        <DateRangePicker
          onStartDateChange={() => {}}
          onEndDateChange={() => {}}
        />
      </KumoLocaleProvider>,
    );

    const [monthInput] = screen.getAllByRole("textbox", {
      name: "Ayi ve yili duzenle",
    });
    const marchInTurkish = new Intl.DateTimeFormat("tr", {
      month: "long",
    }).format(new Date(2026, 2, 1));
    const aprilInTurkish = new Intl.DateTimeFormat("tr", {
      month: "long",
    }).format(new Date(2026, 3, 1));

    expect(() => {
      fireEvent.blur(monthInput, {
        target: { value: `${marchInTurkish} 2028` },
      });
    }).not.toThrow();

    expect(getFirstMonthInputValue()).toContain(marchInTurkish);
    expect(getFirstMonthInputValue()).toContain("2028");
    expect(getSecondMonthInputValue()).toContain(aprilInTurkish);
    expect(getSecondMonthInputValue()).toContain("2028");
  });

  it("accepts year-first month input ordering", () => {
    render(
      <KumoLocaleProvider locale="en">
        <DateRangePicker
          onStartDateChange={() => {}}
          onEndDateChange={() => {}}
        />
      </KumoLocaleProvider>,
    );

    const [monthInput] = screen.getAllByRole("textbox", {
      name: "Edit month and year",
    });

    const aprilInEnglish = new Intl.DateTimeFormat("en", {
      month: "long",
    }).format(new Date(2026, 3, 1));

    expect(() => {
      fireEvent.blur(monthInput, {
        target: { value: "2028 march" },
      });
    }).not.toThrow();

    expect(getFirstMonthInputValue()).toContain("2028");
    expect(getSecondMonthInputValue()).toContain(aprilInEnglish);
    expect(getSecondMonthInputValue()).toContain("2028");
  });

  it("accepts punctuation around month-year input", () => {
    render(
      <KumoLocaleProvider locale="en">
        <DateRangePicker
          onStartDateChange={() => {}}
          onEndDateChange={() => {}}
        />
      </KumoLocaleProvider>,
    );

    const [monthInput] = screen.getAllByRole("textbox", {
      name: "Edit month and year",
    });

    expect(() => {
      fireEvent.blur(monthInput, {
        target: { value: "March, 2028" },
      });
    }).not.toThrow();

    expect(getFirstMonthInputValue()).toContain("March");
    expect(getFirstMonthInputValue()).toContain("2028");
  });

  it("accepts localized year digits", () => {
    render(
      <KumoLocaleProvider locale="ar-EG">
        <DateRangePicker
          onStartDateChange={() => {}}
          onEndDateChange={() => {}}
        />
      </KumoLocaleProvider>,
    );

    const [monthInput] = screen.getAllByRole("textbox", {
      name: "حرر الشهر والسنة",
    });
    const marchInArabic = new Intl.DateTimeFormat("ar", {
      month: "long",
    }).format(new Date(2026, 2, 1));
    const aprilInArabic = new Intl.DateTimeFormat("ar", {
      month: "long",
    }).format(new Date(2026, 3, 1));
    const yearInArabicDigits = new Intl.NumberFormat("ar", {
      useGrouping: false,
    }).format(2028);

    expect(() => {
      fireEvent.blur(monthInput, {
        target: { value: `${yearInArabicDigits} ${marchInArabic}` },
      });
    }).not.toThrow();

    expect(getFirstMonthInputValue()).toContain(marchInArabic);
    expect(getFirstMonthInputValue()).toContain(yearInArabicDigits);
    expect(getSecondMonthInputValue()).toContain(aprilInArabic);
    expect(getSecondMonthInputValue()).toContain(yearInArabicDigits);
  });

  it("accepts compact CJK month-year format", () => {
    render(
      <KumoLocaleProvider locale="ja-JP">
        <DateRangePicker
          onStartDateChange={() => {}}
          onEndDateChange={() => {}}
        />
      </KumoLocaleProvider>,
    );

    const [monthInput] = screen.getAllByRole("textbox", {
      name: "Edit month and year",
    });
    const marchInJapanese = new Intl.DateTimeFormat("ja-JP", {
      month: "long",
    }).format(new Date(2026, 2, 1));
    expect(() => {
      fireEvent.blur(monthInput, {
        target: { value: `2028年${marchInJapanese}` },
      });
    }).not.toThrow();

    expect(getFirstMonthInputValue()).toContain(marchInJapanese);
    expect(getFirstMonthInputValue()).toContain("2028");
  });

  it("ignores embedded month token inside a larger word", () => {
    render(
      <KumoLocaleProvider locale="en">
        <DateRangePicker
          onStartDateChange={() => {}}
          onEndDateChange={() => {}}
        />
      </KumoLocaleProvider>,
    );

    const [monthInput] = screen.getAllByRole("textbox", {
      name: "Edit month and year",
    });
    if (!(monthInput instanceof HTMLInputElement)) {
      throw new Error("Expected month input to be HTMLInputElement");
    }
    const originalSecondValue = getSecondMonthInputValue();

    fireEvent.blur(monthInput, {
      target: { value: "smarch 2026" },
    });

    expect(getSecondMonthInputValue()).toBe(originalSecondValue);
  });

  it("ignores year text with alphabetic suffix", () => {
    render(
      <KumoLocaleProvider locale="en">
        <DateRangePicker
          onStartDateChange={() => {}}
          onEndDateChange={() => {}}
        />
      </KumoLocaleProvider>,
    );

    const [monthInput] = screen.getAllByRole("textbox", {
      name: "Edit month and year",
    });
    const originalSecondValue = getSecondMonthInputValue();

    fireEvent.blur(monthInput, {
      target: { value: "March 2028abc" },
    });

    expect(getSecondMonthInputValue()).toBe(originalSecondValue);
  });

  it("accepts separators around localized year digits", () => {
    render(
      <KumoLocaleProvider locale="ar-EG">
        <DateRangePicker
          onStartDateChange={() => {}}
          onEndDateChange={() => {}}
        />
      </KumoLocaleProvider>,
    );

    const [monthInput] = screen.getAllByRole("textbox", {
      name: "حرر الشهر والسنة",
    });
    const marchInArabic = new Intl.DateTimeFormat("ar", {
      month: "long",
    }).format(new Date(2026, 2, 1));
    const yearInArabicDigits = new Intl.NumberFormat("ar", {
      useGrouping: false,
    }).format(2028);

    fireEvent.blur(monthInput, {
      target: { value: `${marchInArabic} (${yearInArabicDigits})` },
    });

    expect(getFirstMonthInputValue()).toContain(marchInArabic);
    expect(getFirstMonthInputValue()).toContain(yearInArabicDigits);
  });

  it("accepts Arabic comma as localized separator", () => {
    render(
      <KumoLocaleProvider locale="ar-EG">
        <DateRangePicker
          onStartDateChange={() => {}}
          onEndDateChange={() => {}}
        />
      </KumoLocaleProvider>,
    );

    const [monthInput] = screen.getAllByRole("textbox", {
      name: "حرر الشهر والسنة",
    });
    const marchInArabic = new Intl.DateTimeFormat("ar", {
      month: "long",
    }).format(new Date(2026, 2, 1));
    const yearInArabicDigits = new Intl.NumberFormat("ar", {
      useGrouping: false,
    }).format(2028);

    fireEvent.blur(monthInput, {
      target: { value: `${marchInArabic}، ${yearInArabicDigits}` },
    });

    expect(getFirstMonthInputValue()).toContain(marchInArabic);
    expect(getFirstMonthInputValue()).toContain(yearInArabicDigits);
  });

  it("uses Monday as first weekday for en-GB", () => {
    const { container } = render(
      <KumoLocaleProvider locale="en-GB">
        <DateRangePicker
          onStartDateChange={() => {}}
          onEndDateChange={() => {}}
        />
      </KumoLocaleProvider>,
    );

    const mondayLabel = new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
    }).format(new Date(2026, 0, 5));

    expect(getFirstWeekdayHeaderText(container)).toBe(mondayLabel);
  });

  it("uses Sunday as first weekday for en-US", () => {
    const { container } = render(
      <KumoLocaleProvider locale="en-US">
        <DateRangePicker
          onStartDateChange={() => {}}
          onEndDateChange={() => {}}
        />
      </KumoLocaleProvider>,
    );

    const sundayLabel = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
    }).format(new Date(2026, 0, 4));

    expect(getFirstWeekdayHeaderText(container)).toBe(sundayLabel);
  });

  it("allows overriding control and day aria labels", () => {
    const observedModeNames = new Set<string>();
    render(
      <DateRangePicker
        onStartDateChange={() => {}}
        onEndDateChange={() => {}}
        ariaLabels={{
          previousMonth: "Back one month",
          nextMonth: "Forward one month",
          editMonthAndYear: "Change month and year",
          dayCell: ({ defaultLabel, modeName }) => {
            if (modeName) {
              observedModeNames.add(modeName);
            }
            return `Day: ${defaultLabel}`;
          },
        }}
      />,
    );

    expect(screen.getByRole("button", { name: "Back one month" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Forward one month" }),
    ).toBeTruthy();
    expect(
      screen.getAllByRole("textbox", { name: "Change month and year" }).length,
    ).toBe(2);
    expect(screen.getAllByRole("button", { name: /Day:/ }).length).toBe(84);
    expect(observedModeNames.size).toBeGreaterThan(0);
  });

  it("falls back to defaults when aria override is blank", () => {
    render(
      <DateRangePicker
        onStartDateChange={() => {}}
        onEndDateChange={() => {}}
        ariaLabels={{ previousMonth: "   " }}
      />,
    );

    expect(screen.getByRole("button", { name: "Previous month" })).toBeTruthy();
  });
});
