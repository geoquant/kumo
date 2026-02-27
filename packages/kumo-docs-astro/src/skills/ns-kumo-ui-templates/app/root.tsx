import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { useState, useEffect } from "react";
import { cn, TooltipProvider } from "@cloudflare/kumo";
import { Sidebar } from "~/components/layout/sidebar";
import { AppHeader } from "~/components/layout/app-header";
import { BreadcrumbPortalProvider } from "~/components/layout/breadcrumb-portal";

import "./app.css";

// Layout renders during SPA shell pre-render (server-side).
// It must NOT contain any Kumo/Base UI components — only plain HTML
// and React Router's built-in shell components.
export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>NS Templates — Kumo UI</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=optional"
        />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 880 : true
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 880px)");
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isDesktop;
}

// App renders only on the client — safe to use Kumo components here.
export default function App() {
  const isDesktop = useIsDesktop();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!isDesktop) {
      setSidebarOpen(false);
    }
  }, [isDesktop]);

  return (
    <BreadcrumbPortalProvider>
    <TooltipProvider>
      <div
        className={cn(
          "grid h-screen overflow-hidden",
          "transition-[grid-template-columns] duration-250 ease-[cubic-bezier(0.77,0,0.175,1)]"
        )}
        style={{
          gridTemplateColumns:
            isDesktop
              ? sidebarOpen
                ? "260px 1fr"
                : "57px 1fr"
              : "1fr",
        }}
      >
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((v: boolean) => !v)}
          onClose={() => setSidebarOpen(false)}
          isDesktop={isDesktop}
        />

        <main className="min-w-0 h-full overflow-y-auto">
          <AppHeader
            showMenuButton={!isDesktop}
            onMenuClick={() => setSidebarOpen(true)}
          />
          <Outlet />
        </main>
      </div>
    </TooltipProvider>
    </BreadcrumbPortalProvider>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="container mx-auto p-4 pt-16">
      <h1 className="text-2xl font-bold">{message}</h1>
      <p className="mt-2">{details}</p>
      {stack && (
        <pre className="mt-4 w-full overflow-x-auto rounded bg-neutral-100 p-4 dark:bg-neutral-900">
          <code className="text-sm">{stack}</code>
        </pre>
      )}
    </main>
  );
}
