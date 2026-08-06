// §Group sessions — cross-system reporting helpers.
//
// Pure, live computations over the existing GroupSession / enrollment /
// occurrence records. No parallel summary store is created here, and nothing
// in this file invents regulatory content: no group-size limits, no billing
// codes, no curriculum. Where there is no data to measure, these helpers
// return `null` so the UI can say "no live metric yet" instead of a 0 that
// reads as a measured result.
import { AdelanteEHR, type GroupAttendanceEntry, type GroupSession } from "./ehr";

// ---------------------------------------------------------------------------
// Claims Worklist — group-sourced encounter identification.
// The encounterId shape is minted in `upsertClaimFromGroupAttendee`:
//   group:<sessionId>:<occurrenceStartISO>:<patientId>
// The ISO start itself contains colons, so parsing is anchored from both ends.
// ---------------------------------------------------------------------------
export interface GroupEncounterRef {
  sessionId: string;
  occurrenceStart: string;
  patientId: string;
}

export function parseGroupEncounterId(encounterId: string): GroupEncounterRef | null {
  if (!encounterId.startsWith("group:")) return null;
  const rest = encounterId.slice("group:".length);
  const first = rest.indexOf(":");
  const last = rest.lastIndexOf(":");
  if (first < 1 || last <= first) return null;
  return {
    sessionId: rest.slice(0, first),
    occurrenceStart: rest.slice(first + 1, last),
    patientId: rest.slice(last + 1),
  };
}

export interface OccurrencePeer {
  patientId: string;
  /** De-identified label — program ID only, matching the worklist's discipline. */
  programId: string;
  status: GroupAttendanceEntry["status"];
}

/**
 * Other patients present in the same occurrence. Program IDs only — the
 * Claims Worklist is a de-identified surface and group membership is itself
 * disclosure-sensitive.
 */
export function occurrencePeers(ref: GroupEncounterRef): OccurrencePeer[] {
  const occ = AdelanteEHR.getGroupOccurrence(ref.sessionId, ref.occurrenceStart);
  if (!occ) return [];
  const patients = AdelanteEHR.listPatients();
  return occ.attendance
    .filter((a) => a.patientId !== ref.patientId && a.status !== "absent")
    .map((a) => ({
      patientId: a.patientId,
      programId: patients.find((p) => p.id === a.patientId)?.programId ?? a.patientId,
      status: a.status,
    }));
}

export function groupTopicFor(sessionId: string): string | undefined {
  return AdelanteEHR.getGroupSession(sessionId)?.topic;
}

// ---------------------------------------------------------------------------
// Admin pilot dashboard — live group activity.
// ---------------------------------------------------------------------------

/** Groups that are not cancelled and still have at least one active enrollee. */
export function activeGroupSessions(): GroupSession[] {
  return AdelanteEHR.listGroupSessions().filter(
    (g) => g.status !== "cancelled" && AdelanteEHR.listGroupEnrollments(g.id).length > 0,
  );
}

export interface WeeklyGroupSeat {
  sessionId: string;
  topic: string;
  occurrenceStart: string;
  patientId: string;
}

/**
 * Enrolled-patient-occurrences in the next 7 days: one row per (occurrence ×
 * actively enrolled patient). This is the scheduled group workload, which the
 * 1:1 Appointment model can't see at all.
 */
export function weeklyGroupSeats(now = new Date()): WeeklyGroupSeat[] {
  const from = now.getTime();
  const to = from + 7 * 86_400_000;
  const out: WeeklyGroupSeat[] = [];
  for (const g of AdelanteEHR.listGroupSessions()) {
    if (g.status === "cancelled") continue;
    const roster = AdelanteEHR.listGroupEnrollments(g.id);
    if (roster.length === 0) continue;
    for (const start of AdelanteEHR.groupOccurrenceStarts(g.id, 14)) {
      const t = Date.parse(start);
      if (!Number.isFinite(t) || t < from || t > to) continue;
      for (const e of roster) {
        out.push({ sessionId: g.id, topic: g.topic, occurrenceStart: start, patientId: e.patientId });
      }
    }
  }
  return out.sort((a, b) => a.occurrenceStart.localeCompare(b.occurrenceStart));
}

export interface NextGroupOccurrence {
  sessionId: string;
  topic: string;
  start: string;
}

/** Soonest future occurrence across every group the patient is enrolled in. */
export function nextGroupOccurrenceForPatient(
  patientId: string,
  now = new Date(),
): NextGroupOccurrence | null {
  let best: NextGroupOccurrence | null = null;
  for (const g of AdelanteEHR.groupsForPatient(patientId)) {
    for (const start of AdelanteEHR.groupOccurrenceStarts(g.id, 14)) {
      const t = Date.parse(start);
      if (!Number.isFinite(t) || t <= now.getTime()) continue;
      if (!best || start < best.start) best = { sessionId: g.id, topic: g.topic, start };
      break;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Population health — group attendance rate.
// ---------------------------------------------------------------------------
export interface GroupAttendanceBreakdown {
  present: number;
  late: number;
  absent: number;
  denominator: number;
  /** null when no attendance has ever been recorded — not 0%. */
  pct: number | null;
  occurrencesRecorded: number;
}

export const GROUP_WINDOW_DAYS = 30;

/**
 * (present + late) / all recorded attendance entries across occurrences whose
 * attendance was actually taken in the trailing window. Occurrences with no
 * recorded attendance are excluded entirely — an untaken roster is missing
 * data, not a 0% turnout.
 */
export function groupAttendanceRate(
  now = new Date(),
  days = GROUP_WINDOW_DAYS,
): GroupAttendanceBreakdown {
  const from = now.getTime() - days * 86_400_000;
  let present = 0;
  let late = 0;
  let absent = 0;
  let occurrencesRecorded = 0;
  for (const g of AdelanteEHR.listGroupSessions()) {
    for (const occ of AdelanteEHR.listGroupOccurrenceRecords(g.id)) {
      if (!occ.attendanceRecordedAt || occ.attendance.length === 0) continue;
      const t = Date.parse(occ.occurrenceStart);
      if (!Number.isFinite(t) || t < from || t > now.getTime()) continue;
      occurrencesRecorded++;
      for (const a of occ.attendance) {
        if (a.status === "present") present++;
        else if (a.status === "late") late++;
        else absent++;
      }
    }
  }
  const denominator = present + late + absent;
  return {
    present,
    late,
    absent,
    denominator,
    occurrencesRecorded,
    pct: denominator === 0 ? null : ((present + late) / denominator) * 100,
  };
}

export interface GroupAbsenceRow {
  patientId: string;
  patientName: string;
  topic: string;
  occurrenceStart: string;
  status: GroupAttendanceEntry["status"];
}

/** The absent entries dragging the attendance rate down — drill-down rows. */
export function groupAbsences(now = new Date(), days = GROUP_WINDOW_DAYS): GroupAbsenceRow[] {
  const from = now.getTime() - days * 86_400_000;
  const patients = AdelanteEHR.listPatients();
  const rows: GroupAbsenceRow[] = [];
  for (const g of AdelanteEHR.listGroupSessions()) {
    for (const occ of AdelanteEHR.listGroupOccurrenceRecords(g.id)) {
      if (!occ.attendanceRecordedAt) continue;
      const t = Date.parse(occ.occurrenceStart);
      if (!Number.isFinite(t) || t < from || t > now.getTime()) continue;
      for (const a of occ.attendance) {
        if (a.status === "present") continue;
        const p = patients.find((x) => x.id === a.patientId);
        rows.push({
          patientId: a.patientId,
          patientName: p ? `${p.firstName} ${p.lastName}` : a.patientId,
          topic: g.topic,
          occurrenceStart: occ.occurrenceStart,
          status: a.status,
        });
      }
    }
  }
  return rows.sort((a, b) => b.occurrenceStart.localeCompare(a.occurrenceStart));
}

/** Distinct patients with at least one active group enrollment. */
export function enrolledPatientCount(): number {
  const ids = new Set<string>();
  for (const g of AdelanteEHR.listGroupSessions()) {
    if (g.status === "cancelled") continue;
    for (const e of AdelanteEHR.listGroupEnrollments(g.id)) ids.add(e.patientId);
  }
  return ids.size;
}

// ---------------------------------------------------------------------------
// Staff dashboard — attendance + note-completion per occurrence.
//
// Two shapes on purpose:
//   • `occurrenceStatus`  — AGGREGATE COUNTS ONLY, no patient identifiers.
//     Safe at the lower `group_sessions` (schedule-management) gate.
//   • `occurrenceOwedAttendees` — names WHICH patients still owe an
//     individualized note. That is PHI + group membership, so callers MUST
//     hold `group_notes` access (same tier as the notes themselves).
//
// "Complete" is defined by the same rule `documentGroupOccurrence` enforces:
// every PRESENT (or late) attendee has their own individualized note.
// ---------------------------------------------------------------------------
export interface OccurrenceStatus {
  sessionId: string;
  occurrenceStart: string;
  attendanceRecorded: boolean;
  present: number;
  late: number;
  absent: number;
  /** Present/late attendees with an individualized note on file. */
  notesComplete: number;
  /** Present/late attendees still owing an individualized note. */
  notesOwed: number;
  sharedNoteSigned: boolean;
}

function attendeesOwing(sessionId: string, occurrenceStart: string): string[] {
  const occ = AdelanteEHR.getGroupOccurrence(sessionId, occurrenceStart);
  if (!occ) return [];
  return occ.attendance
    .filter((a) => a.status !== "absent" && !occ.attendeeNoteIds[a.patientId])
    .map((a) => a.patientId);
}

export function occurrenceStatus(sessionId: string, occurrenceStart: string): OccurrenceStatus {
  const occ = AdelanteEHR.getGroupOccurrence(sessionId, occurrenceStart);
  const attendance = occ?.attendance ?? [];
  const present = attendance.filter((a) => a.status === "present").length;
  const late = attendance.filter((a) => a.status === "late").length;
  const absent = attendance.filter((a) => a.status === "absent").length;
  const owed = attendeesOwing(sessionId, occurrenceStart).length;
  const expected = present + late;
  return {
    sessionId,
    occurrenceStart,
    attendanceRecorded: !!occ?.attendanceRecordedAt,
    present,
    late,
    absent,
    notesComplete: expected - owed,
    notesOwed: owed,
    sharedNoteSigned: !!occ?.sharedNote?.signedAt || !!occ?.sharedNote,
  };
}

/** Upcoming + already-materialized occurrences, newest scheduled first. */
export function occurrenceStatuses(sessionId: string, count = 6): OccurrenceStatus[] {
  const starts = new Set(AdelanteEHR.groupOccurrenceStarts(sessionId, count));
  for (const occ of AdelanteEHR.listGroupOccurrenceRecords(sessionId)) starts.add(occ.occurrenceStart);
  return [...starts]
    .sort((a, b) => b.localeCompare(a))
    .map((s) => occurrenceStatus(sessionId, s));
}

export interface OwedAttendee {
  patientId: string;
  patientName: string;
}

/**
 * PHI — caller must already hold `group_notes` access. Returns the specific
 * patients whose individualized note is still missing for this occurrence.
 */
export function occurrenceOwedAttendees(
  sessionId: string,
  occurrenceStart: string,
): OwedAttendee[] {
  const patients = AdelanteEHR.listPatients();
  return attendeesOwing(sessionId, occurrenceStart).map((id) => {
    const p = patients.find((x) => x.id === id);
    return { patientId: id, patientName: p ? `${p.firstName} ${p.lastName}` : id };
  });
}