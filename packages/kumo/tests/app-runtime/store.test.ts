import { describe, expect, it } from "vitest";

import { createAppStore } from "../../src/app-runtime";

describe("app runtime store", () => {
  it("updates nested state immutably", () => {
    const store = createAppStore({
      state: {
        form: {
          title: "Initial",
        },
      },
    });

    const before = store.getSnapshot();
    store.setValue("/form/title", "Updated");
    const after = store.getSnapshot();

    expect(before.state).toEqual({
      form: {
        title: "Initial",
      },
    });
    expect(after.state).toEqual({
      form: {
        title: "Updated",
      },
    });
  });

  it("tracks validation state separately from app state", () => {
    const store = createAppStore();
    store.setValidationState("/form/title", {
      valid: false,
      touched: true,
      dirty: true,
      errors: ["Required"],
    });

    const snapshot = store.getSnapshot();
    expect(snapshot.state).toEqual({});
    expect(snapshot.meta.validation).toEqual({
      "/form/title": {
        valid: false,
        touched: true,
        dirty: true,
        errors: ["Required"],
      },
    });

    store.clearValidationState(["/form/title"]);
    expect(store.getSnapshot().meta.validation).toEqual({});
  });
});
