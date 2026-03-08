import { APP_SPEC_VERSION } from "./types";
import type { AppSpec, AppElement } from "./types";

export interface RepairIssue {
  kind: "missing-root" | "missing-child" | "mismatched-key";
  key: string;
  detail: string;
}

export interface RepairResult {
  spec: AppSpec;
  repaired: boolean;
  issues: RepairIssue[];
}

function firstElementKey(elements: Record<string, AppElement>): string {
  const [first] = Object.keys(elements);
  return first ?? "";
}

export function repairAppSpec(spec: AppSpec): RepairResult {
  const issues: RepairIssue[] = [];
  const elements = Object.fromEntries(
    Object.entries(spec.elements).map(([key, element]) => {
      const nextChildren = (element.children ?? []).filter((childKey) => {
        const exists = childKey in spec.elements && childKey !== key;
        if (!exists) {
          issues.push({
            kind: "missing-child",
            key,
            detail: `Dropped child reference ${childKey}`,
          });
        }
        return exists;
      });

      if (element.key !== key) {
        issues.push({
          kind: "mismatched-key",
          key,
          detail: `Repaired element key from ${element.key} to ${key}`,
        });
      }

      return [
        key,
        {
          ...element,
          key,
          ...(nextChildren.length > 0 ? { children: nextChildren } : {}),
        },
      ];
    }),
  );

  let root = spec.root;
  if (root.length === 0 || !(root in elements)) {
    const nextRoot = firstElementKey(elements);
    issues.push({
      kind: "missing-root",
      key: spec.root,
      detail: `Repaired root to ${nextRoot}`,
    });
    root = nextRoot;
  }

  return {
    spec: {
      version: spec.version ?? APP_SPEC_VERSION,
      root,
      elements,
      state: { ...spec.state },
      ...(spec.meta != null ? { meta: spec.meta } : {}),
    },
    repaired: issues.length > 0,
    issues,
  };
}
