// §Batch C3 — note signing clocks. DRAFT — pending clinical sign-off.
//  - Standard notes: 3 business days (Mon–Fri) from the date of service.
//    Holidays are NOT modelled.
//  - Crisis notes (linked to a crisis escalation, or service type crisis
//    intervention): 1 calendar day; overdue ones escalate to the clinical
//    coordinator pool.
import type { Patient, ProgressNote } from "./ehr";

export const NOTE_CLOCK_DRAFT_LABEL = "Draft — pending clinical sign-off";
export const NOTE_CLOCK_HOLIDAY_TOOLTIP =
  "Business days are Monday–Friday. Holidays are not counted yet — a holiday still counts as a business day.";
export const STANDARD_NOTE_BUSINESS_DAYS = 3;
export const CRISIS_NOTE_HOURS = 24;

const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

/** Add N business days (Mon–Fri) to a date; returns the local day. */
export function addBusinessDays(from: Date, n: number): Date {
  const d = startOfDay(from);
  let left = n;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (!isWeekend(d)) left--;
  }
  return d;
}

/** Business days strictly after `from`'s day up to and including `to`'s day. */
export function businessDaysBetween(from: Date, to: Date): number {
  const a = startOfDay(from);
  const b = startOfDay(to);
  if (b <= a) return 0;
  let n = 0;
  const d = new Date(a);
  while (d < b) {
    d.setDate(d.getDate() + 1);
    if (!isWeekend(d)) n++;
  }
  return n;
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
}

export function noteClock(
  note: Pick<ProgressNote, "date" | "crisisEscalationId" | "serviceType">,
  now: Date = new Date(),
): NoteClock {
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
    };
  }
  const due = endOfDay(addBusinessDays(service, STANDARD_NOTE_BUSINESS_DAYS));
  if (now > due)
    return { kind: "standard", dueAt: due.toISOString(), state: "overdue", label: "Overdue", draftLabel: NOTE_CLOCK_DRAFT_LABEL };
  const left = businessDaysBetween(now, due);
  return {
    kind: "standard",
    dueAt: due.toISOString(),
    state: left === 0 ? "due_today" : "due_later",
    label: left === 0 ? "Due today" : `Due in ${left} business day${left === 1 ? "" : "s"}`,
    draftLabel: NOTE_CLOCK_DRAFT_LABEL,
  };
}

/** Badge tone for a clock (semantic classes only). */
export function noteClockTone(c: NoteClock): string {
  if (c.kind === "crisis") return c.state === "overdue" ? "bg-destructive text-destructive-foreground" : "bg-destructive/15 text-destructive";
  if (c.state === "overdue") return "bg-destructive/15 text-destructive";
  if (c.state === "due_today") return "bg-gold/20 text-navy";
  return "bg-muted text-muted-foreground";
}

/** Overdue crisis notes, for the clinical coordinator pool. */
export function overdueCrisisNotes(patients: Patient[], now: Date = new Date()) {
  const out: { patient: Patient; note: ProgressNote; clock: NoteClock }[] = [];
  for (const p of patients)
    for (const n of p.progressNotes ?? []) {
      if (n.status && n.status !== "draft") continue;
      if (n.signedBy) continue;
      if (!isCrisisNote(n)) continue;
      const c = noteClock(n, now);
      if (c.state === "overdue") out.push({ patient: p, note: n, clock: c });
    }
  return out;
}
