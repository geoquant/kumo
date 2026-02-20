import React, { createContext, useContext } from "react";
import type { RuntimeValueStore } from "./runtime-value-store";

const Ctx = createContext<RuntimeValueStore | null>(null);

export function RuntimeValueStoreProvider({
  value,
  children,
}: {
  readonly value: RuntimeValueStore | null;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRuntimeValueStoreContext(): RuntimeValueStore | null {
  return useContext(Ctx);
}
