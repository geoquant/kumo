/**
 * Per-container runtime value store keyed by elementKey.
 *
 * Used for collecting user-entered values (e.g. Inputs) without forcing
 * components into controlled mode. Tracks which element keys were touched.
 */

export interface RuntimeValueStore {
  /** Store latest runtime value for an elementKey (default: mark touched). */
  readonly setValue: (
    elementKey: string,
    value: unknown,
    options?: { readonly touched?: boolean },
  ) => void;
  /** Read latest runtime value for an elementKey. */
  readonly getValue: (elementKey: string) => unknown | undefined;
  /** Whether an elementKey has been touched in this container. */
  readonly isTouched: (elementKey: string) => boolean;
  /** Snapshot of touched-only values, omitting keys with `undefined` values. */
  readonly snapshotTouched: () => Readonly<Record<string, unknown>>;
  /** Snapshot of all values, omitting keys with `undefined`/`null` values. */
  readonly snapshotAll: () => Readonly<Record<string, unknown>>;
  /** Subscribe to store mutations. Returns unsubscribe. */
  readonly subscribe: (listener: () => void) => () => void;
  /** Clear values + touched state (container reset/unmount). */
  readonly clear: () => void;
}

export function createRuntimeValueStore(): RuntimeValueStore {
  const values = new Map<string, unknown>();
  const touched = new Set<string>();
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const fn of listeners) {
      try {
        fn();
      } catch {
        // ignore
      }
    }
  }

  function setValue(
    elementKey: string,
    value: unknown,
    options?: { readonly touched?: boolean },
  ): void {
    values.set(elementKey, value);
    if (options?.touched !== false) {
      touched.add(elementKey);
    }
    notify();
  }

  function getValue(elementKey: string): unknown | undefined {
    return values.get(elementKey);
  }

  function isTouched(elementKey: string): boolean {
    return touched.has(elementKey);
  }

  function snapshotTouched(): Readonly<Record<string, unknown>> {
    const out: Record<string, unknown> = {};
    for (const key of touched) {
      if (!values.has(key)) continue;
      const value = values.get(key);
      if (value === undefined || value === null) continue;
      out[key] = value;
    }
    return out;
  }

  function snapshotAll(): Readonly<Record<string, unknown>> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of values) {
      if (value === undefined || value === null) continue;
      out[key] = value;
    }
    return out;
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function clear(): void {
    values.clear();
    touched.clear();
    notify();
  }

  return {
    setValue,
    getValue,
    isTouched,
    snapshotTouched,
    snapshotAll,
    subscribe,
    clear,
  };
}
