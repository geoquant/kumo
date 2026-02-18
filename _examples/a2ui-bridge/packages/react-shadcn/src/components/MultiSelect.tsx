/**
 * @a2ui-bridge/react-shadcn - MultiSelect component
 * MIT License - Copyright (c) 2024 tpitre
 */

import React, { useState } from 'react';
import type { AnyComponentNode } from '@a2ui-bridge/core';
import type { A2UIComponentProps } from '@a2ui-bridge/react';
import { cn } from '../utils.js';

interface MultiSelectProperties {
  label?: { literalString?: string; literal?: string };
  placeholder?: { literalString?: string; literal?: string };
  value?: string[];
  disabled?: boolean;
  options?: Array<{ label: string; value?: string }>;
  action?: { name: string };
  searchable?: boolean;
  clearable?: boolean;
}

export function MultiSelect({ node, onAction }: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as MultiSelectProperties;
  const label = properties.label?.literalString ?? properties.label?.literal ?? '';
  const placeholder = properties.placeholder?.literalString ?? properties.placeholder?.literal ?? 'Select items...';
  const initialValue = properties.value ?? [];
  const disabled = properties.disabled ?? false;
  const options = properties.options ?? [];
  const clearable = properties.clearable ?? true;

  const [selectedValues, setSelectedValues] = useState<string[]>(initialValue);
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = (optionValue: string) => {
    if (disabled) return;

    const newValues = selectedValues.includes(optionValue)
      ? selectedValues.filter(v => v !== optionValue)
      : [...selectedValues, optionValue];

    setSelectedValues(newValues);

    if (properties.action?.name) {
      onAction({
        actionName: properties.action.name,
        sourceComponentId: node.id,
        timestamp: new Date().toISOString(),
        context: { values: newValues },
      });
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedValues([]);
    if (properties.action?.name) {
      onAction({
        actionName: properties.action.name,
        sourceComponentId: node.id,
        timestamp: new Date().toISOString(),
        context: { values: [] },
      });
    }
  };

  const selectedLabels = selectedValues
    .map(v => options.find(o => (o.value ?? o.label) === v)?.label)
    .filter(Boolean);

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            'flex min-h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm',
            'ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
        >
          <span className="flex flex-wrap gap-1">
            {selectedLabels.length > 0 ? (
              selectedLabels.map((label, i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium"
                >
                  {label}
                </span>
              ))
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <div className="flex items-center gap-1">
            {clearable && selectedValues.length > 0 && (
              <span
                onClick={handleClear}
                className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground"
              >
                ×
              </span>
            )}
            <svg
              className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
            {options.map((option, index) => {
              const optionValue = option.value ?? option.label;
              const isSelected = selectedValues.includes(optionValue);
              return (
                <div
                  key={index}
                  onClick={() => handleToggle(optionValue)}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                    'hover:bg-accent hover:text-accent-foreground',
                    isSelected && 'bg-accent/50'
                  )}
                >
                  <div className={cn(
                    'flex h-4 w-4 items-center justify-center rounded border',
                    isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
                  )}>
                    {isSelected && (
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  {option.label}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
