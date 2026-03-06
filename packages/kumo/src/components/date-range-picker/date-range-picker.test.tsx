import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DateRangePicker } from "./date-range-picker";
import { KumoLocaleProvider } from "../../localize/index.js";

describe("DateRangePicker", () => {
  it("keeps month editing stable for locale month names", () => {
    render(
      <KumoLocaleProvider locale="tr">
        <DateRangePicker
          onStartDateChange={() => {}}
          onEndDateChange={() => {}}
        />
      </KumoLocaleProvider>,
    );

    const [monthInput] = screen.getAllByRole("textbox", {
      name: "Edit month and year",
    });
    const marchInTurkish = new Intl.DateTimeFormat("tr", {
      month: "long",
    }).format(new Date(2026, 2, 1));

    expect(() => {
      fireEvent.blur(monthInput, {
        target: { value: `${marchInTurkish} 2026` },
      });
    }).not.toThrow();

    expect(screen.getByRole("button", { name: "Previous month" })).toBeTruthy();
  });
});
