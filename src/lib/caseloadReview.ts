// §Item 7 — Case manager weekly caseload review.
// One place for the draft contact cadence, contact logging, the Part 2-safe
// check-in summary, week sign-off and the coordinator roll-up.
import { moodCheckInDayCount } from "@/lib/moodCheckInCount";
import { AdelanteEHR, type Patient } from "@/lib/ehr";
import { STAFF_ROSTER, canAccess, type StaffRole } from "@/lib/roles";
import { roleSeesAsamSection } from "@/lib/asamReporting";
import { isShortFormPositive, shortFormByKey } from "@/lib/screeners";

/** DRAFT — pending clinical sign-off. The only place the cadence lives. */
export const CONTACT_CADENCE = {
  label: "Draft — pending clinical sign-off",
  intensiveWindowDays: 90,
  intensiveIntervalDays: 7, // one contact per week during the first 90 days
  maintenanceIntervalDays: 14,
  dueWithinDays: 2, // "due" this many days before the interval runs out
};

export type CaseloadStatus = "on_track" | "due" | "overdue";
export const STATUS_LABEL: Record<CaseloadStatus, string> = {
  on_track: "On track",
  due: "Due",
  overdue: "Overdue",
};

export type ContactType = "call" | "text" | "in_person" | "video" | "attempt";
export const CONTACT_TYPE_LABEL: Record<ContactType, string> = {
  call: "Call",
  text: "Text",
  in_person: "In person",
  video: "Video",
  attempt: "Attempted / no answer",
};

export const NOTE_HINT = "Keep it short. Don't include substance use details.";
export const NOTE_MAX = 280;

export interface CaseloadActor {
  id: string;
  name: string;
  role: StaffRole;
}

import { canSeeRollup, canUseCaseloadReview } from "@/lib/caseloadRoles";
export { CASELOAD_ROLES, ROLLUP_ROLES, canSeeRollup, canUseCaseloadReview, canOpenCaseloadReview } from "@/lib/caseloadRoles";

/** Staff identities that own a caseload record (cm id). */
const EXTRA_OWNERS: Record<string, { cmId: string; role: "ecm_provider" | "care_manager" }> = {
  "s-cm1": { cmId: "cm3", role: "ecm_provider" }, // Luz Herrera
  "s-cf2": { cmId: "cm4", role: "care_manager" }, // Darnell Pope
};

export function ensureCaseloadOwners() {
  for (const [staffId, o] of Object.entries(EXTRA_OWNERS)) {
    const s = STAFF_ROSTER.find((x) => x.id === staffId);
    if (s) AdelanteEHR.registerCaseManager({ id: o.cmId, name: s.name, role: o.role });
  }
}

export function caseManagerIdFor(staffId: string): string | undefined {
  return EXTRA_OWNERS[staffId]?.cmId ?? STAFF_ROSTER.find((s) => s.id === staffId)?.caseManagerId;
}

export function caseloadFor(staffId: string): Patient[] {
  const cm = caseManagerIdFor(staffId);
  return cm ? AdelanteEHR.patientsForCaseManager(cm) : [];
}

// ---------------------------------------------------------------- contacts
export interface ContactLog {
  id: string;
  patientId: string;
  type: ContactType;
  date: string; // YYYY-MM-DD
  note?: string;
  authorId: string;
  authorName: string;
  authorRole: StaffRole;
  createdAt: string;
}
const contacts: ContactLog[] = [];
const reviews: { staffId: string; weekKey: string; at: string; byName: string }[] = [];
let n = 0;

const DAY = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

export function logContact(
  actor: CaseloadActor,
  input: { patientId: string; type: ContactType; date: string; note?: string; now?: Date },
): ContactLog {
  if (!canUseCaseloadReview(actor.role)) throw new Error("Only case managers and ECM providers can log contacts.");
  if (!CONTACT_TYPE_LABEL[input.type]) throw new Error("Pick a contact type.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("Pick a date.");
  if (input.date > ymd(input.now ?? new Date())) throw new Error("The date can't be in the future.");
  const note = input.note?.trim().slice(0, NOTE_MAX) || undefined;
  const row: ContactLog = {
    id: `ctl-${++n}`,
    patientId: input.patientId,
    type: input.type,
    date: input.date,
    note,
    authorId: actor.id,
    authorName: actor.name,
    authorRole: actor.role,
    createdAt: new Date().toISOString(),
  };
  contacts.push(row);
  // Note text never goes into the audit row.
  AdelanteEHR.recordCaseloadAudit({
    action: input.type === "attempt" ? "caseload_attempt_logged" : "caseload_contact_logged",
    actorId: actor.id,
    actorRole: actor.role,
    patientId: input.patientId,
    detail: { type: input.type, date: input.date, byName: actor.name, hasNote: !!note },
  });
  return row;
}

export function listContacts(patientId: string): ContactLog[] {
  return contacts.filter((c) => c.patientId === patientId).sort((a, b) => b.date.localeCompare(a.date));
}

/** Own notes always; another role's notes only if the existing case-notes check allows. */
export function canSeeContactNote(c: ContactLog, viewer: { id: string; role: StaffRole }): boolean {
  if (c.authorId === viewer.id) return true;
  if (c.authorRole === viewer.role) return true;
  if (canSeeRollup(viewer.role)) return false;
  return canAccess(viewer.role, "case_notes").level !== "none";
}

// ---------------------------------------------------------------- weeks
export function weekStart(now: Date = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(+d - dow * DAY);
}
export const weekKey = (now: Date = new Date()) => ymd(weekStart(now));

// ---------------------------------------------------------------- status
export interface PatientCaseloadRow {
  patient: Patient;
  lastContact?: string;
  contactsThisWeek: number;
  attemptsThisWeek: number;
  status: CaseloadStatus;
  intervalDays: number;
  carriedOver: boolean;
}

export function patientStatus(patient: Patient, staffId: string, now: Date = new Date()): PatientCaseloadRow {
  const all = listContacts(patient.id);
  const real = all.filter((c) => c.type !== "attempt");
  const ws = ymd(weekStart(now));
  const enrolledDays = patient.enrolledAt ? (+now - +new Date(patient.enrolledAt)) / DAY : Infinity;
  const intervalDays =
    enrolledDays <= CONTACT_CADENCE.intensiveWindowDays
      ? CONTACT_CADENCE.intensiveIntervalDays
      : CONTACT_CADENCE.maintenanceIntervalDays;
  const lastContact = real[0]?.date;
  let status: CaseloadStatus = "overdue";
  if (lastContact) {
    const since = Math.floor((+new Date(ymd(now)) - +new Date(lastContact)) / DAY);
    status =
      since > intervalDays ? "overdue" : since >= intervalDays - CONTACT_CADENCE.dueWithinDays ? "due" : "on_track";
  }
  const prevWeek = ymd(new Date(+weekStart(now) - 7 * DAY));
  return {
    patient,
    lastContact,
    contactsThisWeek: real.filter((c) => c.date >= ws).length,
    attemptsThisWeek: all.filter((c) => c.type === "attempt" && c.date >= ws).length,
    status,
    intervalDays,
    carriedOver: status !== "on_track" && !isWeekReviewed(staffId, prevWeek),
  };
}

// ---------------------------------------------------------------- check-ins
export type Trend = "improving" | "steady" | "worse" | "not enough check-ins";
export interface CheckInSummary {
  daysThisWeek: number;
  trend: Trend;
  followUpSuggested: boolean;
  /** Days with a patient mood check-in this week — a count only. */
  moodDaysThisWeek: number;
}

/**
 * Participation + trend word + a bare follow-up flag, from the quick checks
 * already in the clinical record. Never returns a score, an item answer, or
 * the reason for the flag. Daily mood check-ins live in the patient-private
 * store and are never read by staff surfaces. Only non-SUD short forms
 * (PHQ-2 / GAD-2) are read, so nothing SUD-related can surface.
 */
export function checkInSummary(patient: Patient, _viewerRole: StaffRole, now: Date = new Date()): CheckInSummary {
  const ws = ymd(weekStart(now));
  const quick = (patient.screenerHistory ?? []).filter((h) => shortFormByKey(h.key));
  const days = new Set(quick.map((h) => h.completedAt.slice(0, 10)).filter((d) => d >= ws && d <= ymd(now)));
  // PHQ-2 series (GAD-2 as fallback), oldest → newest; scores stay internal.
  const pick = (k: string) => quick.filter((h) => h.key === k).map((h) => h.score);
  const series = pick("phq-2").length >= 2 ? pick("phq-2") : pick("gad-2");
  let trend: Trend = "not enough check-ins";
  if (series.length >= 2) {
    const d = series[series.length - 1] - series[series.length - 2];
    trend = d < 0 ? "improving" : d > 0 ? "worse" : "steady";
  }
  const since = +now - 14 * DAY;
  const followUpSuggested = quick.some((h) => {
    const def = shortFormByKey(h.key)!;
    return +new Date(h.completedAt) >= since && isShortFormPositive(def, h.score);
  });
  return { daysThisWeek: days.size, trend, followUpSuggested, moodDaysThisWeek: moodCheckInDayCount(patient.id, ws, ymd(now)) };
}

// ---------------------------------------------------------------- review
export function isWeekReviewed(staffId: string, wk: string = weekKey()): boolean {
  return reviews.some((r) => r.staffId === staffId && r.weekKey === wk);
}
export function weekReview(staffId: string, wk: string = weekKey()) {
  return reviews.find((r) => r.staffId === staffId && r.weekKey === wk);
}
export function markWeekReviewed(actor: CaseloadActor, now: Date = new Date()) {
  if (!canUseCaseloadReview(actor.role)) throw new Error("Only case managers and ECM providers review a caseload.");
  const wk = weekKey(now);
  const existing = weekReview(actor.id, wk);
  if (existing) return existing;
  const row = { staffId: actor.id, weekKey: wk, at: now.toISOString(), byName: actor.name };
  reviews.push(row);
  AdelanteEHR.recordCaseloadAudit({
    action: "caseload_week_reviewed",
    actorId: actor.id,
    actorRole: actor.role,
    detail: { weekKey: wk, byName: actor.name, patients: caseloadFor(actor.id).length },
  });
  return row;
}

// ---------------------------------------------------------------- roll-up
export interface RollupRow {
  staffId: string;
  name: string;
  on_track: number;
  due: number;
  overdue: number;
  reviewed: boolean;
}
/** Counts only — never note content. */
export function caseloadRollup(now: Date = new Date()): RollupRow[] {
  ensureCaseloadOwners();
  const ids = [...Object.keys(EXTRA_OWNERS), ...STAFF_ROSTER.filter((s) => s.caseManagerId).map((s) => s.id)];
  return ids
    .map((id) => {
      const s = STAFF_ROSTER.find((x) => x.id === id);
      const rows = caseloadFor(id).map((p) => patientStatus(p, id, now));
      return {
        staffId: id,
        name: s?.name ?? id,
        on_track: rows.filter((r) => r.status === "on_track").length,
        due: rows.filter((r) => r.status === "due").length,
        overdue: rows.filter((r) => r.status === "overdue").length,
        reviewed: isWeekReviewed(id, weekKey(now)),
      };
    })
    .filter((r) => r.on_track + r.due + r.overdue > 0);
}

// ---------------------------------------------------------------- demo
let seeded = false;
/** Demo: Luz and Darnell each get a mixed caseload through the normal functions. */
export function seedCaseloadDemo(now: Date = new Date()) {
  if (seeded) return;
  seeded = true;
  ensureCaseloadOwners();
  const find = (first: string, last: string) =>
    AdelanteEHR.listPatients().find((p) => p.firstName === first && p.lastName.startsWith(last));
  const luz: CaseloadActor = { id: "s-cm1", name: "Luz Herrera", role: "ecm_provider" };
  const darnell: CaseloadActor = { id: "s-cf2", name: "Darnell Pope (facility contract)", role: "cf_care_manager" };
  const ago = (d: number) => ymd(new Date(+now - d * DAY));
  const plan: [CaseloadActor, string, string, number | null, boolean][] = [
    // actor, first, last, days since last real contact (null = none), add attempt
    [luz, "Jordan", "Vega", 1, false], // on track
    [luz, "Carmen", "Ibarra", 5, false], // due
    [luz, "Tomás", "Reyna", 12, true], // overdue + unanswered attempt
    [darnell, "Luis", "Camacho", 2, false], // on track (SUD data on chart)
    [darnell, "Jasmine", "Holt", 6, false], // due
    [darnell, "Elena", "Vargas", null, true], // overdue, attempt only
  ];
  for (const [actor, first, last, since, attempt] of plan) {
    const p = find(first, last);
    if (!p) continue;
    if (!p.caseManagerId)
      AdelanteEHR.assignCaseManager({ patientId: p.id, caseManagerId: caseManagerIdFor(actor.id)!, actorId: "demo seed" });
    if (p.caseManagerId !== caseManagerIdFor(actor.id)) continue;
    if (since !== null)
      logContact(actor, { patientId: p.id, type: since < 3 ? "call" : "in_person", date: ago(since), note: "Checked in about housing paperwork.", now });
    if (attempt) logContact(actor, { patientId: p.id, type: "attempt", date: ago(1), now });
  }
  // Quick checks (normal patient function): participation + trend; Jordan's
  // latest is positive → "Clinical follow-up suggested" (reason never shown).
  const jordan = find("Jordan", "Vega");
  const luis = find("Luis", "Camacho");
  const quick = (id: string, phq: number[], gad: number[]) =>
    AdelanteEHR.recordQuickCheck(id, { "phq-2": phq, "gad-2": gad }, { actorRole: "patient" });
  if (luis) {
    quick(luis.id, [1, 1], [1, 1]);
    quick(luis.id, [1, 0], [1, 0]); // improving
  }
  if (jordan) {
    quick(jordan.id, [1, 0], [0, 1]);
    quick(jordan.id, [2, 2], [2, 1]); // worse + positive
  }
}

export function __resetCaseloadReview() {
  contacts.length = 0;
  reviews.length = 0;
  seeded = false;
}
