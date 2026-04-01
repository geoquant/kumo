import { describe, expect, it } from "vitest";
import {
  assertUniqueIconNames,
  generateSprite,
  namespaceSvgBodyIds,
  normalizeIconName,
} from "./generate-cloudflare-icons.js";

describe("generate-cloudflare-icons", () => {
  it("normalizes figma names by formatting only", () => {
    expect(normalizeIconName("CloudflareGatewayOutline.svg")).toBe(
      "cloudflare-gateway-outline",
    );
    expect(normalizeIconName("AI-audit-outline.svg")).toBe(
      "ai-audit-outline",
    );
    expect(normalizeIconName("page-shield-outine.svg")).toBe(
      "page-shield-outine",
    );
  });

  it("fails loudly on icon name collisions", () => {
    expect(() =>
      assertUniqueIconNames([
        {
          name: "cloudflare-gateway-outline",
          sourceFile: "cloudflare-gateway-outline.svg",
        },
        {
          name: "cloudflare-gateway-outline",
          sourceFile: "CloudflareGatewayOutline.svg",
        },
      ]),
    ).toThrow(/Icon name collision/);
  });

  it("namespaces internal svg ids and references per glyph", () => {
    const body = [
      '<g clip-path="url(#a)">',
      '  <path d="M0 0h1v1H0z" />',
      '</g>',
      '<defs><clipPath id="a"><path d="M0 0h1v1H0z" /></clipPath></defs>',
    ].join("\n");

    const result = namespaceSvgBodyIds(body, "cloudflare-gateway-outline");

    expect(result).toContain(
      'clip-path="url(#cloudflare-gateway-outline__a)"',
    );
    expect(result).toContain('id="cloudflare-gateway-outline__a"');
    expect(result).not.toContain('url(#a)');
  });

  it("generates a sprite with namespaced internal ids", () => {
    const sprite = generateSprite([
      {
        name: "cloudflare-gateway-outline",
        sourceFile: "cloudflare-gateway-outline.svg",
        viewBox: "0 0 16 16",
        body: '<g clip-path="url(#a)"><path d="M0 0h1v1H0z" /></g><defs><clipPath id="a"><path d="M0 0h1v1H0z" /></clipPath></defs>',
      },
    ]);

    expect(sprite).toContain(
      '<symbol id="cloudflare-gateway-outline" viewBox="0 0 16 16">',
    );
    expect(sprite).toContain(
      'clip-path="url(#cloudflare-gateway-outline__a)"',
    );
    expect(sprite).toContain('id="cloudflare-gateway-outline__a"');
  });
});
