// §EHR audit Phase 1e — linking a written progress note to the real attended
// visit it documents.
//
// THE REAL GAP THIS CLOSES
// ------------------------
// `ProgressNote.appointmentId` has always existed and the claim pipeline reads
// it (`noteSignFlow` mirrors a signature into `AdelanteEHRExt.signNote(apptId)`,
// which advances a linked claim `documented → signed`). But nothing in the UI
// ever set it, so that path was unreachable in practice.
//
// AUTOMATIC DEFAULT vs. EXPLICIT CHOICE
// -------------------------------------
// A default is only offered when it is genuinely unambiguous: exactly ONE
// attended, not-yet-documented appointment for this patient, with THIS author
// as the clinician, on the SAME calendar day as the note. That is the common
// real case (a clinician writes the note right after the visit) and there is
// nothing to guess.
//
// When two or more such visits exist the note could honestly document either
// one, so no default is produced and the clinician must choose. Everything
// else (other days, another clinician's visit) is offered in the picker but
// never auto-selected — a phone note or check-in legitimately has no visit at
// all, and inventing a link would fabricate billing documentation.

import type { Appointment, ProgressNote } from "@/lib/ehr";

export const NO_VISIT = "none";

export interface VisitLinkCandidate {
  appointment: Appointment;
  /** Same calendar day as the note and authored by this visit's clinician. */
  sameDayOwn: boolean;
}

export interface VisitLinkResolution {
  candidates: VisitLinkCandidate[];
  /** Appointment id to preselect, or undefined when there is nothing safe to pick. */
  defaultId?: string;
  /** True when more than one same-day own visit makes a default dishonest. */
  ambiguous: boolean;
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return Number.isFinite(+d) ? d.toISOString().slice(0, 10) : iso.slice(0, 10);
}

/**
 * Attended appointments for this patient that no note documents yet, newest
 * first. `documentedApptIds` comes from the patient's existing notes, so a
 * visit already written up is never offered twice.
 */
export function candidateVisitsForNote(
  appointments: Appointment[],
  notes: ProgressNote[],
  input: { patientId: string; authorId: string; noteDate: string; withinDays?: number },
): VisitLinkCandidate[] {
  const documented = new Set(notes.map((n) => n.appointmentId).filter(Boolean) as string[]);
  const withinMs = (input.withinDays ?? 30) * 86_400_000;
  const noteTs = Date.parse(input.noteDate);
  const noteDay = dayKey(input.noteDate);
  return appointments
    .filter((a) => a.patientId === input.patientId && a.status === "attended")
    .filter((a) => !documented.has(a.id))
    .filter((a) => {
      const ts = Date.parse(a.start);
      return !Number.isFinite(noteTs) || !Number.isFinite(ts) || noteTs - ts <= withinMs;
    })
    .sort((a, b) => b.start.localeCompare(a.start))
    .map((a) => ({
      appointment: a,
      sameDayOwn: a.clinicianId === input.authorId && dayKey(a.start) === noteDay,
    }));
}

export function resolveVisitLink(
  appointments: Appointment[],
  notes: ProgressNote[],
  input: { patientId: string; authorId: string; noteDate: string; withinDays?: number },
): VisitLinkResolution {
  const candidates = candidateVisitsForNote(appointments, notes, input);
  const own = candidates.filter((c) => c.sameDayOwn);
  if (own.length === 1)
    return { candidates, defaultId: own[0]!.appointment.id, ambiguous: false };
  return { candidates, ambiguous: own.length > 1 };
}
