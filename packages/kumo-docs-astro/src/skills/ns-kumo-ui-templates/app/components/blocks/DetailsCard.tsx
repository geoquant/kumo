import type { ReactNode } from "react";
import type { Icon } from "@phosphor-icons/react";
import { Button } from "@cloudflare/kumo";
import { OverviewCard } from "./OverviewCard";

export interface DetailItem {
  title: string;
  value?: string;
  action?: ReactNode;
  actionIcon?: Icon;
  actionLabel?: string;
  onAction?: () => void;
}

interface DetailRowProps {
  title: string;
  value?: string;
  action?: ReactNode;
  actionIcon?: Icon;
  actionLabel?: string;
  onAction?: () => void;
}

function DetailRow({ title, value, action, actionIcon, actionLabel, onAction }: DetailRowProps) {
  const actionContent = action ?? (actionIcon ? (
    <Button
      variant="ghost"
      shape="square"
      icon={actionIcon}
      aria-label={actionLabel ?? title}
      onClick={onAction}
    />
  ) : null);

  return (
    <li className="py-3 grid gap-1 list-none">
      <div className="text-kumo-subtle font-medium text-sm">
        {title}
      </div>
      <div className="h-5 flex items-center justify-between gap-1 min-w-0">
        <span className="truncate text-sm">{value || "—"}</span>
        {actionContent && <span className="shrink-0">{actionContent}</span>}
      </div>
    </li>
  );
}

export function DetailsCard({
  title,
  items,
  href,
}: {
  title: string;
  items: DetailItem[];
  href?: string;
}) {
  return (
    <OverviewCard title={title} href={href}>
      <ul className="px-4 mx-0 divide-y divide-kumo-line text-base">
        {items.map((item) => (
          <DetailRow
            key={item.title}
            title={item.title}
            value={item.value}
            action={item.action}
            actionIcon={item.actionIcon}
            actionLabel={item.actionLabel}
            onAction={item.onAction}
          />
        ))}
      </ul>
    </OverviewCard>
  );
}
