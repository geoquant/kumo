import { Fragment, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { cn, Button, CloudflareLogo, Tooltip, Text } from "@cloudflare/kumo";
import { XIcon, HouseIcon } from "@phosphor-icons/react";
import { NAV_SECTIONS } from "~/data/navigation";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  isDesktop: boolean;
}

export function Sidebar({ isOpen, onToggle, onClose, isDesktop }: SidebarProps) {
  const location = useLocation();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const resizeTimeoutRef = useRef<number | null>(null);

  const dataState = !isDesktop || isOpen ? "expanded" : "collapsed";

  // Debounce resize to disable transitions during window resize
  useEffect(() => {
    const handleResize = () => {
      setIsResizing(true);
      if (resizeTimeoutRef.current) {
        window.clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = window.setTimeout(() => {
        setIsResizing(false);
        resizeTimeoutRef.current = null;
      }, 200);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeTimeoutRef.current) {
        window.clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, []);

  // Close on outside click (mobile overlay)
  useEffect(() => {
    if (isDesktop || !isOpen) return;
    const handler = (e: MouseEvent) => {
      if (overlayRef.current && e.target === overlayRef.current) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isDesktop, isOpen, onClose]);

  return (
    <>
      {/* Mobile overlay */}
      {!isDesktop && isOpen && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-[1099] bg-black/30 transition-opacity"
        />
      )}

      {/* Sidebar rail */}
      <aside
        data-state={dataState}
        data-resizing={isResizing || undefined}
        className={cn(
          "group/sidebar relative peer/sidebar-rail border-r border-color",
          "flex flex-col h-screen",
          "data-[resizing=true]:transition-none data-[resizing=true]:duration-0",
          "data-[resizing=true]:[&_*]:!transition-none data-[resizing=true]:[&_*]:!duration-0",
          isDesktop
            ? "sticky top-0 z-50"
            : cn(
                "fixed top-0 left-0 w-[260px] z-[1100]",
                "transition-transform duration-300 ease-in-out",
                isOpen ? "translate-x-0" : "-translate-x-full"
              ),
          "bg-kumo-elevated",
          "print:hidden overflow-visible"
        )}
      >
        {/* Content container */}
        <div
          className={cn(
            "h-[calc(100vh-48px)] whitespace-nowrap overflow-hidden",
            "bg-kumo-elevated border-r border-color",
            !isDesktop
              ? "relative w-[260px]"
              : cn(
                  "group-data-[state=expanded]/sidebar:relative group-data-[state=expanded]/sidebar:w-[260px]",
                  "group-data-[state=collapsed]/sidebar:fixed group-data-[state=collapsed]/sidebar:top-0 group-data-[state=collapsed]/sidebar:left-0 group-data-[state=collapsed]/sidebar:z-[1190]",
                  "group-data-[state=collapsed]/sidebar:w-[57px]",
                  "group-data-[state=collapsed]/sidebar:border-r group-data-[state=collapsed]/sidebar:border-color",
                  "transition-[width] duration-250 ease-[cubic-bezier(0.77,0,0.175,1)] will-change-[width]"
                )
          )}
        >
          {/* Header */}
          <div className="h-[58px] flex items-center px-2 border-b border-color gap-4">
            <button
              type="button"
              onClick={onToggle}
              aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
              className={cn(
                "-translate-y-0.4 cursor-pointer origin-left bg-transparent border-none p-0",
                "scale-[0.833] group-data-[state=expanded]/sidebar:scale-100",
                "transition-transform duration-250"
              )}
            >
              <div>
                <svg role="img" viewBox="0 0 460 271.2" width="48" height="47px" aria-hidden="true">
                  <path fill="#FBAD41" d="M328.6,125.6c-0.8,0-1.5,0.6-1.8,1.4l-4.8,16.7c-2.1,7.2-1.3,13.8,2.2,18.7    c3.2,4.5,8.6,7.1,15.1,7.4l26.2,1.6c0.8,0,1.5,0.4,1.9,1c0.4,0.6,0.5,1.5,0.3,2.2c-0.4,1.2-1.6,2.1-2.9,2.2l-27.3,1.6    c-14.8,0.7-30.7,12.6-36.3,27.2l-2,5.1c-0.4,1,0.3,2,1.4,2h93.8c1.1,0,2.1-0.7,2.4-1.8c1.6-5.8,2.5-11.9,2.5-18.2    c0-37-30.2-67.2-67.3-67.2C330.9,125.5,329.7,125.5,328.6,125.6z"></path>
                  <path fill="#F6821F" d="M292.8,204.4c2.1-7.2,1.3-13.8-2.2-18.7c-3.2-4.5-8.6-7.1-15.1-7.4l-123.1-1.6    c-0.8,0-1.5-0.4-1.9-1s-0.5-1.4-0.3-2.2c0.4-1.2,1.6-2.1,2.9-2.2l124.2-1.6c14.7-0.7,30.7-12.6,36.3-27.2l7.1-18.5    c0.3-0.8,0.4-1.6,0.2-2.4c-8-36.2-40.3-63.2-78.9-63.2c-35.6,0-65.8,23-76.6,54.9c-7-5.2-15.9-8-25.5-7.1    c-17.1,1.7-30.8,15.4-32.5,32.5c-0.4,4.4-0.1,8.7,0.9,12.7c-27.9,0.8-50.2,23.6-50.2,51.7c0,2.5,0.2,5,0.5,7.5    c0.2,1.2,1.2,2.1,2.4,2.1h227.2c1.3,0,2.5-0.9,2.9-2.2L292.8,204.4z"></path></svg></div>
            </button>
            <span
              className={cn(
                "opacity-0 group-data-[state=expanded]/sidebar:opacity-100",
                "transition-opacity duration-250"
              )}
            >
              <Text variant="body" size="base" bold>
                Network Services
              </Text>
            </span>
            {!isDesktop && (
              <div className="ml-auto flex">
                <Button
                  variant="ghost"
                  shape="square"
                  className="size-8"
                  onClick={onClose}
                  aria-label="Close sidebar"
                >
                  <XIcon weight="bold" size={14} className="text-neutral-500" />
                </Button>
              </div>
            )}
          </div>

          {/* Scrollable nav area */}
          <div className="h-[calc(100vh-58px)] overflow-y-auto overflow-x-hidden">
            <nav aria-expanded={!!isOpen} className="h-full flex flex-col">
              <ul
                className={cn(
                  "list-none relative w-full mx-0 mb-[60px]",
                  "mt-0 flex flex-col gap-y-px items-stretch",
                  "px-[11px]",
                  "group-data-[state=expanded]/sidebar:px-3.5",
                  "transition-[padding] duration-250"
                )}
              >
                {/* Home link */}
                <li className="relative mt-3">
                  <Link
                    to="/"
                    aria-current={location.pathname === "/" ? "page" : undefined}
                    onClick={() => { if (!isDesktop) onClose(); }}
                    className={cn(
                      "no-underline flex items-center font-medium text-sm gap-2 cursor-pointer outline-none",
                      "w-full rounded-lg min-h-8.5 px-3 py-0 transition-colors",
                      location.pathname === "/"
                        ? "text-neutral-950 dark:text-white bg-neutral-150 dark:bg-neutral-900"
                        : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-150 dark:hover:bg-neutral-900"
                    )}
                  >
                    <HouseIcon size={16} className="shrink-0 opacity-50" />
                    <span className="truncate">Home</span>
                  </Link>
                </li>

                {/* Nav sections */}
                {NAV_SECTIONS.map((section) => (
                  <Fragment key={section.label}>
                    {/* Section label */}
                    <li
                      className={cn(
                        "w-full grid my-3 group-data-[state=expanded]/sidebar:my-0",
                        "grid-rows-[0fr] group-data-[state=expanded]/sidebar:grid-rows-[1fr]",
                        "transition-[grid-template-rows,border,margin] duration-250",
                        "border-b border-color",
                        "group-data-[state=expanded]/sidebar:border-transparent"
                      )}
                    >
                      <div className="overflow-hidden min-h-0">
                        <div className="px-3 pt-4 pb-2 text-sm font-medium text-neutral-400">
                          {section.label}
                        </div>
                      </div>
                    </li>

                    {/* Section links */}
                    {section.links.map((link) => {
                      const isActive = location.pathname === link.to;
                      return (
                        <li key={link.to} className="relative">
                          <Link
                            to={link.to}
                            aria-current={isActive ? "page" : undefined}
                            onClick={() => { if (!isDesktop) onClose(); }}
                            className={cn(
                              "no-underline flex items-center font-medium text-sm gap-2 cursor-pointer outline-none",
                              "w-full rounded-lg min-h-8.5 px-3 py-0 transition-colors",
                              isActive
                                ? "text-neutral-950 dark:text-white bg-neutral-150 dark:bg-neutral-900"
                                : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-150 dark:hover:bg-neutral-900"
                            )}
                          >
                            <link.icon size={16} className="shrink-0 opacity-50" />
                            <span className="truncate">{link.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </Fragment>
                ))}
              </ul>
            </nav>
          </div>
        </div>

        {/* Footer with collapse/expand toggle */}
        <footer
          className={cn(
            "mt-auto flex-shrink-0 z-60 border-r border-transparent",
            "overflow-hidden",
            "group-data-[state=expanded]/sidebar:relative group-data-[state=expanded]/sidebar:w-[260px]",
            "group-data-[state=collapsed]/sidebar:fixed group-data-[state=collapsed]/sidebar:bottom-0 group-data-[state=collapsed]/sidebar:left-0 group-data-[state=collapsed]/sidebar:z-[1190]",
            "group-data-[state=collapsed]/sidebar:w-[57px]",
            "transition-[width] duration-250 ease-[cubic-bezier(0.77,0,0.175,1)] will-change-[width]"
          )}
        >
          <div
            className={cn(
              "flex items-center gap-4 w-[260px] h-12 px-3.5 whitespace-nowrap overflow-hidden border-t border-color",
              "bg-kumo-elevated"
            )}
          >
            {isDesktop && (
              <Tooltip
                content={
                  <span className="inline-flex items-center gap-2">
                    {isOpen ? "Collapse sidebar" : "Expand sidebar"}
                  </span>
                }
                side="top"
                asChild
              >
                <Button
                  onClick={onToggle}
                  aria-expanded={isOpen}
                  aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "grid place-items-center my-auto p-0 size-7",
                    "[&_svg]:pointer-events-none",
                    "text-muted"
                  )}
                >
                  <svg
                    width={18}
                    height={18}
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                    focusable="false"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  >
                    <path d="M21.25 6.72v10.56a2.97 2.97 0 0 1-2.97 2.97H5.72a2.97 2.97 0 0 1-2.97-2.97V6.72a2.97 2.97 0 0 1 2.97-2.97h12.56a2.97 2.97 0 0 1 2.97 2.97" />
                    <path
                      d="M6.25 7.25v9.5"
                      className={cn(
                        "transition-transform duration-250",
                        !isOpen ? "translate-x-[10.5px]" : "translate-x-px"
                      )}
                    />
                  </svg>
                </Button>
              </Tooltip>
            )}
          </div>
        </footer>
      </aside>
    </>
  );
}
