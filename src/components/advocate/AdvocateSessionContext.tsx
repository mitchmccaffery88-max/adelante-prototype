// §Advocate Access Redesign Phase 2 (final) — the advocate shell became a real
// layout route with real child routes (view-switching, matching the patient
// shell). Children can't take props through `<Outlet />`, so the claimed link
// id — the only thing the "session" consists of — travels through this
// context. It carries NO authorization: every child still reads the live gate
// from the store on every render, exactly as before.
import { createContext, useContext } from "react";

export interface AdvocateSession {
  linkId: string;
  /** The name the advocate attested to, used for paperwork attestations. */
  attestedName: string;
  advocateName: string;
  signOut: () => void;
}

const Ctx = createContext<AdvocateSession | null>(null);

export const AdvocateSessionProvider = Ctx.Provider;

/** Non-null: the layout only renders `<Outlet />` once a link is claimed. */
export function useAdvocateSession(): AdvocateSession {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAdvocateSession must be used inside the /advocate layout");
  return v;
}
