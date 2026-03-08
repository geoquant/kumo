import { describe, expect, it } from "vitest";

import {
  APP_SPEC_VERSION,
  createAppStore,
  createExpressionContext,
  expandAppSpec,
  writeBindingValue,
} from "../../src/app-runtime";
import type { AppSpec } from "../../src/app-runtime";

describe("app runtime repeat", () => {
  it("renders repeated children from array state without mutating the base spec", () => {
    const spec: AppSpec = {
      version: APP_SPEC_VERSION,
      root: "root",
      state: {},
      elements: {
        root: { key: "root", type: "Stack", children: ["list"] },
        list: { key: "list", type: "Stack", children: ["row"] },
        row: {
          key: "row",
          type: "Stack",
          repeat: { source: { source: "state", path: "/tasks" } },
          children: ["label"],
        },
        label: {
          key: "label",
          type: "Text",
          props: {
            children: { $read: { source: "item", path: "/title" } },
          },
        },
      },
    };

    const store = createAppStore({
      state: {
        tasks: [{ title: "A" }, { title: "B" }],
      },
    });

    const expanded = expandAppSpec(spec, store);

    expect(expanded.elements.list.children).toEqual([
      "row__tasks__0",
      "row__tasks__1",
    ]);
    expect(expanded.elements["row__tasks__0"].children).toEqual([
      "label__tasks__0",
    ]);
    expect(expanded.repeatScopes["row__tasks__1"]).toEqual({
      item: { title: "B" },
      index: 1,
      itemPath: "/tasks/1",
    });
    expect(spec.elements.row.repeat).toEqual({
      source: { source: "state", path: "/tasks" },
    });
  });

  it("lets repeat-scoped bindings write item fields through the store", () => {
    const spec: AppSpec = {
      version: APP_SPEC_VERSION,
      root: "root",
      state: {},
      elements: {
        root: { key: "root", type: "Stack", children: ["row"] },
        row: {
          key: "row",
          type: "Stack",
          repeat: { source: { source: "state", path: "/tasks" } },
        },
      },
    };

    const store = createAppStore({
      state: {
        tasks: [{ title: "A" }, { title: "B" }],
      },
    });

    const expanded = expandAppSpec(spec, store);
    const scope = expanded.repeatScopes["row__tasks__1"];
    const context = createExpressionContext(store, { repeat: scope });

    expect(
      writeBindingValue(
        store,
        { source: "item", path: "/title" },
        "Updated",
        context,
      ),
    ).toBe(true);

    expect(store.getSnapshot().state).toEqual({
      tasks: [{ title: "A" }, { title: "Updated" }],
    });
  });
});
