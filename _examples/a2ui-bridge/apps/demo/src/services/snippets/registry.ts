/**
 * Snippet Registry
 *
 * Manages the library of composable A2UI snippets.
 * Provides lookup, search, and catalog generation for AI prompts.
 */

import type { Snippet, SnippetCategory } from './types';

/**
 * Registry for managing A2UI snippets
 */
export class SnippetRegistry {
  private snippets: Map<string, Snippet> = new Map();
  private byCategory: Map<SnippetCategory, Set<string>> = new Map();
  private byTag: Map<string, Set<string>> = new Map();

  /**
   * Register a new snippet
   */
  register(snippet: Snippet): void {
    if (this.snippets.has(snippet.id)) {
      console.warn(`[SnippetRegistry] Overwriting existing snippet: ${snippet.id}`);
    }

    this.snippets.set(snippet.id, snippet);

    // Index by category
    if (!this.byCategory.has(snippet.category)) {
      this.byCategory.set(snippet.category, new Set());
    }
    this.byCategory.get(snippet.category)!.add(snippet.id);

    // Index by tags
    if (snippet.tags) {
      for (const tag of snippet.tags) {
        if (!this.byTag.has(tag)) {
          this.byTag.set(tag, new Set());
        }
        this.byTag.get(tag)!.add(snippet.id);
      }
    }
  }

  /**
   * Register multiple snippets at once
   */
  registerAll(snippets: Snippet[]): void {
    for (const snippet of snippets) {
      this.register(snippet);
    }
  }

  /**
   * Get a snippet by ID
   */
  get(id: string): Snippet | undefined {
    return this.snippets.get(id);
  }

  /**
   * Get all snippets
   */
  getAll(): Snippet[] {
    return Array.from(this.snippets.values());
  }

  /**
   * Get snippets by category
   */
  getByCategory(category: SnippetCategory): Snippet[] {
    const ids = this.byCategory.get(category);
    if (!ids) return [];
    return Array.from(ids).map(id => this.snippets.get(id)!);
  }

  /**
   * Get snippets by tag
   */
  getByTag(tag: string): Snippet[] {
    const ids = this.byTag.get(tag);
    if (!ids) return [];
    return Array.from(ids).map(id => this.snippets.get(id)!);
  }

  /**
   * Search snippets by description or tags
   */
  search(query: string): Snippet[] {
    const lowerQuery = query.toLowerCase();
    const results: Snippet[] = [];

    for (const snippet of this.snippets.values()) {
      const matchesName = snippet.name.toLowerCase().includes(lowerQuery);
      const matchesDescription = snippet.description.toLowerCase().includes(lowerQuery);
      const matchesTags = snippet.tags?.some(tag => tag.toLowerCase().includes(lowerQuery));

      if (matchesName || matchesDescription || matchesTags) {
        results.push(snippet);
      }
    }

    return results;
  }

  /**
   * Generate a catalog string for AI prompts
   * This is what gets included in the system prompt
   */
  generateCatalog(): string {
    const categories = Array.from(this.byCategory.keys()).sort();
    const lines: string[] = ['# Available UI Snippets\n'];

    for (const category of categories) {
      const snippets = this.getByCategory(category);
      lines.push(`## ${category.charAt(0).toUpperCase() + category.slice(1)}\n`);

      for (const snippet of snippets) {
        lines.push(`### ${snippet.id}`);
        lines.push(`**${snippet.name}**: ${snippet.description}`);

        if (snippet.slots.length > 0) {
          lines.push('Slots:');
          for (const slot of snippet.slots) {
            const required = slot.required ? ' (required)' : '';
            const defaultVal = slot.default !== undefined ? ` [default: ${JSON.stringify(slot.default)}]` : '';
            lines.push(`  - \`${slot.name}\`: ${slot.type}${required}${defaultVal}`);
            if (slot.description) {
              lines.push(`    ${slot.description}`);
            }
          }
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate a compact catalog for token efficiency
   */
  generateCompactCatalog(): string {
    const lines: string[] = ['Snippets: '];
    const snippetList: string[] = [];

    for (const snippet of this.snippets.values()) {
      const slots = snippet.slots
        .map(s => `${s.name}${s.required ? '*' : ''}`)
        .join(', ');
      snippetList.push(`${snippet.id}(${slots})`);
    }

    lines.push(snippetList.join(' | '));
    return lines.join('');
  }

  /**
   * Get registry statistics
   */
  getStats(): { total: number; byCategory: Record<string, number> } {
    const byCategory: Record<string, number> = {};
    for (const [category, ids] of this.byCategory.entries()) {
      byCategory[category] = ids.size;
    }

    return {
      total: this.snippets.size,
      byCategory,
    };
  }

  /**
   * Clear all snippets (useful for testing)
   */
  clear(): void {
    this.snippets.clear();
    this.byCategory.clear();
    this.byTag.clear();
  }
}

/**
 * Global snippet registry instance
 */
export const snippetRegistry = new SnippetRegistry();
