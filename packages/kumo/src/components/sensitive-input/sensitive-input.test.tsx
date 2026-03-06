import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { SensitiveInput } from "./sensitive-input";

describe("SensitiveInput", () => {
  it("should be defined", () => {
    expect(SensitiveInput).toBeDefined();
  });

  it("should accept required props", () => {
    const props = {
      label: "API Key",
    };
    expect(() => createElement(SensitiveInput, props)).not.toThrow();
  });

  it("should accept all optional props", () => {
    const props = {
      value: "secret-value",
      defaultValue: "default-secret",
      onChange: () => {},
      onValueChange: () => {},
      onCopy: () => {},
      size: "base" as const,
      variant: "default" as const,
      label: "API Key",
      disabled: false,
      readOnly: false,
      id: "api-key-input",
      name: "apiKey",
      placeholder: "Enter API key",
      required: true,
      autoComplete: "off",
      className: "custom-class",
    };
    expect(() => createElement(SensitiveInput, props)).not.toThrow();
  });

  it("uses input aria-label for masked container when no maskedAriaLabel provided", () => {
    render(<SensitiveInput defaultValue="secret" aria-label="API token" />);

    expect(screen.getByRole("button", { name: "API token" })).toBeTruthy();
  });

  it("prefers maskedAriaLabel over input aria-label", () => {
    render(
      <SensitiveInput
        defaultValue="secret"
        aria-label="API token"
        maskedAriaLabel="Reveal API token"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Reveal API token" }),
    ).toBeTruthy();
  });

  it("falls back when maskedAriaLabel is blank", () => {
    render(
      <SensitiveInput
        defaultValue="secret"
        aria-label="API token"
        maskedAriaLabel="   "
      />,
    );

    expect(screen.getByRole("button", { name: "API token" })).toBeTruthy();
  });
});
