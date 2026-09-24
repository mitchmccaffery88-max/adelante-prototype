// Dev-only: exposes the in-memory store to browser checks so a walk-through
// can read what actually saved. Never runs in a production build.
import { AdelanteEHR } from "@/lib/ehr";
import { coverageWorklistRows } from "@/lib/coverageWorklist";
import { setActingRole, setActingStaff } from "@/lib/roles";

export function installDevInspect() {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  (window as unknown as { __adelante: unknown }).__adelante = {
    AdelanteEHR,
    coverageWorklistRows,
    setActingRole,
    setActingStaff,
  };
}
