import type { ActionDefinition } from "@cloudflare/kumo/catalog";
import { kumoRegistryJson } from "virtual:kumo-registry";

type RegistryComponent = (typeof kumoRegistryJson.components)[string];
type RegistryProp = RegistryComponent["props"][string];

export interface CatalogPropEntry {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
  readonly description: string;
  readonly values: readonly string[];
  readonly defaultValue: string | null;
}

export interface CatalogComponentEntry {
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly importPath: string;
  readonly props: readonly CatalogPropEntry[];
}

export interface CatalogActionParamEntry {
  readonly name: string;
  readonly type: string;
  readonly description: string;
}

export interface CatalogActionEntry {
  readonly name: string;
  readonly description: string;
  readonly params: readonly CatalogActionParamEntry[];
}

const PLAYGROUND_ACTION_DEFINITIONS = {
  increment: {
    description: "Increment a counter display by 1.",
    params: {
      target: {
        type: "string",
        description: "Optional counter element key; defaults to count-display.",
      },
    },
  },
  decrement: {
    description: "Decrement a counter display by 1.",
    params: {
      target: {
        type: "string",
        description: "Optional counter element key; defaults to count-display.",
      },
    },
  },
  reset: {
    description: "Reset a counter display to 0 or a provided value.",
    params: {
      target: {
        type: "string",
        description: "Optional counter element key; defaults to count-display.",
      },
      value: {
        type: "number | string",
        description: "Optional reset target; parsed as an integer.",
      },
    },
  },
  set: {
    description: "Set an allowlisted prop value on a target element.",
    params: {
      target: {
        type: "string",
        description: "Element key to update.",
      },
      path: {
        type: "string",
        description:
          "Allowlisted prop path such as props/value or props/variant.",
      },
      value: {
        type: "unknown",
        description: "Replacement value for the selected prop path.",
      },
    },
  },
  toggle: {
    description: "Flip a boolean allowlisted prop on a target element.",
    params: {
      target: {
        type: "string",
        description: "Element key to update.",
      },
      path: {
        type: "string",
        description: "Allowlisted boolean prop path such as props/checked.",
      },
    },
  },
  submit_form: {
    description:
      "Serialize scoped runtime field values into a chat message payload.",
    params: {
      formKey: {
        type: "string",
        description: "Optional form root key used to scope submitted fields.",
      },
      fieldKeys: {
        type: "string[]",
        description:
          "Optional explicit element keys to include in the submission.",
      },
    },
  },
  navigate: {
    description: "Open an external or internal URL.",
    params: {
      url: {
        type: "string",
        description: "Destination URL.",
      },
      target: {
        type: "string",
        description: "Optional window target such as _self or _blank.",
      },
    },
  },
  tool_approve: {
    description:
      "Approve a tool confirmation card and continue the playground workflow.",
    params: {
      toolId: {
        type: "string",
        description: "The pending tool confirmation identifier.",
      },
    },
  },
  tool_cancel: {
    description: "Cancel a tool confirmation card without executing the tool.",
    params: {
      toolId: {
        type: "string",
        description: "The pending tool confirmation identifier.",
      },
    },
  },
} satisfies Record<string, ActionDefinition>;

function normalizeProp(name: string, prop: RegistryProp): CatalogPropEntry {
  return {
    name,
    type: prop.type,
    required: prop.required === true || prop.optional === false,
    description: prop.description ?? "",
    values: prop.values ?? [],
    defaultValue: prop.default ?? null,
  };
}

function normalizeComponent(
  component: RegistryComponent,
): CatalogComponentEntry {
  return {
    name: component.name,
    description: component.description,
    category: component.category,
    importPath: component.importPath,
    props: Object.entries(component.props)
      .map(([name, prop]) => normalizeProp(name, prop))
      .toSorted((a, b) => a.name.localeCompare(b.name)),
  };
}

function normalizeActionDefinition(
  name: string,
  definition: ActionDefinition,
): CatalogActionEntry {
  return {
    name,
    description: definition.description,
    params: Object.entries(definition.params ?? {})
      .map(([paramName, param]) => ({
        name: paramName,
        type: param.type,
        description: param.description ?? "",
      }))
      .toSorted((a, b) => a.name.localeCompare(b.name)),
  };
}

export const playgroundCatalogComponents: readonly CatalogComponentEntry[] =
  Object.values(kumoRegistryJson.components)
    .map(normalizeComponent)
    .toSorted((a, b) => a.name.localeCompare(b.name));

export const playgroundCatalogCategories: readonly string[] = Object.keys(
  kumoRegistryJson.search.byCategory,
).toSorted((a, b) => a.localeCompare(b));

export const playgroundCatalogActions: readonly CatalogActionEntry[] =
  Object.entries(PLAYGROUND_ACTION_DEFINITIONS)
    .map(([name, definition]) => normalizeActionDefinition(name, definition))
    .toSorted((a, b) => a.name.localeCompare(b.name));
