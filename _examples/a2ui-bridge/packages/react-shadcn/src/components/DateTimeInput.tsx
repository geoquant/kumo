/**
 * @a2ui-bridge/react-shadcn - DateTimeInput component
 * MIT License - Copyright (c) 2025 Southleft
 */

import { useState } from 'react';
import type { JSX } from 'react';
import type { DateTimeInputNode } from '@a2ui-bridge/core';
import type { A2UIComponentProps } from '@a2ui-bridge/react';
import { useTheme } from '../theme/context.js';
import { cn, classesToString } from '../utils.js';

export function DateTimeInput({
  node,
  onAction,
}: A2UIComponentProps<DateTimeInputNode>): JSX.Element {
  const theme = useTheme();
  const { properties } = node;

  // Extract properties
  const initialValue = properties.value?.literalString ?? properties.value?.path ?? '';
  const enableDate = properties.enableDate ?? true;
  const enableTime = properties.enableTime ?? false;
  const outputFormat = properties.outputFormat;

  const [dateValue, setDateValue] = useState(initialValue);
  const [timeValue, setTimeValue] = useState('');

  // Determine input type based on flags
  const getInputType = () => {
    if (enableDate && enableTime) return 'datetime-local';
    if (enableTime && !enableDate) return 'time';
    return 'date';
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'date' | 'time') => {
    const newValue = e.target.value;

    if (field === 'date') {
      setDateValue(newValue);
    } else {
      setTimeValue(newValue);
    }

    // Dispatch action with the new value
    onAction({
      actionName: 'dateTimeChange',
      sourceComponentId: node.id,
      timestamp: new Date().toISOString(),
      context: {
        value: field === 'date' ? newValue : timeValue,
        dateValue: field === 'date' ? newValue : dateValue,
        timeValue: field === 'time' ? newValue : timeValue,
        field,
      },
    });
  };

  const inputType = getInputType();

  // For combined datetime-local, use single input
  if (inputType === 'datetime-local') {
    return (
      <div
        className={cn(
          'flex flex-col gap-1.5',
          classesToString((theme.components as Record<string, any>).DateTimeInput?.all ?? {})
        )}
      >
        <input
          type="datetime-local"
          value={dateValue}
          onChange={(e) => handleChange(e, 'date')}
          className={cn(
            'flex h-10 w-full rounded-md border px-3 py-2 text-sm',
            'bg-white dark:bg-zinc-900',
            'border-zinc-200 dark:border-zinc-700',
            'text-zinc-900 dark:text-zinc-100',
            'focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 dark:focus:ring-zinc-600',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
        />
      </div>
    );
  }

  // For separate date and time inputs
  return (
    <div
      className={cn(
        'flex gap-3',
        classesToString((theme.components as Record<string, any>).DateTimeInput?.all ?? {})
      )}
    >
      {enableDate && (
        <div className="flex flex-col gap-1.5 flex-1">
          <input
            type="date"
            value={dateValue}
            onChange={(e) => handleChange(e, 'date')}
            className={cn(
              'flex h-10 w-full rounded-md border px-3 py-2 text-sm',
              'bg-white dark:bg-zinc-900',
              'border-zinc-200 dark:border-zinc-700',
              'text-zinc-900 dark:text-zinc-100',
              'focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 dark:focus:ring-zinc-600',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          />
        </div>
      )}
      {enableTime && (
        <div className="flex flex-col gap-1.5 flex-1">
          <input
            type="time"
            value={timeValue}
            onChange={(e) => handleChange(e, 'time')}
            className={cn(
              'flex h-10 w-full rounded-md border px-3 py-2 text-sm',
              'bg-white dark:bg-zinc-900',
              'border-zinc-200 dark:border-zinc-700',
              'text-zinc-900 dark:text-zinc-100',
              'focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 dark:focus:ring-zinc-600',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          />
        </div>
      )}
    </div>
  );
}
