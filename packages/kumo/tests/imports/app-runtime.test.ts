import { describe, expect, expectTypeOf, it } from "vitest";

import { APP_SPEC_VERSION } from "../../src/app-runtime";
import type {
  AppSpec,
  CompatibleUITree,
  ValueExpr,
} from "../../src/app-runtime";
import type { UITree } from "../../src/catalog";

describe("App runtime exports", () => {
  it("exports the app spec version marker", () => {
    expect(APP_SPEC_VERSION).toBe("app/v1");
  });

  it("keeps a compatibility alias for legacy trees", () => {
    expectTypeOf<CompatibleUITree>().toEqualTypeOf<UITree>();
  });

  it("models AppSpec props with value expressions", () => {
    type AppSpecProps = NonNullable<AppSpec["elements"][string]["props"]>;
    expectTypeOf<AppSpecProps>().toEqualTypeOf<Record<string, ValueExpr>>();
  });
});
