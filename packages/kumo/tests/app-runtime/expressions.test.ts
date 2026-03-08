import { describe, expect, it } from "vitest";

import {
  createAppStore,
  createExpressionContext,
  evaluateBoolExpr,
  resolveActionStep,
  resolvePropsExpressions,
  writeBindingValue,
} from "../../src/app-runtime";

describe("app runtime expressions", () => {
  it("resolves props, visibility, action params, and confirm text from one context", () => {
    const store = createAppStore({
      state: {
        form: {
          title: "Ship app runtime",
          count: 2,
        },
      },
      meta: {
        stream: {
          status: "streaming",
        },
      },
    });

    const context = createExpressionContext(store, {
      repeat: {
        item: { label: "Task A", done: false },
        index: 1,
        itemPath: "/tasks/1",
      },
    });

    const resolvedProps = resolvePropsExpressions(
      {
        value: { $bind: { source: "state", path: "/form/title" } },
        label: {
          $format: [
            { $read: { source: "item", path: "/label" } },
            " #",
            { $read: { source: "index" } },
          ],
        },
        status: { $read: { source: "meta", path: "/stream/status" } },
      },
      context,
    );

    expect(resolvedProps.props).toEqual({
      value: "Ship app runtime",
      label: "Task A #1",
      status: "streaming",
    });
    expect(resolvedProps.bindings).toEqual({
      "/value": { source: "state", path: "/form/title" },
    });

    expect(
      evaluateBoolExpr(
        {
          $and: [
            {
              $compare: {
                left: { $read: { source: "state", path: "/form/count" } },
                op: "gte",
                right: 2,
              },
            },
            {
              $compare: {
                left: { $read: { source: "meta", path: "/stream/status" } },
                op: "eq",
                right: "streaming",
              },
            },
          ],
        },
        context,
      ),
    ).toBe(true);

    const resolvedAction = resolveActionStep(
      {
        action: "nav.navigate",
        params: {
          href: { $format: ["/tasks/", { $read: { source: "index" } }] },
        },
        confirm: {
          title: {
            $format: ["Open ", { $read: { source: "item", path: "/label" } }],
          },
          confirmLabel: { $read: { source: "meta", path: "/stream/status" } },
        },
      },
      { store, repeat: context.repeat },
    );

    expect(resolvedAction).toEqual({
      action: "nav.navigate",
      params: {
        href: "/tasks/1",
      },
      confirm: {
        title: "Open Task A",
        confirmLabel: "streaming",
      },
    });
  });

  it("writes bound values through the app store for state and repeated items", () => {
    const store = createAppStore({
      state: {
        form: { title: "Old" },
        tasks: [{ label: "A" }, { label: "B" }],
      },
    });

    const stateContext = createExpressionContext(store);
    expect(
      writeBindingValue(
        store,
        { source: "state", path: "/form/title" },
        "New",
        stateContext,
      ),
    ).toBe(true);

    const repeatContext = createExpressionContext(store, {
      repeat: {
        item: { label: "B" },
        index: 1,
        itemPath: "/tasks/1",
      },
    });

    expect(
      writeBindingValue(
        store,
        { source: "item", path: "/label" },
        "Updated",
        repeatContext,
      ),
    ).toBe(true);

    expect(store.getSnapshot().state).toEqual({
      form: { title: "New" },
      tasks: [{ label: "A" }, { label: "Updated" }],
    });
  });
});
