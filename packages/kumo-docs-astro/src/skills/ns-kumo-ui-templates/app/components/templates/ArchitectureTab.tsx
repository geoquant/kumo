import type { ReactNode } from "react";
import { cn, Text } from "@cloudflare/kumo";
import { ArchitectureDiagram } from "~/components/blocks/ArchitectureDiagram";
import type { BindingItem } from "~/components/blocks/ArchitectureDiagram";

export interface ArchitectureTabProps {
  /** Page heading displayed at the top of the tab */
  title: string;
  /** Description text displayed below the heading */
  description: string;
  /** Action buttons rendered in the top-right area (e.g. Documentation link, Add Route) */
  actions?: ReactNode;
  /** Heading above the architecture diagram */
  diagramTitle: string;
  /** Name shown on the destination node in the diagram */
  workerName: string;
  /** Binding rows rendered on the left side of the diagram */
  bindings: BindingItem[];
  /** Whether the user can update (shows the add-route badge in the diagram) */
  canUpdate?: boolean;
  /** Optional content rendered below the architecture diagram (e.g. a table) */
  children?: ReactNode;
}

export function ArchitectureTab({
  title,
  description,
  actions,
  diagramTitle,
  workerName,
  bindings,
  canUpdate = true,
  children,
}: ArchitectureTabProps) {
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
            "flex-col",
            "@4xl:flex-row @4xl:items-center"
          )}
        >
          <article className="flex flex-col gap-2">
            <Text variant="heading2">{title}</Text>
            <Text variant="secondary">{description}</Text>
          </article>
          {actions && (
            <div className="flex shrink-0 gap-2">{actions}</div>
          )}
        </div>
      </header>
      <main
        className="max-w-[1400px] mx-auto w-full p-6 md:p-8 lg:px-10"
        style={{ paddingBottom: "68px" }}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h2 className="!font-medium !text-lg dark:text-neutral-400 text-neutral-600">
              {diagramTitle}
            </h2>
            <ArchitectureDiagram
              className="h-[350px] rounded-lg border border-kumo-line overflow-hidden"
              workerName={workerName}
              bindings={bindings}
              canUpdate={canUpdate}
            />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
