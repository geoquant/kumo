import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";

import api from "../loadable/index";
import { ThemeWrapper } from "../loadable/theme";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readModeFromDetail(value: unknown): "light" | "dark" | null {
  if (!isRecord(value)) return null;
  const mode = value["mode"];
  return mode === "light" || mode === "dark" ? mode : null;
}

afterEach(() => {
  cleanup();
  document.body.removeAttribute("data-mode");
});

describe("loadable theme events", () => {
  it("ThemeWrapper reacts to both kumo-theme-change and theme-change", () => {
    document.body.setAttribute("data-mode", "light");

    const { container } = render(
      <ThemeWrapper>
        <div data-testid="child" />
      </ThemeWrapper>,
    );

    const root = container.querySelector(".kumo-root");
    expect(root).not.toBeNull();
    expect(root?.getAttribute("data-mode")).toBe("light");

    act(() => {
      window.dispatchEvent(
        new CustomEvent("kumo-theme-change", { detail: { mode: "dark" } }),
      );
    });
    expect(root?.getAttribute("data-mode")).toBe("dark");

    act(() => {
      window.dispatchEvent(
        new CustomEvent("theme-change", { detail: { mode: "light" } }),
      );
    });
    expect(root?.getAttribute("data-mode")).toBe("light");
  });

  it("setTheme dispatches kumo-theme-change and theme-change with same payload shape", () => {
    const kumoListener = vi.fn<(e: Event) => void>();
    const legacyListener = vi.fn<(e: Event) => void>();

    window.addEventListener("kumo-theme-change", kumoListener);
    window.addEventListener("theme-change", legacyListener);

    api.setTheme("dark");

    expect(kumoListener).toHaveBeenCalledTimes(1);
    expect(legacyListener).toHaveBeenCalledTimes(1);

    const kumoEvent = kumoListener.mock.calls[0]?.[0];
    const legacyEvent = legacyListener.mock.calls[0]?.[0];

    expect(kumoEvent instanceof CustomEvent).toBe(true);
    expect(legacyEvent instanceof CustomEvent).toBe(true);

    const kumoMode =
      kumoEvent instanceof CustomEvent
        ? readModeFromDetail(kumoEvent.detail)
        : null;
    const legacyMode =
      legacyEvent instanceof CustomEvent
        ? readModeFromDetail(legacyEvent.detail)
        : null;

    expect(kumoMode).toBe("dark");
    expect(legacyMode).toBe("dark");

    window.removeEventListener("kumo-theme-change", kumoListener);
    window.removeEventListener("theme-change", legacyListener);
  });
});
