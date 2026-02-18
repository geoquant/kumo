/**
 * @a2ui-bridge/react-shadcn
 * ShadCN/Tailwind UI components for A2UI React applications
 *
 * MIT License - Copyright (c) 2024 tpitre
 */

// Component mapping - main export for using with Root/Surface
export { shadcnComponents } from './mapping.js';

// Individual components for customization
export * from './components/index.js';

// Theme
export { ThemeProvider, useTheme, defaultTheme } from './theme/index.js';

// Utilities
export { cn, classesToString } from './utils.js';
