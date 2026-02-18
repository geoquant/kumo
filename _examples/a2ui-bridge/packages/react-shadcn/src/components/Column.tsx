/**
 * @a2ui-bridge/react-shadcn - Column component
 * MIT License - Copyright (c) 2024 tpitre
 */

import type { ColumnNode } from '@a2ui-bridge/core';
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

export function Column({
  node,
  onAction,
  components,
  surfaceId,
}: A2UIComponentProps<ColumnNode>): JSX.Element {
  const theme = useTheme();
  const { properties } = node;

  const distribution = properties.distribution ?? 'start';
  const alignment = properties.alignment ?? 'stretch';

  const className = cn(
    classesToString(theme.components.Column),
    distributionClasses[distribution],
    alignmentClasses[alignment]
  );

  return (
    <div className={className}>
      {renderChildren(properties.children ?? [], components, onAction, surfaceId)}
    </div>
  );
}
