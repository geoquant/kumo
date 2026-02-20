/**
 * Component map — maps UITree element type strings to React components.
 *
 * This is the bridge between the flat UITree JSON from the LLM and
 * actual Kumo React components. Each entry maps a type name (e.g. "Button")
 * to its React component import from @cloudflare/kumo.
 *
 * We use a deliberately loose type for the map values since this is a
 * dynamic rendering bridge — the LLM generates the props at runtime and
 * we cannot statically verify them. Error boundaries in UITreeRenderer
 * catch any runtime mismatches.
 */

import React, { forwardRef } from "react";
import {
  Badge,
  Banner,
  Breadcrumbs,
  Button,
  ClipboardText,
  CloudflareLogo,
  Cluster,
  Code,
  Empty,
  Field,
  Grid,
  Input,
  InputArea,
  Label,
  Link,
  Loader,
  Meter,
  Radio,
  Stack,
  Surface,
  Table,
  Text,
} from "@cloudflare/kumo";
import { cn } from "@cloudflare/kumo/utils";
import {
  StatefulCheckbox,
  StatefulCollapsible,
  StatefulSelect,
  StatefulSwitch,
  StatefulTabs,
} from "./stateful-wrappers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic rendering bridge
type AnyComponent = React.ComponentType<any>;

/**
 * Surface wrapper that adds default padding and border-radius.
 *
 * The base Surface component ships with no padding or radius by design
 * (consumers add them via className). In generative UI the LLM rarely
 * includes those classes, so we bake in sensible card defaults here.
 */
const GenerativeSurface = forwardRef(function GenerativeSurface(
  props: Record<string, unknown>,
  ref: React.Ref<HTMLDivElement>,
) {
  const { className, ...rest } = props;
  return React.createElement(Surface, {
    ref,
    className: cn("rounded-lg p-6", className as string),
    ...rest,
  });
});
GenerativeSurface.displayName = "GenerativeSurface";

/**
 * Map of UITree type strings -> React components.
 *
 * Keys must match the `type` field in UIElement objects from the LLM.
 * Stateful wrappers replace controlled-only kumo components so LLM-generated
 * UIs are interactive without host state management.
 */
export const COMPONENT_MAP: Record<string, AnyComponent> = {
  // Layout
  Surface: GenerativeSurface as AnyComponent,
  Grid: Grid as AnyComponent,
  Stack: Stack as AnyComponent,
  Cluster: Cluster as AnyComponent,

  // Content
  Text: Text as AnyComponent,
  Badge: Badge as AnyComponent,
  Banner: Banner as AnyComponent,
  Code: Code as AnyComponent,
  Field: Field as AnyComponent,
  Label: Label as AnyComponent,

  // Interactive (stateful wrappers for controlled-only components)
  Button: Button as AnyComponent,
  Input: Input as AnyComponent,
  Checkbox: StatefulCheckbox as AnyComponent,
  Select: StatefulSelect as AnyComponent,
  SelectOption: StatefulSelect.Option as AnyComponent,
  Switch: StatefulSwitch as AnyComponent,
  Tabs: StatefulTabs as AnyComponent,
  Collapsible: StatefulCollapsible as AnyComponent,

  // Interactive (uncontrolled — no wrapper needed)
  RadioGroup: Radio.Group as AnyComponent,
  RadioItem: Radio.Item as AnyComponent,
  Textarea: InputArea as AnyComponent,

  // Data display
  Table: Table as AnyComponent,
  TableHeader: Table.Header as AnyComponent,
  TableHead: Table.Head as AnyComponent,
  TableBody: Table.Body as AnyComponent,
  TableRow: Table.Row as AnyComponent,
  TableCell: Table.Cell as AnyComponent,
  TableFooter: Table.Footer as AnyComponent,
  Meter: Meter as AnyComponent,

  // Navigation
  Link: Link as AnyComponent,
  Breadcrumbs: Breadcrumbs as AnyComponent,
  BreadcrumbsLink: Breadcrumbs.Link as AnyComponent,
  BreadcrumbsCurrent: Breadcrumbs.Current as AnyComponent,
  BreadcrumbsSeparator: Breadcrumbs.Separator as AnyComponent,

  // Action
  ClipboardText: ClipboardText as AnyComponent,

  // Feedback
  Loader: Loader as AnyComponent,
  Empty: Empty as AnyComponent,

  // Brand
  CloudflareLogo: CloudflareLogo as AnyComponent,
};

/** Set of all registered component type names. */
export const KNOWN_TYPES = new Set(Object.keys(COMPONENT_MAP));
