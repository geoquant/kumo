/**
 * @a2ui-bridge/react - React hooks for A2UI
 * MIT License - Copyright (c) 2024 tpitre
 */

import { useSyncExternalStore, useCallback, useMemo } from 'react';
import type { Surface, AnyComponentNode, ServerToClientMessage } from '@a2ui-bridge/core';
import {
  ReactA2uiMessageProcessor,
  createReactA2uiMessageProcessor,
} from './processor.js';

/**
 * Hook to create and manage an A2UI message processor.
 * Returns a stable processor instance that triggers re-renders when state changes.
 */
export function useA2uiProcessor(): ReactA2uiMessageProcessor {
  const processor = useMemo(() => createReactA2uiMessageProcessor(), []);

  useSyncExternalStore(
    useCallback(
      (onStoreChange) => processor.subscribe(onStoreChange),
      [processor]
    ),
    useCallback(() => processor.getVersion(), [processor])
  );

  return processor;
}

/**
 * Hook to get all surfaces from a processor.
 * Automatically re-renders when surfaces change.
 */
export function useSurfaces(
  processor: ReactA2uiMessageProcessor
): ReadonlyMap<string, Surface> {
  useSyncExternalStore(
    useCallback(
      (onStoreChange) => processor.subscribe(onStoreChange),
      [processor]
    ),
    useCallback(() => processor.getVersion(), [processor])
  );

  return processor.getSurfaces();
}

/**
 * Hook to get a specific surface by ID.
 * Automatically re-renders when the surface changes.
 */
export function useSurface(
  processor: ReactA2uiMessageProcessor,
  surfaceId: string
): Surface | undefined {
  const surfaces = useSurfaces(processor);
  return surfaces.get(surfaceId);
}

/**
 * Hook to get the component tree from a surface.
 */
export function useComponentTree(
  processor: ReactA2uiMessageProcessor,
  surfaceId: string
): AnyComponentNode | null {
  const surface = useSurface(processor, surfaceId);
  return surface?.componentTree ?? null;
}

/**
 * Hook to process A2UI messages.
 * Returns a function that can be called with messages to process.
 */
export function useProcessMessages(
  processor: ReactA2uiMessageProcessor
): (messages: ServerToClientMessage[]) => void {
  return useCallback(
    (messages: ServerToClientMessage[]) => {
      processor.processMessages(messages);
    },
    [processor]
  );
}

/**
 * Hook to clear all surfaces.
 */
export function useClearSurfaces(
  processor: ReactA2uiMessageProcessor
): () => void {
  return useCallback(() => {
    processor.clearSurfaces();
  }, [processor]);
}
