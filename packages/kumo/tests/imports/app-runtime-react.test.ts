import { describe, expect, expectTypeOf, it } from "vitest";

import { useChatUI, useUIStream } from "../../src/app-runtime/react";
import type { AppSpec } from "../../src/app-runtime";
import type { ChatUIMessage } from "../../src/app-runtime/react";

describe("App runtime React exports", () => {
  it("exports the runtime hooks", () => {
    expect(useUIStream).toBeTypeOf("function");
    expect(useChatUI).toBeTypeOf("function");
  });

  it("models assistant messages with optional app specs", () => {
    expectTypeOf<ChatUIMessage["spec"]>().toEqualTypeOf<AppSpec | null>();
  });
});
