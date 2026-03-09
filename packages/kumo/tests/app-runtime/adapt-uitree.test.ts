import { describe, expect, it } from "vitest";

import {
  APP_SPEC_VERSION,
  COMPAT_AUTH_SIGNED_IN_PATH,
  adaptCompatibleUITree,
  normalizeAppSpec,
} from "../../src/app-runtime";

describe("adaptCompatibleUITree", () => {
  it("maps legacy UITree props, visibility, actions, and children into AppSpec", () => {
    const spec = adaptCompatibleUITree({
      tree: {
        root: "shell",
        elements: {
          shell: {
            key: "shell",
            type: "Stack",
            props: {},
            children: ["toggle", "cta", "panel"],
          },
          toggle: {
            key: "toggle",
            type: "Checkbox",
            props: {
              checked: { path: "/prefs/enabled" },
            },
            visible: { auth: "signedIn" },
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
          cta: {
            key: "cta",
            type: "Button",
            props: {
              children: "Open",
            },
            action: {
              name: "nav.navigate",
              params: {
                href: { path: "/links/next" },
              },
              confirm: {
                title: "Continue",
                message: "Open the next view?",
                variant: "danger",
                confirmLabel: "Open",
                cancelLabel: "Stay",
              },
            },
          },
          panel: {
            key: "panel",
            type: "Text",
            props: {
              children: "Visible",
            },
            visible: { path: "/prefs/enabled" },
          },
          orphan: {
            key: "orphan",
            type: "Text",
            props: {
              children: "Recovered child",
            },
            parentKey: "shell",
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
      auth: {
        isSignedIn: true,
      },
    });

    expect(spec.version).toBe(APP_SPEC_VERSION);
    expect(spec.root).toBe("shell");
    expect(spec.elements.shell.children).toEqual([
      "toggle",
      "cta",
      "panel",
      "orphan",
    ]);
    expect(spec.state).toEqual({
      prefs: {
        enabled: true,
      },
      links: {
        next: "/next",
      },
      __compat: {
        auth: {
          isSignedIn: true,
        },
      },
    });
    expect(spec.elements.toggle).toEqual({
      key: "toggle",
      type: "Checkbox",
      props: {
        checked: {
          $bind: {
            source: "state",
            path: "/prefs/enabled",
          },
        },
      },
      visible: {
        $truthy: {
          $read: {
            source: "state",
            path: COMPAT_AUTH_SIGNED_IN_PATH,
          },
        },
      },
      events: {
        change: {
          action: "toggle-pref",
          params: {
            enabled: {
              $read: {
                source: "state",
                path: "/prefs/enabled",
              },
            },
          },
          onSuccess: [
            {
              action: "state.merge",
              params: {
                path: "/",
                value: {
                  prefs: {
                    enabled: false,
                  },
                },
              },
            },
          ],
        },
      },
    });
    expect(spec.elements.cta.events).toEqual({
      press: {
        action: "nav.navigate",
        params: {
          href: {
            $read: {
              source: "state",
              path: "/links/next",
            },
          },
        },
        confirm: {
          title: "Continue",
          description: "Open the next view?",
          variant: "danger",
          confirmLabel: "Open",
          cancelLabel: "Stay",
        },
      },
    });
    expect(spec.elements.panel.visible).toEqual({
      $truthy: {
        $read: {
          source: "state",
          path: "/prefs/enabled",
        },
      },
    });
  });

  it("normalizes minimal stateless trees through the compatibility path", () => {
    const normalized = normalizeAppSpec({
      tree: {
        root: "title",
        elements: {
          title: {
            key: "title",
            type: "Text",
            props: {
              children: "Hello",
            },
          },
        },
      },
    });

    expect(normalized).toEqual({
      version: APP_SPEC_VERSION,
      root: "title",
      elements: {
        title: {
          key: "title",
          type: "Text",
          props: {
            children: "Hello",
          },
        },
      },
      state: {
        __compat: {
          auth: {
            isSignedIn: false,
          },
        },
      },
    });
  });
});
