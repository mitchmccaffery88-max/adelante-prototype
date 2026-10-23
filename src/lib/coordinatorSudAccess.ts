// Privacy P2: item-specific reads, never a screeners_sud/mutation matrix grant.
import type { Patient, ProgressNote } from "./ehr";
import type { StaffRole } from "./roles";
import { consentGate, coordinatorNeed, COUNSELING_NEED } from "./consentGate";

export const COORDINATOR_SUD_DRAFT = "Draft — pending clinical sign-off";
export const EMERGENCY_ACCESS_MS = 4 * 60 * 60 * 1000;
export const COORDINATOR_SUD_ITEMS = ["diagnoses", "treatment_plans", "medications", "adherence", "labs", "attendance", "discharge_summaries", "progress_notes"] as const;
export type CoordinatorSudItem = typeof COORDINATOR_SUD_ITEMS[number] | "counseling_notes";
export type EmergencyReason = "medical_emergency" | "audit_evaluation" | "court_order";
export const EMERGENCY_REASONS: Record<EmergencyReason, string> = {
  medical_emergency: "Bona fide medical emergency",
  audit_evaluation: "Audit/evaluation",
  court_order: "Part 2 court order",
};
export interface SudViewer { role: StaffRole; staffId?: string; name?: string }
export interface CoordinatorEmergencyGrant {
  patientId: string; staffId: string; reason: EmergencyReason; detail: string;
  reference?: string; start: string; end: string; disclosureId: string;
}
const grants = new Map<string, CoordinatorEmergencyGrant>();
const key = (staffId: string, patientId: string) => `${staffId}|${patientId}`;
export function coordinatorEmergencyFor(viewer: SudViewer, patientId: string, now = Date.now()) {
  if (viewer.role !== "clinical_coordinator" || !viewer.staffId) return undefined;
  const grant = grants.get(key(viewer.staffId, patientId));
  return grant && now >= Date.parse(grant.start) && now < Date.parse(grant.end) ? { ...grant } : undefined;
}
export function coordinatorSudCanRead(viewer: SudViewer, patient: Patient | undefined, item: CoordinatorSudItem, now = Date.now()): boolean {
  if (viewer.role !== "clinical_coordinator" || !patient) return false;
  // Separate release only. Neither general consent nor break-glass grants counseling.
  // §B2-4: a counseling_notes_release record decides; Part 2 TPO/specific never applies here.
  // B2-5: no live untyped writer exists for these scopes; the flags grant nothing.
  if (item === "counseling_notes") return consentGate(patient.id, COUNSELING_NEED, () => false, new Date(now));
  if (!(COORDINATOR_SUD_ITEMS as readonly string[]).includes(item)) return false;
  return coordinatorPart2Consent(patient, item, now) || !!coordinatorEmergencyFor(viewer, patient.id, now);
}
/** §B2-4 — coordinator Part 2 consent (program / care-coordination recipient, care-coordination purpose). Option A: no applicable typed record -> today's flag. */
export function coordinatorPart2Consent(patient: Patient, item: string, now = Date.now()): boolean {
  return consentGate(patient.id, coordinatorNeed(item), () => false, new Date(now));
}
export function coordinatorNoteCanRead(viewer: SudViewer, patient: Patient | undefined, note: Partial<ProgressNote>, now = Date.now()): boolean {
  if (note.restrictedTier === "psychotherapy_notes") return coordinatorSudCanRead(viewer, patient, "counseling_notes", now);
  // No group narrative, non-SUD clinical notes, or unstamped sensitive artifacts.
  return note.category === "sud" && !note.groupRef && coordinatorSudCanRead(viewer, patient, "progress_notes", now);
}
export function validateCoordinatorEmergency(input: { reason: string; detail: string; reference?: string }) {
  if (!Object.prototype.hasOwnProperty.call(EMERGENCY_REASONS, input.reason)) throw new Error("Choose an allowed reason.");
  if (!input.detail.trim()) throw new Error("Add detail for this decision.");
  if (input.reason !== "medical_emergency" && !input.reference?.trim()) throw new Error("A reference is required for audit/evaluation or a court order.");
}
export function saveCoordinatorEmergencyGrant(grant: CoordinatorEmergencyGrant) {
  grants.set(key(grant.staffId, grant.patientId), { ...grant });
}
/** Privacy P3 — re-lock now. Deletes the grant; never extends or widens it. */
export function endCoordinatorEmergencyGrant(staffId: string, patientId: string): CoordinatorEmergencyGrant | undefined {
  const k = key(staffId, patientId);
  const grant = grants.get(k);
  grants.delete(k);
  return grant ? { ...grant } : undefined;
}
export function _resetCoordinatorEmergencyForTests() { grants.clear(); }