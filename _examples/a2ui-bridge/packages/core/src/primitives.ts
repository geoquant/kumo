/**
 * @a2ui-bridge/core - Primitive value types for A2UI protocol
 * MIT License - Copyright (c) 2024 tpitre
 *
 * Based on Google's A2UI protocol specification
 */

/**
 * A string value that can be either a data binding path or a literal value.
 */
export interface StringValue {
  /**
   * A data binding reference to a location in the data model (e.g., '/user/name').
   */
  path?: string;
  /**
   * A fixed, hardcoded string value.
   */
  literalString?: string;
  /**
   * A fixed, hardcoded string value (alternative).
   */
  literal?: string;
}

/**
 * A number value that can be either a data binding path or a literal value.
 */
export interface NumberValue {
  /**
   * A data binding reference to a location in the data model (e.g., '/user/age').
   */
  path?: string;
  /**
   * A fixed, hardcoded number value.
   */
  literalNumber?: number;
  /**
   * A fixed, hardcoded number value (alternative).
   */
  literal?: number;
}

/**
 * A boolean value that can be either a data binding path or a literal value.
 */
export interface BooleanValue {
  /**
   * A data binding reference to a location in the data model (e.g., '/user/active').
   */
  path?: string;
  /**
   * A fixed, hardcoded boolean value.
   */
  literalBoolean?: boolean;
  /**
   * A fixed, hardcoded boolean value (alternative).
   */
  literal?: boolean;
}
