// §Reporting Redesign Tier 3 — REFLEXIVE-NEED REPORTS.
//
// Three questions a real staff member asks about their OWN day:
//   1. What is open on me right now?           -> myOpenItems()
//   2. Who on my caseload is due a re-screen?  -> screenerDueRows()
//   3. Who is going quiet on me?               -> disengagementRows()
//
// HARD RULE, same as every other reporting module here: nothing in this file
// invents a tracking mechanism. Every row is read back out of a store that
// already exists — crisis claims (`claimedBy`), draft notes
// (`listDraftNotesBy`), case tasks (`listCaseTasks`), the existing 30/60/90
// re-screen cadence (`rescreensDue`), engagement activity
// (`engagementRecords`), appointments and care messages.
//
// Anything that is a POLICY NUMBER rather than a measured fact is declared
// DRAFT in one place at the top, exactly the way `crisisPolicy.ts` does it, so
// the real operational answer changes here and nowhere else.
import {
  AdelanteEHR,
  noteStatus,
  type CaseTask,
  type CrisisEscalation,
  type Patient,
  type ProgressNote,
} from "./ehr";
import { crisisSlaState, type CrisisSlaState } from "./crisisPolicy";
import { isPart2Screener } from "./screeners";
import { canAccess, type StaffRole } from "./roles";
import { engagementRecords } from "./engagement";

// ---------------------------------------------------------------------------
// DRAFT policy values — pending real operational sign-off
// ---------------------------------------------------------------------------

/** Rendered wherever a Tier 3 draft threshold is shown to real staff. */
export const MY_WORK_DRAFT_LABEL = "Draft threshold — pending operational policy review";

/**
 * DRAFT disengagement thresholds, in days since the last real contact signal.
 * There is no agreed outreach policy yet (the same conversation that left the
 * crisis response clocks unsettled), so these are a starting point, not a rule.
 */
export const DISENGAGEMENT_DRAFT = {
  watch: 14,
  atRisk: 30,
  note: "Draft: no contact for 14 days = watch, 30 days = at risk. Pending real outreach policy.",
} as const;

/**
 * The re-screen cadence is NOT invented here — `AdelanteEHR.rescreensDue`
 * already runs a 30/60/90-day cadence off `screenerHistory`. It has never been
 * clinically ratified, so it is surfaced as a draft assumption rather than as
 * a due date.
 */
export const RESCREEN_CADENCE_DRAFT_NOTE =
  "Draft cadence assumption: 30 / 60 / 90 days from the last completed screen. There is no ratified re-screen schedule yet, so these are prompts, not due dates.";

// ---------------------------------------------------------------------------
// Identity — who counts as "me"
// ---------------------------------------------------------------------------

export interface ActingIdentity {
  staffId: string;
  staffName: string;
  clinicianId?: string;
}

/**
 * The demo stores ownership under several real-world identifiers: crisis
 * claims and case tasks store a display NAME, appointments store a
 * `clinicianId` ("c1"), and patients store a case-manager id ("cm1") whose
 * roster row is "s-cm1". Matching on one of those alone silently drops work,
 * so every read here matches the whole alias set for the acting person.
 */
export function staffAliases(actor: ActingIdentity): Set<string> {
  const set = new Set<string>();
  const add = (v?: string) => {
    if (v && v.trim()) set.add(v.trim());
  };
  add(actor.staffId);
  add(actor.staffId.replace(/^s-/, ""));
  add(actor.staffName);
  add(actor.clinicianId);
  return set;
}

const owns = (aliases: Set<string>, value?: string) => Boolean(value && aliases.has(value));

// ---------------------------------------------------------------------------
// 1. My open items
// ---------------------------------------------------------------------------

export interface MyCrisisItem {
  patientId: string;
  patientName: string;
  escalation: CrisisEscalation;
  sla: CrisisSlaState;
}

export interface MyNoteItem {
  patientId: string;
  patientName: string;
  note: ProgressNote;
  ageDays: number;
}

export interface MyTaskItem {
  patientId: string;
  patientName: string;
  task: CaseTask;
  overdueDays: number;
}

export interface MyOpenItems {
  /** Crisis-lane escalations this person has claimed. */
  clinicalCrises: MyCrisisItem[];
  /** Social-needs lane escalations this person has claimed. */
  sdohCrises: MyCrisisItem[];
  /** Their own unsigned progress notes. */
  unsignedNotes: MyNoteItem[];
  /** Case tasks assigned to or claimed by them, past due. */
  overdueTasks: MyTaskItem[];
  /** Total across all four sources. */
  total: number;
  /** Rows already past their draft crisis response target. */
  overdueCrises: number;
}

const days = (from: string, now: number) =>
  Math.max(0, Math.floor((now - +new Date(from)) / 86_400_000));

export function myOpenItems(actor: ActingIdentity, now: Date = new Date()): MyOpenItems {
  const aliases = staffAliases(actor);
  const t = now.getTime();

  const crises: MyCrisisItem[] = AdelanteEHR.listOpenCrisisEscalations()
    .filter(({ escalation }) => owns(aliases, escalation.claimedBy))
    .map(({ patient, escalation }) => ({
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      escalation,
      sla: crisisSlaState(escalation, t),
    }));

  // Authorship is a clinician id where one exists, and the staff id otherwise
  // — the same resolution `UnsignedNotesQueue` already uses.
  const authorId = actor.clinicianId ?? actor.staffId;
  const unsignedNotes: MyNoteItem[] = AdelanteEHR.listDraftNotesBy(authorId)
    .filter(({ note }) => noteStatus(note) === "draft")
    .map(({ patient, note }) => ({
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      note,
      ageDays: days(note.date, t),
    }))
    .sort((a, b) => b.ageDays - a.ageDays);

  const byId = new Map(AdelanteEHR.listPatients().map((p) => [p.id, p]));
  const overdueTasks: MyTaskItem[] = AdelanteEHR.listCaseTasks()
    .filter((task) => {
      if (task.status === "done" || task.completedAt) return false;
      if (!owns(aliases, task.assignedTo) && !owns(aliases, task.claimedBy)) return false;
      if (task.snoozedUntil && +new Date(task.snoozedUntil) > t) return false;
      return +new Date(task.dueDate) < t;
    })
    .map((task) => {
      const p = byId.get(task.patientId);
      return {
        patientId: task.patientId,
        patientName: p ? `${p.firstName} ${p.lastName}` : "Unknown patient",
        task,
        overdueDays: days(task.dueDate, t),
      };
    })
    .sort((a, b) => b.overdueDays - a.overdueDays);

  const clinicalCrises = crises
    .filter((c) => c.escalation.category !== "sdoh")
    .sort((a, b) => b.sla.ageMs - a.sla.ageMs);
  const sdohCrises = crises
    .filter((c) => c.escalation.category === "sdoh")
    .sort((a, b) => b.sla.ageMs - a.sla.ageMs);

  return {
    clinicalCrises,
    sdohCrises,
    unsignedNotes,
    overdueTasks,
    total:
      clinicalCrises.length + sdohCrises.length + unsignedNotes.length + overdueTasks.length,
    overdueCrises: crises.filter((c) => c.sla.overdue).length,
  };
}

// ---------------------------------------------------------------------------
// Caseload
// ---------------------------------------------------------------------------

/**
 * "My caseload" = patients whose primary clinician OR case manager resolves to
 * the acting person. Deliberately a union: a therapist owns their clinician
 * panel, an ECM provider owns their case-managed panel, and nobody should have
 * to know which field the demo stored them under.
 */
export function myCaseload(actor: ActingIdentity): Patient[] {
  const aliases = staffAliases(actor);
  return AdelanteEHR.listPatients().filter(
    (p) => owns(aliases, p.primaryClinicianId) || owns(aliases, p.caseManagerId),
  );
}

// ---------------------------------------------------------------------------
// 2. Screener due / overdue
// ---------------------------------------------------------------------------

/** The viewer a screener list is being rendered for, when one is known. */
export interface ScreenerViewer {
  role: StaffRole;
}

export interface ScreenerDueRow {
  patientId: string;
  patientName: string;
  screenerKey: string;
  /** Days since the last completed screen of this instrument. */
  daysSinceLast: number;
  /** Which draft cadence step has been passed: 30, 60 or 90. */
  cadenceStep: 30 | 60 | 90;
  /** A re-screen task is already sitting on the patient's list. */
  taskAlreadySent: boolean;
}

/**
 * Rows come straight from the existing `rescreensDue` cadence — this function
 * only scopes it to a caseload, joins patient names, and reports whether the
 * prompt has already been actioned so nobody chases it twice.
 */
export function screenerDueRows(
  patients: Patient[],
  viewer?: ScreenerViewer,
): ScreenerDueRow[] {
  const out: ScreenerDueRow[] = [];
  for (const p of patients) {
    const openTasks = (p.tasks ?? []).filter((t) => t.kind === "rescreen" && !t.completedAt);
    // §Part 2 — PER-INSTRUMENT, not per-list. The chart's Tracking tab already
    // shows mental-health screener trends while masking the SUD instruments
    // for a viewer whose `screeners_sud` access does not resolve for THIS
    // patient; the re-screen list follows the same precedent. Gating the whole
    // list on `screeners_sud` would wrongly hide legitimate MH re-screens.
    const sudLocked = viewer ? canAccess(viewer.role, "screeners_sud", p).locked : false;
    for (const due of AdelanteEHR.rescreensDue(p.id)) {
      if (sudLocked && isPart2Screener(due.key)) continue;
      out.push({
        patientId: p.id,
        patientName: `${p.firstName} ${p.lastName}`,
        screenerKey: due.key,
        daysSinceLast: due.lastDays ?? 0,
        cadenceStep: due.nextDue,
        taskAlreadySent: openTasks.some((t) => t.screenerKey === due.key),
      });
    }
  }
  return out.sort((a, b) => b.daysSinceLast - a.daysSinceLast);
}

// ---------------------------------------------------------------------------
// 3. Disengagement risk
// ---------------------------------------------------------------------------

export type ContactKind = "appointment" | "message" | "self_help" | "none";

export interface DisengagementRow {
  patientId: string;
  patientName: string;
  /** Most recent real contact signal of any kind, ISO. */
  lastContactAt?: string;
  lastContactKind: ContactKind;
  /** null when there has never been a contact signal of any kind. */
  daysSinceContact: number | null;
  level: "ok" | "watch" | "at_risk" | "no_contact_recorded";
}

/**
 * What "contact" honestly means here — three real signals, nothing inferred:
 *   • appointment  — an attended visit already in the past
 *   • message      — a care message the PATIENT authored (a staff message is
 *                    an outreach attempt, not evidence of engagement)
 *   • self_help    — engagement-store activity (`lastActivityAt`)
 *
 * A patient with no signal at all is reported as `no_contact_recorded` rather
 * than as the worst risk band: absent data is not the same as a silent patient.
 */
export function disengagementRows(
  patients: Patient[],
  now: Date = new Date(),
): DisengagementRow[] {
  const t = now.getTime();
  const engagement = new Map(
    engagementRecords(patients.map((p) => p.id)).map((r) => [r.patientId, r]),
  );
  const appts = AdelanteEHR.listAppointments();

  return patients
    .map((p) => {
      const signals: { at: string; kind: ContactKind }[] = [];

      const lastAppt = appts
        .filter((a) => a.patientId === p.id && a.status === "attended" && +new Date(a.start) <= t)
        .sort((a, b) => +new Date(b.start) - +new Date(a.start))[0];
      if (lastAppt) signals.push({ at: lastAppt.start, kind: "appointment" });

      const lastMsg = AdelanteEHR.listCareMessages(p.id)
        .filter((m) => m.authorType === "patient")
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
      if (lastMsg) signals.push({ at: lastMsg.createdAt, kind: "message" });

      const lastEngagement = engagement.get(p.id)?.lastActivityAt;
      if (lastEngagement) signals.push({ at: lastEngagement, kind: "self_help" });

      const latest = signals
        .filter((s) => Number.isFinite(Date.parse(s.at)))
        .sort((a, b) => +new Date(b.at) - +new Date(a.at))[0];

      const daysSince = latest ? days(latest.at, t) : null;
      const level: DisengagementRow["level"] =
        daysSince === null
          ? "no_contact_recorded"
          : daysSince >= DISENGAGEMENT_DRAFT.atRisk
            ? "at_risk"
            : daysSince >= DISENGAGEMENT_DRAFT.watch
              ? "watch"
              : "ok";

      return {
        patientId: p.id,
        patientName: `${p.firstName} ${p.lastName}`,
        ...(latest ? { lastContactAt: latest.at } : {}),
        lastContactKind: latest?.kind ?? "none",
        daysSinceContact: daysSince,
        level,
      };
    })
    .sort((a, b) => (b.daysSinceContact ?? -1) - (a.daysSinceContact ?? -1));
}

/** Rows worth showing in the early-warning list: watch, at risk, or unknown. */
export function disengagementFlagged(rows: DisengagementRow[]): DisengagementRow[] {
  return rows.filter((r) => r.level !== "ok");
}
