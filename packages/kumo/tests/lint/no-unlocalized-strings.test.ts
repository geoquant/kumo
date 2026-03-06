import { describe, expect, it } from "vitest";
import {
  isConsumerSurfaceFile,
  isTextBearingAttributeName,
} from "../../lint/no-unlocalized-strings.js";

describe("no-unlocalized-strings scope", () => {
  it("includes consumer components", () => {
    expect(
      isConsumerSurfaceFile(
        "/repo/packages/kumo/src/components/button/button.tsx",
      ),
    ).toBe(true);
  });

  it("includes installable blocks", () => {
    expect(
      isConsumerSurfaceFile(
        "/repo/packages/kumo/src/blocks/delete-resource/delete-resource.tsx",
      ),
    ).toBe(true);
  });

  it("includes code entrypoint components", () => {
    expect(
      isConsumerSurfaceFile(
        "/repo/packages/kumo/src/code/code-highlighted.tsx",
      ),
    ).toBe(true);
  });

  it("excludes non-consumer surfaces", () => {
    expect(
      isConsumerSurfaceFile(
        "/repo/packages/kumo/src/command-line/commands/add.ts",
      ),
    ).toBe(false);
  });

  it("excludes tests and stories", () => {
    expect(
      isConsumerSurfaceFile(
        "/repo/packages/kumo/src/components/button/button.test.tsx",
      ),
    ).toBe(false);
    expect(
      isConsumerSurfaceFile(
        "/repo/packages/kumo/src/components/button/button.stories.tsx",
      ),
    ).toBe(false);
  });
});

describe("no-unlocalized-strings attribute detection", () => {
  it("includes clear text-bearing attributes", () => {
    expect(isTextBearingAttributeName("aria-label")).toBe(true);
    expect(isTextBearingAttributeName("label")).toBe(true);
    expect(isTextBearingAttributeName("helperText")).toBe(true);
  });

  it("excludes non-text structural attributes", () => {
    expect(isTextBearingAttributeName("className")).toBe(false);
    expect(isTextBearingAttributeName("aria-hidden")).toBe(false);
    expect(isTextBearingAttributeName("aria-labelledby")).toBe(false);
    expect(isTextBearingAttributeName("data-testid")).toBe(false);
    expect(isTextBearingAttributeName("onClick")).toBe(false);
  });
});
