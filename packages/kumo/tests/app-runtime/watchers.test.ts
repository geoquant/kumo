import { describe, expect, it } from "vitest";

import {
  APP_SPEC_VERSION,
  createAppStore,
  runWatchers,
} from "../../src/app-runtime";
import type { AppSpec } from "../../src/app-runtime";

describe("app runtime watchers", () => {
  it("runs watchers only after real changes and stops when guards stop matching", () => {
    const spec: AppSpec = {
      version: APP_SPEC_VERSION,
      root: "root",
      state: {},
      elements: {
        root: {
          key: "root",
          type: "Stack",
          watch: [
            {
              path: "/count",
              when: {
                $compare: {
                  left: { $read: { source: "state", path: "/count" } },
                  op: "lt",
                  right: 3,
                },
              },
              actions: {
                action: "state.increment",
                params: {
                  path: "/count",
                },
              },
            },
          ],
        },
      },
    };

    const store = createAppStore({ state: { count: 1 } });

    const result = runWatchers(spec, store, {
      previousState: { count: 0 },
    });

    expect(result.invocations).toEqual([
      { elementKey: "root", watchIndex: 0, actions: ["state.increment"] },
      { elementKey: "root", watchIndex: 0, actions: ["state.increment"] },
    ]);
    expect(result.effects).toEqual([]);
    expect(store.getSnapshot().state).toEqual({ count: 3 });

    const noChange = runWatchers(spec, store, {
      previousState: { count: 3 },
    });
    expect(noChange.invocations).toEqual([]);
    expect(noChange.effects).toEqual([]);
  });

  it("returns external runtime effects from watcher actions", () => {
    const spec: AppSpec = {
      version: APP_SPEC_VERSION,
      root: "root",
      state: {},
      elements: {
        root: {
          key: "root",
          type: "Stack",
          watch: [
            {
              path: "/ready",
              actions: {
                action: "nav.navigate",
                params: {
                  href: "/done",
                },
              },
            },
          ],
        },
      },
    };

    const store = createAppStore({ state: { ready: true } });
    const result = runWatchers(spec, store, {
      previousState: { ready: false },
    });

    expect(result.effects).toEqual([
      {
        type: "nav.navigate",
        action: "nav.navigate",
        params: {
          href: "/done",
        },
      },
    ]);
  });

  it("throws when watcher reactions exceed the cycle limit", () => {
    const spec: AppSpec = {
      version: APP_SPEC_VERSION,
      root: "root",
      state: {},
      elements: {
        root: {
          key: "root",
          type: "Stack",
          watch: [
            {
              path: "/flag",
              actions: {
                action: "state.toggle",
                params: {
                  path: "/flag",
                },
              },
            },
          ],
        },
      },
    };

    const store = createAppStore({ state: { flag: true } });

    expect(() =>
      runWatchers(spec, store, {
        previousState: { flag: false },
        maxDepth: 3,
      }),
    ).toThrow("Watcher cycle limit exceeded");
  });
});
