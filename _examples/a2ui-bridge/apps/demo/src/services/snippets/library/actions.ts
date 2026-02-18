/**
 * Action Snippets
 *
 * Pre-built button and action components for rapid UI composition.
 */

import type { Snippet } from '../types';

export const buttonSnippet: Snippet = {
  id: 'button',
  name: 'Basic Button',
  description: 'A clickable button. Use for any user action.',
  category: 'action',
  tags: ['button', 'click', 'action', 'submit'],
  slots: [
    { name: 'text', type: 'string', required: true, description: 'Button text' },
    { name: 'action', type: 'action', required: true, description: 'Action name to trigger' },
    { name: 'variant', type: 'string', default: 'filled', description: 'Style: filled, outline, subtle' },
  ],
  template: {
    componentIds: ['{{id}}-button', '{{id}}-button-text'],
    components: [
      {
        id: '{{id}}-button',
        type: 'Button',
        props: {
          child: '{{id}}-button-text',
          action: { name: '{{action}}' },
          variant: { literalString: '{{variant}}' },
        },
      },
      {
        id: '{{id}}-button-text',
        type: 'Text',
        props: {
          text: { literalString: '{{text}}' },
        },
      },
    ],
  },
};

export const submitButtonSnippet: Snippet = {
  id: 'submit-button',
  name: 'Submit Button',
  description: 'A primary action button for form submission. Typically at the end of forms.',
  category: 'action',
  tags: ['submit', 'save', 'confirm', 'primary', 'send'],
  slots: [
    { name: 'text', type: 'string', required: true, description: 'Button text' },
    { name: 'action', type: 'action', required: true, description: 'Action name to trigger' },
    { name: 'icon', type: 'string', description: 'Optional icon name' },
  ],
  template: {
    componentIds: ['{{id}}-submit', '{{id}}-submit-content', '{{id}}-submit-text'],
    components: [
      {
        id: '{{id}}-submit',
        type: 'Button',
        props: {
          child: '{{id}}-submit-content',
          action: { name: '{{action}}' },
          variant: { literalString: 'filled' },
          fullWidth: { literalBoolean: true },
        },
      },
      {
        id: '{{id}}-submit-content',
        type: 'Row',
        props: {
          children: ['{{id}}-submit-text'],
          gap: { literalString: 'xs' },
          justify: { literalString: 'center' },
          align: { literalString: 'center' },
        },
      },
      {
        id: '{{id}}-submit-text',
        type: 'Text',
        props: {
          text: { literalString: '{{text}}' },
        },
      },
    ],
  },
  examples: [
    {
      description: 'Payment submit',
      slots: { text: 'Send $50', action: 'send-payment' },
      result: 'A full-width submit button',
    },
  ],
};

export const cancelButtonSnippet: Snippet = {
  id: 'cancel-button',
  name: 'Cancel Button',
  description: 'A secondary/cancel action button. Use alongside submit buttons.',
  category: 'action',
  tags: ['cancel', 'back', 'secondary', 'dismiss'],
  slots: [
    { name: 'text', type: 'string', default: 'Cancel', description: 'Button text' },
    { name: 'action', type: 'action', default: 'cancel', description: 'Action name' },
  ],
  template: {
    componentIds: ['{{id}}-cancel', '{{id}}-cancel-text'],
    components: [
      {
        id: '{{id}}-cancel',
        type: 'Button',
        props: {
          child: '{{id}}-cancel-text',
          action: { name: '{{action}}' },
          variant: { literalString: 'subtle' },
        },
      },
      {
        id: '{{id}}-cancel-text',
        type: 'Text',
        props: {
          text: { literalString: '{{text}}' },
        },
      },
    ],
  },
};

export const buttonGroupSnippet: Snippet = {
  id: 'button-group',
  name: 'Button Group',
  description: 'A row of action buttons. Use for form actions (Submit + Cancel).',
  category: 'action',
  tags: ['buttons', 'actions', 'form-actions', 'footer'],
  slots: [
    { name: 'primaryText', type: 'string', required: true, description: 'Primary button text' },
    { name: 'primaryAction', type: 'action', required: true, description: 'Primary action name' },
    { name: 'secondaryText', type: 'string', default: 'Cancel', description: 'Secondary button text' },
    { name: 'secondaryAction', type: 'action', default: 'cancel', description: 'Secondary action name' },
  ],
  template: {
    componentIds: [
      '{{id}}-btn-group',
      '{{id}}-secondary-btn', '{{id}}-secondary-text',
      '{{id}}-primary-btn', '{{id}}-primary-text',
    ],
    components: [
      {
        id: '{{id}}-btn-group',
        type: 'Row',
        props: {
          children: ['{{id}}-secondary-btn', '{{id}}-primary-btn'],
          gap: { literalString: 'sm' },
          justify: { literalString: 'end' },
        },
      },
      {
        id: '{{id}}-secondary-btn',
        type: 'Button',
        props: {
          child: '{{id}}-secondary-text',
          action: { name: '{{secondaryAction}}' },
          variant: { literalString: 'subtle' },
        },
      },
      {
        id: '{{id}}-secondary-text',
        type: 'Text',
        props: {
          text: { literalString: '{{secondaryText}}' },
        },
      },
      {
        id: '{{id}}-primary-btn',
        type: 'Button',
        props: {
          child: '{{id}}-primary-text',
          action: { name: '{{primaryAction}}' },
          variant: { literalString: 'filled' },
        },
      },
      {
        id: '{{id}}-primary-text',
        type: 'Text',
        props: {
          text: { literalString: '{{primaryText}}' },
        },
      },
    ],
  },
};

export const linkButtonSnippet: Snippet = {
  id: 'link-button',
  name: 'Link/Text Button',
  description: 'A text-style clickable link. Use for tertiary actions or navigation.',
  category: 'action',
  tags: ['link', 'text-button', 'tertiary', 'nav'],
  slots: [
    { name: 'text', type: 'string', required: true, description: 'Link text' },
    { name: 'action', type: 'action', required: true, description: 'Action name' },
  ],
  template: {
    componentIds: ['{{id}}-link', '{{id}}-link-text'],
    components: [
      {
        id: '{{id}}-link',
        type: 'Button',
        props: {
          child: '{{id}}-link-text',
          action: { name: '{{action}}' },
          variant: { literalString: 'subtle' },
          compact: { literalBoolean: true },
        },
      },
      {
        id: '{{id}}-link-text',
        type: 'Text',
        props: {
          text: { literalString: '{{text}}' },
          usageHint: { literalString: 'link' },
        },
      },
    ],
  },
};

export const actionSnippets: Snippet[] = [
  buttonSnippet,
  submitButtonSnippet,
  cancelButtonSnippet,
  buttonGroupSnippet,
  linkButtonSnippet,
];
