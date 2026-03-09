import type {
  ComponentBehaviorEvent,
  ComponentBehaviorManifest,
  ComponentBehaviorSchema,
  ComponentBehaviorValidationHints,
  LayoutRole,
} from "./types.js";
import { COMPONENT_BEHAVIOR_OVERLAY } from "./metadata.js";
import {
  EXCLUDED_COMPONENTS,
  getWrapperKind,
} from "./generative-map-generator.js";

interface BehaviorPropSource {
  required?: boolean;
  type?: string;
  values?: readonly string[];
}

interface BehaviorEntrySource {
  type: string;
  category: string;
  props: Readonly<Record<string, BehaviorPropSource>>;
  subComponents?: Readonly<Record<string, unknown>>;
}

interface BehaviorRegistrySource {
  version: string;
  components: Readonly<Record<string, BehaviorEntrySource>>;
  blocks?: Readonly<Record<string, BehaviorEntrySource>>;
}

const COMMON_BINDABLE_PROPS = ["value", "checked", "open"] as const;

const INFERRED_BINDING_EVENTS: Readonly<Record<string, string>> = {
  checked: "onCheckedChange",
  open: "onOpenChange",
  value: "onValueChange",
};

const SPECIAL_LAYOUT_ROLES: Record<string, LayoutRole> = {
  Breadcrumbs: "navigation",
  ClipboardText: "action",
  CloudflareLogo: "brand",
  Cluster: "layout",
  Div: "layout",
  Grid: "layout",
  Link: "navigation",
  Meter: "data-display",
  Stack: "layout",
  Surface: "layout",
  Table: "data-display",
  Text: "content",
  TimeseriesChart: "data-display",
};

function groupToLayoutRole(name: string, category: string): LayoutRole {
  const specialRole = SPECIAL_LAYOUT_ROLES[name];
  if (specialRole != null) {
    return specialRole;
  }

  switch (category) {
    case "Action":
      return "action";
    case "Display":
      return "content";
    case "Feedback":
      return "feedback";
    case "Input":
      return "input";
    case "Layout":
      return "layout";
    case "Navigation":
      return "navigation";
    default:
      return "other";
  }
}

function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

function inferEventPayload(propName: string): string {
  if (propName === "onChange") {
    return "event";
  }
  if (propName.endsWith("ValueChange")) {
    return "value";
  }
  if (propName.endsWith("CheckedChange")) {
    return "checked";
  }
  if (propName.endsWith("OpenChange")) {
    return "open";
  }
  if (propName.endsWith("Click")) {
    return "event";
  }
  return "event";
}

function inferEventName(propName: string): string {
  return toKebabCase(propName.replace(/^on/, ""));
}

function buildEventMap(
  props: Readonly<Record<string, BehaviorPropSource>>,
  overlayEvents: readonly ComponentBehaviorEvent[] | undefined,
): Map<string, ComponentBehaviorEvent> {
  const events = new Map<string, ComponentBehaviorEvent>();

  for (const propName of Object.keys(props)) {
    if (!propName.startsWith("on") || propName.length <= 2) {
      continue;
    }
    events.set(propName, {
      prop: propName,
      event: inferEventName(propName),
      payload: inferEventPayload(propName),
    });
  }

  for (const event of overlayEvents ?? []) {
    events.set(event.prop, event);
  }

  return events;
}

function collectBindableProps(
  name: string,
  props: Readonly<Record<string, BehaviorPropSource>>,
): string[] {
  const bindable = new Set<string>(
    COMPONENT_BEHAVIOR_OVERLAY[name]?.bindableProps,
  );

  for (const propName of COMMON_BINDABLE_PROPS) {
    const matchingEvent = INFERRED_BINDING_EVENTS[propName];
    if (propName in props && matchingEvent in props) {
      bindable.add(propName);
    }
  }

  return Array.from(bindable).toSorted((a, b) => a.localeCompare(b));
}

function buildValidationHints(
  name: string,
  schema: BehaviorEntrySource,
): ComponentBehaviorValidationHints {
  const requiredProps = new Set<string>(
    COMPONENT_BEHAVIOR_OVERLAY[name]?.requiredProps,
  );

  const enumProps: Record<string, readonly string[]> = {};
  let acceptsChildren =
    "children" in schema.props || schema.subComponents != null;

  const overlayAcceptsChildren =
    COMPONENT_BEHAVIOR_OVERLAY[name]?.acceptsChildren;
  if (overlayAcceptsChildren != null) {
    acceptsChildren = overlayAcceptsChildren;
  }

  for (const propName of Object.keys(schema.props)) {
    const prop = schema.props[propName];
    if (prop.required) {
      requiredProps.add(propName);
    }
    if (prop.values != null && prop.values.length > 0) {
      enumProps[propName] = prop.values;
    }
  }

  return {
    requiredProps: Array.from(requiredProps).toSorted((a, b) =>
      a.localeCompare(b),
    ),
    enumProps: Object.fromEntries(
      Object.entries(enumProps).toSorted(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
    acceptsChildren,
  };
}

function buildBehaviorEntry(
  name: string,
  schema: BehaviorEntrySource,
): ComponentBehaviorSchema {
  const excludedReason = EXCLUDED_COMPONENTS[name];
  const overlay = COMPONENT_BEHAVIOR_OVERLAY[name];
  const emittedEvents = Array.from(
    buildEventMap(schema.props, overlay?.emittedEvents).values(),
  ).toSorted((left, right) => left.prop.localeCompare(right.prop));

  return {
    name,
    type: schema.type === "block" ? "block" : "component",
    generativeSupport:
      excludedReason == null
        ? { status: "supported" }
        : { status: "excluded", reason: excludedReason },
    layoutRole: overlay?.layoutRole ?? groupToLayoutRole(name, schema.category),
    bindableProps: collectBindableProps(name, schema.props),
    emittedEvents,
    wrapperKind: getWrapperKind(name),
    validation: buildValidationHints(name, schema),
  };
}

function buildBehaviorTable(
  entries: Readonly<Record<string, BehaviorEntrySource>>,
): Record<string, ComponentBehaviorSchema> {
  return Object.fromEntries(
    Object.entries(entries)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([name, schema]) => [name, buildBehaviorEntry(name, schema)]),
  );
}

export function generateComponentBehaviorManifest(
  registry: BehaviorRegistrySource,
): ComponentBehaviorManifest {
  const blocks =
    registry.blocks == null ? undefined : buildBehaviorTable(registry.blocks);

  return {
    version: registry.version,
    components: buildBehaviorTable(registry.components),
    ...(blocks == null ? {} : { blocks }),
  };
}
