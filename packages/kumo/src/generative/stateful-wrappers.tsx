/**
 * Stateful wrappers for controlled-only Kumo components.
 *
 * Kumo components like Select, Checkbox, Switch, Tabs, and Collapsible
 * are controlled-only (no defaultChecked, defaultOpen, etc.) or behave
 * poorly without state management. These wrappers bridge the gap for
 * LLM-generated UIs where no host state management exists.
 *
 * Each wrapper:
 *  1. Manages internal useState for the controlled prop
 *  2. Accepts an optional `onAction` callback for action dispatch
 *  3. Integrates with RuntimeValueStore for form value capture
 *  4. Passes all other props through unchanged
 */

import React, { useEffect, useState } from "react";
import { Checkbox, Collapsible, Select, Switch, Tabs } from "../index.js";
import { useRuntimeValueStoreContext } from "../streaming/runtime-value-store-context.js";

// =============================================================================
// Shared types
// =============================================================================

/** Callback passed by UITreeRenderer when element has an `action` field. */
export type OnActionCallback = (context?: Record<string, unknown>) => void;

// =============================================================================
// StatefulSelect
// =============================================================================

interface StatefulSelectProps {
  readonly defaultValue?: unknown;
  readonly value?: unknown;
  readonly onAction?: OnActionCallback;
  readonly children?: React.ReactNode;
  readonly [key: string]: unknown;
}

function StatefulSelectInner({
  defaultValue,
  value: controlledValue,
  onAction,
  children,
  ...props
}: StatefulSelectProps): React.JSX.Element {
  const runtimeValueStore = useRuntimeValueStoreContext();
  const elementKey =
    typeof props["data-key"] === "string" ? props["data-key"] : null;
  const [value, setValue] = useState<unknown>(
    controlledValue ?? defaultValue ?? null,
  );

  useEffect(() => {
    if (!runtimeValueStore || !elementKey) return;
    if (runtimeValueStore.getValue(elementKey) !== undefined) return;
    if (runtimeValueStore.isTouched(elementKey)) return;
    runtimeValueStore.setValue(elementKey, value, { touched: false });
  }, [runtimeValueStore, elementKey, value]);

  function handleChange(next: unknown): void {
    setValue(next);
    if (runtimeValueStore && elementKey) {
      runtimeValueStore.setValue(elementKey, next);
    }
    onAction?.({ value: next });
  }

  return (
    <Select {...props} value={value} onValueChange={handleChange}>
      {children}
    </Select>
  );
}
StatefulSelectInner.displayName = "StatefulSelect";

// Re-export Select.Option so compound usage works via COMPONENT_MAP
export const StatefulSelect = Object.assign(StatefulSelectInner, {
  Option: Select.Option,
});

// =============================================================================
// StatefulCheckbox
// =============================================================================

interface StatefulCheckboxProps {
  readonly defaultChecked?: boolean;
  readonly checked?: boolean;
  readonly onAction?: OnActionCallback;
  readonly [key: string]: unknown;
}

export function StatefulCheckbox({
  defaultChecked,
  checked: controlledChecked,
  onAction,
  ...props
}: StatefulCheckboxProps): React.JSX.Element {
  const runtimeValueStore = useRuntimeValueStoreContext();
  const elementKey =
    typeof props["data-key"] === "string" ? props["data-key"] : null;
  const [checked, setChecked] = useState<boolean>(
    controlledChecked ?? defaultChecked ?? false,
  );

  useEffect(() => {
    if (!runtimeValueStore || !elementKey) return;
    if (runtimeValueStore.getValue(elementKey) !== undefined) return;
    if (runtimeValueStore.isTouched(elementKey)) return;
    runtimeValueStore.setValue(elementKey, checked, { touched: false });
  }, [runtimeValueStore, elementKey, checked]);

  function handleChange(next: boolean): void {
    setChecked(next);
    if (runtimeValueStore && elementKey) {
      runtimeValueStore.setValue(elementKey, next);
    }
    onAction?.({ checked: next });
  }

  return (
    <Checkbox {...props} checked={checked} onCheckedChange={handleChange} />
  );
}
StatefulCheckbox.displayName = "StatefulCheckbox";

// =============================================================================
// StatefulSwitch
// =============================================================================

interface StatefulSwitchProps {
  readonly defaultChecked?: boolean;
  readonly checked?: boolean;
  readonly onAction?: OnActionCallback;
  readonly [key: string]: unknown;
}

export function StatefulSwitch({
  defaultChecked,
  checked: controlledChecked,
  onAction,
  ...props
}: StatefulSwitchProps): React.JSX.Element {
  const runtimeValueStore = useRuntimeValueStoreContext();
  const elementKey =
    typeof props["data-key"] === "string" ? props["data-key"] : null;
  const [checked, setChecked] = useState<boolean>(
    controlledChecked ?? defaultChecked ?? false,
  );

  useEffect(() => {
    if (!runtimeValueStore || !elementKey) return;
    if (runtimeValueStore.getValue(elementKey) !== undefined) return;
    if (runtimeValueStore.isTouched(elementKey)) return;
    runtimeValueStore.setValue(elementKey, checked, { touched: false });
  }, [runtimeValueStore, elementKey, checked]);

  function handleChange(next: boolean): void {
    setChecked(next);
    if (runtimeValueStore && elementKey) {
      runtimeValueStore.setValue(elementKey, next);
    }
    onAction?.({ checked: next });
  }

  return <Switch {...props} checked={checked} onCheckedChange={handleChange} />;
}
StatefulSwitch.displayName = "StatefulSwitch";

// =============================================================================
// StatefulTabs
// =============================================================================

interface TabsItem {
  readonly value: string;
  readonly label: React.ReactNode;
  readonly className?: string;
}

interface StatefulTabsProps {
  readonly defaultValue?: string;
  readonly selectedValue?: string;
  readonly value?: string;
  readonly tabs?: readonly TabsItem[];
  readonly onAction?: OnActionCallback;
  readonly [key: string]: unknown;
}

export function StatefulTabs({
  defaultValue,
  selectedValue,
  value: controlledValue,
  tabs,
  onAction,
  ...props
}: StatefulTabsProps): React.JSX.Element {
  const runtimeValueStore = useRuntimeValueStoreContext();
  const elementKey =
    typeof props["data-key"] === "string" ? props["data-key"] : null;
  const initial =
    controlledValue ?? selectedValue ?? defaultValue ?? tabs?.[0]?.value ?? "";
  const [value, setValue] = useState<string>(initial);

  useEffect(() => {
    if (!runtimeValueStore || !elementKey) return;
    if (runtimeValueStore.getValue(elementKey) !== undefined) return;
    if (runtimeValueStore.isTouched(elementKey)) return;
    runtimeValueStore.setValue(elementKey, value, { touched: false });
  }, [runtimeValueStore, elementKey, value]);

  function handleChange(next: string): void {
    setValue(next);
    if (runtimeValueStore && elementKey) {
      runtimeValueStore.setValue(elementKey, next);
    }
    onAction?.({ value: next });
  }

  return (
    <Tabs
      {...props}
      tabs={tabs as TabsItem[]}
      value={value}
      onValueChange={handleChange}
    />
  );
}
StatefulTabs.displayName = "StatefulTabs";

// =============================================================================
// StatefulCollapsible
// =============================================================================

interface StatefulCollapsibleProps {
  readonly label: string;
  readonly defaultOpen?: boolean;
  readonly open?: boolean;
  readonly onAction?: OnActionCallback;
  readonly children?: React.ReactNode;
  readonly [key: string]: unknown;
}

export function StatefulCollapsible({
  label,
  defaultOpen,
  open: controlledOpen,
  onAction,
  children,
  ...props
}: StatefulCollapsibleProps): React.JSX.Element {
  const runtimeValueStore = useRuntimeValueStoreContext();
  const elementKey =
    typeof props["data-key"] === "string" ? props["data-key"] : null;
  const [open, setOpen] = useState<boolean>(
    controlledOpen ?? defaultOpen ?? false,
  );

  useEffect(() => {
    if (!runtimeValueStore || !elementKey) return;
    if (runtimeValueStore.getValue(elementKey) !== undefined) return;
    if (runtimeValueStore.isTouched(elementKey)) return;
    runtimeValueStore.setValue(elementKey, open, { touched: false });
  }, [runtimeValueStore, elementKey, open]);

  function handleChange(next: boolean): void {
    setOpen(next);
    if (runtimeValueStore && elementKey) {
      runtimeValueStore.setValue(elementKey, next);
    }
    onAction?.({ open: next });
  }

  return (
    <Collapsible
      {...props}
      label={label}
      open={open}
      onOpenChange={handleChange}
    >
      {children}
    </Collapsible>
  );
}
StatefulCollapsible.displayName = "StatefulCollapsible";
