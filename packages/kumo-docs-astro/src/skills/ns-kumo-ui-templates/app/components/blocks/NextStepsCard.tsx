import { Text } from "@cloudflare/kumo";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { OverviewCard } from "./OverviewCard";

export interface NextStep {
  id?: string;
  icon?: React.ReactNode;
  title: string;
  description: string;
  href?: string;
}

export interface NextStepsCardProps {
  steps: NextStep[];
}

export function NextStepsCard({ steps }: NextStepsCardProps) {
  return (
    <OverviewCard title="Next steps">
      <div className="px-4 text-base divide-y divide-kumo-line">
        {steps.map((step) => (
          <a
            key={step.id}
            href={step.href}
            className="flex items-center justify-between py-4 gap-2 cursor-pointer no-underline text-kumo-text-default hover:text-kumo-default"
          >
            <div className="grid gap-1">
              <span className="flex items-center gap-1">
                {step.icon && (
                  <span className="w-4 h-4 text-kumo-default">
                    {step.icon}
                  </span>
                )}
                <Text variant="body" bold>{step.title}</Text>
              </span>
              <Text variant="body">
                {step.description}
              </Text>
            </div>
            <span className="shrink-0 text-kumo-default">
              <ArrowRightIcon />
            </span>
          </a>
        ))}
      </div>
    </OverviewCard>
  );
}
