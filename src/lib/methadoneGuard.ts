// §Batch F1 — outpatient methadone guard. Pure (no store import) so ehr.ts
// can call it from addDraftOrder / signOrders / prescribeMedication.
// Draft — pending clinical sign-off.
//
// Methadone for opioid use disorder can only be dispensed by a certified
// Narcotic Treatment Program (42 CFR Part 8). Adelante is outpatient, not an
// NTP, so every methadone order or prescription is blocked here. A person who
// gets methadone from an outside NTP is recorded through
// `recordExternalNtpMedication` (ntpReferral.ts) — a reconciliation entry,
// never an order. Pain-indicated methadone is not supported in this prototype.

export const METHADONE_NTP_MESSAGE =
  "Methadone for opioid use disorder can only be dispensed by a certified Narcotic Treatment Program (NTP).";
export const METHADONE_GUARD_DRAFT = "Draft — pending clinical sign-off";

const METHADONE_RE = /methadone|methadose|diskets|dolophine/i;

export function isMethadoneText(...names: (string | undefined)[]): boolean {
  return names.some((n) => !!n && METHADONE_RE.test(n));
}

export function methadoneOrderBlock(o: {
  drugName?: string;
  name?: string;
  productName?: string;
  ingredientNames?: string[];
}): string | undefined {
  return isMethadoneText(o.drugName, o.name, o.productName, ...(o.ingredientNames ?? [])) ? METHADONE_NTP_MESSAGE : undefined;
}
