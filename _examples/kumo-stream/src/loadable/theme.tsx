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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readModeFromEvent(e: Event): "light" | "dark" | null {
  if (!(e instanceof CustomEvent)) return null;
  const detail: unknown = e.detail;
  if (!isRecord(detail)) return null;

  const mode = detail["mode"];
  return mode === "light" || mode === "dark" ? mode : null;
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
      const next = readModeFromEvent(e);
      if (!next) return;
      setMode(next);
    }

    const events = ["kumo-theme-change", "theme-change"] as const;
    for (const name of events) {
      window.addEventListener(name, handleThemeChange);
    }

    return () => {
      for (const name of events) {
        window.removeEventListener(name, handleThemeChange);
      }
    };
  }, []);

  return (
    <div data-mode={mode} className="kumo-root">
      {children}
    </div>
  );
}

ThemeWrapper.displayName = "ThemeWrapper";
