/**
 * @a2ui-bridge/react-shadcn - Box component
 * MIT License - Copyright (c) 2024 tpitre
 */

import type { AnyComponentNode } from '@a2ui-bridge/core';
import type { A2UIComponentProps } from '@a2ui-bridge/react';
import { renderChildren } from '@a2ui-bridge/react';
import { cn } from '../utils.js';

interface BoxProperties {
  padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  margin?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  children?: AnyComponentNode[];
}

const paddingClasses: Record<string, string> = {
  none: 'p-0',
  xs: 'p-1',
  sm: 'p-2',
  md: 'p-4',
  lg: 'p-6',
  xl: 'p-8',
};

const marginClasses: Record<string, string> = {
  none: 'm-0',
  xs: 'm-1',
  sm: 'm-2',
  md: 'm-4',
  lg: 'm-6',
  xl: 'm-8',
};

export function Box({
  node,
  onAction,
  components,
  surfaceId,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as BoxProperties;

  const padding = properties.padding;
  const margin = properties.margin;

  const className = cn(
    padding ? paddingClasses[padding] : '',
    margin ? marginClasses[margin] : ''
  );

  // If no classes, render plain div
  if (!className.trim()) {
    return (
      <div>
        {renderChildren(properties.children ?? [], components, onAction, surfaceId)}
      </div>
    );
  }

  return (
    <div className={className}>
      {renderChildren(properties.children ?? [], components, onAction, surfaceId)}
    </div>
  );
}
