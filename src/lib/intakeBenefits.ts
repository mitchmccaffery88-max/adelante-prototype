// §Phase 8b — the shared intake benefits step: option model + the one write
// function every entry path calls. The write itself lives on AdelanteEHR so
// referral conversion (inside the store) can reach it without a cycle.
import {
  AdelanteEHR,
  type IntakeBenefitsAnswers,
  type IntakeBenefitsResult,
  type NonMediCalReport,
  type ReportedBenefitsSource,
} from "@/lib/ehr";
import type { CoverageType } from "@/lib/frontDoor";

export type { IntakeBenefitsAnswers, IntakeBenefitsResult, ReportedBenefitsSource };

/** First question of the step. Each maps to a coverage type + a finer report. */
export type BenefitsChoice =
  | "medi_cal"
  | "dual"
  | "medicare"
  | "private_insurance"
  | "no_insurance"
  | "prefer_self_pay"
  | "other"
  | "unknown";

export const BENEFITS_CHOICES: BenefitsChoice[] = [
  "medi_cal",
  "dual",
  "medicare",
  "private_insurance",
  "no_insurance",
  "prefer_self_pay",
  "other",
  "unknown",
];

const CHOICE_MAP: Record<BenefitsChoice, { type: CoverageType; report?: NonMediCalReport }> = {
  medi_cal: { type: "medi_cal" },
  dual: { type: "dual" },
  medicare: { type: "medicare", report: "medicare" },
  private_insurance: { type: "private", report: "private_insurance" },
  no_insurance: { type: "self_pay", report: "no_insurance" },
  prefer_self_pay: { type: "self_pay", report: "prefer_self_pay" },
  other: { type: "unknown", report: "other" },
  unknown: { type: "unknown", report: "unknown" },
};

export function isMediCalChoice(c?: BenefitsChoice | ""): boolean {
  return c === "medi_cal" || c === "dual";
}

/** Form state of the step. */
export interface BenefitsFormState {
  choice: BenefitsChoice | "";
  cin: string;
  planId: string;
  planOtherName: string;
  mediCalStatus: "active" | "suspended" | "none_unsure";
  planName: string;
}

export const EMPTY_BENEFITS: BenefitsFormState = {
  choice: "",
  cin: "",
  planId: "",
  planOtherName: "",
  mediCalStatus: "active",
  planName: "",
};

/** Seed the form from what's on file so a re-run edits rather than blanks. */
export function benefitsFormFromPatient(patientId?: string): BenefitsFormState {
  const p = patientId ? AdelanteEHR.getPatient(patientId) : undefined;
  const c = p?.coverage;
  if (!c?.coverageType) return { ...EMPTY_BENEFITS, cin: p?.cin ?? "" };
  const back: Record<string, BenefitsChoice> = {
    medi_cal: "medi_cal",
    dual: "dual",
    medicare: "medicare",
    private: "private_insurance",
  };
  const choice: BenefitsChoice =
    back[c.coverageType] ??
    (c.nonMediCalReport && c.nonMediCalReport !== "medicare" && c.nonMediCalReport !== "private_insurance"
      ? (c.nonMediCalReport as BenefitsChoice)
      : c.coverageType === "self_pay"
        ? "no_insurance"
        : "unknown");
  const span = (c.plans ?? []).find((s) => !s.to && s.managedCarePlanId);
  return {
    choice,
    cin: p?.cin ?? "",
    planId: span?.managedCarePlanId ?? "",
    planOtherName: "",
    mediCalStatus: (["active", "suspended", "none_unsure"] as const).includes(c.status as "active")
      ? (c.status as "active")
      : "active",
    planName: c.otherPlanName ?? "",
  };
}

/** Form → answers. Plan snapshot (id + name at this moment) taken from the list. */
export function benefitsAnswers(
  f: BenefitsFormState,
  plan?: { id: string; name: string; kind: "plan" | "ffs" | "other" | "unknown" },
): IntakeBenefitsAnswers | undefined {
  if (!f.choice) return f.cin.trim() ? { cin: f.cin } : undefined;
  const m = CHOICE_MAP[f.choice];
  const mediCal = isMediCalChoice(f.choice);
  return {
    coverageType: m.type,
    ...(m.report ? { nonMediCalReport: m.report } : {}),
    ...(mediCal && f.cin.trim() ? { cin: f.cin } : {}),
    ...(mediCal && plan
      ? { managedCarePlan: { ...plan, ...(plan.kind === "other" && f.planOtherName.trim() ? { otherName: f.planOtherName.trim() } : {}) } }
      : {}),
    ...(mediCal ? { mediCalStatus: f.mediCalStatus } : {}),
    ...(!mediCal && f.planName.trim() ? { planName: f.planName.trim() } : {}),
  };
}

export function recordIntakeBenefits(
  patientId: string,
  answers: IntakeBenefitsAnswers,
  input: Parameters<typeof AdelanteEHR.recordIntakeBenefits>[2],
): IntakeBenefitsResult {
  return AdelanteEHR.recordIntakeBenefits(patientId, answers, input);
}

/**
 * §Phase 8b — pre-release import row → answers. The partner file only says
 * a type and maybe a CIN; no Medi-Cal status is invented.
 */
export function partnerBenefitsAnswers(
  coverageType?: Exclude<BenefitsChoice, "prefer_self_pay">,
  cin?: string,
): IntakeBenefitsAnswers | undefined {
  if (!coverageType) return cin ? { cin } : undefined;
  const m = CHOICE_MAP[coverageType];
  return {
    coverageType: m.type,
    ...(m.report ? { nonMediCalReport: m.report } : {}),
    ...(cin ? { cin } : {}),
  };
}
