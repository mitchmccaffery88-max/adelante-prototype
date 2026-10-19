// §Group A #5 — staff-facing patient label for operations tables.
// Full name only when the viewer could open that chart under the EXISTING
// chart-entry rule (role + site, restricted records only for the care team or
// an already-unlocked open). Everyone else sees the program ID. Narrows only.
import { AdelanteEHR } from "@/lib/ehr";
import { chartEntryFor, isChartUnlocked } from "@/lib/chartAccess";
import type { StaffRole } from "@/lib/roles";

export function viewerCanOpenChart(viewer: { role: StaffRole; staffId?: string }, patientId: string): boolean {
  const e = chartEntryFor(viewer.role, viewer.staffId, patientId);
  return e.ok && (!e.restricted || e.careTeam || isChartUnlocked(viewer.staffId, patientId));
}

export function staffPatientLabel(viewer: { role: StaffRole; staffId?: string }, patientId: string): string {
  const p = AdelanteEHR.getPatient(patientId);
  if (!p) return "Unknown";
  return viewerCanOpenChart(viewer, patientId) ? `${p.firstName} ${p.lastName}` : p.programId;
}
