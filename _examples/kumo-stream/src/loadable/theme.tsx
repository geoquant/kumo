/**
 * ThemeWrapper — reactive light/dark mode container for loadable bundle.
 *
 * Listens for `kumo-theme-change` CustomEvent on window and updates the
 * `data-mode` attribute. This ensures all kumo components inside the
 * wrapper re-render in the correct color scheme without the host page
 * needing to know about React.
 */

import { useState, useEffect, type ReactNode } from "react";

interface ThemeWrapperProps {
  readonly children: ReactNode;
}

/**
 * Read the current theme from document.body's data-mode attribute.
 * Falls back to "light" if unset or unrecognised.
 */
function readBodyMode(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  const attr = document.body.getAttribute("data-mode");
  return attr === "dark" ? "dark" : "light";
}

/**
 * Wraps children in a `<div data-mode={mode} className="kumo-root">`.
 * Initialises from `document.body[data-mode]` (set by `setTheme()`),
 * then reacts to `kumo-theme-change` CustomEvent for live updates.
 */
export function ThemeWrapper({
  children,
}: ThemeWrapperProps): React.JSX.Element {
  const [mode, setMode] = useState<"light" | "dark">(readBodyMode);

  useEffect(() => {
    function handleThemeChange(e: Event): void {
      const detail = (e as CustomEvent<{ mode: "light" | "dark" }>).detail;
      setMode(detail.mode);
    }

    window.addEventListener("kumo-theme-change", handleThemeChange);
    return () =>
      window.removeEventListener("kumo-theme-change", handleThemeChange);
  }, []);

  return (
    <div data-mode={mode} className="kumo-root">
      {children}
    </div>
  );
}

ThemeWrapper.displayName = "ThemeWrapper";
