import { describe, expect, it } from "vitest";

import {
  APP_SPEC_VERSION,
  createAppStore,
  validateFieldsForMode,
} from "../../src/app-runtime";
import type { AppSpec } from "../../src/app-runtime";

describe("app runtime validation", () => {
  it("runs field validation only for the requested mode", () => {
    const spec: AppSpec = {
      version: APP_SPEC_VERSION,
      root: "root",
      state: {},
      elements: {
        root: { key: "root", type: "Form", children: ["title", "email"] },
        title: {
          key: "title",
          type: "Input",
          validation: {
            path: "/form/title",
            mode: ["change"],
            rules: [{ type: "minLength", value: 3, message: "Too short" }],
          },
        },
        email: {
          key: "email",
          type: "Input",
          validation: {
            path: "/form/email",
            mode: ["blur"],
            rules: [{ type: "email", message: "Bad email" }],
          },
        },
      },
    };

    const store = createAppStore({
      state: {
        form: { title: "Hi", email: "bad" },
      },
    });

    const changeResult = validateFieldsForMode(spec, store, "change");
    expect(changeResult.valid).toBe(false);
    expect(changeResult.fields).toEqual({
      "/form/title": {
        valid: false,
        touched: true,
        dirty: true,
        errors: ["Too short"],
      },
    });

    const blurResult = validateFieldsForMode(spec, store, "blur");
    expect(blurResult.fields).toEqual({
      "/form/email": {
        valid: false,
        touched: true,
        dirty: true,
        errors: ["Bad email"],
      },
    });
  });

  it("supports submit-time matching and custom validators", () => {
    const spec: AppSpec = {
      version: APP_SPEC_VERSION,
      root: "root",
      state: {},
      elements: {
        root: { key: "root", type: "Form", children: ["password", "confirm"] },
        password: {
          key: "password",
          type: "Input",
          validation: {
            path: "/form/password",
            mode: ["submit"],
            rules: [
              { type: "required", message: "Password required" },
              {
                type: "custom",
                fn: "contains-number",
                message: "Needs number",
              },
            ],
          },
        },
        confirm: {
          key: "confirm",
          type: "Input",
          validation: {
            path: "/form/confirm",
            mode: ["submit"],
            rules: [
              {
                type: "matches",
                other: { $read: { source: "state", path: "/form/password" } },
                message: "Passwords differ",
              },
            ],
          },
        },
      },
    };

    const store = createAppStore({
      state: {
        form: { password: "abc", confirm: "xyz" },
      },
    });

    const result = validateFieldsForMode(spec, store, "submit", {
      validators: {
        "contains-number": (value) =>
          typeof value === "string" && /\d/.test(value),
      },
    });

    expect(result.failures).toEqual([
      {
        elementKey: "password",
        path: "/form/password",
        message: "Needs number",
      },
      {
        elementKey: "confirm",
        path: "/form/confirm",
        message: "Passwords differ",
      },
    ]);
  });
});
