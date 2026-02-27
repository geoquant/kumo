import type { ReactNode } from "react";
import { cn } from "@cloudflare/kumo";

const HEADER_HEIGHT = 58;

export function PageSurface({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <main
      className={cn(
        "w-full bg-kumo-elevated shadow-[0_100px_var(--kumo-color-bg-elevated)]",
        className
      )}
      style={{
        /**
         * Prevent the page from scrolling when the content doesn't
         * actually exceed 100vh
         */
        minHeight: `calc(100vh - ${HEADER_HEIGHT + 2}px)`,
      }}
    >
      {children}
    </main>
  );
}
