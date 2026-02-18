/**
 * @a2ui-bridge/react-shadcn - TextField component
 * MIT License - Copyright (c) 2024 tpitre
 */

import { useState, useId } from 'react';
import type { TextFieldNode } from '@a2ui-bridge/core';
import type { A2UIComponentProps } from '@a2ui-bridge/react';
import { useTheme } from '../theme/context.js';
import { cn, classesToString } from '../utils.js';

export function TextField({ node }: A2UIComponentProps<TextFieldNode>): JSX.Element {
  const theme = useTheme();
  const { properties } = node;
  const id = useId();

  const label = properties.label.literalString ?? properties.label.literal ?? '';
  const initialValue = properties.text?.literalString ?? properties.text?.literal ?? '';
  const [value, setValue] = useState(initialValue);

  const containerClasses = cn(classesToString(theme.components.TextField.container));
  const elementClasses = cn(classesToString(theme.components.TextField.element));
  const labelClasses = cn(classesToString(theme.components.TextField.label));

  const inputType = properties.type === 'number' ? 'number' :
                    properties.type === 'date' ? 'date' : 'text';

  const InputComponent = properties.type === 'longText' ? 'textarea' : 'input';

  return (
    <div className={containerClasses}>
      <label htmlFor={id} className={labelClasses}>
        {label}
      </label>
      <InputComponent
        id={id}
        type={inputType}
        className={elementClasses}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        pattern={properties.validationRegexp}
      />
    </div>
  );
}
