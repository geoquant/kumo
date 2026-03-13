/**
 * Builds the user message for the AI prompt editor.
 *
 * Wraps the current system prompt and editing instruction in XML tags that
 * align with the `PROMPT_EDITOR_SYSTEM_PROMPT` system prompt expectations.
 * Optionally includes output context so the AI understands what the current
 * prompt produces.
 */

export interface OutputContext {
  readonly lastUserPrompt?: string;
  readonly elementCount?: number;
  readonly treeDepth?: number;
  readonly gradingReport?: string;
}

export interface BuildPromptEditMessageOptions {
  readonly currentPrompt: string;
  readonly instruction: string;
  readonly outputContext?: OutputContext;
}

export function buildPromptEditMessage({
  currentPrompt,
  instruction,
  outputContext,
}: BuildPromptEditMessageOptions): string {
  const parts: string[] = [
    `<current-system-prompt>\n${currentPrompt}\n</current-system-prompt>`,
    `<instruction>\n${instruction}\n</instruction>`,
  ];

  if (outputContext) {
    const contextLines: string[] = [];

    if (outputContext.lastUserPrompt !== undefined) {
      contextLines.push(
        `<last-user-prompt>${outputContext.lastUserPrompt}</last-user-prompt>`,
      );
    }
    if (outputContext.elementCount !== undefined) {
      contextLines.push(
        `<element-count>${String(outputContext.elementCount)}</element-count>`,
      );
    }
    if (outputContext.treeDepth !== undefined) {
      contextLines.push(
        `<tree-depth>${String(outputContext.treeDepth)}</tree-depth>`,
      );
    }
    if (outputContext.gradingReport !== undefined) {
      contextLines.push(
        `<grading-report>\n${outputContext.gradingReport}\n</grading-report>`,
      );
    }

    if (contextLines.length > 0) {
      parts.push(
        `<output-context>\n${contextLines.join("\n")}\n</output-context>`,
      );
    }
  }

  return parts.join("\n\n");
}
