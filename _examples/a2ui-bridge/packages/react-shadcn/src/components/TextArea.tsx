/**
 * @a2ui-bridge/react-shadcn - TextArea component
 * MIT License - Copyright (c) 2024 tpitre
 */

import { useState, useId, type JSX } from 'react';
import type { AnyComponentNode } from '@a2ui-bridge/core';
import type { A2UIComponentProps } from '@a2ui-bridge/react';
import { useTheme } from '../theme/context.js';
import { cn, classesToString } from '../utils.js';

interface TextAreaProperties {
  label?: { literalString?: string; literal?: string };
  placeholder?: { literalString?: string; literal?: string };
  text?: { literalString?: string; literal?: string; path?: string };
  value?: { literalString?: string; literal?: string } | string;
  disabled?: boolean;
  readOnly?: boolean;
  rows?: number;
  maxLength?: number;
  onChange?: { name: string };
}

export function TextArea({ node, onAction }: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const theme = useTheme();
  const properties = node.properties as TextAreaProperties;
  const id = useId();

  // Extract label (literalString format)
  const label = properties.label?.literalString ?? properties.label?.literal ?? '';

  // Extract placeholder (literalString format)
  const placeholder = properties.placeholder?.literalString ?? properties.placeholder?.literal ?? '';

  // Extract initial value from text or value property (literalString format)
  const getInitialValue = (): string => {
    // Check text property first (used by snippets)
    if (properties.text) {
      if (typeof properties.text === 'string') return properties.text;
      return properties.text.literalString ?? properties.text.literal ?? '';
    }
    // Fall back to value property
    if (properties.value) {
      if (typeof properties.value === 'string') return properties.value;
      return properties.value.literalString ?? properties.value.literal ?? '';
    }
    return '';
  };

  const [value, setValue] = useState(getInitialValue());
  const disabled = properties.disabled ?? false;
  const readOnly = properties.readOnly ?? false;
  const rows = properties.rows ?? 3;
  const maxLength = properties.maxLength;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    if (properties.onChange?.name && onAction) {
      onAction({
        actionName: properties.onChange.name,
        sourceComponentId: node.id,
        timestamp: new Date().toISOString(),
        context: { value: e.target.value },
      });
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={id}
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {label}
        </label>
      )}
      <textarea
        id={id}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        rows={rows}
        maxLength={maxLength}
        onChange={handleChange}
        className={cn(
          'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2',
          'text-sm ring-offset-background placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          classesToString((theme.components as any).TextArea?.all ?? {})
        )}
      />
    </div>
  );
}
