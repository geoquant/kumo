import { describe, it, expect, vi, afterEach } from "vitest";

import api from "../loadable/index";
import type { UITree } from "../core/types";

let n = 0;

function makeContainerId(): string {
  n += 1;
  return `kumo-test-container-${n}`;
}

function mountContainer(containerId: string): HTMLDivElement {
  const el = document.createElement("div");
  el.id = containerId;
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("UMD action runtime API", () => {
  it("dispatchAction uses built-in handlers (increment)", () => {
    const containerId = makeContainerId();
    mountContainer(containerId);

    const tree: UITree = {
      root: "card",
      elements: {
        card: {
          key: "card",
          type: "Div",
          props: {},
          children: ["count-display"],
        },
        "count-display": {
          key: "count-display",
          type: "Text",
          props: { children: "5" },
          parentKey: "card",
        },
      },
    };

    api.renderTree(tree, containerId);

    const result = api.dispatchAction(
      { actionName: "increment", sourceKey: "btn" },
      containerId,
    );
    expect(result?.type).toBe("patch");
    if (result?.type !== "patch") throw new Error("expected patch result");

    api.processActionResult(result, {
      applyPatches: (patches) => api.applyPatches(patches, containerId),
      sendMessage: () => {},
    });

    expect(
      api.getTree(containerId).elements["count-display"]?.props,
    ).toMatchObject({ children: "6" });

    api.reset(containerId);
  });

  it("processActionResult invokes sendMessage for submit_form", () => {
    const containerId = makeContainerId();
    mountContainer(containerId);

    const tree: UITree = {
      root: "container",
      elements: {
        container: {
          key: "container",
          type: "Div",
          props: {},
          children: ["email", "submit"],
        },
        email: {
          key: "email",
          type: "Input",
          props: {},
          parentKey: "container",
        },
        submit: {
          key: "submit",
          type: "Button",
          props: {},
          parentKey: "container",
          action: { name: "submit_form", params: { form_type: "contact" } },
        },
      },
    };

    api.renderTree(tree, containerId);

    const result = api.dispatchAction(
      {
        actionName: "submit_form",
        sourceKey: "submit",
        params: { form_type: "contact" },
        context: { runtimeValues: { email: "a@b.com" } },
      },
      containerId,
    );

    expect(result?.type).toBe("message");
    if (result?.type !== "message") throw new Error("expected message result");

    const sendMessage = vi.fn<(content: string) => void>();
    api.processActionResult(result, {
      applyPatches: () => {},
      sendMessage,
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage.mock.calls[0]?.[0]).toContain(
      '"actionName":"submit_form"',
    );

    api.reset(containerId);
  });
});
