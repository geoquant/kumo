import { createExpressionContext, resolveValueExpr } from "./expressions";
import { isMutableAppStore } from "./store";
import type {
  AppSpec,
  AppStore,
  FieldValidationState,
  JsonPointer,
  ValidationRule,
} from "./types";

export type ValidationMode = "change" | "blur" | "submit";

export interface ValidationFailure {
  elementKey: string;
  path: JsonPointer;
  message: string;
}

export interface ValidationRunResult {
  valid: boolean;
  fields: Record<string, FieldValidationState>;
  failures: ValidationFailure[];
}

export interface ValidationOptions {
  validators?: Record<
    string,
    (value: unknown, args: readonly unknown[]) => boolean | string | string[]
  >;
}

function matchesMode(
  mode: ValidationMode,
  modes?: readonly ValidationMode[],
): boolean {
  return modes == null || modes.length === 0 || modes.includes(mode);
}

function toMessage(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return `${value}`;
  }

  return JSON.stringify(value) ?? "Invalid value";
}

function isEmpty(value: unknown): boolean {
  return (
    value == null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function evaluateRule(
  rule: ValidationRule,
  value: unknown,
  store: AppStore,
  options: ValidationOptions,
): string[] {
  const context = createExpressionContext(store);
  const message = toMessage(resolveValueExpr(rule.message, context));

  switch (rule.type) {
    case "required":
      return isEmpty(value) ? [message] : [];
    case "minLength":
      return typeof value === "string" && value.length < rule.value
        ? [message]
        : [];
    case "maxLength":
      return typeof value === "string" && value.length > rule.value
        ? [message]
        : [];
    case "email": {
      if (typeof value !== "string" || value.length === 0) {
        return [];
      }

      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? [] : [message];
    }
    case "url": {
      if (typeof value !== "string" || value.length === 0) {
        return [];
      }

      try {
        void new URL(value);
        return [];
      } catch {
        return [message];
      }
    }
    case "number":
      return asNumber(value) == null ? [message] : [];
    case "min": {
      const numeric = asNumber(value);
      return numeric != null && numeric < rule.value ? [message] : [];
    }
    case "max": {
      const numeric = asNumber(value);
      return numeric != null && numeric > rule.value ? [message] : [];
    }
    case "matches": {
      const other = resolveValueExpr(rule.other, context);
      return value !== other ? [message] : [];
    }
    case "custom": {
      const validator = options.validators?.[rule.fn];
      if (validator == null) {
        return [];
      }

      const args = (rule.args ?? []).map((entry) =>
        resolveValueExpr(entry, context),
      );
      const result = validator(value, args);
      if (result === true) {
        return [];
      }
      if (result === false) {
        return [message];
      }
      return Array.isArray(result) ? result : [result];
    }
  }
}

export function validateFieldsForMode(
  spec: AppSpec,
  store: AppStore,
  mode: ValidationMode,
  options: ValidationOptions = {},
): ValidationRunResult {
  const fields: Record<string, FieldValidationState> = {};
  const failures: ValidationFailure[] = [];

  for (const [elementKey, element] of Object.entries(spec.elements)) {
    const validation = element.validation;
    if (validation == null || !matchesMode(mode, validation.mode)) {
      continue;
    }

    const value = store.getValue(validation.path);
    const errors = validation.rules.flatMap((rule) =>
      evaluateRule(rule, value, store, options),
    );
    const fieldState: FieldValidationState = {
      valid: errors.length === 0,
      touched: mode !== "submit" || !isEmpty(value),
      dirty: value !== undefined,
      errors,
    };

    fields[validation.path] = fieldState;
    failures.push(
      ...errors.map((message) => ({
        elementKey,
        path: validation.path,
        message,
      })),
    );

    if (isMutableAppStore(store)) {
      store.setValidationState(validation.path, fieldState);
    }
  }

  return {
    valid: failures.length === 0,
    fields,
    failures,
  };
}
