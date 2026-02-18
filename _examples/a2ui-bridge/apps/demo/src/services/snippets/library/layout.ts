/**
 * Layout Snippets
 *
 * Pre-built layout components for rapid UI composition.
 */

import type { Snippet } from '../types';

export const cardSnippet: Snippet = {
  id: 'card',
  name: 'Card Container',
  description: 'A card container with optional title and content area. Use for grouping related content.',
  category: 'layout',
  tags: ['container', 'wrapper', 'group', 'panel'],
  slots: [
    { name: 'title', type: 'string', description: 'Card title/heading' },
    { name: 'subtitle', type: 'string', description: 'Optional subtitle' },
  ],
  template: {
    componentIds: ['{{id}}-card', '{{id}}-card-header', '{{id}}-title', '{{id}}-subtitle'],
    components: [
      {
        id: '{{id}}-card',
        type: 'Card',
        props: {
          children: ['{{id}}-card-header'],
        },
      },
      {
        id: '{{id}}-card-header',
        type: 'Column',
        props: {
          children: ['{{id}}-title', '{{id}}-subtitle'],
          gap: { literalString: 'xs' },
        },
      },
      {
        id: '{{id}}-title',
        type: 'Text',
        props: {
          text: { literalString: '{{title}}' },
          usageHint: { literalString: 'h2' },
        },
      },
      {
        id: '{{id}}-subtitle',
        type: 'Text',
        props: {
          text: { literalString: '{{subtitle}}' },
          usageHint: { literalString: 'caption' },
        },
      },
    ],
  },
  examples: [
    {
      description: 'Payment card',
      slots: { title: 'Send Money', subtitle: 'Transfer funds to a friend' },
      result: 'A card with heading and subtitle',
    },
  ],
};

export const rowSnippet: Snippet = {
  id: 'row',
  name: 'Horizontal Row',
  description: 'Arranges children horizontally. Use for side-by-side layouts, button groups, or inline elements.',
  category: 'layout',
  tags: ['horizontal', 'flex', 'inline', 'side-by-side'],
  slots: [],
  template: {
    componentIds: ['{{id}}-row'],
    components: [
      {
        id: '{{id}}-row',
        type: 'Row',
        props: {
          children: [],
          gap: { literalString: 'md' },
        },
      },
    ],
  },
};

export const columnSnippet: Snippet = {
  id: 'column',
  name: 'Vertical Column',
  description: 'Stacks children vertically. Use for forms, lists, or vertical content flow.',
  category: 'layout',
  tags: ['vertical', 'stack', 'form-layout'],
  slots: [],
  template: {
    componentIds: ['{{id}}-column'],
    components: [
      {
        id: '{{id}}-column',
        type: 'Column',
        props: {
          children: [],
          gap: { literalString: 'md' },
        },
      },
    ],
  },
};

export const sectionSnippet: Snippet = {
  id: 'section',
  name: 'Section with Header',
  description: 'A section with a label/header. Use for form sections or content grouping.',
  category: 'layout',
  tags: ['group', 'fieldset', 'form-section'],
  slots: [
    { name: 'label', type: 'string', required: true, description: 'Section label/header' },
  ],
  template: {
    componentIds: ['{{id}}-section', '{{id}}-section-label'],
    components: [
      {
        id: '{{id}}-section',
        type: 'Column',
        props: {
          children: ['{{id}}-section-label'],
          gap: { literalString: 'sm' },
        },
      },
      {
        id: '{{id}}-section-label',
        type: 'Text',
        props: {
          text: { literalString: '{{label}}' },
          usageHint: { literalString: 'h3' },
        },
      },
    ],
  },
};

export const dividerSnippet: Snippet = {
  id: 'divider',
  name: 'Visual Divider',
  description: 'A horizontal line to separate content sections.',
  category: 'layout',
  tags: ['separator', 'line', 'hr'],
  slots: [],
  template: {
    componentIds: ['{{id}}-divider'],
    components: [
      {
        id: '{{id}}-divider',
        type: 'Divider',
        props: {},
      },
    ],
  },
};

export const layoutSnippets: Snippet[] = [
  cardSnippet,
  rowSnippet,
  columnSnippet,
  sectionSnippet,
  dividerSnippet,
];
