/**
 * @a2ui-bridge/react-shadcn - Image component
 * MIT License - Copyright (c) 2024 tpitre
 */

import type { ImageNode } from '@a2ui-bridge/core';
import type { A2UIComponentProps } from '@a2ui-bridge/react';
import { useTheme } from '../theme/context.js';
import { cn, classesToString } from '../utils.js';

const imageTypeClasses: Record<string, string> = {
  icon: 'w-6 h-6',
  avatar: 'w-16 h-16 rounded-full',
  header: 'w-full h-auto',
  largeFeature: 'w-full max-w-md',
  mediumFeature: 'w-full max-w-sm',
  smallFeature: 'w-full max-w-xs',
};

export function Image({ node }: A2UIComponentProps<ImageNode>): JSX.Element {
  const theme = useTheme();
  const { properties } = node;

  const src = properties.url?.literalString ?? properties.url?.literal ?? '';
  const usageHint = properties.usageHint ?? 'mediumFeature';

  const className = cn(
    classesToString(theme.components.Image?.all ?? {}),
    imageTypeClasses[usageHint] ?? ''
  );

  return (
    <img
      src={src}
      alt=""
      className={className}
    />
  );
}
