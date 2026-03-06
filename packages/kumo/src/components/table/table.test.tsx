import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Table } from "./table";
import { KumoLocaleProvider } from "../../localize/index.js";

describe("Table", () => {
  it("renders localized resize handle aria label", () => {
    render(
      <KumoLocaleProvider locale="es">
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

    expect(screen.getByRole("button", { name: "Resize column" })).toBeTruthy();
  });

  it("renders localized checkbox aria labels", () => {
    render(
      <KumoLocaleProvider locale="es">
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
      screen.getByRole("checkbox", { name: "Select all rows" }),
    ).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Select row" })).toBeTruthy();
  });
});
