import componentBehaviorJson from "../../../ai/component-behavior.json";
import { isJsonPointer } from "./path";
import { APP_SPEC_VERSION } from "./types";
import type {
  ActionSequence,
  ActionStep,
  AppElement,
  AppSpec,
  BoolExpr,
  CompatibleUITreeInput,
  ConfirmSpec,
  KumoEventName,
  ValueExpr,
} from "./types";

interface BehaviorComponentEntry {
  bindableProps: readonly string[];
}

interface BehaviorManifest {
  components: Record<string, BehaviorComponentEntry>;
}

interface LegacyTreeElement {
  key: string;
  type: string;
  props: Record<string, unknown>;
  children?: string[];
  parentKey?: string | null;
  visible?: unknown;
  action?: Record<string, unknown>;
}

const behaviorManifest: BehaviorManifest = componentBehaviorJson;

const COMPAT_AUTH_SIGNED_IN_PATH = "/__compat/auth/isSignedIn" as const;
const COMPAT_AUTH_USER_PATH = "/__compat/auth/user" as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDynamicPath(value: unknown): value is { path: string } {
  return isRecord(value) && typeof value.path === "string";
}

function toReadExpr(path: string): ValueExpr {
  if (path === "" || path === "/") {
    return {
      $read: {
        source: "state",
        path: "/",
      },
    };
  }

  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!isJsonPointer(normalized)) {
    return {
      $read: {
        source: "state",
        path: "/",
      },
    };
  }

  return {
    $read: {
      source: "state",
      path: normalized,
    },
  };
}

function toBindExpr(path: string): ValueExpr {
  if (path === "" || path === "/") {
    return {
      $bind: {
        source: "state",
        path: "/",
      },
    };
  }

  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!isJsonPointer(normalized)) {
    return {
      $bind: {
        source: "state",
        path: "/",
      },
    };
  }

  return {
    $bind: {
      source: "state",
      path: normalized,
    },
  };
}

function adaptValue(value: unknown): ValueExpr {
  if (value === undefined) {
    return null;
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (isDynamicPath(value)) {
    return toReadExpr(value.path);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => adaptValue(entry));
  }

  const entries = Object.entries(value).map(([key, entry]) => [
    key,
    adaptValue(entry),
  ]);
  return Object.fromEntries(entries);
}

function adaptProps(element: {
  type: string;
  props: Record<string, unknown>;
}): Record<string, ValueExpr> {
  const bindableProps = new Set(
    behaviorManifest.components[element.type]?.bindableProps ?? [],
  );

  return Object.fromEntries(
    Object.entries(element.props).map(([key, value]) => {
      if (isDynamicPath(value) && bindableProps.has(key)) {
        return [key, toBindExpr(value.path)];
      }

      return [key, adaptValue(value)];
    }),
  );
}

function adaptVisibility(condition: unknown): BoolExpr | undefined {
  if (condition == null) {
    return undefined;
  }

  if (typeof condition === "boolean") {
    return condition;
  }

  if (!isRecord(condition)) {
    return undefined;
  }

  if (typeof condition.auth === "string") {
    const authExpr: BoolExpr = {
      $truthy: {
        $read: {
          source: "state",
          path: COMPAT_AUTH_SIGNED_IN_PATH,
        },
      },
    };

    return condition.auth === "signedOut" ? { $not: authExpr } : authExpr;
  }

  if (typeof condition.path === "string") {
    return { $truthy: toReadExpr(condition.path) };
  }

  if (Array.isArray(condition.and)) {
    return {
      $and: condition.and.map((entry) => adaptVisibility(entry) ?? true),
    };
  }

  if (Array.isArray(condition.or)) {
    return {
      $or: condition.or.map((entry) => adaptVisibility(entry) ?? false),
    };
  }

  if (condition.not != null) {
    return { $not: adaptVisibility(condition.not) ?? true };
  }

  const compareOps = ["eq", "neq", "gt", "gte", "lt", "lte"] as const;
  for (const op of compareOps) {
    const entry = condition[op];
    if (Array.isArray(entry) && entry.length === 2) {
      return {
        $compare: {
          left: adaptValue(entry[0]),
          op,
          right: adaptValue(entry[1]),
        },
      };
    }
  }

  return undefined;
}

function adaptConfirm(
  confirm: Record<string, unknown> | undefined,
): ConfirmSpec | undefined {
  if (confirm == null) {
    return undefined;
  }

  const title = confirm.title;
  if (typeof title !== "string") {
    return undefined;
  }

  return {
    title,
    ...(typeof confirm.message === "string"
      ? { description: confirm.message }
      : {}),
    ...(confirm.variant === "default" || confirm.variant === "danger"
      ? { variant: confirm.variant }
      : {}),
    ...(typeof confirm.confirmLabel === "string"
      ? { confirmLabel: confirm.confirmLabel }
      : {}),
    ...(typeof confirm.cancelLabel === "string"
      ? { cancelLabel: confirm.cancelLabel }
      : {}),
  };
}

function adaptStateMerge(
  set: Record<string, unknown> | undefined,
): ActionStep[] {
  if (set == null) {
    return [];
  }

  return [
    {
      action: "state.merge",
      params: {
        path: "/",
        value: adaptValue(set),
      },
    },
  ];
}

function eventForElementType(type: string): KumoEventName {
  const bindableProps = behaviorManifest.components[type]?.bindableProps ?? [];
  return bindableProps.length > 0 ? "change" : "press";
}

function adaptAction(
  action: Record<string, unknown> | undefined,
): ActionSequence | null {
  if (action == null || typeof action.name !== "string") {
    return null;
  }

  const params = isRecord(action.params)
    ? Object.fromEntries(
        Object.entries(action.params).map(([key, value]) => [
          key,
          adaptValue(value),
        ]),
      )
    : undefined;

  const step: ActionStep = {
    action: action.name,
    ...(params != null ? { params } : {}),
    ...(adaptConfirm(isRecord(action.confirm) ? action.confirm : undefined) !=
    null
      ? {
          confirm: adaptConfirm(
            isRecord(action.confirm) ? action.confirm : undefined,
          ),
        }
      : {}),
    ...(isRecord(action.onSuccess)
      ? {
          onSuccess: adaptStateMerge(
            isRecord(action.onSuccess.set) ? action.onSuccess.set : undefined,
          ),
        }
      : {}),
    ...(isRecord(action.onError)
      ? {
          onError: adaptStateMerge(
            isRecord(action.onError.set) ? action.onError.set : undefined,
          ),
        }
      : {}),
  };

  return step;
}

function adaptElement(element: LegacyTreeElement): AppElement {
  const adaptedAction = adaptAction(element.action);
  const eventName = eventForElementType(element.type);

  return {
    key: element.key,
    type: element.type,
    ...(Object.keys(element.props).length > 0
      ? { props: adaptProps(element) }
      : {}),
    ...(element.children != null && element.children.length > 0
      ? { children: [...element.children] }
      : {}),
    ...(adaptVisibility(element.visible) != null
      ? { visible: adaptVisibility(element.visible) }
      : {}),
    ...(adaptedAction != null
      ? {
          events: {
            [eventName]: adaptedAction,
          },
        }
      : {}),
  };
}

function normalizeLegacyElements(
  elements: CompatibleUITreeInput["tree"]["elements"],
): Record<string, LegacyTreeElement> {
  const normalized = Object.fromEntries(
    Object.entries(elements).map(([key, element]) => [
      key,
      {
        key: element.key,
        type: element.type,
        props: isRecord(element.props) ? element.props : {},
        ...(element.children != null
          ? { children: [...element.children] }
          : {}),
        ...(element.parentKey !== undefined
          ? { parentKey: element.parentKey }
          : {}),
        ...(element.visible != null ? { visible: element.visible } : {}),
        ...(element.action != null && isRecord(element.action)
          ? { action: element.action }
          : {}),
      },
    ]),
  );

  for (const element of Object.values(normalized)) {
    const parentKey = element.parentKey;
    if (typeof parentKey !== "string" || parentKey === "") {
      continue;
    }

    const parent = normalized[parentKey];
    if (parent == null) {
      continue;
    }

    const children = parent.children ?? [];
    if (children.includes(element.key)) {
      continue;
    }

    parent.children = [...children, element.key];
  }

  return normalized;
}

function buildState(input: CompatibleUITreeInput): Record<string, unknown> {
  const state = input.data != null ? { ...input.data } : {};
  const compat = isRecord(state.__compat) ? { ...state.__compat } : {};
  const auth = {
    isSignedIn: input.auth?.isSignedIn ?? false,
    ...(input.auth?.user != null ? { user: input.auth.user } : {}),
  };

  return {
    ...state,
    __compat: {
      ...compat,
      auth,
    },
  };
}

export function adaptCompatibleUITree(input: CompatibleUITreeInput): AppSpec {
  const elements = normalizeLegacyElements(input.tree.elements);

  return {
    version: APP_SPEC_VERSION,
    root: input.tree.root,
    elements: Object.fromEntries(
      Object.entries(elements).map(([key, element]) => [
        key,
        adaptElement(element),
      ]),
    ),
    state: buildState(input),
    ...(input.meta != null ? { meta: { ...input.meta } } : {}),
  };
}

export { COMPAT_AUTH_SIGNED_IN_PATH, COMPAT_AUTH_USER_PATH };
