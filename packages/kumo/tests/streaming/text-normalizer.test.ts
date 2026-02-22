import { describe, it, expect } from "vitest";

import {
  sanitizePatch,
  sanitizeUnknownText,
  stripLeadingEmojiTokens,
} from "@/streaming/text-normalizer";
import type { JsonPatchOp } from "@/streaming/rfc6902";

describe("stripLeadingEmojiTokens", () => {
  it("strips a single leading emoji token", () => {
    expect(stripLeadingEmojiTokens("⚡ Performance")).toBe("Performance");
  });

  it("strips emoji with variation selector", () => {
    expect(stripLeadingEmojiTokens("🛡️ Security")).toBe("Security");
  });

  it("strips multiple leading emoji tokens", () => {
    expect(stripLeadingEmojiTokens("⚡ 🛡️ 🌐 Reliability")).toBe("Reliability");
  });

  it("leaves strings unchanged when no leading emoji token", () => {
    expect(stripLeadingEmojiTokens("Performance")).toBe("Performance");
  });
});

describe("sanitizeUnknownText", () => {
  it("sanitizes nested objects and arrays", () => {
    const input = {
      props: {
        title: "⚡ Performance",
        items: ["🛡️ Security", { label: "🌐 Reliability" }],
      },
    };

    const out = sanitizeUnknownText(input);
    expect(out).toEqual({
      props: {
        title: "Performance",
        items: ["Security", { label: "Reliability" }],
      },
    });
  });
});

describe("sanitizePatch", () => {
  it("sanitizes add/replace patch values", () => {
    const patch: JsonPatchOp = {
      op: "add",
      path: "/elements/title",
      value: { props: { children: "⚡ Performance" } },
    };

    expect(sanitizePatch(patch)).toEqual({
      op: "add",
      path: "/elements/title",
      value: { props: { children: "Performance" } },
    });
  });

  it("leaves remove patches unchanged", () => {
    const patch: JsonPatchOp = { op: "remove", path: "/elements/x" };
    expect(sanitizePatch(patch)).toBe(patch);
  });
});
