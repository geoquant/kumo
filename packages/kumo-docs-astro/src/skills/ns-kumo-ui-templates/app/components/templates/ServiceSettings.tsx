import { forwardRef, type ReactNode, type Ref } from "react";
import { cn, Text, LinkButton } from "@cloudflare/kumo";

type ServiceSettingsProps = React.ComponentPropsWithRef<"div"> & {
  title: string;
  description?: string;
  docsHref?: string;
  canUpdate?: boolean;
  actions?: ReactNode;
  sideNav?: ReactNode;
  sideNavRef?: Ref<HTMLElement>;
  sideNavTop?: number;
  children: ReactNode;
  contentRef?: Ref<HTMLDivElement>;
};

const ServiceSettings = forwardRef<HTMLDivElement, ServiceSettingsProps>(
  function ServiceSettings(
    {
      title,
      description,
      docsHref,
      canUpdate = true,
      actions,
      sideNav,
      sideNavRef,
      children,
      contentRef,
      sideNavTop,
      className,
      ...props
    },
    ref
  ) {
    return (
      <div
        ref={ref}
        className={cn("bg-kumo-elevated grow flex flex-col", className)}
        {...props}
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
          <main className="max-w-[1400px] mx-auto w-full p-6 md:p-8 lg:px-10">
            <div className="flex gap-8 xl:gap-12">
              <div ref={contentRef} className="flex-[3] max-w-[900px]">
                {children}
              </div>
              <aside
                ref={sideNavRef}
                className="hidden md:block flex-1 max-w-[180px]"
              >
                <div
                  className="sticky"
                  style={sideNavTop != null ? { top: sideNavTop } : undefined}
                >
                  {sideNav}
                </div>
              </aside>
            </div>
          </main>
        </div>
      </div>
    );
  }
);

export { ServiceSettings };
