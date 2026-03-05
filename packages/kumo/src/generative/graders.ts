/**
 * @cloudflare/kumo/generative/graders — Structural and composition grading.
 *
 * Separated from the main generative entry point so consumers that only
 * need UITreeRenderer (the common case) don't pay the bundle cost of
 * grading logic (~500 lines). Only the docs playground and eval harness
 * import this module.
 */

// Structural graders
export {
  parseJsonlToTree,
  walkTree,
  gradeTree,
  A11Y_LABEL_TYPES,
  MAX_DEPTH,
  RULE_NAMES,
} from "./structural-graders.js";

export type {
  WalkVisitor,
  GradeResult,
  GradeReport,
  GradeOptions,
  RuleName,
} from "./structural-graders.js";

// Composition graders
export {
  gradeComposition,
  COMPOSITION_RULE_NAMES,
} from "./composition-graders.js";

export type { CompositionRuleName } from "./composition-graders.js";

// Eval prompts
export { EVAL_PROMPTS } from "./eval/eval-prompts.js";
export type { EvalPrompt } from "./eval/eval-prompts.js";
