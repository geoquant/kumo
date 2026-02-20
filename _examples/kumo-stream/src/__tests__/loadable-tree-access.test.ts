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
  // Best-effort cleanup. Individual tests call reset() for their container IDs.
  document.body.innerHTML = "";
});

describe("UMD tree access API", () => {
  it("getTree returns empty tree for unknown container", () => {
    expect(api.getTree("missing")).toEqual({ root: "", elements: {} });
  });

  it("getTree returns the last rendered tree", () => {
    const containerId = makeContainerId();
    mountContainer(containerId);

    const tree: UITree = {
      root: "root",
      elements: {
        root: { key: "root", type: "Div", props: {} },
      },
    };

    api.renderTree(tree, containerId);

    expect(api.getTree(containerId)).toEqual(tree);
    api.reset(containerId);
  });

  it("subscribeTree fires on applyPatch and can unsubscribe", () => {
    const containerId = makeContainerId();
    mountContainer(containerId);

    const tree: UITree = {
      root: "root",
      elements: {
        root: { key: "root", type: "Div", props: {} },
      },
    };

    api.renderTree(tree, containerId);

    const cb = vi.fn<(t: UITree) => void>();
    const unsubscribe = api.subscribeTree(containerId, cb);

    api.applyPatch(
      {
        op: "replace",
        path: "/elements/root/props/children",
        value: "hello",
      },
      containerId,
    );

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0]?.[0].elements.root?.props).toMatchObject({
      children: "hello",
    });

    unsubscribe();

    api.applyPatch(
      {
        op: "replace",
        path: "/elements/root/props/children",
        value: "world",
      },
      containerId,
    );

    expect(cb).toHaveBeenCalledTimes(1);
    api.reset(containerId);
  });

  it("subscribeTree fires once for applyPatches", () => {
    const containerId = makeContainerId();
    mountContainer(containerId);

    const tree: UITree = {
      root: "root",
      elements: {
        root: { key: "root", type: "Div", props: {} },
      },
    };

    api.renderTree(tree, containerId);

    const cb = vi.fn<(t: UITree) => void>();
    api.subscribeTree(containerId, cb);

    api.applyPatches(
      [
        {
          op: "replace",
          path: "/elements/root/props/title",
          value: "a",
        },
        {
          op: "replace",
          path: "/elements/root/props/subtitle",
          value: "b",
        },
      ],
      containerId,
    );

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0]?.[0].elements.root?.props).toMatchObject({
      title: "a",
      subtitle: "b",
    });

    api.reset(containerId);
  });

  it("sanitizes patch values for applyPatch/applyPatches (including batched variants)", () => {
    const containerId = makeContainerId();
    mountContainer(containerId);

    api.renderTree(
      {
        root: "root",
        elements: {
          root: { key: "root", type: "Div", props: {} },
        },
      },
      containerId,
    );

    api.applyPatch(
      {
        op: "replace",
        path: "/elements/root/props/children",
        value: "⚡ Hello",
      },
      containerId,
    );

    expect(api.getTree(containerId).elements.root?.props).toMatchObject({
      children: "Hello",
    });

    api.applyPatches(
      [
        {
          op: "replace",
          path: "/elements/root/props/title",
          value: "🛡️ Secure",
        },
      ],
      containerId,
    );

    expect(api.getTree(containerId).elements.root?.props).toMatchObject({
      title: "Secure",
    });

    api.applyPatchBatched(
      {
        op: "replace",
        path: "/elements/root/props/subtitle",
        value: "✅ Done",
      },
      containerId,
    );

    expect(api.getTree(containerId).elements.root?.props).toMatchObject({
      subtitle: "Done",
    });

    api.applyPatchesBatched(
      [
        {
          op: "replace",
          path: "/elements/root/props/footer",
          value: "🔥 Hot",
        },
      ],
      containerId,
    );

    expect(api.getTree(containerId).elements.root?.props).toMatchObject({
      footer: "Hot",
    });

    api.reset(containerId);
  });
});
