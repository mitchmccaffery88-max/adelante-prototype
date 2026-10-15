import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

const StaffDensityContext = createContext(false);
const StaffNewContext = createContext<HTMLElement | null>(null);

export function StaffDensityProvider({ children }: { children: ReactNode }) {
  return <StaffDensityContext.Provider value>{children}</StaffDensityContext.Provider>;
}

/** React context follows portals; local member previews explicitly opt out in CSS. */
export function useStaffDensity() {
  return useContext(StaffDensityContext) ? "compact" : undefined;
}

export function StaffNewProvider({ target, children }: { target: HTMLElement | null; children: ReactNode }) {
  return <StaffNewContext.Provider value={target}>{children}</StaffNewContext.Provider>;
}

export function StaffNewTrigger({ children }: { children: ReactNode }) {
  const target = useContext(StaffNewContext);
  const density = useStaffDensity();
  if (target) return createPortal(children, target);
  return density ? null : children;
}