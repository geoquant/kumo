import { describe, expect, it } from "vitest";
import {
  getAvailableComponentsSection,
  getPromptSupportedTypes,
} from "../core/system-prompt-components";

describe("system prompt component section", () => {
  it("is deterministic", () => {
    const a = getAvailableComponentsSection();
    const b = getAvailableComponentsSection();
    expect(a).toBe(b);
  });

  it("lists only kumo-stream supported types", () => {
    const section = getAvailableComponentsSection();

    for (const type of getPromptSupportedTypes()) {
      expect(section).toContain(`**${type}**`);
    }

    // A few known registry components kumo-stream does not support (should not be advertised).
    expect(section).not.toContain("**Dialog**");
    expect(section).not.toContain("**Tooltip**");
    expect(section).not.toContain("**Popover**");
  });
});
