import { describe, it, expect } from "vitest";
import { createRuntimeValueStore } from "@/streaming/runtime-value-store";

describe("runtime value store", () => {
  it("sets/gets by elementKey and tracks touched", () => {
    const store = createRuntimeValueStore();

    expect(store.getValue("a")).toBeUndefined();
    expect(store.isTouched("a")).toBe(false);

    store.setValue("a", "hello");
    store.setValue("b", 123);

    expect(store.getValue("a")).toBe("hello");
    expect(store.getValue("b")).toBe(123);
    expect(store.isTouched("a")).toBe(true);
    expect(store.isTouched("b")).toBe(true);
    expect(store.isTouched("c")).toBe(false);
  });

  it("snapshots touched-only values", () => {
    const store = createRuntimeValueStore();

    store.setValue("a", "x");
    store.setValue("b", "y");

    expect(store.snapshotTouched()).toEqual({ a: "x", b: "y" });
  });

  it("clear resets values + touched", () => {
    const store = createRuntimeValueStore();

    store.setValue("a", "x");
    store.clear();

    expect(store.getValue("a")).toBeUndefined();
    expect(store.isTouched("a")).toBe(false);
    expect(store.snapshotTouched()).toEqual({});
  });
});
