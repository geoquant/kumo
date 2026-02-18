/**
 * @a2ui-bridge/react-shadcn - NumberInput component
 * MIT License - Copyright (c) 2024 tpitre
 */

import React, { useState } from 'react';
import type { AnyComponentNode } from '@a2ui-bridge/core';
import type { A2UIComponentProps } from '@a2ui-bridge/react';
import { cn } from '../utils.js';

interface NumberInputProperties {
  label?: { literalString?: string; literal?: string };
  placeholder?: { literalString?: string; literal?: string };
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  action?: { name: string };
  hideControls?: boolean;
  prefix?: { literalString?: string; literal?: string };
  suffix?: { literalString?: string; literal?: string };
  decimalScale?: number;
}

export function NumberInput({ node, onAction }: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as NumberInputProperties;
  const label = properties.label?.literalString ?? properties.label?.literal ?? '';
  const placeholder = properties.placeholder?.literalString ?? properties.placeholder?.literal ?? '';
  const initialValue = properties.value;
  const min = properties.min;
  const max = properties.max;
  const step = properties.step ?? 1;
  const disabled = properties.disabled ?? false;
  const hideControls = properties.hideControls ?? false;
  const prefix = properties.prefix?.literalString ?? properties.prefix?.literal;
  const suffix = properties.suffix?.literalString ?? properties.suffix?.literal;
  const decimalScale = properties.decimalScale;

  const [value, setValue] = useState<number | undefined>(initialValue);

  const formatValue = (val: number | undefined): string => {
    if (val === undefined) return '';
    if (decimalScale !== undefined) {
      return val.toFixed(decimalScale);
    }
    return String(val);
  };

  const clamp = (val: number): number => {
    let result = val;
    if (min !== undefined && result < min) result = min;
    if (max !== undefined && result > max) result = max;
    return result;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    if (rawValue === '') {
      setValue(undefined);
      return;
    }

    const numValue = parseFloat(rawValue);
    if (!isNaN(numValue)) {
      setValue(numValue);
      triggerAction(numValue);
    }
  };

  const handleBlur = () => {
    if (value !== undefined) {
      const clampedValue = clamp(value);
      setValue(clampedValue);
      triggerAction(clampedValue);
    }
  };

  const triggerAction = (val: number) => {
    if (properties.action?.name) {
      onAction({
        actionName: properties.action.name,
        sourceComponentId: node.id,
        timestamp: new Date().toISOString(),
        context: { value: val },
      });
    }
  };

  const increment = () => {
    if (disabled) return;
    const newValue = clamp((value ?? 0) + step);
    setValue(newValue);
    triggerAction(newValue);
  };

  const decrement = () => {
    if (disabled) return;
    const newValue = clamp((value ?? 0) - step);
    setValue(newValue);
    triggerAction(newValue);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
        </label>
      )}
      <div className="relative flex">
        {prefix && (
          <span className="flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
            {prefix}
          </span>
        )}
        <input
          type="number"
          value={formatValue(value)}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          className={cn(
            'flex h-10 w-full bg-background px-3 py-2 text-sm',
            'ring-offset-background placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
            prefix ? '' : 'rounded-l-md border-l',
            suffix || !hideControls ? '' : 'rounded-r-md border-r',
            'border-y border-input'
          )}
        />
        {suffix && (
          <span className={cn(
            'flex items-center border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground',
            hideControls && 'rounded-r-md'
          )}>
            {suffix}
          </span>
        )}
        {!hideControls && (
          <div className="flex flex-col border border-l-0 border-input rounded-r-md overflow-hidden">
            <button
              type="button"
              onClick={increment}
              disabled={disabled || (max !== undefined && (value ?? 0) >= max)}
              className="flex h-5 w-8 items-center justify-center bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
            <button
              type="button"
              onClick={decrement}
              disabled={disabled || (min !== undefined && (value ?? 0) <= min)}
              className="flex h-5 w-8 items-center justify-center bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 border-t border-input"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
