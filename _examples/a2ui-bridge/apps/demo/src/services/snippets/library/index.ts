/**
 * Snippet Library
 *
 * All pre-built A2UI snippets organized by category.
 */

import { snippetRegistry } from '../registry';
import { layoutSnippets } from './layout';
import { inputSnippets } from './inputs';
import { actionSnippets } from './actions';
import { displaySnippets } from './display';

// Export individual categories
export { layoutSnippets } from './layout';
export { inputSnippets } from './inputs';
export { actionSnippets } from './actions';
export { displaySnippets } from './display';

/**
 * All snippets combined
 */
export const allSnippets = [
  ...layoutSnippets,
  ...inputSnippets,
  ...actionSnippets,
  ...displaySnippets,
];

/**
 * Initialize the snippet registry with all snippets
 */
export function initializeSnippetLibrary(): void {
  snippetRegistry.registerAll(allSnippets);

  const stats = snippetRegistry.getStats();
  console.log(
    `[SnippetLibrary] Initialized with ${stats.total} snippets:`,
    stats.byCategory
  );
}

/**
 * Get snippet catalog for AI prompt
 */
export function getSnippetCatalog(): string {
  return snippetRegistry.generateCatalog();
}

/**
 * Get compact catalog for token-efficient prompts
 */
export function getCompactSnippetCatalog(): string {
  return snippetRegistry.generateCompactCatalog();
}
