// §Privacy P1 — patient self-tracking (mood/check-in participation, cravings,
// lapses, recovery date) is visible to staff ONLY when the viewer can open the
// chart under the existing entry rules AND is on that patient's care team
// (case manager, primary clinician or prescriber of record). Narrowing only:
// no role gains anything. Billing roles never pass chart entry.
import { AdelanteEHR, type Patient } from "@/lib/ehr";
import { getActingStaff, type StaffRole } from "@/lib/roles";
import { chartEntryFor, onCareTeam } from "@/lib/chartAccess";

export function viewerSeesSelfTracking(role: StaffRole, staffId: string | undefined, patient: Patient | string): boolean {
  const p = typeof patient === "string" ? AdelanteEHR.getPatient(patient) : patient;
  if (!p || !staffId) return false;
  if (!chartEntryFor(role, staffId, p.id).ok) return false;
  return onCareTeam(staffId, p);
}

/** Same rule for the acting staff member (used where only a role is threaded). */
export function actingViewerSeesSelfTracking(role: StaffRole, patient: Patient): boolean {
  const s = getActingStaff();
  if (!s || s.role !== role) return false;
  return viewerSeesSelfTracking(role, s.id, patient);
}
