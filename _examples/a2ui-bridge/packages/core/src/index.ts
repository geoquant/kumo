/**
 * @a2ui-bridge/core
 * Core protocol processing for A2UI - framework agnostic message processor
 *
 * MIT License - Copyright (c) 2024 tpitre
 */

// Main processor
export {
  A2uiMessageProcessor,
  createA2uiMessageProcessor,
  type ProcessorOptions,
} from './processor.js';

// Types
export * from './types.js';

// Primitives
export * from './primitives.js';

// Components
export * from './components.js';

// Guards
export * as Guards from './guards.js';
