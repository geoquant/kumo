/**
 * @a2ui-bridge/react-shadcn - Card component
 * MIT License - Copyright (c) 2024 tpitre
 */

import type { CardNode } from '@a2ui-bridge/core';
import type { A2UIComponentProps } from '@a2ui-bridge/react';
import { renderChild, renderChildren } from '@a2ui-bridge/react';
import { useTheme } from '../theme/context.js';
import { cn, classesToString } from '../utils.js';

export function Card({
  node,
  onAction,
  components,
  surfaceId,
}: A2UIComponentProps<CardNode>): JSX.Element {
  const theme = useTheme();
  const { properties } = node;
  const className = cn(classesToString(theme.components.Card), 'p-4');

  return (
    <div className={className}>
      {properties.child
        ? renderChild(properties.child, components, onAction, surfaceId)
        : renderChildren(properties.children ?? [], components, onAction, surfaceId)}
    </div>
  );
}
