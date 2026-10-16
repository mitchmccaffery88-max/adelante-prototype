import { createContext, useContext, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
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
  // A launcher owns the slot only on the page it mounted on: while the next
  // page loads, the previous page's "+ New" leaves instead of lingering.
  // Compared by first path segment so /record/a → /record/b keeps the chart launcher.
  const pathname = useRouterState({ select: (s) => s.location.pathname.split("/")[1] ?? "" });
  const [ownPath] = useState(pathname);
  if (pathname !== ownPath) return null;
  if (target) return createPortal(children, target);
  return density ? null : children;
}