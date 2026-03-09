import { adaptCompatibleUITree } from "./adapt-uitree";
import { APP_SPEC_VERSION } from "./types";
import type {
  AppElement,
  AppSpec,
  AppSpecMeta,
  CompatibleUITreeInput,
  ValueExpr,
} from "./types";

export interface NestedAppElement {
  key?: string;
  type: string;
  props?: Record<string, ValueExpr>;
  visible?: AppElement["visible"];
  events?: AppElement["events"];
  repeat?: AppElement["repeat"];
  watch?: AppElement["watch"];
  validation?: AppElement["validation"];
  children?: NestedAppElement[];
}

export interface NestedAppSpec {
  version?: AppSpec["version"];
  state?: AppSpec["state"];
  meta?: AppSpecMeta;
  root: NestedAppElement;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNestedRoot(value: unknown): value is NestedAppSpec {
  return (
    isRecord(value) &&
    isRecord(value.root) &&
    typeof value.root.type === "string"
  );
}

function isCompatibleUITreeInput(
  value: unknown,
): value is CompatibleUITreeInput {
  return (
    isRecord(value) &&
    isRecord(value.tree) &&
    typeof value.tree.root === "string" &&
    isRecord(value.tree.elements)
  );
}

function nextGeneratedKey(counter: { value: number }, type: string): string {
  counter.value += 1;
  return `${type.toLowerCase()}-${counter.value}`;
}

export function flattenNestedAppSpec(input: NestedAppSpec): AppSpec {
  const elements: Record<string, AppElement> = {};
  const counter = { value: 0 };

  function visit(node: NestedAppElement): string {
    const key = node.key ?? nextGeneratedKey(counter, node.type);
    const childKeys = (node.children ?? []).map((child) => visit(child));

    elements[key] = {
      key,
      type: node.type,
      ...(node.props != null ? { props: node.props } : {}),
      ...(childKeys.length > 0 ? { children: childKeys } : {}),
      ...(node.visible != null ? { visible: node.visible } : {}),
      ...(node.events != null ? { events: node.events } : {}),
      ...(node.repeat != null ? { repeat: node.repeat } : {}),
      ...(node.watch != null ? { watch: node.watch } : {}),
      ...(node.validation != null ? { validation: node.validation } : {}),
    };

    return key;
  }

  const root = visit(input.root);

  return {
    version: input.version ?? APP_SPEC_VERSION,
    root,
    elements,
    state: { ...input.state },
    ...(input.meta != null ? { meta: input.meta } : {}),
  };
}

export function normalizeAppSpec(
  input: AppSpec | NestedAppSpec | CompatibleUITreeInput,
): AppSpec {
  if (isNestedRoot(input)) {
    return flattenNestedAppSpec(input);
  }

  if (isCompatibleUITreeInput(input)) {
    return adaptCompatibleUITree(input);
  }

  return {
    version: input.version ?? APP_SPEC_VERSION,
    root: input.root,
    elements: { ...input.elements },
    state: { ...input.state },
    ...(input.meta != null ? { meta: input.meta } : {}),
  };
}
