import { joinJsonPointers } from "./path";
import type {
  AppElement,
  AppSpec,
  AppStore,
  JsonPointer,
  RepeatScope,
} from "./types";

export interface ExpandedAppSpec {
  root: string;
  elements: Record<string, AppElement>;
  repeatScopes: Record<string, RepeatScope>;
}

function sanitizePointer(path: JsonPointer): string {
  if (path === "/") {
    return "root";
  }

  return path.slice(1).replaceAll("/", "__").replaceAll("~", "_");
}

function cloneKey(baseKey: string, scope: RepeatScope | undefined): string {
  if (scope == null) {
    return baseKey;
  }

  return `${baseKey}__${sanitizePointer(scope.itemPath)}`;
}

function cloneScope(scope: RepeatScope | undefined): RepeatScope | undefined {
  return scope == null ? undefined : { ...scope };
}

export function expandAppSpec(spec: AppSpec, store: AppStore): ExpandedAppSpec {
  const elements: Record<string, AppElement> = {};
  const repeatScopes: Record<string, RepeatScope> = {};

  function renderElement(
    baseKey: string,
    scope?: RepeatScope,
    suppressRepeat?: boolean,
  ): string {
    const source = spec.elements[baseKey];
    const nextKey = cloneKey(baseKey, scope);

    if (source == null) {
      return nextKey;
    }

    const renderedChildren = (source.children ?? []).flatMap((childKey) => {
      const child = spec.elements[childKey];
      if (child?.repeat != null) {
        const repeatedValue = store.getValue(child.repeat.source.path);
        if (!Array.isArray(repeatedValue)) {
          return [];
        }

        return repeatedValue.map((item, index) => {
          const itemPath = joinJsonPointers(
            child.repeat!.source.path,
            `/${index}`,
          );
          return renderElement(
            childKey,
            {
              item,
              index,
              itemPath,
            },
            true,
          );
        });
      }

      return [renderElement(childKey, scope)];
    });

    elements[nextKey] = {
      ...source,
      key: nextKey,
      ...(renderedChildren.length > 0 ? { children: renderedChildren } : {}),
      ...(suppressRepeat ? { repeat: undefined } : {}),
    };

    const nextScope = cloneScope(scope);
    if (nextScope != null) {
      repeatScopes[nextKey] = nextScope;
    }

    return nextKey;
  }

  const root = renderElement(spec.root);

  return {
    root,
    elements,
    repeatScopes,
  };
}
