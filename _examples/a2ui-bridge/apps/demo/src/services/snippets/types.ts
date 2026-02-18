/**
 * Snippet Type Definitions
 *
 * Defines the structure for composable A2UI snippets that can be
 * combined by AI to create complete UIs faster than generating from scratch.
 */

import type { ServerToClientMessage } from "@a2ui-bridge/core";

/**
 * Slot definition for customizable parts of a snippet
 */
export interface SlotDefinition {
  /** Unique slot name */
  name: string;
  /** Type of value the slot accepts */
  type: "string" | "number" | "boolean" | "dataPath" | "action" | "children";
  /** Default value if not provided */
  default?: unknown;
  /** Whether this slot must be provided */
  required?: boolean;
  /** Description for AI to understand slot purpose */
  description?: string;
}

/**
 * Categories for organizing snippets
 */
export type SnippetCategory =
  | "layout" // Card, Row, Column, Section
  | "input" // TextField, DatePicker, Select, etc.
  | "action" // Button, SubmitButton, etc.
  | "display" // Text, Badge, Avatar, etc.
  | "list" // ItemList, SelectableList
  | "navigation" // Tabs, Stepper
  | "feedback"; // Alert, Progress, Skeleton

/**
 * A composable A2UI snippet definition
 */
export interface Snippet {
  /** Unique identifier for this snippet */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description for AI to understand when to use this snippet */
  description: string;
  /** Category for organization */
  category: SnippetCategory;
  /** Customizable slots in this snippet */
  slots: SlotDefinition[];
  /** The A2UI JSON template with placeholder tokens for slots */
  template: SnippetTemplate;
  /** Example usage for AI context */
  examples?: SnippetExample[];
  /** Tags for better AI matching */
  tags?: string[];
}

/**
 * Template structure for a snippet
 */
export interface SnippetTemplate {
  /** Component IDs that will be generated (with slot placeholders) */
  componentIds: string[];
  /** The A2UI component definitions */
  components: SnippetComponent[];
}

/**
 * A component within a snippet template
 * Slot references use {{slotName}} syntax
 */
export interface SnippetComponent {
  /** Component ID (can include {{id}} placeholder) */
  id: string;
  /** Component type (Button, Text, Card, etc.) */
  type: string;
  /** Props with potential slot references */
  props: Record<string, unknown>;
}

/**
 * Example usage of a snippet
 */
export interface SnippetExample {
  /** Description of this example */
  description: string;
  /** Slot values for this example */
  slots: Record<string, unknown>;
  /** Expected result description */
  result: string;
}

/**
 * AI composition instruction for using snippets
 */
export interface CompositionInstruction {
  /** Which snippet to use */
  snippet: string;
  /** Slot values to fill in */
  slots?: Record<string, unknown>;
  /** Unique ID prefix for this instance */
  instanceId?: string;
  /** Nested child instructions - snippets to render as children of this snippet's root component */
  children?: Array<CompositionInstruction | GenerationInstruction>;
}

/**
 * AI generation instruction for custom components
 * Used when no snippet fits the requirement
 */
export interface GenerationInstruction {
  /** Description of what to generate */
  generate: string;
  /** Unique ID prefix for generated components */
  instanceId?: string;
}

/**
 * Combined AI output format
 */
export interface AICompositionOutput {
  /** Title for the UI */
  title?: string;
  /** Array of composition/generation instructions */
  compose: Array<CompositionInstruction | GenerationInstruction>;
  /** Layout wrapper (optional) */
  layout?: "card" | "column" | "row" | "none";
}

/**
 * Result of composing snippets
 */
export interface CompositionResult {
  /** Success status */
  success: boolean;
  /** Generated A2UI messages */
  messages?: ServerToClientMessage[];
  /** Error message if failed */
  error?: string;
  /** Statistics */
  stats?: {
    snippetsUsed: number;
    customGenerated: number;
    totalComponents: number;
  };
}

/**
 * Type guard for CompositionInstruction
 */
export function isCompositionInstruction(
  instruction: CompositionInstruction | GenerationInstruction,
): instruction is CompositionInstruction {
  return "snippet" in instruction;
}

/**
 * Type guard for GenerationInstruction
 */
export function isGenerationInstruction(
  instruction: CompositionInstruction | GenerationInstruction,
): instruction is GenerationInstruction {
  return "generate" in instruction;
}
