import * as React from "react";
import { cn, Text, Breadcrumbs } from "@cloudflare/kumo";
import { BreadcrumbPortal } from "~/components/layout/breadcrumb-portal";

export default function PrimaryPageHeader({
  title,
  titleIcon,
  subtitle,
  actions,
  className,
}: {
  title: string | React.ReactNode;
  titleIcon?: React.ReactNode;
  subtitle?: string | React.ReactNode;
  actions?: React.ReactNode[];
  className?: string;
}) {
  const [showBreadcrumb, setShowBreadcrumb] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowBreadcrumb(!entry.isIntersecting);
      },
      {
        threshold: 0.5,
        rootMargin: "-58px 0px 0px 0px",
      }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <header className={cn("flex gap-4 justify-between items-start", className)}>
      <BreadcrumbPortal>
        <div
          className={cn(
            "transition-all duration-250",
            showBreadcrumb
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-1"
          )}
        >
          <Breadcrumbs>
            <Breadcrumbs.Current
              icon={
                titleIcon ? (
                  <svg width="16" viewBox="0 0 28 28">
                    {titleIcon}
                  </svg>
                ) : undefined
              }
            >
              {title}
            </Breadcrumbs.Current>
          </Breadcrumbs>
        </div>
      </BreadcrumbPortal>
      <div className="flex flex-col">
        <div className="!mb-1.5 flex items-center gap-1.5" ref={ref}>
          {titleIcon}
          <Text variant="heading1">{title}</Text>
        </div>
        <p className="hidden md:block text-pretty">
          <Text as="span" size="lg" variant="secondary">
            {subtitle}
          </Text>
        </p>
      </div>
      <div className="flex items-center gap-2">
        {actions?.map((item, index) => {
          return <React.Fragment key={index}>{item}</React.Fragment>;
        })}
      </div>
    </header>
  );
}
