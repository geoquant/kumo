/**
 * @cloudflare/kumo/generative — Generative UI rendering module.
 *
 * Maps UITree element types from LLM output to Kumo React components.
 * Includes stateful wrappers for controlled-only components and
 * generative wrappers with sensible styling defaults.
 */

export { COMPONENT_MAP, KNOWN_TYPES } from "./component-map.js";

export {
  StatefulSelect,
  StatefulCheckbox,
  StatefulSwitch,
  StatefulTabs,
  StatefulCollapsible,
} from "./stateful-wrappers.js";

export type { OnActionCallback } from "./stateful-wrappers.js";

export {
  GenerativeSurface,
  GenerativeInput,
  GenerativeInputArea,
  GenerativeCloudflareLogo,
  GenerativeSelect,
} from "./generative-wrappers.js";

export {
  DIRECT_COMPONENTS,
  SUB_COMPONENT_ALIASES,
  TYPE_ALIASES,
  STATEFUL_WRAPPER_TARGETS,
  GENERATIVE_WRAPPER_TARGETS,
  SYNTHETIC_TYPES,
  EXCLUDED_COMPONENTS,
  REGISTRY_COMPONENT_NAMES,
} from "./component-manifest.js";
