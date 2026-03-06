import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Breadcrumb } from "./breadcrumbs";
import {
  KumoLocaleProvider,
  registerTranslation,
} from "../../localize/index.js";
import { createTranslation } from "../../translations/create-translation.js";

const testSpanish = createTranslation(
  { $code: "es-BR", $name: "Español Test", $dir: "ltr" },
  {
    copy: "Copiar",
    "click-to-copy": "Haz clic para copiar",
    breadcrumb: "migas de pan",
  },
);

describe("Breadcrumb", () => {
  it("renders localized clipboard labels", () => {
    registerTranslation(testSpanish);

    render(
      <KumoLocaleProvider locale="es-BR">
        <Breadcrumb>
          <Breadcrumb.Link href="/">Home</Breadcrumb.Link>
          <Breadcrumb.Separator />
          <Breadcrumb.Current>Docs</Breadcrumb.Current>
          <Breadcrumb.Clipboard text="https://example.com/docs" />
        </Breadcrumb>
      </KumoLocaleProvider>,
    );

    const copyButtons = screen.getAllByRole("button", { name: "Copiar" });
    expect(copyButtons.length).toBeGreaterThan(0);
    expect(copyButtons[0]?.getAttribute("title")).toBe("Haz clic para copiar");
    expect(
      screen.getByRole("navigation", { name: "migas de pan" }),
    ).toBeTruthy();
  });
});
