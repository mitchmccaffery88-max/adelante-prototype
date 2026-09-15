/**
 * §Reporting Tier 2 follow-up — intake History step pre-fill.
 *
 * Intake used to start this step blank even when a structured `CalomsProfile`
 * was already on file, so re-running intake silently replaced real answers
 * with whatever the blank form submitted. Every other intake step seeds from
 * the record (see `seedIntakeProfile`); this does the same, with the same
 * precedence: record value > blank, and nothing is locked.
 *
 * The substance fields mirror the chart card exactly (substance, route,
 * frequency, age at first use) so the same real-world fact is not captured at
 * two fidelities depending on where it was entered.
 */
import type {
  CalomsFrequency,
  CalomsRoute,
  CalomsSubstance,
  JusticeReferralSource,
  PriorEpisodeBucket,
  PriorTreatmentType,
} from "@/lib/caloms";
import type { Patient } from "@/lib/ehr";

export interface IntakeHistory {
  substance?: CalomsSubstance;
  route?: CalomsRoute;
  frequency?: CalomsFrequency;
  /** Whole years, kept as a string while the field is being typed. */
  ageAtFirstUse: string;
  priorEpisodes?: PriorEpisodeBucket;
  lastTreatmentType?: PriorTreatmentType;
  arrestsPast12Months: string;
  timeInCustodyMonths: string;
  justiceReferralSource?: JusticeReferralSource;
}

export function blankIntakeHistory(): IntakeHistory {
  return { ageAtFirstUse: "", arrestsPast12Months: "", timeInCustodyMonths: "" };
}

const num = (n: number | undefined): string =>
  typeof n === "number" && Number.isFinite(n) ? String(n) : "";

/** Everything already on file, as editable defaults. */
export function seedIntakeHistory(patient: Patient | undefined | null): IntakeHistory {
  const base = blankIntakeHistory();
  const c = patient?.calomsProfile;
  if (!c) return base;
  const primary = c.substanceUse?.entries.find((e) => e.rank === "primary");
  return {
    substance: primary?.substance,
    route: primary?.route,
    frequency: primary?.frequency,
    ageAtFirstUse: num(primary?.ageAtFirstUse),
    priorEpisodes: c.priorTreatment?.priorEpisodes,
    lastTreatmentType: c.priorTreatment?.lastTreatmentType,
    arrestsPast12Months: num(c.justice?.arrestsPast12Months),
    timeInCustodyMonths: num(c.justice?.timeInCustodyMonths),
    justiceReferralSource: c.justice?.justiceReferralSource,
  };
}

/** True when the record already holds any of the three structured blocks. */
export function hasExistingHistory(patient: Patient | undefined | null): boolean {
  const c = patient?.calomsProfile;
  return Boolean(c?.substanceUse || c?.priorTreatment || c?.justice);
}
