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
});
