// 27 Oct (Mitch, Phase 2b) — standard Part 2 consent (part2_tpo_single) end rule, shared by the
// TypeScript capture path and SQL app.synthetic_guard. No end date. The only allowed end wording is
// "until revoked" or "end of treatment"; the patient may revoke at any time.
// Draft — pending clinical sign-off.
import type { ConsentType } from "./consentRecordModel";

/** Lower-cased, trimmed end-event wordings accepted for part2_tpo_single (SQL holds the same list). */
export const STANDARD_TPO_END_EVENTS = [
  "no expiry — until revoked",
  "until revoked",
  "patient revokes",
  "patient revokes this consent",
  "end of treatment",
] as const;

export function standardTpoExpiryError(d: { consentType: ConsentType | string; expiresOn?: string; expiresOnEvent?: string }): string | null {
  if (d.consentType !== "part2_tpo_single") return null;
  if (d.expiresOn) return "standard_tpo_no_expiry";
  const ev = d.expiresOnEvent?.trim().toLowerCase();
  if (ev && !(STANDARD_TPO_END_EVENTS as readonly string[]).includes(ev)) return "standard_tpo_end_event";
  return null;
}

export const STANDARD_TPO_EXPIRY_MESSAGE: Record<string, string> = {
  standard_tpo_no_expiry: "The standard Part 2 consent has no end date; it lasts until revoked or end of treatment.",
  standard_tpo_end_event: "The standard Part 2 consent ends only when revoked or at end of treatment.",
};

/** Shared vectors: both TypeScript and SQL must give the same accept/reject code. */
export const STANDARD_TPO_EXPIRY_VECTORS: { code: string; purpose: "tpo" | "treatment"; expiresOn?: string; expiresOnEvent?: string; expected: string | null }[] = [
  { code: "tpo_no_end", purpose: "tpo", expected: null },
  { code: "tpo_until_revoked", purpose: "tpo", expiresOnEvent: "No expiry — until revoked", expected: null },
  { code: "tpo_end_of_treatment", purpose: "tpo", expiresOnEvent: "End of treatment", expected: null },
  { code: "treatment_end_of_treatment", purpose: "treatment", expiresOnEvent: " end of treatment ", expected: null },
  { code: "treatment_patient_revokes", purpose: "treatment", expiresOnEvent: "Patient revokes this consent", expected: null },
  { code: "tpo_date_rejected", purpose: "tpo", expiresOn: "2027-10-27", expected: "standard_tpo_no_expiry" },
  { code: "treatment_date_rejected", purpose: "treatment", expiresOn: "2027-10-27", expected: "standard_tpo_no_expiry" },
  { code: "tpo_other_event_rejected", purpose: "tpo", expiresOnEvent: "When probation ends", expected: "standard_tpo_end_event" },
];
