// §Reporting Tier 2 — structured CalOMS-shaped fields.
//
// WHY THIS EXISTS
// Substance-use profile, prior treatment history and discharge status/reason
// were only ever captured as free text inside note-template answers
// (`discharge_reason`, `condition_at_discharge`, narrative fields). That means
// there was no way to answer "all admissions where the primary substance was
// X" without reading every note by hand. Everything here is typed and
// queryable.
//
// WHAT DELIBERATELY IS NOT HERE
// Employment and living arrangement are NOT re-modelled. Employment already
// exists as `Patient.needs.employment` (a *need* flag) and living arrangement
// already exists as `ReentryCarePlan.housing.arrangement` /
// `CarePlanPreReleaseSlice.housingArrangement`. Adding a second field for
// either concept would create two sources of truth for one answer.
//
// DRAFT STATUS
// The vocabularies below are modelled on CalOMS Tx concepts but the exact
// coded value sets are NOT confirmed against a real DHCS field-level spec.
// They are structured and queryable today; they are not submission-ready.
// Every surface that renders them says so.

import type { ResourceReferralSource, TriState } from "@/lib/ehr";

/**
 * Provenance. This is the EXISTING convention, not a new one:
 * `ResourceReferralSource` ("internal" | "pre_release") from the referral
 * data-model work, widened with the "self_report" value already used by
 * `ReleaseSource`/`ReleaseConfidence`. A type test asserts it stays a
 * superset of `ResourceReferralSource`.
 */
export type CalomsDataSource = ResourceReferralSource | "self_report";

export const CALOMS_SOURCE_LABEL: Record<CalomsDataSource, string> = {
  self_report: "Self-reported",
  pre_release: "From pre-release record",
  internal: "Staff-entered",
};

// ---------------------------------------------------------------------------
// Substance use profile
// ---------------------------------------------------------------------------

export const CALOMS_SUBSTANCES = [
  "none",
  "alcohol",
  "heroin",
  "other_opiates",
  "methamphetamine",
  "cocaine_crack",
  "cannabis",
  "benzodiazepines",
  "other",
] as const;
export type CalomsSubstance = (typeof CALOMS_SUBSTANCES)[number];

export const SUBSTANCE_LABEL: Record<CalomsSubstance, string> = {
  none: "No substance use reported",
  alcohol: "Alcohol",
  heroin: "Heroin",
  other_opiates: "Other opiates / synthetics",
  methamphetamine: "Methamphetamine",
  cocaine_crack: "Cocaine / crack",
  cannabis: "Cannabis",
  benzodiazepines: "Benzodiazepines",
  other: "Other",
};

export const CALOMS_ROUTES = ["oral", "smoking", "inhalation", "injection", "other"] as const;
export type CalomsRoute = (typeof CALOMS_ROUTES)[number];
export const ROUTE_LABEL: Record<CalomsRoute, string> = {
  oral: "Oral",
  smoking: "Smoking",
  inhalation: "Inhalation",
  injection: "Injection",
  other: "Other",
};

export const CALOMS_FREQUENCIES = [
  "no_use",
  "1_3_per_month",
  "1_2_per_week",
  "3_6_per_week",
  "daily",
] as const;
export type CalomsFrequency = (typeof CALOMS_FREQUENCIES)[number];
export const FREQUENCY_LABEL: Record<CalomsFrequency, string> = {
  no_use: "No use in past 30 days",
  "1_3_per_month": "1–3 times per month",
  "1_2_per_week": "1–2 times per week",
  "3_6_per_week": "3–6 times per week",
  daily: "Daily",
};

export type SubstanceRank = "primary" | "secondary" | "tertiary";

export interface SubstanceUseEntry {
  rank: SubstanceRank;
  substance: CalomsSubstance;
  route?: CalomsRoute;
  frequency?: CalomsFrequency;
  /** Whole years. Unknown stays undefined rather than 0. */
  ageAtFirstUse?: number;
}

export interface SubstanceUseProfile {
  entries: SubstanceUseEntry[];
  source: CalomsDataSource;
  recordedAt: string;
  recordedBy?: string;
}

// ---------------------------------------------------------------------------
// Prior treatment history
// ---------------------------------------------------------------------------

export const PRIOR_EPISODE_BUCKETS = ["none", "one", "two_to_four", "five_plus", "unknown"] as const;
export type PriorEpisodeBucket = (typeof PRIOR_EPISODE_BUCKETS)[number];
export const PRIOR_EPISODE_LABEL: Record<PriorEpisodeBucket, string> = {
  none: "No prior treatment episodes",
  one: "1 prior episode",
  two_to_four: "2–4 prior episodes",
  five_plus: "5 or more prior episodes",
  unknown: "Unknown",
};

export const PRIOR_TREATMENT_TYPES = [
  "outpatient",
  "intensive_outpatient",
  "residential",
  "withdrawal_management",
  "opioid_treatment_program",
  "other",
  "unknown",
] as const;
export type PriorTreatmentType = (typeof PRIOR_TREATMENT_TYPES)[number];
export const PRIOR_TREATMENT_TYPE_LABEL: Record<PriorTreatmentType, string> = {
  outpatient: "Outpatient",
  intensive_outpatient: "Intensive outpatient",
  residential: "Residential",
  withdrawal_management: "Withdrawal management",
  opioid_treatment_program: "Opioid treatment program",
  other: "Other",
  unknown: "Unknown",
};

export interface PriorTreatmentHistory {
  priorEpisodes: PriorEpisodeBucket;
  lastTreatmentType?: PriorTreatmentType;
  /** ISO date (yyyy-mm-dd). */
  lastTreatmentEndedOn?: string;
  /** Has this person previously received medication-assisted treatment? */
  priorMat?: TriState;
  source: CalomsDataSource;
  recordedAt: string;
  recordedBy?: string;
}

// ---------------------------------------------------------------------------
// Discharge status / reason
// ---------------------------------------------------------------------------

export const DISCHARGE_STATUSES = [
  "completed_treatment",
  "left_satisfactory",
  "left_unsatisfactory",
  "transferred",
  "incarcerated",
  "deceased",
  "unknown",
] as const;
export type DischargeStatus = (typeof DISCHARGE_STATUSES)[number];
export const DISCHARGE_STATUS_LABEL: Record<DischargeStatus, string> = {
  completed_treatment: "Completed treatment",
  left_satisfactory: "Left with satisfactory progress",
  left_unsatisfactory: "Left with unsatisfactory progress",
  transferred: "Transferred to another provider",
  incarcerated: "Incarcerated",
  deceased: "Deceased",
  unknown: "Unknown",
};

export const DISCHARGE_REASONS = [
  "goals_met",
  "patient_choice",
  "lost_contact",
  "moved_out_of_area",
  "administrative",
  "higher_level_of_care",
  "other",
] as const;
export type DischargeReason = (typeof DISCHARGE_REASONS)[number];
export const DISCHARGE_REASON_LABEL: Record<DischargeReason, string> = {
  goals_met: "Treatment goals met",
  patient_choice: "Patient chose to stop",
  lost_contact: "Lost contact",
  moved_out_of_area: "Moved out of area",
  administrative: "Administrative discharge",
  higher_level_of_care: "Referred to a higher level of care",
  other: "Other",
};

export interface DischargeRecord {
  id: string;
  status: DischargeStatus;
  reason: DischargeReason;
  /** Only meaningful when `reason === "other"`. */
  otherReason?: string;
  /** ISO date (yyyy-mm-dd). */
  dischargedOn: string;
  episodeId?: string;
  source: CalomsDataSource;
  recordedAt: string;
  recordedBy?: string;
}

// ---------------------------------------------------------------------------
// Justice involvement — SELF-REPORTED / PATIENT ESTIMATE
// ---------------------------------------------------------------------------
//
// Product decision: arrest/booking history, time in custody and the
// justice-involvement referral source are facility/county-sourced in reality.
// Premier Clinic's MVP cannot verify them. A real facility/county data-sharing
// integration is a separate future phase. So these are captured as estimates
// and must NEVER render without their provenance label.

export const JUSTICE_REFERRAL_SOURCES = [
  "court",
  "probation",
  "parole",
  "drug_court",
  "jail_release",
  "self",
  "other",
] as const;
export type JusticeReferralSource = (typeof JUSTICE_REFERRAL_SOURCES)[number];
export const JUSTICE_REFERRAL_LABEL: Record<JusticeReferralSource, string> = {
  court: "Court",
  probation: "Probation",
  parole: "Parole",
  drug_court: "Drug court / collaborative court",
  jail_release: "Jail release / reentry",
  self: "Self-referred",
  other: "Other",
};

export interface JusticeInvolvementSelfReport {
  arrestsPast30Days?: number;
  arrestsPast12Months?: number;
  /** Whole months, as estimated by the patient. */
  timeInCustodyMonths?: number;
  justiceReferralSource?: JusticeReferralSource;
  /**
   * Always defaults to "self_report". A value may be upgraded to
   * "pre_release" when it genuinely came from a release assessment, but never
   * to a claim of facility verification — none exists.
   */
  source: CalomsDataSource;
  recordedAt: string;
  recordedBy?: string;
}

/** The whole structured block, stored as one optional field on `Patient`. */
export interface CalomsProfile {
  substanceUse?: SubstanceUseProfile;
  priorTreatment?: PriorTreatmentHistory;
  /** Append-only, newest first. The head is the current discharge. */
  discharges?: DischargeRecord[];
  justice?: JusticeInvolvementSelfReport;
}

export const CALOMS_DRAFT_NOTE =
  "DRAFT value set — structured and queryable, but not yet reconciled against a DHCS field-level specification. Not a submission feed.";

export const JUSTICE_SELF_REPORT_NOTE =
  "Self-reported by the patient. Adelante has no facility or county data feed, so arrest history, time in custody and referral source are estimates, not verified records.";
