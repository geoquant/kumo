import { Badge, Button, Surface, Text } from '@cloudflare/kumo';
import { CaretRightIcon } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';

const CARD_STYLE =
  'flex flex-col gap-2 rounded-lg bg-kumo-base cursor-pointer p-4 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md overflow-hidden';

export type ButtonTag = {
  label: string;
  icon?: Icon;
};

export interface DocumentationCardProps {
  title: string;
  description: string;
  onClick?: () => void;
  href?: string;
  openInNewTab?: boolean;
  tags?: ButtonTag[];
}

export function DocumentationCard({
  title,
  description,
  onClick,
  href,
  openInNewTab = true,
  tags
}: DocumentationCardProps) {
  const handleClick = () => {
    if (href) {
      window.open(href, openInNewTab ? '_blank' : '_self');
    } else {
      onClick?.();
    }
  };

  return (
    <Surface className={CARD_STYLE} onClick={handleClick}>
      <div className="flex items-center justify-between">
        <Text variant="heading3">{title}</Text>
        <Button variant="ghost" aria-label="Open">
          <CaretRightIcon size={16} weight="bold" />
        </Button>
      </div>
      <Text variant="body">{description}</Text>
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {tags.map(tag => (
            <Badge key={tag.label} variant="outline" className="gap-1">
              {tag.icon && <tag.icon size={14} />}
              {tag.label}
            </Badge>
          ))}
        </div>
      )}
    </Surface>
  );
}
