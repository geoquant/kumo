import { Text } from "@cloudflare/kumo";
import { InfoIcon } from "@phosphor-icons/react";
import { OverviewCard } from "./OverviewCard";

export interface MetricItemConfig {
  label: string;
  value?: string;
  unit?: string;
  showInfo?: boolean;
  statusBadge?: string;
}

function getStatusBadgeClasses(status: string): string {
  switch (status) {
    case "Healthy":
      return "bg-green-50 text-green-700 ring-green-600/20";
    case "Degraded":
      return "bg-yellow-50 text-yellow-700 ring-yellow-600/20";
    case "Down":
      return "bg-red-50 text-red-700 ring-red-600/20";
    default:
      return "bg-gray-50 text-gray-700 ring-gray-600/20";
  }
}

function MetricItem({ label, value, unit, showInfo, statusBadge }: MetricItemConfig) {
  return (
    <div className="flex flex-col gap-1 p-4 not-last:border-r border-kumo-line">
      <div className="flex items-center gap-1">
        <Text variant="secondary" size="sm">
          {label}
        </Text>
        {showInfo && (
          <InfoIcon size={14} className="text-kumo-subtle" />
        )}
      </div>
      <div className="flex items-baseline gap-1">
        {value && <Text variant="heading2">{value}</Text>}
        {unit && (
          <Text variant="secondary" size="sm">
            {unit}
          </Text>
        )}
        {statusBadge && (
          <span className={`inline-flex items-center rounded-md mt-2 px-2 py-0.5 text-sm font-medium ring-1 ring-inset ${getStatusBadgeClasses(statusBadge)}`}>
            {statusBadge}
          </span>
        )}
      </div>
    </div>
  );
}

export function MetricsCard({ metrics }: { metrics: MetricItemConfig[] }) {
  return (
    <OverviewCard title="Metrics">
      <div className="grid overflow-hidden rounded-lg" style={{ gridTemplateColumns: `repeat(${metrics.length}, minmax(0, 1fr))` }}>
        {metrics.map((metric) => (
          <MetricItem key={metric.label} {...metric} />
        ))}
      </div>
    </OverviewCard>
  );
}
