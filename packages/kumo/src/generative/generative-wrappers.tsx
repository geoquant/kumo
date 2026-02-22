/**
 * Generative UI wrappers — default styling/behavior for LLM-generated components.
 *
 * These wrappers apply sensible defaults that LLMs typically omit:
 * - Surface: rounded corners and padding (card-like appearance)
 * - Input/InputArea: full-width by default
 * - CloudflareLogo: default dimensions when not specified
 * - Select: visible label by default
 * - Grid: defaults variant="2up" (when no variant/columns) and gap="base"
 * - Stack: defaults gap="base" (16px vertical rhythm)
 * - Text: defaults variant="body"
 */

import React, { forwardRef } from "react";
import {
  CloudflareLogo,
  Grid,
  Input,
  InputArea,
  Stack,
  Surface,
  Text,
} from "../index.js";
import { cn } from "../utils/index.js";
import { StatefulSelect } from "./stateful-wrappers.js";

// =============================================================================
// Helpers
// =============================================================================

function readClassName(props: Record<string, unknown>): string | undefined {
  const value = props["className"];
  return typeof value === "string" ? value : undefined;
}

function stripClassName(
  props: Record<string, unknown>,
): Record<string, unknown> {
  const { className: _, ...rest } = props;
  return rest;
}

// =============================================================================
// GenerativeSurface
// =============================================================================

/**
 * Surface wrapper that adds default padding and border-radius.
 *
 * The base Surface component ships with no padding or radius by design
 * (consumers add them via className). In generative UI the LLM rarely
 * includes those classes, so we bake in sensible card defaults here.
 */
export const GenerativeSurface = forwardRef<
  HTMLDivElement,
  Record<string, unknown>
>(function GenerativeSurface(props, ref) {
  const { className, ...rest } = props;
  return React.createElement(Surface, {
    ref,
    className: cn("rounded-lg p-6", className as string),
    ...rest,
  });
});
GenerativeSurface.displayName = "GenerativeSurface";

// =============================================================================
// GenerativeInput
// =============================================================================

export const GenerativeInput = forwardRef<
  HTMLInputElement,
  Record<string, unknown>
>(function GenerativeInput(props, ref) {
  return React.createElement(Input, {
    ref,
    className: cn("w-full", readClassName(props)),
    ...stripClassName(props),
  });
});
GenerativeInput.displayName = "GenerativeInput";

// =============================================================================
// GenerativeInputArea
// =============================================================================

export const GenerativeInputArea = forwardRef<
  HTMLTextAreaElement,
  Record<string, unknown>
>(function GenerativeInputArea(props, ref) {
  return React.createElement(InputArea, {
    ref,
    className: cn("w-full", readClassName(props)),
    ...stripClassName(props),
  });
});
GenerativeInputArea.displayName = "GenerativeInputArea";

// =============================================================================
// GenerativeCloudflareLogo
// =============================================================================

export const GenerativeCloudflareLogo = forwardRef<
  SVGSVGElement,
  Record<string, unknown>
>(function GenerativeCloudflareLogo(props, ref) {
  const variant = props["variant"];
  const isGlyph = variant === "glyph";

  const width = props["width"];
  const height = props["height"];
  const hasWidth = typeof width === "number" || typeof width === "string";
  const hasHeight = typeof height === "number" || typeof height === "string";

  const defaultSizeProps: Record<string, unknown> =
    hasWidth || hasHeight
      ? {}
      : isGlyph
        ? { width: 72, height: 32 }
        : { width: 180, height: 60 };

  return React.createElement(CloudflareLogo, {
    ref,
    className: cn(readClassName(props)),
    ...defaultSizeProps,
    ...stripClassName(props),
  });
});
GenerativeCloudflareLogo.displayName = "GenerativeCloudflareLogo";

// =============================================================================
// GenerativeGrid
// =============================================================================

/**
 * Grid wrapper that defaults `variant` and `gap` when the LLM omits them.
 *
 * Without a variant the Grid renders a single-column stack (useless).
 * Defaults `variant="2up"` only when BOTH `variant` AND `columns` are missing
 * so that an explicit `columns` prop is never overridden.
 */
export const GenerativeGrid = forwardRef<
  HTMLDivElement,
  Record<string, unknown>
>(function GenerativeGrid(props, ref) {
  const variant = props["variant"];
  const columns = props["columns"];
  const gap = props["gap"];

  const defaults: Record<string, unknown> = {};

  if (variant == null && columns == null) {
    defaults["variant"] = "2up";
  }
  if (gap == null) {
    defaults["gap"] = "base";
  }

  return React.createElement(Grid, {
    ref,
    className: cn(readClassName(props)),
    ...defaults,
    ...stripClassName(props),
  });
});
GenerativeGrid.displayName = "GenerativeGrid";

// =============================================================================
// GenerativeStack
// =============================================================================

/**
 * Stack wrapper that defaults `gap` when the LLM omits it.
 *
 * Without a gap value, Stack items collapse with no spacing. Defaulting
 * to `"base"` (16px) provides a reasonable vertical rhythm.
 */
export const GenerativeStack = forwardRef<
  HTMLDivElement,
  Record<string, unknown>
>(function GenerativeStack(props, ref) {
  const gap = props["gap"];

  const defaults: Record<string, unknown> = {};

  if (gap == null) {
    defaults["gap"] = "base";
  }

  return React.createElement(Stack, {
    ref,
    className: cn(readClassName(props)),
    ...defaults,
    ...stripClassName(props),
  });
});
GenerativeStack.displayName = "GenerativeStack";

// =============================================================================
// GenerativeText
// =============================================================================

/**
 * Text wrapper that defaults `variant` when the LLM omits it.
 *
 * Without a variant the Text component uses its own default, but being
 * explicit about `"body"` ensures consistent rendering when the LLM
 * generates Text elements without specifying a style.
 *
 * Note: Text uses `DANGEROUS_className` not `className`, so we skip
 * the className merge pattern used by other generative wrappers.
 */
export const GenerativeText = forwardRef<
  HTMLSpanElement,
  Record<string, unknown>
>(function GenerativeText(props, ref) {
  const variant = props["variant"];

  const defaults: Record<string, unknown> = {};

  if (variant == null) {
    defaults["variant"] = "body";
  }

  return React.createElement(
    Text as React.ComponentType<Record<string, unknown>>,
    {
      ref,
      ...defaults,
      ...props,
    },
  );
});
GenerativeText.displayName = "GenerativeText";

// =============================================================================
// GenerativeSelect
// =============================================================================

/**
 * Select wrapper that defaults hideLabel to false when a label is provided.
 *
 * Kumo Select defaults `hideLabel=true` (sr-only). In generative forms,
 * the model typically provides `label` but not `hideLabel`, which makes
 * fields look unlabeled and breaks layout expectations.
 */
export function GenerativeSelect(
  props: Record<string, unknown>,
): React.JSX.Element {
  const passthrough = stripClassName(props);
  const label = passthrough["label"];
  const hideLabel = passthrough["hideLabel"];

  const shouldDefaultShowLabel =
    label != null && typeof hideLabel !== "boolean";

  return React.createElement(StatefulSelect, {
    className: cn("w-full", readClassName(props)),
    ...passthrough,
    ...(shouldDefaultShowLabel ? { hideLabel: false } : null),
  });
}
GenerativeSelect.displayName = "GenerativeSelect";
