import { getValueAtPointer, joinJsonPointers } from "./path";
import type {
  AppStore,
  BindExpr,
  BoolExpr,
  FormatExpr,
  JsonPointer,
  ReadExpr,
  RefSource,
  RepeatScope,
  RuntimeMeta,
  SwitchExpr,
  ValueExpr,
} from "./types";

export interface ExpressionContext {
  state: Record<string, unknown>;
  meta: RuntimeMeta;
  repeat?: RepeatScope;
  functions?: Record<string, (...args: readonly unknown[]) => unknown>;
}

export interface ResolvedPropsResult {
  props: Record<string, unknown>;
  bindings: Record<string, RefSource>;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isReadExpr(value: unknown): value is ReadExpr {
  return isObjectRecord(value) && "$read" in value;
}

function isBindExpr(value: unknown): value is BindExpr {
  return isObjectRecord(value) && "$bind" in value;
}

function isSwitchExpr(value: unknown): value is SwitchExpr {
  return isObjectRecord(value) && "$switch" in value;
}

function isFormatExpr(value: unknown): value is FormatExpr {
  return isObjectRecord(value) && "$format" in value;
}

function isComputeExpr(
  value: unknown,
): value is { $compute: { fn: string; args?: ValueExpr[] } } {
  return isObjectRecord(value) && "$compute" in value;
}

function stringifyResolvedValue(value: unknown): string {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return `${value}`;
  }

  const json = JSON.stringify(value);
  return json ?? "";
}

function compareValues(left: unknown, right: unknown, op: string): boolean {
  switch (op) {
    case "eq":
      return left === right;
    case "neq":
      return left !== right;
    case "gt":
      return (
        typeof left === "number" && typeof right === "number" && left > right
      );
    case "gte":
      return (
        typeof left === "number" && typeof right === "number" && left >= right
      );
    case "lt":
      return (
        typeof left === "number" && typeof right === "number" && left < right
      );
    case "lte":
      return (
        typeof left === "number" && typeof right === "number" && left <= right
      );
    case "in":
      return Array.isArray(right) ? right.includes(left) : false;
    default:
      return false;
  }
}

export function createExpressionContext(
  store: AppStore,
  options: {
    repeat?: RepeatScope;
    functions?: Record<string, (...args: readonly unknown[]) => unknown>;
  } = {},
): ExpressionContext {
  const snapshot = store.getSnapshot();
  return {
    state: snapshot.state,
    meta: snapshot.meta,
    ...(options.repeat != null ? { repeat: options.repeat } : {}),
    ...(options.functions != null ? { functions: options.functions } : {}),
  };
}

export function resolveRefSource(
  source: RefSource,
  context: ExpressionContext,
): unknown {
  switch (source.source) {
    case "state":
      return getValueAtPointer(context.state, source.path);
    case "meta":
      return getValueAtPointer(context.meta, source.path);
    case "index":
      return context.repeat?.index;
    case "item": {
      if (context.repeat == null) {
        return undefined;
      }

      return source.path == null || source.path === "/"
        ? context.repeat.item
        : getValueAtPointer(context.repeat.item, source.path);
    }
  }
}

export function resolveBindingTarget(
  source: RefSource,
  context: ExpressionContext,
): JsonPointer | null {
  switch (source.source) {
    case "state":
      return source.path;
    case "item":
      return context.repeat == null
        ? null
        : joinJsonPointers(context.repeat.itemPath, source.path ?? "/");
    case "index":
    case "meta":
      return null;
  }
}

export function writeBindingValue(
  store: AppStore,
  source: RefSource,
  value: unknown,
  context: ExpressionContext,
): boolean {
  const target = resolveBindingTarget(source, context);
  if (target == null) {
    return false;
  }

  store.setValue(target, value);
  return true;
}

export function evaluateBoolExpr(
  expression: BoolExpr | undefined,
  context: ExpressionContext,
): boolean {
  if (expression === undefined) {
    return true;
  }

  if (typeof expression === "boolean") {
    return expression;
  }

  if ("$not" in expression) {
    return !evaluateBoolExpr(expression.$not, context);
  }

  if ("$and" in expression) {
    return expression.$and.every((entry) => evaluateBoolExpr(entry, context));
  }

  if ("$or" in expression) {
    return expression.$or.some((entry) => evaluateBoolExpr(entry, context));
  }

  const left = resolveValueExpr(expression.$compare.left, context);
  const right = resolveValueExpr(expression.$compare.right, context);
  return compareValues(left, right, expression.$compare.op);
}

export function resolveValueExpr(
  expression: ValueExpr,
  context: ExpressionContext,
): unknown {
  if (
    expression == null ||
    typeof expression === "string" ||
    typeof expression === "number" ||
    typeof expression === "boolean"
  ) {
    return expression;
  }

  if (Array.isArray(expression)) {
    return expression.map((entry) => resolveValueExpr(entry, context));
  }

  if (isReadExpr(expression)) {
    return resolveRefSource(expression.$read, context);
  }

  if (isBindExpr(expression)) {
    return resolveRefSource(expression.$bind, context);
  }

  if (isSwitchExpr(expression)) {
    return evaluateBoolExpr(expression.$switch.when, context)
      ? resolveValueExpr(expression.$switch.then, context)
      : resolveValueExpr(expression.$switch.else ?? null, context);
  }

  if (isFormatExpr(expression)) {
    return expression.$format
      .map((entry) => stringifyResolvedValue(resolveValueExpr(entry, context)))
      .join("");
  }

  if (isComputeExpr(expression)) {
    const fn = context.functions?.[expression.$compute.fn];
    const args = (expression.$compute.args ?? []).map((entry) =>
      resolveValueExpr(entry, context),
    );
    return fn?.(args);
  }

  const resolvedEntries = Object.entries(expression).map(([key, value]) => [
    key,
    resolveValueExpr(value, context),
  ]);

  return Object.fromEntries(resolvedEntries);
}

function resolvePropValue(
  value: ValueExpr,
  pointer: JsonPointer,
  context: ExpressionContext,
  bindings: Record<string, RefSource>,
): unknown {
  if (isBindExpr(value)) {
    bindings[pointer] = value.$bind;
    return resolveRefSource(value.$bind, context);
  }

  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      resolvePropValue(
        entry,
        joinJsonPointers(pointer, `/${index}`),
        context,
        bindings,
      ),
    );
  }

  if (
    isObjectRecord(value) &&
    !isReadExpr(value) &&
    !isSwitchExpr(value) &&
    !isFormatExpr(value) &&
    !isComputeExpr(value)
  ) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        resolvePropValue(
          entry,
          joinJsonPointers(pointer, `/${key}`),
          context,
          bindings,
        ),
      ]),
    );
  }

  return resolveValueExpr(value, context);
}

export function resolvePropsExpressions(
  props: Record<string, ValueExpr>,
  context: ExpressionContext,
): ResolvedPropsResult {
  const bindings: Record<string, RefSource> = {};

  const resolvedProps = Object.fromEntries(
    Object.entries(props).map(([key, value]) => [
      key,
      resolvePropValue(value, `/${key}`, context, bindings),
    ]),
  );

  return { props: resolvedProps, bindings };
}
