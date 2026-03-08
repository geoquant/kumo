import { getValueAtPointer, setValueAtPointer } from "./path";
import type {
  AppStore,
  AppStoreSnapshot,
  FieldValidationState,
  JsonPointer,
  RuntimeMeta,
} from "./types";

export interface CreateAppStoreOptions {
  state?: Record<string, unknown>;
  meta?: Partial<RuntimeMeta>;
}

function cloneValidationState(
  state: FieldValidationState,
): FieldValidationState {
  return {
    valid: state.valid,
    touched: state.touched,
    dirty: state.dirty,
    errors: [...state.errors],
  };
}

function cloneRuntimeMeta(meta: Partial<RuntimeMeta> | undefined): RuntimeMeta {
  const stream = meta?.stream;

  const validationEntries = Object.entries(meta?.validation ?? {}).map(
    ([key, value]) => [key, cloneValidationState(value)] as const,
  );

  return {
    validation: Object.fromEntries(validationEntries),
    stream: {
      status: stream?.status ?? "idle",
      ...(stream?.lastError != null ? { lastError: stream.lastError } : {}),
    },
  };
}

export interface MutableAppStore extends AppStore {
  replaceState(state: Record<string, unknown>): void;
  setValidationState(path: JsonPointer, state: FieldValidationState): void;
  clearValidationState(paths?: readonly JsonPointer[]): void;
  setStreamState(status: RuntimeMeta["stream"]["status"], error?: string): void;
}

export function createAppStore(
  options: CreateAppStoreOptions = {},
): MutableAppStore {
  let snapshot: AppStoreSnapshot = {
    state: { ...options.state },
    meta: cloneRuntimeMeta(options.meta),
  };

  const listeners = new Set<() => void>();

  function emit(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function replaceSnapshot(next: AppStoreSnapshot): void {
    snapshot = next;
    emit();
  }

  return {
    getSnapshot(): AppStoreSnapshot {
      return {
        state: { ...snapshot.state },
        meta: cloneRuntimeMeta(snapshot.meta),
      };
    },
    getValue(path: JsonPointer): unknown {
      return getValueAtPointer(snapshot.state, path);
    },
    setValue(path: JsonPointer, value: unknown): void {
      replaceSnapshot({
        state: setValueAtPointer(snapshot.state, path, value),
        meta: snapshot.meta,
      });
    },
    replaceState(state: Record<string, unknown>): void {
      replaceSnapshot({
        state: { ...state },
        meta: snapshot.meta,
      });
    },
    setValidationState(path: JsonPointer, state: FieldValidationState): void {
      replaceSnapshot({
        state: snapshot.state,
        meta: {
          ...snapshot.meta,
          validation: {
            ...snapshot.meta.validation,
            [path]: cloneValidationState(state),
          },
        },
      });
    },
    clearValidationState(paths?: readonly JsonPointer[]): void {
      if (paths == null || paths.length === 0) {
        replaceSnapshot({
          state: snapshot.state,
          meta: {
            ...snapshot.meta,
            validation: {},
          },
        });
        return;
      }

      const nextValidation = { ...snapshot.meta.validation };
      for (const path of paths) {
        delete nextValidation[path];
      }

      replaceSnapshot({
        state: snapshot.state,
        meta: {
          ...snapshot.meta,
          validation: nextValidation,
        },
      });
    },
    setStreamState(
      status: RuntimeMeta["stream"]["status"],
      error?: string,
    ): void {
      replaceSnapshot({
        state: snapshot.state,
        meta: {
          ...snapshot.meta,
          stream: {
            status,
            ...(error != null ? { lastError: error } : {}),
          },
        },
      });
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function isMutableAppStore(store: AppStore): store is MutableAppStore {
  return (
    "replaceState" in store &&
    typeof store.replaceState === "function" &&
    "setValidationState" in store &&
    typeof store.setValidationState === "function" &&
    "clearValidationState" in store &&
    typeof store.clearValidationState === "function" &&
    "setStreamState" in store &&
    typeof store.setStreamState === "function"
  );
}
