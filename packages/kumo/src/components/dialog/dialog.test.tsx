import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { type ReactNode } from "react";
import { Dialog } from "./dialog";
import { Button } from "../button/button";

function renderOpenDialog(dialog: ReactNode) {
  return render(<Dialog.Root defaultOpen>{dialog}</Dialog.Root>);
}

describe("Dialog", () => {
  it("opens from its trigger and closes from its close control", async () => {
    const user = userEvent.setup();

    render(
      <Dialog.Root>
        <Dialog.Trigger>Open dialog</Dialog.Trigger>
        <Dialog>
          <Dialog.Title>Opened dialog</Dialog.Title>
          <Dialog.Close>Close dialog</Dialog.Close>
        </Dialog>
      </Dialog.Root>,
    );

    await user.click(screen.getByRole("button", { name: "Open dialog" }));

    expect(screen.getByRole("dialog").textContent).toContain("Opened dialog");

    await user.click(screen.getByRole("button", { name: "Close dialog" }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("supports Button render props on trigger and close", async () => {
    const user = userEvent.setup();

    render(
      <Dialog.Root>
        <Dialog.Trigger render={(p) => <Button {...p}>Open dialog</Button>} />
        <Dialog>
          <Dialog.Title>Rendered button dialog</Dialog.Title>
          <Dialog.Close render={(p) => <Button {...p}>Close dialog</Button>} />
        </Dialog>
      </Dialog.Root>,
    );

    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    expect(screen.getByRole("dialog").textContent).toContain(
      "Rendered button dialog",
    );

    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("preserves the bare Dialog shorthand as the default content surface", () => {
    renderOpenDialog(
      <Dialog>
        <Dialog.Title>Base dialog</Dialog.Title>
      </Dialog>,
    );

    expect(screen.getByRole("dialog").className).toContain("bg-kumo-base");
    expect(
      screen.getByRole("heading", { name: "Base dialog" }).className,
    ).not.toContain("text-xl");
  });

  it("supports Dialog.Content as an alias for the content surface", () => {
    renderOpenDialog(
      <Dialog.Content>
        <Dialog.Title>Content dialog</Dialog.Title>
      </Dialog.Content>,
    );

    expect(screen.getByRole("dialog").textContent).toContain("Content dialog");
    expect(screen.getByRole("dialog").className).toContain("bg-kumo-base");
  });

  it("renders the layer variant with structured sections", () => {
    renderOpenDialog(
      <Dialog.Content variant="layer">
        <Dialog.Body data-testid="body">
          <Dialog.Title>Layer dialog</Dialog.Title>
          <Dialog.Description>Structured workflow</Dialog.Description>
          <Dialog.Separator data-testid="separator" />
        </Dialog.Body>
        <Dialog.Footer data-testid="footer">Actions</Dialog.Footer>
      </Dialog.Content>,
    );

    expect(screen.getByRole("dialog").className).toContain("max-w-md");
    expect(
      screen.getByRole("heading", { name: "Layer dialog" }).className,
    ).toContain("text-xl");
    expect(screen.getByText("Structured workflow").className).toContain(
      "text-kumo-subtle",
    );
    expect(screen.getByTestId("body").className).toContain("p-6");
    expect(screen.getByTestId("footer").className).toContain("px-0");
    expect(screen.getByTestId("separator").className).toContain("-mx-6");
  });
});
