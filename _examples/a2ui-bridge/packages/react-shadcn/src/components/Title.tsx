/**
 * @a2ui-bridge/react-shadcn - Title component
 * MIT License - Copyright (c) 2024 tpitre
 */

import type { AnyComponentNode } from '@a2ui-bridge/core';
import type { A2UIComponentProps } from '@a2ui-bridge/react';
import { cn } from '../utils.js';

interface TitleProperties {
  text?: { literalString?: string; literal?: string };
  order?: 1 | 2 | 3 | 4 | 5 | 6;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
}

const orderClasses: Record<number, string> = {
  1: 'text-4xl font-bold tracking-tight',
  2: 'text-3xl font-semibold tracking-tight',
  3: 'text-2xl font-semibold',
  4: 'text-xl font-semibold',
  5: 'text-lg font-medium',
  6: 'text-base font-medium',
};

const sizeClasses: Record<string, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
  '3xl': 'text-3xl',
  '4xl': 'text-4xl',
};

export function Title({ node }: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as TitleProperties;
  const text = properties.text?.literalString ?? properties.text?.literal ?? '';
  const order = properties.order ?? 1;
  const size = properties.size;

  // Use size class if provided, otherwise use order-based default classes
  const className = cn(
    size ? sizeClasses[size] : orderClasses[order]
  );

  switch (order) {
    case 1:
      return <h1 className={className}>{text}</h1>;
    case 2:
      return <h2 className={className}>{text}</h2>;
    case 3:
      return <h3 className={className}>{text}</h3>;
    case 4:
      return <h4 className={className}>{text}</h4>;
    case 5:
      return <h5 className={className}>{text}</h5>;
    case 6:
      return <h6 className={className}>{text}</h6>;
    default:
      return <h1 className={className}>{text}</h1>;
  }
}
