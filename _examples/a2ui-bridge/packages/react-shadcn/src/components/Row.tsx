/**
 * @a2ui-bridge/react-shadcn - Row component
 * MIT License - Copyright (c) 2024 tpitre
 */

import type { RowNode } from '@a2ui-bridge/core';
import type { A2UIComponentProps } from '@a2ui-bridge/react';
import { renderChildren } from '@a2ui-bridge/react';
import { useTheme } from '../theme/context.js';
import { cn, classesToString } from '../utils.js';

const distributionClasses: Record<string, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  spaceBetween: 'justify-between',
  spaceAround: 'justify-around',
  spaceEvenly: 'justify-evenly',
};

const alignmentClasses: Record<string, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

export function Row({
  node,
  onAction,
  components,
  surfaceId,
}: A2UIComponentProps<RowNode>): JSX.Element {
  const theme = useTheme();
  const { properties } = node;

  const distribution = properties.distribution ?? 'start';
  const alignment = properties.alignment ?? 'center';

  const className = cn(
    classesToString(theme.components.Row),
    distributionClasses[distribution],
    alignmentClasses[alignment]
  );

  return (
    <div className={className}>
      {renderChildren(properties.children ?? [], components, onAction, surfaceId)}
    </div>
  );
}
