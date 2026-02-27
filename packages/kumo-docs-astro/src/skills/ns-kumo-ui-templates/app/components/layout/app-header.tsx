import { useState, useCallback } from "react";
import { ListIcon, SunIcon, MoonIcon } from "@phosphor-icons/react";
import { Button, cn } from "@cloudflare/kumo";
import { useRegisterBreadcrumbPortalTarget } from "~/components/layout/breadcrumb-portal";

interface AppHeaderProps {
  showMenuButton?: boolean;
  onMenuClick?: () => void;
}

function useTheme() {
  const [mode, setMode] = useState<"light" | "dark">(() => {
    if (typeof document === "undefined") return "light";
    return (document.documentElement.getAttribute("data-mode") as "light" | "dark") ?? "light";
  });

  const toggle = useCallback(() => {
    setMode((prev) => {
      const next = prev === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-mode", next);
      return next;
    });
  }, []);

  return { mode, toggle };
}

export function AppHeader({ showMenuButton, onMenuClick }: AppHeaderProps) {
  const registerTarget = useRegisterBreadcrumbPortalTarget();
  const { mode, toggle } = useTheme();

  return (
    <header
      className={cn(
        "h-[58px] shrink-0 border-b border-color flex items-center sm:px-6 px-4 z-20 sticky top-0 bg-kumo-elevated"
      )}
    >
      {showMenuButton && (
        <Button
          variant="ghost"
          shape="square"
          className="size-8 rounded-lg"
          aria-label="Open menu"
          onClick={onMenuClick}
        >
          <ListIcon weight="bold" className="size-4 text-neutral-500" />
        </Button>
      )}
      {/* portal target — breadcrumbs land here */}
      <div ref={registerTarget} className="flex items-center" />
      <div className="ml-auto flex gap-1">
        <Button
          variant="ghost"
          shape="square"
          className="size-8 rounded-lg"
          aria-label={mode === "light" ? "Switch to dark mode" : "Switch to light mode"}
          onClick={toggle}
        >
          {mode === "light" ? (
            <MoonIcon weight="bold" className="size-4 text-neutral-500" />
          ) : (
            <SunIcon weight="bold" className="size-4 text-neutral-500" />
          )}
        </Button>
      </div>
    </header>
  );
}
