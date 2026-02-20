import type { UIElement, UITree } from "./types";

export const DPU_TEMPLATE_FOR = "kumo-ui";

function escapeText(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(input: string): string {
  // Keep it strict; attributes are double-quoted.
  return escapeText(input);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readStringProp(props: unknown, key: string): string | undefined {
  if (!isRecord(props)) return undefined;
  const value = props[key];
  return typeof value === "string" ? value : undefined;
}

function renderElement(
  tree: UITree,
  elementKey: string,
  visited: Set<string>,
): string {
  if (visited.has(elementKey)) {
    return "";
  }
  visited.add(elementKey);

  const el: UIElement | undefined = tree.elements[elementKey];
  if (el == null) return "";

  const childKeys = Array.isArray(el.children) ? el.children : [];
  const childrenHtml = childKeys
    .map((k) => renderElement(tree, k, visited))
    .join("");

  const textFromProps = readStringProp(el.props, "children");
  const content =
    childrenHtml !== ""
      ? childrenHtml
      : textFromProps
        ? escapeText(textFromProps)
        : "";

  const attrs =
    ` data-kumo-key="${escapeAttr(el.key)}"` +
    ` data-kumo-type="${escapeAttr(el.type)}"`;

  switch (el.type) {
    case "Text": {
      return `<span${attrs}>${content}</span>`;
    }
    case "Button": {
      return `<button type="button"${attrs}>${content}</button>`;
    }
    case "Input": {
      const placeholder = readStringProp(el.props, "placeholder");
      const label = readStringProp(el.props, "label");
      const ariaLabel = label ?? placeholder;
      const aria = ariaLabel ? ` aria-label="${escapeAttr(ariaLabel)}"` : "";
      const ph = placeholder ? ` placeholder="${escapeAttr(placeholder)}"` : "";
      return `<input type="text"${attrs}${aria}${ph} />`;
    }
    case "Textarea":
    case "InputArea": {
      const placeholder = readStringProp(el.props, "placeholder");
      const label = readStringProp(el.props, "label");
      const ariaLabel = label ?? placeholder;
      const aria = ariaLabel ? ` aria-label="${escapeAttr(ariaLabel)}"` : "";
      const ph = placeholder ? ` placeholder="${escapeAttr(placeholder)}"` : "";
      return `<textarea${attrs}${aria}${ph}></textarea>`;
    }
    default: {
      return `<div${attrs}>${content}</div>`;
    }
  }
}

export function renderTreeToDpuTemplate(
  tree: UITree,
  options?: {
    readonly mode?: "light" | "dark";
  },
): string {
  const mode = options?.mode ?? "light";

  const rootKey = tree.root;
  const visited = new Set<string>();
  const body = rootKey ? renderElement(tree, rootKey, visited) : "";
  const html = `<div class="kumo-root" data-mode="${escapeAttr(mode)}">${body}</div>`;
  return `<template for="${DPU_TEMPLATE_FOR}">${html}</template>`;
}
