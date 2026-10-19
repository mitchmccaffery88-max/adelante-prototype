// §Group A #2 — SUD (DMC-ODS) program classification in staff lists is
// Part 2 data. Uses the existing `screeners_sud` access only (no new roles):
// the filter option is offered to roles whose access is unconditional
// (therapist, pmhnp/physician, sud_counselor and any other "read" grant);
// consent-gated and no-access roles do not see it — hidden, not locked,
// matching how the chart hides the ASAM section (recordSectionGate.ts).
import { canAccess, type StaffRole } from "@/lib/roles";
import type { Patient } from "@/lib/ehr";

export function roleSeesSudProgram(role: StaffRole): boolean {
  const a = canAccess(role, "screeners_sud");
  return a.level !== "none" && !a.locked;
}

export function patientSudProgramVisible(role: StaffRole, patient: Patient): boolean {
  const a = canAccess(role, "screeners_sud", patient);
  return a.level !== "none" && !a.locked;
}
