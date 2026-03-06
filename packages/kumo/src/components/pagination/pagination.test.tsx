import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Pagination } from "./pagination";
import { KumoLocaleProvider } from "../../localize/index.js";

describe("Pagination", () => {
  it("renders localized control labels and range text", () => {
    render(
      <KumoLocaleProvider locale="es">
        <Pagination page={1} setPage={() => {}} perPage={25} totalCount={50}>
          <Pagination.Info />
          <Pagination.Controls controls="full" />
        </Pagination>
      </KumoLocaleProvider>,
    );

    expect(screen.getByText("Showing 1-25 of 50")).toBeTruthy();
    expect(screen.getByRole("button", { name: "First page" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next page" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Last page" })).toBeTruthy();
  });
});
