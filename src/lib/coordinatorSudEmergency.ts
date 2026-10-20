import { AdelanteEHR } from "./ehr";
import { chartEntryFor, registerEmergencyReviewItem } from "./chartAccess";
import { disclose, recordEmergencyAccessEnded } from "./part2Disclosure";
import { auditSafeReason } from "./actions/runAction";
import { EMERGENCY_ACCESS_MS, coordinatorEmergencyFor, endCoordinatorEmergencyGrant, saveCoordinatorEmergencyGrant, validateCoordinatorEmergency, type EmergencyReason, type SudViewer } from "./coordinatorSudAccess";

export function canUnlockCoordinatorEmergency(viewer: SudViewer, patientId?: string): boolean {
  return viewer.role === "clinical_coordinator" && !!viewer.staffId && !!patientId && chartEntryFor(viewer.role, viewer.staffId, patientId).ok;
}
export function unlockCoordinatorEmergency(input: { patientId: string; actor: SudViewer; reason: EmergencyReason; detail: string; reference?: string }) {
  if (!canUnlockCoordinatorEmergency(input.actor, input.patientId) || !input.actor.staffId) throw new Error("Emergency access is not available for this chart.");
  validateCoordinatorEmergency(input);
  const patient = AdelanteEHR.getPatient(input.patientId);
  if (!patient) throw new Error("Client not found.");
  const start = new Date().toISOString();
  const end = new Date(Date.parse(start) + EMERGENCY_ACCESS_MS).toISOString();
  const detail = auditSafeReason(input.detail, patient) ?? "";
  const reference = auditSafeReason(input.reference, patient);
  const result = disclose({ patientId: input.patientId,
    actor: { name: input.actor.name ?? input.actor.staffId, role: input.actor.role, staffId: input.actor.staffId },
    recipient: { name: "Internal compliance review", type: "internal" },
    purpose: "Patient-specific emergency access review", channel: "coordinator_emergency",
    recordClasses: ["SUD diagnoses", "SUD treatment notes", "SUD medications"], simulated: true,
    emergency: { reason: input.reason, exception: input.reason, detail, reference, start, end },
  });
  if (!result.ok || !result.entry) throw new Error(result.ok ? "Disclosure review was not recorded." : result.reason);
  const grant = { patientId: input.patientId, staffId: input.actor.staffId, reason: input.reason, detail, reference, start, end, disclosureId: result.entry.id };
  saveCoordinatorEmergencyGrant(grant);
  registerEmergencyReviewItem({ patientId: input.patientId, actorId: input.actor.staffId, actorName: input.actor.name ?? input.actor.staffId, role: input.actor.role, at: start, disclosureId: result.entry.id, medicalFollowUp: input.reason === "medical_emergency" });
  const event = AdelanteEHR.listAuditEvents({ patientId: input.patientId }).find((e) => e.action === "part2_emergency_disclosure" && e.detail?.disclosureLogId === result.entry?.id);
  if (!event) throw new Error("Access audit was not recorded.");
  AdelanteEHR._emit();
  return { grant, event };
}
/** Privacy P3 — only the coordinator who opened an active window may end it. */
export function canEndCoordinatorEmergency(viewer: SudViewer, patientId?: string, now = Date.now()): boolean {
  return viewer.role === "clinical_coordinator" && !!viewer.staffId && !!patientId && !!coordinatorEmergencyFor(viewer, patientId, now);
}
export function endCoordinatorEmergencyNow(input: { patientId: string; actor: SudViewer; note?: string }) {
  const { actor, patientId } = input;
  if (!canEndCoordinatorEmergency(actor, patientId) || !actor.staffId) throw new Error("There is no emergency access window of yours to end.");
  const patient = AdelanteEHR.getPatient(patientId);
  if (!patient) throw new Error("Client not found.");
  const endedAt = new Date().toISOString();
  const grant = endCoordinatorEmergencyGrant(actor.staffId, patientId);
  if (!grant) throw new Error("There is no emergency access window of yours to end.");
  recordEmergencyAccessEnded(grant.disclosureId, endedAt);
  const note = auditSafeReason(input.note?.trim() || undefined, patient);
  AdelanteEHR._recordAudit({ category: "access", action: "part2_emergency_ended_early", patientId,
    actorId: actor.staffId, actorRole: actor.role,
    detail: { actorName: actor.name ?? actor.staffId, patientId, disclosureLogId: grant.disclosureId, start: grant.start, scheduledEnd: grant.end, end: endedAt, endedEarly: true, ...(note ? { note } : {}), simulated: true } });
  const event = AdelanteEHR.listAuditEvents({ patientId }).find((e) => e.action === "part2_emergency_ended_early" && e.detail?.disclosureLogId === grant.disclosureId);
  if (!event) throw new Error("Access audit was not recorded.");
  AdelanteEHR._emit();
  return { grant: { ...grant, end: endedAt }, event };
}
