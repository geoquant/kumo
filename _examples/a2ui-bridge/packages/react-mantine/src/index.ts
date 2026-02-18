/**
 * @a2ui-bridge/react-mantine
 * Mantine UI adapter for A2UI React applications
 *
 * MIT License - Copyright (c) 2024 tpitre
 */

// Main component mapping - use this with Root component
export { mantineComponents, adapters } from './mapping.js';

// Individual adapters - for custom mappings
export * from './adapters.js';

// Icon utilities
export { ICON_MAP, getIcon } from './icons.js';

// Re-export commonly used icons for convenience
export {
  IconAlertCircle,
  IconCheck,
  IconCircleCheck,
  IconInfoCircle,
  IconAlertTriangle,
  IconX,
} from './icons.js';
