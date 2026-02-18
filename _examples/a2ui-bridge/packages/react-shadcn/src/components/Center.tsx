/**
 * @a2ui-bridge/react-shadcn - Center component
 * MIT License - Copyright (c) 2024 tpitre
 */

import type { AnyComponentNode } from '@a2ui-bridge/core';
import type { A2UIComponentProps } from '@a2ui-bridge/react';
import { renderChildren } from '@a2ui-bridge/react';
import { cn } from '../utils.js';

interface CenterProperties {
  inline?: boolean;
  children?: AnyComponentNode[];
}

export function Center({
  node,
  onAction,
  components,
  surfaceId,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as CenterProperties;
  const inline = properties.inline ?? false;

  const className = cn(
    inline ? 'inline-flex' : 'flex',
    'items-center justify-center'
  );

  return (
    <div className={className}>
      {renderChildren(properties.children ?? [], components, onAction, surfaceId)}
    </div>
  );
}
