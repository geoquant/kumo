import { describe, it, expect } from "vitest";

import { buildGenerativeUiManifest } from "../core/generative-ui-manifest";

describe("buildGenerativeUiManifest", () => {
  it("includes capabilities and stable paths", () => {
    const m = buildGenerativeUiManifest({ kumoVersion: "0.0.0-test" });

    expect(m.version).toBe("1.0.0");
    expect(m.kumoVersion).toBe("0.0.0-test");

    expect(m.paths).toEqual({
      umdBundle: "/.well-known/component-loadable.umd.js",
      stylesheet: "/.well-known/stylesheet.css",
      componentRegistry: "/.well-known/component-registry.json",
    });

    expect(m.capabilities.actions.emittedEvent).toBe("kumo-action");
    expect(m.capabilities.actions.builtins).toContain("submit_form");

    expect(m.capabilities.submitForm.defaults.include).toBe("touched-only");
    expect(m.capabilities.urlPolicy.allowed).toContain("https");
    expect(m.capabilities.patch.ops).toEqual(["add", "replace", "remove"]);
    expect(m.capabilities.rendering.modes).toEqual(["streaming", "full"]);
  });

  it("is deterministic for a given input", () => {
    const a = buildGenerativeUiManifest({ kumoVersion: "1.2.3" });
    const b = buildGenerativeUiManifest({ kumoVersion: "1.2.3" });

    expect(a).toEqual(b);
  });
});
