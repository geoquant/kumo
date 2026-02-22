/**
 * Component map — maps UITree element type strings to React components.
 *
 * This is the bridge between the flat UITree JSON from the LLM and
 * actual Kumo React components. Built from the auto-generated manifest
 * (component-manifest.ts) plus hand-written wrappers.
 *
 * We use a deliberately loose type for the map values since this is a
 * dynamic rendering bridge — the LLM generates the props at runtime and
 * we cannot statically verify them. Error boundaries in UITreeRenderer
 * catch any runtime mismatches.
 */

import React from "react";
import * as Kumo from "../index.js";
import {
  DIRECT_COMPONENTS,
  SUB_COMPONENT_ALIASES,
  TYPE_ALIASES,
} from "./component-manifest.js";
import {
  StatefulSelect,
  StatefulCheckbox,
  StatefulSwitch,
  StatefulTabs,
  StatefulCollapsible,
} from "./stateful-wrappers.js";
import {
  GenerativeSurface,
  GenerativeInput,
  GenerativeInputArea,
  GenerativeCloudflareLogo,
  GenerativeSelect,
  GenerativeGrid,
  GenerativeStack,
  GenerativeText,
} from "./generative-wrappers.js";

// Dynamic rendering bridge: LLM-generated props are unknown at compile time
type AnyComponent = React.ComponentType<any>;

/**
 * Kumo export namespace, typed loosely for dynamic access.
 * The namespace star import includes all top-level exports from the package.
 */
const KumoExports = Kumo as unknown as Record<
  string,
  AnyComponent & Record<string, AnyComponent>
>;

// =============================================================================
// Build the map programmatically from manifest + wrappers
// =============================================================================

const map: Record<string, AnyComponent> = {};

// 1. Direct components — 1:1 mapping to Kumo exports
for (const name of DIRECT_COMPONENTS) {
  const component = KumoExports[name];
  if (component) {
    map[name] = component;
  }
}

// 2. Sub-component flattening — e.g. TableHeader → Table.Header
for (const [alias, meta] of Object.entries(SUB_COMPONENT_ALIASES)) {
  const parent = KumoExports[meta.parent];
  if (parent) {
    const sub = parent[meta.sub];
    if (sub) {
      map[alias] = sub;
    }
  }
}

// 3. Type aliases — e.g. Textarea → InputArea
for (const [alias, target] of Object.entries(TYPE_ALIASES)) {
  const component = KumoExports[target];
  if (component) {
    map[alias] = component;
  }
}

// 4. Generative wrappers — override direct mappings with styled defaults
map["Surface"] = GenerativeSurface as AnyComponent;
map["Input"] = GenerativeInput as AnyComponent;
map["Textarea"] = GenerativeInputArea as AnyComponent;
map["InputArea"] = GenerativeInputArea as AnyComponent;
map["CloudflareLogo"] = GenerativeCloudflareLogo as AnyComponent;
map["Select"] = GenerativeSelect as AnyComponent;
map["Grid"] = GenerativeGrid as AnyComponent;
map["Stack"] = GenerativeStack as AnyComponent;
map["Text"] = GenerativeText as AnyComponent;

// 5. Stateful wrappers — controlled-only components get internal state
map["Checkbox"] = StatefulCheckbox as AnyComponent;
map["Switch"] = StatefulSwitch as AnyComponent;
map["Tabs"] = StatefulTabs as AnyComponent;
map["Collapsible"] = StatefulCollapsible as AnyComponent;
map["SelectOption"] = StatefulSelect.Option as AnyComponent;

// 6. Synthetic type: Div — rendered as a plain div container
map["Div"] = "div" as unknown as AnyComponent;

/**
 * Map of UITree type strings → React components.
 *
 * Keys must match the `type` field in UIElement objects from the LLM.
 * Stateful wrappers replace controlled-only Kumo components so LLM-generated
 * UIs are interactive without host state management.
 */
export const COMPONENT_MAP: Readonly<Record<string, AnyComponent>> = map;

/** Set of all registered component type names. */
export const KNOWN_TYPES: ReadonlySet<string> = new Set(
  Object.keys(COMPONENT_MAP),
);
