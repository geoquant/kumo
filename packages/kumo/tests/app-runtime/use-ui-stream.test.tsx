import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { APP_SPEC_VERSION, type AppSpec } from "../../src/app-runtime";
import {
  useUIStream,
  type DispatchAppEventResult,
  type WriteAppBindingResult,
} from "../../src/app-runtime/react";

const baseSpec: AppSpec = {
  version: APP_SPEC_VERSION,
  root: "root",
  state: {
    form: {
      name: "Ada",
    },
  },
  elements: {
    root: {
      key: "root",
      type: "Stack",
      children: ["title", "field", "submit"],
    },
    title: {
      key: "title",
      type: "Text",
      props: {
        children: "Profile",
      },
    },
    field: {
      key: "field",
      type: "Input",
      props: {
        value: {
          $bind: {
            source: "state",
            path: "/form/name",
          },
        },
      },
      validation: {
        path: "/form/name",
        mode: ["change", "submit"],
        rules: [{ type: "required", message: "Name required" }],
      },
    },
    submit: {
      key: "submit",
      type: "Button",
      props: {
        children: "Open",
      },
      events: {
        press: {
          action: "nav.navigate",
          params: {
            href: "/users/ada",
          },
        },
      },
    },
  },
};

describe("useUIStream", () => {
  it("handles patch streams, spec replacement, bindings, and runtime effects", () => {
    const onEffects = vi.fn();
    const { result } = renderHook(() =>
      useUIStream({ initialSpec: baseSpec, onEffects }),
    );

    expect(result.current.resolveElement("field")?.props.value).toBe("Ada");

    act(() => {
      result.current.startStream();
      result.current.applyPatches([
        {
          op: "replace",
          path: "/state/form/name",
          value: "Grace",
        },
        {
          op: "replace",
          path: "/elements/title/props/children",
          value: "Team profile",
        },
      ]);
    });

    expect(result.current.status).toBe("streaming");
    expect(result.current.resolveElement("field")?.props.value).toBe("Grace");
    expect(result.current.resolveElement("title")?.props.children).toBe(
      "Team profile",
    );

    let bindingResult: WriteAppBindingResult = {
      ok: false,
      target: null,
      effects: [],
    };
    act(() => {
      bindingResult = result.current.writeBinding({
        elementKey: "field",
        propPath: "/value",
        value: "Mina",
      });
    });
    expect(bindingResult.ok).toBe(true);
    expect(bindingResult.target).toBe("/form/name");
    expect(result.current.snapshot.state).toEqual({
      form: {
        name: "Mina",
      },
    });
    expect(bindingResult.validation?.valid).toBe(true);

    let eventResult: DispatchAppEventResult = {
      effects: [],
      executed: [],
    };
    act(() => {
      eventResult = result.current.dispatchEvent({
        elementKey: "submit",
        event: "press",
      });
    });
    expect(eventResult.effects).toEqual([
      {
        type: "nav.navigate",
        action: "nav.navigate",
        params: {
          href: "/users/ada",
        },
      },
    ]);
    expect(onEffects).toHaveBeenCalledTimes(1);
    expect(onEffects.mock.calls[0][0]).toMatchObject({
      trigger: {
        type: "event",
        elementKey: "submit",
        event: "press",
      },
      snapshot: {
        state: {
          form: {
            name: "Mina",
          },
        },
      },
    });

    act(() => {
      result.current.setSpec({
        root: {
          key: "next-root",
          type: "Stack",
          children: [
            {
              key: "headline",
              type: "Text",
              props: {
                children: "Done",
              },
            },
          ],
        },
        state: {
          done: true,
        },
      });
      result.current.completeStream();
    });

    expect(result.current.status).toBe("complete");
    expect(result.current.resolveElement("headline")?.props.children).toBe(
      "Done",
    );
    expect(result.current.snapshot.state).toEqual({ done: true });
  });

  it("surfaces watcher cycle errors as hook errors", () => {
    const { result } = renderHook(() =>
      useUIStream({
        initialSpec: {
          version: APP_SPEC_VERSION,
          root: "root",
          state: { flag: false },
          elements: {
            root: {
              key: "root",
              type: "Stack",
              events: {
                press: {
                  action: "state.toggle",
                  params: {
                    path: "/flag",
                  },
                },
              },
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
        },
      }),
    );

    let eventResult: DispatchAppEventResult = {
      effects: [],
      executed: [],
    };
    act(() => {
      eventResult = result.current.dispatchEvent({
        elementKey: "root",
        event: "press",
      });
    });

    expect(eventResult.error).toBe("Watcher cycle limit exceeded");
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Watcher cycle limit exceeded");
  });

  it("accepts legacy UITree input through the compatibility adapter", () => {
    const { result } = renderHook(() =>
      useUIStream({
        initialSpec: {
          tree: {
            root: "root",
            elements: {
              root: {
                key: "root",
                type: "Stack",
                props: {},
                children: ["toggle", "panel", "cta"],
              },
              toggle: {
                key: "toggle",
                type: "Checkbox",
                props: {
                  checked: { path: "/prefs/enabled" },
                },
                action: {
                  name: "toggle-pref",
                  params: {
                    enabled: { path: "/prefs/enabled" },
                  },
                  onSuccess: {
                    set: {
                      prefs: {
                        enabled: false,
                      },
                    },
                  },
                },
              },
              panel: {
                key: "panel",
                type: "Text",
                props: {
                  children: "Enabled",
                },
                visible: { path: "/prefs/enabled" },
              },
              cta: {
                key: "cta",
                type: "Button",
                props: {
                  children: "Next",
                },
                action: {
                  name: "nav.navigate",
                  params: {
                    href: { path: "/links/next" },
                  },
                },
              },
            },
          },
          data: {
            prefs: {
              enabled: true,
            },
            links: {
              next: "/next",
            },
          },
        },
      }),
    );

    expect(result.current.resolveElement("toggle")?.props.checked).toBe(true);
    expect(result.current.resolveElement("panel")?.visible).toBe(true);

    let changeResult: DispatchAppEventResult = {
      effects: [],
      executed: [],
    };
    act(() => {
      changeResult = result.current.dispatchEvent({
        elementKey: "toggle",
        event: "change",
      });
    });

    expect(changeResult.effects).toEqual([
      {
        type: "custom",
        action: "toggle-pref",
        params: {
          enabled: true,
        },
      },
    ]);
    expect(result.current.snapshot.state.prefs).toEqual({ enabled: false });
    expect(result.current.resolveElement("panel")?.visible).toBe(false);

    let pressResult: DispatchAppEventResult = {
      effects: [],
      executed: [],
    };
    act(() => {
      pressResult = result.current.dispatchEvent({
        elementKey: "cta",
        event: "press",
      });
    });

    expect(pressResult.effects).toEqual([
      {
        type: "nav.navigate",
        action: "nav.navigate",
        params: {
          href: "/next",
        },
      },
    ]);
  });
});
