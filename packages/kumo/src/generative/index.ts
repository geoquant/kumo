/**
 * @cloudflare/kumo/generative — Generative UI rendering module.
 *
 * Maps UITree element types from LLM output to Kumo React components.
 * Includes stateful wrappers for controlled-only components,
 * generative wrappers with sensible styling defaults, element validation,
 * and the UITreeRenderer for rendering UITree structures.
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
  ALL_GENERATIVE_TYPES,
  DIRECT_COMPONENTS,
  SUB_COMPONENT_ALIASES,
  TYPE_ALIASES,
  STATEFUL_WRAPPER_TARGETS,
  GENERATIVE_WRAPPER_TARGETS,
  SYNTHETIC_TYPES,
  EXCLUDED_COMPONENTS,
  REGISTRY_COMPONENT_NAMES,
} from "./component-manifest.js";

// Element validator
export { validateElement, logValidationError } from "./element-validator.js";

export type { ElementValidationResult } from "./element-validator.js";

// Graders — re-exported for backward compatibility. New consumers should
// import from "@cloudflare/kumo/generative/graders" to keep the main
// generative bundle lean (graders add ~500 lines the renderer doesn't need).
export {
  parseJsonlToTree,
  walkTree,
  gradeTree,
  A11Y_LABEL_TYPES,
  MAX_DEPTH,
  RULE_NAMES,
  gradeComposition,
  COMPOSITION_RULE_NAMES,
  EVAL_PROMPTS,
} from "./graders.js";

export type {
  WalkVisitor,
  GradeResult,
  GradeReport,
  GradeOptions,
  RuleName,
  CompositionRuleName,
  EvalPrompt,
} from "./graders.js";

// Custom component helper
export { defineCustomComponent } from "./define-custom-component.js";

// UITreeRenderer
export {
  UITreeRenderer,
  isRenderableTree,
  getUnknownTypes,
  normalizeTree,
  normalizeSiblingFormRowGrids,
} from "./ui-tree-renderer.js";

// UITree → JSX converter
export { uiTreeToJsx } from "./ui-tree-to-jsx.js";
export type { UiTreeToJsxOptions } from "./ui-tree-to-jsx.js";
