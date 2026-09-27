// §B7 — optional free text on the recovery "thought about using" check-in.
// Private to the patient by default. Every save goes through the same crisis
// scanner chat uses. Staff see a note only if the patient shared it AND the
// viewer's role passes the existing Part 2 (sud_treatment) consent check.
import { AdelanteEHR, type Patient } from "@/lib/ehr";
import { canAccess, type StaffRole } from "@/lib/roles";
import { scanTextForCrisis } from "@/lib/crisisTextDetection";

export const RECOVERY_NOTE_MAX = 300;
/** Lessons whose check-in gets the text box. */
export const RECOVERY_NOTE_LESSONS = ["fdo-tolerance-and-overdose"];

export interface RecoveryCheckInNote {
  id: string;
  patientId: string;
  lessonId: string;
  text: string;
  shared: boolean;
  savedAt: string;
}

const notes: RecoveryCheckInNote[] = [];
let n = 0;

export function saveRecoveryCheckInNote(input: {
  patientId: string;
  lessonId: string;
  text: string;
  shared: boolean;
}): RecoveryCheckInNote | undefined {
  const text = input.text.trim().slice(0, RECOVERY_NOTE_MAX);
  if (!text) return undefined;
  const existing = notes.find((x) => x.patientId === input.patientId && x.lessonId === input.lessonId);
  const row: RecoveryCheckInNote = existing ?? {
    id: `rcn-${++n}`,
    patientId: input.patientId,
    lessonId: input.lessonId,
    text,
    shared: input.shared,
    savedAt: "",
  };
  row.text = text;
  row.shared = input.shared;
  row.savedAt = new Date().toISOString();
  if (!existing) notes.push(row);
  // Same scanner as chat; the escalation never copies the text.
  scanTextForCrisis(input.patientId, text, { surface: "a recovery check-in" });
  // Audit records only that a share happened — never the text.
  if (input.shared)
    AdelanteEHR.recordCaseloadAudit({
      action: "recovery_checkin_shared",
      actorId: input.patientId,
      actorRole: "patient",
      patientId: input.patientId,
      detail: { lessonId: input.lessonId },
    });
  else AdelanteEHR.recordCaseloadAudit({ action: "recovery_checkin_saved_private", actorId: input.patientId, actorRole: "patient", patientId: input.patientId, detail: {} });
  return { ...row };
}

/** The patient's own notes (always visible to them). */
export function myRecoveryCheckInNote(patientId: string, lessonId: string) {
  return notes.find((x) => x.patientId === patientId && x.lessonId === lessonId);
}

/** Staff read: shared only, and the role must clear the live Part 2 check. */
export function staffVisibleRecoveryNotes(patient: Patient, role: StaffRole): RecoveryCheckInNote[] {
  const g = canAccess(role, "sud_treatment", patient);
  if (g.level === "none" || g.locked) return [];
  return notes.filter((x) => x.patientId === patient.id && x.shared);
}

export function __resetRecoveryCheckInNotes() {
  notes.length = 0;
}
