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
});
