import { createExpressionContext, evaluateBoolExpr } from "./expressions";
import { executeActionSequence } from "./actions";
import { getValueAtPointer } from "./path";
import type { AppSpec, AppStore } from "./types";
import type { ExecuteActionSequenceOptions } from "./actions";

export interface WatcherInvocation {
  elementKey: string;
  watchIndex: number;
  actions: string[];
}

export interface WatcherRunResult {
  invocations: WatcherInvocation[];
  iterations: number;
}

export interface RunWatchersOptions
  extends Pick<ExecuteActionSequenceOptions, "functions" | "handlers"> {
  previousState: Record<string, unknown>;
  maxDepth?: number;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value) ?? "undefined";
}

function changedAtPath(
  previousState: Record<string, unknown>,
  currentState: Record<string, unknown>,
  path: string,
): boolean {
  return (
    stableStringify(
      getValueAtPointer(previousState, path as `/${string}` | "/"),
    ) !==
    stableStringify(getValueAtPointer(currentState, path as `/${string}` | "/"))
  );
}

export function runWatchers(
  spec: AppSpec,
  store: AppStore,
  options: RunWatchersOptions,
): WatcherRunResult {
  const maxDepth = options.maxDepth ?? 10;
  const invocations: WatcherInvocation[] = [];
  let previousState = options.previousState;

  for (let iteration = 1; iteration <= maxDepth; iteration += 1) {
    const currentState = store.getSnapshot().state;
    let triggered = false;

    for (const [elementKey, element] of Object.entries(spec.elements)) {
      for (const [watchIndex, watch] of (element.watch ?? []).entries()) {
        if (!changedAtPath(previousState, currentState, watch.path)) {
          continue;
        }

        const context = createExpressionContext(store);
        if (watch.when != null && !evaluateBoolExpr(watch.when, context)) {
          continue;
        }

        const result = executeActionSequence(watch.actions, {
          store,
          functions: options.functions,
          handlers: options.handlers,
        });

        invocations.push({
          elementKey,
          watchIndex,
          actions: result.executed,
        });
        triggered = true;
      }
    }

    if (!triggered) {
      return {
        invocations,
        iterations: iteration - 1,
      };
    }

    const nextState = store.getSnapshot().state;
    if (stableStringify(currentState) === stableStringify(nextState)) {
      return {
        invocations,
        iterations: iteration,
      };
    }

    previousState = currentState;
  }

  throw new Error("Watcher cycle limit exceeded");
}
