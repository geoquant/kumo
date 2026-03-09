import type {
  AuthState,
  DataModel,
  UIElement as LegacyUIElement,
  UITree as LegacyUITree,
} from "../../catalog/types";

export const APP_SPEC_VERSION = "app/v1";

export type AppSpecVersion = typeof APP_SPEC_VERSION;
export type JsonPointer = "/" | `/${string}`;

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | { [key: string]: JsonValue }
  | JsonValue[];

export interface AppSpec {
  version: AppSpecVersion;
  root: string;
  elements: Record<string, AppElement>;
  state: Record<string, unknown>;
  meta?: AppSpecMeta;
}

export interface AppSpecMeta {
  title?: string;
  description?: string;
}

export interface AppElement {
  key: string;
  type: string;
  props?: Record<string, ValueExpr>;
  children?: string[];
  visible?: BoolExpr;
  events?: Partial<Record<KumoEventName, ActionSequence>>;
  repeat?: RepeatSpec;
  watch?: WatchRule[];
  validation?: FieldValidationSpec;
}

export type KumoEventName =
  | "press"
  | "change"
  | "submit"
  | "blur"
  | "focus"
  | "mount";

export type ActionSequence = ActionStep | ActionStep[];

export type ValueExpr =
  | JsonPrimitive
  | ValueExpr[]
  | { [key: string]: ValueExpr }
  | ReadExpr
  | BindExpr
  | SwitchExpr
  | FormatExpr
  | ComputeExpr;

export interface ReadExpr {
  $read: RefSource;
}

export interface BindExpr {
  $bind: RefSource;
}

export interface SwitchExpr {
  $switch: {
    when: BoolExpr;
    then: ValueExpr;
    else?: ValueExpr;
  };
}

export interface FormatExpr {
  $format: Array<string | ValueExpr>;
}

export interface ComputeExpr {
  $compute: {
    fn: string;
    args?: ValueExpr[];
  };
}

export type RefSource =
  | { source: "state"; path: JsonPointer }
  | { source: "item"; path?: JsonPointer }
  | { source: "index" }
  | { source: "meta"; path: JsonPointer };

export type BoolExpr =
  | boolean
  | { $not: BoolExpr }
  | { $truthy: ValueExpr }
  | {
      $compare: {
        left: ValueExpr;
        op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in";
        right: ValueExpr;
      };
    }
  | { $and: BoolExpr[] }
  | { $or: BoolExpr[] };

export interface ActionStep {
  action: string;
  params?: Record<string, ValueExpr>;
  when?: BoolExpr;
  confirm?: ConfirmSpec;
  onSuccess?: ActionSequence;
  onError?: ActionSequence;
}

export interface ConfirmSpec {
  title: ValueExpr;
  description?: ValueExpr;
  variant?: "default" | "danger";
  confirmLabel?: ValueExpr;
  cancelLabel?: ValueExpr;
}

export type BuiltInActionName =
  | "state.set"
  | "state.merge"
  | "state.toggle"
  | "state.increment"
  | "state.decrement"
  | "state.reset"
  | "list.append"
  | "list.insert"
  | "list.remove"
  | "list.replace"
  | "list.move"
  | "form.validate"
  | "form.clear"
  | "form.submit"
  | "nav.navigate";

export interface RepeatSpec {
  source: { source: "state"; path: JsonPointer };
  as?: string;
  indexAs?: string;
  keyBy?: JsonPointer;
}

export interface RepeatScope {
  item: unknown;
  index: number;
  itemPath: JsonPointer;
}

export interface FieldValidationSpec {
  path: JsonPointer;
  mode?: Array<"change" | "blur" | "submit">;
  rules: ValidationRule[];
}

export type ValidationRule =
  | { type: "required"; message: ValueExpr }
  | { type: "minLength"; value: number; message: ValueExpr }
  | { type: "maxLength"; value: number; message: ValueExpr }
  | { type: "email"; message: ValueExpr }
  | { type: "url"; message: ValueExpr }
  | { type: "number"; message: ValueExpr }
  | { type: "min"; value: number; message: ValueExpr }
  | { type: "max"; value: number; message: ValueExpr }
  | { type: "matches"; other: ValueExpr; message: ValueExpr }
  | { type: "custom"; fn: string; args?: ValueExpr[]; message: ValueExpr };

export interface FieldValidationState {
  valid: boolean;
  touched: boolean;
  dirty: boolean;
  errors: string[];
}

export interface WatchRule {
  path: JsonPointer;
  when?: BoolExpr;
  debounceMs?: number;
  actions: ActionSequence;
}

export interface AppStoreSnapshot {
  state: Record<string, unknown>;
  meta: RuntimeMeta;
}

export interface RuntimeMeta {
  validation: Record<string, FieldValidationState>;
  stream: {
    status: "idle" | "streaming" | "complete" | "error";
    lastError?: string;
  };
}

export interface AppStore {
  getSnapshot(): AppStoreSnapshot;
  getValue(path: JsonPointer): unknown;
  setValue(path: JsonPointer, value: unknown): void;
  subscribe(listener: () => void): () => void;
}

export type CompatibleUITree = LegacyUITree;
export type CompatibleUIElement = LegacyUIElement;

export interface CompatibleUITreeInput {
  tree: CompatibleUITree;
  data?: DataModel;
  auth?: AuthState;
  meta?: AppSpecMeta;
}
