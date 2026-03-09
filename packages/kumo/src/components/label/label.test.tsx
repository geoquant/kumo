import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Label } from "./label";

describe("Label", () => {
  it("renders the localized optional term without duplicating punctuation", () => {
    render(<Label showOptional>Email</Label>);

    const label = screen.getByText("Email").closest("label");

    expect(label?.textContent).toBe("Email(optional)");
  });
});
