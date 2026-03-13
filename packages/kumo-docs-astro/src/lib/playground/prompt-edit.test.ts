import { describe, expect, it } from "vitest";

import { buildPromptEditMessage } from "~/lib/playground/prompt-edit";

describe("buildPromptEditMessage", () => {
  it("builds a basic message with prompt and instruction", () => {
    const result = buildPromptEditMessage({
      currentPrompt: "You are a helpful assistant.",
      instruction: "Make it more concise",
    });

    expect(result).toContain(
      "<current-system-prompt>\nYou are a helpful assistant.\n</current-system-prompt>",
    );
    expect(result).toContain(
      "<instruction>\nMake it more concise\n</instruction>",
    );
    expect(result).not.toContain("<output-context>");
  });

  it("includes output-context with all fields when provided", () => {
    const result = buildPromptEditMessage({
      currentPrompt: "You generate UIs.",
      instruction: "Add error handling guidance",
      outputContext: {
        lastUserPrompt: "Build a login form",
        elementCount: 12,
        treeDepth: 4,
        gradingReport: "Score: 7/10\nMissing: error states",
      },
    });

    expect(result).toContain(
      "<current-system-prompt>\nYou generate UIs.\n</current-system-prompt>",
    );
    expect(result).toContain(
      "<instruction>\nAdd error handling guidance\n</instruction>",
    );
    expect(result).toContain("<output-context>");
    expect(result).toContain(
      "<last-user-prompt>Build a login form</last-user-prompt>",
    );
    expect(result).toContain("<element-count>12</element-count>");
    expect(result).toContain("<tree-depth>4</tree-depth>");
    expect(result).toContain(
      "<grading-report>\nScore: 7/10\nMissing: error states\n</grading-report>",
    );
    expect(result).toContain("</output-context>");
  });

  it("includes output-context with partial fields", () => {
    const result = buildPromptEditMessage({
      currentPrompt: "System prompt text.",
      instruction: "Improve it",
      outputContext: {
        lastUserPrompt: "Show a dashboard",
        elementCount: 8,
      },
    });

    expect(result).toContain("<output-context>");
    expect(result).toContain(
      "<last-user-prompt>Show a dashboard</last-user-prompt>",
    );
    expect(result).toContain("<element-count>8</element-count>");
    expect(result).not.toContain("<tree-depth>");
    expect(result).not.toContain("<grading-report>");
  });

  it("omits output-context section entirely when not provided", () => {
    const result = buildPromptEditMessage({
      currentPrompt: "Prompt.",
      instruction: "Fix it.",
    });

    expect(result).not.toContain("<output-context>");
    expect(result).not.toContain("</output-context>");
  });
});
