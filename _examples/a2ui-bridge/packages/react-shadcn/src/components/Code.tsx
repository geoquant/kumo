/**
 * @a2ui-bridge/react-shadcn - Code component
 * MIT License - Copyright (c) 2024 tpitre
 */

import type { AnyComponentNode } from '@a2ui-bridge/core';
import type { A2UIComponentProps } from '@a2ui-bridge/react';
import { cn } from '../utils.js';

interface CodeProperties {
  text?: { literalString?: string; literal?: string };
  block?: boolean;
  language?: string;
  color?: 'default' | 'red' | 'green' | 'blue' | 'yellow';
}

const colorClasses: Record<string, string> = {
  default: 'bg-muted text-muted-foreground',
  red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
};

export function Code({ node }: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as CodeProperties;
  const text = properties.text?.literalString ?? properties.text?.literal ?? '';
  const block = properties.block ?? false;
  const color = properties.color ?? 'default';

  if (block) {
    return (
      <pre className={cn(
        'rounded-lg p-4 overflow-x-auto',
        colorClasses[color]
      )}>
        <code className="text-sm font-mono">{text}</code>
      </pre>
    );
  }

  return (
    <code className={cn(
      'relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm',
      colorClasses[color]
    )}>
      {text}
    </code>
  );
}
