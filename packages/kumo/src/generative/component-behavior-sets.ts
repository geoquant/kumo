import behaviorJson from "../../ai/component-behavior.json";
import { TYPE_ALIASES } from "./component-manifest.js";

interface BehaviorEntry {
  readonly bindableProps: readonly string[];
  readonly layoutRole: string;
  readonly wrapperKind: string;
}

interface BehaviorManifest {
  readonly components: Readonly<Record<string, BehaviorEntry>>;
}

const behaviorManifest: BehaviorManifest = behaviorJson;

function withAliases(base: ReadonlySet<string>): ReadonlySet<string> {
  const next = new Set(base);

  for (const [alias, target] of Object.entries(TYPE_ALIASES)) {
    if (base.has(target)) {
      next.add(alias);
    }
  }

  return next;
}

export const ONCLICK_ACTION_TYPES: ReadonlySet<string> = new Set([
  "Button",
  "Link",
]);

export const RUNTIME_VALUE_CAPTURE_TYPES: ReadonlySet<string> = withAliases(
  new Set(
    Object.entries(behaviorManifest.components)
      .filter(
        ([, entry]) =>
          entry.bindableProps.includes("value") &&
          (entry.wrapperKind === "none" || entry.wrapperKind === "generative"),
      )
      .map(([name]) => name),
  ),
);

export const FORM_CONTROL_TYPES: ReadonlySet<string> = withAliases(
  new Set(
    Object.entries(behaviorManifest.components)
      .filter(([, entry]) => entry.layoutRole === "input")
      .map(([name]) => name),
  ),
);

export const CHECKABLE_TYPES: ReadonlySet<string> = withAliases(
  new Set([
    ...Object.entries(behaviorManifest.components)
      .filter(([, entry]) => entry.bindableProps.includes("checked"))
      .map(([name]) => name),
    "Radio",
    "RadioGroup",
  ]),
);
