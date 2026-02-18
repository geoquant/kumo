/**
 * @a2ui-bridge/react-shadcn - Container component
 * MIT License - Copyright (c) 2024 tpitre
 */

import type { AnyComponentNode } from '@a2ui-bridge/core';
import type { A2UIComponentProps } from '@a2ui-bridge/react';
import { renderChildren } from '@a2ui-bridge/react';
import { cn } from '../utils.js';

interface ContainerProperties {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  fluid?: boolean;
  children?: AnyComponentNode[];
}

const sizeClasses: Record<string, string> = {
  xs: 'max-w-screen-sm',
  sm: 'max-w-screen-md',
  md: 'max-w-screen-lg',
  lg: 'max-w-screen-xl',
  xl: 'max-w-screen-2xl',
  full: 'max-w-full',
};

export function Container({
  node,
  onAction,
  components,
  surfaceId,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as ContainerProperties;

  const size = properties.size ?? 'lg';
  const fluid = properties.fluid ?? false;

  const className = cn(
    'w-full mx-auto px-4',
    fluid ? 'max-w-full' : sizeClasses[size]
  );

  return (
    <div className={className}>
      {renderChildren(properties.children ?? [], components, onAction, surfaceId)}
    </div>
  );
}
