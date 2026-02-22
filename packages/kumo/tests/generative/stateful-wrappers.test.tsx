/**
 * Unit tests for stateful wrappers' onAction integration.
 *
 * Strategy: mock @cloudflare/kumo so inner components are simple test doubles
 * that expose their onChange callbacks via DOM. This avoids the dual-React
 * issue (bundled kumo React ≠ test React) while thoroughly testing:
 *   1. Internal state management (useState)
 *   2. onAction dispatch with correct context payload
 *   3. Prop forwarding
 */

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// =============================================================================
// Mocks — replace kumo components with minimal test doubles
//
// Each double renders a button that triggers the onChange callback,
// plus displays the current controlled value for assertion.
// =============================================================================

vi.mock("@cloudflare/kumo", () => {
  function MockSelect({
    value,
    onValueChange,
    children,
    ...rest
  }: {
    value: unknown;
    onValueChange: (v: unknown) => void;
    children?: React.ReactNode;
    [k: string]: unknown;
  }): React.JSX.Element {
    return (
      <div data-testid="mock-select" data-value={String(value)} {...rest}>
        <button
          data-testid="select-trigger"
          onClick={() => onValueChange("option-b")}
        >
          trigger
        </button>
        {children}
      </div>
    );
  }
  MockSelect.Option = function MockOption(props: {
    value: string;
    children?: React.ReactNode;
  }): React.JSX.Element {
    return <div data-testid={`option-${props.value}`}>{props.children}</div>;
  };

  function MockCheckbox({
    checked,
    onCheckedChange,
    ...rest
  }: {
    checked: boolean;
    onCheckedChange: (v: boolean) => void;
    [k: string]: unknown;
  }): React.JSX.Element {
    return (
      <div data-testid="mock-checkbox" data-checked={String(checked)} {...rest}>
        <button
          data-testid="checkbox-trigger"
          onClick={() => onCheckedChange(!checked)}
        >
          toggle
        </button>
      </div>
    );
  }

  function MockSwitch({
    checked,
    onCheckedChange,
    ...rest
  }: {
    checked: boolean;
    onCheckedChange: (v: boolean) => void;
    [k: string]: unknown;
  }): React.JSX.Element {
    return (
      <div data-testid="mock-switch" data-checked={String(checked)} {...rest}>
        <button
          data-testid="switch-trigger"
          onClick={() => onCheckedChange(!checked)}
        >
          flip
        </button>
      </div>
    );
  }

  function MockTabs({
    value,
    onValueChange,
    tabs,
    ...rest
  }: {
    value: string;
    onValueChange: (v: string) => void;
    tabs?: Array<{ value: string; label: React.ReactNode }>;
    [k: string]: unknown;
  }): React.JSX.Element {
    return (
      <div data-testid="mock-tabs" data-value={value} {...rest}>
        {tabs?.map((tab) => (
          <button
            key={tab.value}
            data-testid={`tab-${tab.value}`}
            onClick={() => onValueChange(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    );
  }

  function MockCollapsible({
    label,
    open,
    onOpenChange,
    children,
    ...rest
  }: {
    label: string;
    open: boolean;
    onOpenChange: (v: boolean) => void;
    children?: React.ReactNode;
    [k: string]: unknown;
  }): React.JSX.Element {
    return (
      <div data-testid="mock-collapsible" data-open={String(open)} {...rest}>
        <button
          data-testid="collapsible-trigger"
          onClick={() => onOpenChange(!open)}
        >
          {label}
        </button>
        {open ? children : null}
      </div>
    );
  }

  return {
    Select: MockSelect,
    Checkbox: MockCheckbox,
    Switch: MockSwitch,
    Tabs: MockTabs,
    Collapsible: MockCollapsible,
  };
});

import {
  StatefulSelect,
  StatefulCheckbox,
  StatefulSwitch,
  StatefulTabs,
  StatefulCollapsible,
} from "@/generative/stateful-wrappers";

// =============================================================================
// StatefulSelect
// =============================================================================

describe("StatefulSelect", () => {
  it("renders with defaultValue and holds selection", () => {
    render(
      <StatefulSelect defaultValue="option-a">
        <StatefulSelect.Option value="option-a">A</StatefulSelect.Option>
        <StatefulSelect.Option value="option-b">B</StatefulSelect.Option>
      </StatefulSelect>,
    );

    const el = screen.getByTestId("mock-select");
    expect(el.dataset.value).toBe("option-a");

    // Simulate selection change
    fireEvent.click(screen.getByTestId("select-trigger"));

    expect(el.dataset.value).toBe("option-b");
  });

  it("calls onAction with { value } on selection change", () => {
    const onAction = vi.fn();
    render(
      <StatefulSelect defaultValue="option-a" onAction={onAction}>
        <StatefulSelect.Option value="option-a">A</StatefulSelect.Option>
        <StatefulSelect.Option value="option-b">B</StatefulSelect.Option>
      </StatefulSelect>,
    );

    fireEvent.click(screen.getByTestId("select-trigger"));

    expect(onAction).toHaveBeenCalledOnce();
    expect(onAction).toHaveBeenCalledWith({ value: "option-b" });
  });

  it("does not error when onAction is omitted", () => {
    render(<StatefulSelect defaultValue="option-a" />);

    // Should not throw
    fireEvent.click(screen.getByTestId("select-trigger"));

    expect(screen.getByTestId("mock-select").dataset.value).toBe("option-b");
  });
});

// =============================================================================
// StatefulCheckbox
// =============================================================================

describe("StatefulCheckbox", () => {
  it("toggles checked state", () => {
    render(<StatefulCheckbox defaultChecked={false} />);

    const el = screen.getByTestId("mock-checkbox");
    expect(el.dataset.checked).toBe("false");

    fireEvent.click(screen.getByTestId("checkbox-trigger"));
    expect(el.dataset.checked).toBe("true");

    fireEvent.click(screen.getByTestId("checkbox-trigger"));
    expect(el.dataset.checked).toBe("false");
  });

  it("calls onAction with { checked } on toggle", () => {
    const onAction = vi.fn();
    render(<StatefulCheckbox defaultChecked={false} onAction={onAction} />);

    fireEvent.click(screen.getByTestId("checkbox-trigger"));

    expect(onAction).toHaveBeenCalledOnce();
    expect(onAction).toHaveBeenCalledWith({ checked: true });

    fireEvent.click(screen.getByTestId("checkbox-trigger"));
    expect(onAction).toHaveBeenCalledTimes(2);
    expect(onAction).toHaveBeenLastCalledWith({ checked: false });
  });
});

// =============================================================================
// StatefulSwitch
// =============================================================================

describe("StatefulSwitch", () => {
  it("flips checked state", () => {
    render(<StatefulSwitch defaultChecked={false} />);

    const el = screen.getByTestId("mock-switch");
    expect(el.dataset.checked).toBe("false");

    fireEvent.click(screen.getByTestId("switch-trigger"));
    expect(el.dataset.checked).toBe("true");
  });

  it("calls onAction with { checked } on flip", () => {
    const onAction = vi.fn();
    render(<StatefulSwitch defaultChecked={true} onAction={onAction} />);

    fireEvent.click(screen.getByTestId("switch-trigger"));

    expect(onAction).toHaveBeenCalledOnce();
    expect(onAction).toHaveBeenCalledWith({ checked: false });
  });
});

// =============================================================================
// StatefulTabs
// =============================================================================

describe("StatefulTabs", () => {
  const tabDefs = [
    { value: "tab-1", label: "Tab 1" },
    { value: "tab-2", label: "Tab 2" },
    { value: "tab-3", label: "Tab 3" },
  ] as const;

  it("switches panels and holds value", () => {
    render(<StatefulTabs tabs={tabDefs} defaultValue="tab-1" />);

    const el = screen.getByTestId("mock-tabs");
    expect(el.dataset.value).toBe("tab-1");

    fireEvent.click(screen.getByTestId("tab-tab-2"));
    expect(el.dataset.value).toBe("tab-2");

    fireEvent.click(screen.getByTestId("tab-tab-3"));
    expect(el.dataset.value).toBe("tab-3");
  });

  it("calls onAction with { value } on tab switch", () => {
    const onAction = vi.fn();
    render(
      <StatefulTabs tabs={tabDefs} defaultValue="tab-1" onAction={onAction} />,
    );

    fireEvent.click(screen.getByTestId("tab-tab-2"));

    expect(onAction).toHaveBeenCalledOnce();
    expect(onAction).toHaveBeenCalledWith({ value: "tab-2" });
  });

  it("defaults to first tab when no defaultValue", () => {
    render(<StatefulTabs tabs={tabDefs} />);

    expect(screen.getByTestId("mock-tabs").dataset.value).toBe("tab-1");
  });
});

// =============================================================================
// StatefulCollapsible
// =============================================================================

describe("StatefulCollapsible", () => {
  it("opens and closes", () => {
    render(
      <StatefulCollapsible label="Details" defaultOpen={false}>
        <div data-testid="content">Hidden content</div>
      </StatefulCollapsible>,
    );

    const el = screen.getByTestId("mock-collapsible");
    expect(el.dataset.open).toBe("false");
    expect(screen.queryByTestId("content")).toBeNull();

    fireEvent.click(screen.getByTestId("collapsible-trigger"));
    expect(el.dataset.open).toBe("true");
    expect(screen.getByTestId("content")).toBeTruthy();

    fireEvent.click(screen.getByTestId("collapsible-trigger"));
    expect(el.dataset.open).toBe("false");
    expect(screen.queryByTestId("content")).toBeNull();
  });

  it("calls onAction with { open } on open/close", () => {
    const onAction = vi.fn();
    render(
      <StatefulCollapsible
        label="Details"
        defaultOpen={false}
        onAction={onAction}
      >
        <div>content</div>
      </StatefulCollapsible>,
    );

    fireEvent.click(screen.getByTestId("collapsible-trigger"));

    expect(onAction).toHaveBeenCalledOnce();
    expect(onAction).toHaveBeenCalledWith({ open: true });

    fireEvent.click(screen.getByTestId("collapsible-trigger"));
    expect(onAction).toHaveBeenCalledTimes(2);
    expect(onAction).toHaveBeenLastCalledWith({ open: false });
  });
});
