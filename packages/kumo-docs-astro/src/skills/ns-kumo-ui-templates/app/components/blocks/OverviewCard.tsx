import type { ReactNode } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { cn, LayerCard } from "@cloudflare/kumo";

function Header({
  href,
  onClick,
  children,
  className,
}: {
  href?: string;
  onClick?: () => void;
  children?: ReactNode;
  className?: string;
}) {
  const isClickable = href || onClick;
  const content = (
    <LayerCard.Secondary
      className={cn(
        "flex items-center justify-between",
        isClickable && "hover:bg-kumo-bg-muted cursor-pointer rounded-t-lg",
        className
      )}
    >
      {children}
    </LayerCard.Secondary>
  );
  if (href) {
    return (
      <a href={href} className="!no-underline">
        {content}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full text-left !no-underline">
        {content}
      </button>
    );
  }
  return content;
}

function Content({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <LayerCard.Primary className={cn("p-0", className)}>
      {children}
    </LayerCard.Primary>
  );
}

export function OverviewCard({
  className,
  headerClassName,
  contentClassName,
  title,
  children,
  href,
  onHeaderClick,
  badge,
  action,
}: {
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  href?: string;
  onHeaderClick?: () => void;
  badge?: ReactNode;
}) {
  const hasTitleProps = title || badge || action;
  return (
    <LayerCard className={className}>
      {hasTitleProps && (
        <Header className={headerClassName} href={href} onClick={onHeaderClick}>
          <div className="flex items-center gap-2">
            {title}
            {badge}
          </div>
          {action ? action : (href || onHeaderClick) ? <ArrowRightIcon /> : undefined}
        </Header>
      )}
      {hasTitleProps ? (
        <Content className={contentClassName}>{children}</Content>
      ) : (
        children
      )}
    </LayerCard>
  );
}
OverviewCard.Header = Header;
OverviewCard.Content = Content;
