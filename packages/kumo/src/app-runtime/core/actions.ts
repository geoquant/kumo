import {
  createExpressionContext,
  evaluateBoolExpr,
  resolvePropsExpressions,
  resolveValueExpr,
} from "./expressions";
import { isJsonPointer } from "./path";
import { isMutableAppStore } from "./store";
import type {
  ActionSequence,
  ActionStep,
  AppStore,
  JsonPointer,
  RepeatScope,
  ValueExpr,
} from "./types";

export interface ResolvedConfirmSpec {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface ResolvedActionStep {
  action: string;
  params: Record<string, unknown>;
  confirm?: ResolvedConfirmSpec;
}

export interface RuntimeEffect {
  type: "custom" | "form.submit" | "nav.navigate";
  action: string;
  params: Record<string, unknown>;
  confirm?: ResolvedConfirmSpec;
}

export interface ActionExecutionResult {
  effects: RuntimeEffect[];
  executed: string[];
}

export type CustomActionHandler = (input: {
  action: ResolvedActionStep;
  store: AppStore;
}) => RuntimeEffect | null | void;

export interface ExecuteActionSequenceOptions {
  store: AppStore;
  repeat?: RepeatScope;
  functions?: Record<string, (...args: readonly unknown[]) => unknown>;
  handlers?: Record<string, CustomActionHandler>;
}

function normalizeActionSequence(sequence: ActionSequence): ActionStep[] {
  return Array.isArray(sequence) ? sequence : [sequence];
}

function resolvePathValue(value: unknown): JsonPointer | null {
  return isJsonPointer(value) ? value : null;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readIndex(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readStringList(value: unknown): JsonPointer[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isJsonPointer);
}

function resolveConfirmText(
  value: ValueExpr | undefined,
  options: ExecuteActionSequenceOptions,
): string | undefined {
  if (value == null) {
    return undefined;
  }

  const context = createExpressionContext(options.store, {
    repeat: options.repeat,
    functions: options.functions,
  });
  const resolved = resolveValueExpr(value, context);
  if (resolved == null) {
    return undefined;
  }

  if (typeof resolved === "string") {
    return resolved;
  }

  if (typeof resolved === "number" || typeof resolved === "boolean") {
    return `${resolved}`;
  }

  const json = JSON.stringify(resolved);
  return json ?? undefined;
}

export function resolveActionStep(
  step: ActionStep,
  options: ExecuteActionSequenceOptions,
): ResolvedActionStep {
  const context = createExpressionContext(options.store, {
    repeat: options.repeat,
    functions: options.functions,
  });

  const paramsResult = resolvePropsExpressions(step.params ?? {}, context);

  return {
    action: step.action,
    params: paramsResult.props,
    ...(step.confirm != null
      ? {
          confirm: {
            title: resolveConfirmText(step.confirm.title, options) ?? "",
            ...(resolveConfirmText(step.confirm.description, options) != null
              ? {
                  description: resolveConfirmText(
                    step.confirm.description,
                    options,
                  ),
                }
              : {}),
            ...(resolveConfirmText(step.confirm.confirmLabel, options) != null
              ? {
                  confirmLabel: resolveConfirmText(
                    step.confirm.confirmLabel,
                    options,
                  ),
                }
              : {}),
            ...(resolveConfirmText(step.confirm.cancelLabel, options) != null
              ? {
                  cancelLabel: resolveConfirmText(
                    step.confirm.cancelLabel,
                    options,
                  ),
                }
              : {}),
          },
        }
      : {}),
  };
}

function setValidationForPaths(
  store: AppStore,
  paths: readonly JsonPointer[],
): void {
  if (!isMutableAppStore(store)) {
    return;
  }

  for (const path of paths) {
    const currentValue = store.getValue(path);
    store.setValidationState(path, {
      valid:
        currentValue !== undefined &&
        currentValue !== null &&
        currentValue !== "",
      touched: true,
      dirty: currentValue !== undefined,
      errors: [],
    });
  }
}

function clearFormPaths(store: AppStore, paths: readonly JsonPointer[]): void {
  for (const path of paths) {
    store.setValue(path, "");
  }

  if (isMutableAppStore(store)) {
    store.clearValidationState(paths);
  }
}

function executeBuiltIn(
  resolved: ResolvedActionStep,
  store: AppStore,
): RuntimeEffect | null {
  switch (resolved.action) {
    case "state.set": {
      const path = resolvePathValue(resolved.params.path);
      if (path == null) {
        return null;
      }
      store.setValue(path, resolved.params.value);
      return null;
    }
    case "state.merge": {
      const path = resolvePathValue(resolved.params.path);
      const value = resolved.params.value;
      const current = path == null ? undefined : store.getValue(path);
      if (
        path == null ||
        typeof value !== "object" ||
        value === null ||
        Array.isArray(value)
      ) {
        return null;
      }
      const nextValue =
        typeof current === "object" &&
        current !== null &&
        !Array.isArray(current)
          ? { ...current, ...value }
          : { ...value };
      store.setValue(path, nextValue);
      return null;
    }
    case "state.toggle": {
      const path = resolvePathValue(resolved.params.path);
      if (path == null) {
        return null;
      }
      store.setValue(path, !store.getValue(path));
      return null;
    }
    case "state.increment":
    case "state.decrement": {
      const path = resolvePathValue(resolved.params.path);
      if (path == null) {
        return null;
      }
      const current = store.getValue(path);
      const base = typeof current === "number" ? current : 0;
      const by = readNumber(resolved.params.by, 1);
      store.setValue(
        path,
        resolved.action === "state.increment" ? base + by : base - by,
      );
      return null;
    }
    case "state.reset": {
      const path = resolvePathValue(resolved.params.path);
      if (path == null) {
        return null;
      }
      store.setValue(path, resolved.params.value ?? null);
      return null;
    }
    case "list.append":
    case "list.insert":
    case "list.remove":
    case "list.replace":
    case "list.move": {
      const path = resolvePathValue(resolved.params.path);
      if (path == null) {
        return null;
      }
      const currentValue = store.getValue(path);
      const list = Array.isArray(currentValue) ? [...currentValue] : [];

      if (resolved.action === "list.append") {
        list.push(resolved.params.value);
      }

      if (resolved.action === "list.insert") {
        const index = readIndex(resolved.params.index) ?? list.length;
        list.splice(index, 0, resolved.params.value);
      }

      if (resolved.action === "list.remove") {
        const index = readIndex(resolved.params.index);
        if (index == null || index >= list.length) {
          return null;
        }
        list.splice(index, 1);
      }

      if (resolved.action === "list.replace") {
        const index = readIndex(resolved.params.index);
        if (index == null || index >= list.length) {
          return null;
        }
        list[index] = resolved.params.value;
      }

      if (resolved.action === "list.move") {
        const from = readIndex(resolved.params.from);
        const to = readIndex(resolved.params.to);
        if (
          from == null ||
          to == null ||
          from >= list.length ||
          to >= list.length
        ) {
          return null;
        }
        const [item] = list.splice(from, 1);
        list.splice(to, 0, item);
      }

      store.setValue(path, list);
      return null;
    }
    case "form.clear": {
      const singlePath = resolvePathValue(resolved.params.path);
      const paths =
        singlePath == null
          ? readStringList(resolved.params.paths)
          : [singlePath];
      if (paths.length === 0) {
        return null;
      }
      clearFormPaths(store, paths);
      return null;
    }
    case "form.validate": {
      const singlePath = resolvePathValue(resolved.params.path);
      const paths =
        singlePath == null
          ? readStringList(resolved.params.paths)
          : [singlePath];
      if (paths.length === 0) {
        return null;
      }
      setValidationForPaths(store, paths);
      return null;
    }
    case "form.submit":
      return {
        type: "form.submit",
        action: resolved.action,
        params: resolved.params,
        ...(resolved.confirm != null ? { confirm: resolved.confirm } : {}),
      };
    case "nav.navigate": {
      const href = readString(resolved.params.href ?? resolved.params.url);
      if (href == null) {
        return null;
      }
      return {
        type: "nav.navigate",
        action: resolved.action,
        params: {
          ...resolved.params,
          href,
        },
        ...(resolved.confirm != null ? { confirm: resolved.confirm } : {}),
      };
    }
    default:
      return null;
  }
}

function executeStep(
  step: ActionStep,
  options: ExecuteActionSequenceOptions,
  result: ActionExecutionResult,
): void {
  const context = createExpressionContext(options.store, {
    repeat: options.repeat,
    functions: options.functions,
  });

  if (step.when != null && !evaluateBoolExpr(step.when, context)) {
    return;
  }

  const resolved = resolveActionStep(step, options);
  const builtInEffect = executeBuiltIn(resolved, options.store);
  result.executed.push(resolved.action);

  if (builtInEffect != null) {
    result.effects.push(builtInEffect);
    if (step.onSuccess != null) {
      executeActionSequence(step.onSuccess, options, result);
    }
    return;
  }

  const customHandler = options.handlers?.[resolved.action];
  if (customHandler != null) {
    const effect = customHandler({ action: resolved, store: options.store });
    if (effect != null) {
      result.effects.push(effect);
    }
    if (step.onSuccess != null) {
      executeActionSequence(step.onSuccess, options, result);
    }
    return;
  }

  result.effects.push({
    type: "custom",
    action: resolved.action,
    params: resolved.params,
    ...(resolved.confirm != null ? { confirm: resolved.confirm } : {}),
  });

  if (step.onSuccess != null) {
    executeActionSequence(step.onSuccess, options, result);
  }
}

export function executeActionSequence(
  sequence: ActionSequence,
  options: ExecuteActionSequenceOptions,
  result: ActionExecutionResult = { effects: [], executed: [] },
): ActionExecutionResult {
  for (const step of normalizeActionSequence(sequence)) {
    executeStep(step, options, result);
  }
  return result;
}
