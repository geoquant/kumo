import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  CloudflareIcon,
  CloudflareIconSprite,
  KUMO_CLOUDFLARE_ICON_DEFAULT_VARIANTS,
  KUMO_CLOUDFLARE_ICON_VARIANTS,
  cloudflareIconNames,
} from "./index";

describe("CloudflareIcon", () => {
  it("exports the generated glyph name list", () => {
    expect(cloudflareIconNames.length).toBeGreaterThan(70);
    expect(cloudflareIconNames).toContain("cloud-internet-outline");
    expect(cloudflareIconNames).toContain("cloud-internet-solid");
    expect(cloudflareIconNames).toContain("performance-acceleration-rocket-outline");
    expect(cloudflareIconNames).toContain("performance-acceleration-rocket-solid");
    expect(cloudflareIconNames).toContain("machine-learning-contextual-outline");
    expect(cloudflareIconNames).toContain("mcp-server-outline");
    expect(cloudflareIconNames).toContain("cloud-hybrid-outline");
    expect(cloudflareIconNames).toContain("cloud-hybrid-solid");
    expect(cloudflareIconNames).toContain("cloudflare-stream-delivery-outline");
    expect(cloudflareIconNames).toContain("cloudflare-workers-outline");
    expect(cloudflareIconNames).toContain("cloudflare-gateway-outline");
    expect(cloudflareIconNames).toContain("cloudflare-pages-outline");
    expect(cloudflareIconNames).toContain("cloudflare-radar-outline");
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
        glyph="cloud-internet-outline"
        title="Cloud Internet icon"
        data-testid="icon"
      />,
    );

    const svg = screen.getByTestId("icon");
    const use = container.querySelector("use");
    const spriteSymbol = document.getElementById("kumo-cloudflare-icon-sprite")
      ?.querySelector("symbol#cloud-internet-outline");

    expect(svg.getAttribute("viewBox")).toBe("0 0 16 16");
    expect(svg.getAttribute("aria-labelledby")).toBeTruthy();
    expect(svg.querySelector("title")?.textContent).toBe("Cloud Internet icon");
    expect(use?.getAttribute("href")).toBe("#cloud-internet-outline");
    expect(spriteSymbol).toBeTruthy();
  });

  it("renders decorative icons as aria-hidden by default", () => {
    render(<CloudflareIcon glyph="cloud-internet-outline" data-testid="icon" />);

    expect(screen.getByTestId("icon").getAttribute("aria-hidden")).toBe("true");
  });

  it("exports a sprite component for SSR-friendly mounting", () => {
    const { container } = render(<CloudflareIconSprite data-testid="sprite" />);
    const spriteContainer = screen.getByTestId("sprite");

    expect(spriteContainer.id).toBe("kumo-cloudflare-icon-sprite");
    expect(spriteContainer.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("symbol#cloud-internet-outline")).toBeTruthy();
  });
});
