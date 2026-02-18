/**
 * @a2ui-bridge/react-shadcn - Theme context
 * MIT License - Copyright (c) 2024 tpitre
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { Theme } from '@a2ui-bridge/core';
import { defaultTheme } from './default-theme.js';

/**
 * React context for the A2UI theme.
 */
export const ThemeContext = createContext<Theme>(defaultTheme);

/**
 * Hook to access the current theme.
 */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/**
 * Theme provider component.
 */
export function ThemeProvider({
  theme = defaultTheme,
  children,
}: {
  theme?: Theme;
  children: ReactNode;
}): JSX.Element {
  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}
