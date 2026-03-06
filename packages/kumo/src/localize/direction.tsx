import { createContext, useContext, type ReactNode } from "react";

// ── Types ──────────────────────────────────────────────────────────────

/** Text direction value. */
export type Direction = "ltr" | "rtl";

// ── Context ────────────────────────────────────────────────────────────

/**
 * `undefined` means no provider is present — `useDirection()` defaults
 * to `"ltr"`.
 */
const DirectionContext = createContext<Direction | undefined>(undefined);

// ── DirectionProvider ──────────────────────────────────────────────────

interface DirectionProviderProps {
  /** Text direction for this subtree. */
  readonly direction: Direction;
  readonly children: ReactNode;
}

/**
 * Provide an explicit text direction for a subtree.
 *
 * Nestable — the innermost provider wins.
 *
 * @example
 * ```tsx
 * <DirectionProvider direction="rtl">
 *   <MyComponent />
 * </DirectionProvider>
 * ```
 */
export function DirectionProvider({
  direction,
  children,
}: DirectionProviderProps): ReactNode {
  return (
    <DirectionContext.Provider value={direction}>
      {children}
    </DirectionContext.Provider>
  );
}
DirectionProvider.displayName = "DirectionProvider";

// ── useDirection ───────────────────────────────────────────────────────

/**
 * Read the current text direction.
 *
 * Returns the value from the nearest {@link DirectionProvider}, or
 * `"ltr"` when no provider is present.
 */
export function useDirection(): Direction {
  return useContext(DirectionContext) ?? "ltr";
}
