import type { ReactNode } from "react";
import { cn } from "@cloudflare/kumo";
import { PageSurface } from "~/components/blocks/PageSurface";

export interface ServiceOverviewProps {
  /** Content rendered in the main (left) column — e.g. MetricsCard, ListTableCard, etc. */
  leftContent?: ReactNode[];
  /** Content rendered in the sidebar (right) column — e.g. DetailsCard, etc. */
  rightContent?: ReactNode[];
  className?: string;
}

export function ServiceOverview({
  leftContent,
  rightContent,
  className,
}: ServiceOverviewProps) {
  return (
    <PageSurface className={className}>
      <div
        className={cn(
          "grid-cols-[1fr_min(1348px,100%)_1fr] [&>*]:col-start-2",
          "p-6 md:p-8 lg:px-10 grid gap-y-5"
        )}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_250px] xl:grid-cols-[1fr_300px] items-start gap-5 w-full">
          {leftContent && leftContent.length > 0 && (
            <div className="grid gap-4">
              {leftContent}
            </div>
          )}
          {rightContent && rightContent.length > 0 && (
            <aside className="grid gap-4 sticky top-[80px]">
              {rightContent}
            </aside>
          )}
        </div>
      </div>
    </PageSurface>
  );
}
