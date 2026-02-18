import React, { useEffect, useSyncExternalStore } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { MantineProvider, createTheme } from "@mantine/core";
import { HelmetProvider } from "react-helmet-async";

// Observe <html> .dark class to sync Mantine's color scheme with the app toggle.
// The dark mode toggle in Demo.tsx sets .dark on document.documentElement;
// MantineProvider needs forceColorScheme to be reactive for Mantine components to respond.
function useDarkMode(): "light" | "dark" {
  const subscribe = (callback: () => void) => {
    const observer = new MutationObserver(callback);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  };
  const getSnapshot = () =>
    document.documentElement.classList.contains("dark") ? "dark" : "light";
  return useSyncExternalStore(subscribe, getSnapshot, () => "light" as const);
}

// Scroll to top on route change and page load (like traditional page behavior)
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Disable browser's scroll restoration
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

// Mantine styles - MUST be imported
import "@mantine/core/styles.css";

// Kumo styles are in a SEPARATE CSS entry point (kumo-styles.css) because Tailwind v4's
// @tailwindcss/vite plugin silently drops @theme blocks from @imported CSS files when
// the importing file also has its own @theme block. By isolating Kumo's @theme (which uses
// light-dark() for semantic tokens like --color-kumo-line) into its own CSS entry,
// all tokens resolve correctly.

import { Landing } from "./components/Landing";
import { Demo } from "./components/Demo";
import { Learn } from "./components/Learn";
import { UseCases } from "./components/UseCases";
import { Teams } from "./components/Teams";
import { Architecture } from "./components/Architecture";
import "./kumo-styles.css";
import "./index.css";

// Minimal theme with reduced visual noise
const theme = createTheme({
  primaryColor: "dark",
  fontFamily: "Inter, system-ui, -apple-system, sans-serif",
  defaultRadius: "sm",
  components: {
    Card: {
      defaultProps: {
        shadow: "none",
      },
    },
    Paper: {
      defaultProps: {
        shadow: "none",
      },
    },
    Button: {
      defaultProps: {
        radius: "sm",
      },
    },
  },
});

function App() {
  const colorScheme = useDarkMode();

  return (
    <HelmetProvider>
      <MantineProvider theme={theme} forceColorScheme={colorScheme}>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/architecture" element={<Architecture />} />
            <Route path="/use-cases" element={<UseCases />} />
            <Route path="/teams" element={<Teams />} />
          </Routes>
        </BrowserRouter>
      </MantineProvider>
    </HelmetProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
