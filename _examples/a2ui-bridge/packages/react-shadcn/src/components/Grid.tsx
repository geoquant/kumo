/**
 * @a2ui-bridge/react-shadcn - Grid component
 * MIT License - Copyright (c) 2024 tpitre
 */

import type { AnyComponentNode } from '@a2ui-bridge/core';
import type { A2UIComponentProps } from '@a2ui-bridge/react';
import { renderChildren } from '@a2ui-bridge/react';
import { cn } from '../utils.js';

interface GridProperties {
  columns?: number | 'auto' | 'fit';
  rows?: number;
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  gapX?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  gapY?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'stretch';
  children?: AnyComponentNode[];
}

const gapClasses: Record<string, string> = {
  none: 'gap-0',
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8',
};

const gapXClasses: Record<string, string> = {
  none: 'gap-x-0',
  xs: 'gap-x-1',
  sm: 'gap-x-2',
  md: 'gap-x-4',
  lg: 'gap-x-6',
  xl: 'gap-x-8',
};

const gapYClasses: Record<string, string> = {
  none: 'gap-y-0',
  xs: 'gap-y-1',
  sm: 'gap-y-2',
  md: 'gap-y-4',
  lg: 'gap-y-6',
  xl: 'gap-y-8',
};

const alignClasses: Record<string, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

const justifyClasses: Record<string, string> = {
  start: 'justify-items-start',
  center: 'justify-items-center',
  end: 'justify-items-end',
  stretch: 'justify-items-stretch',
};

const columnClasses: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  7: 'grid-cols-7',
  8: 'grid-cols-8',
  9: 'grid-cols-9',
  10: 'grid-cols-10',
  11: 'grid-cols-11',
  12: 'grid-cols-12',
};

export function Grid({
  node,
  onAction,
  components,
  surfaceId,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as GridProperties;

  const columns = properties.columns ?? 1;
  const gap = properties.gap ?? 'md';
  const gapX = properties.gapX;
  const gapY = properties.gapY;
  const align = properties.align ?? 'stretch';
  const justify = properties.justify ?? 'stretch';

  // Handle column classes
  let colClass = 'grid-cols-1';
  if (typeof columns === 'number' && columnClasses[columns]) {
    colClass = columnClasses[columns];
  } else if (columns === 'auto') {
    colClass = 'grid-cols-[repeat(auto-fill,minmax(200px,1fr))]';
  } else if (columns === 'fit') {
    colClass = 'grid-cols-[repeat(auto-fit,minmax(200px,1fr))]';
  }

  const className = cn(
    'grid',
    colClass,
    gapX ? gapXClasses[gapX] : gapY ? '' : gapClasses[gap],
    gapY ? gapYClasses[gapY] : '',
    gapX && !gapY ? '' : '',
    alignClasses[align],
    justifyClasses[justify]
  );

  return (
    <div className={className}>
      {renderChildren(properties.children ?? [], components, onAction, surfaceId)}
    </div>
  );
}
