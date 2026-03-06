import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Breadcrumb } from "./breadcrumbs";
import { KumoLocaleProvider } from "../../localize/index.js";

describe("Breadcrumb", () => {
  it("renders localized clipboard labels", () => {
    render(
      <KumoLocaleProvider locale="es">
        <Breadcrumb>
          <Breadcrumb.Link href="/">Home</Breadcrumb.Link>
          <Breadcrumb.Separator />
          <Breadcrumb.Current>Docs</Breadcrumb.Current>
          <Breadcrumb.Clipboard text="https://example.com/docs" />
        </Breadcrumb>
      </KumoLocaleProvider>,
    );

    const copyButtons = screen.getAllByRole("button", { name: "Copy" });
    expect(copyButtons.length).toBeGreaterThan(0);
    expect(copyButtons[0]?.getAttribute("title")).toBe("Click to copy");
    expect(screen.getByRole("navigation", { name: "breadcrumb" })).toBeTruthy();
  });
});
