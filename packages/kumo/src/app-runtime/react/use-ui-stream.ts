import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  applyPatch as applyRfc6902Patch,
  type JsonPatchOp,
} from "../../streaming/rfc6902";
import {
  APP_SPEC_VERSION,
  createAppStore,
  createExpressionContext,
  evaluateBoolExpr,
  executeActionSequence,
  expandAppSpec,
  isMutableAppStore,
  normalizeAppSpec,
  repairAppSpec,
  resolveBindingTarget,
  resolvePropsExpressions,
  runWatchers,
  validateFieldsForMode,
  writeBindingValue,
  type AppSpec,
  type AppStoreSnapshot,
  type NestedAppSpec,
} from "../core";
import type { RuntimeEffect } from "../core";
import type {
  AppRuntimeEvent,
  DispatchAppEventResult,
  ResolvedAppElement,
  RuntimeEffectContext,
  StreamStatus,
  UseUIStreamOptions,
  UseUIStreamReturn,
  WriteAppBindingInput,
  WriteAppBindingResult,
} from "./types";

const EMPTY_APP_SPEC: AppSpec = {
  version: APP_SPEC_VERSION,
  root: "",
  elements: {},
  state: {},
};

function cloneEffects(effects: readonly RuntimeEffect[]): RuntimeEffect[] {
  return effects.map((effect) => ({
    ...effect,
    params: { ...effect.params },
    ...(effect.confirm != null ? { confirm: { ...effect.confirm } } : {}),
  }));
}

function prepareAppSpec(input?: AppSpec | NestedAppSpec): AppSpec {
  return repairAppSpec(normalizeAppSpec(input ?? EMPTY_APP_SPEC)).spec;
}

function cloneSnapshot(snapshot: AppStoreSnapshot): AppStoreSnapshot {
  return {
    state: { ...snapshot.state },
    meta: {
      validation: Object.fromEntries(
        Object.entries(snapshot.meta.validation).map(([path, value]) => [
          path,
          {
            valid: value.valid,
            touched: value.touched,
            dirty: value.dirty,
            errors: [...value.errors],
          },
        ]),
      ),
      stream: {
        status: snapshot.meta.stream.status,
        ...(snapshot.meta.stream.lastError != null
          ? { lastError: snapshot.meta.stream.lastError }
          : {}),
      },
    },
  };
}

function cloneValidationRun(
  validation: NonNullable<DispatchAppEventResult["validation"]>,
): NonNullable<DispatchAppEventResult["validation"]> {
  return {
    valid: validation.valid,
    fields: Object.fromEntries(
      Object.entries(validation.fields).map(([path, value]) => [
        path,
        {
          valid: value.valid,
          touched: value.touched,
          dirty: value.dirty,
          errors: [...value.errors],
        },
      ]),
    ),
    failures: validation.failures.map((failure) => ({ ...failure })),
  };
}

function cloneDispatchResult(
  result: DispatchAppEventResult,
): DispatchAppEventResult {
  return {
    effects: cloneEffects(result.effects),
    executed: [...result.executed],
    ...(result.validation != null
      ? { validation: cloneValidationRun(result.validation) }
      : {}),
    ...(result.watchers != null
      ? {
          watchers: {
            iterations: result.watchers.iterations,
            invocations: result.watchers.invocations.map((invocation) => ({
              ...invocation,
              actions: [...invocation.actions],
            })),
            effects: cloneEffects(result.watchers.effects),
          },
        }
      : {}),
    ...(result.error != null ? { error: result.error } : {}),
  };
}

function cloneBindingResult(
  result: WriteAppBindingResult,
): WriteAppBindingResult {
  return {
    ok: result.ok,
    target: result.target,
    effects: cloneEffects(result.effects),
    ...(result.validation != null
      ? { validation: cloneValidationRun(result.validation) }
      : {}),
    ...(result.watchers != null
      ? {
          watchers: {
            iterations: result.watchers.iterations,
            invocations: result.watchers.invocations.map((invocation) => ({
              ...invocation,
              actions: [...invocation.actions],
            })),
            effects: cloneEffects(result.watchers.effects),
          },
        }
      : {}),
    ...(result.error != null ? { error: result.error } : {}),
  };
}

export function useUIStream(
  options: UseUIStreamOptions = {},
): UseUIStreamReturn {
  const initialSpecRef = useRef<AppSpec>(prepareAppSpec(options.initialSpec));
  const [spec, setSpec] = useState<AppSpec>(initialSpecRef.current);
  const specRef = useRef(spec);
  specRef.current = spec;

  const [status, setStatus] = useState<StreamStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const functionsRef = useRef(options.functions);
  functionsRef.current = options.functions;
  const handlersRef = useRef(options.handlers);
  handlersRef.current = options.handlers;
  const validatorsRef = useRef(options.validators);
  validatorsRef.current = options.validators;
  const onEffectsRef = useRef(options.onEffects);
  onEffectsRef.current = options.onEffects;

  const storeRef = useRef(
    createAppStore({
      state: initialSpecRef.current.state,
      meta: { stream: { status: "idle" } },
    }),
  );
  const store = storeRef.current;

  const [snapshot, setSnapshot] = useState<AppStoreSnapshot>(() =>
    store.getSnapshot(),
  );

  useEffect(() => {
    setSnapshot(store.getSnapshot());
    return store.subscribe(() => {
      setSnapshot(store.getSnapshot());
    });
  }, [store]);

  const expanded = useMemo(
    () => expandAppSpec(spec, store),
    [spec, snapshot, store],
  );

  const updateStreamState = useCallback(
    (nextStatus: StreamStatus, nextError?: string | null): void => {
      setStatus(nextStatus);
      setError(nextError ?? null);
      if (isMutableAppStore(store)) {
        store.setStreamState(nextStatus, nextError ?? undefined);
      }
    },
    [store],
  );

  const commitSpec = useCallback(
    (nextSpec: AppSpec): void => {
      specRef.current = nextSpec;
      setSpec(nextSpec);
      if (isMutableAppStore(store)) {
        store.replaceState(nextSpec.state);
      }
    },
    [store],
  );

  const resolveElement = useCallback(
    (elementKey: string): ResolvedAppElement | null => {
      const element = expanded.elements[elementKey];
      if (element == null) {
        return null;
      }

      const repeat = expanded.repeatScopes[elementKey];
      const context = createExpressionContext(store, {
        repeat,
        functions: functionsRef.current,
      });
      const resolved = resolvePropsExpressions(element.props ?? {}, context);

      return {
        element,
        props: resolved.props,
        bindings: resolved.bindings,
        visible: evaluateBoolExpr(element.visible, context),
        ...(repeat != null ? { repeat } : {}),
      };
    },
    [expanded, store],
  );

  const publishEffects = useCallback(
    (context: RuntimeEffectContext): readonly RuntimeEffect[] => {
      if (context.effects.length === 0) {
        return context.effects;
      }

      onEffectsRef.current?.({
        ...context,
        effects: cloneEffects(context.effects),
        snapshot: cloneSnapshot(context.snapshot),
      });
      return context.effects;
    },
    [],
  );

  const setPreparedSpec = useCallback(
    (nextSpec: AppSpec | NestedAppSpec): void => {
      commitSpec(prepareAppSpec(nextSpec));
    },
    [commitSpec],
  );

  const applyPatch = useCallback(
    (patch: JsonPatchOp): void => {
      commitSpec(prepareAppSpec(applyRfc6902Patch(specRef.current, patch)));
    },
    [commitSpec],
  );

  const applyPatches = useCallback(
    (patches: readonly JsonPatchOp[]): void => {
      if (patches.length === 0) {
        return;
      }

      let nextSpec = specRef.current;
      for (const patch of patches) {
        nextSpec = applyRfc6902Patch(nextSpec, patch);
      }

      commitSpec(prepareAppSpec(nextSpec));
    },
    [commitSpec],
  );

  const runStateWatchers = useCallback(
    (
      previousState: Record<string, unknown>,
    ): { watchers?: DispatchAppEventResult["watchers"]; error?: string } => {
      try {
        return {
          watchers: runWatchers(specRef.current, store, {
            previousState,
            functions: functionsRef.current,
            handlers: handlersRef.current,
          }),
        };
      } catch (watchError) {
        const message =
          watchError instanceof Error ? watchError.message : String(watchError);
        updateStreamState("error", message);
        return { error: message };
      }
    },
    [store, updateStreamState],
  );

  const writeBinding = useCallback(
    (input: WriteAppBindingInput): WriteAppBindingResult => {
      const resolvedElement = resolveElement(input.elementKey);
      if (resolvedElement == null) {
        return { ok: false, target: null, effects: [] };
      }

      const binding = resolvedElement.bindings[input.propPath];
      if (binding == null) {
        return { ok: false, target: null, effects: [] };
      }

      const previousState = store.getSnapshot().state;
      const context = createExpressionContext(store, {
        repeat: resolvedElement.repeat,
        functions: functionsRef.current,
      });
      const target = resolveBindingTarget(binding, context);
      if (target == null) {
        return { ok: false, target: null, effects: [] };
      }

      writeBindingValue(store, binding, input.value, context);
      const validation = validateFieldsForMode(
        specRef.current,
        store,
        "change",
        {
          validators: validatorsRef.current,
        },
      );

      const watcherOutcome = runStateWatchers(previousState);
      const effects = watcherOutcome.watchers?.effects ?? [];
      publishEffects({
        effects,
        spec: specRef.current,
        snapshot: store.getSnapshot(),
        trigger: {
          type: "binding",
          elementKey: input.elementKey,
          target,
        },
      });

      return cloneBindingResult({
        ok: true,
        target,
        effects,
        validation,
        ...(watcherOutcome.watchers != null
          ? { watchers: watcherOutcome.watchers }
          : {}),
        ...(watcherOutcome.error != null
          ? { error: watcherOutcome.error }
          : {}),
      });
    },
    [publishEffects, resolveElement, runStateWatchers, store],
  );

  const dispatchEvent = useCallback(
    ({ elementKey, event }: AppRuntimeEvent): DispatchAppEventResult => {
      const resolvedElement = resolveElement(elementKey);
      if (resolvedElement == null) {
        return { effects: [], executed: [] };
      }

      const previousState = store.getSnapshot().state;
      const validation =
        event === "blur" || event === "submit"
          ? validateFieldsForMode(specRef.current, store, event, {
              validators: validatorsRef.current,
            })
          : undefined;

      const sequence = resolvedElement.element.events?.[event];
      const actionResult =
        sequence != null
          ? executeActionSequence(sequence, {
              store,
              repeat: resolvedElement.repeat,
              functions: functionsRef.current,
              handlers: handlersRef.current,
            })
          : { effects: [], executed: [] };

      const watcherOutcome = runStateWatchers(previousState);
      const effects = [
        ...actionResult.effects,
        ...(watcherOutcome.watchers?.effects ?? []),
      ];
      publishEffects({
        effects,
        spec: specRef.current,
        snapshot: store.getSnapshot(),
        trigger: { type: "event", elementKey, event },
      });

      return cloneDispatchResult({
        effects,
        executed: [
          ...actionResult.executed,
          ...(watcherOutcome.watchers?.invocations.flatMap(
            (entry) => entry.actions,
          ) ?? []),
        ],
        ...(validation != null ? { validation } : {}),
        ...(watcherOutcome.watchers != null
          ? { watchers: watcherOutcome.watchers }
          : {}),
        ...(watcherOutcome.error != null
          ? { error: watcherOutcome.error }
          : {}),
      });
    },
    [publishEffects, resolveElement, runStateWatchers, store],
  );

  const reset = useCallback((): void => {
    const initialSpec = initialSpecRef.current;
    commitSpec(initialSpec);
    if (isMutableAppStore(store)) {
      store.clearValidationState();
    }
    updateStreamState("idle");
  }, [commitSpec, store, updateStreamState]);

  const startStream = useCallback((): void => {
    updateStreamState("streaming");
  }, [updateStreamState]);

  const completeStream = useCallback((): void => {
    updateStreamState("complete");
  }, [updateStreamState]);

  const failStream = useCallback(
    (message: string): void => {
      updateStreamState("error", message);
    },
    [updateStreamState],
  );

  return {
    spec,
    snapshot,
    expanded,
    status,
    error,
    setSpec: setPreparedSpec,
    applyPatch,
    applyPatches,
    startStream,
    completeStream,
    failStream,
    reset,
    resolveElement,
    writeBinding,
    dispatchEvent,
  };
}
