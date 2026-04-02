import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  CloudflareIcon,
  KUMO_CLOUDFLARE_ICON_DEFAULT_VARIANTS,
  KUMO_CLOUDFLARE_ICON_VARIANTS,
  cloudflareIconNames,
} from "./index";

describe("CloudflareIcon", () => {
  it("exports the generated glyph name list", () => {
    expect(cloudflareIconNames.length).toBeGreaterThan(400);
    expect(cloudflareIconNames).toContain("cloudflare-gateway-outline");
    expect(cloudflareIconNames).toContain("cloudflare-gateway-solid");
  });

  it("exports KUMO size variants", () => {
    expect(KUMO_CLOUDFLARE_ICON_VARIANTS.size.base.classes).toContain("size-5");
    expect(KUMO_CLOUDFLARE_ICON_VARIANTS.size.base.description).toBe(
      "Default icon size",
    );
    expect(KUMO_CLOUDFLARE_ICON_DEFAULT_VARIANTS.size).toBe("base");
  });

  it("renders a real glyph from the generated sprite", () => {
    const { container } = render(
      <CloudflareIcon
        glyph="cloudflare-gateway-outline"
        title="Gateway icon"
        data-testid="icon"
      />,
    );

    const svg = screen.getByTestId("icon");
    const use = container.querySelector("use");
    const spriteSymbol = document.getElementById("kumo-cloudflare-icon-sprite")
      ?.querySelector("symbol#cloudflare-gateway-outline");

    expect(svg.getAttribute("viewBox")).toBe("0 0 16 16");
    expect(svg.getAttribute("aria-labelledby")).toBeTruthy();
    expect(svg.querySelector("title")?.textContent).toBe("Gateway icon");
    expect(use?.getAttribute("href")).toBe("#cloudflare-gateway-outline");
    expect(spriteSymbol).toBeTruthy();
  });

  it("renders decorative icons as aria-hidden by default", () => {
    render(<CloudflareIcon glyph="cloudflare-gateway-outline" data-testid="icon" />);

    expect(screen.getByTestId("icon").getAttribute("aria-hidden")).toBe("true");
  });
});
