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

  it("allows overriding resize handle aria label", () => {
    render(
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.Head>
              Name
              <Table.ResizeHandle aria-label="Adjust column width" />
            </Table.Head>
          </Table.Row>
        </Table.Header>
      </Table>,
    );

    expect(
      screen.getByRole("button", { name: "Adjust column width" }),
    ).toBeTruthy();
  });

  it("merges custom className on resize handle", () => {
    render(
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.Head>
              Name
              <Table.ResizeHandle className="custom-resize-handle" />
            </Table.Head>
          </Table.Row>
        </Table.Header>
      </Table>,
    );

    const handle = screen.getByRole("button", { name: "Resize column" });
    expect(handle.className).toContain("custom-resize-handle");
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
