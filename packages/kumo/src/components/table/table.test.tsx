import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Table } from "./table";
import {
  KumoLocaleProvider,
  registerTranslation,
} from "../../localize/index.js";
import { createTranslation } from "../../translations/create-translation.js";

const testSpanish = createTranslation(
  { $code: "es-AR", $name: "Español Test", $dir: "ltr" },
  {
    "resize-column": "Redimensionar columna",
    "select-all-rows": "Seleccionar todas las filas",
    "select-row": "Seleccionar fila",
  },
);

describe("Table", () => {
  it("renders localized resize handle aria label", () => {
    registerTranslation(testSpanish);

    render(
      <KumoLocaleProvider locale="es-AR">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>
                Name
                <Table.ResizeHandle />
              </Table.Head>
            </Table.Row>
          </Table.Header>
        </Table>
      </KumoLocaleProvider>,
    );

    expect(
      screen.getByRole("button", { name: "Redimensionar columna" }),
    ).toBeTruthy();
  });

  it("renders localized checkbox aria labels", () => {
    registerTranslation(testSpanish);

    render(
      <KumoLocaleProvider locale="es-AR">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.CheckHead />
              <Table.Head>Name</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            <Table.Row>
              <Table.CheckCell />
              <Table.Cell>A</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>
      </KumoLocaleProvider>,
    );

    expect(
      screen.getByRole("checkbox", { name: "Seleccionar todas las filas" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("checkbox", { name: "Seleccionar fila" }),
    ).toBeTruthy();
  });
});
