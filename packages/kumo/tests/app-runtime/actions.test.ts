import { describe, expect, it } from "vitest";

import { createAppStore, executeActionSequence } from "../../src/app-runtime";

describe("app runtime actions", () => {
  it("executes event maps sequentially against the latest store snapshot", () => {
    const store = createAppStore({
      state: {
        counter: 1,
        tasks: ["alpha"],
      },
    });

    const result = executeActionSequence(
      [
        {
          action: "state.increment",
          params: {
            path: "/counter",
            by: 2,
          },
        },
        {
          action: "list.append",
          params: {
            path: "/tasks",
            value: {
              $format: [
                "task-",
                { $read: { source: "state", path: "/counter" } },
              ],
            },
          },
        },
      ],
      { store },
    );

    expect(result.executed).toEqual(["state.increment", "list.append"]);
    expect(store.getSnapshot().state).toEqual({
      counter: 3,
      tasks: ["alpha", "task-3"],
    });
  });

  it("mutates state and validation meta for built-in form actions", () => {
    const store = createAppStore({
      state: {
        form: {
          title: "Needs cleanup",
          notes: "keep",
        },
      },
    });

    executeActionSequence(
      [
        {
          action: "form.validate",
          params: {
            paths: ["/form/title", "/form/notes"],
          },
        },
        {
          action: "form.clear",
          params: {
            path: "/form/title",
          },
        },
      ],
      { store },
    );

    expect(store.getSnapshot().state).toEqual({
      form: {
        title: "",
        notes: "keep",
      },
    });
    expect(store.getSnapshot().meta.validation).toEqual({
      "/form/notes": {
        valid: true,
        touched: true,
        dirty: true,
        errors: [],
      },
    });
  });

  it("emits effects for navigation and custom actions", () => {
    const store = createAppStore({
      state: {
        nextHref: "/tasks/42",
      },
    });

    const result = executeActionSequence(
      [
        {
          action: "nav.navigate",
          params: {
            href: { $read: { source: "state", path: "/nextHref" } },
          },
        },
        {
          action: "notify.host",
          params: {
            kind: "saved",
          },
        },
      ],
      { store },
    );

    expect(result.effects).toEqual([
      {
        type: "nav.navigate",
        action: "nav.navigate",
        params: {
          href: "/tasks/42",
        },
      },
      {
        type: "custom",
        action: "notify.host",
        params: {
          kind: "saved",
        },
      },
    ]);
  });
});
