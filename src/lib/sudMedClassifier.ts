// §Part 2 — the ONE substance-use-medication classifier. Pure (no store
// import) so `ehr.ts` and every surface can share it without a cycle.
// A medication is SUD-related when its name matches the drug list below OR a
// clinician set the "SUD-related" toggle on the order (`sudRelated`).
// Drug list: DRAFT — pending clinical sign-off.

export const SUD_MEDICATION_NAMES = [
  "buprenorphine",
  "suboxone",
  "zubsolv",
  "sublocade",
  "brixadi",
  "methadone",
  "naltrexone",
  "vivitrol",
  "acamprosate",
  "disulfiram",
  "antabuse",
  "naloxone",
  "narcan",
  "lofexidine",
] as const;

const PATTERN = new RegExp(SUD_MEDICATION_NAMES.join("|"), "i");

export function isSudMedicationText(...names: (string | undefined)[]): boolean {
  return names.some((n) => !!n && PATTERN.test(n));
}

export interface SudClassifiable {
  name?: string;
  drugName?: string;
  productName?: string;
  medicationName?: string;
  ingredientNames?: string[];
  sudRelated?: boolean;
}

export function isSudMedication(m: SudClassifiable | undefined): boolean {
  if (!m) return false;
  if (m.sudRelated) return true;
  return isSudMedicationText(
    m.name,
    m.drugName,
    m.productName,
    m.medicationName,
    ...(m.ingredientNames ?? []),
  );
}

export const SOME_MEDS_HIDDEN = "Some medications are not shown for your role.";
