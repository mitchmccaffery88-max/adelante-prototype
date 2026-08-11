// §Adelante Journey Phase 3 — probation/parole (PO) disclosure, two tiers.
//
// This is the SAME split already proven for CF Care Manager pre-release data
// sharing in src/lib/ab133.ts — two genuinely different code paths, not one
// gate with two labels:
//
//   • `poMandatoryDisclosure()` never touches the consent ledger. It resolves
//     purely from (item x legal mandate on file). There is no call to
//     `isConsentCategoryAuthorized`, no ConsentRecord lookup, anywhere beneath
//     it — the property poDisclosure.test.ts asserts by spying on the ledger.
//     A patient cannot switch it off, and no function here accepts input that
//     would let them: mandatory items are not representable as consent
//     sections, and `assertPatientControllable()` throws on them.
//
//   • `poVoluntaryDisclosure()` is the consent path. It denies by default and
//     requires a live, active ConsentRecord authorization for
//     `po_voluntary_coordination`, so revocation/expiry stops it immediately.
//
// LEGAL-CONTENT WARNING: the mandatory/voluntary classification below is a
// working placeholder set modelled on what supervision conditions and court
// orders plainly reach (compliance/attendance facts about court-ordered
// treatment) versus what they do not (general clinical care coordination).
// The authoritative list is Christi's to confirm against actual county
// supervision-condition and court-order language. Nothing statutory is
// invented here, and 42 CFR Part 2 SUD CONTENT is never disclosable through
// either path in this module — Part 2 keeps its own authorization.
import { AdelanteEHR, PO_VOLUNTARY_CONSENT_CATEGORY } from "./ehr";

export type PoDisclosureItem =
  // --- mandatory tier: compliance facts a supervision condition/court order
  //     independently requires, regardless of patient preference.
  | "mandated_program_enrollment"
  | "mandated_session_attendance"
  | "mandated_program_discharge"
  // --- voluntary tier: ordinary care coordination with no independent legal
  //     mandate behind it.
  | "care_plan_progress"
  | "appointment_logistics"
  | "wellness_check_in";

export type PoDisclosureTier = "mandatory" | "voluntary";

export interface PoDisclosureItemDef {
  key: PoDisclosureItem;
  tier: PoDisclosureTier;
  /** Plain-language label shown to the patient. */
  label: string;
  /** Why it is shared — for mandatory items, the legal reason. */
  explanation: string;
}

export const PO_DISCLOSURE_ITEMS: PoDisclosureItemDef[] = [
  {
    key: "mandated_program_enrollment",
    tier: "mandatory",
    label: "Whether you are enrolled in the treatment your supervision requires",
    explanation:
      "Your supervision conditions or court order require this to be reported. You cannot turn it off here, and we will not pretend otherwise.",
  },
  {
    key: "mandated_session_attendance",
    tier: "mandatory",
    label: "Whether you attended the sessions your supervision requires",
    explanation:
      "Attendance at court-ordered or condition-of-supervision sessions is reportable by law, not by choice.",
  },
  {
    key: "mandated_program_discharge",
    tier: "mandatory",
    label: "If you leave or are discharged from a required program",
    explanation:
      "Ending a required program is a compliance event your supervising officer must be told about.",
  },
  {
    key: "care_plan_progress",
    tier: "voluntary",
    label: "How your care plan is going, in general terms",
    explanation:
      "Only shared if you say yes. You can withdraw this at any time and sharing stops immediately.",
  },
  {
    key: "appointment_logistics",
    tier: "voluntary",
    label: "Upcoming appointment times, so your officer can help you get there",
    explanation: "Only shared if you say yes. You can withdraw this at any time.",
  },
  {
    key: "wellness_check_in",
    tier: "voluntary",
    label: "General wellness updates from your care team",
    explanation: "Only shared if you say yes. You can withdraw this at any time.",
  },
];

const TIER = new Map(PO_DISCLOSURE_ITEMS.map((i) => [i.key, i.tier]));

export function poItemTier(item: PoDisclosureItem): PoDisclosureTier {
  return TIER.get(item) ?? "mandatory";
}

/** True only for items the patient genuinely controls. Drives the UI. */
export function isPoItemPatientControllable(item: PoDisclosureItem): boolean {
  return poItemTier(item) === "voluntary";
}

/**
 * Hard guard for any future write path (toggle, revoke, form capture).
 * A mandatory item can never be routed into the consent mechanism.
 */
export function assertPatientControllable(item: PoDisclosureItem): void {
  if (!isPoItemPatientControllable(item))
    throw new Error(
      `${item} is disclosed under a legal mandate and cannot be authorized or revoked by the patient.`,
    );
}

/** The legal basis that makes a mandatory disclosure mandatory. */
export type PoMandateKind = "court_order" | "supervision_condition";

export interface PoMandate {
  kind: PoMandateKind;
  /** Free-text reference to the order/condition document. Audit context only. */
  reference?: string;
}

export type PoGate = "legal_mandate" | "consent_record";

export interface PoDisclosureDecision {
  allowed: boolean;
  gate: PoGate;
  tier: PoDisclosureTier;
  /** True only on the consent path — proves the ledger was consulted. */
  consentChecked: boolean;
  /** True when the patient can change this. Always false on the mandate path. */
  patientControllable: boolean;
  reason: string;
}

/**
 * MANDATORY path. Consent is NOT consulted; do not add a ledger call here.
 * Refuses anything that is not a mandatory item, so a voluntary item can
 * never be laundered through the mandate path.
 */
export function poMandatoryDisclosure(input: {
  item: PoDisclosureItem;
  mandate?: PoMandate;
}): PoDisclosureDecision {
  const tier = poItemTier(input.item);
  if (tier !== "mandatory")
    return {
      allowed: false,
      gate: "legal_mandate",
      tier,
      consentChecked: false,
      patientControllable: true,
      reason: `${input.item} is voluntary care coordination — it requires the patient's consent, not a mandate.`,
    };
  if (!input.mandate)
    return {
      allowed: false,
      gate: "legal_mandate",
      tier,
      consentChecked: false,
      patientControllable: false,
      reason:
        "No court order or supervision condition is on file, so nothing is mandated for this person.",
    };
  return {
    allowed: true,
    gate: "legal_mandate",
    tier,
    consentChecked: false,
    patientControllable: false,
    reason:
      input.mandate.kind === "court_order"
        ? "Required by court order — patient authorization is not the controlling factor."
        : "Required by conditions of supervision — patient authorization is not the controlling factor.",
  };
}

/**
 * VOLUNTARY path. Denies by default; requires a live authorization in the
 * structured ConsentRecord ledger (evaluated fresh on every call, so
 * revocation and expiry stop sharing immediately).
 */
export function poVoluntaryDisclosure(input: {
  patientId: string;
  item: PoDisclosureItem;
  at?: Date;
}): PoDisclosureDecision {
  const tier = poItemTier(input.item);
  if (tier !== "voluntary")
    return {
      allowed: false,
      gate: "consent_record",
      tier,
      consentChecked: false,
      patientControllable: false,
      reason: `${input.item} is disclosed under a legal mandate — it is not consent-controlled and cannot be granted or revoked here.`,
    };
  const authorized = AdelanteEHR.isConsentCategoryAuthorized(
    input.patientId,
    PO_VOLUNTARY_CONSENT_CATEGORY,
    input.at ?? new Date(),
  );
  return {
    allowed: authorized,
    gate: "consent_record",
    tier,
    consentChecked: true,
    patientControllable: true,
    reason: authorized
      ? "Authorized by the active consent record (voluntary probation/parole coordination)."
      : "No active authorization for voluntary sharing with probation/parole.",
  };
}

/**
 * Router for callers holding a mixed request. It PICKS a path by the item's
 * tier; it never merges them. Each branch returns the decision of the
 * mechanism that actually applies.
 */
export function poDisclosureDecision(input: {
  patientId: string;
  item: PoDisclosureItem;
  mandate?: PoMandate;
  at?: Date;
}): PoDisclosureDecision {
  return poItemTier(input.item) === "mandatory"
    ? poMandatoryDisclosure({ item: input.item, mandate: input.mandate })
    : poVoluntaryDisclosure({ patientId: input.patientId, item: input.item, at: input.at });
}
