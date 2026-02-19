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
 * Wraps children in a `<div data-mode={mode} className="kumo-root">`.
 * Defaults to "light"; reacts to `kumo-theme-change` CustomEvent.
 */
export function ThemeWrapper({
  children,
}: ThemeWrapperProps): React.JSX.Element {
  const [mode, setMode] = useState<"light" | "dark">("light");

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
