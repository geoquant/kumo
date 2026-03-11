import { describe, expect, it } from "vitest";

import { addPlaygroundPromptSupplement } from "~/lib/playground";

describe("playground prompt supplement", () => {
  it("removes the default 30 element cap for playground requests", () => {
    const result = addPlaygroundPromptSupplement("Base prompt");

    expect(result).toContain("Playground Overrides");
    expect(result).toContain(
      "does not use the default 30-element response cap",
    );
    expect(result).toContain("Do not limit responses to 30 elements");
  });
});
