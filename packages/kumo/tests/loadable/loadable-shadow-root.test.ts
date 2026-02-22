import { afterEach, describe, expect, it } from "vitest";

import api from "@/loadable/index";
import type { UITree } from "@/streaming/types";

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

describe("UMD ShadowRoot mount mode", () => {
  it("renders into ShadowRoot and injects stylesheet link", () => {
    const containerId = makeContainerId();
    const hostEl = mountContainer(containerId);

    // happy-dom tries to fetch <link rel="stylesheet">; stub to avoid network.
    const originalFetch = globalThis.fetch;
    const originalWindowFetch = window.fetch;
    const stubFetch = (_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(new Response("", { status: 200 }));
    globalThis.fetch = stubFetch;
    window.fetch = stubFetch;

    api.configureContainer(containerId, { mountMode: "shadow-root" });

    const tree: UITree = {
      root: "root",
      elements: {
        root: {
          key: "root",
          type: "Div",
          props: {
            children: "hello",
          },
        },
      },
    };

    api.renderTree(tree, containerId);

    expect(hostEl.shadowRoot).not.toBeNull();
    const shadowRoot = hostEl.shadowRoot;
    if (shadowRoot == null) throw new Error("shadowRoot missing");

    expect(
      shadowRoot.querySelector(
        'link[rel="stylesheet"][href="/.well-known/stylesheet.css"]',
      ),
    ).not.toBeNull();

    expect(
      shadowRoot.querySelector('div[data-kumo-shadow-mount="true"]'),
    ).not.toBeNull();

    const mountEl = shadowRoot.querySelector(
      'div[data-kumo-shadow-mount="true"]',
    );
    if (!(mountEl instanceof HTMLDivElement)) {
      throw new Error("shadow mount element missing");
    }

    api.reset(containerId);

    globalThis.fetch = originalFetch;
    window.fetch = originalWindowFetch;

    expect(
      hostEl.shadowRoot?.querySelector('div[data-kumo-shadow-mount="true"]'),
    ).toBeNull();
    expect(
      hostEl.shadowRoot?.querySelector(
        'link[data-kumo-shadow-stylesheet="true"]',
      ),
    ).toBeNull();
  });
});
