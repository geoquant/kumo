/**
 * @a2ui-bridge/react-shadcn - List component
 * MIT License - Copyright (c) 2024 tpitre
 */

import type { ListNode } from '@a2ui-bridge/core';
import type { A2UIComponentProps } from '@a2ui-bridge/react';
import { renderChildren } from '@a2ui-bridge/react';
import { useTheme } from '../theme/context.js';
import { cn, classesToString } from '../utils.js';

const directionClasses: Record<string, string> = {
  vertical: 'flex-col',
  horizontal: 'flex-row',
};

const alignmentClasses: Record<string, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

export function List({
  node,
  onAction,
  components,
  surfaceId,
}: A2UIComponentProps<ListNode>): JSX.Element {
  const theme = useTheme();
  const { properties } = node;

  const direction = properties.direction ?? 'vertical';
  const alignment = properties.alignment ?? 'stretch';

  const className = cn(
    classesToString(theme.components.List),
    directionClasses[direction],
    alignmentClasses[alignment]
  );

  return (
    <div className={className}>
      {renderChildren(properties.children ?? [], components, onAction, surfaceId)}
    </div>
  );
}
