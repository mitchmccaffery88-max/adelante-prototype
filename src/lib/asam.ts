// §Phase 10c — ASAM framework (assessment structure, triggers, and routing).
//
// LICENSING
// ---------
// ASAM Criteria content is licensed. This module uses ONLY public elements:
// the six dimension names, a 0–4 risk rating per dimension, and the DMC-ODS
// level-of-care list (a draft, editable reference list). No ASAM assessment
// questions and no automated placement logic are reproduced. Each dimension
// carries an empty `licensedPrompt` slot where licensed dimension content can
// be dropped in later without a data-model change.
//
// THE CLINICIAN DECIDES
// ---------------------
// The system never calculates, suggests, or pre-fills a level of care. Both
// `recommendedLevel` and `actualLevel` are clinician-selected, and a reason is
// required when they differ.
//
// PART 2
// ------
// Everything in the ASAM pathway is 42 CFR Part 2 protected. Every read goes
// through the existing `canAccess(role, "screeners_sud", patient)` check (plus
// the stored-result author exception in the store). Never visible to advocates
// or Part 2-restricted staff.
//
// DRAFT VALUES
// ------------
// Due dates, the reassessment interval, the sign/cosign role lists, the level
// list, and the medical-necessity rule are all DRAFTS pending clinical
// sign-off. `ASAM_DRAFT_NOTE` is the label every surface shows.

import type { AttestationRecord } from "@/lib/attestation";
// Type-only: roles.ts imports ehr.ts at runtime, and ehr.ts value-imports this
// module — a value import back to roles.ts would close a cycle. The LPHA list
// below is a literal copy of `LPHA_SUPERVISOR_ROLES` (["therapist", "pmhnp"]);
// a test asserts they stay in sync.
import type { StaffRole } from "@/lib/roles";

export const ASAM_DRAFT_NOTE = "Draft — pending clinical sign-off";

// ---------------------------------------------------------------------------
// Six dimensions (public names only) with empty licensed-content slots.
// ---------------------------------------------------------------------------

export interface AsamDimensionDef {
  key: string;
  /** Public dimension name (ASAM Criteria, public elements only). */
  name: string;
  /**
   * Licensed dimension content slot. EMPTY until clinical staff supply
   * licensed text; surfaces must show the placeholder note while empty.
   */
  licensedPrompt: string;
}

export const ASAM_DIMENSIONS: AsamDimensionDef[] = [
  { key: "d1", name: "Acute intoxication and/or withdrawal potential", licensedPrompt: "" },
  { key: "d2", name: "Biomedical conditions and complications", licensedPrompt: "" },
  { key: "d3", name: "Emotional, behavioral, or cognitive conditions and complications", licensedPrompt: "" },
  { key: "d4", name: "Readiness to change", licensedPrompt: "" },
  { key: "d5", name: "Relapse, continued use, or continued problem potential", licensedPrompt: "" },
  { key: "d6", name: "Recovery/living environment", licensedPrompt: "" },
];

export const ASAM_LICENSED_CONTENT_NOTE =
  "Dimension guidance text is an empty slot pending licensed ASAM content — clinical staff to supply.";

// ---------------------------------------------------------------------------
// DMC-ODS level-of-care list — a DRAFT, editable reference list. The system
// never maps ratings to a level; the clinician picks from this list.
// ---------------------------------------------------------------------------

export interface DmcOdsLevel {
  key: string;
  label: string;
}

export const DMC_ODS_LEVELS: DmcOdsLevel[] = [
  { key: "early_intervention", label: "Early intervention" },
  { key: "outpatient", label: "Outpatient services" },
  { key: "intensive_outpatient", label: "Intensive outpatient" },
  { key: "partial_hospitalization", label: "Partial hospitalization" },
  { key: "residential", label: "Residential treatment" },
  { key: "withdrawal_management", label: "Withdrawal management" },
  { key: "otp", label: "Opioid treatment program" },
  { key: "recovery_services", label: "Recovery services" },
];

/** DRAFT — which levels Adelante actually offers. Drives the referral-out task. */
export const OFFERED_LEVELS: string[] = ["outpatient", "intensive_outpatient", "recovery_services"];

export function dmcOdsLevelLabel(key: string | undefined): string {
  return DMC_ODS_LEVELS.find((l) => l.key === key)?.label ?? key ?? "—";
}

// ---------------------------------------------------------------------------
// Roles (DRAFT pending clinical sign-off)
// ---------------------------------------------------------------------------

/** Who may start and edit an ASAM draft. SUD counselors author under DMC-ODS. */
export const ASAM_AUTHOR_ROLES: StaffRole[] = [
  "therapist",
  "pmhnp",
  "sud_counselor",
  "clinical_trainee",
];

/**
 * Who may FINAL-sign (determine medical necessity). LPHA tier only — a literal
 * copy of `LPHA_SUPERVISOR_ROLES` in roles.ts (kept literal to avoid an import
 * cycle; a test asserts they match). Counselors and trainees are authors, not
 * final signers: their assessments need an LPHA co-signature.
 */
export const ASAM_SIGN_ROLES: StaffRole[] = ["therapist", "pmhnp"];

export function asamNeedsCosign(authorRole: StaffRole): boolean {
  return !ASAM_SIGN_ROLES.includes(authorRole);
}

// ---------------------------------------------------------------------------
// The assessment record
// ---------------------------------------------------------------------------

export interface AsamDimensionEntry {
  key: string;
  documentation: string;
  /** 0–4 risk rating, clinician-assigned. */
  rating: 0 | 1 | 2 | 3 | 4;
}

export type AsamStatus = "draft" | "cosign_pending" | "signed" | "declined";

export interface AsamOutputs {
  /** Draft rule: signed + at least one linked SUD diagnosis. */
  medicalNecessity: boolean;
  episodeId?: string;
  calomsPromptTaskId?: string;
  claimId?: string;
  suggestedGoalId?: string;
  referralOutTaskId?: string;
  reassessmentTaskId?: string;
}

export interface AsamAssessment {
  id: string;
  /** Bumped on amendment; signed records are locked, changes are new versions. */
  version: number;
  status: AsamStatus;
  dimensions: AsamDimensionEntry[];
  /** Clinician-selected. The system never fills these. */
  recommendedLevel?: string;
  actualLevel?: string;
  /** Required when recommended ≠ actual. */
  levelDifferenceReason?: string;
  /** Linked problem-list ICD-10 codes. */
  diagnosisCodes: string[];
  authoredBy: { staffId: string; name: string; role: StaffRole };
  authoredAt: string;
  /** The facts behind the trigger, e.g. "Positive DAST-10 at intake". */
  triggerReasons: string[];
  attestation?: AttestationRecord;
  cosignAttestation?: AttestationRecord;
  cosignedBy?: string;
  cosignedById?: string;
  cosignedAt?: string;
  signedAt?: string;
  /** Amendment chain — previous version id. */
  amendsId?: string;
  outputs?: AsamOutputs;
}

export function emptyAsamDraft(
  authoredBy: AsamAssessment["authoredBy"],
  triggerReasons: string[],
): Omit<AsamAssessment, "id"> {
  return {
    version: 1,
    status: "draft",
    dimensions: ASAM_DIMENSIONS.map((d) => ({ key: d.key, documentation: "", rating: 0 })),
    diagnosisCodes: [],
    authoredBy,
    authoredAt: new Date().toISOString(),
    triggerReasons,
  };
}

// ---------------------------------------------------------------------------
// Task routing + due dates (DRAFT)
// ---------------------------------------------------------------------------

/** The case-task type and origin for "ASAM assessment needed". */
export const ASAM_TASK_TYPE = "asam_assessment";
export const ASAM_DEDUPE_PREFIX = "asam:";

/** Roles the pooled task is relevant to (author roles; LPHA for the queue). */
export const ASAM_TASK_ROLES: StaffRole[] = [...ASAM_AUTHOR_ROLES];

const DAY = 86_400_000;

/**
 * DRAFT due date: 7 days after the trigger; on/before the release date for
 * pre-release patients; 30 days when an existing DMC-ODS episode triggered it.
 */
export function asamDueDate(input: {
  releaseDate?: string;
  hasDmcOdsEpisode?: boolean;
  now?: Date;
}): string {
  const now = input.now ?? new Date();
  if (input.releaseDate) {
    const rel = new Date(input.releaseDate);
    if (rel.getTime() > now.getTime()) return rel.toISOString().slice(0, 10);
  }
  const days = input.hasDmcOdsEpisode ? 30 : 7;
  return new Date(now.getTime() + days * DAY).toISOString().slice(0, 10);
}

/** DRAFT reassessment interval: 90 days after a signed ASAM. */
export const ASAM_REASSESSMENT_DAYS = 90;

// ---------------------------------------------------------------------------
// Shared due/overdue wording for "ASAM assessment needed" tasks. One rule for
// My Work, the chart, Ask Adel, Guided Chart Review and ASAM reporting.
// DRAFT: "due" = within the next 7 days; "overdue" = past the due date.
// ---------------------------------------------------------------------------
export type AsamTaskState = "needed" | "due" | "overdue";
const ASAM_DAY = 86_400_000;

export function asamTaskState(dueDate: string, now: Date = new Date()): AsamTaskState {
  const due = new Date(dueDate.slice(0, 10)).getTime();
  const today = new Date(now.toISOString().slice(0, 10)).getTime();
  if (due < today) return "overdue";
  if (due - today <= 7 * ASAM_DAY) return "due";
  return "needed";
}

/** e.g. "overdue by 5 days (was due 2026-09-20, draft)" / "due 2026-10-01 (draft)". */
export function asamTaskDueLabel(dueDate: string, now: Date = new Date()): string {
  const day = dueDate.slice(0, 10);
  if (asamTaskState(dueDate, now) === "overdue") {
    const today = new Date(now.toISOString().slice(0, 10)).getTime();
    const n = Math.round((today - new Date(day).getTime()) / ASAM_DAY);
    return `overdue by ${n} day${n === 1 ? "" : "s"} (was due ${day}, draft)`;
  }
  return `due ${day} (draft)`;
}
