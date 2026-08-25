// §Patient portal Tier 1 Build B — PATIENT-PRIVATE SELF-TRACKING STORE.
//
// Four patient-authored surfaces live here: the daily mood check-in, craving
// logs, lapse records, and saved (bookmarked) community resources.
//
// WHY ITS OWN STORE, AND WHY IT LOOKS DIFFERENT FROM `engagement.ts`:
// `engagement.ts` is deliberately cohort-queryable (`engagementRecords()`) so
// population-health reporting can join lesson completion against clinical
// data. This store is the OPPOSITE by design. The slip-support flow prints an
// explicit privacy promise ("nobody else sees this — not your officer, not
// your case manager, not the court"), so that promise has to be true in the
// code:
//
//   • There is NO cross-patient read. Every read takes one `patientId`.
//   • There is NO audit sink and no `setAuditSink` hook. Unlike engagement,
//     nothing here writes into the audit stream, so nothing surfaces on
//     `/admin-audit`, `/consent-audit`, or a PO/court disclosure packet.
//   • This module does NOT import `@/lib/ehr`, so it cannot be swept into the
//     designated record set, the print/export path (`printRecord.ts`,
//     `notePdf.ts`), or any advocate DTO.
//   • No staff component imports it. There is a regression test that asserts
//     this (`selfTrackingPrivacy.test.ts`) so a future staff surface cannot
//     quietly acquire read access.
//
// FLAGGED, NOT ASSUMED: `roles.ts` has no `RecordClass` meaning
// "patient-private, never staff-visible". Every existing class — including
// `safety_plan`, the closest neighbour — is a class SOME staff role can read;
// the matrix models "who may read", not "nobody may read". Rather than invent
// a new class whose only entry would be an all-deny row (a gate that looks
// enforced but is only enforced by having no callers), this data is kept out
// of the clinical record entirely, which is the stronger guarantee. If a lapse
// record ever needs to become clinically shareable, that is a consent decision
// (an explicit patient-initiated share), not a matrix edit.
//
// ESCALATION IS DELIBERATELY ABSENT. Cathy's build ties repeated craving logs
// to a warm handoff. That is the same category of question as the already-HELD
// crisis-detection escalation-policy decision, so nothing here notifies,
// scores, flags or routes anything. `cravingLogs()` stores and returns data;
// that is all. See mem://features/patient-private-self-tracking.

import { dayKey } from "./checkInStreak";

// ---------------------------------------------------------------------------
// Vocabularies (ported from the source)
// ---------------------------------------------------------------------------

export type EmotionId =
  | "anxious"
  | "overwhelmed"
  | "lonely"
  | "hopeful"
  | "angry"
  | "depressed"
  | "craving"
  | "stressed"
  | "exhausted";

export interface EmotionOption {
  id: EmotionId;
  label: string;
  emoji: string;
}

/** The nine emotions, in source order. */
export const CHECK_IN_EMOTIONS: readonly EmotionOption[] = [
  { id: "anxious", label: "Anxious", emoji: "😰" },
  { id: "overwhelmed", label: "Overwhelmed", emoji: "🌊" },
  { id: "lonely", label: "Lonely", emoji: "🫥" },
  { id: "hopeful", label: "Hopeful", emoji: "🌱" },
  { id: "angry", label: "Angry", emoji: "😤" },
  { id: "depressed", label: "Depressed", emoji: "🌧️" },
  { id: "craving", label: "Craving", emoji: "🌀" },
  { id: "stressed", label: "Stressed", emoji: "😖" },
  { id: "exhausted", label: "Exhausted", emoji: "🥱" },
] as const;

export type CheckInReasonId =
  | "something_happened"
  | "didnt_sleep"
  | "old_triggers"
  | "dont_know";

export interface CheckInReasonOption {
  id: CheckInReasonId;
  label: string;
}

/** The optional, skippable "why" — single select. */
export const CHECK_IN_REASONS: readonly CheckInReasonOption[] = [
  { id: "something_happened", label: "Something happened today" },
  { id: "didnt_sleep", label: "I didn't sleep well" },
  { id: "old_triggers", label: "I'm around old triggers" },
  { id: "dont_know", label: "I don't know — just is" },
] as const;

/** Lapse step 1 — reflective, not confessional. Multi-select. */
export const LAPSE_CONTRIBUTORS: readonly { id: string; label: string }[] = [
  { id: "stress", label: "Stress piled up" },
  { id: "people_places", label: "I was around old people or places" },
  { id: "alone", label: "I was alone too long" },
  { id: "conflict", label: "A fight or hard conversation" },
  { id: "sleep", label: "I wasn't sleeping" },
  { id: "meds_off", label: "I'd stopped taking my medication" },
  { id: "celebrating", label: "Something good happened and I celebrated" },
  { id: "pain", label: "Physical pain" },
  { id: "not_sure", label: "I'm not sure yet" },
] as const;

/** Lapse step 2 — what has actually worked for this person before. */
export const LAPSE_HELPED_BEFORE: readonly { id: string; label: string }[] = [
  { id: "called_someone", label: "Calling someone who gets it" },
  { id: "meeting", label: "Getting to a meeting" },
  { id: "meds", label: "Getting back on my medication" },
  { id: "sleep_food", label: "Sleep and a real meal" },
  { id: "moving", label: "Moving my body — a walk, work, the gym" },
  { id: "changing_place", label: "Physically leaving where I was" },
  { id: "waiting_it_out", label: "Waiting it out until it passed" },
] as const;

export type LapseNextStepId =
  | "message_care_team"
  | "find_meeting"
  | "craving_tool"
  | "back_on_meds"
  | "rest";

export interface LapseNextStepOption {
  id: LapseNextStepId;
  label: string;
  detail: string;
}

/**
 * Lapse step 3 — ONE next 24 hours step. Every option below routes to a real,
 * working destination in this app; the flow component owns the routing so this
 * module stays free of router imports.
 */
export const LAPSE_NEXT_STEPS: readonly LapseNextStepOption[] = [
  {
    id: "message_care_team",
    label: "Message my peer or care team",
    detail: "Opens your care-team thread. You don't have to explain it all.",
  },
  {
    id: "find_meeting",
    label: "Find a meeting today",
    detail: "Recovery meetings our team has called and confirmed.",
  },
  {
    id: "craving_tool",
    label: "Open the craving tool",
    detail: "Rate it, ride it out, see where it lands.",
  },
  {
    id: "back_on_meds",
    label: "Get back on my medication",
    detail: "Your medication list and today's doses.",
  },
  { id: "rest", label: "Just rest", detail: "That is a real answer. Nothing else is required." },
] as const;

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export interface DailyCheckIn {
  id: string;
  patientId: string;
  /** Local calendar day, YYYY-MM-DD — one check-in per day, re-savable. */
  dayKey: string;
  emotions: EmotionId[];
  reasonId?: CheckInReasonId;
  createdAt: string;
  updatedAt: string;
}

export interface CravingLog {
  id: string;
  patientId: string;
  /** 0–10 before riding it out. */
  levelBefore: number;
  /** 0–10 afterwards; absent when the person left before re-rating. */
  levelAfter?: number;
  /** True when the guided surf timer actually ran to the end. */
  surfCompleted: boolean;
  startedAt: string;
  endedAt?: string;
}

export interface LapseRecord {
  id: string;
  patientId: string;
  contributors: string[];
  helpedBefore: string[];
  nextStep: LapseNextStepId;
  createdAt: string;
}

interface SelfTrackingRow {
  patientId: string;
  checkIns: DailyCheckIn[];
  cravings: CravingLog[];
  lapses: LapseRecord[];
  savedResourceIds: string[];
  /** §Recovery start date — see section 5 below. */
  recoveryStartDate?: string;
}

const rows = new Map<string, SelfTrackingRow>();

type Listener = () => void;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((l) => l());

export function subscribeSelfTracking(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

function row(patientId: string): SelfTrackingRow {
  let r = rows.get(patientId);
  if (!r) {
    r = { patientId, checkIns: [], cravings: [], lapses: [], savedResourceIds: [] };
    rows.set(patientId, r);
  }
  return r;
}

let seq = 0;
const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(seq += 1)}`;

// ---------------------------------------------------------------------------
// 1 — Daily check-in
// ---------------------------------------------------------------------------

/**
 * Record (or replace) today's mood check-in. This is NOT the clinical
 * PHQ-2/GAD-2 quick check: no instrument, no score, no `ScreenerResult`, and
 * nothing lands in the clinical record. The two coexist on purpose.
 */
export function recordDailyCheckIn(
  patientId: string,
  input: { emotions: EmotionId[]; reasonId?: CheckInReasonId; now?: Date },
): DailyCheckIn {
  const now = input.now ?? new Date();
  const key = dayKey(now);
  const r = row(patientId);
  const iso = now.toISOString();
  const existing = r.checkIns.find((c) => c.dayKey === key);
  if (existing) {
    existing.emotions = [...input.emotions];
    if (input.reasonId) existing.reasonId = input.reasonId;
    else delete existing.reasonId;
    existing.updatedAt = iso;
    notify();
    return { ...existing };
  }
  const entry: DailyCheckIn = {
    id: newId("dci"),
    patientId,
    dayKey: key,
    emotions: [...input.emotions],
    ...(input.reasonId ? { reasonId: input.reasonId } : {}),
    createdAt: iso,
    updatedAt: iso,
  };
  r.checkIns.push(entry);
  notify();
  return { ...entry };
}

export function listDailyCheckIns(patientId: string): DailyCheckIn[] {
  return (rows.get(patientId)?.checkIns ?? []).map((c) => ({ ...c }));
}

export function todaysCheckIn(patientId: string, now: Date = new Date()): DailyCheckIn | undefined {
  const key = dayKey(now);
  const c = rows.get(patientId)?.checkIns.find((x) => x.dayKey === key);
  return c ? { ...c } : undefined;
}

/** The real contributing input the home-dashboard streak folds in. */
export function dailyCheckInDayKeys(patientId: string): string[] {
  return (rows.get(patientId)?.checkIns ?? []).map((c) => c.dayKey);
}

// ---------------------------------------------------------------------------
// 2 — Craving log
// ---------------------------------------------------------------------------

/** Start a craving log with the before-rating. Returns the open entry. */
export function startCravingLog(
  patientId: string,
  levelBefore: number,
  now: Date = new Date(),
): CravingLog {
  const entry: CravingLog = {
    id: newId("crv"),
    patientId,
    levelBefore: clamp010(levelBefore),
    surfCompleted: false,
    startedAt: now.toISOString(),
  };
  row(patientId).cravings.push(entry);
  notify();
  return { ...entry };
}

/** Close it out with the after-rating. No escalation, by design (see header). */
export function completeCravingLog(
  patientId: string,
  id: string,
  input: { levelAfter?: number; surfCompleted?: boolean; now?: Date },
): CravingLog | undefined {
  const entry = rows.get(patientId)?.cravings.find((c) => c.id === id);
  if (!entry) return undefined;
  if (input.levelAfter !== undefined) entry.levelAfter = clamp010(input.levelAfter);
  if (input.surfCompleted !== undefined) entry.surfCompleted = input.surfCompleted;
  entry.endedAt = (input.now ?? new Date()).toISOString();
  notify();
  return { ...entry };
}

export function listCravingLogs(patientId: string): CravingLog[] {
  return (rows.get(patientId)?.cravings ?? []).map((c) => ({ ...c }));
}

function clamp010(n: number): number {
  return Math.max(0, Math.min(10, Math.round(n)));
}

// ---------------------------------------------------------------------------
// 3 — Lapse record
// ---------------------------------------------------------------------------

export function recordLapse(
  patientId: string,
  input: { contributors: string[]; helpedBefore: string[]; nextStep: LapseNextStepId; now?: Date },
): LapseRecord {
  const entry: LapseRecord = {
    id: newId("lap"),
    patientId,
    contributors: [...input.contributors],
    helpedBefore: [...input.helpedBefore],
    nextStep: input.nextStep,
    createdAt: (input.now ?? new Date()).toISOString(),
  };
  row(patientId).lapses.push(entry);
  notify();
  return { ...entry };
}

export function listLapses(patientId: string): LapseRecord[] {
  return (rows.get(patientId)?.lapses ?? []).map((l) => ({ ...l }));
}

// ---------------------------------------------------------------------------
// 4 — Saved resources (bookmarks over the real Phase 6 directory)
// ---------------------------------------------------------------------------

/** Stores ids only — the listing itself always comes from `communityResources`. */
export function toggleSavedResource(patientId: string, resourceId: string): boolean {
  const r = row(patientId);
  const i = r.savedResourceIds.indexOf(resourceId);
  const saved = i === -1;
  if (saved) r.savedResourceIds.push(resourceId);
  else r.savedResourceIds.splice(i, 1);
  notify();
  return saved;
}

export function savedResourceIds(patientId: string): string[] {
  return [...(rows.get(patientId)?.savedResourceIds ?? [])];
}

export function isResourceSaved(patientId: string, resourceId: string): boolean {
  return (rows.get(patientId)?.savedResourceIds ?? []).includes(resourceId);
}

// ---------------------------------------------------------------------------
// 5 — Recovery start date (self-reported)
// ---------------------------------------------------------------------------
//
// CORRECTED LOCATION. This briefly lived on `Patient.recoveryStartDate` in
// `ehr.ts`, Part 2-gated like a SUD screener. It was moved here because it has
// NOT been clinically validated as medically necessary (pending Dr. Bagga's
// sign-off), and an unvalidated self-reported abstinence marker does not
// belong in the clinical record at all. It therefore gets the strongest
// available guarantee, the same one craving and lapse records get: patient-
// scoped, no EHR write, no audit entry, no staff or advocate read path under
// ANY role or consent state. Moving it back into the EHR is a real open
// clinical decision, not a refactor.

/** The patient's own self-reported recovery start date (`YYYY-MM-DD`). */
export function recoveryStartDate(patientId: string): string | undefined {
  return rows.get(patientId)?.recoveryStartDate;
}

/** Patient-controlled write; `null` clears it. Never called automatically. */
export function setRecoveryStartDate(patientId: string, date: string | null): void {
  const r = row(patientId);
  if (date) r.recoveryStartDate = date;
  else delete r.recoveryStartDate;
  notify();
}

// ---------------------------------------------------------------------------
// 6 — Population-health aggregate (DE-AGGREGATED, COUNTS ONLY)
// ---------------------------------------------------------------------------
//
// Product decision: self-tracking data may feed POPULATION reporting even
// though it is excluded from the EHR and from every individual-record read
// path. This function is the only door for that, and it is deliberately
// shaped so it cannot become one: it returns counts, never rows, never ids,
// never day keys — nothing that can be joined back to a person.
//
// ⚠️ MINIMUM COHORT SIZE — REAL PRODUCTION CONSIDERATION, NOT A DEMO NICETY.
// At demo scale (10 patients) an aggregate like "3 lapses this week" is
// practically re-identifiable: staff who know the caseload can often infer
// who. Small-cell suppression is the standard control. `MIN_COHORT_SIZE`
// below is the threshold, and `belowMinimumCohort` tells the UI the numbers
// are NOT safe to publish. For the demo we still compute and display them
// with that flag surfaced; before production the dev team must decide the
// real threshold with compliance and switch this to hard suppression
// (return nulls) rather than an advisory flag.
export const MIN_COHORT_SIZE = 11;

export interface SelfTrackingAggregate {
  /** Patients considered — the denominator, not a list. */
  cohortSize: number;
  /** True when the cohort is too small for these numbers to be safely shared. */
  belowMinimumCohort: boolean;
  cravingLogs: number;
  cravingLogsWithSurfCompleted: number;
  lapses: number;
  /** Patients who have set a recovery start date. */
  recoveryDateSet: number;
  /** recoveryDateSet / cohortSize, or null when the cohort is empty. */
  recoveryDateSetRate: number | null;
  /** Patients with any self-tracking activity at all. */
  patientsWithAnyActivity: number;
}

/**
 * Aggregate counts across a cohort. `patientIds` is the cohort denominator —
 * patients with no row count as zeros rather than being dropped, so a rate is
 * a real rate. Omitting it aggregates only patients who have a row, which is
 * why callers should always pass the cohort.
 */
export function selfTrackingAggregate(
  patientIds?: string[],
  opts: { since?: Date } = {},
): SelfTrackingAggregate {
  const ids = patientIds ?? [...rows.keys()];
  const from = opts.since ? opts.since.getTime() : undefined;
  const inWindow = (iso: string) => from === undefined || Date.parse(iso) >= from;

  let cravingLogs = 0;
  let cravingLogsWithSurfCompleted = 0;
  let lapses = 0;
  let recoveryDateSet = 0;
  let patientsWithAnyActivity = 0;

  for (const id of ids) {
    const r = rows.get(id);
    if (!r) continue;
    const c = r.cravings.filter((x) => inWindow(x.startedAt));
    const l = r.lapses.filter((x) => inWindow(x.createdAt));
    cravingLogs += c.length;
    cravingLogsWithSurfCompleted += c.filter((x) => x.surfCompleted).length;
    lapses += l.length;
    if (r.recoveryStartDate) recoveryDateSet += 1;
    if (c.length || l.length || r.recoveryStartDate || r.checkIns.length)
      patientsWithAnyActivity += 1;
  }

  return {
    cohortSize: ids.length,
    belowMinimumCohort: ids.length < MIN_COHORT_SIZE,
    cravingLogs,
    cravingLogsWithSurfCompleted,
    lapses,
    recoveryDateSet,
    recoveryDateSetRate: ids.length ? recoveryDateSet / ids.length : null,
    patientsWithAnyActivity,
  };
}

/** Test/demo helper — drops every private row. */

export function __resetSelfTracking(): void {
  rows.clear();
  notify();
}
