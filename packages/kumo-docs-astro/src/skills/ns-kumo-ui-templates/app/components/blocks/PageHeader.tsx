import type { PropsWithChildren, ReactNode } from 'react';
import { cn } from '@cloudflare/kumo';
import { PageSurface } from './PageSurface';
import { BreadcrumbPortal } from '~/components/layout/breadcrumb-portal';

interface PageHeaderProps {
  breadcrumbs?: ReactNode;
  breadcrumb?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  header?: ReactNode;
  tabs?: ReactNode;
  actions?: ReactNode;
  tabsActionsClassName?: string;
  className?: string;
}

export function PageHeader({
  breadcrumbs,
  breadcrumb,
  title,
  description,
  header,
  tabs,
  actions,
  className,
  tabsActionsClassName,
  children
}: PropsWithChildren<PageHeaderProps>) {
  const resolvedBreadcrumbs = breadcrumbs ?? breadcrumb;

  return (
    <PageSurface className={className}>
      {!title && !description && header}

      {resolvedBreadcrumbs && (
        <BreadcrumbPortal>{resolvedBreadcrumbs}</BreadcrumbPortal>
      )}

      {(title || description) && (
        <div className="flex flex-col gap-2 py-3 pl-3">
          {title && (
            <h1 className="font-heading text-3xl font-semibold text-kumo-default">
              {title}
            </h1>
          )}
          {description && (
            <p className="max-w-prose text-base text-kumo-subtle">{description}</p>
          )}
        </div>
      )}

      {(tabs || actions) && (
        <header
          className={cn(
            'flex items-center justify-between', // Layout
            'h-[58px]', // Same header height as the top navigation
            'gap-3 px-4', // Spacing
            'border-b border-color', // Border bottom
            tabsActionsClassName, // Class name override
            `before:content-[''] before:absolute before:inset-x-0 before:top-[-1px] before:h-px before:border-color`, // Top border that becomes hidden when header reaches viewport top
            'sticky z-20 bg-kumo-elevated top-0' // Sticky top
          )}
        >
          {tabs}
          {actions && <div>{actions}</div>}
        </header>
      )}

      {children}
    </PageSurface>
  );
}
