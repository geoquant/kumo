import { type ReactNode } from "react";
import { cn, Text, LinkButton } from "@cloudflare/kumo";

// --- Main template ---

export interface ServiceDetailProps {
  title: string;
  description?: string;
  docsHref?: string;
  canUpdate?: boolean;
  actions?: ReactNode;
  children: ReactNode;
  emptyState?: ReactNode;
}

export function ServiceDetail({
  title,
  description,
  docsHref,
  canUpdate = true,
  actions,
  children,
  emptyState,
}: ServiceDetailProps) {
  return (
    <div
      className={cn(
        "bg-kumo-elevated grow flex flex-col"
      )}
    >
      <header className="@container py-8 border-b border-kumo-line bg-kumo-elevated">
        <div
          className={cn(
            "flex justify-between gap-4 max-w-[1400px] mx-auto px-6 md:px-8 lg:px-10",
            "flex-col", // small container
            "@4xl:flex-row @4xl:items-center" // large container
          )}
        >
          <article className="flex flex-col gap-2">
            <Text variant="heading2">{title}</Text>
            {description && (
              <Text variant="secondary">{description}</Text>
            )}
          </article>
          <div className="flex shrink-0 gap-2">
            {docsHref && (
              <LinkButton
                variant="secondary"
                href={docsHref}
                external
              >
                Documentation
              </LinkButton>
            )}
            {canUpdate && actions}
          </div>
        </div>
      </header>
      <div className="bg-kumo-elevated grow flex flex-col">
        <main
          className="max-w-[1400px] mx-auto w-full p-6 md:p-8 lg:px-10"
        >
          {children ?? emptyState ?? (
            <div className="rounded-lg bg-kumo-base border border-kumo-line h-[300px] flex items-center justify-center">
              <p className="text-neutral-600 dark:text-neutral-400">
                No content
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
