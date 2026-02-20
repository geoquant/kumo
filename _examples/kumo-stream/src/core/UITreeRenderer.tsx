/**
 * UITreeRenderer — renders a UITree as Kumo React components.
 *
 * Recursively traverses the flat UITree structure, resolving each element's
 * type to a Kumo component via the component map, and rendering children
 * by key reference. Wraps each element in an error boundary to prevent
 * individual component failures from crashing the entire tree.
 */

import React, { Component } from "react";
import type { ReactNode } from "react";
import type { UITree, UIElement } from "./types";
import { COMPONENT_MAP, KNOWN_TYPES } from "./component-map";
import {
  createActionHandler,
  createClickHandler,
  type ActionDispatch,
} from "./action-handler";
import { validateElement, logValidationError } from "./element-validator";
import type { RuntimeValueStore } from "./runtime-value-store";
import { RuntimeValueStoreProvider } from "./runtime-value-store-context";

/** Maximum recursion depth to prevent infinite loops from circular refs. */
const MAX_DEPTH = 50;

/** Props that must never be spread onto DOM elements from LLM output. */
const BLOCKED_PROPS = new Set(["dangerouslySetInnerHTML", "ref", "key"]);

/**
 * Component types that use onClick for action dispatch instead of onAction.
 * These are native-event components (Button, Link) that don't implement the
 * onAction callback pattern used by stateful wrappers.
 */
const ONCLICK_ACTION_TYPES = new Set(["Button", "Link"]);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface UITreeRendererProps {
  /** The UITree to render. */
  readonly tree: UITree;
  /**
   * When true, children referencing nonexistent element keys render as null
   * (invisible) instead of error divs. Set to true during streaming, when
   * parent elements declare child keys before the child elements arrive.
   */
  readonly streaming?: boolean;
  /**
   * Host callback invoked when a component with an `action` field triggers
   * its onAction. Receives a well-formed ActionEvent with actionName,
   * sourceKey, params, and context.
   */
  readonly onAction?: ActionDispatch;
  /** Per-container runtime value store (captures uncontrolled input values). */
  readonly runtimeValueStore?: RuntimeValueStore;
}

// ---------------------------------------------------------------------------
// Error Boundary
// ---------------------------------------------------------------------------

interface ErrorBoundaryState {
  readonly hasError: boolean;
  readonly error: Error | null;
}

class ElementErrorBoundary extends Component<
  { readonly elementKey: string; readonly children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded border border-kumo-danger-line bg-kumo-danger-subtle p-2 text-xs text-kumo-danger">
          Failed to render &ldquo;{this.props.elementKey}&rdquo;
          {this.state.error ? `: ${this.state.error.message}` : ""}
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Filter out blocked props that should never be passed to components. */
function sanitizeProps(
  props: Record<string, unknown>,
): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!BLOCKED_PROPS.has(key)) {
      clean[key] = value;
    }
  }
  return clean;
}

// ---------------------------------------------------------------------------
// Element Renderer
// ---------------------------------------------------------------------------

function RenderElement({
  elementKey,
  elements,
  depth = 0,
  streaming = false,
  onAction,
}: {
  readonly elementKey: string;
  readonly elements: Record<string, UIElement>;
  readonly depth?: number;
  readonly streaming?: boolean;
  readonly onAction?: ActionDispatch;
}): React.JSX.Element | null {
  if (depth > MAX_DEPTH) {
    return (
      <div className="text-xs text-kumo-danger">
        Max depth exceeded at: {elementKey}
      </div>
    );
  }

  const element = elements[elementKey];
  if (!element) {
    // During streaming, missing keys are expected (parent declared children
    // before child elements arrived). Render nothing — they'll appear on the
    // next patch.
    if (streaming) return null;
    return (
      <div className="text-xs text-kumo-danger">
        Missing element: {elementKey}
      </div>
    );
  }

  // Validate element props against Kumo schema before rendering.
  // Invalid elements render a warning instead of crashing the tree.
  const validation = validateElement(element);
  if (!validation.valid) {
    logValidationError(validation);
    return (
      <div
        data-key={elementKey}
        className="rounded border border-kumo-warning-line bg-kumo-warning-subtle p-2 text-xs text-kumo-warning"
      >
        Validation failed: &ldquo;{elementKey}&rdquo; ({element.type})
        {validation.issues.length > 0 && (
          <ul className="mt-1 list-inside list-disc">
            {validation.issues.map((issue, i) => (
              <li key={i}>
                {issue.path}: {issue.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const { type, props, children } = element;
  const nextDepth = depth + 1;

  // Handle the special "Div" type — generic HTML container
  if (type === "Div") {
    const safeProps = sanitizeProps(props as Record<string, unknown>);
    const { className, ...rest } = safeProps;
    return (
      <ElementErrorBoundary elementKey={elementKey}>
        <div
          data-key={elementKey}
          className={typeof className === "string" ? className : undefined}
          // Only pass through style, id, and data-* attributes
          {...filterDivProps(rest)}
        >
          {children?.map((childKey: string) => (
            <RenderElement
              key={childKey}
              elementKey={childKey}
              elements={elements}
              depth={nextDepth}
              streaming={streaming}
              onAction={onAction}
            />
          ))}
        </div>
      </ElementErrorBoundary>
    );
  }

  const Comp = COMPONENT_MAP[type];
  if (!Comp) {
    return (
      <div className="rounded border border-kumo-warning-line bg-kumo-warning-subtle p-2 text-xs text-kumo-warning">
        Unknown component: {type}
      </div>
    );
  }

  // Separate "children" text prop from structural children keys.
  // Some elements use props.children as text (e.g., Text, Badge, Button)
  // while also having structural children[] array for nested elements.
  const safeProps = sanitizeProps(props as Record<string, unknown>);
  const { children: propsChildren, ...restProps } = safeProps;

  // Tag every rendered element with its key for DOM identification
  restProps["data-key"] = elementKey;

  // Inject action handler when element declares an action field.
  // Button and Link use onClick (they don't have an onAction prop);
  // all other components use the onAction callback pattern.
  if (element.action != null && onAction != null) {
    if (ONCLICK_ACTION_TYPES.has(type)) {
      restProps.onClick = createClickHandler(
        element.action,
        elementKey,
        onAction,
        restProps.onClick,
      );
    } else {
      restProps.onAction = createActionHandler(
        element.action,
        elementKey,
        onAction,
      );
    }
  }

  // Build rendered child elements from children[] key references
  const renderedChildren: ReactNode[] = [];

  // If props.children is a string/number, render it as text content
  if (propsChildren != null && typeof propsChildren !== "object") {
    renderedChildren.push(propsChildren as ReactNode);
  }

  // Render structural children
  if (children && children.length > 0) {
    for (const childKey of children) {
      renderedChildren.push(
        <RenderElement
          key={childKey}
          elementKey={childKey}
          elements={elements}
          depth={nextDepth}
          streaming={streaming}
          onAction={onAction}
        />,
      );
    }
  }

  return (
    <ElementErrorBoundary elementKey={elementKey}>
      <Comp {...restProps}>
        {renderedChildren.length > 0 ? renderedChildren : undefined}
      </Comp>
    </ElementErrorBoundary>
  );
}

/** Only allow safe props on native div elements. */
function filterDivProps(
  props: Record<string, unknown>,
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    // Allow style, id, and data-* attributes only
    if (
      key === "style" ||
      key === "id" ||
      key.startsWith("data-") ||
      key.startsWith("aria-") ||
      key === "role"
    ) {
      safe[key] = value;
    }
  }
  return safe;
}

// ---------------------------------------------------------------------------
// Main Renderer
// ---------------------------------------------------------------------------

export function UITreeRenderer({
  tree,
  streaming = false,
  onAction,
  runtimeValueStore,
}: UITreeRendererProps): React.JSX.Element | null {
  if (!tree.root || Object.keys(tree.elements).length === 0) {
    return null;
  }

  return (
    <RuntimeValueStoreProvider value={runtimeValueStore ?? null}>
      <RenderElement
        elementKey={tree.root}
        elements={tree.elements}
        streaming={streaming}
        onAction={onAction}
      />
    </RuntimeValueStoreProvider>
  );
}

/** Check if a UITree has any renderable content. */
export function isRenderableTree(tree: UITree): boolean {
  return tree.root !== "" && Object.keys(tree.elements).length > 0;
}

/** Get unrecognized types in a tree (for debugging). */
export function getUnknownTypes(tree: UITree): string[] {
  const unknown: string[] = [];
  for (const key of Object.keys(tree.elements)) {
    const el = tree.elements[key];
    if (el && !KNOWN_TYPES.has(el.type) && el.type !== "Div") {
      unknown.push(el.type);
    }
  }
  return [...new Set(unknown)];
}
