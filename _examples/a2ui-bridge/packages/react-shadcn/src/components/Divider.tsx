/**
 * @a2ui-bridge/react-shadcn - Divider component
 * MIT License - Copyright (c) 2024 tpitre
 */

import type { DividerNode } from '@a2ui-bridge/core';
import type { A2UIComponentProps } from '@a2ui-bridge/react';
import { useTheme } from '../theme/context.js';
import { cn, classesToString } from '../utils.js';

export function Divider({ node }: A2UIComponentProps<DividerNode>): JSX.Element {
  const theme = useTheme();
  const { properties } = node;

  const isVertical = properties.axis === 'vertical';

  const className = cn(
    classesToString(theme.components.Divider),
    isVertical ? 'h-full w-[1px]' : 'h-[1px] w-full'
  );

  return <hr className={className} />;
}
