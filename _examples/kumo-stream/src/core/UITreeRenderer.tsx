/**
 * UITreeRenderer — renders a UITree as Kumo React components.
 *
 * Recursively traverses the flat UITree structure, resolving each element's
 * type to a Kumo component via the component map, and rendering children
 * by key reference. Wraps each element in an error boundary to prevent
 * individual component failures from crashing the entire tree.
 */

import React, { Component, memo, useMemo } from "react";
import type { ReactNode } from "react";
import type { UITree, UIElement } from "./types";
import { GridItem } from "@cloudflare/kumo";
import { COMPONENT_MAP, KNOWN_TYPES } from "./component-map";
import {
  createActionHandler,
  createClickHandler,
  type ActionDispatch,
} from "./action-handler";
import { validateElement, logValidationError } from "./element-validator";
import type { RuntimeValueStore } from "./runtime-value-store";
import {
  RuntimeValueStoreProvider,
  useRuntimeValueStoreContext,
} from "./runtime-value-store-context";
import { sanitizeUrl } from "./url-policy";

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

const RUNTIME_VALUE_CAPTURE_TYPES = new Set(["Input", "Textarea"]);

const SUBMIT_FORM_RUNTIME_VALUES_KEY = "runtimeValues";

const TWO_COL_GRID_VARIANTS = new Set(["2up", "side-by-side", "2-1", "1-2"]);

const FORM_ROW_CONTROL_TYPES = new Set(["Input", "Select", "Textarea"]);

type ElementValidation = ReturnType<typeof validateElement>;

const validationCache = new WeakMap<UIElement, ElementValidation>();
const loggedInvalidElements = new WeakSet<UIElement>();

function getElementValidation(element: UIElement): ElementValidation {
  const cached = validationCache.get(element);
  if (cached) return cached;
  const result = validateElement(element);
  validationCache.set(element, result);
  return result;
}

function isTwoColFormRowGrid(element: UIElement | undefined): boolean {
  if (!element) return false;
  if (element.type !== "Grid") return false;
  if (!element.children || element.children.length !== 2) return false;

  const props = element.props;
  const variant = props["variant"];
  if (variant !== undefined && typeof variant !== "string") return false;
  if (typeof variant === "string" && !TWO_COL_GRID_VARIANTS.has(variant)) {
    return false;
  }

  // If the model explicitly sets grid-cols via className, don't second-guess it.
  const className = props["className"];
  if (typeof className === "string" && /\bgrid-cols-/.test(className)) {
    return false;
  }

  return true;
}

/**
 * Normalize sibling Grid row variants for form-like layouts.
 *
 * LLM output often emits multiple 2-col Grids for a single form section.
 * When those rows mix variants (e.g. "side-by-side" vs "2-1"), column
 * widths shift between rows and the form looks broken.
 *
 * Heuristic: within any single parent, if there are 2+ sibling 2-child Grid
 * rows that wrap form controls and they don't share the same variant, coerce
 * them all to `variant="2up"`.
 */
export function normalizeSiblingFormRowGrids(tree: UITree): UITree {
  const elements = tree.elements;
  let changed = false;
  const nextElements: Record<string, UIElement> = { ...elements };

  for (const parent of Object.values(elements)) {
    if (!parent?.children || parent.children.length === 0) continue;

    const rowGridKeys: string[] = [];
    for (const childKey of parent.children) {
      const child = elements[childKey];
      if (!isTwoColFormRowGrid(child)) continue;

      const grandChildren = child.children;
      if (!grandChildren) continue;
      const t1 = elements[grandChildren[0]]?.type;
      const t2 = elements[grandChildren[1]]?.type;
      if (!t1 || !t2) continue;
      if (!FORM_ROW_CONTROL_TYPES.has(t1) || !FORM_ROW_CONTROL_TYPES.has(t2)) {
        continue;
      }

      rowGridKeys.push(childKey);
    }

    if (rowGridKeys.length < 2) continue;

    const variants = new Set<string>();
    for (const key of rowGridKeys) {
      const v = elements[key]?.props?.["variant"];
      if (typeof v === "string") variants.add(v);
    }

    if (variants.size <= 1) continue;

    for (const key of rowGridKeys) {
      const el = elements[key];
      if (!el) continue;
      if (el.props["variant"] === "2up") continue;
      nextElements[key] = { ...el, props: { ...el.props, variant: "2up" } };
      changed = true;
    }
  }

  return changed ? { ...tree, elements: nextElements } : tree;
}

function gridItemClassNameForChild(child: UIElement | undefined): string {
  // Base: allow grid children to shrink (prevents overflow in long labels/inputs)
  // and ensure each logical child becomes exactly one grid cell.
  if (!child) return "min-w-0 w-full";

  // Common form pattern: an expandable/collapsible section should span full row.
  if (child.type === "Collapsible") return "min-w-0 w-full col-span-full";

  return "min-w-0 w-full";
}

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
        <div className="rounded border border-kumo-danger bg-kumo-danger-tint p-2 text-xs text-kumo-danger">
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readEventTargetValue(event: unknown): string | undefined {
  if (!isRecord(event)) return undefined;
  const target = event["target"];
  if (!isRecord(target)) return undefined;
  const value = target["value"];
  return typeof value === "string" ? value : undefined;
}

function chainHandlers(
  first: (event: unknown) => void,
  second: unknown,
): (event: unknown) => void {
  return (event: unknown) => {
    first(event);
    if (typeof second === "function") {
      second(event);
    }
  };
}

function preventDefaultIfPossible(event: unknown): void {
  if (!isRecord(event)) return;
  const preventDefault = event["preventDefault"];
  if (typeof preventDefault === "function") {
    preventDefault();
  }
}

function createSubmitFormClickHandler(
  action: UIElement["action"],
  sourceKey: string,
  dispatch: ActionDispatch,
  runtimeValueStore: RuntimeValueStore,
  existingOnClick?: unknown,
): (...args: unknown[]) => void {
  return (...args: unknown[]) => {
    if (typeof existingOnClick === "function") {
      existingOnClick(...args);
    }

    const runtimeValues = runtimeValueStore.snapshotAll();

    dispatch({
      actionName: action?.name ?? "submit_form",
      sourceKey,
      ...(action?.params != null ? { params: action.params } : undefined),
      context: { [SUBMIT_FORM_RUNTIME_VALUES_KEY]: runtimeValues },
    });
  };
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
  const runtimeValueStore = useRuntimeValueStoreContext();

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
  const validation = getElementValidation(element);
  if (!validation.valid) {
    if (!loggedInvalidElements.has(element)) {
      loggedInvalidElements.add(element);
      logValidationError(validation);
    }
    return (
      <div
        data-key={elementKey}
        className="rounded border border-kumo-warning bg-kumo-warning-tint p-2 text-xs text-kumo-warning"
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
      <div className="rounded border border-kumo-warning bg-kumo-warning-tint p-2 text-xs text-kumo-warning">
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
      if (element.action.name === "submit_form" && runtimeValueStore != null) {
        restProps.onClick = createSubmitFormClickHandler(
          element.action,
          elementKey,
          onAction,
          runtimeValueStore,
          restProps.onClick,
        );
      } else {
        restProps.onClick = createClickHandler(
          element.action,
          elementKey,
          onAction,
          restProps.onClick,
        );
      }
    } else {
      restProps.onAction = createActionHandler(
        element.action,
        elementKey,
        onAction,
      );
    }
  }

  // Capture uncontrolled Input/Textarea values into the per-container runtime
  // value store. Avoid controlled mode; just observe onChange.
  if (runtimeValueStore != null && RUNTIME_VALUE_CAPTURE_TYPES.has(type)) {
    const seedValue =
      typeof restProps["value"] === "string"
        ? restProps["value"]
        : typeof restProps["defaultValue"] === "string"
          ? restProps["defaultValue"]
          : undefined;
    if (
      seedValue !== undefined &&
      runtimeValueStore.getValue(elementKey) === undefined &&
      !runtimeValueStore.isTouched(elementKey)
    ) {
      runtimeValueStore.setValue(elementKey, seedValue, { touched: false });
    }

    const existingOnChange = restProps.onChange;
    restProps.onChange = chainHandlers((event: unknown) => {
      const value = readEventTargetValue(event);
      if (value === undefined) return;
      runtimeValueStore.setValue(elementKey, value);
    }, existingOnChange);
  }

  // Apply URL policy to Link hrefs. When blocked, strip href and prevent
  // navigation on click (but still allow any existing onClick/action logic).
  if (type === "Link") {
    const href = restProps["href"];
    if (typeof href === "string") {
      const decision = sanitizeUrl(href);
      if (decision.ok) {
        restProps["href"] = decision.url;
      } else {
        delete restProps["href"];
        const existingOnClick = restProps.onClick;
        restProps.onClick = (...args: unknown[]) => {
          preventDefaultIfPossible(args[0]);
          console.warn(
            `[kumo-stream] blocked Link href (${decision.reason}): ${href}`,
          );
          if (typeof existingOnClick === "function") {
            existingOnClick(...args);
          }
        };
      }
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
      // Avoid inserting empty grid cells during streaming when child elements
      // haven't arrived yet.
      if (streaming && !elements[childKey]) continue;

      const childNode = (
        <RenderElement
          key={childKey}
          elementKey={childKey}
          elements={elements}
          depth={nextDepth}
          streaming={streaming}
          onAction={onAction}
        />
      );

      if (type === "Grid") {
        renderedChildren.push(
          <GridItem
            key={childKey}
            className={gridItemClassNameForChild(elements[childKey])}
          >
            {childNode}
          </GridItem>,
        );
      } else {
        renderedChildren.push(childNode);
      }
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

function UITreeRendererImpl({
  tree,
  streaming = false,
  onAction,
  runtimeValueStore,
}: UITreeRendererProps): React.JSX.Element | null {
  const normalizedTree = useMemo(
    () => normalizeSiblingFormRowGrids(tree),
    [tree],
  );

  if (
    !normalizedTree.root ||
    Object.keys(normalizedTree.elements).length === 0
  ) {
    return null;
  }

  return (
    <RuntimeValueStoreProvider value={runtimeValueStore ?? null}>
      <RenderElement
        elementKey={normalizedTree.root}
        elements={normalizedTree.elements}
        streaming={streaming}
        onAction={onAction}
      />
    </RuntimeValueStoreProvider>
  );
}

export const UITreeRenderer = memo(UITreeRendererImpl);

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
