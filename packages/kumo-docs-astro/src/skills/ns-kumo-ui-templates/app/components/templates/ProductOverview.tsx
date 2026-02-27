import { useRef, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { cn, Text, Tooltip, SkeletonLine } from "@cloudflare/kumo";
import { InfoIcon } from "@phosphor-icons/react";
import PrimaryPageHeader from "~/components/blocks/PrimaryPageHeader";
import { PageSurface } from "~/components/blocks/PageSurface";

export type MetricsProps = {
  title: string;
  value: string | ReactNode;
  tooltip?: ReactNode;
  loading?: boolean;
};

export type UsageLimit = {
  translatedName: string;
  usedQuantity: number;
  limit: number;
  renderValue?: (value: number) => string;
};

export interface ProductOverviewProps {
  title?: string;
  titleIcon?: ReactNode;
  subtitle?: string;
  actions?: ReactNode[];
  children?: ReactNode;
  metrics?: MetricsProps[];
  isMetricsLoading?: boolean;
  usageLimits?: UsageLimit[];
  displayedDates?: {
    start: Date;
    end: Date;
  };
  displayedDatesTooltip?: string;
  footer?: ReactNode;
  hideRightColumn?: boolean;
  hideHeader?: boolean;
  className?: string;
}

export function ProductOverview({
  title,
  titleIcon,
  subtitle,
  actions,
  children,
  metrics,
  footer,
  hideRightColumn,
  usageLimits,
  isMetricsLoading,
  displayedDates,
  displayedDatesTooltip,
  hideHeader,
  className,
}: ProductOverviewProps) {
  const hasUsageLimit =
    displayedDates || (usageLimits && usageLimits.length > 0);
  const hasMetrics = metrics && metrics.length > 0;

  return (
    <PageSurface className={className}>
      <div
        className={cn(
          "@container",
          "flex flex-col",
          "p-6 md:p-8 lg:px-10 lg:py-9 md:gap-4 xl:gap-6",
          "max-w-[1400px] mx-auto w-full"
        )}
      >
        {!hideHeader && (
          <PrimaryPageHeader
            title={title}
            titleIcon={titleIcon}
            subtitle={subtitle}
            actions={actions}
          />
        )}

        <div
          className={cn(
            "flex flex-col-reverse gap-6",
            "@5xl:flex-row @5xl:gap-8"
          )}
        >
          <div className="min-w-0 grow">{children}</div>
          {!hideRightColumn && (
            <div
              className={cn(
                "@5xl:w-[380px] w-full @5xl:sticky top-22 h-fit",
                "flex flex-col gap-4 shrink-0"
              )}
            >
              {hasUsageLimit && (
                <UsageWithResourceLimits
                  usageLimits={usageLimits}
                  displayedDates={displayedDates}
                  displayedDatesTooltip={displayedDatesTooltip}
                />
              )}

              {hasMetrics && (
                <div className="grid grid-cols-2 sm:grid-cols-4 @5xl:grid-cols-2 gap-3">
                  {metrics?.map((item, index) => {
                    return (
                      <Tooltip
                        key={index}
                        content={item.tooltip ?? ""}
                      >
                        <div className="bg-kumo-bg-base rounded-lg p-4 relative border border-kumo-border-default">
                          <div className="text-xs text-kumo-text-secondary mb-1 line-clamp-1 truncate flex items-center gap-1">
                            <span>{item.title}</span>
                            {item.tooltip && <InfoIcon size={16} />}
                          </div>
                          {item.loading || isMetricsLoading ? (
                            <div className="h-8 flex items-center">
                              <SkeletonLine />
                            </div>
                          ) : (
                            <AutoShrinkText text={item.value} />
                          )}
                        </div>
                      </Tooltip>
                    );
                  })}
                </div>
              )}

              <div
                className={cn(
                  "hidden @5xl:block",
                  hasMetrics ? "mt-6" : "",
                  hasUsageLimit ? "mt-6" : ""
                )}
              >
                {footer}
              </div>
            </div>
          )}
        </div>
        <div className="mt-6 @5xl:hidden">{footer}</div>
      </div>
    </PageSurface>
  );
}

interface UsageWithResourceLimitsProps {
  usageLimits?: UsageLimit[];
  displayedDates?: {
    start: Date;
    end: Date;
  };
  displayedDatesTooltip?: string;
}

function UsageWithResourceLimits({
  usageLimits,
  displayedDates,
  displayedDatesTooltip,
}: UsageWithResourceLimitsProps) {
  const usageCounterToDisplay = [...(usageLimits ?? [])].sort(
    (a, b) => b.usedQuantity / b.limit - a.usedQuantity / a.limit
  )[0];

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  };

  const formattedDates = displayedDates ? (
    <div className="text-base font-medium text-kumo-text-secondary">
      {formatDate(displayedDates.start)} - {formatDate(displayedDates.end)}
    </div>
  ) : null;

  const showUsageCounter = usageCounterToDisplay;
  const hasUsageLimits = usageLimits && usageLimits.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="items-center justify-between hidden xl:flex h-9">
        <Text variant="heading2">Usage</Text>
        <Tooltip content={displayedDatesTooltip ?? "Current billing period"}>
          {formattedDates}
        </Tooltip>
      </div>
      {(showUsageCounter || hasUsageLimits) && (
        <div className="hidden xl:block">
          {showUsageCounter ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-kumo-text-secondary">
                  {usageCounterToDisplay.translatedName}
                </div>
                <div className="text-xs font-medium">
                  {usageCounterToDisplay.renderValue
                    ? `${usageCounterToDisplay.renderValue(
                        usageCounterToDisplay.usedQuantity
                      )} / ${usageCounterToDisplay.renderValue(
                        usageCounterToDisplay.limit
                      )}`
                    : `${usageCounterToDisplay.usedQuantity} / ${usageCounterToDisplay.limit}`}
                </div>
              </div>
              <div className="h-2 bg-kumo-bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#f6821f] rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      (usageCounterToDisplay.usedQuantity /
                        usageCounterToDisplay.limit) *
                      100
                    }%`,
                  }}
                />
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

function AutoShrinkText({ text }: { text: string | ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;

    if (container && textEl) {
      const containerWidth = container.offsetWidth;
      const textWidth = textEl.scrollWidth;

      const newScale =
        textWidth > containerWidth ? containerWidth / textWidth : 1;
      setScale(newScale);
    }
  }, [text]);

  return (
    <div ref={containerRef} className="w-full overflow-hidden h-8">
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "left center",
          display: "inline-block",
        }}
      >
        <div
          ref={textRef}
          className="text-lg md:text-2xl font-semibold whitespace-nowrap"
          style={{
            display: "inline-block",
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
}

export type { UsageLimit as ProductOverviewUsageLimit };
