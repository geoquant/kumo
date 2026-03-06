import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Pagination } from "./pagination";
import {
  KumoLocaleProvider,
  registerTranslation,
} from "../../localize/index.js";
import { createTranslation } from "../../translations/create-translation.js";

const testSpanish = createTranslation(
  { $code: "es-MX", $name: "Español Test", $dir: "ltr" },
  {
    "showing-range": (start, end, total) =>
      `Mostrando ${start}-${end} de ${total}`,
    "first-page": "Primera pagina",
    "previous-page": "Pagina anterior",
    "next-page": "Pagina siguiente",
    "last-page": "Ultima pagina",
  },
);

describe("Pagination", () => {
  it("renders localized control labels and range text", () => {
    registerTranslation(testSpanish);

    render(
      <KumoLocaleProvider locale="es-MX">
        <Pagination page={1} setPage={() => {}} perPage={25} totalCount={50}>
          <Pagination.Info />
          <Pagination.Controls controls="full" />
        </Pagination>
      </KumoLocaleProvider>,
    );

    expect(screen.getByText("Mostrando 1-25 de 50")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Primera pagina" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Pagina anterior" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Pagina siguiente" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ultima pagina" })).toBeTruthy();
  });

  it("allows overriding control aria labels", () => {
    render(
      <Pagination page={2} setPage={() => {}} perPage={25} totalCount={50}>
        <Pagination.Controls
          controls="full"
          ariaLabels={{
            firstPage: "Go to first",
            previousPage: "Go to previous",
            pageNumber: "Current page number",
            nextPage: "Go to next",
            lastPage: "Go to last",
          }}
        />
      </Pagination>,
    );

    expect(screen.getByRole("button", { name: "Go to first" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go to previous" })).toBeTruthy();
    expect(
      screen.getByRole("textbox", { name: "Current page number" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go to next" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go to last" })).toBeTruthy();
  });

  it("falls back to localized label when override is blank", () => {
    render(
      <Pagination page={2} setPage={() => {}} perPage={25} totalCount={50}>
        <Pagination.Controls
          controls="full"
          ariaLabels={{
            nextPage: "   ",
          }}
        />
      </Pagination>,
    );

    expect(screen.getByRole("button", { name: "Next page" })).toBeTruthy();
  });

  it("supports aria label overrides in legacy mode", () => {
    render(
      <Pagination
        page={2}
        setPage={() => {}}
        perPage={25}
        totalCount={50}
        controlsAriaLabels={{
          previousPage: "Previous legacy page",
          nextPage: "Next legacy page",
        }}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Previous legacy page" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Next legacy page" }),
    ).toBeTruthy();
  });
});
