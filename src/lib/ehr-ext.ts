// §Adelante Expansion — additive EMR extension.
// Houses: organizations/counties/facilities, clinician profile ext,
// credentials, payer enrollments, patient coverage spans, availability
// blocks/exceptions, appointment state machine, note signatures, claims
// worklist, and cross-surface event bus. Never mutates ehr.ts internals.

import { useSyncExternalStore } from "react";
import {
  AdelanteEHR,
  GROUP_MIN_BILLABLE_ATTENDEES,
  groupBillingCode,
  isBillableGroupCategory,
  noteStatus,
  registerClaimBridge,
  type ServiceType,
} from "./ehr";
import { attestationRecordProblem, type AttestationRecord } from "./attestation";
import { canAccess, getActingRole, getActingStaff } from "./roles";
import {
  INACTIVE_PROGRAMS,
  PATIENT_PAY_PROGRAMS,
  PAYMENT_ARRANGEMENTS,
  PROGRAM_INACTIVE,
  PROGRAM_LABEL,
  generalPopulationProgram,
  type PaymentArrangement,
  defaultCodeFor,
  getBillingCode,
  isPayerProgram,
  onRateAdded,
  rateFor,
  selectProgram,
  unitBasisLabel,
  unitsFor,
  type PayerProgram,
  type ServiceLine,
} from "./rates";
import { chwBillingDecision, peerBillingDecision } from "./communityBilling";

// ---------- Types ----------
export interface Organization { id: string; name: string; }
export interface County { id: string; name: string; active: boolean; }
export interface Facility {
  id: string;
  name: string;
  organizationId: string;
  countyId: string;
  address: string;
  city: string;
  timezone: string;
}

export type CredentialKind =
  | "license"
  | "dea"
  | "malpractice"
  | "board_cert"
  | "cv"
  | "caqh"
  | "other";
export type CredentialStatus = "current" | "expiring" | "expired" | "missing" | "under_review";

export interface CredentialDoc {
  id: string;
  clinicianId: string;
  kind: CredentialKind;
  issuingState?: string;
  number?: string;
  issuedAt?: string;
  expiresAt?: string;
  fileName?: string;
  /**
   * §EHR audit Phase 2a — the actual document, stored inline as a base64 data
   * URL. Same convention as the drawn signatures captured by `SignaturePad`.
   * Optional on purpose: seeded and historical rows carry only a file NAME,
   * and those must keep rendering honestly as "no document on file".
   */
  fileDataUrl?: string;
  fileType?: string;
  fileSize?: number;
  /** Staff member who attached the document (owner, or an assisting coordinator). */
  uploadedBy?: string;
  uploadedAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
  verificationMethod?: "primary_source" | "attestation";
  /**
   * §EHR audit Phase 2b — every expiry-date change, with the reason given.
   * Kept rather than overwritten: an expiry edit can block or unblock booking,
   * so who moved it and why has to stay answerable.
   */
  expiryChanges?: {
    at: string;
    by: string;
    from?: string;
    to?: string;
    reason: string;
  }[];
  /** §Phase 2b — coordinator asked the clinician to act on this record. */
  followUp?: {
    requestedBy: string;
    requestedAt: string;
    note: string;
    resolvedAt?: string;
  };
}

export type PayerEnrollmentStatus = "enrolled" | "pending" | "not_enrolled" | "terminated";
export interface PayerEnrollment {
  id: string;
  clinicianId: string;
  payer: string;
  plan?: string;
  billingTin: string;
  status: PayerEnrollmentStatus;
  effectiveFrom?: string;
  effectiveTo?: string;
}

// §Phase 3b — `CoverageSpan` was removed. The one coverage model is
// `Patient.coverage`, with dated payer spans in `coverage.plans`
// (`CoveragePlanSpan` in `@/lib/ehr`).


export type AppointmentModality = "virtual" | "in_person" | "hybrid";
export interface AvailabilityBlock {
  id: string;
  clinicianId: string;
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  start: string; // HH:MM
  end: string; // HH:MM
  modality: AppointmentModality;
  locationId?: string;
  careTypes: ServiceType[];
}
export interface AvailabilityException {
  id: string;
  clinicianId: string;
  date: string; // YYYY-MM-DD
  kind: "off" | "added";
  start?: string;
  end?: string;
  note?: string;
}

export type AppointmentStateExt =
  | "scheduled"
  | "confirmed"
  | "completed"
  | "no_show"
  | "late_cancel"
  | "cancelled_patient"
  | "cancelled_staff"
  | "rescheduled";
export interface AppointmentStateEntry {
  apptId: string;
  state: AppointmentStateExt;
  at: string;
  actor?: string;
  reason?: string;
}

export interface ClinicianProfileExt {
  clinicianId: string;
  specialty: string;
  credentialType: "PMHNP" | "LMFT" | "LCSW" | "MSW" | "Peer" | "PsyD" | "MD" | "MFT-Intern";
  careTypes: ServiceType[];
  languages: string[];
  baseFacilityId?: string;
  active: boolean;
  bio?: string;
}

export interface NoteSignature {
  id: string;
  encounterId: string; // apptId
  clinicianId: string;
  signedAt: string;
  method: "human" | "machine_assisted";
}

export type ClaimState =
  | "documented"
  | "signed"
  | "coded"
  | "generated"
  | "submitted"
  | "paid"
  | "denied"
  | "partial"
  | "written_off";

/**
 * §Phase 7b — the only allowed claim moves. `transitionClaim` enforces this.
 * `written_off → generated` is a reversal (late payment / mistaken write-off)
 * and needs a reason, like the write-off itself.
 */
export const CLAIM_TRANSITIONS: Record<ClaimState, ClaimState[]> = {
  documented: ["signed", "written_off"],
  signed: ["coded", "written_off"],
  coded: ["generated", "written_off"],
  generated: ["submitted", "written_off"],
  submitted: ["paid", "denied"],
  denied: ["generated", "written_off"],
  paid: [],
  partial: [],
  written_off: ["generated"],
};

/** Moves that must carry a reason. */
export function claimMoveNeedsReason(from: ClaimState, to: ClaimState): boolean {
  return to === "denied" || to === "written_off" || from === "written_off";
}

/** The six familiar billing labels (plus partial), each a set of claim states. */
export type BillingBucket = "draft" | "ready" | "submitted" | "paid" | "denied" | "write_off" | "partial";
export function claimBillingBucket(state: ClaimState): BillingBucket {
  switch (state) {
    case "documented":
    case "signed":
    case "coded":
      return "draft";
    case "generated":
      return "ready";
    case "written_off":
      return "write_off";
    default:
      return state;
  }
}

export { BILLING_WRITE_REFUSED } from "./rates";
import { BILLING_WRITE_REFUSED } from "./rates";

export interface Claim {
  id: string;
  encounterId: string;
  patientId: string;
  clinicianId: string;
  state: ClaimState;
  /**
   * §Phase 7c — rate per unit × units, frozen at pricing time. Absent when
   * `rateStatus === "no_rate"`: never priced from a fallback.
   */
  chargeCents?: number;
  /** YYYY-MM-DD the service was delivered — what the rate lookup keys on. */
  serviceDate?: string;
  program?: PayerProgram;
  programSource?: "coverage" | "billing" | "migrated";
  codeSource?: "default" | "hook" | "billing";
  /** Where `units` came from. `schedule` = estimated from the booked length. */
  unitsSource?: "note" | "schedule" | "billing";
  /** Minutes the units were computed from, when minutes-based. */
  minutes?: number;
  rateId?: string;
  rateCentsPerUnit?: number;
  rateStatus?: "priced" | "no_rate";
  /** Human reason when `no_rate`. */
  noRateReason?: string;
  denialReason?: string;
  updatedAt: string;
  history: {
    at: string;
    state: ClaimState;
    /** Staff id (or "system" for creation). */
    actor?: string;
    actorName?: string;
    role?: string;
    note?: string;
    /** §Phase 7b.1 — how this move was justified. */
    via?: "billing" | "note_signature" | "seed_data";
    /** §Phase 7b.1 — the note signature a documented → signed move rests on. */
    signature?: ClaimSignatureTrace;
  }[];
  /** HCPCS/CPT. §Phase 7c — every claim now gets one at creation. */
  serviceCode?: string;
  units?: number;
  taxonomy?: string;
  /** Enrolled provider the claim is billed through (CHW services). */
  supervisingStaffId?: string;
  // ---- §Phase 7d general-population billing ----
  /** Priced provisionally at self-pay: the patient's arrangement isn't recorded. Blocks Ready. */
  arrangementMissing?: boolean;
  /** Commercial infrastructure only — payer-specific rate lookup. Unused at launch. */
  payerId?: string;
  /** Commercial infrastructure only — unused at launch. */
  copayCents?: number;
  deductibleCents?: number;
  /** Basis points (2000 = 20%). */
  coinsuranceBps?: number;
  payerPortionCents?: number;
  patientPortionCents?: number;
  patientPaidCents?: number;
  patientBalanceCents?: number;
  /** Payments exceed the current patient portion after a re-price — needs review, never auto-refunded. */
  overpaidReview?: boolean;
  patientPayments?: PatientPayment[];
}

export type PaymentMethod = "cash" | "check" | "card_external" | "other";
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  check: "Check",
  card_external: "Card (external terminal)",
  other: "Other",
};
export interface PatientPayment {
  id: string;
  amountCents: number;
  /** YYYY-MM-DD */
  receivedOn: string;
  method: PaymentMethod;
  /** Receipt / check number. Never a card number (refused). */
  reference?: string;
  recordedById: string;
  recordedByName: string;
  recordedByRole: string;
  recordedAt: string;
  voidedAt?: string;
  voidedById?: string;
  voidedByName?: string;
  voidReason?: string;
}
export const PAYMENT_EXCEEDS_BALANCE = "That's more than the patient owes on this claim. Overpayments and refunds aren't supported yet.";
export const ARRANGEMENT_MISSING_MSG =
  "Payment arrangement not recorded — confirm before billing. Set the patient's payment arrangement, then retry.";

/**
 * §Phase 7d — who owes what. Self-pay / sliding fee: all patient. Grant/ISL,
 * Medi-Cal, ECM: all payer/funder. Commercial (infra only): copay, then
 * deductible, then coinsurance on the remainder, capped at the charge.
 */
export function patientResponsibility(
  program: PayerProgram | undefined,
  chargeCents: number,
  terms: { copayCents?: number; deductibleCents?: number; coinsuranceBps?: number } = {},
): { payerPortionCents: number; patientPortionCents: number } {
  let patient = 0;
  if (program && PATIENT_PAY_PROGRAMS.has(program)) patient = chargeCents;
  else if (program === "commercial") {
    const copay = terms.copayCents ?? 0;
    const ded = Math.min(terms.deductibleCents ?? 0, Math.max(0, chargeCents - copay));
    const rest = Math.max(0, chargeCents - copay - ded);
    patient = copay + ded + Math.round((rest * (terms.coinsuranceBps ?? 0)) / 10_000);
  }
  patient = Math.min(Math.max(0, patient), chargeCents);
  return { payerPortionCents: chargeCents - patient, patientPortionCents: patient };
}

function paidCents(c: Claim): number {
  return (c.patientPayments ?? []).filter((p) => !p.voidedAt).reduce((s, p) => s + p.amountCents, 0);
}
function applyResponsibility(c: Claim): void {
  const charge = c.rateStatus === "priced" ? (c.chargeCents ?? 0) : 0;
  const split = patientResponsibility(c.program, charge, c);
  c.payerPortionCents = split.payerPortionCents;
  c.patientPortionCents = split.patientPortionCents;
  c.patientPaidCents = paidCents(c);
  c.patientBalanceCents = Math.max(0, split.patientPortionCents - c.patientPaidCents);
  if (c.patientPaidCents > split.patientPortionCents) c.overpaidReview = true;
  else delete c.overpaidReview;
}

/**
 * §Phase 7d — program for a new claim. Funding lane first (grant/ISL/private
 * pay), then the Phase 7c rule with the patient's arrangement in place of the
 * old single non-Medi-Cal bucket. Unrecorded arrangement → self_pay,
 * provisionally, flagged.
 */
function assignProgram(c: Claim, input: { code: string; line: ServiceLine; fundingLane?: string }): void {
  const arrangement = AdelanteEHR.getPatient(c.patientId)?.paymentArrangement;
  const lane = generalPopulationProgram(input.fundingLane, arrangement);
  if (lane) {
    c.program = lane.program;
    c.arrangementMissing = lane.arrangementMissing || undefined;
  } else {
    const cov = coverageContext(c.patientId, c.serviceDate ?? iso().slice(0, 10));
    c.program = selectProgram({ code: input.code, line: input.line, ...cov, ...(arrangement ? { arrangement } : {}) });
    c.arrangementMissing = (!cov.hasMediCal && !arrangement && c.program === "self_pay") || undefined;
  }
  if (!c.arrangementMissing) delete c.arrangementMissing;
  c.programSource = "coverage";
}

// ---------- §Phase 7c pricing ----------

/** Program + line context for a patient on a service date. */
function coverageContext(patientId: string, serviceDate: string): { hasMediCal: boolean; payer?: string } {
  const p = AdelanteEHR.getPatient(patientId);
  const cov = p?.coverage;
  const plan = (cov?.plans ?? []).find((x) => x.from <= serviceDate && (!x.to || serviceDate <= x.to));
  if (plan) return { hasMediCal: /medi-?cal|MHP|DMC|county/i.test(`${plan.payer} ${plan.plan ?? ""}`), payer: plan.payer };
  const t = cov?.coverageType;
  return { hasMediCal: t === "medi_cal" || t === "dual" };
}

function lineFor(fundingLane: string | undefined, serviceType: string | undefined, patientId: string): ServiceLine {
  if (fundingLane === "dmc_ods") return "sud";
  if (fundingLane && fundingLane !== "dmc_ods") return "mh";
  void serviceType;
  return AdelanteEHR.getPatient(patientId)?.needs?.substanceUse ? "sud" : "mh";
}

/** Signed-note minutes for a visit, if the note documents them. */
function noteMinutesForEncounter(patientId: string, apptId: string): number | undefined {
  const notes = AdelanteEHR.getPatient(patientId)?.progressNotes ?? [];
  const n = notes.find((x) => x.appointmentId === apptId);
  const v = Number(n?.templateAnswers?.["service_minutes"] ?? NaN);
  return Number.isFinite(v) && v > 0 ? v : undefined;
}

/**
 * The ONE place a claim amount is decided: code's unit rule × effective rate
 * for (code, program, service date). No fallback price exists anywhere.
 */
function applyPricing(c: Claim): void {
  const code = c.serviceCode ? getBillingCode(c.serviceCode) : undefined;
  if (code && c.minutes !== undefined && c.unitsSource !== "billing") c.units = unitsFor(code, c.minutes);
  if (code && c.units === undefined) c.units = 1;
  const fail = (why: string) => {
    c.rateStatus = "no_rate";
    c.noRateReason = why;
    delete c.chargeCents;
    delete c.rateId;
    delete c.rateCentsPerUnit;
    applyResponsibility(c);
  };
  if (!c.serviceCode) return fail("No billing code on this claim.");
  if (!code) return fail(`Billing code ${c.serviceCode} isn't in the code table.`);
  if (!c.program) return fail("No payer program on this claim.");
  const day = c.serviceDate ?? iso().slice(0, 10);
  const r = rateFor(c.serviceCode, c.program, day, c.payerId);
  if (!r) return fail(`No rate on file for ${c.serviceCode} / ${PROGRAM_LABEL[c.program]} on ${day}.`);
  c.rateStatus = "priced";
  delete c.noRateReason;
  c.rateId = r.id;
  c.rateCentsPerUnit = r.amountCents;
  c.chargeCents = r.amountCents * (c.units ?? 1);
  applyResponsibility(c);
}

/** "4 × 15 min, from note" style label for billing screens. */
export function claimUnitLabel(c: Claim): string {
  if (!c.serviceCode) return "—";
  const code = getBillingCode(c.serviceCode);
  const basis = unitBasisLabel(code);
  const src =
    c.unitsSource === "schedule" ? "estimated from schedule" : c.unitsSource === "billing" ? "corrected by billing" : "from note";
  return `${c.units ?? 1} × ${basis}, ${src}`;
}

const CLAIM_LOCKED: ClaimState[] = ["submitted", "paid", "denied", "partial"];

// ---------- Seed data ----------
const uid = () => Math.random().toString(36).slice(2, 10);
const iso = (d = new Date()) => d.toISOString();
const daysFromNow = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);

const organizations: Organization[] = [{ id: "org-adelante", name: "Adelante Pathways" }];
const counties: County[] = [
  { id: "tulare", name: "Tulare", active: true },
  { id: "kings", name: "Kings", active: false },
];
const facilities: Facility[] = [
  {
    id: "fac-premier-tulare",
    name: "Premier SUD & Mental Health, Tulare",
    organizationId: "org-adelante",
    countyId: "tulare",
    address: "1201 S Mooney Blvd",
    city: "Visalia, CA",
    timezone: "America/Los_Angeles",
  },
];

const clinicianProfiles: ClinicianProfileExt[] = [
  {
    clinicianId: "c1",
    specialty: "Trauma-informed therapy, adult SUD",
    credentialType: "LCSW",
    careTypes: ["therapy_individual", "care_coordination", "intake"],
    languages: ["English", "Spanish"],
    baseFacilityId: "fac-premier-tulare",
    active: true,
    bio: "Bilingual therapist focused on early reentry and family systems.",
  },
  {
    clinicianId: "c2",
    specialty: "Adult psychiatry, MOUD",
    credentialType: "PMHNP",
    careTypes: ["med_management", "intake"],
    languages: ["English"],
    baseFacilityId: "fac-premier-tulare",
    active: true,
    bio: "PMHNP prescriber; buprenorphine + antidepressant management.",
  },
  {
    clinicianId: "c3",
    specialty: "Peer support, harm reduction",
    credentialType: "Peer",
    careTypes: ["peer_support", "case_management"],
    languages: ["English", "Spanish"],
    baseFacilityId: "fac-premier-tulare",
    active: true,
  },
];

const credentials: CredentialDoc[] = [
  {
    id: uid(),
    clinicianId: "c1",
    kind: "license",
    issuingState: "CA",
    number: "LCSW-88213",
    issuedAt: "2021-01-15",
    expiresAt: daysFromNow(210),
    fileName: "lcsw_license.pdf",
    uploadedAt: iso(),
    verifiedAt: iso(),
    verifiedBy: "credentialing_coordinator",
    verificationMethod: "primary_source",
  },
  {
    id: uid(),
    clinicianId: "c1",
    kind: "malpractice",
    number: "MP-4429",
    expiresAt: daysFromNow(21),
    fileName: "malpractice_coi.pdf",
    uploadedAt: iso(),
  },
  {
    id: uid(),
    clinicianId: "c2",
    kind: "license",
    issuingState: "CA",
    number: "PMHNP-32101",
    expiresAt: daysFromNow(45),
    fileName: "np_license.pdf",
    uploadedAt: iso(),
    verifiedAt: iso(),
    verifiedBy: "credentialing_coordinator",
    verificationMethod: "primary_source",
  },
  {
    id: uid(),
    clinicianId: "c2",
    kind: "dea",
    number: "BW-7788221",
    expiresAt: daysFromNow(400),
    fileName: "dea.pdf",
    uploadedAt: iso(),
    verifiedAt: iso(),
  },
  {
    id: uid(),
    clinicianId: "c3",
    kind: "cv",
    fileName: "peer_cv.pdf",
    uploadedAt: iso(),
  },
];

const payerEnrollments: PayerEnrollment[] = [
  { id: uid(), clinicianId: "c1", payer: "Medi-Cal FFS", billingTin: "84-1234567", status: "enrolled", effectiveFrom: "2024-06-01" },
  { id: uid(), clinicianId: "c1", payer: "Health Net Medi-Cal", billingTin: "84-1234567", status: "enrolled" },
  { id: uid(), clinicianId: "c1", payer: "Anthem Blue Cross Medi-Cal", billingTin: "84-1234567", status: "pending" },
  { id: uid(), clinicianId: "c2", payer: "Medi-Cal FFS", billingTin: "84-1234567", status: "enrolled" },
  { id: uid(), clinicianId: "c2", payer: "Tulare County MHP", billingTin: "84-1234567", status: "enrolled" },
  { id: uid(), clinicianId: "c2", payer: "CalViva Health", billingTin: "84-1234567", status: "not_enrolled" },
  { id: uid(), clinicianId: "c3", payer: "Medi-Cal FFS", billingTin: "84-1234567", status: "enrolled" },
];

// §Phase 3b — the `coverageSpans` store that used to live here was a second,
// disconnected coverage shape. Its rows were migrated onto
// `Patient.coverage.plans`, which is the single coverage model. Read them with
// `AdelanteEHR.listCoveragePlans` / `AdelanteEHR.activeCoveragePlan`.


const availabilityBlocks: AvailabilityBlock[] = [
  { id: uid(), clinicianId: "c1", weekday: 1, start: "09:00", end: "17:00", modality: "hybrid", locationId: "loc-visalia", careTypes: ["therapy_individual", "intake"] },
  { id: uid(), clinicianId: "c1", weekday: 3, start: "09:00", end: "17:00", modality: "virtual", careTypes: ["therapy_individual"] },
  { id: uid(), clinicianId: "c1", weekday: 5, start: "09:00", end: "13:00", modality: "hybrid", locationId: "loc-visalia", careTypes: ["therapy_individual", "care_coordination"] },
  { id: uid(), clinicianId: "c2", weekday: 2, start: "10:00", end: "16:00", modality: "hybrid", locationId: "loc-visalia", careTypes: ["med_management", "intake"] },
  { id: uid(), clinicianId: "c2", weekday: 4, start: "10:00", end: "16:00", modality: "virtual", careTypes: ["med_management"] },
  { id: uid(), clinicianId: "c3", weekday: 1, start: "10:00", end: "15:00", modality: "hybrid", locationId: "loc-porterville", careTypes: ["peer_support", "case_management"] },
  { id: uid(), clinicianId: "c3", weekday: 4, start: "10:00", end: "15:00", modality: "virtual", careTypes: ["peer_support"] },
];
const availabilityExceptions: AvailabilityException[] = [];

const apptStateHistory: AppointmentStateEntry[] = [];
const noteSignatures: NoteSignature[] = [];
const claims: Claim[] = [];

// ---------- Reactive store ----------
type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};
function subscribe(cb: Listener) { listeners.add(cb); return () => { listeners.delete(cb); }; }

// ---------- Cross-surface event bus ----------
export type EhrEvent =
  | { type: "credential.updated"; clinicianId: string }
  | { type: "enrollment.updated"; clinicianId: string }
  | { type: "availability.updated"; clinicianId: string }
  | { type: "clinician.deactivated"; clinicianId: string }
  | { type: "appointment.state"; apptId: string; state: AppointmentStateExt }
  | { type: "note.signed"; encounterId: string; clinicianId: string }
  | { type: "claim.updated"; claimId: string; state: ClaimState };
const busSubs = new Set<(e: EhrEvent) => void>();
export const ehrBus = {
  publish(e: EhrEvent) { busSubs.forEach((fn) => fn(e)); emit(); },
  subscribe(fn: (e: EhrEvent) => void) { busSubs.add(fn); return () => { busSubs.delete(fn); }; },
};

// ---------- Derived: credential status ----------
function computeCredentialStatus(c: CredentialDoc): CredentialStatus {
  if (!c.expiresAt && (c.kind === "license" || c.kind === "malpractice" || c.kind === "dea")) return "missing";
  if (!c.expiresAt) return c.verifiedAt ? "current" : "under_review";
  const exp = +new Date(c.expiresAt);
  const now = Date.now();
  if (exp < now) return "expired";
  const window = c.kind === "malpractice" ? 30 : 60;
  if (exp - now < window * 86400_000) return "expiring";
  return c.verifiedAt ? "current" : "under_review";
}

// ---------- Namespace ----------
/** §Phase 7b.1 — refusal prefix for the claim-signing path. */
export const CLAIM_SIGN_REFUSED = "Claim not signed";

/** §Phase 7b.1 — what a billing reviewer needs to trace a signed claim. */
export interface ClaimSignatureTrace {
  noteId: string;
  statementKey: string;
  statementVersion: string;
  signerId: string;
  signerName: string;
  signerRole: string;
  signedAt: string;
  cosign: boolean;
  /** Original (trainee) author, when the final signature was a cosign. */
  authorName?: string;
}

/**
 * §Phase 7b.1 — the explicit, clearly named SEED path. Demo data only: moves
 * a claim through `steps` without a note, and writes an audit row per move
 * marked `seed: true` so it can never pass for a real signature.
 */
function seedClaimSteps(claim: Claim, clinicianId: string, steps: ClaimState[], reason: string) {
  if (!noteSignatures.some((x) => x.encounterId === claim.encounterId))
    noteSignatures.push({ id: uid(), encounterId: claim.encounterId, clinicianId, signedAt: iso(), method: "human" });
  for (const st of steps) {
    const from = claim.state;
    claim.state = st;
    claim.history.push({ at: iso(), state: st, actor: "seed", via: "seed_data", note: `seed data: ${reason}` });
    AdelanteEHR.recordClaimStatusChange({
      claimId: claim.id,
      patientId: claim.patientId,
      from,
      to: st,
      actorId: "seed",
      actorRole: "seed",
      via: "seed_data",
      reason: `seed data: ${reason}`,
      seed: true,
    });
  }
}

export const AdelanteEHRExt = {
  // Reads
  listOrganizations: () => organizations,
  listCounties: () => counties,
  listFacilities: () => facilities,
  getFacility: (id?: string) => facilities.find((f) => f.id === id),

  getClinicianProfile: (id: string) => clinicianProfiles.find((p) => p.clinicianId === id),
  listClinicianProfiles: () => clinicianProfiles,

  credentialsForClinician: (id: string): (CredentialDoc & { status: CredentialStatus })[] =>
    credentials.filter((c) => c.clinicianId === id).map((c) => ({ ...c, status: computeCredentialStatus(c) })),
  listAllCredentials: (): (CredentialDoc & { status: CredentialStatus })[] =>
    credentials.map((c) => ({ ...c, status: computeCredentialStatus(c) })),

  enrollmentsForClinician: (id: string) => payerEnrollments.filter((e) => e.clinicianId === id),
  listAllEnrollments: () => payerEnrollments,


  availabilityBlocksForClinician: (id: string) => availabilityBlocks.filter((b) => b.clinicianId === id),
  availabilityExceptionsForClinician: (id: string) => availabilityExceptions.filter((e) => e.clinicianId === id),

  apptStateHistoryFor: (apptId: string) => apptStateHistory.filter((h) => h.apptId === apptId),
  currentApptState(apptId: string): AppointmentStateExt {
    const hist = apptStateHistory.filter((h) => h.apptId === apptId);
    return hist.length ? hist[hist.length - 1].state : "scheduled";
  },
  isNoteSigned: (encounterId: string) => noteSignatures.some((n) => n.encounterId === encounterId),
  listUnsignedCompletedAppts() {
    const all = AdelanteEHR.listAppointments();
    return all.filter((a) => a.status === "attended" && !this.isNoteSigned(a.id));
  },
  listClaims: () => claims.slice().sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)),

  // Mutations
  upsertClinicianProfile(patch: Partial<ClinicianProfileExt> & { clinicianId: string }) {
    const i = clinicianProfiles.findIndex((p) => p.clinicianId === patch.clinicianId);
    if (i >= 0) clinicianProfiles[i] = { ...clinicianProfiles[i], ...patch };
    else
      clinicianProfiles.push({
        clinicianId: patch.clinicianId,
        specialty: patch.specialty ?? "",
        credentialType: patch.credentialType ?? "LCSW",
        careTypes: patch.careTypes ?? [],
        languages: patch.languages ?? ["English"],
        active: patch.active ?? true,
      });
    emit();
  },
  setClinicianActive(clinicianId: string, active: boolean, reason?: string) {
    const p = clinicianProfiles.find((x) => x.clinicianId === clinicianId);
    if (!p) return;
    p.active = active;
    if (!active) {
      // Freeze future bookings + flag existing future appts for coordinator review.
      const now = Date.now();
      const future = AdelanteEHR.appointmentsForClinician(clinicianId).filter(
        (a) => +new Date(a.start) > now && a.status === "scheduled",
      );
      future.forEach((a) =>
        apptStateHistory.push({
          apptId: a.id,
          state: "scheduled",
          at: iso(),
          actor: "system",
          reason: `Clinician deactivated: ${reason ?? "no reason given"}. Coordinator review required.`,
        }),
      );
      ehrBus.publish({ type: "clinician.deactivated", clinicianId });
    }
    emit();
  },

  /**
   * §EHR audit Phase 2a — licence expiry reconciliation.
   * The `license` credential document is the source of truth; the booking
   * hard-stop field on the clinician record is kept in step with it. When
   * several licence documents exist, the LATEST expiry wins (a renewal
   * supersedes the lapsing one). With no licence document on file the field is
   * left untouched rather than cleared: absence of a scan is not proof that a
   * licence lapsed, and silently unblocking or blocking booking on that basis
   * would be wrong.
   */
  syncLicenseExpiry(clinicianId: string) {
    const dates = credentials
      .filter((c) => c.clinicianId === clinicianId && c.kind === "license" && c.expiresAt)
      .map((c) => c.expiresAt!)
      .sort();
    const latest = dates[dates.length - 1];
    if (latest) AdelanteEHR.setClinicianLicenseExpiry(clinicianId, latest);
  },
  addCredential(input: Omit<CredentialDoc, "id" | "uploadedAt">) {
    const c: CredentialDoc = { ...input, id: uid(), uploadedAt: iso() };
    credentials.push(c);
    // §Phase 2b — uploading the thing that was asked for answers the request.
    credentials
      .filter(
        (x) =>
          x.clinicianId === c.clinicianId &&
          x.kind === c.kind &&
          x.followUp &&
          !x.followUp.resolvedAt,
      )
      .forEach((x) => {
        x.followUp = { ...x.followUp!, resolvedAt: iso() };
      });
    this.syncLicenseExpiry(c.clinicianId);
    ehrBus.publish({ type: "credential.updated", clinicianId: c.clinicianId });
  },
  verifyCredential(id: string, by: string) {
    const c = credentials.find((x) => x.id === id);
    if (!c) return;
    c.verifiedAt = iso();
    c.verifiedBy = by;
    c.verificationMethod = c.verificationMethod ?? "primary_source";
    ehrBus.publish({ type: "credential.updated", clinicianId: c.clinicianId });
  },
  removeCredential(id: string) {
    const i = credentials.findIndex((x) => x.id === id);
    if (i >= 0) {
      const clinicianId = credentials[i].clinicianId;
      credentials.splice(i, 1);
      this.syncLicenseExpiry(clinicianId);
      ehrBus.publish({ type: "credential.updated", clinicianId });
    }
  },

  // ----- §EHR audit Phase 2b — credentialing admin actions ------------------
  // These are the coordinator-side actions the dashboard was missing. They sit
  // beside the Phase 2a owner/assist upload path rather than replacing it, and
  // every expiry change runs back through `syncLicenseExpiry`, so the booking
  // hard-stop can never drift away from the document on file.

  /**
   * Edit a credential record. Changing the expiry date is materially different
   * from fixing a typo — it can block or unblock booking — so it requires a
   * reason, which is kept on the record.
   */
  updateCredential(
    id: string,
    patch: Partial<Pick<CredentialDoc, "kind" | "number" | "issuingState" | "issuedAt" | "expiresAt">>,
    by: string,
    reason?: string,
  ) {
    const c = credentials.find((x) => x.id === id);
    if (!c) throw new Error("Credential not found.");
    const expiryChanged = patch.expiresAt !== undefined && patch.expiresAt !== c.expiresAt;
    if (expiryChanged && !(reason ?? "").trim())
      throw new Error("A reason is required to change an expiry date.");
    const before = c.expiresAt;
    Object.assign(c, patch);
    if (expiryChanged) {
      c.expiryChanges = [
        ...(c.expiryChanges ?? []),
        { at: iso(), by, from: before, to: patch.expiresAt, reason: reason!.trim() },
      ];
      // A changed expiry is a new fact to verify — the old verification
      // attested to a date that no longer applies.
      c.verifiedAt = undefined;
      c.verifiedBy = undefined;
    }
    this.syncLicenseExpiry(c.clinicianId);
    ehrBus.publish({ type: "credential.updated", clinicianId: c.clinicianId });
    return { ...c };
  },

  /** Flag a credential as needing the clinician's own attention. */
  requestCredentialFollowUp(id: string, by: string, note: string) {
    const c = credentials.find((x) => x.id === id);
    if (!c) throw new Error("Credential not found.");
    if (!note.trim()) throw new Error("Say what the clinician needs to do.");
    c.followUp = { requestedBy: by, requestedAt: iso(), note: note.trim() };
    ehrBus.publish({ type: "credential.updated", clinicianId: c.clinicianId });
    return { ...c };
  },

  clearCredentialFollowUp(id: string) {
    const c = credentials.find((x) => x.id === id);
    if (!c?.followUp) return;
    c.followUp = { ...c.followUp, resolvedAt: iso() };
    ehrBus.publish({ type: "credential.updated", clinicianId: c.clinicianId });
  },



  upsertEnrollment(input: Omit<PayerEnrollment, "id"> & { id?: string }) {
    if (input.id) {
      const i = payerEnrollments.findIndex((x) => x.id === input.id);
      if (i >= 0) payerEnrollments[i] = { ...payerEnrollments[i], ...input, id: input.id };
    } else {
      payerEnrollments.push({ ...input, id: uid() });
    }
    ehrBus.publish({ type: "enrollment.updated", clinicianId: input.clinicianId });
  },

  upsertAvailabilityBlock(input: Omit<AvailabilityBlock, "id"> & { id?: string }) {
    if (input.id) {
      const i = availabilityBlocks.findIndex((x) => x.id === input.id);
      if (i >= 0) availabilityBlocks[i] = { ...availabilityBlocks[i], ...input, id: input.id };
    } else {
      availabilityBlocks.push({ ...input, id: uid() });
    }
    ehrBus.publish({ type: "availability.updated", clinicianId: input.clinicianId });
  },
  removeAvailabilityBlock(id: string) {
    const i = availabilityBlocks.findIndex((x) => x.id === id);
    if (i >= 0) {
      const clinicianId = availabilityBlocks[i].clinicianId;
      availabilityBlocks.splice(i, 1);
      ehrBus.publish({ type: "availability.updated", clinicianId });
    }
  },
  addAvailabilityException(input: Omit<AvailabilityException, "id">) {
    availabilityExceptions.push({ ...input, id: uid() });
    ehrBus.publish({ type: "availability.updated", clinicianId: input.clinicianId });
  },

  transitionAppointment(apptId: string, next: AppointmentStateExt, actor?: string, reason?: string) {
    apptStateHistory.push({ apptId, state: next, at: iso(), actor, reason });
    // Mirror onto underlying ehr where possible.
    if (next === "completed") AdelanteEHR.updateAppointmentStatus(apptId, "attended");
    if (next === "no_show") AdelanteEHR.updateAppointmentStatus(apptId, "no_show");
    if (next === "cancelled_patient" || next === "cancelled_staff" || next === "late_cancel")
      AdelanteEHR.updateAppointmentStatus(apptId, "cancelled");
    ehrBus.publish({ type: "appointment.state", apptId, state: next });
  },

  /**
   * `signerId` is the REAL acting user's token, never the encounter's original
   * clinician. Callers come through `signUnsignedWorkRow` (noteSignFlow.ts),
   * which authorizes the actor first.
   */
  /**
   * Encounter signature ledger entry only. §Phase 7b.1 — this no longer moves
   * the claim; the only claim-signing path is `markClaimSignedFromNote`,
   * which needs a genuinely final note and its attestation.
   */
  signNote(encounterId: string, signerId: string, method: "human" | "machine_assisted" = "human") {
    if (this.isNoteSigned(encounterId)) return;
    noteSignatures.push({ id: uid(), encounterId, clinicianId: signerId, signedAt: iso(), method });
    ehrBus.publish({ type: "note.signed", encounterId, clinicianId: signerId });
  },

  /**
   * §Phase 7b.1 — THE claim-signing path. Refuses (nothing changes) unless the
   * note exists, is linked to a visit, is FINAL (signed without cosign, or
   * cosigned), and `attestation` is the exact record stored for that final
   * signature and still passes the ceremony check. Signer identity comes from
   * the note, never from the acting session. Clinical action: no billing write.
   */
  markClaimSignedFromNote(input: {
    patientId: string;
    noteId: string;
    attestation: AttestationRecord | undefined;
  }): { ok: true; claimId?: string } | { ok: false; error: string } {
    const { n } = AdelanteEHR._findNote(input.patientId, input.noteId);
    if (!n) return { ok: false, error: `${CLAIM_SIGN_REFUSED}: note not found.` };
    if (!n.appointmentId) return { ok: false, error: `${CLAIM_SIGN_REFUSED}: note has no linked visit.` };
    const status = noteStatus(n);
    const final = status === "cosigned" || (status === "signed" && !n.cosignRequired);
    if (!final)
      return {
        ok: false,
        error:
          status === "cosign_pending"
            ? `${CLAIM_SIGN_REFUSED}: note is awaiting cosign.`
            : `${CLAIM_SIGN_REFUSED}: note is not signed.`,
      };
    const cosign = status === "cosigned";
    const stored = cosign ? n.cosignAttestation : n.attestation;
    const statementId = cosign ? "progress_note_supervisor_sign" : stored?.statementId ?? "progress_note_sign";
    if (!stored || !input.attestation)
      return { ok: false, error: `${CLAIM_SIGN_REFUSED}: no attestation on the final signature.` };
    if (
      stored.signedAt !== input.attestation.signedAt ||
      stored.statementId !== input.attestation.statementId ||
      stored.signatureDataUrl !== input.attestation.signatureDataUrl
    )
      return { ok: false, error: `${CLAIM_SIGN_REFUSED}: attestation does not match the note.` };
    if (!["progress_note_sign", "progress_note_supervisor_sign"].includes(statementId))
      return { ok: false, error: `${CLAIM_SIGN_REFUSED}: wrong attestation statement.` };
    const problem = attestationRecordProblem(stored, statementId);
    if (problem) return { ok: false, error: `${CLAIM_SIGN_REFUSED}: ${problem}` };

    const encounterId = n.appointmentId;
    const trace: ClaimSignatureTrace = {
      noteId: n.id,
      statementKey: stored.statementId,
      statementVersion: stored.statementVersion,
      signerId: (cosign ? n.cosignedById ?? n.cosignedBy : n.signedById ?? n.signedBy) ?? "unknown",
      signerName: (cosign ? n.cosignedBy : n.signedBy) ?? stored.signedBy,
      signerRole: (cosign ? n.cosignedRole : n.signedRole) ?? "unknown",
      signedAt: (cosign ? n.cosignedAt : n.signedAt) ?? stored.signedAt,
      cosign,
      ...(cosign && n.signedBy ? { authorName: n.signedBy } : {}),
    };
    this.signNote(encounterId, trace.signerId);
    const claim = claims.find((c) => c.encounterId === encounterId);
    if (!claim || claim.state !== "documented") return { ok: true, ...(claim ? { claimId: claim.id } : {}) };
    const at = iso();
    // §Phase 7c — the signed note is where documented minutes come from.
    if (claim.unitsSource !== "billing") {
      const m = noteMinutesForEncounter(claim.patientId, encounterId);
      if (m !== undefined) {
        claim.minutes = m;
        claim.unitsSource = "note";
        applyPricing(claim);
      }
    }
    claim.state = "signed";
    claim.updatedAt = at;
    claim.history.push({
      at,
      state: "signed",
      actor: trace.signerId,
      actorName: trace.signerName,
      role: trace.signerRole,
      note: cosign ? "note cosigned" : "note signed",
      via: "note_signature",
      signature: trace,
    });
    AdelanteEHR.recordClaimStatusChange({
      claimId: claim.id,
      patientId: claim.patientId,
      from: "documented",
      to: "signed",
      actorId: trace.signerId,
      actorRole: trace.signerRole,
      actorName: trace.signerName,
      via: "note_signature",
      signature: { ...trace },
    });
    ehrBus.publish({ type: "claim.updated", claimId: claim.id, state: claim.state });
    return { ok: true, claimId: claim.id };
  },

  /** §Phase 7b.1 — the signature trace behind a claim, if any. */
  claimSignature(claim: Claim): ClaimSignatureTrace | "seed" | undefined {
    for (const h of [...claim.history].reverse()) {
      if (h.state !== "signed") continue;
      if (h.signature) return h.signature;
      if (h.via === "seed_data" || h.actor === "seed") return "seed";
    }
    return undefined;
  },

  claimForEncounter(encounterId: string): Claim | undefined {
    return claims.find((c) => c.encounterId === encounterId);
  },


  upsertClaimFromEncounter(apptId: string): Claim {
    let claim = claims.find((c) => c.encounterId === apptId);
    if (claim) return claim;
    const appt = AdelanteEHR.listAppointments().find((a) => a.id === apptId);
    if (!appt) throw new Error("Appt not found");
    claim = {
      id: uid(),
      encounterId: apptId,
      patientId: appt.patientId,
      clinicianId: appt.clinicianId,
      state: "documented",
      updatedAt: iso(),
      history: [{ at: iso(), state: "documented", actor: "system" }],
    };
    {
      const serviceDate = appt.start.slice(0, 10);
      const line = lineFor(appt.fundingLane, appt.serviceType, appt.patientId);
      const code = defaultCodeFor(appt.serviceType, line);
      const cov = coverageContext(appt.patientId, serviceDate);
      const noteMin = noteMinutesForEncounter(appt.patientId, apptId);
      claim.serviceDate = serviceDate;
      claim.serviceCode = code;
      claim.codeSource = "default";
      void cov;
      assignProgram(claim, { code, line, fundingLane: appt.fundingLane });
      claim.minutes = noteMin ?? appt.durationMin;
      claim.unitsSource = noteMin !== undefined ? "note" : "schedule";
      applyPricing(claim);
    }
    claims.push(claim);
    ehrBus.publish({ type: "claim.updated", claimId: claim.id, state: claim.state });
    return claim;
  },
  /**
   * §Phase 7b — the ONE write path for billing status. The actor is the real
   * acting staff member (callers cannot pass one); only roles with `billing`
   * write may call it — a read-only role is refused here and nothing changes.
   */
  transitionClaim(
    claimId: string,
    to: ClaimState,
    opts?: { denialReason?: string; note?: string },
  ): { ok: true } | { ok: false; error: string } {
    const role = getActingRole();
    if (canAccess(role, "billing").level !== "write") return { ok: false, error: BILLING_WRITE_REFUSED };
    const c = claims.find((x) => x.id === claimId);
    if (!c) return { ok: false, error: "Claim not found." };
    const from = c.state;
    if (!CLAIM_TRANSITIONS[from].includes(to))
      return { ok: false, error: `Cannot move claim from ${from} to ${to}.` };
    if (to === "generated" && c.rateStatus !== "priced")
      return { ok: false, error: `${c.noRateReason ?? "No rate on file."} Add a rate, then retry.` };
    if (to === "generated" && c.arrangementMissing) return { ok: false, error: ARRANGEMENT_MISSING_MSG };
    const reason = (opts?.denialReason ?? opts?.note ?? "").trim();
    if (claimMoveNeedsReason(from, to) && !reason)
      return {
        ok: false,
        error:
          to === "denied"
            ? "Denial reason is required."
            : from === "written_off"
              ? "A reason is required to reverse a write-off."
              : "A reason is required to write off a claim.",
      };
    const staff = getActingStaff();
    const at = iso();
    c.state = to;
    c.updatedAt = at;
    if (to === "denied") c.denialReason = reason;
    c.history.push({
      at,
      state: to,
      actor: staff.id,
      actorName: staff.name,
      role,
      ...(reason ? { note: reason } : {}),
    });
    AdelanteEHR.recordClaimStatusChange({
      claimId: c.id,
      patientId: c.patientId,
      from,
      to,
      actorId: staff.id,
      actorRole: role,
      actorName: staff.name,
      via: "billing",
      ...(reason ? { reason } : {}),
    });
    ehrBus.publish({ type: "claim.updated", claimId: c.id, state: to });
    return { ok: true };
  },

  /**
   * §Phase 7c — billing corrections to code / program / units. Billing write
   * only, reason required, blocked once submitted, audited; every correction
   * re-prices from the rate table.
   */
  correctClaim(
    claimId: string,
    change: { serviceCode?: string; program?: string; units?: number },
    reason: string,
  ): { ok: true; claim: Claim } | { ok: false; error: string } {
    const role = getActingRole();
    if (canAccess(role, "billing").level !== "write") return { ok: false, error: BILLING_WRITE_REFUSED };
    const c = claims.find((x) => x.id === claimId);
    if (!c) return { ok: false, error: "Claim not found." };
    if (CLAIM_LOCKED.includes(c.state)) return { ok: false, error: "This claim has been submitted and can't be corrected here." };
    if (!reason.trim()) return { ok: false, error: "A reason is required to correct a claim." };
    const code = change.serviceCode?.trim().toUpperCase();
    if (code !== undefined && !getBillingCode(code)) return { ok: false, error: `Billing code ${code} isn't in the code table.` };
    if (change.program !== undefined && !isPayerProgram(change.program)) return { ok: false, error: "Unknown payer program." };
    if (change.program !== undefined && INACTIVE_PROGRAMS.has(change.program as PayerProgram)) return { ok: false, error: PROGRAM_INACTIVE };
    if (change.units !== undefined && (!Number.isInteger(change.units) || change.units < 1))
      return { ok: false, error: "Units must be a whole number of at least 1." };
    const before = { serviceCode: c.serviceCode ?? null, program: c.program ?? null, units: c.units ?? null, chargeCents: c.chargeCents ?? null };
    if (code !== undefined) {
      c.serviceCode = code;
      c.codeSource = "billing";
    }
    if (change.program !== undefined) {
      c.program = change.program as PayerProgram;
      c.programSource = "billing";
      delete c.arrangementMissing;
    }
    if (change.units !== undefined) {
      c.units = change.units;
      c.unitsSource = "billing";
    }
    applyPricing(c);
    const staff = getActingStaff();
    const at = iso();
    c.updatedAt = at;
    c.history.push({ at, state: c.state, actor: staff.id, actorName: staff.name, role, note: `corrected: ${reason.trim()}` });
    AdelanteEHR.recordBillingAudit({
      action: "claim_corrected",
      actorId: staff.id,
      actorRole: role,
      patientId: c.patientId,
      detail: {
        claimId: c.id,
        before,
        after: { serviceCode: c.serviceCode ?? null, program: c.program ?? null, units: c.units ?? null, chargeCents: c.chargeCents ?? null },
        reason: reason.trim(),
        actorName: staff.name,
      },
    });
    ehrBus.publish({ type: "claim.updated", claimId: c.id, state: c.state });
    return { ok: true, claim: { ...c } };
  },

  /**
   * §Phase 7d — billing records how a general-population patient pays.
   * Billing write only, audited. Re-prices the patient's open, unsubmitted
   * claims whose program came from coverage (not a billing correction) and
   * clears the "arrangement not recorded" flag.
   */
  setPaymentArrangement(
    patientId: string,
    arrangement: PaymentArrangement,
  ): { ok: true; repriced: string[] } | { ok: false; error: string } {
    const role = getActingRole();
    if (canAccess(role, "billing").level !== "write") return { ok: false, error: BILLING_WRITE_REFUSED };
    if (!PAYMENT_ARRANGEMENTS.some((a) => a.id === arrangement)) return { ok: false, error: "Choose a payment arrangement." };
    const p = AdelanteEHR.getPatient(patientId);
    if (!p) return { ok: false, error: "Patient not found." };
    const before = p.paymentArrangement ?? null;
    AdelanteEHR._setPaymentArrangement(patientId, arrangement);
    const staff = getActingStaff();
    const repriced: string[] = [];
    for (const c of claims) {
      if (c.patientId !== patientId || CLAIM_LOCKED.includes(c.state) || c.state === "written_off") continue;
      if (c.programSource === "billing" && !c.arrangementMissing) continue;
      if (!(c.arrangementMissing || c.program === "self_pay" || c.program === "sliding_fee" || c.program === "grant_isl")) continue;
      const appt = AdelanteEHR.listAppointments().find((a) => a.id === c.encounterId);
      if (appt?.fundingLane === "isl_non_medi_cal" || appt?.fundingLane === "bhsa") continue;
      const beforeClaim = { program: c.program ?? null, chargeCents: c.chargeCents ?? null, patientPortionCents: c.patientPortionCents ?? null };
      c.program = arrangement;
      delete c.arrangementMissing;
      applyPricing(c);
      c.updatedAt = iso();
      c.history.push({ at: c.updatedAt, state: c.state, actor: staff.id, actorName: staff.name, role, via: "billing", note: `payment arrangement set: ${arrangement}` });
      AdelanteEHR.recordBillingAudit({
        action: "claim_repriced_for_arrangement",
        actorId: staff.id,
        actorRole: role,
        patientId,
        detail: { claimId: c.id, before: beforeClaim, after: { program: c.program, chargeCents: c.chargeCents ?? null, patientPortionCents: c.patientPortionCents ?? null }, actorName: staff.name },
      });
      repriced.push(c.id);
      ehrBus.publish({ type: "claim.updated", claimId: c.id, state: c.state });
    }
    AdelanteEHR.recordBillingAudit({
      action: "payment_arrangement_set",
      actorId: staff.id,
      actorRole: role,
      patientId,
      detail: { before, after: arrangement, repricedClaims: repriced, actorName: staff.name },
    });
    return { ok: true, repriced };
  },

  /**
   * §Phase 7d — record a patient payment received outside the app (no card
   * processing). Billing write only, attributed, audited. Overpayment and
   * anything resembling a card number are refused.
   */
  recordPatientPayment(input: {
    claimId: string;
    amountCents: number;
    receivedOn: string;
    method: PaymentMethod;
    reference?: string;
  }): { ok: true; payment: PatientPayment; claim: Claim } | { ok: false; error: string } {
    const role = getActingRole();
    if (canAccess(role, "billing").level !== "write") return { ok: false, error: BILLING_WRITE_REFUSED };
    const c = claims.find((x) => x.id === input.claimId);
    if (!c) return { ok: false, error: "Claim not found." };
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0)
      return { ok: false, error: "Amount must be a positive whole number of cents." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.receivedOn)) return { ok: false, error: "Date received must be YYYY-MM-DD." };
    if (!(input.method in PAYMENT_METHOD_LABEL)) return { ok: false, error: "Choose a payment method." };
    const ref = input.reference?.trim() || undefined;
    if (ref && /\d{13,19}/.test(ref.replace(/[\s-]/g, "")))
      return { ok: false, error: "That looks like a card number. Record a receipt or check number only — never card numbers." };
    applyResponsibility(c);
    if ((c.patientBalanceCents ?? 0) <= 0) return { ok: false, error: "The patient owes nothing on this claim." };
    if (input.amountCents > (c.patientBalanceCents ?? 0)) return { ok: false, error: PAYMENT_EXCEEDS_BALANCE };
    const staff = getActingStaff();
    const payment: PatientPayment = {
      id: `pay_${Math.random().toString(36).slice(2, 10)}`,
      amountCents: input.amountCents,
      receivedOn: input.receivedOn,
      method: input.method,
      ...(ref ? { reference: ref } : {}),
      recordedById: staff.id,
      recordedByName: staff.name,
      recordedByRole: role,
      recordedAt: iso(),
    };
    c.patientPayments = [...(c.patientPayments ?? []), payment];
    applyResponsibility(c);
    c.updatedAt = payment.recordedAt;
    AdelanteEHR.recordBillingAudit({
      action: "patient_payment_recorded",
      actorId: staff.id,
      actorRole: role,
      patientId: c.patientId,
      detail: { claimId: c.id, paymentId: payment.id, amountCents: payment.amountCents, receivedOn: payment.receivedOn, method: payment.method, reference: ref ?? null, balanceAfterCents: c.patientBalanceCents ?? 0, actorName: staff.name },
    });
    ehrBus.publish({ type: "claim.updated", claimId: c.id, state: c.state });
    return { ok: true, payment: { ...payment }, claim: { ...c } };
  },

  /** §Phase 7d — void a mistaken payment (never deleted). Billing write, reason required, audited. */
  voidPatientPayment(claimId: string, paymentId: string, reason: string): { ok: true } | { ok: false; error: string } {
    const role = getActingRole();
    if (canAccess(role, "billing").level !== "write") return { ok: false, error: BILLING_WRITE_REFUSED };
    const c = claims.find((x) => x.id === claimId);
    const p = c?.patientPayments?.find((x) => x.id === paymentId);
    if (!c || !p) return { ok: false, error: "Payment not found." };
    if (p.voidedAt) return { ok: false, error: "This payment is already void." };
    if (!reason.trim()) return { ok: false, error: "A reason is required to void a payment." };
    const staff = getActingStaff();
    p.voidedAt = iso();
    p.voidedById = staff.id;
    p.voidedByName = staff.name;
    p.voidReason = reason.trim();
    applyResponsibility(c);
    c.updatedAt = p.voidedAt;
    AdelanteEHR.recordBillingAudit({
      action: "patient_payment_voided",
      actorId: staff.id,
      actorRole: role,
      patientId: c.patientId,
      detail: { claimId: c.id, paymentId, amountCents: p.amountCents, reason: p.voidReason, balanceAfterCents: c.patientBalanceCents ?? 0, actorName: staff.name },
    });
    ehrBus.publish({ type: "claim.updated", claimId: c.id, state: c.state });
    return { ok: true };
  },

  /** Latest service date priced from a rate (end-dating can't cut it off). */
  latestPricedServiceDate(rateId: string): string | undefined {
    return claims
      .filter((c) => c.rateId === rateId && c.serviceDate)
      .map((c) => c.serviceDate!)
      .sort()
      .pop();
  },

  /**
   * §Group sessions — per-attendee billing hook.
   *
   * The Claims Worklist already reads from THIS list, keyed by `encounterId`,
   * so a group attendee claim reuses that exact pipeline instead of adding a
   * second data source. The encounter id is the group occurrence + patient,
   * which is precisely the DMC-ODS billable unit: one individualized note per
   * attendee, never a blanket group charge.
   *
   * PLACEHOLDER: `chargeCents` falls back to the existing per-service charge.
   * No group CPT/H-code or group rate is invented here — billing supplies it.
   */
  upsertClaimFromGroupAttendee(input: {
    sessionId: string;
    occurrenceStart: string;
    patientId: string;
    facilitatorId: string;
    /**
     * §Designated rendering provider. DHCS duplicate detection is member CIN +
     * rendering provider NPI + procedure code + date, so exactly ONE provider
     * goes on the claim. Falls back to the occurrence's designated provider,
     * then to the passed facilitator.
     *
     * OPEN — COUNTY CONFIRMATION REQUIRED: co-facilitator time is captured in
     * documentation only and is NOT separately claimed. DHCS is silent on
     * whether a second facilitator's time is ever separately claimable; this
     * is the conservative resolution, not a settled answer.
     */
    renderingProviderId?: string;
    noteId: string;
  }): Claim | null {
    // HARD SPLIT 1 (category): `open_psychoeducational` occurrences never
    // create a claim. Enforced here, at the single write point, so no caller
    // can bypass it by forgetting to filter. Their attendance is
    // engagement/utilization data only (see `openGroupEngagement`).
    const session = AdelanteEHR.getGroupSession(input.sessionId);
    if (session && !isBillableGroupCategory(session.category)) return null;
    // HARD SPLIT 2 (occurrence): fewer than 2 present attendees means the
    // meeting functioned as an individual session per DHCS — no group claim,
    // even for a billable category. The occurrence itself is untouched.
    if (session) {
      const present = (
        AdelanteEHR.getGroupOccurrence(input.sessionId, input.occurrenceStart)?.attendance ?? []
      ).filter((a) => a.status !== "absent");
      if (present.length < GROUP_MIN_BILLABLE_ATTENDEES) return null;
    }
    const encounterId = `group:${input.sessionId}:${input.occurrenceStart}:${input.patientId}`;
    // NOTE (DHCS Short-Doyle): more than one group service for the same
    // beneficiary, same provider, same DAY is explicitly allowed. The
    // encounter id is occurrence-specific (it carries the full ISO start, not
    // the date), so two distinct same-day occurrences mint two distinct
    // claims. Covered by a regression test.
    let claim = claims.find((c) => c.encounterId === encounterId);
    if (claim) return claim;
    const renderingProviderId =
      input.renderingProviderId ??
      AdelanteEHR.groupRenderingProviderId?.(input.sessionId, input.occurrenceStart) ??
      input.facilitatorId;
    claim = {
      id: uid(),
      encounterId,
      patientId: input.patientId,
      clinicianId: renderingProviderId || input.facilitatorId,
      state: "documented",
      updatedAt: iso(),
      history: [{ at: iso(), state: "documented", actor: "system", note: `note:${input.noteId}` }],
    };
    {
      const serviceDate = input.occurrenceStart.slice(0, 10);
      const line: ServiceLine = session?.category === "sud_clinical_preauth" ? "sud" : "mh";
      const hookCode = session ? groupBillingCode(session.category) : undefined;
      const code = hookCode ?? defaultCodeFor("therapy_group", line);
      const note = (AdelanteEHR.getPatient(input.patientId)?.progressNotes ?? []).find((n) => n.id === input.noteId);
      const fac = note?.groupRef?.facilitators?.find((f) => f.staffId === claim!.clinicianId) ?? note?.groupRef?.facilitators?.[0];
      claim.serviceDate = serviceDate;
      claim.serviceCode = code;
      claim.codeSource = hookCode ? "hook" : "default";
      assignProgram(claim, { code, line });
      if (fac && fac.minutes > 0) {
        claim.minutes = fac.minutes;
        claim.unitsSource = "note";
      } else {
        const occ = AdelanteEHR.getGroupOccurrence(input.sessionId, input.occurrenceStart) as { durationMin?: number } | undefined;
        const sess = session as { durationMin?: number } | undefined;
        claim.minutes = occ?.durationMin ?? sess?.durationMin ?? 60;
        claim.unitsSource = "schedule";
      }
      applyPricing(claim);
    }
    claims.push(claim);
    ehrBus.publish({ type: "claim.updated", claimId: claim.id, state: claim.state });
    return claim;
  },

  /**
   * §Phase 3 — Peer Specialist billing hook.
   *
   * Same shape and same `claims` list as `upsertClaimFromGroupAttendee`: the
   * Claims Worklist picks it up with no changes. Policy (code selection, unit
   * math) lives in communityBilling.ts; this is only the write.
   */
  upsertClaimFromPeerNote(input: {
    patientId: string;
    peerNoteId: string;
    staffId: string;
    clinicianId: string;
    minutes: number;
    mode?: string;
  }): Claim | null {
    const decision = peerBillingDecision({
      staffId: input.staffId,
      mode: input.mode,
      minutes: input.minutes,
    });
    if (!decision.allowed) {
      AdelanteEHR.recordCommunityBillingBlocked({
        patientId: input.patientId,
        actorId: input.staffId,
        actorRole: "peer_specialist",
        service: "peer_support",
        reasonCode: decision.reasonCode ?? "blocked",
        reason: decision.reason ?? "Peer support claim blocked.",
        detail: { peerNoteId: input.peerNoteId },
      });
      return null;
    }
    const encounterId = `peer:${input.peerNoteId}`;
    const existing = claims.find((c) => c.encounterId === encounterId);
    if (existing) return existing;
    const claim: Claim = {
      id: uid(),
      encounterId,
      patientId: input.patientId,
      clinicianId: input.clinicianId,
      state: "documented",
      serviceCode: decision.serviceCode,
      codeSource: "hook",
      units: decision.units,
      unitsSource: "note",
      serviceDate: iso().slice(0, 10),
      programSource: "coverage",
      taxonomy: decision.taxonomy,
      updatedAt: iso(),
      history: [
        { at: iso(), state: "documented", actor: "system", note: `peer_note:${input.peerNoteId}` },
      ],
    };
    assignProgram(claim, { code: claim.serviceCode ?? "", line: "mh" });
    applyPricing(claim);
    claims.push(claim);
    ehrBus.publish({ type: "claim.updated", claimId: claim.id, state: claim.state });
    return claim;
  },

  /**
   * §Phase 3 — Community Health Worker billing hook.
   *
   * Blocks (with an audit row) when the member is ECM-enrolled that day, when
   * the CHW has no enrolled supervising provider, or when the 2 hr/day unit
   * cap is exhausted. Same single-write-point discipline as the open-group
   * billing split: no caller can bypass the rule by forgetting to check.
   */
  upsertClaimFromChwNote(input: {
    patientId: string;
    noteId: string;
    staffId: string;
    clinicianId: string;
    dateISO: string;
    minutes: number;
    /** Provider picked in the note UI; `null` means "asked, none picked". */
    supervisingStaffId?: string | null;
  }): Claim | null {
    const patient = AdelanteEHR.getPatient(input.patientId);
    if (!patient) return null;
    const dayKey = input.dateISO.slice(0, 10);
    const monthKey = input.dateISO.slice(0, 7);
    const chwClaims = claims.filter(
      (c) => c.patientId === input.patientId && c.encounterId.startsWith("chw:"),
    );
    const unitsAlreadyBilledToday = chwClaims
      .filter((c) => c.encounterId.includes(`:${dayKey}`))
      .reduce((n, c) => n + (c.units ?? 0), 0);
    const hasPriorClaimThisMonth = chwClaims.some((c) => c.encounterId.includes(`:${monthKey}`));

    const decision = chwBillingDecision({
      patient,
      staffId: input.staffId,
      dateISO: input.dateISO,
      minutes: input.minutes,
      unitsAlreadyBilledToday,
      hasPriorClaimThisMonth,
      supervisingStaffId: input.supervisingStaffId,
    });
    if (!decision.allowed) {
      AdelanteEHR.recordCommunityBillingBlocked({
        patientId: input.patientId,
        actorId: input.staffId,
        actorRole: "community_health_worker",
        service: "chw_services",
        reasonCode: decision.reasonCode ?? "blocked",
        reason: decision.reason ?? "CHW claim blocked.",
        detail: { noteId: input.noteId, dateISO: input.dateISO },
      });
      return null;
    }
    const encounterId = `chw:${dayKey}:${input.noteId}`;
    const existing = claims.find((c) => c.encounterId === encounterId);
    if (existing) return existing;
    const claim: Claim = {
      id: uid(),
      encounterId,
      patientId: input.patientId,
      clinicianId: input.clinicianId,
      state: "documented",
      serviceCode: decision.serviceCode,
      codeSource: "hook",
      units: decision.units,
      unitsSource: "note",
      serviceDate: (input.dateISO ?? iso()).slice(0, 10),
      programSource: "coverage",
      supervisingStaffId: decision.supervisingStaffId,
      updatedAt: iso(),
      history: [
        { at: iso(), state: "documented", actor: "system", note: `chw_note:${input.noteId}` },
      ],
    };
    assignProgram(claim, { code: claim.serviceCode ?? "", line: "mh" });
    applyPricing(claim);
    claims.push(claim);
    ehrBus.publish({ type: "claim.updated", claimId: claim.id, state: claim.state });
    return claim;
  },

  subscribe,
};

// §Phase 7b — every attended visit has a claim; claims are the only billing
// status. Demo spread (was on the visits themselves): a2 submitted, a5 paid,
// any other attended visit stays documented/unsigned so the notes
// queue still has work. Seed moves are written directly and marked "seed".
(() => {
  const appts = AdelanteEHR.listAppointments?.() ?? [];
  const path: Record<string, ClaimState[]> = {
    a2: ["signed", "coded", "generated", "submitted"],
    a5: ["signed", "coded", "generated", "submitted", "paid"],
  };
  appts
    .filter((a) => a.status === "attended")
    .forEach((a) => {
      const claim = AdelanteEHRExt.upsertClaimFromEncounter(a.id);
      const steps = path[a.id];
      if (!steps) return;
      seedClaimSteps(claim, a.clinicianId, steps, "demo spread");
      if (claim.state === "denied") claim.denialReason = "Auth required";
    });
  // §Phase 7c — a newly added rate prices claims waiting on it (not yet Ready).
  onRateAdded((r) => {
    for (const c of claims) {
      if (c.rateStatus !== "no_rate" || c.serviceCode !== r.code || c.program !== r.program) continue;
      if (!["documented", "signed", "coded", "generated", "written_off"].includes(c.state)) continue;
      applyPricing(c);
      if ((c.rateStatus as string) === "priced") {
        AdelanteEHR.recordBillingAudit({
          action: "claim_priced_from_new_rate",
          actorId: r.createdBy,
          actorRole: r.createdByRole,
          patientId: c.patientId,
          detail: { claimId: c.id, rateId: r.id, units: c.units ?? 1, chargeCents: c.chargeCents ?? 0 },
        });
        ehrBus.publish({ type: "claim.updated", claimId: c.id, state: c.state });
      }
    }
  });
  registerClaimBridge({
    onAttended: (apptId) => {
      AdelanteEHRExt.upsertClaimFromEncounter(apptId);
    },
    onNoteFinal: (patientId, noteId) => {
      const { n } = AdelanteEHR._findNote(patientId, noteId);
      if (!n) return;
      AdelanteEHRExt.markClaimSignedFromNote({
        patientId,
        noteId,
        attestation: noteStatus(n) === "cosigned" ? n.cosignAttestation : n.attestation,
      });
    },
    bucketFor: (apptId) => {
      const c = claims.find((x) => x.encounterId === apptId);
      return c ? claimBillingBucket(c.state) : undefined;
    },
    chargeFor: (apptId) => claims.find((x) => x.encounterId === apptId)?.chargeCents,
    bucketCounts: () => claimBucketCounts(claims),
  });

  // §Phase 7d — any claim still on the retired single non-Medi-Cal program is
  // re-run through the new rule (safety net; no seeded claim uses it today).
  for (const c of claims) {
    if ((c.program as string) !== "non_medi_cal") continue;
    const appt = AdelanteEHR.listAppointments().find((a) => a.id === c.encounterId);
    const before = c.program as string;
    assignProgram(c, { code: c.serviceCode ?? "", line: "mh", fundingLane: appt?.fundingLane });
    (c as { programSource?: string }).programSource = "migrated";
    applyPricing(c);
    AdelanteEHR.recordBillingAudit({
      action: "claim_program_migrated",
      actorId: "system",
      actorRole: "system",
      patientId: c.patientId,
      detail: { claimId: c.id, before, after: c.program ?? null, arrangementMissing: Boolean(c.arrangementMissing) },
    });
  }

  // §Demo — two attended visits still waiting for a note, booked and marked
  // attended through the real store API (claims open at `documented`):
  //  - Kayla Nguyen (trainee, c4) with Rosa T. (p2): note → sign → cosign → billing
  //  - Dr. Marisol Reyes (c1) with Alicia (p4): note → self-sign → billing
  const demo: { patientId: string; clinicianId: string; hoursAgo: number }[] = [
    { patientId: "p2", clinicianId: "c4", hoursAgo: 26 },
    { patientId: "p4", clinicianId: "c1", hoursAgo: 28 },
  ];
  for (const d of demo) {
    try {
      const start = new Date(Date.now() - d.hoursAgo * 3600_000);
      start.setMinutes(0, 0, 0);
      const a = AdelanteEHR.bookAppointment({
        patientId: d.patientId,
        clinicianId: d.clinicianId,
        start: start.toISOString(),
        durationMin: 50,
        serviceType: "therapy_individual",
        modality: "in_person",
        locationId: "loc-visalia",
        allowPatientOverlap: true,
      });
      AdelanteEHR.updateAppointmentStatus(a.id, "attended");
    } catch {
      /* demo seed only */
    }
  }
})();

/** Counts claims under the familiar billing labels. Shared by every summary. */
export function claimBucketCounts(list: Claim[]): Record<BillingBucket, number> {
  const out: Record<BillingBucket, number> = {
    draft: 0,
    ready: 0,
    submitted: 0,
    paid: 0,
    denied: 0,
    write_off: 0,
    partial: 0,
  };
  for (const c of list) out[claimBillingBucket(c.state)] += 1;
  return out;
}

// §EHR audit Phase 2a — reconcile the seeded licence documents with the
// booking hard-stop field on startup, so the two dates agree from the first
// render rather than only after someone uploads.
["c1", "c2", "c3"].forEach((id) => AdelanteEHRExt.syncLicenseExpiry(id));

// ---------- React hook ----------
export function useEhrExt<T>(selector: () => T): T {
  // Subscribe to a stable version number so selectors that return fresh
  // arrays/objects don't trigger an infinite re-render loop.
  useSyncExternalStore(
    (cb) => subscribe(cb),
    () => version,
    () => version,
  );
  return selector();
}