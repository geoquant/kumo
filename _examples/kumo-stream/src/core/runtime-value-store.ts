/**
 * Per-container runtime value store keyed by elementKey.
 *
 * Used for collecting user-entered values (e.g. Inputs) without forcing
 * components into controlled mode. Tracks which element keys were touched.
 */

export interface RuntimeValueStore {
  /** Store latest runtime value for an elementKey and mark it touched. */
  readonly setValue: (elementKey: string, value: unknown) => void;
  /** Read latest runtime value for an elementKey. */
  readonly getValue: (elementKey: string) => unknown | undefined;
  /** Whether an elementKey has been touched in this container. */
  readonly isTouched: (elementKey: string) => boolean;
  /** Snapshot of touched-only values, omitting keys with `undefined` values. */
  readonly snapshotTouched: () => Readonly<Record<string, unknown>>;
  /** Clear values + touched state (container reset/unmount). */
  readonly clear: () => void;
}

export function createRuntimeValueStore(): RuntimeValueStore {
  const values = new Map<string, unknown>();
  const touched = new Set<string>();

  function setValue(elementKey: string, value: unknown): void {
    values.set(elementKey, value);
    touched.add(elementKey);
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
      if (value === undefined) continue;
      out[key] = value;
    }
    return out;
  }

  function clear(): void {
    values.clear();
    touched.clear();
  }

  return { setValue, getValue, isTouched, snapshotTouched, clear };
}
