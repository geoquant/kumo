export interface GenerativeUIManifest {
  readonly version: "1.0.0";
  readonly kumoVersion: string;
  readonly paths: {
    readonly umdBundle: string;
    readonly stylesheet: string;
    readonly componentRegistry: string;
  };
  readonly streaming: {
    readonly endpoint: string;
    readonly format: "sse";
    readonly wireFormat: "jsonl";
    readonly patchFormat: "rfc6902";
  };
  readonly capabilities: {
    readonly actions: {
      readonly emittedEvent: "kumo-action";
      readonly builtins: readonly string[];
    };
    readonly submitForm: {
      readonly defaults: {
        readonly include: "touched-only";
        readonly fieldTypes: readonly string[];
      };
      readonly scoping: {
        readonly byFormKey: string;
        readonly byFieldKeys: string;
      };
      readonly guardrails: {
        readonly ambiguousMultipleSubmit: "none";
      };
    };
    readonly urlPolicy: {
      readonly allowed: readonly string[];
      readonly blocked: readonly string[];
      readonly notes: string;
    };
    readonly patch: {
      readonly standard: "rfc6902";
      readonly ops: readonly ("add" | "replace" | "remove")[];
      readonly arraySemantics: {
        readonly appendWithDash: string;
      };
    };
    readonly rendering: {
      readonly modes: readonly ("streaming" | "full")[];
      readonly notes: string;
    };
    readonly valueCapture: {
      readonly uncontrolledInputs: boolean;
      readonly touchedTracking: boolean;
      readonly notes: string;
    };
  };
}

const SUBMIT_FORM_FIELD_TYPES: readonly string[] = [
  "Input",
  "Textarea",
  "InputArea",
  "Select",
  "Checkbox",
  "Switch",
  "Radio",
];

const BUILTIN_ACTIONS: readonly string[] = [
  "increment",
  "decrement",
  "submit_form",
  "navigate",
];

export function buildGenerativeUiManifest(input: {
  readonly kumoVersion: string;
}): GenerativeUIManifest {
  return {
    version: "1.0.0",
    kumoVersion: input.kumoVersion,
    paths: {
      umdBundle: "/.well-known/component-loadable.umd.js",
      stylesheet: "/.well-known/stylesheet.css",
      componentRegistry: "/.well-known/component-registry.json",
    },
    streaming: {
      endpoint: "/api/chat",
      format: "sse",
      wireFormat: "jsonl",
      patchFormat: "rfc6902",
    },
    capabilities: {
      actions: {
        emittedEvent: "kumo-action",
        builtins: BUILTIN_ACTIONS,
      },
      submitForm: {
        defaults: {
          include: "touched-only",
          fieldTypes: SUBMIT_FORM_FIELD_TYPES,
        },
        scoping: {
          byFormKey:
            "If params.formKey is set, include only descendant element keys under that subtree.",
          byFieldKeys:
            "If params.fieldKeys is set, include only those element keys.",
        },
        guardrails: {
          ambiguousMultipleSubmit: "none",
        },
      },
      urlPolicy: {
        allowed: ["http", "https", "relative"],
        blocked: ["javascript", "data", "file", "protocol-relative"],
        notes:
          "navigate actions and Link hrefs are sanitized; blocked URLs do not trigger navigation and are logged.",
      },
      patch: {
        standard: "rfc6902",
        ops: ["add", "replace", "remove"],
        arraySemantics: {
          appendWithDash:
            "Using '/-' at the end of a path appends to an array (e.g. /elements/{key}/children/-).",
        },
      },
      rendering: {
        modes: ["streaming", "full"],
        notes:
          "Streaming mode applies JSONL RFC6902 ops incrementally; full mode replaces the entire UITree via renderTree().",
      },
      valueCapture: {
        uncontrolledInputs: true,
        touchedTracking: true,
        notes:
          "Input/Textarea values are captured at runtime without making components controlled; submit_form merges static params with touched-only runtime values.",
      },
    },
  };
}
