// §Adelante Journey Phase 6 — "I Just Got Out" reentry Day-0 module.
//
// This is NOT a generically available self-help module. It is the PATIENT-
// FACING CONTENT of the front-door Phase 2 safety-net path that already
// exists in this build:
//
//   AdelanteEHR.runSafetyNetRecordLookup()  → did a plan already exist?
//   AdelanteEHR.generateMissedHandoffCatchUp() → no: day-one catch-up episode
//                                                + `missedPreReleaseCoordination`
//
// The trigger below reads those REAL artefacts (the flag, the missedHandoff
// episode, a released episode) rather than a new "show me the module" switch.
// On top of that it is population-gated with Phase 2's resolver: General
// Population never reaches it, and an unconfirmed ("not sure") justice answer
// does not open it either.
//
// Progress follows Phase 5's ENGAGEMENT precedent: reentry step completion and
// the saved 24-hour plan are experience data, not clinical documentation, so
// they live in this module's own store keyed by `patientId` as a foreign
// reference — never as fields on `Patient`.
import { AdelanteEHR } from "@/lib/ehr";
import { isPopulationAllowed, resolvePopulation, type PopulationResolution } from "@/lib/population";

// ---------------------------------------------------------------------------
// Content — verbatim from source
// ---------------------------------------------------------------------------

export interface DayZeroStep {
  id: string;
  title: string;
  minutes: number;
  /** The one line under the title, verbatim. */
  subtitle: string;
  order: number;
  /** The 24-hour plan step is the guided tool, not a read-through screen. */
  kind: "read" | "checklist" | "plan" | "toolkit";
  /** Only for `checklist` — the module's own topics, not invented needs. */
  options?: string[];
}

export const DAY_ZERO_STEPS: DayZeroStep[] = [
  {
    id: "dz_welcome",
    title: "Welcome — You're Not Alone",
    minutes: 1,
    subtitle: "You don't have to figure everything out today.",
    order: 1,
    kind: "read",
  },
  {
    id: "dz_immediate_needs",
    title: "Immediate Needs",
    minutes: 1,
    subtitle: "Check anything you need help with right now.",
    order: 2,
    kind: "checklist",
    options: [
      "A safe place tonight",
      "Food or water",
      "Medications or health care",
      "A phone, ID or a ride",
      "I'm thinking about using right now",
      "Someone to talk to today",
    ],
  },
  {
    id: "dz_shelter",
    title: "Do I Have a Safe Place Tonight?",
    minutes: 1,
    subtitle: "One question. Then real options.",
    order: 3,
    kind: "read",
  },
  {
    id: "dz_food",
    title: "Food, Water & Basic Needs",
    minutes: 1,
    subtitle: "Have you eaten today?",
    order: 4,
    kind: "read",
  },
  {
    id: "dz_meds",
    title: "Medications & My Health",
    minutes: 1,
    subtitle: "Do you have what you need?",
    order: 5,
    kind: "read",
  },
  {
    id: "dz_logistics",
    title: "Phone, ID & Transportation",
    minutes: 1,
    subtitle: "The practical stuff that unlocks everything else.",
    order: 6,
    kind: "read",
  },
  {
    id: "dz_urge",
    title: "I'm Thinking About Using Right Now",
    minutes: 1,
    subtitle: "You can come here any time. No sequence required.",
    order: 7,
    kind: "read",
  },
  {
    id: "dz_support",
    title: "Who Can Help Me Today?",
    minutes: 1,
    subtitle: "Three ways to reach a real person.",
    order: 8,
    kind: "read",
  },
  {
    id: "dz_24h_plan",
    title: "24-Hour Plan",
    minutes: 2,
    subtitle: "Tonight only. Not your whole life.",
    order: 9,
    kind: "plan",
  },
  {
    id: "dz_toolkit",
    title: "My Reentry Toolkit",
    minutes: 1,
    subtitle: "Save it so it's here on a hard day.",
    order: 10,
    kind: "toolkit",
  },
];

/** One step of the guided 24-hour plan. Single-pick, or multi-pick with a cap. */
export interface PlanStep {
  id: string;
  title: string;
  prompt: string;
  /** `1` = single pick. Anything higher is a capped multi-pick. */
  maxPicks: number;
  options: string[];
  order: number;
}

export const DAY_ZERO_PLAN_STEPS: PlanStep[] = [
  {
    id: "sleep",
    title: "Where I'm sleeping tonight",
    prompt: "Pick the one that's true for tonight.",
    maxPicks: 1,
    order: 1,
    options: [
      "A shelter bed",
      "Transitional or sober living",
      "With family",
      "With a friend",
      "I don't know yet — I need help tonight",
    ],
  },
  {
    id: "meal",
    title: "My next meal",
    prompt: "Where the next thing you eat is coming from.",
    maxPicks: 1,
    order: 2,
    options: [
      "A food bank or pantry",
      "A community meal site",
      "A meal where I'm staying",
      "I have food with me",
      "I don't know yet — I need help today",
    ],
  },
  {
    id: "medications",
    title: "My medications",
    prompt: "Check everything that applies — including MAT.",
    maxPicks: 3,
    order: 3,
    options: [
      "I have my medications with me",
      "I need a MAT dose today",
      "I need a prescription refilled",
      "I need to see a provider",
      "I don't take any medications",
    ],
  },
  {
    id: "person",
    title: "One person I'll contact",
    prompt: "One. Not a list.",
    maxPicks: 1,
    order: 4,
    options: [
      "My case manager",
      "My sponsor or a recovery peer",
      "A family member",
      "A friend who supports my recovery",
      "I don't have someone yet — help me find one",
    ],
  },
  {
    id: "meeting",
    title: "A meeting I'll go to",
    prompt: "Pick one for the next 24 hours.",
    maxPicks: 1,
    order: 5,
    options: [
      "An AA meeting",
      "An NA meeting",
      "A SMART Recovery meeting",
      "A faith-based support group",
      "A group at Adelante",
      "Not today — but tomorrow",
    ],
  },
];

// ---------------------------------------------------------------------------
// Trigger — the real safety-net path, not a generic availability switch
// ---------------------------------------------------------------------------

export type DayZeroTrigger =
  /** `Patient.missedPreReleaseCoordination`, written by the catch-up generator. */
  | "missed_pre_release_coordination"
  /** A day-one catch-up episode (`PreReleaseEpisode.missedHandoff`). */
  | "missed_handoff_episode"
  /** Coordination DID happen and the person is now out — day 0 all the same. */
  | "released_episode";

/** The facts the trigger is derived from. Pure input — no store access. */
export interface DayZeroFacts {
  hasMissedPreReleaseFlag: boolean;
  hasMissedHandoffEpisode: boolean;
  hasReleasedEpisode: boolean;
  population: PopulationResolution;
}

export interface DayZeroAvailability {
  available: boolean;
  trigger?: DayZeroTrigger;
  /** Why not, for staff-facing debugging and for tests. */
  reason: string;
}

/**
 * PURE. Two independent conditions must BOTH hold:
 *  1. the person is a confirmed justice-involved population (Phase 2), and
 *  2. one of the real safety-net artefacts exists on the record.
 *
 * Nothing here can be satisfied by "the patient opened the module".
 */
export function resolveDayZeroAvailability(facts: DayZeroFacts): DayZeroAvailability {
  const jiOnly = isPopulationAllowed(facts.population, ["pre_release_ji", "post_release_ji"]);
  if (!jiOnly) {
    return {
      available: false,
      reason: `population track ${facts.population.track}${
        facts.population.provisional ? " (unconfirmed)" : ""
      } is not a reentry population`,
    };
  }
  if (facts.hasMissedPreReleaseFlag)
    return { available: true, trigger: "missed_pre_release_coordination", reason: "missed pre-release coordination flag" };
  if (facts.hasMissedHandoffEpisode)
    return { available: true, trigger: "missed_handoff_episode", reason: "day-one catch-up episode" };
  if (facts.hasReleasedEpisode)
    return { available: true, trigger: "released_episode", reason: "released pre-release episode" };
  return {
    available: false,
    reason: "no safety-net lookup outcome on the record — the Day-0 module is not generically available",
  };
}

/** Live availability for a patient, read out of the real record. */
export function dayZeroAvailability(patientId: string | undefined): DayZeroAvailability {
  if (!patientId) return { available: false, reason: "no patient record" };
  const p = AdelanteEHR.getPatient(patientId);
  if (!p) return { available: false, reason: "no patient record" };
  const eps = AdelanteEHR.listPreReleaseEpisodes(patientId);
  return resolveDayZeroAvailability({
    hasMissedPreReleaseFlag: Boolean(p.missedPreReleaseCoordination),
    hasMissedHandoffEpisode: eps.some((e) => e.missedHandoff),
    hasReleasedEpisode: eps.some((e) => e.status === "released"),
    population: resolvePopulation(patientId),
  });
}

// ---------------------------------------------------------------------------
// Progress store — engagement precedent, keyed by patientId (foreign ref)
// ---------------------------------------------------------------------------

export interface DayZeroPlan {
  /** planStepId → the picked option labels (length <= that step's maxPicks). */
  picks: Record<string, string[]>;
  savedAt: string;
}

export interface DayZeroProgress {
  patientId: string;
  completedSteps: string[];
  /** Immediate-needs checks, kept so staff can see what was asked for. */
  immediateNeeds: string[];
  plan?: DayZeroPlan;
  savedToToolkit: boolean;
  lastActivityAt?: string;
}

const progress = new Map<string, DayZeroProgress>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function subscribeDayZero(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

function row(patientId: string): DayZeroProgress {
  let r = progress.get(patientId);
  if (!r) {
    r = { patientId, completedSteps: [], immediateNeeds: [], savedToToolkit: false };
    progress.set(patientId, r);
  }
  return r;
}

export function getDayZeroProgress(patientId: string): DayZeroProgress | undefined {
  const r = progress.get(patientId);
  return r ? structuredClone(r) : undefined;
}

/** Population-health read, same shape instinct as `engagementRecords`. */
export function dayZeroRecords(patientIds?: string[]): DayZeroProgress[] {
  const all = [...progress.values()].map((r) => structuredClone(r));
  if (!patientIds) return all;
  const want = new Set(patientIds);
  return all.filter((r) => want.has(r.patientId));
}

/** Completion is refused outright when the module is not actually triggered. */
export function completeDayZeroStep(patientId: string, stepId: string): boolean {
  if (!DAY_ZERO_STEPS.some((s) => s.id === stepId)) return false;
  if (!dayZeroAvailability(patientId).available) return false;
  const r = row(patientId);
  if (!r.completedSteps.includes(stepId)) r.completedSteps.push(stepId);
  r.lastActivityAt = new Date().toISOString();
  notify();
  return true;
}

export function setImmediateNeeds(patientId: string, needs: string[]): void {
  if (!dayZeroAvailability(patientId).available) return;
  const r = row(patientId);
  r.immediateNeeds = [...new Set(needs)];
  r.lastActivityAt = new Date().toISOString();
  notify();
}

/** Saves the 24-hour plan, enforcing each step's pick cap. */
export function saveDayZeroPlan(
  patientId: string,
  picks: Record<string, string[]>,
): DayZeroPlan | undefined {
  if (!dayZeroAvailability(patientId).available) return undefined;
  const clean: Record<string, string[]> = {};
  for (const step of DAY_ZERO_PLAN_STEPS) {
    const chosen = (picks[step.id] ?? []).filter((o) => step.options.includes(o));
    if (chosen.length) clean[step.id] = chosen.slice(0, step.maxPicks);
  }
  const r = row(patientId);
  r.plan = { picks: clean, savedAt: new Date().toISOString() };
  r.lastActivityAt = r.plan.savedAt;
  notify();
  return structuredClone(r.plan);
}

export function saveReentryToolkit(patientId: string): boolean {
  if (!dayZeroAvailability(patientId).available) return false;
  const r = row(patientId);
  r.savedToToolkit = true;
  r.lastActivityAt = new Date().toISOString();
  notify();
  return true;
}

/** Test/reset helper — mirrors the engagement module's isolation needs. */
export function __resetDayZero(): void {
  progress.clear();
}