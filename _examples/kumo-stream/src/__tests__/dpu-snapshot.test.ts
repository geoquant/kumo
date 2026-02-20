import { describe, expect, it } from "vitest";

import { renderTreeToDpuTemplate } from "../core/dpu-snapshot";
import type { UITree } from "../core/types";

describe("DPU snapshot rendering", () => {
  it('wraps static HTML in a <template for="kumo-ui">', () => {
    const tree: UITree = {
      root: "root",
      elements: {
        root: {
          key: "root",
          type: "Div",
          props: {},
          children: ["msg"],
        },
        msg: {
          key: "msg",
          type: "Text",
          props: { children: "hello" },
          parentKey: "root",
        },
      },
    };

    const template = renderTreeToDpuTemplate(tree, { mode: "light" });
    expect(template).toContain('<template for="kumo-ui">');
    expect(template).toContain('class="kumo-root"');
    expect(template).toContain("hello");
  });
});
