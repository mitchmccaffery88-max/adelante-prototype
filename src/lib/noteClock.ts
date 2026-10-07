// §Batch C3 / §Calendars L4 — note signing clocks. DRAFT — pending clinical sign-off.
//  - Standard notes: 3 of the AUTHOR's working days after the date of service —
//    the author's site calendar (holidays, closures, weekly open days) minus
//    the author's own time off, all through the one working-day service
//    (workingCalendar.ts). Time off pauses the clock.
//  - Crisis notes (linked to a crisis escalation, or service type crisis
//    intervention): 24-hour calendar clock. Holidays and time off never pause it;
//    overdue ones escalate to the clinical coordinator pool.
//  - Signed notes read the calendar as of their signing time, so later calendar
//    changes only move open notes.
import type { Patient, ProgressNote } from "./ehr";
import { facilityDateKey } from "./facilityTime";
import { cohortGuard, type CohortGuard } from "./cohortGuard";
import {
  addWorkingDays,
  endOfDateKey,
  isWorkingDay,
  NOTE_CLOCK_TOOLTIP,
  primarySiteFor,
  shiftKey,
  siteClosedDay,
  siteTimezone,
  staffForOwner,
  staffTimeOffOn,
  workingDaysBetween,
} from "./workingCalendar";

export const NOTE_CLOCK_DRAFT_LABEL = "Draft — pending clinical sign-off";
export const NOTE_CLOCK_HOLIDAY_TOOLTIP = "Working days skip clinic holidays, clinic closures and your time off (Draft).";
export const STANDARD_NOTE_BUSINESS_DAYS = 3;
export const CRISIS_NOTE_HOURS = 24;

const keyOf = (d: Date, ownerId?: string) => facilityDateKey(d, siteTimezone(primarySiteFor(ownerId)));
const localFromKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** Add N working days (default site calendar). Kept for callers; goes through the one service. */
export function addBusinessDays(from: Date, n: number, ownerId?: string): Date {
  return localFromKey(addWorkingDays(keyOf(from, ownerId), n, { ownerId }));
}

/** Working days strictly after `from`'s day up to and including `to`'s day. */
export function businessDaysBetween(from: Date, to: Date, ownerId?: string): number {
  return workingDaysBetween(keyOf(from, ownerId), keyOf(to, ownerId), { ownerId });
}

/** Crisis note = linked to a crisis escalation, or crisis-intervention service type. */
export function isCrisisNote(note: Pick<ProgressNote, "crisisEscalationId" | "serviceType">): boolean {
  return !!note.crisisEscalationId || note.serviceType === "crisis_intervention";
}

export type NoteClockState = "due_today" | "due_later" | "overdue";

export interface NoteClock {
  kind: "standard" | "crisis";
  dueAt: string;
  state: NoteClockState;
  label: string;
  draftLabel: string;
  /** Working days left (standard only). */
  workingDaysLeft?: number;
  tooltip: string;
  /** True when the author is on time off today (clock paused). */
  authorOut?: boolean;
}

type ClockNote = Pick<ProgressNote, "date" | "crisisEscalationId" | "serviceType"> & Partial<Pick<ProgressNote, "clinicianId" | "signedAt">>;

/** Standard-note deadline (facility end of day) for a note's author, as of `asOf`. */
export function standardNoteDue(note: ClockNote, asOf?: string): Date {
  const owner = note.clinicianId;
  const site = primarySiteFor(owner);
  const service = facilityDateKey(new Date(note.date), siteTimezone(site));
  return endOfDateKey(addWorkingDays(service, STANDARD_NOTE_BUSINESS_DAYS, { ownerId: owner, siteId: site, asOf }), siteTimezone(site));
}

export function noteClock(note: ClockNote, now: Date = new Date()): NoteClock {
  const service = new Date(note.date);
  if (isCrisisNote(note)) {
    const due = new Date(service.getTime() + CRISIS_NOTE_HOURS * 3600_000);
    const overdue = now > due;
    const hrs = Math.max(0, Math.ceil((due.getTime() - now.getTime()) / 3600_000));
    return {
      kind: "crisis",
      dueAt: due.toISOString(),
      state: overdue ? "overdue" : "due_today",
      label: overdue ? "Crisis note overdue" : `Crisis note due in ${hrs}h`,
      draftLabel: NOTE_CLOCK_DRAFT_LABEL,
      tooltip: "Crisis notes: 24 hours on the calendar — holidays and time off never pause crisis work (Draft).",
    };
  }
  const owner = note.clinicianId;
  const site = primarySiteFor(owner);
  const tz = siteTimezone(site);
  const due = standardNoteDue(note, note.signedAt);
  const authorOut = !!staffTimeOffOn(owner, facilityDateKey(now, tz));
  if (now > due)
    return { kind: "standard", dueAt: due.toISOString(), state: "overdue", label: "Overdue", draftLabel: NOTE_CLOCK_DRAFT_LABEL, workingDaysLeft: 0, tooltip: NOTE_CLOCK_TOOLTIP(0), authorOut };
  const left = workingDaysBetween(facilityDateKey(now, tz), facilityDateKey(due, tz), { ownerId: owner, siteId: site });
  return {
    kind: "standard",
    dueAt: due.toISOString(),
    state: left === 0 ? "due_today" : "due_later",
    label: left === 0 ? "Due today" : `Due in ${left} working day${left === 1 ? "" : "s"}`,
    draftLabel: NOTE_CLOCK_DRAFT_LABEL,
    workingDaysLeft: left,
    tooltip: NOTE_CLOCK_TOOLTIP(left),
    authorOut,
  };
}

/** Badge tone for a clock (semantic classes only). */
export function noteClockTone(c: NoteClock): string {
  if (c.kind === "crisis") return c.state === "overdue" ? "bg-destructive text-destructive-foreground" : "bg-destructive/15 text-destructive";
  if (c.state === "overdue") return "bg-destructive/15 text-destructive";
  if (c.state === "due_today") return "bg-gold/20 text-navy";
  return "bg-muted text-muted-foreground";
}

const isOpen = (n: ProgressNote) => (!n.status || n.status === "draft") && !n.signedBy;

/** Overdue crisis notes, for the clinical coordinator pool. */
export function overdueCrisisNotes(patients: Patient[], now: Date = new Date()) {
  const out: { patient: Patient; note: ProgressNote; clock: NoteClock }[] = [];
  for (const p of patients)
    for (const n of p.progressNotes ?? []) {
      if (!isOpen(n)) continue;
      if (!isCrisisNote(n)) continue;
      const c = noteClock(n, now);
      if (c.state === "overdue") out.push({ patient: p, note: n, clock: c });
    }
  return out;
}

// ---------------------------------------------------------------------------
// §L4 — "Author out — notes waiting" (clinical coordinator's Needs my action).
// Raised when an author with open standard notes is on time off on the day a
// note would otherwise fall due, or has 2+ working days off in a row while
// notes are open. No time-off type, no note content.
// ---------------------------------------------------------------------------
export interface AuthorOutItem {
  authorId: string;
  authorName: string;
  openNotes: number;
  outFrom: string;
  outTo: string;
}
export const AUTHOR_OUT_LABEL = "Author out — notes waiting";

function outRun(owner: string, startKey: string, site?: string): { from: string; to: string; workingDays: number } | null {
  const t = staffTimeOffOn(owner, startKey);
  if (!t) return null;
  let from = startKey;
  while (staffTimeOffOn(owner, shiftKey(from, -1))) from = shiftKey(from, -1);
  let to = startKey;
  let workingDays = 0;
  let d = from;
  for (let i = 0; i < 400; i++) {
    if (!staffTimeOffOn(owner, d)) break;
    if (isWorkingDay(d, { siteId: site })) workingDays++;
    to = d;
    d = shiftKey(d, 1);
  }
  return { from, to, workingDays };
}

export function authorOutItems(patients: Patient[], now: Date = new Date()): AuthorOutItem[] {
  const open = new Map<string, ProgressNote[]>();
  for (const p of patients)
    for (const n of p.progressNotes ?? []) {
      if (!isOpen(n) || isCrisisNote(n) || !n.clinicianId) continue;
      open.set(n.clinicianId, [...(open.get(n.clinicianId) ?? []), n]);
    }
  const out: AuthorOutItem[] = [];
  for (const [owner, notes] of open) {
    const site = primarySiteFor(owner);
    const tz = siteTimezone(site);
    const today = facilityDateKey(now, tz);
    let hit: { from: string; to: string } | null = null;
    for (const n of notes) {
      // Due date if time off did NOT pause the clock (site calendar only).
      const naive = addWorkingDays(facilityDateKey(new Date(n.date), tz), STANDARD_NOTE_BUSINESS_DAYS, { siteId: site });
      // Scan from today to the naive due day for a run that qualifies.
      for (let d = today; d <= naive; d = shiftKey(d, 1)) {
        const r = outRun(owner, d, site);
        if (r && (d === naive || r.workingDays >= 2)) { hit = r; break; }
        if (r) d = r.to;
      }
      if (hit) break;
    }
    if (hit) out.push({ authorId: owner, authorName: staffForOwner(owner)?.name ?? owner, openNotes: notes.length, outFrom: hit.from, outTo: hit.to });
  }
  return out;
}

// ---------------------------------------------------------------------------
// §L4 — Quality: on-time signing rate on the corrected deadlines. Signed notes
// use the calendar as of their signing time. Cohort guard 11.
// ---------------------------------------------------------------------------
export interface OnTimeRate extends CohortGuard {
  signed: number;
  onTime: number;
  rate: number | null;
}
export function noteOnTimeRate(patients: Patient[]): OnTimeRate {
  let signed = 0;
  let onTime = 0;
  for (const p of patients)
    for (const n of p.progressNotes ?? []) {
      if (!n.signedAt || isCrisisNote(n)) continue;
      signed++;
      if (new Date(n.signedAt) <= standardNoteDue(n, n.signedAt)) onTime++;
    }
  const g = cohortGuard(signed);
  return { ...g, signed, onTime, rate: g.belowMinimumCohort || !signed ? null : Math.round((onTime / signed) * 100) };
}

/** Closed-day name for a date at the author's site, if any (for tooltips). */
export function closedDayNameFor(ownerId: string | undefined, dateKey: string): string | undefined {
  return siteClosedDay(primarySiteFor(ownerId), dateKey)?.name;
}
