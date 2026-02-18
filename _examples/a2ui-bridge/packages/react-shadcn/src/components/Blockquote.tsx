/**
 * @a2ui-bridge/react-shadcn - Blockquote component
 * MIT License - Copyright (c) 2024 tpitre
 */

import type { AnyComponentNode } from '@a2ui-bridge/core';
import type { A2UIComponentProps } from '@a2ui-bridge/react';
import { cn } from '../utils.js';

interface BlockquoteProperties {
  text?: { literalString?: string; literal?: string };
  cite?: { literalString?: string; literal?: string };
  color?: 'default' | 'blue' | 'green' | 'red' | 'yellow';
}

const colorClasses: Record<string, string> = {
  default: 'border-l-muted-foreground',
  blue: 'border-l-blue-500',
  green: 'border-l-green-500',
  red: 'border-l-red-500',
  yellow: 'border-l-yellow-500',
};

export function Blockquote({ node }: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as BlockquoteProperties;
  const text = properties.text?.literalString ?? properties.text?.literal ?? '';
  const cite = properties.cite?.literalString ?? properties.cite?.literal;
  const color = properties.color ?? 'default';

  return (
    <figure className="my-4">
      <blockquote className={cn(
        'border-l-4 pl-4 italic text-muted-foreground',
        colorClasses[color]
      )}>
        <p>{text}</p>
      </blockquote>
      {cite && (
        <figcaption className="mt-2 text-sm text-muted-foreground">
          — {cite}
        </figcaption>
      )}
    </figure>
  );
}
