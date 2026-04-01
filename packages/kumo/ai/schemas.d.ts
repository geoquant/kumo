import type { z } from "zod";

export type SafeParseResult<T> =
  | { success: true; data: T; error?: never }
  | { success: false; error: z.ZodError<any>; data?: never };

export type DynamicValue<T = unknown> = T | { path: string };

export type LogicExpression =
  | { and: LogicExpression[] }
  | { or: LogicExpression[] }
  | { not: LogicExpression }
  | { path: string }
  | { eq: [DynamicValue, DynamicValue] }
  | { neq: [DynamicValue, DynamicValue] }
  | { gt: [DynamicValue, DynamicValue] }
  | { gte: [DynamicValue, DynamicValue] }
  | { lt: [DynamicValue, DynamicValue] }
  | { lte: [DynamicValue, DynamicValue] };

export type VisibilityCondition =
  | boolean
  | { path: string }
  | { auth: "signedIn" | "signedOut" }
  | LogicExpression;

export interface Action {
  name: string;
  params?: Record<string, DynamicValue>;
  confirm?: {
    title: string;
    message: string;
    variant?: "default" | "danger";
    confirmLabel?: string;
    cancelLabel?: string;
  };
  onSuccess?: { set: Record<string, DynamicValue> };
  onError?: { set: Record<string, DynamicValue> };
}

export const DynamicValueSchema: z.ZodType<DynamicValue>;
export const VisibilityConditionSchema: z.ZodType<VisibilityCondition>;
export const ActionConfirmSchema: z.ZodType<Action["confirm"]>;
export const ActionSchema: z.ZodType<Action>;
export const KumoComponentTypeSchema: z.ZodType<string>;
export const ComponentPropsSchemas: Record<string, z.ZodTypeAny>;

export interface UIElement {
  key: string;
  type: string;
  props: Record<string, unknown>;
  children?: string[];
  parentKey?: string | null;
  visible?: VisibilityCondition;
  action?: Action;
}

export interface UITree {
  root: string;
  elements: Record<string, UIElement>;
}

export const UIElementBaseSchema: {
  safeParse: (data: unknown) => SafeParseResult<UIElement>;
};

export const UITreeSchema: {
  safeParse: (data: unknown) => SafeParseResult<UITree>;
};

export function validateElementProps(element: UIElement): SafeParseResult<unknown>;
export function validateUITree(tree: unknown): SafeParseResult<UITree>;

export const KUMO_COMPONENT_NAMES: readonly string[];
