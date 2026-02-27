import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface BreadcrumbPortalContextValue {
  target: HTMLElement | null;
  setTarget: (el: HTMLElement | null) => void;
}

const BreadcrumbPortalContext = createContext<BreadcrumbPortalContextValue>({
  target: null,
  setTarget: () => {},
});

export function BreadcrumbPortalProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  return (
    <BreadcrumbPortalContext.Provider value={{ target, setTarget }}>
      {children}
    </BreadcrumbPortalContext.Provider>
  );
}

export function useRegisterBreadcrumbPortalTarget() {
  const { setTarget } = useContext(BreadcrumbPortalContext);
  return useCallback(
    (el: HTMLElement | null) => {
      setTarget(el);
    },
    [setTarget],
  );
}

export function BreadcrumbPortal({ children }: { children: ReactNode }) {
  const { target } = useContext(BreadcrumbPortalContext);
  if (!target) return null;
  return createPortal(children, target);
}
