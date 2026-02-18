/**
 * @a2ui-bridge/react - React-friendly A2UI Message Processor
 * MIT License - Copyright (c) 2024 tpitre
 *
 * Extends the core processor with React-compatible state management.
 */

import { A2uiMessageProcessor } from '@a2ui-bridge/core';

/**
 * A listener function that gets called when the processor state changes.
 */
export type ProcessorChangeListener = () => void;

/**
 * A React-friendly wrapper around A2uiMessageProcessor that provides
 * subscription-based state updates for integration with React hooks.
 */
export class ReactA2uiMessageProcessor extends A2uiMessageProcessor {
  #listeners = new Set<ProcessorChangeListener>();
  #version = 0;

  constructor() {
    super({
      arrayCtor: Array,
      mapCtor: Map,
      objCtor: Object,
      setCtor: Set,
    });
  }

  /**
   * Get the current version number.
   * This changes whenever state is updated and can be used for React dependency arrays.
   */
  getVersion(): number {
    return this.#version;
  }

  /**
   * Subscribe to state changes.
   * Returns an unsubscribe function.
   */
  subscribe(listener: ProcessorChangeListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /**
   * Notify all subscribers of a state change.
   */
  #notifyListeners(): void {
    this.#version++;
    for (const listener of this.#listeners) {
      listener();
    }
  }

  /**
   * Override clearSurfaces to notify listeners.
   */
  override clearSurfaces(): void {
    super.clearSurfaces();
    this.#notifyListeners();
  }

  /**
   * Override processMessages to notify listeners after processing.
   */
  override processMessages(
    messages: Parameters<A2uiMessageProcessor['processMessages']>[0]
  ): void {
    super.processMessages(messages);
    this.#notifyListeners();
  }

  /**
   * Override setData to notify listeners after data changes.
   */
  override setData(
    ...args: Parameters<A2uiMessageProcessor['setData']>
  ): void {
    super.setData(...args);
    this.#notifyListeners();
  }
}

/**
 * Create a new React-compatible A2UI message processor.
 */
export function createReactA2uiMessageProcessor(): ReactA2uiMessageProcessor {
  return new ReactA2uiMessageProcessor();
}
