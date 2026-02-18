/**
 * @a2ui-bridge/react-shadcn - Utility functions
 * MIT License - Copyright (c) 2024 tpitre
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with proper precedence.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Convert a theme class map (Record<string, boolean>) to a class string.
 */
export function classesToString(classMap: Record<string, boolean>): string {
  return Object.entries(classMap)
    .filter(([, enabled]) => enabled)
    .map(([className]) => className)
    .join(' ');
}
