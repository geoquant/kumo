import { describe, it, expect, vi } from "vitest";

import api from "../loadable/index";
import type { UITree } from "../core/types";

let n = 0;

function makeContainerId(): string {
  n += 1;
  return `kumo-test-container-${n}`;
}

function mountContainer(containerId: string): void {
  const el = document.createElement("div");
  el.id = containerId;
  document.body.appendChild(el);
}

describe("UMD batched patch application", () => {
  it("applyPatchesBatched batches render to next animation frame", () => {
    vi.useFakeTimers();

    const containerId = makeContainerId();
    mountContainer(containerId);

    const tree: UITree = {
      root: "root",
      elements: {
        root: { key: "root", type: "Div", props: {} },
      },
    };

    api.renderTree(tree, containerId);

    // Spy on rAF to ensure we schedule only once.
    const raf = vi
      .spyOn(globalThis, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => {
        setTimeout(() => cb(0), 0);
        return 1;
      });

    api.applyPatchesBatched(
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

    api.applyPatchesBatched(
      [
        {
          op: "replace",
          path: "/elements/root/props/subtitle",
          value: "c",
        },
      ],
      containerId,
    );

    expect(raf).toHaveBeenCalledTimes(1);

    vi.runAllTimers();

    expect(api.getTree(containerId).elements.root?.props).toMatchObject({
      title: "a",
      subtitle: "c",
    });

    api.reset(containerId);
    raf.mockRestore();
    vi.useRealTimers();
  });
});
