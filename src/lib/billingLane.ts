// §Phase 7d follow-up — the /billing "Lane" label, derived from real facts.
//
// Replaces the old rule "coverage.status === 'active' ⇒ Medi-Cal FFS", which
// mislabelled anyone with any active coverage (e.g. general-population
// patients) as Medi-Cal. Order of evidence:
//   1. the claim's actual payer program (what billing will bill),
//   2. the visit's explicit funding lane (set by staff),
//   3. the coverage record's real type / a dated plan span on the date,
//   4. otherwise "Coverage type unknown" — never a guess.
import type { Appointment, Patient } from "@/lib/ehr";
import { PAYMENT_ARRANGEMENTS, PROGRAM_LABEL, type PayerProgram } from "@/lib/rates";

export type LaneKey =
  | PayerProgram
  | "medi_cal_program_unset"
  | "medicare"
  | "private_insurance"
  | "bhsa"
  | "non_billable"
  | "unknown";

export const LANE_LABEL: Record<LaneKey, string> = {
  ...PROGRAM_LABEL,
  medi_cal_program_unset: "Medi-Cal (program not set)",
  medicare: "Medicare",
  private_insurance: "Private insurance",
  bhsa: "BHSA",
  non_billable: "Non-billable",
  unknown: "Coverage type unknown",
};

/** Filter order for the Lane dropdown. */
export const LANE_ORDER: LaneKey[] = [
  "dmc_ods",
  "smhs",
  "medi_cal_managed",
  "calaim_ecm",
  "medi_cal_program_unset",
  "self_pay",
  "sliding_fee",
  "grant_isl",
  "bhsa",
  "medicare",
  "private_insurance",
  "commercial",
  "non_billable",
  "unknown",
];

const MEDI_CAL_PAYER = /medi-?cal|\bMHP\b|\bDMC\b|county/i;

/**
 * Payer family from the coverage record only. `status` (active/suspended…)
 * is deliberately NOT read as a payer — "active" says nothing about which
 * payer is active.
 */
export function coverageKind(
  patient: Patient | undefined,
  onDate?: string,
): "medi_cal" | "medicare" | "private" | "self_pay" | "unknown" {
  const cov = patient?.coverage;
  if (!cov) return "unknown";
  const d = (onDate ?? new Date().toISOString()).slice(0, 10);
  const plan = (cov.plans ?? []).find((x) => x.from <= d && (!x.to || d <= x.to));
  if (plan && MEDI_CAL_PAYER.test(`${plan.payer} ${plan.plan ?? ""}`)) return "medi_cal";
  switch (cov.coverageType) {
    case "medi_cal":
    case "dual":
      return "medi_cal";
    case "medicare":
      return "medicare";
    case "private":
      return "private";
    case "self_pay":
      return "self_pay";
  }
  if (cov.status === "uninsured") return "self_pay";
  if (cov.status === "private_pay") return "self_pay";
  return "unknown";
}

export function laneFor(input: {
  claim?: { program?: PayerProgram; serviceDate?: string } | undefined;
  appt?: Appointment | undefined;
  patient?: Patient | undefined;
}): LaneKey {
  const { claim, appt, patient } = input;
  if (claim?.program) return claim.program;
  const fl = appt?.fundingLane;
  if (fl === "non_billable") return "non_billable";
  if (fl === "isl_non_medi_cal") return "grant_isl";
  if (fl === "bhsa") return "bhsa";
  if (fl === "dmc_ods") return "dmc_ods";
  if (fl === "ecm") return "calaim_ecm";
  if (fl === "medi_cal_ffs") return "medi_cal_managed";
  if (fl === "private_pay") return patient?.paymentArrangement ?? "self_pay";
  const kind = coverageKind(patient, claim?.serviceDate ?? appt?.start);
  if (kind === "medi_cal") return "medi_cal_program_unset";
  if (kind === "medicare") return "medicare";
  if (kind === "private") return "private_insurance";
  if (kind === "self_pay") return patient?.paymentArrangement ?? "self_pay";
  return "unknown";
}

export const arrangementLabel = (id?: string) =>
  PAYMENT_ARRANGEMENTS.find((a) => a.id === id)?.label;
