// §B2-4 — the one consent gate. Every access gate asks the typed ledger
// (consentCovers) first; a typed record only APPLIES to a gate when its type,
// recipient and purpose (and, for part2_specific_written, its item list)
// match what the gate needs. A record naming an external recipient never
// applies to an internal gate. When no typed record applies, only a live
// untyped section record answers; flags never do. Draft — pending clinical
// and counsel sign-off.
import type { ConsentType } from "./consentRecordModel";
import { purposeCodeForText, purposeCodeOf, isPurposeCode } from "./consentPurposes";

interface LedgerRecord {
  patientId: string; consentType?: ConsentType; recipients?: { name: string; directoryRef?: string }[];
  purpose?: string; purposeCode?: string; items?: string[];
}
export interface ConsentLedger {
  listConsentRecords(patientId?: string): LedgerRecord[];
  consentCovers(patientId: string, q: { type: ConsentType; recipient?: string; purpose?: string; item?: string; at?: Date }): boolean;
  _consentCategoryToday?(patientId: string, category: never, at?: Date): boolean;
}
let ledger: ConsentLedger | undefined;
/** Registered once by ehr.ts; avoids an import cycle. */
export function registerConsentLedger(l: ConsentLedger) { ledger = l; }

/** The program itself, as a consent recipient (directory reference or exact name). */
export const PROGRAM_RECIPIENTS = ["adelante-program", "Adelante"] as const;
export const CARE_COORDINATION_RECIPIENTS = ["adelante-care-coordination", "Adelante care coordination team", ...PROGRAM_RECIPIENTS] as const;

export interface GateNeed {
  types: readonly ConsentType[];
  /** Acceptable recipients (any one matches, exact name or directoryRef). */
  recipients: readonly string[];
  /** Required purpose (purposeCode or purpose, exact). Undefined = gate has no purpose requirement. */
  purposes?: readonly string[];
  item?: string;
  /** Existing section category, when the live section model has this scope. */
  liveCategory?: string;
}

const low = (s: string) => s.trim().toLowerCase();
function applies(r: LedgerRecord, n: GateNeed): boolean {
  if (!r.consentType || !n.types.includes(r.consentType)) return false;
  const want = n.recipients.map(low);
  if (!r.recipients?.some((x) => want.includes(low(x.directoryRef ?? "")) || want.includes(low(x.name)))) return false;
  // Codes only: the record's code (or exact-text migration) vs the need's code.
  if (n.purposes) {
    const have = purposeCodeOf(r);
    if (!have || !n.purposes.some((p) => (isPurposeCode(p) ? p : purposeCodeForText(p)) === have)) return false;
  }
  // Specific written consent covers only the items it lists.
  if (r.consentType === "part2_specific_written" && (n.item === undefined || !r.items?.includes(n.item))) return false;
  return true;
}

/** True when at least one typed record applies to this gate (whatever its status). */
export function typedRecordApplies(patientId: string, n: GateNeed): boolean {
  if (!ledger) return false;
  return ledger.listConsentRecords(patientId).some((r) => applies(r, n));
}

/**
 * Decide a gate. A typed record that applies decides (expired, revoked,
 * superseded, legacyUnverified all deny via consentCovers). Otherwise the
 * caller's current source answers.
 */
export function consentGate(patientId: string, n: GateNeed, today: () => boolean, at?: Date): boolean {
  // No applicable typed record: the live answer decides. A need with a
  // liveCategory reads the live, non-legacy section; otherwise the caller's
  // `today` answers. Every caller's `today` reads ONLY live, non-legacy
  // sources — never flags or legacyUnverified records (B2-5).
  if (!ledger) return false;
  if (!typedRecordApplies(patientId, n))
    return n.liveCategory ? ledger._consentCategoryToday?.(patientId, n.liveCategory as never, at) ?? false : today();
  const l = ledger;
  const recs = l.listConsentRecords(patientId).filter((r) => applies(r, n));
  return n.types.some((type) => n.recipients.some((recipient) =>
    (n.purposes ?? [undefined]).some((purpose) =>
      recs.some((r) => r.consentType === type) &&
      l.consentCovers(patientId, { type, recipient, purpose, item: type === "part2_specific_written" ? n.item : undefined, at }))));
}

/** Internal needs for the legacy category API (isConsentCategoryAuthorized). */
export const CATEGORY_NEEDS: Partial<Record<string, GateNeed>> = {
  sud_treatment: { types: ["part2_tpo_single"], recipients: PROGRAM_RECIPIENTS, purposes: ["treatment"], liveCategory: "sud_treatment" },
  telehealth_services: { types: ["telehealth"], recipients: PROGRAM_RECIPIENTS, purposes: ["telehealth"], liveCategory: "telehealth_services" },
  group_confidentiality_ack: { types: ["group_confidentiality"], recipients: PROGRAM_RECIPIENTS, purposes: ["group_confidentiality"], liveCategory: "group_confidentiality_ack" },
};
/** No recipient is known at the category call sites for external-disclosure
 * categories, so no typed record applies there; named-recipient gates
 * (referrer updates) pass their recipient explicitly. */
export function categoryNeed(category: string): GateNeed | undefined { return CATEGORY_NEEDS[category]; }

export const COORDINATOR_PURPOSES = ["care_coordination"] as const;
export function coordinatorNeed(item?: string): GateNeed {
  return { types: ["part2_tpo_single", "part2_specific_written"], recipients: CARE_COORDINATION_RECIPIENTS, purposes: COORDINATOR_PURPOSES, item };
}
export const COUNSELING_NEED: GateNeed = { types: ["counseling_notes_release"], recipients: CARE_COORDINATION_RECIPIENTS, purposes: COORDINATOR_PURPOSES };
