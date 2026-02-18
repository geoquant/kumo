/**
 * @a2ui-bridge/react-shadcn - ActionIcon component
 * MIT License - Copyright (c) 2024 tpitre
 */

import type { AnyComponentNode } from '@a2ui-bridge/core';
import type { A2UIComponentProps } from '@a2ui-bridge/react';
import { renderChild } from '@a2ui-bridge/react';
import { cn } from '../utils.js';

interface ActionIconProperties {
  variant?: 'default' | 'filled' | 'light' | 'outline' | 'subtle' | 'transparent';
  color?: 'default' | 'primary' | 'secondary' | 'destructive';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  radius?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  disabled?: boolean;
  loading?: boolean;
  child?: AnyComponentNode;
  action?: {
    name: string;
    context?: Array<{ key: string; value: { literalString?: string; literalNumber?: number; literalBoolean?: boolean } }>;
  };
}

const sizeClasses: Record<string, string> = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-12 w-12 text-lg',
  xl: 'h-14 w-14 text-xl',
};

const radiusClasses: Record<string, string> = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
};

const variantClasses: Record<string, Record<string, string>> = {
  default: {
    default: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  },
  filled: {
    default: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  },
  light: {
    default: 'bg-secondary/50 text-secondary-foreground hover:bg-secondary/70',
    primary: 'bg-primary/10 text-primary hover:bg-primary/20',
    secondary: 'bg-secondary/50 text-secondary-foreground hover:bg-secondary/70',
    destructive: 'bg-destructive/10 text-destructive hover:bg-destructive/20',
  },
  outline: {
    default: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    primary: 'border border-primary text-primary hover:bg-primary hover:text-primary-foreground',
    secondary: 'border border-secondary text-secondary-foreground hover:bg-secondary',
    destructive: 'border border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground',
  },
  subtle: {
    default: 'bg-transparent hover:bg-accent hover:text-accent-foreground',
    primary: 'bg-transparent text-primary hover:bg-primary/10',
    secondary: 'bg-transparent hover:bg-secondary',
    destructive: 'bg-transparent text-destructive hover:bg-destructive/10',
  },
  transparent: {
    default: 'bg-transparent hover:bg-transparent/10',
    primary: 'bg-transparent text-primary hover:opacity-80',
    secondary: 'bg-transparent hover:opacity-80',
    destructive: 'bg-transparent text-destructive hover:opacity-80',
  },
};

export function ActionIcon({
  node,
  onAction,
  components,
  surfaceId,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as ActionIconProperties;

  const variant = properties.variant ?? 'default';
  const color = properties.color ?? 'default';
  const size = properties.size ?? 'md';
  const radius = properties.radius ?? 'md';
  const disabled = properties.disabled ?? false;
  const loading = properties.loading ?? false;

  const handleClick = () => {
    if (disabled || loading) return;
    if (properties.action) {
      onAction({
        actionName: properties.action.name,
        sourceComponentId: node.id,
        timestamp: new Date().toISOString(),
        context: properties.action.context?.reduce(
          (acc, item) => {
            acc[item.key] =
              item.value.literalString ??
              item.value.literalNumber ??
              item.value.literalBoolean;
            return acc;
          },
          {} as Record<string, unknown>
        ),
      });
    }
  };

  const className = cn(
    'inline-flex items-center justify-center transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    sizeClasses[size],
    radiusClasses[radius],
    variantClasses[variant][color]
  );

  return (
    <button
      className={className}
      onClick={handleClick}
      disabled={disabled || loading}
      type="button"
    >
      {loading ? (
        <svg
          className="h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : properties.child ? (
        renderChild(properties.child, components, onAction, surfaceId)
      ) : null}
    </button>
  );
}
