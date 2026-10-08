// Dev-only: exposes the in-memory store to browser checks so a walk-through
// can read what actually saved. Never runs in a production build.
import { AdelanteEHR } from "@/lib/ehr";
import { coverageWorklistRows } from "@/lib/coverageWorklist";
import { setActingRole, setActingStaff } from "@/lib/roles";
import { setInFacilityEnabled } from "@/lib/inFacility";

export function installDevInspect(navigate?: (to: string) => void) {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  (window as unknown as { __adelante: unknown }).__adelante = {
    AdelanteEHR,
    coverageWorklistRows,
    setActingRole,
    setActingStaff,
    // In-memory only; resets on reload, so the product default (OFF) is untouched.
    setInFacilityEnabled,
    go: (to: string) => navigate?.(to),
    j: null as unknown,
    /** §C5 Same module instances the app uses (a bare "/src/..." import can duplicate them). */
    content: async () => {
      const [cp, ct, tags, sc, eng] = await Promise.all([
        import("@/lib/contentPublishing"),
        import("@/lib/contentTypes"),
        import("@/lib/contentTags"),
        import("@/lib/structuredCarePlan"),
        import("@/lib/engagement"),
      ]);
      return { cp, ct, tags, sc, eng };
    },
    /** V1 — Brief consistency check over every patient × staff role. */
    checkBrief: async () => {
      const [{ checkAllBriefs }, { STAFF_ROLES }] = await Promise.all([import("@/lib/adelBriefCheck"), import("@/lib/roles")]);
      return checkAllBriefs(STAFF_ROLES.map((r) => r.key));
    },
  };
  void import("@/lib/devJourneys").then((m) => {
    (window as unknown as { __adelante: { j: unknown } }).__adelante.j = m;
  });
}
