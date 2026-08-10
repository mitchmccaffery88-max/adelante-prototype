// AdelanteEHR — single seam for all clinical-backend reads/writes.
import {
  crisisTriggeringScores,
  describeCrisisScore,
  plannedAutomations,
  schemaContentEquals,
  summarizeAutomation,
} from "./templateSchema";
import type {
  Automation,
  AutofillSnapshot,
  TemplateAnswers,
  TemplateSchema,
} from "./templateSchema";
// Type-only (erased at build) — roles.ts imports ehr.ts at runtime, so a value
// import here would create a cycle.
import type { StaffRole } from "./roles";
// Value import of the shared consent gate. Only ever called inside methods,
// so the roles<->ehr module cycle resolves before any call happens.
import { canAccess, STAFF_ROLES } from "./roles";
// §v3.0 Phase 4 — advocate access policy. Pure module, imports nothing back
// from here, so there is no cycle.
import {
  advocateAccessDecision,
  type AdvocateAccessDecision,
  type AdvocateAuthorizationType,
  type AdvocatePermission,
  advocatePart2Masked,
  ADVOCATE_SUD_DISCLOSURE_CATEGORY,
  advocateTier,
} from "./advocate";
// §v3.0 Phase 5 — patient documents. Pure policy module (scan gate, queue
// ownership, Part 2 restriction messaging); imports nothing back from here.
import {
  scanUpload,
  verifyQueueOwnerRole,
  advocateDocumentVisibility,
  type UploadCandidate,
  type DocumentUploaderKind,
  type DocumentVerificationStatus,
} from "./documents";

// ---------------------------------------------------------------------------
// §Notification feed, Phase 1 — operational, staff-to-staff, system-generated.
// Patient<->clinician messaging is explicitly out of scope (Phase 2).
// In-app only: there is no email/SMS/push transport anywhere in this build.
// ---------------------------------------------------------------------------
export type NotificationCategory =
  | "cosign_request"
  | "crisis_flagged"
  | "mar_witness_needed"
  | "task_assigned"
  // §Inbox — a provider request the recipient finished, reported back to
  // whoever asked for it.
  | "provider_request_completed"
  // §Notification feed Phase 2 — patient<->clinician messaging.
  | "patient_message";

export interface AppNotification {
  id: string;
  /** Specific staff identity (STAFF_ROSTER id or staff name). */
  recipientStaffId?: string;
  /** OR broadcast to everyone holding this role. Exactly one of the two is set. */
  recipientRole?: StaffRole;
  category: NotificationCategory;
  subject: string;
  body: string;
  linkRoute?: string;
  linkParams?: Record<string, string>;
  /** Context/traceability only — never used for access control. */
  patientId?: string;
  createdAt: string;
  readAt?: string;
}

// §Messaging Phase 2 — patient<->clinician care-team thread.
// One ongoing thread per patient ("message your care team" is the UI's own
// framing), so the thread key IS the patient id. In-app only: there is no
// email/SMS/push transport anywhere in this build.
//
// KNOWN GAP: message bodies are free text and are NOT screened, classified,
// or masked for 42 CFR Part 2 / SUD content. Reliable automatic PHI-content
// classification does not exist here and faking it would be unsafe, so a
// patient can disclose Part 2 content in a message and it will be shown to
// anyone with messaging access. Same standing-gap treatment as vitals/labs.

// Labs/imaging results and vitals do not exist in this build. The target
// schema for the dev team lives in `src/lib/labsVitalsScaffold.ts`
// (NOT IMPLEMENTED — zero runtime consumers).

// §Inbox — Provider Request queue. A cross-patient, lightweight ask between
// staff ("can you clarify this?", "please enter this order"). Deliberately
// NOT a CaseTask: tasks are patient-plan work assigned TO a named person,
// requests are unassigned until someone claims them.
export interface ProviderRequest {
  id: string;
  patientId: string;
  requestType: "question" | "order_entry";
  /** Free text — the actual ask. */
  context: string;
  requestedBy: string;
  requestedByRole: StaffRole;
  /** Claimed by (staff identity token). */
  assignedTo?: string;
  status: "open" | "claimed" | "done";
  createdAt: string;
  claimedAt?: string;
  claimedBy?: string;
  /** Completion note. */
  outcome?: string;
  completedAt?: string;
  completedBy?: string;
}
export interface CareMessage {
  id: string;
  /** The thread. One thread per patient. */
  threadPatientId: string;
  authorType: "patient" | "staff";
  /** Patient's own name, or the staff display name. Never altered. */
  authorName: string;
  /** Verbatim as authored. Patient messages are NEVER translated or edited. */
  body: string;
  createdAt: string;
  readByPatientAt?: string;
  readByStaffAt?: string;
  /**
   * §Part 2 gate — set by a HUMAN reviewer who read the message and judged it
   * to contain SUD/42 CFR Part 2 content. There is no automatic detection.
   * When true, staff viewers who fail `canAccess(role, "screeners_sud",
   * patient)` see a masked placeholder instead of the body. The patient always
   * sees their own thread in full.
   */
  sudFlagged?: boolean;
  sudFlaggedBy?: string;
  sudFlaggedAt?: string;
  /**
   * True when the PATIENT asked for careful handling at compose time, rather
   * than a staff reviewer flagging after reading. Masking behavior is
   * identical either way — this only records provenance.
   */
  sudFlaggedByPatient?: boolean;
}

// Adelante is the EHR of record. Do NOT import vendor SDKs outside
// `src/lib/vendors/*`; route vendor traffic through the helpers below
// (telehealth room, eRx medications) so adapters stay swappable.
// Today this is an in-memory mock; swap the in-memory store for a real
// backend when wiring the native Adelante EHR persistence layer.

export type ReferralStatus = "submitted" | "contacted" | "enrolled";
export type SessionStatus = "scheduled" | "attended" | "no_show" | "cancelled";
export type BillingStatus = "draft" | "ready" | "submitted" | "paid" | "denied" | "write_off";
export type CoverageStatus =
  | "active"
  | "suspended"
  | "none_unsure"
  | "other"
  | "private_pay"
  | "uninsured";
export type ReferralSource =
  | "probation"
  | "parole"
  | "drug_court"
  | "correctional"
  | "self"
  | "other";

// Funding lane classifies a billable event independently of its billingStatus.
// A clinical event is authored first, then classified into a lane.
export type FundingLane =
  | "medi_cal_ffs"
  | "dmc_ods"
  | "ecm"
  | "private_pay"
  | "isl_non_medi_cal"
  | "bhsa"
  | "non_billable";

export type EpisodeType = "mental_health" | "sud_dmc_ods" | "ecm" | "ji_pre_release" | "bhsa";

export interface Episode {
  id: string;
  type: EpisodeType;
  state: string;
  openedAt: string;
  closedAt?: string;
}

export type ReleaseSource = "court" | "custody" | "self_report" | "confirmed";
export type ReleaseConfidence = "confirmed" | "estimated" | "self_reported";
export interface ReleaseDateMeta {
  source: ReleaseSource;
  confidence: ReleaseConfidence;
  history: { date: string; changedAt: string; source: ReleaseSource }[];
}

export type SdohStatus =
  | "identified"
  | "sent"
  | "accepted"
  | "scheduled"
  | "completed"
  | "not_completed";
export interface SdohPlanItem {
  id: string;
  need: string;
  referralId?: string;
  status: SdohStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
  visibleToPatient?: boolean;
}

export interface SelfHelpModule {
  key: string;
  title: string;
  cadence: string;
  assignedBy: string;
  completedAt?: string;
}

export interface CoverageSnapshot {
  asOf: string;
  status: CoverageStatus;
  countyOfResponsibility: string;
}

export type ContactChannel = "text" | "call" | "video";
export type BestTime = "morning" | "afternoon" | "evening";
export type PreferredLanguage = "en" | "es";

export interface ContactPrefs {
  channel: ContactChannel;
  bestTime: BestTime;
}
export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface Referral {
  id: string;
  firstName: string;
  lastName: string;
  dob?: string;
  phone?: string;
  email?: string;
  releaseDate?: string;
  /** CIN / Medi-Cal ID (9 characters). Optional — helps de-duplicate similar names. */
  cin?: string;
  referringAgency: string;
  referrerName: string;
  referrerEmail?: string;
  referrerPhone?: string;
  referralSource: ReferralSource;
  countyOfRelease?: string;
  consentToContact: boolean;
  status: ReferralStatus;
  createdAt: string;
  smsSentAt?: string;
  outreachTask?: "manual_call";
  // Set when advanceReferral → "enrolled" materializes a Patient row.
  enrolledPatientId?: string;
}

/**
 * Medication order (§Orders — port of BaggaEMR `OrderCart`).
 *
 * DEV HANDOFF: this pass covers the *core* only — data model, the pre-sign
 * validation gate, non-prescriber attribution, and attestation. Deliberately
 * NOT modeled yet (deferred pass): sig/dose/route/frequency catalogs,
 * dispense-quantity auto-calc, pharmacy routing/transmission, duplicate
 * therapy checking, DEA schedule (only the coarse `isControlled` flag exists).
 * When those land, extend this interface additively — do not reshape it.
 */
export interface MedOrder {
  id: string;
  patientId: string;
  drugName: string;
  dose?: string;
  route?: string;
  frequency?: string;
  // ----- Catalog product (Phase 1: RxNav-backed) -----------------------------
  /** RxNorm concept id when the product was picked from the catalog. */
  rxcui?: string;
  /** Full catalog product name as returned by RxNav. */
  productName?: string;
  /** RxNav strength string, e.g. "50 MG" or "2 MG / 0.5 MG" or "20 MG/ML". */
  strengthText?: string;
  /** RxNav dose form, e.g. "Oral Tablet". Drives splitting rules. */
  doseForm?: string;
  /** Positional ingredient names for combo products. */
  ingredientNames?: string[];
  /**
   * Where `strengthText` came from. "dailymed" means RxNav had no parseable
   * quantitative strength and the DailyMed SPL fallback resolved it.
   */
  strengthSource?: "rxnav" | "dailymed";
  /** True when the clinician typed a product NOT found in the catalog. */
  offCatalog?: boolean;
  /** REQUIRED whenever offCatalog is true — governance control, do not weaken. */
  offCatalogJustification?: string;
  // ----- Reconciled dose (see src/lib/doseReconcile.ts) ----------------------
  /** Which axis the clinician dosed on. */
  doseAxis?: "mg" | "units" | "ingredient" | "drugUnits" | "topical" | "manual";
  /** Index into ingredientNames when doseAxis === "ingredient". */
  doseIngredientIndex?: number;
  /** Intended mg per administration (mg / ingredient axes). */
  doseTargetMg?: number;
  /**
   * Intended DRUG UNITS per administration for unit-dosed products (insulin,
   * heparin). Distinct from `unitsPerAdmin`, which counts dosage units.
   */
  doseTargetUnits?: number;
  /** Topical/external forms: "thin layer to affected area". Feeds the Sig directly. */
  applicationInstruction?: string;
  /**
   * Manual dose text, available ONLY when reconciliation is genuinely
   * exhausted (not unit-dosed, not topical, and DailyMed also came back empty).
   */
  manualDose?: string;
  /** REQUIRED whenever manualDose is set — same governance as off-catalog. */
  manualDoseJustification?: string;
  /** Units per administration (units axis, or reconciled from mg). */
  unitsPerAdmin?: number;
  /** Generated Sig line (src/lib/sigLine.ts). */
  sig?: string;
  /**
   * Clinician-edited Sig. When set it supersedes `sig` for display/print,
   * while `sig` keeps the auto-generated text so the two stay comparable.
   */
  sigOverride?: string;
  /** True when the Sig on this order was hand-edited rather than derived. */
  sigManualOverride?: boolean;
  /** Frequency catalog code, e.g. "BID". Source of truth for scheduling. */
  frequencyCode?: string;
  durationValue?: number;
  durationUnit?: "days" | "doses";
  quantity?: number;
  daysSupply?: number;
  /** Set once the clinician edits quantity by hand — suppresses auto-calc. */
  quantityManual?: boolean;
  /** Set once the clinician edits days supply by hand — suppresses auto-calc. */
  daysSupplyManual?: boolean;
  /** DEA-schedule-adjacent flag. Drives the days-supply requirement and, later, cosigner scoping. */
  isControlled?: boolean;
  /**
   * §MAR Phase 2 — DEA schedule, set by hand whenever `isControlled` is checked
   * (RxNav does not reliably expose it). Witness at administration is required
   * for CII only; CIII–CV are covered by the attestation paths instead. When
   * `isControlled` is true and this is unset we conservatively require a
   * witness anyway.
   */
  deaSchedule?: "CII" | "CIII" | "CIV" | "CV";
  /** STAT orders skip the duration requirement (single immediate administration). */
  isStat?: boolean;
  /**
   * Facility-local calendar date (YYYY-MM-DD) therapy actually begins — a
   * FIRST-CLASS field, not inferred. Defaults to today when the draft is
   * created and again at sign time if still unset, but the prescriber may edit
   * it: an order signed today can start tomorrow, and an order can be backdated
   * to reflect therapy already underway. MAR schedule projection derives
   * due/not-due from this date, so interval cadences (e.g. weekly) land on the
   * right days.
   */
  startDate?: string;
  /**
   * KOP (Keep-On-Person): prescriber approves the patient to keep this
   * medication on their person and self-administer. Read by the future MAR
   * pass to pick the administration workflow.
   */
  isKop?: boolean;
  /**
   * Dispense routing decision. "pharmacy" flags the order for dispense;
   * "chart_only" records it without routing. Flag only — no transmission.
   */
  dispenseRoute?: "pharmacy" | "chart_only";
  /** References `Problem.id` when the indication is a coded diagnosis on file. */
  indicationProblemId?: string;
  /** Free-text indication; fallback when no coded problem is linked. */
  indicationText?: string;
  /**
   * §Phase 3b — the progress note whose orders_section staged this order.
   * Traceability only: an order started from a note follows the exact same
   * lifecycle, validation and attestation as one staged from the Orders tab.
   */
  sourceNoteId?: string;
  // ----- Attribution (required only for non-prescribers ordering on a prescriber's behalf) -----
  orderingProviderId?: string;
  orderSource?: "verbal" | "telephone" | "protocol" | "standing";
  readBackConfirmed?: boolean;
  // ----- Attestation -----
  /** staffName from useActingStaff() at sign time. */
  attestedBy?: string;
  attestedAt?: string;
  /**
   * Lifecycle. "signed" is the active state; "held" is a reversible pause;
   * "discontinued" and "completed" are TERMINAL — restarting therapy means
   * placing a new order, never reviving one of these.
   */
  status: "draft" | "signed" | "held" | "discontinued" | "completed";
  /** Reason for the latest lifecycle transition. Required for hold/discontinue. */
  statusReason?: string;
  /** staffName of whoever made the latest lifecycle transition. */
  statusChangedBy?: string;
  statusChangedAt?: string;
  createdBy?: string;
  createdAt?: string;
}

/**
 * §MAR Phase 1 — a charted administration of one scheduled dose.
 *
 * DEV HANDOFF: Phase 1 covers SCHEDULED, non-PRN, non-KOP, non-controlled
 * doses only. Deferred (coming, not dropped): PRN eligibility + reason chips,
 * controlled-substance witness, KOP issuance, Suboxone mouth-check
 * attestation, cart/keyboard mode, voice pass, and the Refusal legal document.
 * Entries are NEVER deleted — voiding sets `voided` with a reason, matching the
 * reference EMR's retention rationale (HIPAA / 42 CFR Part 2).
 */
export interface DoseAdministration {
  id: string;
  patientId: string;
  /** References `MedOrder.id`. */
  orderId: string;
  /** ISO instant the dose was due (from the derived MAR grid). */
  scheduledAt: string;
  action: "given" | "refused" | "held";
  /** Required for refused/held. Free text in Phase 1; chips come in Phase 2. */
  reason?: string;
  chartedBy: string;
  chartedAt: string;
  /** Required when chartedAt is more than 4h after scheduledAt. */
  lateEntryReason?: string;
  /**
   * §MAR Phase 2 — second clinician who witnessed a Schedule II administration.
   * Required before a CII dose can be charted as given.
   */
  witnessedBy?: string;
  /** True when this row is a PRN administration (reason carries the indication). */
  isPrn?: boolean;
  /** True when the batch carried the Suboxone/buprenorphine mouth-check attestation. */
  mouthCheckAttested?: boolean;
  /** Groups everything committed in one attested pass, so it can be voided together. */
  batchId: string;
  voided?: boolean;
  voidReason?: string;
  voidedBy?: string;
  voidedAt?: string;
}

/**
 * Soft lock on an un-charted dose so two nurses don't chart the same slot.
 * Single-session demos can't exercise real concurrency, but the state machine
 * (claim / release / takeover-with-reason) is built faithfully so it is
 * structurally correct once multi-user sessions exist.
 */
export interface DoseClaim {
  orderId: string;
  scheduledAt: string;
  claimedBy: string;
  claimedAt: string;
}

/**
 * §MAR Phase 2 — KOP (Keep-On-Person) supply issuance. This is a SUPPLY event,
 * not a bedside administration: no dose claim, no MAR slot. The patient's
 * signature is a TYPED acknowledgment, deliberately weaker than the Refusal
 * document's drawn legal signature.
 */
export interface KopIssuance {
  id: string;
  patientId: string;
  orderId: string;
  daysSupply: number;
  quantity: number;
  patientSignatureName: string;
  issuedBy: string;
  issuedAt: string;
  notes?: string;
  returnedAt?: string;
  returnedBy?: string;
}

/**
 * §MAR Phase 3 — the Refusal legal document.
 *
 * A refused dose is charted as a DoseAdministration the moment the batch is
 * committed; this form is a SEPARATE follow-on legal artifact. Abandoning the
 * form never un-charts the refusal — it just leaves the document in
 * `pending_signature` on the to-do surface.
 *
 * Signatures here are DRAWN (canvas data URLs) with anti-tap-fraud validation,
 * deliberately higher-rigor than KOP's typed acknowledgment. The nurse's
 * IDENTITY attestation remains checkbox-only — TODO(auth), same as Orders/MAR.
 */
export interface RefusalForm {
  id: string;
  patientId: string;
  /** References the `DoseAdministration` this refusal documents. */
  administrationId: string;
  status: "pending_signature" | "finalized";
  medClass: "psychiatric" | "controlled" | "anticoagulant" | "antibiotic" | "*";
  riskTextVersion: string;
  /** Frozen copy of the risk text the patient was actually read. */
  riskTextSnapshot: string;
  /**
   * English wording for the same class, retained whenever the snapshot above is
   * a translation, so the clinically reviewed text stays part of the record.
   */
  riskTextSnapshotEn?: string;
  /**
   * False when the snapshot is a translation still awaiting clinical sign-off.
   * Undefined on forms created before translations existed (treat as reviewed).
   */
  riskTextReviewed?: boolean;
  /**
   * True once the presented wording is clinically approved: the English
   * snapshot is then a LOCKED archival reference on the record, not a live
   * fallback the dialog presents as the authoritative text.
   */
  riskTextSnapshotEnLocked?: boolean;
  languageCode: string;
  /** Active alert labels matching the capacity heuristic at signing time. */
  capacityFlagsAtSigning: string[];
  /** True when the patient is a minor per DOB. */
  guardianRequired: boolean;
  nurseAttested: boolean;
  nurseSignatureDataUrl?: string;
  nurseNote?: string;
  patientSigned: boolean;
  patientSignatureDataUrl?: string;
  patientDeclineReason?: string;
  patientDeclineNotes?: string;
  witnessRequired: boolean;
  witnessStaffName?: string;
  witnessSignatureDataUrl?: string;
  interpreterUsed?: boolean;
  interpreterMethod?: string;
  interpreterName?: string;
  interpreterAbsentJustification?: string;
  finalizedBy?: string;
  finalizedAt?: string;
  attestationMethod: "checkbox_only";
  createdAt: string;
  createdBy: string;
}

/** Hours after which charting a dose counts as a late entry. */
export const LATE_ENTRY_THRESHOLD_HOURS = 4;

/**
 * §Custody tracking — a jail/facility booking episode.
 *
 * `facilityId` references a first-class `Facility`; `facilityName` is a
 * DENORMALIZED DISPLAY SNAPSHOT frozen at write time. Reporting must always
 * group on `facilityId` — the snapshot exists so a historical row keeps the
 * name it was recorded under even after the facility is renamed, exactly the
 * way risk-text snapshots work on refusal forms.
 */
export interface Booking {
  id: string;
  patientId: string;
  bookingNumber: string;
  /** References `Facility.id` — the reporting key. */
  facilityId: string;
  /** Display snapshot at write time. Never group on this. */
  facilityName: string;
  bookedAt: string;
  releasedAt?: string;
  bookingReason?: string;
  createdBy: string;
  createdAt: string;
}

/** A housing/unit move inside one booking episode. */
export interface HousingMove {
  id: string;
  patientId: string;
  /** References `Booking.id`. */
  bookingId: string;
  movedAt: string;
  /** References `Facility.id` — the reporting key. */
  facilityId: string;
  /** Display snapshot at write time. Never group on this. */
  facilityName: string;
  housingUnit: string;
  reason?: string;
  createdBy: string;
  createdAt: string;
}

/**
 * §Facility — a first-class custody/partner site.
 *
 * Introduced so per-site reporting stops fragmenting on typos ("Fresno County
 * Jail - Main" vs "fresno county jail — main" were previously two distinct
 * buckets). Lookup is by NORMALIZED name (case, punctuation, dash style and
 * whitespace folded away), so the same site typed three ways resolves to one
 * id.
 */
export interface Facility {
  id: string;
  name: string;
  kind: FacilityKind;
  city?: string;
  /** IANA zone for future per-site scheduling. Unused today, recorded now. */
  timezone?: string;
  active: boolean;
  createdBy: string;
  createdAt: string;
}

/**
 * Optional profile detail on a facility. Every field is nullable on purpose:
 * facilities are frequently created inline from a booking (`ensureFacility`),
 * where only a name is known. Admins fill the rest in on the facility page.
 */
export interface FacilityProfile {
  addressLine1?: string;
  addressLine2?: string;
  /** Two-letter USPS state code, upper-cased on write. */
  state?: string;
  postalCode?: string;
  county?: string;
  /** Main switchboard / front-desk line. */
  phone?: string;
  fax?: string;
  website?: string;
  /** Primary point of contact for care coordination at this site. */
  contactName?: string;
  contactTitle?: string;
  contactPhone?: string;
  contactEmail?: string;
  /** Free-text operational notes: intake hours, gate procedure, badge rules. */
  notes?: string;
}

export interface Facility extends FacilityProfile {}

/** Profile keys, used for uniform trim/normalize/audit handling. */
export const FACILITY_PROFILE_FIELDS = [
  "addressLine1",
  "addressLine2",
  "state",
  "postalCode",
  "county",
  "phone",
  "fax",
  "website",
  "contactName",
  "contactTitle",
  "contactPhone",
  "contactEmail",
  "notes",
] as const satisfies readonly (keyof FacilityProfile)[];

/** Trim, drop empties, and upper-case the state code. */
export function normalizeFacilityProfile(input: Partial<FacilityProfile>): FacilityProfile {
  const out: FacilityProfile = {};
  for (const key of FACILITY_PROFILE_FIELDS) {
    const raw = input[key];
    if (raw === undefined) continue;
    const value = String(raw).trim();
    out[key] = value ? (key === "state" ? value.toUpperCase() : value) : undefined;
  }
  return out;
}

/** One-line postal address, or undefined when nothing is recorded. */
export function facilityAddressLine(f: Facility): string | undefined {
  const street = [f.addressLine1, f.addressLine2].filter(Boolean).join(", ");
  const region = [f.city, f.state].filter(Boolean).join(", ");
  const line = [street, region, f.postalCode].filter(Boolean).join(" · ");
  return line || undefined;
}

export type FacilityKind =
  | "clinic"
  | "community_health_center"
  | "county_jail"
  | "state_prison"
  | "juvenile_hall"
  | "hospital"
  | "treatment"
  | "shelter"
  | "other"
  // Legacy kinds kept so historical rows keep resolving; new records should
  // use the more specific county_jail / state_prison labels above.
  | "jail"
  | "prison";

/** Selectable facility types, in the order admins should see them. */
export const FACILITY_KINDS: { key: FacilityKind; label: string }[] = [
  { key: "clinic", label: "Clinic" },
  { key: "community_health_center", label: "Community health center" },
  { key: "county_jail", label: "County jail" },
  { key: "state_prison", label: "State prison" },
  { key: "juvenile_hall", label: "Juvenile hall" },
  { key: "hospital", label: "Hospital" },
  { key: "treatment", label: "Treatment / residential" },
  { key: "shelter", label: "Shelter" },
  { key: "other", label: "Other" },
];

const LEGACY_FACILITY_KIND_LABELS: Partial<Record<FacilityKind, string>> = {
  jail: "Jail (legacy)",
  prison: "Prison (legacy)",
};

export function facilityKindLabel(kind: FacilityKind): string {
  return (
    FACILITY_KINDS.find((k) => k.key === kind)?.label ??
    LEGACY_FACILITY_KIND_LABELS[kind] ??
    "Other"
  );
}

/**
 * Fold a facility name to its matching key: case, accents, punctuation, dash
 * style and repeated whitespace all collapse. "Fresno County Jail — Main",
 * "fresno county jail - main" and "Fresno County Jail  Main" share a key.
 */
export function normalizeFacilityName(name: string): string {
  return (name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** One aggregated controlled-substance line in a shift count. */
export interface ShiftCountLine {
  key: string;
  drugName: string;
  doseLabel: string;
  deaSchedule: string;
  given: number;
  refusedOrHeld: number;
  patients: number;
  firstAt?: string;
  lastAt?: string;
}

/**
 * §Population health — an admin-configured KPI target. Targets are reporting
 * configuration, not clinical data, so they live top-level (not on a Patient)
 * and are gated on the `population_health` record class.
 */
export interface KpiTarget {
  id: string;
  /** Matches a MetricKey in dashboardMetrics.ts. Free string so a target can
   *  be set for a measure before the live metric exists. */
  metricKey: string;
  label: string;
  targetValue: number;
  unit: "percent" | "count";
  /** YYYY-MM the target takes effect. */
  effectiveMonth?: string;
  /** Where the target came from (contract, NCCHC standard, internal goal). */
  source?: string;
  notes?: string;
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
}

/**
 * §Population health / CalAIM — an admin-curated ICD-10 code that makes a
 * patient CalAIM-eligible. Shared registry (top-level, not patient-scoped),
 * same pattern as Facility and KpiTarget, gated on `population_health` write.
 *
 * `code` may be a full code ("F11.20") or a category prefix ("F10", meaning
 * every F10.x). Matching supports both — see `src/lib/calaim.ts`.
 */
export interface CalaimQualifyingCode {
  id: string;
  codeSystem: "icd10";
  code: string;
  description?: string;
  active: boolean;
  createdBy: string;
  createdAt: string;
  deactivatedBy?: string;
  deactivatedAt?: string;
  deactivationReason?: string;
}

/**
 * Immutable, locked controlled-substance shift count. Top-level (NOT on a
 * Patient) — it is a facility/shift artifact that spans the population.
 */
export interface ShiftCount {
  id: string;
  windowStart: string;
  windowEnd: string;
  housingUnit?: string;
  scheduleFilter: string;
  lines: ShiftCountLine[];
  totalGiven: number;
  totalRefusedOrHeld: number;
  counterName: string;
  witnessName: string;
  notes?: string;
  signedAt: string;
}

/**
 * Witness requirement at administration. CII always; an order flagged
 * controlled with no schedule recorded is treated as CII (conservative).
 * CIII–CV do NOT require a witness.
 */
export function requiresDoseWitness(
  order: Pick<MedOrder, "isControlled" | "deaSchedule">,
): boolean {
  if (!order.isControlled) return false;
  return !order.deaSchedule || order.deaSchedule === "CII";
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
  email?: string;
  releaseDate: string;
  /**
   * Facility/site timezone used to anchor MAR administration times.
   * Adelante has no Site entity yet, so the zone lives on the patient — a
   * single program serves community clients and custody partner sites, and
   * those can differ. TODO(sites): move to a Site record when one exists.
   */
  facilityTimezone?: string;
  enrolledAt: string;
  episodeDay: number; // day within 90-day window
  smsFallback: boolean;
  consents: { hipaa: boolean; part2Sud: boolean; signedAt?: string };
  screeners: Record<string, ScreenerResult | undefined>;
  // Longitudinal screener trends (PHQ-9/GAD-7 at intake/30/60/90, AUDIT/DAST/PCL ad hoc)
  screenerHistory?: ScreenerResult[];
  needs: {
    housing: boolean;
    food: boolean;
    employment: boolean;
    transport: boolean;
    substanceUse?: boolean;
    benefits?: boolean;
    family?: boolean;
  };
  carePlanSummary: string;
  intakeCompletedAt?: string;
  // Medi-Cal eligibility & coverage (§4d)
  coverage?: {
    status: CoverageStatus;
    verified: "verified" | "pending" | "not_found";
    countyOfRelease?: string;
    jiReentryFlag?: boolean;
    ecmEligible?: boolean;
    otherPlanName?: string;
    communitySupports?: {
      housing?: boolean;
      food?: boolean;
      transport?: boolean;
    };
    /** Dated eligibility snapshots (§3g). Current view is still the outer object. */
    snapshots?: CoverageSnapshot[];
  };
  // Case Manager workspace
  caseManagerId?: string;
  checkIns?: CheckIn[];
  resourceReferrals?: ResourceReferral[];
  // Crisis flag from §4c (PHQ-9 item 9 > 0, etc.)
  crisisFlag?: { source: string; raisedAt: string };
  // Programmatic, de-identified ID for Admin views
  programId: string;
  // Clinician care plan (editable)
  goals?: Goal[];
  progressNotes?: ProgressNote[];
  // Per-purpose consent state (revocable) + append-only audit trail
  consentState?: {
    part2Sud: boolean;
    ecmShare: boolean;
    sms: boolean;
  };
  consentEvents?: ConsentEvent[];
  // Patient-facing re-screen tasks created from clinician/case-manager workspaces
  tasks?: PatientTask[];
  // P1 — profile / contact preferences captured at signup + intake "About you"
  preferredName?: string;
  pronouns?: string;
  preferredLanguage?: PreferredLanguage;
  contactPrefs?: ContactPrefs;
  emergencyContact?: EmergencyContact;
  address?: string;
  /** CIN / Medi-Cal ID (9 characters). Helps disambiguate similar names. */
  cin?: string;
  // Link back to the referral that enrolled this patient, if any.
  referralId?: string;
  // Appointment-related notifications (booked / rescheduled / cancelled).
  notifications?: ApptNotification[];
  // §Messaging Phase 2 — one ongoing care-team thread per patient.
  careMessages?: CareMessage[];
  // ----- MVP EMR extension (all optional, backward compatible) -----
  /** Linked treatment episodes (not collapsed). §3a */
  episodes?: Episode[];
  /** Release date provenance. §3c — coexists with the flat `releaseDate` string. */
  releaseDateMeta?: ReleaseDateMeta;
  /** SDOH need → referral → closed-loop status. §3e */
  sdohPlan?: { items: SdohPlanItem[] };
  /** Assigned self-help modules with completion. §3f */
  selfHelpPlan?: { modules: SelfHelpModule[] };
  /** External coordination log (§4-CM). */
  externalContacts?: ExternalContact[];
  coordinationLog?: CoordinationEntry[];
  /** Peer-specialist notes. */
  peerNotes?: PeerNote[];
  /** Per-flag context notes for eligibility (source, as-of, why). */
  eligibilityNotes?: Partial<Record<EligibilityFlagKey, EligibilityNote>>;
  /** Primary/assigned clinician of record (§ProviderSwitch). Optional. */
  primaryClinicianId?: string;
  /** Auto-derived care-plan snapshot; recomputed after clinical writes. */
  carePlan?: CarePlanSnapshot;
  /** Optional free-text overlay from a clinician; merged into the summary. */
  carePlanOverride?: { text: string; setAt: string; by?: string };
  /**
   * §Group sessions — care-plan-level eligibility gate for ANY group
   * enrollment path (staff, patient self-service, and the future
   * Authorized Representative / Collateral path). Lives on the care-plan
   * layer next to `carePlanOverride` rather than in a parallel flag store.
   *
   * PLACEHOLDER: `reason` is free text and `curriculumNeedTag` is a made-up
   * label, NOT a DHCS curriculum taxonomy. Christi/SMEs must supply the real
   * criteria and tag list.
   */
  groupEligibility?: GroupEligibility;
  // ----- Clinical record layer (Problems / Allergies / Alerts). §BaggaEMR mirror -----
  /** Diagnosed problems (active + resolved + soft-deleted). Mirror of BaggaEMR `patient_problems`. */
  problems?: Problem[];
  /** Allergies (active + removed). Mirror of BaggaEMR `patient_allergies`. */
  allergies?: Allergy[];
  /** Staff-visible patient safety alerts (free-text label). Mirror of BaggaEMR `patient_alerts`. */
  alerts?: PatientAlert[];
  /** §Crisis escalation — open/resolved escalations, each linked to a PatientAlert. */
  crisisEscalations?: CrisisEscalation[];
  /** Medication orders — drafts staged in the cart plus signed orders. §Orders. */
  orders?: MedOrder[];
  /** Charted dose administrations (§MAR). Append-only; voids never delete. */
  administrations?: DoseAdministration[];
  /**
   * Live claims on un-charted dose slots. Kept on the patient rather than in a
   * separate store because every other MAR read is already patient-scoped.
   */
  doseClaims?: DoseClaim[];
  /** KOP supply issuances (§MAR Phase 2). Never deleted; returns are recorded. */
  kopIssuances?: KopIssuance[];
  /** Refusal legal documents (§MAR Phase 3). Never deleted. */
  refusalForms?: RefusalForm[];
  /** §Custody tracking — booking episodes (append-only; closing sets releasedAt). */
  bookings?: Booking[];
  /** §Custody tracking — housing moves within bookings. */
  housingMoves?: HousingMove[];
  /** §Med reconciliation — session headers, newest first. */
  medReconciliations?: MedReconciliation[];
  /** §Med reconciliation — flat item rows joined on `reconciliationId`. */
  medReconItems?: MedReconItem[];
}

/**
 * §Medication reconciliation (BaggaEMR MedReconciliationDialog port).
 *
 * Storage note: reconciliations and their items live in TWO parallel arrays on
 * the patient (`medReconciliations` + `medReconItems`, joined on
 * `reconciliationId`). Nesting items inside the header would have forced a
 * shape change to the agreed interfaces, and the flat array makes per-item
 * patches (the dominant write) a single find instead of a nested walk.
 */
export interface MedReconItem {
  id: string;
  reconciliationId: string;
  source: "active_order" | "home";
  /** Set when source is "active_order" — the link used by the stop cascade. */
  orderId?: string;
  drugName: string;
  dose?: string;
  frequency?: string;
  route?: string;
  decision: "continue" | "modify" | "stop" | "add" | "not_reviewed";
  newDose?: string;
  newFrequency?: string;
  newRoute?: string;
  decisionNote?: string;
  decidedBy?: string;
  decidedAt?: string;
}

export interface MedReconciliation {
  id: string;
  patientId: string;
  type: "intake" | "transfer" | "release";
  status: "in_progress" | "completed" | "canceled";
  performedBy: string;
  performedAt: string;
  completedAt?: string;
  notes?: string;
}

/**
 * Local mirror of `isOrderActive` / `isTherapyActive` from src/lib/orders.ts.
 * Duplicated (not imported) only because ehr -> orders -> roles -> ehr would
 * be a module cycle; src/lib/__tests__/medRecon.test.ts asserts the two stay
 * in agreement, so a change on either side fails loudly.
 */
function orderIsActive(order: MedOrder): boolean {
  return order.status === "signed" || order.status === "held";
}

export const MED_RECON_TYPE_LABEL: Record<MedReconciliation["type"], string> = {
  intake: "Intake",
  transfer: "Transfer",
  release: "Release",
};

export const MED_RECON_DECISION_LABEL: Record<MedReconItem["decision"], string> = {
  continue: "Continue",
  modify: "Modify",
  stop: "Stop",
  add: "Add",
  not_reviewed: "Not reviewed",
};

export interface ScreenerResult {
  key: string;
  score: number;
  severity: string;
  completedAt: string;
  timepoint?: "intake" | "day30" | "day60" | "day90" | "adhoc";
  crisisFlag?: boolean;
}

export interface Clinician {
  id: string;
  name: string;
  credential: string;
  mediCalCredentialed: boolean;
  mediCalStatus: "active" | "pending" | "expired";
  /** Services this clinician provides. When absent, treat as offering all services. */
  services?: ServiceType[];
  /** Physical locations where this clinician staffs in-person visits. */
  locationIds?: string[];
  /** Credentialing hard-stop (YYYY-MM-DD). Booking is blocked when past. */
  licenseExpiresOn?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  clinicianId: string;
  start: string; // ISO
  durationMin: number;
  status: SessionStatus;
  billingStatus: BillingStatus;
  videoUrl?: string;
  fundingLane?: FundingLane;
  /** What kind of visit this is (added in scheduling v2). */
  serviceType?: ServiceType;
  /** How the visit happens. Legacy rows may be undefined; treat as "video". */
  modality?: "video" | "phone" | "in_person";
  /** Required when modality === "in_person". */
  locationId?: string;
  /** Billing coordinator fields (pass-2 polish). */
  chargeCents?: number;
  denialReason?: string;
  submittedAt?: string;
  paidAt?: string;
  billingHistory?: BillingHistoryEntry[];
  /** When funding lane is ISL, why this encounter fell into ISL. */
  islReason?: "uninsured" | "benefit_exhausted" | "restricted_setting";
}

export interface BillingHistoryEntry {
  id: string;
  at: string;
  actor: string;
  from: BillingStatus;
  to: BillingStatus;
  note?: string;
}

// ---------- Scheduling: service types + locations ----------

export type ServiceType =
  | "intake"
  | "therapy_individual"
  | "therapy_group"
  | "med_management"
  | "peer_support"
  | "case_management"
  | "care_coordination";

export interface ServiceTypeInfo {
  id: ServiceType;
  label: string;
  helper: string;
  allowedModalities: ("video" | "phone" | "in_person")[];
  defaultDurationMin: number;
}

export interface ClinicLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  /** Postal code — part of the single canonical address, not a parallel blob. */
  postalCode?: string;
  room?: string;
  inPersonServices: ServiceType[];
}

/** One place that renders a ClinicLocation's full street address. */
export function formatLocationAddress(loc?: ClinicLocation): string {
  if (!loc) return "";
  return [loc.address, loc.room, loc.city, loc.postalCode].filter(Boolean).join(", ");
}

const SERVICE_TYPES: ServiceTypeInfo[] = [
  {
    id: "intake",
    label: "First visit (intake)",
    helper: "Get set up with your care team.",
    allowedModalities: ["video", "in_person"],
    defaultDurationMin: 60,
  },
  {
    id: "therapy_individual",
    label: "Talk with a counselor",
    helper: "A private one-on-one session.",
    allowedModalities: ["video", "phone", "in_person"],
    defaultDurationMin: 50,
  },
  {
    id: "therapy_group",
    label: "Group session",
    helper: "Meet with others in a supported group.",
    allowedModalities: ["in_person", "video"],
    defaultDurationMin: 60,
  },
  {
    id: "med_management",
    label: "Medication visit",
    helper: "Talk with a prescriber about medications.",
    allowedModalities: ["video", "in_person"],
    defaultDurationMin: 30,
  },
  {
    id: "peer_support",
    label: "Peer support",
    helper: "Connect with someone who's been there.",
    allowedModalities: ["video", "phone", "in_person"],
    defaultDurationMin: 45,
  },
  {
    id: "case_management",
    label: "Meet your case manager",
    helper: "Get help with resources and next steps.",
    allowedModalities: ["video", "phone", "in_person"],
    defaultDurationMin: 30,
  },
  {
    id: "care_coordination",
    label: "Care coordination",
    helper: "Line up outside services and support.",
    allowedModalities: ["video", "phone"],
    defaultDurationMin: 30,
  },
];

const LOCATIONS: ClinicLocation[] = [
  {
    id: "loc-visalia",
    name: "Adelante Visalia Hub",
    address: "1201 S Mooney Blvd",
    city: "Visalia, CA",
    postalCode: "93277",
    room: "Suite 200",
    inPersonServices: [
      "intake",
      "therapy_individual",
      "therapy_group",
      "med_management",
      "peer_support",
      "case_management",
    ],
  },
  {
    id: "loc-porterville",
    name: "Porterville Community Office",
    address: "379 N Main St",
    city: "Porterville, CA",
    postalCode: "93257",
    inPersonServices: ["therapy_individual", "peer_support", "case_management"],
  },
];

export interface CheckIn {
  id: string;
  date: string;
  modality: "video" | "phone" | "in_person" | "sms";
  attended: boolean;
  notes?: string;
  needsFlagged: { housing?: boolean; food?: boolean; employment?: boolean; transport?: boolean };
}

export interface ResourceReferral {
  id: string;
  category: "housing" | "food" | "employment" | "legal" | "benefits" | "transport";
  provider: string;
  status: "pending" | "accepted" | "completed";
  createdAt: string;
  updatedAt?: string;
  note?: string;
  followUpDate?: string;
  visibleToPatient?: boolean;
  // 42 CFR Part 2 guardrail — must be true to share SUD-identifying detail externally
  sudDisclosureConsent?: boolean;
}

export type ExternalPartyRole =
  | "probation"
  | "parole"
  | "housing"
  | "pcp"
  | "county_bh"
  | "family"
  | "other";
export interface ExternalContact {
  id: string;
  agency: string;
  contactName?: string;
  phone?: string;
  email?: string;
  role: ExternalPartyRole;
  part2Sensitive?: boolean;
  createdAt: string;
}
export type CoordinationDirection = "in" | "out";
export type CoordinationChannel = "phone" | "email" | "in_person" | "letter" | "portal";
export interface CoordinationEntry {
  id: string;
  date: string;
  partyType: ExternalPartyRole;
  party: string;
  direction: CoordinationDirection;
  channel: CoordinationChannel;
  summary: string;
  part2Disclosed: boolean;
  createdBy: string;
}

export interface PeerNote {
  id: string;
  date: string;
  author: string;
  text: string;
  mode?: "in_person" | "phone" | "text" | "warmline" | "group";
  /** §Phase 3 billing hook — authoring staff member (roles.ts roster id). */
  staffId?: string;
  /** Documented service time; drives H0038 15-minute unit math. */
  minutes?: number;
  /** Claim generated from this note, when one was created. */
  claimId?: string;
}

export type EligibilityFlagKey = "ecm" | "jiReentry" | "cs_housing" | "cs_food" | "cs_transport";
export interface EligibilityNote {
  note?: string;
  asOf?: string;
  updatedAt: string;
}

export interface CaseManager {
  id: string;
  name: string;
  role: "ecm_provider" | "peer_support";
}

export interface Goal {
  id: string;
  text: string;
  status: "open" | "in_progress" | "done";
  createdAt: string;
  createdBy?: string;
  updatedBy?: string;
}

// ---------- Care-plan snapshot (auto-derived) ----------
// Structured summary of a patient's plan, recomputed after every clinical
// event that could change it (intake screeners, goals, notes, meds, refills,
// SDOH items, check-ins). Each slice carries a `sensitive` bit so surfaces
// can gate SUD/Part-2 material without re-deriving it.
export type CarePlanFocusKey = "mh" | "sud" | "sdoh" | "meds" | "engagement";
export interface CarePlanFocusArea {
  key: CarePlanFocusKey;
  label: string;
  severity?: string;
  sensitive?: boolean;
}
export interface CarePlanNextStep {
  label: string;
  dueBy?: string;
  source: "screener" | "clinician" | "ecm_provider" | "self_help";
  sensitive?: boolean;
}
export interface CarePlanScreenerHighlight {
  key: string;
  name: string;
  score: number;
  band: string;
  takenAt: string;
  sensitive: boolean;
}
export interface CarePlanMedicationSlice {
  name: string;
  state: "active" | "refill_pending" | "changed";
  sensitive: boolean;
}
export interface CarePlanSdohSlice {
  need: string;
  status: SdohStatus;
}
export interface CarePlanMetrics {
  phq9Latest?: number;
  gad7Latest?: number;
  goalsOpen: number;
  goalsDone: number;
  sdohOpen: number;
  sdohClosed: number;
  lastContactAt?: string;
  intakeComplete: boolean;
  crisisFlag: boolean;
  medsActive: number;
  medsSensitive: number;
}
export interface CarePlanSnapshot {
  updatedAt: string;
  updatedBy: "system" | "clinician" | "ecm_provider";
  summary: string;
  focusAreas: CarePlanFocusArea[];
  activeGoals: { id: string; text: string; status: Goal["status"] }[];
  nextSteps: CarePlanNextStep[];
  screenerHighlights: CarePlanScreenerHighlight[];
  medications: CarePlanMedicationSlice[];
  sdohOpen: CarePlanSdohSlice[];
  metrics: CarePlanMetrics;
  triggeredBy?: string;
  /** Plain-language allergy summary for patient/staff surfaces. Excludes soft-removed rows. */
  allergySummary?: CarePlanAllergyEntry[];
  /** Non-SUD active problems for patient/staff summary. SUD problems live only in the SUD-gated view. */
  activeProblems?: CarePlanProblemEntry[];
  /** Count of active SUD problems hidden from non-Part-2 viewers (never leaks descriptions). */
  hiddenSudProblems?: number;
}

export interface CarePlanAllergyEntry {
  substance: string;
  reaction?: string;
  severity: "mild" | "moderate" | "severe";
}
export interface CarePlanProblemEntry {
  code?: string;
  label: string;
  category?: "sud" | "mental_health" | "pregnancy" | "medical";
  sensitive: boolean;
}

// ============================================================================
// Clinical record layer — Problems, Allergies, Alerts.
// Field-for-field mirror of Dr. Bagga's BaggaEMR schemas. Mutations route
// through `appendAudit`, soft-deletes require a reason, and problem/allergy
// writes trigger a care-plan recompute so patient/staff summaries stay live.
// ============================================================================

export interface Problem {
  id: string;
  patientId: string;
  icd10Code?: string;
  snomedCode?: string;
  snomedDisplay?: string;
  description: string;
  status: "active" | "resolved";
  category?: "sud" | "mental_health" | "pregnancy" | "medical";
  priority?: number;
  onsetDate?: string;
  enteredBy: string;
  createdAt: string;
  resolvedDate?: string;
  resolvedBy?: string;
  clinicianComment?: string;
  notes?: string;
  updatedAt?: string;
  updatedBy?: string;
  deletedAt?: string;
  deletionReason?: string;
}

export interface Allergy {
  id: string;
  patientId: string;
  substance: string;
  reaction?: string;
  severity: "mild" | "moderate" | "severe";
  notes?: string;
  active: boolean;
  enteredBy: string;
  enteredAt: string;
  removedBy?: string;
  removedAt?: string;
  removedReason?: string;
}

// §Crisis escalation — Adelante-native (no BaggaEMR equivalent).
// The visible flag IS a PatientAlert; this record is the workflow wrapper that
// makes the escalation trackable across the population until it is dispositioned.
export interface CrisisEscalation {
  id: string;
  patientId: string;
  /** The underlying PatientAlert record — that alert is the visible flag. */
  alertId: string;
  triggerSource: "manual" | "screener_score";
  /** e.g. "PHQ-9 total 22 (severe band)" or the manual reason. */
  triggerDetail?: string;
  triggeredBy: string;
  triggeredAt: string;
  status: "open" | "resolved";
  contactedWhom?: string;
  actionsTaken?: string;
  disposition?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionReason?: string;
}

export interface PatientAlert {
  id: string;
  patientId: string;
  /** Free text (e.g. "Fall Risk", "Suicide Watch"). Deliberately not a fixed enum. */
  label: string;
  severity: "info" | "warning" | "critical";
  notes?: string;
  active: boolean;
  enteredBy: string;
  enteredAt: string;
  removedBy?: string;
  removedAt?: string;
  removedReason?: string;
}

/** Naming mirrors Dr. Bagga's `isProblemClinicallyActive` helper. */
export function isProblemClinicallyActive(problem: Problem): boolean {
  return problem.status === "active" && !problem.deletedAt;
}

export interface ProgressNote {
  id: string;
  appointmentId?: string;
  clinicianId: string;
  date: string;
  sessionType: "individual" | "group" | "phone" | "check_in";
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  /**
   * Sensitivity context, deliberately the SAME shape used by `Problem.category`
   * so a SUD-tied note masks through the existing 42 CFR Part 2 consent gate
   * rather than a second masking mechanism. Absent = not sensitive.
   */
  category?: "sud" | "mental_health" | "pregnancy" | "medical" | "group";
  /**
   * §Group sessions — set on the individualized per-attendee note produced by
   * a group occurrence. Its presence is what makes the note identifiable as a
   * per-attendee billable unit (see `GroupAttendeeNoteRef`).
   */
  groupRef?: GroupAttendeeNoteRef;
  /**
   * Provenance seam for a future AI-drafting layer ("Adel", separate project).
   * Schema only: nothing in this app writes "ai_draft" today. The point is that
   * authorship and signature are already distinct states — content may in
   * principle be machine-drafted, but only a human signature makes it a signed
   * legal record, and masking is unaffected by this field.
   */
  authorSource?: NoteAuthorSource;
  /**
   * §ASCMI stricter tier — SCAFFOLD, currently UNUSED by design. When set,
   * the note routes through the `psychotherapy_notes` record class, which is
   * default-deny for every role and is NOT unlocked by SUD consent. No real
   * template or seeded note sets this today; tagging documentation with it is
   * a clinical-content decision that needs clinical author sign-off first.
   */
  restrictedTier?: "psychotherapy_notes";
  status?: NoteStatus;
  signedBy?: string;
  signedAt?: string;
  cosignRequired?: boolean;
  /** Roles eligible to cosign. Empty/undefined = any eligible clinical role. */
  cosignRole?: string[];
  cosignedBy?: string;
  cosignedAt?: string;
  cosignComment?: string;
  declineReason?: string;
  declinedBy?: string;
  declinedAt?: string;
  /** Template layer (Phase 3a). Absent = classic fixed SOAP note. */
  templateId?: string;
  templateKey?: string;
  templateTitle?: string;
  /**
   * Version number of the template row the note was answered against. The
   * schema snapshot below is authoritative; this exists so the UI/audit can
   * say "Answered against Behavioral health intake v2" unambiguously.
   */
  templateVersion?: number;
  /** Schema snapshot at authoring time — history survives template edits. */
  templateSchema?: TemplateSchema;
  templateAnswers?: TemplateAnswers;
  /**
   * §Phase 3b — resolved autofill_section content, frozen alongside the
   * answers. Never recomputed on read.
   */
  autofillSnapshots?: AutofillSnapshot[];
  /**
   * §Phase 3c — set when a `start_template` automation created this draft.
   * Automation output is never auto-signed: this note is a draft like any
   * other and a human must author and sign it.
   */
  automationOrigin?: {
    sourceNoteId: string;
    automationId: string;
    /** The automation's author-facing label. */
    label: string;
    /** Template title of the note that triggered it. */
    sourceTemplateTitle?: string;
  };
}

/**
 * §Clinical documentation Phase 3a — a reusable structured note template.
 * Rows are immutable with respect to `schema`: a schema edit appends a NEW row
 * (same `key`, new `id`, `version + 1`) and marks the old row `supersededBy`.
 * Title/description/encounterType edits are presentation-only and patch in
 * place. A note also snapshots the schema it was written against, so history
 * survives even if a version row is somehow lost.
 */
export interface NoteTemplate {
  id: string;
  /** Stable identity across versions. */
  key: string;
  /** 1-based, increments on every schema change. */
  version: number;
  /** Set on the older row when a schema edit creates a successor. */
  supersededBy?: string;
  title: string;
  /** Short author-facing summary shown in the note-start picker. */
  description?: string;
  /**
   * Free text. Adelante has no encounter-type enum today (appointments carry a
   * free-form `serviceType`), so this matches that concept rather than
   * inventing a competing taxonomy.
   */
  encounterType: string;
  schema: TemplateSchema;
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
  deactivationReason?: string;
}

export type NoteAuthorSource = "human" | "ai_draft";
export type NoteStatus = "draft" | "signed" | "cosign_pending" | "cosigned" | "declined";

/** Roles that may sign a note at all, and that may sign without a cosigner. */
export const NOTE_SELF_SIGN_ROLES = ["pmhnp", "therapist"] as const;

/** A note is masked exactly like a SUD problem entry — one gate, one rule. */
export function isNoteSudSensitive(note: ProgressNote): boolean {
  return note.category === "sud";
}

/**
 * §ASCMI — is this note in the stricter psychotherapy-notes tier?
 * Always false today: nothing sets `restrictedTier` (see the field comment).
 */
export function isNoteStrictlyRestricted(note: ProgressNote): boolean {
  return note.restrictedTier === "psychotherapy_notes";
}

/** Effective status for legacy rows written before the lifecycle existed. */
export function noteStatus(note: ProgressNote): NoteStatus {
  return note.status ?? "draft";
}

export type ConsentPurpose = "part2Sud" | "ecmShare" | "sms" | "hipaa";
// Extended purposes (§3h). Added additively — existing code paths ignore new keys.
export type ExtendedConsentPurpose =
  | ConsentPurpose
  | "telehealth"
  | "roi"
  | "portal"
  | "proxy"
  | "group";
export interface ConsentEvent {
  id: string;
  purpose: ExtendedConsentPurpose;
  action: "granted" | "revoked";
  at: string;
  actor: "patient" | "staff";
  note?: string;
}

// ===========================================================================
// §ASCMI consent infrastructure — structured, capturable, revocable consent.
//
// PLACEHOLDER CONTENT WARNING: the category keys below are GENERIC
// PLACEHOLDERS chosen to exercise the mechanism. They are NOT the DHCS/ASCMI
// category set. Before this goes anywhere near production they must be
// replaced with Christi's actual DHCS-sourced categories, and the form-type
// labels / attestation text must be replaced with the real legal language.
// No regulatory text is authored here on purpose.
// ===========================================================================
export type ConsentCategory =
  | "sud_treatment"
  | "mental_health"
  | "case_coordination"
  | "billing"
  // §Group sessions — PLACEHOLDER category. OPEN QUESTION FOR CHRISTI:
  // whether group participation genuinely requires its own ASCMI consent
  // category, or whether it falls under general treatment consent, is a
  // regulatory/clinical determination that is explicitly NOT decided here.
  // The mechanism is wired so either answer is a one-line change.
  | "group_participation"
  // §v3.0 Phase 2 — the three Release & Consent pre-release forms. PLACEHOLDER
  // keys and labels, same discipline as every other category here: the real
  // DHCS/ASCMI form language is Christi's to supply, and nothing legal is
  // authored in this file.
  | "pre_release_services"
  | "telehealth_services"
  // Explicit written authorization for THIRD-PARTY disclosure. This is the
  // category the AB 133 split turns on: coordination between the CF Care
  // Manager and the receiving ECM Provider is exempt and never checks it;
  // anything third-party or 42 CFR Part 2 does. See src/lib/ab133.ts.
  | "information_sharing_disclosure"
  // §v3.0 Phase 4 — Release of Information for Collateral (advocate)
  // participation. PLACEHOLDER key and label, same discipline as every other
  // category here: the real DHCS DMC-ODS Collateral ROI form language is
  // Christi's to supply. The GATE is real even though the content is not —
  // a Collateral-type advocate has zero access until this is active.
  | "roi_collateral"
  // §v3.0 Phase 4 expansion — the ONE consent-conditional exception to
  // ADVOCATE_PART2_ALWAYS_MASKED. PLACEHOLDER key and label; the real
  // 42 CFR Part 2 disclosure-authorization language is Christi's to supply.
  // Active + a valid advocate link => that advocate may see SUD group topics
  // and appointment service types for THAT patient. Nothing else changes.
  | "advocate_sud_disclosure";

export const CONSENT_CATEGORIES: { key: ConsentCategory; label: string }[] = [
  { key: "sud_treatment", label: "SUD treatment (placeholder)" },
  { key: "mental_health", label: "Mental health (placeholder)" },
  { key: "case_coordination", label: "Case coordination (placeholder)" },
  { key: "billing", label: "Billing (placeholder)" },
  { key: "group_participation", label: "Group participation (placeholder)" },
  { key: "pre_release_services", label: "Pre-release services (placeholder)" },
  { key: "telehealth_services", label: "Telehealth (placeholder)" },
  {
    key: "information_sharing_disclosure",
    label: "Information sharing / disclosure authorization (placeholder)",
  },
  {
    key: "roi_collateral",
    label: "Release of Information — Collateral participation (placeholder)",
  },
  {
    key: "advocate_sud_disclosure",
    label: "Part 2 disclosure to advocate — SUD service details (placeholder)",
  },
];

/** The ASCMI category a DHCS Collateral advocate's access hard-depends on. */
export const COLLATERAL_ROI_CATEGORY: ConsentCategory = "roi_collateral";

export type ConsentFormType = "AB133" | "NonAB133" | "Revocation";
export type ConsentRecordStatus = "active" | "expired" | "revoked" | "superseded";

export interface ConsentRecordSection {
  category: ConsentCategory;
  authorized: boolean;
}

export interface ConsentRecord {
  id: string;
  patientId: string;
  formType: ConsentFormType;
  /** How/where this was captured, e.g. "in person — consent tab". */
  source: string;
  signedAt: string;
  /**
   * E-signature capture. Same typed-name + attestation pattern used for MAR,
   * order and note signing — deliberately NOT a new signing mechanism.
   * TODO(auth): attestation is checkbox-only here too.
   */
  signedBy: { name: string; relationship: "patient" | "guardian" | "proxy" };
  capturedBy?: { staffId?: string; staffName: string; role: string };
  attestationMethod: "checkbox_only";
  effectiveDate: string;
  expirationDate?: string;
  status: ConsentRecordStatus;
  /** Modification linkage: the record this one replaces. */
  supersedesId?: string;
  sections: ConsentRecordSection[];
  revokedAt?: string;
  revokedBy?: string;
  revocationReason?: string;
}

// ===========================================================================
// §v3.0 Phase 2 — CF Care Manager pre-release episode, form capture, and the
// Person-Centered Reentry Care Plan.
//
// PLACEHOLDER CONTENT WARNING: every form key, label and field set below is a
// PLACEHOLDER chosen to exercise the mechanism. DHCS's literal SSApp /
// Pre-Release Screening / Health Risk Assessment / Level-of-Care layouts are
// NOT reproduced here and are NOT invented. They must be replaced wholesale
// with Christi's real DHCS-sourced field sets before production.
// ===========================================================================
export type PreReleaseFormCategory =
  | "medi_cal_enrollment"
  | "clinical_assessment"
  | "release_consent"
  | "transition_planning";

export const PRE_RELEASE_FORM_CATEGORIES: {
  key: PreReleaseFormCategory;
  label: string;
  helper: string;
}[] = [
  {
    key: "medi_cal_enrollment",
    label: "Medi-Cal enrollment & eligibility",
    helper: "Structured intake capture — not a consent instrument.",
  },
  {
    key: "clinical_assessment",
    label: "Clinical & assessment",
    helper: "Structured screening flags only — never narrative clinical documentation.",
  },
  {
    key: "release_consent",
    label: "Release & consent",
    helper: "Captured through the ASCMI ConsentRecord ledger, not stored as form fields.",
  },
  {
    key: "transition_planning",
    label: "Transition planning",
    helper: "The Person-Centered Reentry Care Plan hand-off artifact.",
  },
];

export type PreReleaseFieldType = "text" | "longtext" | "date" | "bool" | "select";

export interface PreReleaseFieldDef {
  key: string;
  label: string;
  type: PreReleaseFieldType;
  options?: string[];
  required?: boolean;
}

export interface PreReleaseFormDef {
  key: string;
  category: PreReleaseFormCategory;
  label: string;
  /** PLACEHOLDER field set — see the warning above. */
  fields: PreReleaseFieldDef[];
  /**
   * Release/consent forms have NO field set: they are captured as a real
   * ConsentRecord section. This is the category that must be authorized for
   * the task to count as complete.
   */
  consentCategory?: ConsentCategory;
  /** Transition planning is satisfied by the Reentry Care Plan record. */
  satisfiedByCarePlan?: boolean;
}

export const PRE_RELEASE_FORMS: PreReleaseFormDef[] = [
  {
    key: "ssapp",
    category: "medi_cal_enrollment",
    label: "SSApp (placeholder)",
    fields: [
      { key: "applicantName", label: "Applicant name", type: "text", required: true },
      { key: "ssnOnFile", label: "SSN on file", type: "bool" },
      { key: "countyOfResponsibility", label: "County of responsibility", type: "text" },
      { key: "submittedOn", label: "Submitted on", type: "date" },
    ],
  },
  {
    key: "pre_release_screening",
    category: "medi_cal_enrollment",
    label: "Pre-Release Screening Form (placeholder)",
    fields: [
      { key: "currentlyEnrolled", label: "Currently Medi-Cal enrolled", type: "bool" },
      { key: "cin", label: "CIN / member id", type: "text" },
      { key: "suspensionStatus", label: "Suspension status", type: "select", options: ["Unknown", "Suspended", "Active", "Terminated"] },
      { key: "anticipatedReleaseDate", label: "Anticipated release date", type: "date", required: true },
    ],
  },
  {
    key: "dhcs_hra",
    category: "clinical_assessment",
    label: "DHCS Health Risk Assessment (placeholder)",
    fields: [
      { key: "chronicConditions", label: "Chronic conditions (comma separated)", type: "text" },
      { key: "pregnancyFlag", label: "Pregnancy flag", type: "bool" },
      { key: "mobilityNeeds", label: "Mobility / DME needs noted", type: "bool" },
      { key: "riskTier", label: "Risk tier", type: "select", options: ["Low", "Moderate", "High"] },
    ],
  },
  {
    key: "bh_sud_loc",
    category: "clinical_assessment",
    label: "Behavioral Health / SUD Level of Care Screening (placeholder)",
    fields: [
      { key: "mhScreenPositive", label: "MH screen positive", type: "bool" },
      { key: "sudScreenPositive", label: "SUD screen positive", type: "bool" },
      { key: "matInPlace", label: "MAT in place at facility", type: "bool" },
      { key: "recommendedLoc", label: "Recommended level of care", type: "select", options: ["Outpatient", "Intensive outpatient", "Residential", "Withdrawal management"] },
    ],
  },
  {
    key: "informed_consent_prerelease",
    category: "release_consent",
    label: "Informed Consent for Pre-Release Services (placeholder)",
    fields: [],
    consentCategory: "pre_release_services",
  },
  {
    key: "telehealth_consent",
    category: "release_consent",
    label: "Telehealth Informed Consent (placeholder)",
    fields: [],
    consentCategory: "telehealth_services",
  },
  {
    key: "information_sharing_authorization",
    category: "release_consent",
    label: "Information Sharing / Disclosure Authorization (placeholder)",
    fields: [],
    consentCategory: "information_sharing_disclosure",
  },
  {
    key: "reentry_care_plan",
    category: "transition_planning",
    label: "Person-Centered Reentry Care Plan",
    fields: [],
    satisfiedByCarePlan: true,
  },
];

/** Who physically entered a row, and who the work is attributed to. */
export interface CfAttribution {
  /** The logged-in person keying the entry. */
  enteredBy: { staffId?: string; staffName: string; role: string };
  /**
   * The proxy-mode CF Care Manager the work belongs to, when `enteredBy` is
   * an ECM Provider entering on their behalf. Absent for direct-login CF
   * Care Managers, who are always their own author.
   */
  attributedTo?: { staffId: string; staffName: string };
}

/**
 * §Quality pass Group B — proxy vs direct is an AUDITED distinction.
 *
 * Before this pass, proxy entries were *attributed* (the record carried both
 * identities) and two of the three write paths logged an audit row, but the
 * row used the same `action` as a direct entry and carried only the CF Care
 * Manager's NAME. `saveReentryCarePlan` logged nothing at all. These helpers
 * make every CF write emit a distinctly-actioned event carrying both staff
 * IDs, through the same `appendAudit` stream everything else uses.
 */
export const cfEntryMode = (a: CfAttribution): "direct" | "proxy" =>
  a.attributedTo ? "proxy" : "direct";

/** `pre_release_form_saved` → `pre_release_form_saved_proxy`. */
export const cfAuditAction = (base: string, a: CfAttribution): string =>
  cfEntryMode(a) === "proxy" ? `${base}_proxy` : base;

/** Both identities, always — the acting person AND who the work belongs to. */
export function cfAuditIdentities(a: CfAttribution) {
  return {
    entryMode: cfEntryMode(a),
    proxyEntry: cfEntryMode(a) === "proxy",
    enteredByStaffId: a.enteredBy.staffId,
    enteredByStaffName: a.enteredBy.staffName,
    enteredByRole: a.enteredBy.role,
    onBehalfOfStaffId: a.attributedTo?.staffId,
    onBehalfOfStaffName: a.attributedTo?.staffName,
    // Kept for existing audit consumers that read the old key.
    attributedTo: a.attributedTo?.staffName,
  };
}

/**
 * Data-layer backstop for the direct-mode rule. Episode-local, so it needs no
 * roster import (roles.ts already imports this module): an entry is in scope
 * only when the acting person IS the episode's CF Care Manager, or is keying
 * it explicitly on that CF Care Manager's behalf. A self-attributed entry on
 * someone else's episode is refused and audited.
 */
function assertCfEntryScope(ep: PreReleaseEpisode, a: CfAttribution, what: string) {
  const owner = ep.cfCareManagerStaffId;
  const isOwner = Boolean(a.enteredBy.staffId) && a.enteredBy.staffId === owner;
  if (isOwner || a.attributedTo?.staffId === owner) return;
  appendAudit({
    category: "clinical",
    action: "cf_proxy_entry_denied",
    patientId: ep.patientId,
    actorId: a.enteredBy.staffName,
    actorRole: a.enteredBy.role,
    detail: {
      episodeId: ep.id,
      target: what,
      ...cfAuditIdentities(a),
      episodeCfStaffId: owner,
      episodeCfStaffName: ep.cfCareManagerName,
      reason: "not_owner_and_not_proxied",
    },
  });
  throw new Error(
    `${ep.cfCareManagerName} owns this pre-release episode. Their activity can only be entered by them, or proxy-entered when they are not a platform user.`,
  );
}

export type PreReleaseEpisodeStatus = "open" | "released" | "closed";

export interface PreReleaseEpisode {
  id: string;
  patientId: string;
  /** Real `Facility.id` when known. */
  facilityId?: string;
  facilityName?: string;
  /** Real `Booking.id` when the episode is tied to a custody booking. */
  bookingId?: string;
  anticipatedReleaseDate: string;
  /** The CF Care Manager (direct or proxy) who owns the list. */
  cfCareManagerStaffId: string;
  cfCareManagerName: string;
  /** The receiving ECM Provider, if already assigned. */
  receivingEcmStaffId?: string;
  status: PreReleaseEpisodeStatus;
  openedAt: string;
  openedBy: string;
  closedAt?: string;
  closedReason?: string;
}

export type PreReleaseFormStatus = "not_started" | "in_progress" | "complete";

export interface PreReleaseFormRecord {
  id: string;
  episodeId: string;
  patientId: string;
  category: PreReleaseFormCategory;
  formKey: string;
  /** Structured field capture only. Never narrative clinical documentation. */
  values: Record<string, string | boolean>;
  status: PreReleaseFormStatus;
  updatedAt: string;
  completedAt?: string;
  attribution: CfAttribution;
  /** The CaseTask row that tracks this form on the worklist. */
  taskId?: string;
}

export type ReentryAppointmentKind = "mental_health" | "med_management" | "sud";

/**
 * A real scheduled first appointment, not a referral placeholder. `apptId`
 * links to a live `Appointment` when one exists in this system; when the
 * appointment lives at an external partner the concrete date/time/contact is
 * still required.
 */
export interface ReentryAppointment {
  id: string;
  kind: ReentryAppointmentKind;
  apptId?: string;
  start: string;
  providerName: string;
  location: string;
  phone?: string;
  modality: "in_person" | "video" | "phone";
}

export interface ReentryCarePlan {
  id: string;
  episodeId: string;
  patientId: string;
  housing: {
    arrangement: string;
    address?: string;
    contactName?: string;
    contactPhone?: string;
    moveInDate?: string;
  };
  appointments: ReentryAppointment[];
  pharmacy?: { name: string; phone?: string; address?: string; deliveryArranged?: boolean };
  dmeNeeds: string[];
  notesToEcm?: string;
  status: "draft" | "completed";
  /**
   * Member attestation. Same typed-name + checkbox pattern used by
   * ConsentRecord, MAR and order signing — deliberately not a new mechanism.
   */
  memberSignature?: {
    name: string;
    relationship: "patient" | "guardian" | "proxy";
    attestationMethod: "checkbox_only";
    signedAt: string;
  };
  completedAt?: string;
  attribution: CfAttribution;
  /** Set at completion — see `EnrollmentCode`. */
  enrollmentCode?: string;
  updatedAt: string;
}

/**
 * §Enrollment / claim code — the identity-verification token a released
 * member presents to the receiving ECM Provider.
 *
 * Format: `RE-XXXX-XXXX` over a Crockford-style alphabet with I/L/O/U removed
 * so it survives being read aloud or handwritten on a discharge sheet.
 * SINGLE-USE **and** time-bounded (90 days from issue): single-use because it
 * proves one enrollment hand-off, time-bounded because an unclaimed code from
 * a release a year ago should not still verify identity. Consumption is a
 * later phase; `consumedAt` exists now so that phase has nothing to migrate.
 */
export interface EnrollmentCode {
  code: string;
  patientId: string;
  episodeId: string;
  carePlanId: string;
  issuedAt: string;
  expiresAt: string;
  consumedAt?: string;
  consumedBy?: string;
}

export interface PatientTask {
  id: string;
  kind: "rescreen" | "enrollment_assist" | "reactivation";
  label: string;
  screenerKey?: string;
  createdAt: string;
  completedAt?: string;
}

export type ApptNotificationKind =
  | "booked"
  | "rescheduled"
  | "cancelled"
  | "confirmed"
  /** Pre-visit reminder for any upcoming contact (1:1 appointment or group occurrence). */
  | "reminder";
export type CommsChannel = "profile" | "sms" | "email";
export type NotificationState = "queued" | "sent" | "delivered" | "failed";
export interface ApptNotification {
  id: string;
  apptId: string;
  kind: ApptNotificationKind;
  at: string;
  channel: CommsChannel;
  state: NotificationState;
  sentAt?: string;
  deliveredAt?: string;
  error?: string;
}

// ---------- Case Manager task queue ----------

export type CaseTaskStatus = "open" | "done" | "snoozed";

/**
 * §Worklist Phase A — operational priority. Distinct from `CaseTaskStatus`
 * (the CM queue's open/done/snoozed lifecycle) on purpose: see
 * `WorklistStatus` below for how the two are kept consistent.
 */
export type TaskPriority = "stat" | "urgent" | "routine";

/**
 * §Worklist Phase A — the richer cross-facility status the worklist shows.
 *
 * MIGRATION: this field is OPTIONAL and every read goes through
 * `worklistStatusFor(task)`, which derives a value from the pre-existing
 * `status` / `completedAt` state when it is unset:
 *   status "done" (or a completedAt timestamp) -> "completed"
 *   claimedBy set                              -> "in_progress"
 *   otherwise                                  -> "pending"
 * Nothing back-fills stored rows, so existing CaseTask consumers keep reading
 * `status` exactly as before. "cancelled" and "missed" have no legacy
 * equivalent and are only ever set explicitly.
 */
export type WorklistStatus = "pending" | "in_progress" | "completed" | "cancelled" | "missed";

export type CaseTaskOrigin =
  | "manual"
  | "missed_appt"
  | "screener_flag"
  | "referral_stale"
  | "notification_failed"
  | "provider_switch"
  /** §Phase 3c — created by a note template automation at sign time. */
  | "note_automation";

export interface CaseTask {
  id: string;
  patientId: string;
  assignedTo: string; // caseManagerId
  title: string;
  detail?: string;
  dueDate: string; // ISO date (YYYY-MM-DD) or ISO string
  status: CaseTaskStatus;
  origin: CaseTaskOrigin;
  createdAt: string;
  completedAt?: string;
  snoozedUntil?: string;
  /** Idempotency key so auto-generation doesn't duplicate. */
  dedupeKey?: string;
  /**
   * §Phase 3c provenance. Present only on automation-created tasks so the UI
   * can always say WHICH note produced this work and link back to it.
   */
  sourceNoteId?: string;
  sourceAutomationId?: string;
  /** Template title of the source note, for "Auto-created from …". */
  sourceTemplateTitle?: string;
  /** Defaults to "routine" everywhere it is read (see `taskPriority`). */
  priority?: TaskPriority;
  // ----- §Worklist Phase A (all optional; legacy rows read fine without them) -----
  worklistStatus?: WorklistStatus;
  /** Freeform kind, e.g. "med_pass", "intake_packet". Facets derive from use. */
  taskType?: string;
  /**
   * Which Adelante roles this task is relevant to. Undefined/empty means
   * "no discipline restriction" — deliberately NOT a separate discipline
   * taxonomy; this is the real `StaffRole` set.
   */
  allowedRoles?: StaffRole[];
  /** Real Facility entity id (see `listFacilities`). */
  facilityId?: string;
  housingUnit?: string;
  /**
   * Pool claim. Independent of `assignedTo` (direct assignment): a task can be
   * directly assigned OR left open to a role pool and claimed.
   */
  claimedBy?: string;
  claimedAt?: string;
  /** Provenance, e.g. "manual" or "note_automation". */
  source?: string;
  // ----- §Worklist Phase B (protocol rounds; absent on every other task) -----
  protocolInstanceId?: string;
  /** 1-based round index within the instance. */
  roundNumber?: number;
  /**
   * §Facility & Custody reorg — additive tag ONLY. True when the task was
   * created while the patient was in an open booking episode, so facility
   * work (e.g. CIWA/COWS rounds on a booked patient) can be filtered out of
   * the general worklist without a parallel task system. Nothing about how
   * rounds are generated or scheduled depends on it.
   */
  facilityContext?: boolean;
  /** The scored NoteTemplate this round is documented on. */
  templateId?: string;
  // ----- §Scheduling rule engine (manual run; absent on every other task) ----
  /** The `SchedulingRule` that generated this row. Also the idempotency key. */
  sourceRuleId?: string;
}

/**
 * §Scheduling rule engine — manually triggered ("Run rules now"), never a
 * background job: there is no backend scheduler in this app, and the
 * reference EMR also exposes this as a supervisor-triggered action.
 *
 * `match` is a small set of structured AND-matchers over patient/order/problem
 * attributes. It is deliberately NOT the note-template scoring engine's
 * `evalExpr`: that engine evaluates per-note field answers, a different data
 * shape entirely, and force-fitting it here would buy a general expression
 * language nobody asked for.
 */
export interface SchedulingRule {
  id: string;
  key: string;
  label: string;
  description?: string;
  /** Matches existing Worklist task-type conventions (see `worklistTaskTypes`). */
  taskType: string;
  match: {
    activeProblemCategory?: string;
    activeOrderFrequencyCode?: string;
  };
  /** Task cadence AND the idempotency window — see `runSchedulingRulesNow`. */
  cadenceMinutes: number;
  allowedRoles?: StaffRole[];
  priority: TaskPriority;
  active: boolean;
  createdBy: string;
  createdAt: string;
  deactivatedBy?: string;
  deactivatedAt?: string;
  deactivationReason?: string;
}

/**
 * §Worklist Phase B — protocol scheduling (CIWA/COWS/safety-cell rounds).
 *
 * A protocol is a SCHEDULING mechanism only: no clinical content lives here.
 * The round's actual content is a scored `NoteTemplate` authored in the
 * template builder, referenced by `templateId`. Rounds are pre-scheduled up
 * front (there is no backend scheduler in this app), and alerting is NOT
 * re-implemented: a round is completed by signing its scored note, so the
 * existing Phase 3c crisis-band gate in `signProgressNote` is the one and
 * only escalation path.
 */
export interface ProtocolInstance {
  id: string;
  patientId: string;
  /** Free-text label, e.g. "CIWA-Ar". A name, not clinical content. */
  protocolKey: string;
  /** Must reference an active, scored NoteTemplate. */
  templateId: string;
  startedBy: string;
  startedAt: string;
  cadenceMinutes: number;
  totalRounds: number;
  status: "active" | "completed" | "stopped";
  stoppedBy?: string;
  stoppedAt?: string;
  stopReason?: string;
}

/** Priority with the documented "routine" default applied. */
export function taskPriority(t: CaseTask): TaskPriority {
  return t.priority ?? "routine";
}

/** Worklist status, derived from legacy state when unset. See `WorklistStatus`. */
export function worklistStatusFor(t: CaseTask): WorklistStatus {
  if (t.worklistStatus) return t.worklistStatus;
  if (t.status === "done" || t.completedAt) return "completed";
  if (t.claimedBy) return "in_progress";
  return "pending";
}

/**
 * §Phase 3c run log. One row per (noteId, automationId) that has ever fired.
 * Checked BEFORE firing, so an automation can never run twice for the same
 * note even if the note is somehow re-signed.
 */
export interface NoteAutomationRun {
  noteId: string;
  automationId: string;
  patientId: string;
  ranAt: string;
  /** What the run produced, for the audit trail. */
  resultKind: "case_task" | "draft_note" | "skipped";
  resultId?: string;
  /** Populated when resultKind is "skipped". */
  skipReason?: string;
}

export interface AvailabilitySlot {
  start: string; // ISO
  durationMin: number;
  taken: boolean;
}

// ---------- mock store ----------

const uid = () => Math.random().toString(36).slice(2, 10);

const clinicians: Clinician[] = [
  {
    id: "c1",
    name: "Dr. Marisol Reyes",
    credential: "LCSW",
    mediCalCredentialed: true,
    mediCalStatus: "active",
    services: [
      "intake",
      "therapy_individual",
      "therapy_group",
      "case_management",
      "care_coordination",
    ],
    locationIds: ["loc-visalia", "loc-porterville"],
    licenseExpiresOn: "2026-08-15",
  },
  {
    id: "c2",
    name: "Dr. James Okafor",
    credential: "PsyD",
    mediCalCredentialed: true,
    mediCalStatus: "active",
    services: ["therapy_individual", "med_management", "intake"],
    locationIds: ["loc-visalia"],
    licenseExpiresOn: "2027-06-30",
  },
  {
    id: "c3",
    name: "Anita Brooks",
    credential: "LMFT",
    mediCalCredentialed: false,
    mediCalStatus: "pending",
    services: ["therapy_individual", "peer_support", "case_management"],
    locationIds: ["loc-porterville"],
    licenseExpiresOn: "2027-12-31",
  },
];

const patients: Patient[] = [
  {
    id: "p1",
    programId: "ADL-2026-001",
    firstName: "Daniel",
    lastName: "M.",
    dob: "1989-04-12",
    phone: "+15595550101",
    email: "daniel.m@example.com",
    releaseDate: "2026-05-10",
    enrolledAt: "2026-05-12",
    episodeDay: 23,
    smsFallback: true,
    consents: { hipaa: true, part2Sud: true, signedAt: "2026-05-12" },
    screeners: {
      "phq-9": { key: "phq-9", score: 14, severity: "Moderate", completedAt: "2026-05-12" },
      "gad-7": { key: "gad-7", score: 11, severity: "Moderate", completedAt: "2026-05-12" },
    },
    needs: { housing: true, food: false, employment: true, transport: true, family: true },
    carePlanSummary: "Weekly therapy with Dr. Reyes; housing navigator referral pending.",
    intakeCompletedAt: "2026-05-12",
    coverage: {
      status: "active",
      verified: "verified",
      countyOfRelease: "Tulare",
      jiReentryFlag: true,
      ecmEligible: true,
    },
    caseManagerId: "cm1",
    screenerHistory: [
      {
        key: "phq-9",
        score: 18,
        severity: "Moderately Severe",
        completedAt: "2026-05-12",
        timepoint: "intake",
      },
      {
        key: "phq-9",
        score: 14,
        severity: "Moderate",
        completedAt: "2026-06-11",
        timepoint: "day30",
      },
      {
        key: "gad-7",
        score: 13,
        severity: "Moderate",
        completedAt: "2026-05-12",
        timepoint: "intake",
      },
      {
        key: "gad-7",
        score: 11,
        severity: "Moderate",
        completedAt: "2026-06-11",
        timepoint: "day30",
      },
    ],
    goals: [
      {
        id: "g1",
        text: "Attend weekly therapy sessions",
        status: "in_progress",
        createdAt: "2026-05-12",
      },
      {
        id: "g2",
        text: "Secure stable housing within 60 days",
        status: "open",
        createdAt: "2026-05-12",
      },
      {
        id: "g3",
        text: "Reconnect with one supportive family member",
        status: "done",
        createdAt: "2026-05-12",
      },
    ],
    progressNotes: [
      {
        id: "n1",
        clinicianId: "c1",
        date: "2026-06-04",
        sessionType: "individual",
        subjective: "Daniel reports lower mood this week tied to housing stress.",
        objective: "Engaged, oriented x3. PHQ-9 14 (down from 18).",
        assessment: "Moderate depression, improving. Active housing stressor.",
        plan: "Continue weekly CBT; coordinate with housing navigator.",
      },
    ],
    problems: [
      {
        id: "prb-p1-1",
        patientId: "p1",
        icd10Code: "F33.1",
        description: "Major depressive disorder, recurrent, moderate",
        status: "active",
        category: "mental_health",
        priority: 1,
        onsetDate: "2024-08-01",
        enteredBy: "therapist",
        createdAt: "2026-05-12T15:00:00.000Z",
        clinicianComment: "Improving with weekly CBT; PHQ-9 trending down.",
      },
      {
        id: "prb-p1-2",
        patientId: "p1",
        icd10Code: "F41.1",
        description: "Generalized anxiety disorder",
        status: "active",
        category: "mental_health",
        priority: 2,
        onsetDate: "2025-01-15",
        enteredBy: "therapist",
        createdAt: "2026-05-12T15:05:00.000Z",
      },
      {
        id: "prb-p1-3",
        patientId: "p1",
        icd10Code: "I10",
        description: "Essential (primary) hypertension",
        status: "resolved",
        category: "medical",
        onsetDate: "2023-03-01",
        resolvedDate: "2026-05-01",
        resolvedBy: "pmhnp",
        enteredBy: "pmhnp",
        createdAt: "2026-05-12T15:10:00.000Z",
      },
    ],
    allergies: [
      {
        id: "alg-p1-1",
        patientId: "p1",
        substance: "Penicillin",
        reaction: "Hives, facial swelling",
        severity: "severe",
        active: true,
        enteredBy: "pmhnp",
        enteredAt: "2026-05-12T15:15:00.000Z",
      },
    ],
    alerts: [
      {
        id: "alt-p1-1",
        patientId: "p1",
        label: "Housing instability",
        severity: "warning",
        notes: "At risk of losing transitional housing placement.",
        active: true,
        enteredBy: "ecm_provider",
        enteredAt: "2026-06-01T10:00:00.000Z",
      },
    ],
  },
  {
    id: "p2",
    programId: "ADL-2026-002",
    firstName: "Rosa",
    lastName: "T.",
    dob: "1995-09-03",
    phone: "+15595550102",
    releaseDate: "2026-05-22",
    enrolledAt: "2026-05-24",
    episodeDay: 11,
    smsFallback: false,
    consents: { hipaa: true, part2Sud: false },
    screeners: {
      "phq-9": { key: "phq-9", score: 8, severity: "Mild", completedAt: "2026-05-24" },
    },
    needs: { housing: false, food: true, employment: true, transport: false },
    carePlanSummary: "Biweekly check-ins; CalFresh enrollment in progress.",
    coverage: {
      status: "suspended",
      verified: "pending",
      countyOfRelease: "Tulare",
      jiReentryFlag: true,
    },
    caseManagerId: "cm1",
    problems: [
      {
        id: "prb-p2-1",
        patientId: "p2",
        icd10Code: "F32.0",
        description: "Major depressive disorder, single episode, mild",
        status: "active",
        category: "mental_health",
        priority: 1,
        onsetDate: "2026-04-01",
        enteredBy: "therapist",
        createdAt: "2026-05-24T14:00:00.000Z",
      },
    ],
    allergies: [
      {
        id: "alg-p2-1",
        patientId: "p2",
        substance: "NKDA",
        reaction: "No known drug allergies",
        severity: "mild",
        active: true,
        enteredBy: "pmhnp",
        enteredAt: "2026-05-24T14:05:00.000Z",
      },
    ],
    alerts: [],
  },
  {
    id: "p3",
    programId: "ADL-2026-003",
    firstName: "Marcus",
    lastName: "L.",
    dob: "1978-12-30",
    phone: "+15595550103",
    releaseDate: "2026-04-02",
    enrolledAt: "2026-04-05",
    episodeDay: 60,
    smsFallback: false,
    consents: { hipaa: true, part2Sud: true, signedAt: "2026-04-05" },
    screeners: {
      "phq-9": {
        key: "phq-9",
        score: 18,
        severity: "Moderately Severe",
        completedAt: "2026-04-05",
      },
      audit: { key: "audit", score: 16, severity: "High risk", completedAt: "2026-04-05" },
    },
    needs: {
      housing: true,
      food: true,
      employment: true,
      transport: true,
      substanceUse: true,
      benefits: true,
    },
    carePlanSummary: "Co-occurring SUD + depression; weekly sessions + peer support.",
    intakeCompletedAt: "2026-04-05",
    coverage: {
      status: "active",
      verified: "verified",
      countyOfRelease: "Tulare",
      jiReentryFlag: true,
      ecmEligible: true,
    },
    caseManagerId: "cm2",
    screenerHistory: [
      {
        key: "phq-9",
        score: 22,
        severity: "Severe",
        completedAt: "2026-04-05",
        timepoint: "intake",
      },
      {
        key: "phq-9",
        score: 18,
        severity: "Moderately Severe",
        completedAt: "2026-05-05",
        timepoint: "day30",
      },
      {
        key: "phq-9",
        score: 14,
        severity: "Moderate",
        completedAt: "2026-06-04",
        timepoint: "day60",
      },
    ],
    // §3a — co-occurring: Marcus carries both a mental-health and a SUD/DMC-ODS episode.
    episodes: [
      { id: "ep-p3-mh", type: "mental_health", state: "active", openedAt: "2026-04-05" },
      { id: "ep-p3-sud", type: "sud_dmc_ods", state: "engaged", openedAt: "2026-04-05" },
    ],
    problems: [
      {
        id: "prb-p3-1",
        patientId: "p3",
        icd10Code: "F11.20",
        description: "Opioid use disorder, moderate",
        status: "active",
        category: "sud",
        priority: 1,
        onsetDate: "2020-06-01",
        enteredBy: "pmhnp",
        createdAt: "2026-04-05T16:00:00.000Z",
        clinicianComment: "On buprenorphine 16mg daily; stable.",
      },
      {
        id: "prb-p3-2",
        patientId: "p3",
        icd10Code: "F10.20",
        description: "Alcohol use disorder, moderate",
        status: "active",
        category: "sud",
        priority: 2,
        onsetDate: "2019-01-01",
        enteredBy: "pmhnp",
        createdAt: "2026-04-05T16:05:00.000Z",
      },
      {
        id: "prb-p3-3",
        patientId: "p3",
        icd10Code: "F33.2",
        description: "Major depressive disorder, recurrent, severe without psychotic features",
        status: "active",
        category: "mental_health",
        priority: 3,
        onsetDate: "2022-11-01",
        enteredBy: "therapist",
        createdAt: "2026-04-05T16:10:00.000Z",
      },
      {
        id: "prb-p3-4",
        patientId: "p3",
        icd10Code: "F43.10",
        description: "Post-traumatic stress disorder, unspecified",
        status: "active",
        category: "mental_health",
        priority: 4,
        onsetDate: "2021-03-01",
        enteredBy: "therapist",
        createdAt: "2026-04-05T16:15:00.000Z",
      },
    ],
    allergies: [
      {
        id: "alg-p3-1",
        patientId: "p3",
        substance: "Sulfa drugs",
        reaction: "Rash",
        severity: "moderate",
        active: true,
        enteredBy: "pmhnp",
        enteredAt: "2026-04-05T16:20:00.000Z",
      },
      {
        id: "alg-p3-2",
        patientId: "p3",
        substance: "Latex",
        reaction: "Contact dermatitis",
        severity: "mild",
        active: true,
        enteredBy: "pmhnp",
        enteredAt: "2026-04-05T16:22:00.000Z",
      },
    ],
    alerts: [
      {
        id: "alt-p3-1",
        patientId: "p3",
        label: "Suicide risk — prior attempt",
        severity: "critical",
        notes: "History of attempt 2023. Safety plan on file; check at every visit.",
        active: true,
        enteredBy: "therapist",
        enteredAt: "2026-04-05T16:30:00.000Z",
      },
      {
        id: "alt-p3-2",
        patientId: "p3",
        label: "Overdose risk — naloxone dispensed",
        severity: "warning",
        notes: "Patient and family trained on naloxone administration.",
        active: true,
        enteredBy: "pmhnp",
        enteredAt: "2026-04-05T16:32:00.000Z",
      },
      {
        id: "alt-p3-3",
        patientId: "p3",
        label: "Fall risk",
        severity: "info",
        active: true,
        enteredBy: "pmhnp",
        enteredAt: "2026-04-05T16:34:00.000Z",
      },
    ],
  },
];

const today = new Date();
const inHours = (h: number) => new Date(today.getTime() + h * 3600 * 1000).toISOString();
const ago = (h: number) => new Date(today.getTime() - h * 3600 * 1000).toISOString();

const appointments: Appointment[] = [
  {
    id: "a1",
    patientId: "p1",
    clinicianId: "c1",
    start: inHours(26),
    durationMin: 50,
    status: "scheduled",
    billingStatus: "draft",
  },
  {
    id: "a2",
    patientId: "p1",
    clinicianId: "c1",
    start: ago(72),
    durationMin: 50,
    status: "attended",
    billingStatus: "submitted",
  },
  {
    id: "a3",
    patientId: "p2",
    clinicianId: "c2",
    start: inHours(4),
    durationMin: 50,
    status: "scheduled",
    billingStatus: "draft",
  },
  {
    id: "a4",
    patientId: "p3",
    clinicianId: "c1",
    start: ago(48),
    durationMin: 50,
    status: "no_show",
    billingStatus: "draft",
  },
  {
    id: "a5",
    patientId: "p3",
    clinicianId: "c1",
    start: ago(240),
    durationMin: 50,
    status: "attended",
    billingStatus: "paid",
  },
  {
    id: "a6",
    patientId: "p2",
    clinicianId: "c2",
    start: ago(120),
    durationMin: 50,
    status: "attended",
    billingStatus: "denied",
  },
];

const referrals: Referral[] = [
  {
    id: "r1",
    firstName: "Daniel",
    lastName: "M.",
    dob: "1989-04-12",
    phone: "+15595550101",
    releaseDate: "2026-05-10",
    referringAgency: "Tulare County Probation",
    referrerName: "Officer Hernandez",
    referralSource: "probation",
    countyOfRelease: "Tulare",
    consentToContact: true,
    status: "enrolled",
    createdAt: ago(72 * 24),
    smsSentAt: ago(72 * 24 - 0.05),
  },
  {
    id: "r2",
    firstName: "Sasha",
    lastName: "K.",
    dob: "1992-02-18",
    phone: "+15595550110",
    releaseDate: "2026-06-01",
    referringAgency: "Drug Court",
    referrerName: "CM. Patel",
    referralSource: "drug_court",
    countyOfRelease: "Kings",
    consentToContact: true,
    status: "contacted",
    createdAt: ago(48),
    smsSentAt: ago(48 - 0.05),
  },
  {
    id: "r3",
    firstName: "Eli",
    lastName: "B.",
    dob: "1985-07-22",
    phone: "+15595550120",
    releaseDate: "2026-06-04",
    referringAgency: "Parole",
    referrerName: "Agent Yu",
    referralSource: "parole",
    countyOfRelease: "Tulare",
    consentToContact: true,
    status: "submitted",
    createdAt: ago(2),
    smsSentAt: ago(2 - 0.05),
  },
];

const caseManagers: CaseManager[] = [
  { id: "cm1", name: "Lupita Sanchez, MSW", role: "ecm_provider" },
  { id: "cm2", name: "Trey Wilson", role: "peer_support" },
];

type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};

// Session: which patient is "logged in" for the demo. Defaults to a patient
// who has not yet completed intake so the first-time flow is visible.
let currentPatientId = "p2";

// Global case-task queue (across patients). Kept separately from Patient.tasks
// (which is a legacy per-patient action list) so CM views can index by
// assignee, status, and due date without walking every patient.
const caseTasks: CaseTask[] = [];

// §Worklist Phase B — protocol instances (rounds live in `caseTasks`).
const protocolInstances: ProtocolInstance[] = [];

// §Phase 3c automation run log. Append-only; the ONLY thing that decides
// whether an automation may fire. Keyed by (noteId, automationId).
const noteAutomationRuns: NoteAutomationRun[] = [];

// §Notification feed — top-level, keyed to a staff identity (not a patient
// record), because a notification belongs to a person's worklist.
const notifications: AppNotification[] = [];
// §Inbox — provider requests live cross-patient (like tasks/notifications),
// not on the Patient record: the queue is the primary surface.
const providerRequests: ProviderRequest[] = [];
// Two demo rows so the queue isn't an empty shell on first load.
if (patients[0]) {
  providerRequests.push({
    id: "pr-demo-1",
    patientId: patients[0].id,
    requestType: "order_entry",
    context: "Please enter the sertraline 50 mg refill we discussed at today's check-in.",
    requestedBy: "Luz Herrera",
    requestedByRole: "ecm_provider",
    status: "open",
    createdAt: ago(30),
  });
}
if (patients[1]) {
  providerRequests.push({
    id: "pr-demo-2",
    patientId: patients[1].id,
    requestType: "question",
    context: "Is the patient cleared to restart group therapy this week?",
    requestedBy: "Dr. R. Bagga",
    requestedByRole: "pmhnp",
    status: "open",
    createdAt: ago(90),
  });
}

/** Display name for notification copy. Never used for access control. */
function patientLabel(patientId?: string): string {
  const p = patients.find((x) => x.id === patientId);
  return p ? `${p.firstName} ${p.lastName}` : "a patient";
}

/**
 * Write-level `patient_messaging` roles, mirrored from the RBAC matrix in
 * `roles.ts`. Duplicated as a value here only because `ehr.ts` may import
 * `roles.ts` for TYPES only (roles.ts imports ehr.ts at runtime).
 */
export const MESSAGE_SUD_FLAG_ROLES: StaffRole[] = ["ecm_provider", "therapist", "pmhnp"];

/**
 * §Part 2 backstop selection — DERIVED from the RBAC matrix, never hardcoded.
 *
 * A backstop must satisfy two conditions at once:
 *  1. it can actually work the message thread (write-level `patient_messaging`,
 *     i.e. it is in MESSAGE_SUD_FLAG_ROLES), and
 *  2. `canAccess(role, "screeners_sud", patient)` is NOT locked for THIS
 *     patient — the same single check that does the masking.
 *
 * Reading condition 2 from `canAccess` (rather than naming therapist/pmhnp
 * inline) means the confirmed policy — therapist and pmhnp un-gated as direct
 * treating clinicians, ecm_provider/peer_specialist consent-gated because
 * coordination is not treatment — stays the single source of truth. Flip a
 * cell in the matrix and backstop selection follows automatically.
 */
function pickSudBackstopRole(patient: Patient, excludeRole?: StaffRole): StaffRole | undefined {
  return MESSAGE_SUD_FLAG_ROLES.find(
    (r) => r !== excludeRole && !canAccess(r, "screeners_sud", patient).locked,
  );
}

function setCareMessageSudFlag(
  patientId: string,
  messageId: string,
  staffName: string,
  role: StaffRole | undefined,
  flagged: boolean,
): boolean {
  if (role && !MESSAGE_SUD_FLAG_ROLES.includes(role)) return false;
  const p = patients.find((x) => x.id === patientId);
  const msg = p?.careMessages?.find((m) => m.id === messageId);
  if (!msg) return false;
  if (Boolean(msg.sudFlagged) === flagged) return true;
  msg.sudFlagged = flagged;
  msg.sudFlaggedBy = staffName;
  msg.sudFlaggedAt = new Date().toISOString();
  // A staff override replaces the provenance: it is now a reviewer decision.
  msg.sudFlaggedByPatient = undefined;
  appendAudit({
    category: "access",
    action: flagged ? "care_message_sud_flagged" : "care_message_sud_unflagged",
    patientId,
    actorId: staffName,
    detail: { messageId, authorType: msg.authorType, role },
  });
  // §Retroactive-flag blind-spot safety net (mirror of the self-flag backstop
  // in `sendPatientMessage`). Flagging is the only direction that can REMOVE
  // visibility, so nothing fires on unflag. When the case manager is gated for
  // this patient's SUD content, tell them their view changed (distinct copy —
  // this is a visibility change, not new content) and alert an un-gated role
  // so a genuinely authorized reader knows.
  if (flagged && canAccess("ecm_provider", "screeners_sud", p).locked) {
    const cmName = caseManagers.find((c) => c.id === p!.caseManagerId)?.name;
    // Don't tell the flagger they can no longer see what they just flagged.
    if (cmName !== staffName) {
      AdelanteEHR.notify({
        recipientStaffId: cmName || undefined,
        recipientRole: cmName ? undefined : "ecm_provider",
        category: "patient_message",
        subject: `Message visibility changed — ${patientLabel(patientId)}`,
        body: `A message for ${patientLabel(patientId)} was flagged for Part 2 protection and may no longer be visible to you.`,
        linkRoute: "/record/$patientId",
        linkParams: { patientId, section: "messages" },
        patientId,
      });
    }
    const backstop = pickSudBackstopRole(p!, role);
    if (backstop) {
      AdelanteEHR.notify({
        recipientRole: backstop,
        category: "patient_message",
        subject: `New message — ${patientLabel(patientId)}`,
        body: "A patient sent a message to their care team.",
        linkRoute: "/record/$patientId",
        linkParams: { patientId, section: "messages" },
        patientId,
      });
    }
  }
  emit();
  return true;
}

// ---------------------------------------------------------------------------
// §Risk-text translation governance.
//
// A draft translation (es-v1-draft) is only promoted to a reviewed version
// (es-v1) after BOTH required clinical sign-offs are recorded. Sign-offs are
// per-language, append-only in the audit trail, and revocable (which demotes
// the language back to draft). Already-created RefusalForms are NEVER
// retro-edited: their snapshot, version, and English snapshot are frozen at
// creation, which is the whole point of snapshotting a legal disclosure.
// ---------------------------------------------------------------------------

export interface RiskTextSignoff {
  role: RiskTextReviewerRole;
  reviewerName: string;
  signedAt: string;
  note?: string;
}

export interface RiskTextReview {
  language: string;
  languageLabel: string;
  draftVersion: string;
  /** Version presented on new forms — the draft until both sign-offs land. */
  effectiveVersion: string;
  status: "draft" | "approved";
  signoffs: RiskTextSignoff[];
  approvedAt?: string;
  /** Free-text reason recorded when an approval is revoked. */
  revokedReason?: string;
  revokedAt?: string;
  revokedBy?: string;
}

const riskTextReviews: RiskTextReview[] = [
  {
    language: "es",
    languageLabel: "Spanish",
    draftVersion: RISK_TEXT_CATALOG_ES["*"].version,
    effectiveVersion: RISK_TEXT_CATALOG_ES["*"].version,
    status: "draft",
    signoffs: [],
  },
];

const riskTextApprovalLookup = () => ({
  approvedLanguages: riskTextReviews.filter((r) => r.status === "approved").map((r) => r.language),
});

// Vendor adapters (telehealth video + eRx medication management). Kept
// behind AdelanteEHR helpers so UI code never talks to vendors directly.
import { vendors as _vendors } from "./vendors";
import {
  frequencyByCode,
  listFrequencies,
  putFrequency,
  dropFrequency,
  type MedFrequency,
} from "./frequencies";
import type { CatalogSuppression } from "./catalogSuppressions";
export type { CatalogSuppression } from "./catalogSuppressions";

/** §Admin governance — local RxNav suppression rules (seeded empty). */
const catalogSuppressions: CatalogSuppression[] = [];

/**
 * §Scheduling rule engine — admin-owned registry. Seeded with one operational
 * rule so the admin page and the "Run rules now" action are exercisable; it
 * carries no clinical content, only a cadence and a task type.
 */
const schedulingRules: SchedulingRule[] = [
  {
    id: "rule-mh-checkin",
    key: "mh_weekly_checkin",
    label: "Weekly check-in — active mental health problem",
    description:
      "Generates a routine coordination check-in for every patient carrying an active mental health problem.",
    taskType: "coordination",
    match: { activeProblemCategory: "mental_health" },
    cadenceMinutes: 7 * 24 * 60,
    priority: "routine",
    active: true,
    createdBy: "Christi Ruiz",
    createdAt: "2026-01-05T16:00:00.000Z",
  },
];
import { facilityDateKey, fromFacilityWallClock, waitLabel } from "./facilityTime";
import {
  RISK_TEXT_CATALOG,
  capacityFlagsFrom,
  isMinorPatient,
  medClassGuess,
  refusalFinalizeProblems,
  riskTextFor,
  validateEscalationTime,
  witnessRequiredFor,
  ESCALATION_REFUSAL_THRESHOLD,
  ESCALATION_WINDOW_DAYS,
  REQUIRED_RISK_TEXT_REVIEWER_ROLES,
  RISK_TEXT_CATALOG_ES,
  PROMOTED_RISK_TEXT_VERSION,
  type RefusalFinalizePayload,
  type RiskTextReviewerRole,
} from "./refusal";

// ---------------------------------------------------------------------------
// DEMO SEED — refusal walkthrough patient (§MAR Phase 3).
// A signed psychiatric order with one dose already charted as REFUSED plus the
// matching pending refusal document, so the RefusalFormDialog (SignaturePad,
// witness branch, escalation) can be exercised end-to-end without first
// running a MAR pass. Remove alongside the rest of the mock store when the
// real persistence layer lands.
// ---------------------------------------------------------------------------
{
  const facilityDayAt = (hour: number, daysAgo = 0) => {
    const d = new Date(today.getTime() - daysAgo * 86400000);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  const startDate = new Date(today.getTime() - 6 * 86400000).toISOString().slice(0, 10);
  const order: MedOrder = {
    id: "ord-demo-refusal",
    patientId: "p-demo-refusal",
    drugName: "Sertraline",
    productName: "Sertraline 50 MG Oral Tablet",
    rxcui: "312940",
    strengthText: "50 MG",
    strengthSource: "rxnav",
    doseForm: "Oral Tablet",
    ingredientNames: ["Sertraline"],
    doseAxis: "mg",
    doseTargetMg: 50,
    unitsPerAdmin: 1,
    route: "PO",
    frequency: "once daily",
    frequencyCode: "QD",
    durationValue: 30,
    durationUnit: "days",
    quantity: 30,
    daysSupply: 30,
    sig: "Take 1 tablet (50 mg) by mouth once daily",
    dispenseRoute: "pharmacy",
    indicationText: "Major depressive disorder",
    startDate,
    status: "signed",
    attestedBy: "Dr. James Okafor",
    attestedAt: facilityDayAt(9, 6),
    createdBy: "Dr. James Okafor",
    createdAt: facilityDayAt(9, 6),
  };
  const refusedDose: DoseAdministration = {
    id: "adm-demo-refusal-1",
    patientId: "p-demo-refusal",
    orderId: order.id,
    scheduledAt: facilityDayAt(8, 0),
    action: "refused",
    reason: "Patient declined — reports nausea after morning dose.",
    batchId: "batch-demo-refusal-0",
    chartedBy: "Rosa T., LVN",
    chartedAt: facilityDayAt(8, 0),
  };
  const priorRefusals: DoseAdministration[] = [1, 2].map((daysAgo) => ({
    id: `adm-demo-refusal-prior-${daysAgo}`,
    patientId: "p-demo-refusal",
    orderId: order.id,
    scheduledAt: facilityDayAt(8, daysAgo),
    action: "refused" as const,
    reason: "Patient declined.",
    batchId: `batch-demo-refusal-${daysAgo}`,
    chartedBy: "Rosa T., LVN",
    chartedAt: facilityDayAt(8, daysAgo),
  }));
  const risk = RISK_TEXT_CATALOG.psychiatric;
  const demoPatient: Patient = {
    id: "p-demo-refusal",
    programId: "ADL-2026-900",
    firstName: "Alicia",
    lastName: "R.",
    dob: "1994-02-18",
    phone: "+15595550190",
    releaseDate: "2026-06-01",
    enrolledAt: "2026-06-03",
    episodeDay: 12,
    smsFallback: true,
    consents: { hipaa: true, part2Sud: true, signedAt: "2026-06-03" },
    screeners: {},
    needs: { housing: false, food: false, employment: false, transport: false },
    carePlanSummary: "Demo record for MAR refusal-document walkthrough.",
    caseManagerId: "cm1",
    alerts: [],
    allergies: [],
    problems: [],
    orders: [order],
    administrations: [refusedDose, ...priorRefusals],
    refusalForms: [
      {
        id: "rf-demo-refusal-1",
        patientId: "p-demo-refusal",
        administrationId: refusedDose.id,
        status: "pending_signature",
        medClass: "psychiatric",
        riskTextVersion: risk.version,
        riskTextSnapshot: risk.text,
        languageCode: "en",
        capacityFlagsAtSigning: [],
        guardianRequired: false,
        nurseAttested: false,
        patientSigned: false,
        witnessRequired: false,
        attestationMethod: "checkbox_only",
        createdAt: refusedDose.chartedAt,
        createdBy: "Rosa T., LVN",
      },
    ],
  };
  patients.push(demoPatient);
}
interface RxEventRow {
  id: string;
  patientId: string;
  clinicianId?: string;
  kind: "sso_launch" | "refill_requested" | "discontinued";
  at: string;
  note?: string;
}
const rxEvents: RxEventRow[] = [];

// ----- Unified audit stream ------------------------------------------------
// One append-only log for consent, rx, telehealth, vendor, and access events.
// Every mutating helper below should route through `appendAudit` so admin
// tooling can show a coherent activity feed.
export type AuditCategory =
  | "consent"
  | "disclosure"
  | "rx"
  | "telehealth"
  | "vendor"
  | "access"
  | "provider_switch"
  | "care_plan"
  | "assignment"
  | "clinical"
  // §v3.0 Phase 4 — third-party (advocate/family) access. Its own category so
  // every advocate event is separable in the existing audit stream; this is
  // NOT a parallel log.
  | "advocate";
export interface AuditEvent {
  id: string;
  at: string;
  category: AuditCategory;
  action: string;
  actorRole?: string;
  actorId?: string;
  patientId?: string;
  programId?: string;
  detail?: Record<string, unknown>;
}
const auditEvents: AuditEvent[] = [];

// ---------------------------------------------------------------------------
// §v3.0 Phase 4 — Advocate / Family Member.
//
// A SEPARATE ENTITY, deliberately not a StaffRole. See src/lib/advocate.ts for
// the architecture reasoning and the pure access policy. This store holds the
// link itself; the policy module decides what a link may do.
//
// HARD INVARIANT (tested): there is NO function anywhere that locates a
// patient from advocate-supplied identifying information. The ONLY entry point
// is `advocateLinkByCode`, keyed on a high-entropy invitation code that is
// delivered directly to the advocate's own contact — never relayed through the
// patient, and never derived from a name, DOB, or any other patient
// identifier. Do not add a lookup by name/DOB/phone here.
// ---------------------------------------------------------------------------
export type AdvocateLinkStatus = "invited" | "active" | "revoked" | "expired";

export interface AdvocateLink {
  id: string;
  patientId: string;
  /** Who the patient designated. Free text supplied by the DESIGNATOR only. */
  advocateName: string;
  relationship?: string;
  /** Where the invitation was sent — the advocate's own contact, direct. */
  invitationSentTo: string;
  invitationChannel: "email" | "sms";
  /**
   * Single-use, high-entropy. Consumed by `claimAdvocateInvitation`; retained
   * afterwards only so the claim cannot be replayed (status guards that too).
   */
  invitationCode: string;
  invitationExpiresAt: string;
  designatedBy: { actor: "patient" | "cf_care_manager" | "ecm_provider"; name: string };
  designatedAt: string;
  status: AdvocateLinkStatus;
  /** Set ONLY at claim time, by the advocate. An invite alone grants nothing. */
  authorizationType?: AdvocateAuthorizationType;
  authorizationConfirmedAt?: string;
  /** Typed-name attestation, same pattern as consent/MAR e-signature. */
  authorizationAttestedName?: string;
  claimedAt?: string;
  /**
   * AHCD only — a physician's determination that the patient cannot
   * communicate or decide. Until this exists the directive is dormant.
   */
  ahcdActivatedAt?: string;
  ahcdActivatedBy?: string;
  revokedAt?: string;
  revokedBy?: string;
  revokeReason?: string;
  /**
   * §Phase 4 expansion — "one identity, two hats".
   *
   * If this advocate has ALSO opened their own care with us, this is the id of
   * THEIR OWN Patient record. It is a pointer between two records held by one
   * human being; it is emphatically NOT a data-sharing relationship. Nothing
   * in this file ever reads `selfPatientId` while serving advocate-side data,
   * and nothing ever reads `patientId` while serving self-side data. The two
   * sides are enforced separate by construction — see `advocateSelfPatient`
   * and the negative tests in `advocatePhase4.test.ts`.
   */
  selfPatientId?: string;
  selfPatientStartedAt?: string;
  /** Set when the advocate declines the "support for yourself too?" prompt. */
  selfCareOfferDeclinedAt?: string;
}

/**
 * §Phase 4 expansion — an advocate's INPUT on the reentry care plan.
 *
 * Deliberately a separate append-only stream rather than fields on
 * `ReentryCarePlan`: the ECM Provider / CF Care Manager remains the sole
 * author of the plan itself. "Participation" concretely means the advocate can
 * (a) read the coordination-relevant parts of the plan and (b) attach comments
 * and requests to a named section, which the owner then accepts or ignores.
 * PLACEHOLDER: whether a contribution should ever be formally "accepted" into
 * the plan (and by whom) needs real definition — none is invented here.
 */
export type AdvocateContributionSection =
  | "housing"
  | "appointments"
  | "pharmacy"
  | "dme"
  | "general";

export interface AdvocateContribution {
  id: string;
  advocateLinkId: string;
  patientId: string;
  section: AdvocateContributionSection;
  text: string;
  authorName: string;
  createdAt: string;
}

const advocateContributions: AdvocateContribution[] = [];

const advocateLinks: AdvocateLink[] = [];

// ----- §v3.0 Phase 5 — patient documents ----------------------------------
//
// STORAGE HONESTY FLAG: this stores METADATA ONLY. No file bytes are kept,
// nothing is encrypted, and no compliant object store exists behind it. See
// the header of `src/lib/documents.ts` for the full dev-team follow-up list.
export interface DocumentUploader {
  kind: DocumentUploaderKind;
  /** Human-readable: patient name, named advocate, or staff member. */
  name: string;
  /** Set for staff uploads (and only then) — the uploader's StaffRole. */
  role?: StaffRole;
  staffId?: string;
  advocateLinkId?: string;
  /** True when staff uploaded during an interaction on the patient's behalf. */
  onBehalfOfPatient?: boolean;
}

export interface PatientDocument {
  id: string;
  patientId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Placeholder taxonomy — see DOCUMENT_TYPES. */
  docType?: string;
  note?: string;
  uploadedAt: string;
  uploader: DocumentUploader;
  /**
   * Captured AT UPLOAD by whoever uploaded, never inferred afterwards. A true
   * value makes the document redisclosure-protected and routes it through the
   * same masking gate every other SUD-flagged surface in this build uses.
   */
  isPart2: boolean;
  part2ClassifiedBy: string;
  part2ClassifiedAt: string;
  /** Unverified by DEFAULT. Never enters the clinical chart automatically. */
  verification: DocumentVerificationStatus;
  promotedBy?: string;
  promotedByRole?: StaffRole;
  promotedAt?: string;
  rejectedReason?: string;
  /** Result of the ingest scan gate. Only clean files are ever stored. */
  scan: { engine: "prototype_stub"; scannedAt: string; result: "clean" };
  /** Deliberately explicit: there is no file. */
  storage: "metadata_only_no_object_store";
}

const patientDocuments: PatientDocument[] = [];

function _documentUploaderLabel(u: DocumentUploader): string {
  if (u.kind === "patient") return `${u.name} (patient)`;
  if (u.kind === "advocate") return `${u.name} (advocate)`;
  const roleLabel = u.role ? (STAFF_ROLES.find((r) => r.key === u.role)?.label ?? u.role) : "";
  return `${u.name}${roleLabel ? ` (${roleLabel})` : ""}${
    u.onBehalfOfPatient ? " — on the patient's behalf" : ""
  }`;
}

/** Episode-derived queue ownership. One rule, no manual assignment. */
function _documentOwnerRole(patientId: string): "cf_care_manager" | "ecm_provider" {
  const ep = AdelanteEHR.activePreReleaseEpisode(patientId);
  return verifyQueueOwnerRole(ep?.status);
}



/** Crockford-ish, unambiguous, high-entropy. Same family as the reentry code. */
function _advocateInviteCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTVWXYZ0123456789";
  const pick = (n: number) =>
    Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `ADV-${pick(4)}-${pick(4)}-${pick(4)}`;
}

/** Expiry is evaluated live — an unclaimed invite lapses on its own. */
function _effectiveAdvocateStatus(link: AdvocateLink, at = new Date()): AdvocateLinkStatus {
  if (link.status === "revoked") return "revoked";
  if (link.status === "invited" && +new Date(link.invitationExpiresAt) <= +at) return "expired";
  return link.status;
}


/**
 * §Phase 4 expansion — SUD / 42 CFR Part 2 text screen for advocate surfaces.
 * Conservative and deliberately crude: it is a BACKSTOP on free text, not the
 * primary control. The primary controls are the `sensitive` flags the clinical
 * model already carries, which the advocate reads honour directly.
 */
const ADVOCATE_SUD_TEXT_RE =
  /\b(sud|substance|opioid|opiate|alcohol|detox|withdraw\w*|methadone|suboxone|buprenorphine|naltrexone|vivitrol|narcan|naloxone|recovery house|sober living|relapse|ciwa|cows|mat\b)/i;

function _advocateSudText(text: string): boolean {
  return ADVOCATE_SUD_TEXT_RE.test(text);
}

/**
 * The consent-conditional exception to advocate Part 2 masking. TWO
 * independent checks, both required, evaluated live at read time:
 *   1. an ACTIVE `advocate_sud_disclosure` ConsentRecord for this patient, and
 *   2. this advocate's own authorization link currently allowed.
 * The second is the existing gate, unchanged — this helper layers on top of
 * it rather than replacing it. Everything stays masked by default.
 */
function _advocatePart2Unmasked(link: AdvocateLink): boolean {
  const linkValid = AdelanteEHR.advocateAccess(link.id).allowed;
  const consentActive = AdelanteEHR.isConsentCategoryAuthorized(
    link.patientId,
    ADVOCATE_SUD_DISCLOSURE_CATEGORY,
  );
  return !advocatePart2Masked(link.authorizationType, {
    linkValid,
    sudDisclosureConsentActive: consentActive,
  });
}

function _patient(id: string): Patient | undefined {
  return patients.find((x) => x.id === id);
}

/** Uniform advocate audit row — every advocate touch lands in one shape. */
function _advocateAudit(
  link: AdvocateLink,
  action: string,
  resource: string,
  detail: Record<string, unknown> = {},
) {
  appendAudit({
    category: "advocate",
    action,
    patientId: link.patientId,
    actorRole: "advocate",
    actorId: link.id,
    detail: {
      advocateLinkId: link.id,
      advocateName: link.advocateName,
      authorizationType: link.authorizationType,
      tier: link.authorizationType ? advocateTier(link.authorizationType) : undefined,
      resource,
      ...detail,
    },
  });
}

/**
 * THE single advocate authorization choke point. Returns the link only when
 * the live decision grants the permission; every denial is audited here so no
 * caller can forget to.
 */
function _advocateGate(
  linkId: string,
  permission: AdvocatePermission,
  resource: string,
): { ok: true; link: AdvocateLink; reason: string } | { ok: false; reason: string } {
  const link = advocateLinks.find((l) => l.id === linkId);
  if (!link) return { ok: false, reason: "No advocate connection." };
  const decision = AdelanteEHR.advocateAccess(linkId);
  if (!decision.allowed || !decision.permissions.includes(permission)) {
    _advocateAudit(link, "advocate_access_denied", resource, {
      permission,
      denyReason: decision.allowed ? "permission_not_granted" : decision.denyReason,
    });
    return {
      ok: false,
      reason: decision.allowed
        ? "Your authorization doesn't include this."
        : decision.reason,
    };
  }
  return { ok: true, link, reason: decision.reason };
}

/**
 * §Shift count — locked controlled-substance reconciliations. Top-level store:
 * a shift count spans every patient on the unit, so it has no owning Patient.
 */
const shiftCounts: ShiftCount[] = [];

/**
 * §ASCMI — structured consent records (top-level, append-only in spirit:
 * revocation never deletes, it transitions status and keeps the original).
 * Seeded with one record so the Consent tab has a live example; every other
 * patient falls back to the legacy boolean until a record is captured.
 */
const consentRecords: ConsentRecord[] = [
  {
    id: "cr-seed-1",
    patientId: "p1",
    formType: "AB133",
    source: "in person — intake (seed)",
    signedAt: "2026-05-12T16:00:00.000Z",
    signedBy: { name: "Patient p1", relationship: "patient" },
    capturedBy: { staffId: "s-cm1", staffName: "Luz Herrera", role: "ecm_provider" },
    attestationMethod: "checkbox_only",
    effectiveDate: "2026-05-12",
    expirationDate: "2027-05-12",
    status: "active",
    sections: [
      { category: "sud_treatment", authorized: true },
      { category: "mental_health", authorized: true },
      { category: "case_coordination", authorized: true },
      { category: "billing", authorized: false },
    ],
  },
];

/** Live status: a stored "active" record still expires purely by the clock. */
export function effectiveConsentStatus(rec: ConsentRecord, now = new Date()): ConsentRecordStatus {
  if (rec.status !== "active") return rec.status;
  const from = new Date(`${rec.effectiveDate}T00:00:00`);
  if (Number.isFinite(+from) && now < from) return "expired"; // not yet in force
  if (rec.expirationDate) {
    const to = new Date(`${rec.expirationDate}T23:59:59`);
    if (Number.isFinite(+to) && now > to) return "expired";
  }
  return "active";
}

// §Population health — admin-configured KPI targets (top-level reporting
// config). Seeded with a couple of realistic targets so the dashboard has
// something to compare against on first load, including one target whose
// metric has no live source yet — that row is the honest "target set, no live
// metric yet" case the dashboard must render gracefully.
const kpiTargets: KpiTarget[] = [
  {
    id: "kpi-mar",
    metricKey: "mar_compliance_pct",
    label: "MAR compliance (30 days)",
    targetValue: 95,
    unit: "percent",
    source: "Internal clinical goal",
    active: true,
    createdBy: "Adelante System Admin",
    createdAt: new Date().toISOString(),
  },
  {
    id: "kpi-notes",
    metricKey: "unsigned_notes_count",
    label: "Unsigned notes",
    targetValue: 5,
    unit: "count",
    source: "Documentation policy",
    active: true,
    createdBy: "Adelante System Admin",
    createdAt: new Date().toISOString(),
  },
  {
    id: "kpi-tasks",
    metricKey: "overdue_task_count",
    label: "Overdue tasks",
    targetValue: 10,
    unit: "count",
    source: "Care coordination goal",
    active: true,
    createdBy: "Adelante System Admin",
    createdAt: new Date().toISOString(),
  },
  {
    id: "kpi-controlled",
    metricKey: "controlled_count_discrepancies",
    label: "Controlled count discrepancies",
    targetValue: 0,
    unit: "count",
    source: "Custody partner requirement",
    notes: "No live metric — shift count has no discrepancy field yet.",
    active: true,
    createdBy: "Adelante System Admin",
    createdAt: new Date().toISOString(),
  },
];

// §CalAIM — the qualifying ICD-10 registry. Seeded with two category prefixes
// and one exact code so both matching interpretations are exercised on first
// load. Admins curate this list; nothing here is auto-suggested.
const calaimQualifyingCodes: CalaimQualifyingCode[] = [
  {
    id: "calaim-f10",
    codeSystem: "icd10",
    code: "F10",
    description: "Alcohol-related disorders (all F10.x)",
    active: true,
    createdBy: "Adelante System Admin",
    createdAt: new Date().toISOString(),
  },
  {
    id: "calaim-f11",
    codeSystem: "icd10",
    code: "F11",
    description: "Opioid-related disorders (all F11.x)",
    active: true,
    createdBy: "Adelante System Admin",
    createdAt: new Date().toISOString(),
  },
  {
    id: "calaim-f33",
    codeSystem: "icd10",
    code: "F33.1",
    description: "Major depressive disorder, recurrent, moderate",
    active: true,
    createdBy: "Adelante System Admin",
    createdAt: new Date().toISOString(),
  },
];

// §Clinical documentation — note template registry. One seeded template so the
// renderer's conditional fields and scoring path are exercised on first load.
const noteTemplates: NoteTemplate[] = [
  {
    id: "tpl-bh-intake",
    key: "bh_intake",
    version: 1,
    title: "Behavioral health intake",
    description: "First-visit behavioral health assessment with PHQ-2 screen and plan.",
    encounterType: "intake",
    active: true,
    createdBy: "Adelante System Admin",
    createdAt: new Date().toISOString(),
    schema: {
      sections: [
        {
          id: "presenting",
          title: "Presenting concern",
          fields: [
            {
              key: "chief_complaint",
              type: "textarea",
              label: "Chief complaint",
              required: true,
              rows: 3,
              ai_hint: "Patient's own words describing why they came in today.",
            },
            {
              key: "substance_use",
              type: "radio",
              label: "Current substance use reported?",
              required: true,
              options: [
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
              ],
            },
            {
              key: "substances",
              type: "multiselect",
              label: "Substances reported",
              show_if: 'substance_use == "yes"',
              options: [
                { value: "alcohol", label: "Alcohol" },
                { value: "opioids", label: "Opioids" },
                { value: "stimulants", label: "Stimulants" },
              ],
            },
          ],
        },
        {
          id: "phq2",
          title: "PHQ-2 screen",
          fields: [
            {
              key: "phq2_interest",
              type: "select",
              label: "Little interest or pleasure in doing things",
              options: [
                { value: "0", label: "Not at all", score: 0 },
                { value: "1", label: "Several days", score: 1 },
                { value: "2", label: "More than half the days", score: 2 },
                { value: "3", label: "Nearly every day", score: 3 },
              ],
            },
            {
              key: "phq2_down",
              type: "select",
              label: "Feeling down, depressed or hopeless",
              options: [
                { value: "0", label: "Not at all", score: 0 },
                { value: "1", label: "Several days", score: 1 },
                { value: "2", label: "More than half the days", score: 2 },
                { value: "3", label: "Nearly every day", score: 3 },
              ],
            },
          ],
        },
        {
          id: "plan",
          title: "Plan",
          fields: [
            { key: "plan_text", type: "textarea", label: "Plan", required: true, rows: 3 },
            { key: "followup_date", type: "date", label: "Follow-up date" },
          ],
        },
      ],
      scoring: [
        {
          id: "phq2_total",
          label: "PHQ-2 total",
          sum_of: ["phq2_interest", "phq2_down"],
          bands: [
            { min: 0, max: 2, label: "Negative screen" },
            { min: 3, max: 6, label: "Positive — administer PHQ-9" },
          ],
        },
      ],
    },
  },
];

/**
 * §Discharge summary — seeded template.
 *
 * AUTHORSHIP CAUTION (same as the crisis instrument and CIWA/COWS scaffolds):
 * the STRUCTURE here is product/engineering-authored, not clinical content.
 * The required-field list, the section ordering and the exact wording MUST get
 * a real clinical review before this is treated as a production discharge
 * document. No AI-generated narrative: every prose field is clinician-written.
 */
noteTemplates.push({
  id: "tpl-discharge-summary",
  key: "discharge_summary",
  version: 1,
  title: "Discharge summary",
  description:
    "Release/discharge summary. Known facts auto-populate; the clinician writes the narrative.",
  encounterType: "discharge",
  active: true,
  createdBy: "Adelante System Admin",
  createdAt: new Date().toISOString(),
  schema: {
    sections: [
      {
        id: "ds_release",
        title: "Release / booking episode",
        type: "autofill_section",
        fields: [],
        autofill: { source: "booking_release_info" },
      },
      {
        id: "ds_problems",
        title: "Active problems",
        type: "autofill_section",
        fields: [],
        autofill: { source: "problems_active" },
      },
      {
        id: "ds_meds",
        title: "Active medications",
        type: "autofill_section",
        fields: [],
        autofill: { source: "medications_active" },
      },
      {
        id: "ds_allergies",
        title: "Allergies",
        type: "autofill_section",
        fields: [],
        autofill: { source: "allergies" },
      },
      {
        id: "ds_referrals",
        title: "Open referrals / follow-up in motion",
        type: "autofill_section",
        fields: [],
        autofill: { source: "referrals_open" },
      },
      {
        id: "ds_narrative",
        title: "Clinician narrative",
        fields: [
          {
            key: "discharge_reason",
            type: "textarea",
            label: "Reason for discharge / release",
            required: true,
            rows: 3,
          },
          {
            key: "condition_at_discharge",
            type: "textarea",
            label: "Condition at discharge",
            required: true,
            rows: 3,
          },
          {
            key: "med_recon_note",
            type: "textarea",
            label:
              "Medication reconciliation note — complete the release reconciliation in the Med reconciliation tab, then summarise the outcome here (do not re-list meds).",
            rows: 3,
          },
          {
            key: "followup_instructions",
            type: "textarea",
            label: "Follow-up instructions given to the patient",
            required: true,
            rows: 3,
          },
          {
            key: "additional_summary",
            type: "textarea",
            label: "Additional narrative summary",
            rows: 3,
          },
        ],
      },
    ],
  },
});

/**
 * §v3.0 Phase 3 — Community Health Worker service note.
 *
 * Reuses the existing template engine (no parallel documentation system).
 * `service_minutes` is what the G0019/G0022 unit math reads; the CHW/ECM
 * exclusivity and daily cap are enforced at the claim hook, not here.
 *
 * AUTHORSHIP CAUTION: structure is product/engineering-authored placeholder,
 * pending clinical/DHCS review — same discipline as the other scaffolds.
 */
noteTemplates.push({
  id: "tpl-chw-service",
  key: "chw_service",
  version: 1,
  title: "CHW service note",
  description: "Community Health Worker service contact — documents time, activity and follow-up.",
  encounterType: "chw_service",
  active: true,
  createdBy: "Adelante System Admin",
  createdAt: new Date().toISOString(),
  schema: {
    sections: [
      {
        id: "chw_contact",
        title: "Contact",
        fields: [
          {
            key: "contact_mode",
            type: "radio",
            label: "Contact type",
            required: true,
            options: [
              { value: "in_person", label: "In person" },
              { value: "phone", label: "Phone" },
              { value: "home_visit", label: "Home / community visit" },
            ],
          },
          {
            key: "service_minutes",
            type: "number",
            label: "Service time (minutes) — billed in 30-minute units, max 2 hrs/day",
            required: true,
          },
        ],
      },
      {
        id: "chw_activity",
        title: "Activity",
        fields: [
          {
            key: "activities",
            type: "multiselect",
            label: "Activities performed",
            options: [
              { value: "health_education", label: "Health education" },
              { value: "navigation", label: "System navigation / appointment support" },
              { value: "resource_linkage", label: "Resource linkage" },
              { value: "self_management", label: "Self-management coaching" },
            ],
          },
          { key: "narrative", type: "textarea", label: "Narrative", required: true, rows: 4 },
          { key: "follow_up", type: "textarea", label: "Follow-up plan", rows: 3 },
        ],
      },
    ],
  },
});

/**
 * §Facility registry — top-level, not patient-scoped: a facility is shared by
 * every patient booked there, which is the whole point of having ids.
 */
const facilities: Facility[] = [
  {
    id: "fac-fresno-main",
    name: "Fresno County Jail — Main",
    kind: "county_jail",
    city: "Fresno",
    timezone: "America/Los_Angeles",
    active: true,
    createdBy: "system",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "fac-fresno-north",
    name: "Fresno County Jail — North Annex",
    kind: "county_jail",
    city: "Fresno",
    timezone: "America/Los_Angeles",
    active: true,
    createdBy: "system",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "fac-tulare-adult",
    name: "Tulare County Adult Detention",
    kind: "county_jail",
    city: "Visalia",
    timezone: "America/Los_Angeles",
    active: true,
    createdBy: "system",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "fac-adelante-res",
    name: "Adelante Residential Treatment",
    kind: "treatment",
    city: "Visalia",
    timezone: "America/Los_Angeles",
    active: true,
    createdBy: "system",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

// How a catalog selection's strength was resolved, recorded at pick time.
export type CatalogResolutionPath =
  | "rxnav"
  | "units_parsed"
  | "topical"
  | "dailymed_resolved"
  | "dailymed_empty";
export interface CatalogResolutionMetrics {
  selections: number;
  rxnav: number;
  unitsParsed: number;
  topical: number;
  dailymedAttempted: number;
  dailymedResolved: number;
  dailymedEmpty: number;
  signedOrders: number;
  manualDoseOrders: number;
  recentManualJustifications: { at: string; drugName: string; justification: string }[];
}
function appendAudit(evt: Omit<AuditEvent, "id" | "at"> & { at?: string }) {
  const patient = evt.patientId ? patients.find((p) => p.id === evt.patientId) : undefined;
  auditEvents.unshift({
    id: `au_${auditEvents.length + 1}_${Math.random().toString(36).slice(2, 6)}`,
    at: evt.at ?? new Date().toISOString(),
    programId: patient?.programId,
    ...evt,
  });
}

// ----- Refill request lifecycle -------------------------------------------
export type RefillStatus = "pending" | "approved" | "denied" | "sent_to_pharmacy";
export interface RefillRequest {
  id: string;
  patientId: string;
  medicationId: string;
  medicationName: string;
  requestedAt: string;
  requestedBy: "patient" | "clinician";
  pharmacyNote?: string;
  status: RefillStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  denyReason?: string;
}
const refillRequests: RefillRequest[] = [];

// ----- Telehealth session lifecycle ---------------------------------------
export type TelehealthState =
  | "scheduled"
  | "clinician_joined"
  | "patient_joined"
  | "in_progress"
  | "ended"
  | "expired"
  | "failed";
export interface TelehealthSession {
  id: string;
  appointmentId: string;
  patientId: string;
  clinicianId: string;
  vendor: string;
  roomId: string;
  joinUrlPatient: string;
  joinUrlClinician: string;
  state: TelehealthState;
  createdAt: string;
  expiresAt: string;
  startedAt?: string;
  endedAt?: string;
  durationSec?: number;
  endReason?: string;
}
const telehealthSessions: TelehealthSession[] = [];

// Cached last vendor ping results (last 5 per vendor).
type PingResult = { vendor: string; ok: boolean; at: string };
const vendorPings: PingResult[] = [];

// ----- Provider switch notifications --------------------------------------
// When a patient moves from one clinician to another (via reschedule, new
// booking, refill decision, or reassignment), a ProviderSwitch is created
// so the outgoing clinician + case manager can review continuity, network
// status, and clinical hand-off.
export type ProviderSwitchReason =
  | "reschedule"
  | "new_appointment"
  | "refill_review"
  | "primary_reassignment";
export type ProviderSwitchStatus = "pending_review" | "acknowledged" | "dismissed";
export interface ProviderSwitch {
  id: string;
  patientId: string;
  fromClinicianId: string;
  toClinicianId: string;
  reason: ProviderSwitchReason;
  serviceType?: ServiceType;
  context?: string;
  initiatedBy: "patient" | "clinician" | "ecm_provider" | "admin" | "system";
  createdAt: string;
  status: ProviderSwitchStatus;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
  linkedApptId?: string;
  linkedRefillId?: string;
}
const providerSwitches: ProviderSwitch[] = [];

/** Return the most recent scheduled/attended clinician for a patient. */
function _previousProviderFor(patientId: string, serviceType?: ServiceType): string | undefined {
  const rows = appointments
    .filter(
      (a) =>
        a.patientId === patientId &&
        (a.status === "scheduled" || a.status === "attended") &&
        (!serviceType || !a.serviceType || a.serviceType === serviceType),
    )
    .sort((a, b) => +new Date(b.start) - +new Date(a.start));
  return rows[0]?.clinicianId;
}

function _flagProviderSwitch(input: {
  patientId: string;
  fromClinicianId?: string;
  toClinicianId: string;
  reason: ProviderSwitchReason;
  serviceType?: ServiceType;
  context?: string;
  initiatedBy: ProviderSwitch["initiatedBy"];
  linkedApptId?: string;
  linkedRefillId?: string;
}): ProviderSwitch | undefined {
  if (!input.fromClinicianId) return undefined;
  if (input.fromClinicianId === input.toClinicianId) return undefined;
  const sw: ProviderSwitch = {
    id: `psw_${providerSwitches.length + 1}_${Math.random().toString(36).slice(2, 6)}`,
    patientId: input.patientId,
    fromClinicianId: input.fromClinicianId,
    toClinicianId: input.toClinicianId,
    reason: input.reason,
    serviceType: input.serviceType,
    context: input.context,
    initiatedBy: input.initiatedBy,
    createdAt: new Date().toISOString(),
    status: "pending_review",
    linkedApptId: input.linkedApptId,
    linkedRefillId: input.linkedRefillId,
  };
  providerSwitches.unshift(sw);

  const patient = patients.find((p) => p.id === input.patientId);
  const fromClin = clinicians.find((c) => c.id === input.fromClinicianId);
  const toClin = clinicians.find((c) => c.id === input.toClinicianId);
  const dueDate = new Date().toISOString().slice(0, 10);
  const reasonLabel: Record<ProviderSwitchReason, string> = {
    reschedule: "Appointment moved to a new provider",
    new_appointment: "Booked with a new provider",
    refill_review: "Refill reviewed by a different prescriber",
    primary_reassignment: "Primary provider reassigned",
  };
  const detail =
    `${reasonLabel[input.reason]}. ` +
    `From ${fromClin?.name ?? input.fromClinicianId} → ${toClin?.name ?? input.toClinicianId}.` +
    (input.context ? ` ${input.context}` : "");

  // Task to the outgoing clinician (assigned via clinicianId; separate from CM queue).
  AdelanteEHR.createCaseTask({
    patientId: input.patientId,
    assignedTo: input.fromClinicianId,
    title: `Provider switch review: ${patient?.firstName ?? ""} ${patient?.lastName ?? ""}`.trim(),
    detail,
    dueDate,
    origin: "provider_switch",
    dedupeKey: `switch-out:${sw.id}`,
  });
  // Task to the case manager for coordination review.
  if (patient?.caseManagerId) {
    AdelanteEHR.createCaseTask({
      patientId: input.patientId,
      assignedTo: patient.caseManagerId,
      title: `Coordinate provider switch: ${patient.firstName} ${patient.lastName}`,
      detail: `${detail} Verify in-network status, funding lane, and continuity of care.`,
      dueDate,
      origin: "provider_switch",
      dedupeKey: `switch-cm:${sw.id}`,
    });
  }
  appendAudit({
    category: "provider_switch",
    action: `switch_${input.reason}`,
    patientId: input.patientId,
    detail: {
      from: input.fromClinicianId,
      to: input.toClinicianId,
      reason: input.reason,
      serviceType: input.serviceType,
      switchId: sw.id,
    },
  });
  return sw;
}

// ---------- Care-plan recomputation ----------
// Derives a `CarePlanSnapshot` from the patient's current record and stores
// it on `p.carePlan`. Called at the end of every mutation that could change
// the plan (intake, screener submit, goal edit, note, refill, SDOH change,
// check-in). Sensitivity flags stay on each slice so surfaces can gate the
// SUD / 42 CFR Part 2 material without re-classifying it.
const SUD_SCREENER_KEYS = new Set(["audit", "dast-10"]);
const SUD_MED_RE = /suboxone|methadone|naltrexone|buprenorphine|acamprosate|disulfiram|vivitrol/i;

function _composeSummary(
  p: Patient,
  parts: {
    goalsOpen: number;
    sdohOpen: number;
    medsActive: number;
    nextApptStart?: string;
  },
): string {
  if (!p.intakeCompletedAt) return "Care plan will appear here after intake.";
  const out: string[] = [];
  const phq = p.screeners["phq-9"];
  const gad = p.screeners["gad-7"];
  if (phq) out.push(`Your mood check (PHQ-9) shows ${phq.severity.toLowerCase()} symptoms.`);
  if (gad) out.push(`Your worry check (GAD-7) shows ${gad.severity.toLowerCase()} anxiety.`);
  if (parts.goalsOpen)
    out.push(
      `You're working on ${parts.goalsOpen} goal${parts.goalsOpen === 1 ? "" : "s"} with your care team.`,
    );
  if (parts.sdohOpen)
    out.push(
      `${parts.sdohOpen} life need${parts.sdohOpen === 1 ? "" : "s"} (like housing or food) are in progress.`,
    );
  if (parts.medsActive)
    out.push(
      `Your care team is managing ${parts.medsActive} medication${parts.medsActive === 1 ? "" : "s"} with you.`,
    );
  if (parts.nextApptStart) out.push("Your next session is scheduled — we'll see you soon.");
  if (out.length === 0) out.push("Your care team will add next steps here as you start visits.");
  return out.join(" ");
}

function _recomputeCarePlan(patientId: string, triggeredBy?: string) {
  const p = patients.find((x) => x.id === patientId);
  if (!p) return;

  const meds = _vendors.erx.listActiveMedications(p.id);
  const pendingRefills = refillRequests.filter(
    (r) => r.patientId === p.id && r.status === "pending",
  );
  const medications: CarePlanMedicationSlice[] = meds.map((m) => ({
    name: m.name,
    state: pendingRefills.some((r) => r.medicationId === m.id) ? "refill_pending" : "active",
    sensitive: SUD_MED_RE.test(m.name),
  }));

  const screenerHighlights: CarePlanScreenerHighlight[] = [];
  for (const key of ["phq-9", "gad-7", "audit", "dast-10", "pcl-5"]) {
    const r = p.screeners[key];
    if (!r) continue;
    screenerHighlights.push({
      key,
      name: key.toUpperCase(),
      score: r.score,
      band: r.severity,
      takenAt: r.completedAt,
      sensitive: SUD_SCREENER_KEYS.has(key),
    });
  }

  const goalsArr = p.goals ?? [];
  const activeGoals = goalsArr
    .filter((g) => g.status !== "done")
    .map((g) => ({ id: g.id, text: g.text, status: g.status }));
  const goalsOpen = activeGoals.length;
  const goalsDone = goalsArr.length - goalsOpen;

  const sdohItems = p.sdohPlan?.items ?? [];
  const sdohOpenItems = sdohItems.filter(
    (i) => i.status !== "completed" && i.status !== "not_completed",
  );
  const sdohOpen: CarePlanSdohSlice[] = sdohOpenItems.map((i) => ({
    need: i.need,
    status: i.status,
  }));
  const sdohClosed = sdohItems.filter((i) => i.status === "completed").length;

  const upcoming = appointments
    .filter((a) => a.patientId === p.id && a.status === "scheduled")
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const nextAppt = upcoming[0];

  const focusAreas: CarePlanFocusArea[] = [];
  const phq = p.screeners["phq-9"];
  const gad = p.screeners["gad-7"];
  if (phq)
    focusAreas.push({ key: "mh", label: "Mood & anxiety", severity: `PHQ-9 ${phq.severity}` });
  else if (gad)
    focusAreas.push({ key: "mh", label: "Mood & anxiety", severity: `GAD-7 ${gad.severity}` });
  const hasSud = p.needs?.substanceUse || p.screeners["audit"] || p.screeners["dast-10"];
  if (hasSud) focusAreas.push({ key: "sud", label: "Substance use support", sensitive: true });
  if (sdohOpen.length)
    focusAreas.push({ key: "sdoh", label: "Life needs", severity: `${sdohOpen.length} open` });
  if (medications.length)
    focusAreas.push({
      key: "meds",
      label: "Medications",
      severity: `${medications.length} active`,
      sensitive: medications.some((m) => m.sensitive),
    });
  if (upcoming.length)
    focusAreas.push({
      key: "engagement",
      label: "Upcoming visits",
      severity: `${upcoming.length} scheduled`,
    });

  const nextSteps: CarePlanNextStep[] = [];
  if (nextAppt) {
    nextSteps.push({
      label: "Attend your next session",
      dueBy: nextAppt.start,
      source: "clinician",
    });
  }
  for (const t of p.tasks ?? []) {
    if (t.completedAt) continue;
    nextSteps.push({
      label: t.label,
      source: t.kind === "rescreen" ? "screener" : "ecm_provider",
    });
  }
  for (const m of p.selfHelpPlan?.modules ?? []) {
    if (m.completedAt) continue;
    nextSteps.push({ label: `Self-help: ${m.title}`, source: "self_help" });
  }

  const lastAttended = appointments
    .filter((a) => a.patientId === p.id && a.status === "attended")
    .sort((a, b) => +new Date(b.start) - +new Date(a.start))[0]?.start;
  const lastCheckIn = p.checkIns?.[0]?.date;
  const lastContactAt = [lastAttended, lastCheckIn]
    .filter((v): v is string => Boolean(v))
    .sort()
    .reverse()[0];

  const metrics: CarePlanMetrics = {
    phq9Latest: phq?.score,
    gad7Latest: gad?.score,
    goalsOpen,
    goalsDone,
    sdohOpen: sdohOpen.length,
    sdohClosed,
    lastContactAt,
    intakeComplete: Boolean(p.intakeCompletedAt),
    crisisFlag: Boolean(p.crisisFlag),
    medsActive: medications.length,
    medsSensitive: medications.filter((m) => m.sensitive).length,
  };

  const auto = _composeSummary(p, {
    goalsOpen,
    sdohOpen: sdohOpen.length,
    medsActive: medications.length,
    nextApptStart: nextAppt?.start,
  });
  const override = p.carePlanOverride;
  const summary = override ? `${auto}\n\nCare team note: ${override.text}` : auto;
  const updatedBy: CarePlanSnapshot["updatedBy"] = override ? "clinician" : "system";

  p.carePlan = {
    updatedAt: new Date().toISOString(),
    updatedBy,
    summary,
    focusAreas,
    activeGoals,
    nextSteps: nextSteps.slice(0, 6),
    screenerHighlights,
    medications,
    sdohOpen,
    metrics,
    triggeredBy,
    allergySummary: (p.allergies ?? [])
      .filter((a) => a.active)
      .map((a) => ({ substance: a.substance, reaction: a.reaction, severity: a.severity })),
    activeProblems: (p.problems ?? [])
      .filter(isProblemClinicallyActive)
      .filter((pr) => pr.category !== "sud")
      .map((pr) => ({
        code: pr.icd10Code,
        label: pr.description,
        category: pr.category,
        sensitive: false,
      })),
    hiddenSudProblems: (p.problems ?? []).filter(
      (pr) => isProblemClinicallyActive(pr) && pr.category === "sud",
    ).length,
  };
  p.carePlanSummary = summary;

  appendAudit({
    category: "care_plan",
    action: "recomputed",
    patientId: p.id,
    detail: { triggeredBy, updatedBy },
  });
}

// ===========================================================================
// §Group sessions — group counseling as a first-class care-delivery type.
//
// PLACEHOLDER CONTENT WARNING (same discipline as the ASCMI consent work):
// group topics, capacity numbers, recurrence patterns and the billing code
// field below are STRUCTURE ONLY. DHCS/DMC-ODS group-size limits, curriculum
// names and billing/CPT/H-codes are deliberately NOT authored here — they are
// Christi's / the billing team's content to supply before production.
//
// A GroupSession is intentionally NOT an Appointment: the 1:1
// `bookAppointment` flow is patient-driven and single-patient, while group
// placement is a staff clinical decision with a standing roster. Nothing in
// this block touches the existing Appointment path.
// ===========================================================================

export type GroupSessionStatus = "scheduled" | "cancelled" | "completed";

/** Simple recurring pattern — weekly on given weekdays, or a one-off. */
export interface GroupRecurrence {
  kind: "none" | "weekly";
  /** 0=Sun … 6=Sat. Ignored when kind === "none". */
  daysOfWeek?: number[];
  /** ISO date (yyyy-mm-dd) after which no occurrences are generated. */
  until?: string;
}

/**
 * §Group sessions — PLACEHOLDER CATEGORY TAXONOMY (confirm with Christi/SMEs).
 * Only two values exist in this pass; there may well be more in reality.
 */
export type GroupCategory = "sud_clinical_preauth" | "open_psychoeducational";

export const GROUP_CATEGORIES: { key: GroupCategory; label: string; helper: string }[] = [
  {
    key: "sud_clinical_preauth",
    label: "SUD / clinically pre-authorized (placeholder)",
    helper:
      "Staff enroll patients. Individualized attendee notes are billable and flow to the Claims Worklist.",
  },
  {
    key: "open_psychoeducational",
    label: "Open psychoeducational (placeholder)",
    helper:
      "Eligible patients can self-enroll from their scheduling page. Attendance is tracked for engagement reporting only — never billed.",
  },
];

/** True when this category's attendee notes may create claims. */
export function isBillableGroupCategory(category: GroupCategory): boolean {
  return category === "sud_clinical_preauth";
}

/**
 * §Group sessions — care-plan group eligibility.
 *
 * PLACEHOLDER: neither `reason` nor `curriculumNeedTag` encodes real clinical
 * criteria. Roles allowed to set it are the clinical/care-management roles
 * listed in `GROUP_ELIGIBILITY_ROLES`.
 */
export interface GroupEligibility {
  eligible: true;
  /** Free-text clinical rationale. Placeholder — no criteria list exists yet. */
  reason: string;
  /** PLACEHOLDER curriculum-need tag. Not a DHCS curriculum taxonomy. */
  curriculumNeedTag?: string;
  setAt: string;
  setBy: string;
  setByRole: string;
}

/** Only these roles may set the group-eligibility gate. */
export const GROUP_ELIGIBILITY_ROLES = ["therapist", "pmhnp", "ecm_provider"] as const;

/**
 * Who initiated an enrollment. Deliberately an open shape rather than a
 * boolean "isPatient": the DHCS Authorized Representative / Collateral role
 * (Advocate) is a separate swim-lane and will add a third kind here. Every
 * "is this actor allowed" decision funnels through `_assertEnrollmentAllowed`
 * below — that is the ONE place the advocate role plugs in later.
 */
export type EnrollmentInitiatorKind = "staff" | "patient";

export interface EnrollmentInitiator {
  kind: EnrollmentInitiatorKind;
  /** Staff display name, or the patient id for a self-service enrollment. */
  actorId: string;
}

export interface GroupSession {
  id: string;
  /** Free text placeholder topic — NOT a real curriculum name. */
  topic: string;
  /**
   * Longer patient-safe "what to expect" text. Deliberately separate from
   * `topic` (short label) because this string may surface to patients on
   * /home. No curriculum content is authored here.
   */
  description?: string;
  facilitatorId: string;
  coFacilitatorId?: string;
  /**
   * Reuses the existing `ServiceType` union: `therapy_group` already exists,
   * so no new service taxonomy is invented here.
   */
  serviceType: ServiceType;
  modality: "video" | "phone" | "in_person";
  locationId?: string;
  /**
   * PLACEHOLDER TAXONOMY — exactly two categories, both provisional. Christi /
   * SMEs must confirm whether more categories exist and whether
   * "pre-authorization" here (internal clinical eligibility + placement
   * approval) is the right reading, or whether a payer-facing prior-auth
   * process is meant. This pass assumes the INTERNAL reading only.
   *
   *   sud_clinical_preauth   — staff-only enrollment, billable, claims flow.
   *   open_psychoeducational — patient self-service, NON-billing engagement.
   */
  category: GroupCategory;
  /** ISO datetime of the first occurrence. */
  start: string;
  durationMin: number;
  /** PLACEHOLDER: not a DHCS-sanctioned group-size limit. */
  capacity: number;
  recurrence: GroupRecurrence;
  status: GroupSessionStatus;
  createdAt: string;
  createdBy: string;
  cancelledAt?: string;
  cancellationReason?: string;
}

/** Standing enrollment in a recurring group — not a per-occurrence booking. */
export interface GroupSessionEnrollment {
  id: string;
  sessionId: string;
  patientId: string;
  enrolledAt: string;
  enrolledBy: string;
  endedAt?: string;
  endReason?: string;
}

export type GroupAttendanceStatus = "present" | "absent" | "late";

export interface GroupAttendanceEntry {
  patientId: string;
  status: GroupAttendanceStatus;
  note?: string;
}

/**
 * The shared group note for one occurrence. Signed ONCE by the facilitator.
 * It is deliberately not a per-patient ProgressNote: it documents the group,
 * not an individual, and carries a roster snapshot instead.
 */
export interface GroupSharedNote {
  topicCovered: string;
  groupProcess: string;
  facilitatorId: string;
  rosterSnapshot: GroupAttendanceEntry[];
  createdAt: string;
  signedBy?: string;
  signedAt?: string;
}

/** Per-occurrence record: attendance + documentation linkage. */
export interface GroupOccurrenceRecord {
  id: string;
  sessionId: string;
  /** ISO datetime identifying which occurrence of the recurring group. */
  occurrenceStart: string;
  attendance: GroupAttendanceEntry[];
  attendanceRecordedAt?: string;
  attendanceRecordedBy?: string;
  sharedNote?: GroupSharedNote;
  /** patientId -> individualized ProgressNote id. */
  attendeeNoteIds: Record<string, string>;
  /**
   * Single-occurrence exceptions. These change ONE meeting only — the
   * recurring pattern on the GroupSession is untouched.
   */
  status?: "scheduled" | "cancelled";
  cancelReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  /** When this occurrence was moved, the ISO start it moved to. */
  movedToStart?: string;
  /** On the destination record, the ISO start it came from. */
  movedFromStart?: string;
  rescheduleReason?: string;
}

/**
 * Back-reference stamped onto each individualized attendee note.
 *
 * BILLING PLACEHOLDER: `billingCodePlaceholder` is intentionally empty. No
 * CPT/H-code is invented anywhere in this codebase; the Claims Worklist reads
 * charges from `ehr-ext` claims, and a group attendee claim is created from
 * this reference (see `upsertClaimFromGroupAttendee` in ehr-ext.ts).
 */
export interface GroupAttendeeNoteRef {
  sessionId: string;
  occurrenceStart: string;
  facilitatorId: string;
  /** Individualized attendee notes are the billable unit in DMC-ODS. */
  billingEligible: boolean;
  billingCodePlaceholder?: string;
}

const groupSessions: GroupSession[] = [];
const groupEnrollments: GroupSessionEnrollment[] = [];
const groupOccurrences: GroupOccurrenceRecord[] = [];

// §v3.0 Phase 2 — pre-release episode stores.
const preReleaseEpisodes: PreReleaseEpisode[] = [];
const preReleaseForms: PreReleaseFormRecord[] = [];
const reentryCarePlans: ReentryCarePlan[] = [];
const enrollmentCodes: EnrollmentCode[] = [];

/** Crockford-style alphabet minus I/L/O/U — safe to read aloud or handwrite. */
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ENROLLMENT_CODE_TTL_DAYS = 90;

function generateEnrollmentCode(): string {
  const block = () =>
    Array.from(
      { length: 4 },
      () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
    ).join("");
  for (let attempt = 0; attempt < 50; attempt++) {
    const code = `RE-${block()}-${block()}`;
    if (!enrollmentCodes.some((c) => c.code === code)) return code;
  }
  throw new Error("Could not allocate a unique enrollment code.");
}

function _groupOccurrenceKey(sessionId: string, start: string) {
  return `${sessionId}::${start}`;
}

/** Materialize (or fetch) the per-occurrence record. */
function _ensureGroupOccurrence(sessionId: string, occurrenceStart: string) {
  let row = groupOccurrences.find(
    (o) => o.sessionId === sessionId && o.occurrenceStart === occurrenceStart,
  );
  if (!row) {
    row = {
      id: _groupOccurrenceKey(sessionId, occurrenceStart),
      sessionId,
      occurrenceStart,
      attendance: [],
      attendeeNoteIds: {},
    };
    groupOccurrences.push(row);
  }
  return row;
}

export const AdelanteEHR = {
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** Force a care-plan recompute. Idempotent; safe to call from any surface. */
  recomputeCarePlan(patientId: string, triggeredBy?: string) {
    _recomputeCarePlan(patientId, triggeredBy);
    emit();
  },
  /** Read the latest care-plan snapshot, recomputing lazily if missing. */
  getCarePlan(patientId: string): CarePlanSnapshot | undefined {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return undefined;
    if (!p.carePlan) _recomputeCarePlan(patientId, "lazy_read");
    return p.carePlan;
  },
  /** De-identified population-health rollup for admin dashboards. */
  getPopulationCarePlanMetrics(): {
    patients: number;
    withPlan: number;
    intakeComplete: number;
    avgPhq9?: number;
    avgGad7?: number;
    goalsOpen: number;
    sdohOpen: number;
    crisisFlags: number;
    medsSensitive: number;
  } {
    let withPlan = 0;
    let intakeComplete = 0;
    let goalsOpen = 0;
    let sdohOpen = 0;
    let crisisFlags = 0;
    let medsSensitive = 0;
    const phq: number[] = [];
    const gad: number[] = [];
    for (const p of patients) {
      if (!p.carePlan) _recomputeCarePlan(p.id, "population_rollup");
      const cp = p.carePlan;
      if (!cp) continue;
      withPlan += 1;
      if (cp.metrics.intakeComplete) intakeComplete += 1;
      goalsOpen += cp.metrics.goalsOpen;
      sdohOpen += cp.metrics.sdohOpen;
      if (cp.metrics.crisisFlag) crisisFlags += 1;
      medsSensitive += cp.metrics.medsSensitive;
      if (cp.metrics.phq9Latest !== undefined) phq.push(cp.metrics.phq9Latest);
      if (cp.metrics.gad7Latest !== undefined) gad.push(cp.metrics.gad7Latest);
    }
    const avg = (arr: number[]) =>
      arr.length ? Math.round((arr.reduce((s, n) => s + n, 0) / arr.length) * 10) / 10 : undefined;
    return {
      patients: patients.length,
      withPlan,
      intakeComplete,
      avgPhq9: avg(phq),
      avgGad7: avg(gad),
      goalsOpen,
      sdohOpen,
      crisisFlags,
      medsSensitive,
    };
  },
  getCurrentPatientId: () => currentPatientId,
  setCurrentPatientId(id: string) {
    currentPatientId = id;
    emit();
  },
  // P0 — create a new patient from signup. Minimal seed; intake fills the rest.
  createPatient(input: {
    firstName: string;
    lastName: string;
    dob?: string;
    phone?: string;
    preferredLanguage?: PreferredLanguage;
    referralId?: string;
    cin?: string;
  }): Patient {
    const id = uid();
    const seq = String(patients.length + 1).padStart(3, "0");
    const now = new Date().toISOString();
    const p: Patient = {
      id,
      programId: `ADL-${new Date().getFullYear()}-${seq}`,
      firstName: input.firstName,
      lastName: input.lastName,
      dob: input.dob ?? "",
      phone: input.phone ?? "",
      releaseDate: "",
      enrolledAt: now,
      episodeDay: 1,
      smsFallback: Boolean(input.phone),
      consents: { hipaa: false, part2Sud: false },
      screeners: {},
      needs: { housing: false, food: false, employment: false, transport: false },
      carePlanSummary: "Care plan will appear here after intake.",
      preferredLanguage: input.preferredLanguage,
      referralId: input.referralId,
      cin: input.cin,
    };
    patients.push(p);
    emit();
    return p;
  },
  // P1 — patch identity / contact-prefs fields.
  updateProfile(
    patientId: string,
    patch: Partial<
      Pick<
        Patient,
        | "firstName"
        | "lastName"
        | "preferredName"
        | "pronouns"
        | "preferredLanguage"
        | "phone"
        | "email"
        | "dob"
        | "releaseDate"
        | "contactPrefs"
        | "emergencyContact"
        | "address"
        | "cin"
      >
    >,
  ) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    Object.assign(p, patch);
    emit();
  },
  completeIntake(
    patientId: string,
    payload: {
      needs: Patient["needs"];
      hipaa: boolean;
      part2Sud: boolean;
    },
  ) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    const now = new Date().toISOString();
    p.needs = payload.needs;
    p.consents = { hipaa: payload.hipaa, part2Sud: payload.part2Sud, signedAt: now };
    p.intakeCompletedAt = now;
    _recomputeCarePlan(p.id, "intake_completed");
    emit();
  },
  // Reads
  listReferrals: () =>
    [...referrals].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
  listPatients: () => patients,
  getPatient: (id: string) => patients.find((p) => p.id === id),
  listClinicians: () => clinicians,
  getClinician: (id: string) => clinicians.find((c) => c.id === id),
  listServiceTypes: () => SERVICE_TYPES,
  getServiceType: (id?: ServiceType) => SERVICE_TYPES.find((s) => s.id === id),
  listLocations: () => LOCATIONS,
  getLocation: (id?: string) => LOCATIONS.find((l) => l.id === id),
  cliniciansForService(serviceType?: ServiceType, opts?: { locationId?: string }) {
    return clinicians.filter((c) => {
      const svcOk = !serviceType || !c.services || c.services.includes(serviceType);
      const locOk = !opts?.locationId || !c.locationIds || c.locationIds.includes(opts.locationId);
      return svcOk && locOk;
    });
  },
  locationsForService(serviceType?: ServiceType) {
    if (!serviceType) return LOCATIONS;
    return LOCATIONS.filter((l) => l.inPersonServices.includes(serviceType));
  },
  listCaseManagers: () => caseManagers,
  getCaseManager: (id?: string) => caseManagers.find((c) => c.id === id),
  patientsForCaseManager: (cmId: string) => patients.filter((p) => p.caseManagerId === cmId),
  listAppointments: () => [...appointments].sort((a, b) => +new Date(a.start) - +new Date(b.start)),
  appointmentsForPatient: (pid: string) => appointments.filter((a) => a.patientId === pid),
  appointmentsForClinician: (cid: string) => appointments.filter((a) => a.clinicianId === cid),

  // Writes (mocked — in production these become native Adelante EHR mutations)
  createReferral(
    input: Omit<Referral, "id" | "status" | "createdAt" | "smsSentAt" | "outreachTask"> & {
      requestManualOutreach?: boolean;
    },
  ) {
    const { requestManualOutreach, ...rest } = input;
    // Fallback: no phone, no contact consent, or referrer explicitly requested
    // manual outreach → skip the Twilio welcome-text trigger and queue a
    // manual-call task for the care team instead.
    const canSendSms = !requestManualOutreach && !!rest.phone && rest.consentToContact;
    const r: Referral = {
      ...rest,
      id: uid(),
      status: "submitted",
      createdAt: new Date().toISOString(),
      ...(canSendSms
        ? { smsSentAt: new Date().toISOString() } // SMS webhook in real impl
        : { outreachTask: "manual_call" as const }),
    };
    referrals.unshift(r);
    emit();
    return r;
  },
  advanceReferral(id: string) {
    const r = referrals.find((x) => x.id === id);
    if (!r) return;
    const nextStatus: ReferralStatus =
      r.status === "submitted" ? "contacted" : r.status === "contacted" ? "enrolled" : r.status;
    r.status = nextStatus;
    // P4 — materialize a Patient row the moment a referral flips to enrolled.
    if (nextStatus === "enrolled" && !r.enrolledPatientId) {
      const p = AdelanteEHR.createPatient({
        firstName: r.firstName,
        lastName: r.lastName,
        dob: r.dob,
        phone: r.phone,
        referralId: r.id,
        cin: r.cin,
      });
      r.enrolledPatientId = p.id;
    }
    emit();
  },
  bookAppointment(input: {
    patientId: string;
    clinicianId: string;
    start: string;
    durationMin: number;
    serviceType?: ServiceType;
    modality?: "video" | "phone" | "in_person";
    locationId?: string;
  }) {
    const cred = AdelanteEHR.canBook(input.clinicianId);
    if (!cred.ok) throw new Error(cred.reason);
    if (input.modality === "in_person" && !input.locationId) {
      throw new Error("Pick a location for the in-person visit.");
    }
    if (input.serviceType) {
      const svc = SERVICE_TYPES.find((s) => s.id === input.serviceType);
      if (svc && input.modality && !svc.allowedModalities.includes(input.modality)) {
        throw new Error(`${svc.label} isn't offered as ${input.modality.replace("_", " ")}.`);
      }
    }
    // Validate against mock availability: reject if the slot is already taken.
    const conflict = appointments.some(
      (x) =>
        x.clinicianId === input.clinicianId &&
        x.status === "scheduled" &&
        new Date(x.start).getTime() === new Date(input.start).getTime(),
    );
    if (conflict) {
      throw new Error("That time was just taken. Please pick another slot.");
    }
    const a: Appointment = { ...input, id: uid(), status: "scheduled", billingStatus: "draft" };
    appointments.push(a);
    // Detect provider switch vs. patient's last provider (same service type when set).
    const prevProvider = _previousProviderFor(a.patientId, a.serviceType);
    if (prevProvider && prevProvider !== a.clinicianId) {
      _flagProviderSwitch({
        patientId: a.patientId,
        fromClinicianId: prevProvider,
        toClinicianId: a.clinicianId,
        reason: "new_appointment",
        serviceType: a.serviceType,
        initiatedBy: "patient",
        linkedApptId: a.id,
      });
    }
    AdelanteEHR.notifyAppointmentChange({
      patientId: a.patientId,
      apptId: a.id,
      kind: "booked",
    });
    emit();
    return a;
  },
  rescheduleAppointment(
    apptId: string,
    newStart: string,
    patch?: {
      serviceType?: ServiceType;
      modality?: "video" | "phone" | "in_person";
      locationId?: string;
      durationMin?: number;
      clinicianId?: string;
    },
  ) {
    const a = appointments.find((x) => x.id === apptId);
    if (!a) return;
    const originalClinicianId = a.clinicianId;
    const targetClinicianId = patch?.clinicianId ?? a.clinicianId;
    const conflict = appointments.some(
      (x) =>
        x.id !== apptId &&
        x.clinicianId === targetClinicianId &&
        x.status === "scheduled" &&
        new Date(x.start).getTime() === new Date(newStart).getTime(),
    );
    if (conflict) {
      throw new Error("That time was just taken. Please pick another slot.");
    }
    a.start = newStart;
    if (patch) {
      if (patch.clinicianId !== undefined) a.clinicianId = patch.clinicianId;
      if (patch.serviceType !== undefined) a.serviceType = patch.serviceType;
      if (patch.modality !== undefined) a.modality = patch.modality;
      if (patch.locationId !== undefined) a.locationId = patch.locationId;
      if (patch.durationMin !== undefined) a.durationMin = patch.durationMin;
      if (a.modality === "in_person" && !a.locationId) {
        throw new Error("Pick a location for the in-person visit.");
      }
    }
    if (originalClinicianId !== a.clinicianId) {
      _flagProviderSwitch({
        patientId: a.patientId,
        fromClinicianId: originalClinicianId,
        toClinicianId: a.clinicianId,
        reason: "reschedule",
        serviceType: a.serviceType,
        initiatedBy: "patient",
        linkedApptId: a.id,
      });
    }
    AdelanteEHR.notifyAppointmentChange({
      patientId: a.patientId,
      apptId: a.id,
      kind: "rescheduled",
    });
    emit();
    return a;
  },
  // Mock `availabilities` query — seeded slots per clinician,
  // Mon–Fri, three slots/day (10:00, 13:00, 15:30), with `taken` reflecting
  // existing scheduled appointments.
  findApptConflict(
    clinicianId: string,
    startISO: string,
    excludeApptId?: string,
  ): Appointment | undefined {
    const t = new Date(startISO).getTime();
    if (Number.isNaN(t)) return undefined;
    return appointments.find(
      (x) =>
        x.id !== excludeApptId &&
        x.clinicianId === clinicianId &&
        x.status === "scheduled" &&
        new Date(x.start).getTime() === t,
    );
  },
  getClinicianAvailability(
    clinicianId: string,
    days = 14,
    opts?: { excludeApptId?: string },
  ): AvailabilitySlot[] {
    const slots: AvailabilitySlot[] = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    const hours = [10, 13, 15.5];
    // Per-clinician day offset so the three clinicians don't show identical
    // availability strips in the picker.
    const offset = clinicianId === "c1" ? 0 : clinicianId === "c2" ? 1 : 2;
    for (let d = 1; d <= days + 7; d++) {
      const day = new Date(base);
      day.setDate(base.getDate() + d);
      const dow = day.getDay();
      if (dow === 0 || dow === 6) continue;
      // Skip every Nth weekday per clinician to vary supply
      if ((d + offset) % 4 === 0) continue;
      for (const h of hours) {
        const slot = new Date(day);
        const hr = Math.floor(h);
        const min = (h - hr) * 60;
        slot.setHours(hr, min, 0, 0);
        if (slot.getTime() < Date.now()) continue;
        const iso = slot.toISOString();
        const taken = appointments.some(
          (x) =>
            x.id !== opts?.excludeApptId &&
            x.clinicianId === clinicianId &&
            x.status === "scheduled" &&
            new Date(x.start).getTime() === slot.getTime(),
        );
        slots.push({ start: iso, durationMin: 50, taken });
      }
    }
    return slots;
  },
  notifyAppointmentChange(input: {
    patientId: string;
    apptId: string;
    kind: ApptNotificationKind;
  }) {
    const p = patients.find((x) => x.id === input.patientId);
    if (!p) return;
    const channels: CommsChannel[] = ["profile"];
    if (AdelanteEHR.isSmsOn(p.id) && p.phone) channels.push("sms");
    if (p.email) channels.push("email");
    const now = new Date().toISOString();
    const entries: ApptNotification[] = channels.map((channel) => ({
      id: uid(),
      apptId: input.apptId,
      kind: input.kind,
      at: now,
      channel,
      state: channel === "profile" ? "delivered" : "queued",
      sentAt: channel === "profile" ? now : undefined,
      deliveredAt: channel === "profile" ? now : undefined,
    }));
    p.notifications = [...entries, ...(p.notifications ?? [])].slice(0, 40);
    emit();
    // Mock async delivery for sms/email.
    if (typeof setTimeout !== "undefined") {
      for (const entry of entries) {
        if (entry.channel === "profile") continue;
        setTimeout(() => AdelanteEHR.promoteNotification(p.id, entry.id, "sent"), 400);
        setTimeout(() => {
          // ~15% simulated delivery failure on sms; email always succeeds
          const fail = entry.channel === "sms" && Math.random() < 0.15;
          AdelanteEHR.promoteNotification(
            p.id,
            entry.id,
            fail ? "failed" : "delivered",
            fail ? "Carrier reported undeliverable" : undefined,
          );
        }, 1400);
      }
    }
  },
  promoteNotification(
    patientId: string,
    notificationId: string,
    state: NotificationState,
    error?: string,
  ) {
    const p = patients.find((x) => x.id === patientId);
    const n = p?.notifications?.find((x) => x.id === notificationId);
    if (!p || !n) return;
    n.state = state;
    const now = new Date().toISOString();
    if (state === "sent") n.sentAt = now;
    if (state === "delivered") {
      n.sentAt = n.sentAt ?? now;
      n.deliveredAt = now;
    }
    if (state === "failed") {
      n.error = error;
      // Auto-generate a CM outreach task once per failed delivery.
      const cmId = p.caseManagerId;
      if (cmId) {
        AdelanteEHR.createCaseTask({
          patientId: p.id,
          assignedTo: cmId,
          title: `Reach out — ${n.channel.toUpperCase()} delivery failed`,
          detail: `${n.kind} notification did not reach ${p.firstName} ${p.lastName} via ${n.channel}.`,
          dueDate: new Date().toISOString().slice(0, 10),
          origin: "notification_failed",
          dedupeKey: `notif-fail:${n.id}`,
        });
      }
    }
    emit();
  },
  resendNotification(patientId: string, notificationId: string) {
    const p = patients.find((x) => x.id === patientId);
    const n = p?.notifications?.find((x) => x.id === notificationId);
    if (!p || !n) return;
    n.state = "queued";
    n.error = undefined;
    n.sentAt = undefined;
    n.deliveredAt = undefined;
    emit();
    if (typeof setTimeout !== "undefined") {
      setTimeout(() => AdelanteEHR.promoteNotification(p.id, n.id, "sent"), 300);
      setTimeout(() => AdelanteEHR.promoteNotification(p.id, n.id, "delivered"), 900);
    }
  },
  latestNotificationForAppt(patientId: string, apptId: string): ApptNotification | undefined {
    const p = patients.find((x) => x.id === patientId);
    return p?.notifications?.find((n) => n.apptId === apptId);
  },
  updateAppointmentStatus(id: string, status: SessionStatus) {
    const a = appointments.find((x) => x.id === id);
    if (!a) return;
    const prev = a.status;
    a.status = status;
    if (status === "attended") {
      // Attended visits become "ready" claims (require billing coordinator submit).
      a.billingStatus = "ready";
      a.chargeCents = a.chargeCents ?? AdelanteEHR.chargeForService(a.serviceType);
    }
    // Auto-generate CM follow-up on no_show.
    if (status === "no_show" && prev !== "no_show") {
      const p = patients.find((x) => x.id === a.patientId);
      if (p?.caseManagerId) {
        AdelanteEHR.createCaseTask({
          patientId: p.id,
          assignedTo: p.caseManagerId,
          title: `Missed session — reach out to ${p.firstName}`,
          detail: `No-show on ${new Date(a.start).toLocaleDateString()}. Confirm status and rebook.`,
          dueDate: new Date().toISOString().slice(0, 10),
          origin: "missed_appt",
          dedupeKey: `missed:${a.id}`,
        });
      }
    }
    emit();
  },
  recordScreener(patientId: string, result: ScreenerResult) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    p.screeners[result.key] = result;
    p.screenerHistory = [...(p.screenerHistory ?? []), result];
    if (result.crisisFlag) {
      p.crisisFlag = { source: result.key, raisedAt: result.completedAt };
      if (p.caseManagerId) {
        AdelanteEHR.createCaseTask({
          patientId: p.id,
          assignedTo: p.caseManagerId,
          title: `Crisis flag — ${result.key.toUpperCase()}`,
          detail: `Screener flagged elevated risk. Follow safety protocol and document contact today.`,
          dueDate: new Date().toISOString().slice(0, 10),
          origin: "screener_flag",
          dedupeKey: `crisis:${p.id}:${result.key}`,
        });
      }
    }
    _recomputeCarePlan(p.id, `screener:${result.key}`);
    emit();
  },
  raiseCrisisFlag(patientId: string, source: string) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    p.crisisFlag = { source, raisedAt: new Date().toISOString() };
    emit();
  },
  setCoverage(patientId: string, coverage: NonNullable<Patient["coverage"]>) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    p.coverage = coverage;
    emit();
  },
  addCheckIn(patientId: string, checkIn: Omit<CheckIn, "id">) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    p.checkIns = [{ ...checkIn, id: uid() }, ...(p.checkIns ?? [])];
    _recomputeCarePlan(p.id, "check_in");
    emit();
  },
  addResourceReferral(patientId: string, r: Omit<ResourceReferral, "id" | "createdAt" | "status">) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    p.resourceReferrals = [
      { ...r, id: uid(), createdAt: new Date().toISOString(), status: "pending" },
      ...(p.resourceReferrals ?? []),
    ];
    emit();
  },
  updateCarePlanSummary(patientId: string, summary: string, by?: string) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    const trimmed = summary.trim();
    p.carePlanOverride = trimmed
      ? { text: trimmed, setAt: new Date().toISOString(), by }
      : undefined;
    _recomputeCarePlan(p.id, "clinician_summary");
    emit();
  },
  addGoal(patientId: string, text: string, createdBy?: string) {
    const p = patients.find((x) => x.id === patientId);
    if (!p || !text.trim()) return;
    p.goals = [
      ...(p.goals ?? []),
      {
        id: uid(),
        text: text.trim(),
        status: "open",
        createdAt: new Date().toISOString(),
        createdBy,
      },
    ];
    _recomputeCarePlan(p.id, "goal_added");
    emit();
  },
  setGoalStatus(
    patientId: string,
    goalId: string,
    status: Goal["status"],
    updatedBy?: string,
    actorRole?: string,
  ) {
    const p = patients.find((x) => x.id === patientId);
    const g = p?.goals?.find((x) => x.id === goalId);
    if (!g) return;
    const from = g.status;
    g.status = status;
    if (updatedBy) g.updatedBy = updatedBy;
    if (p) _recomputeCarePlan(p.id, "goal_status");
    // Append-only trace so clinicians/admins can follow how a goal moved
    // over time, including patient-driven updates from Patient Home.
    appendAudit({
      category: "care_plan",
      action: "goal_status_changed",
      patientId,
      actorRole: actorRole ?? (updatedBy ? "staff" : undefined),
      actorId: updatedBy,
      detail: { goalId, goalText: g.text, from, to: status },
    });
    emit();
  },
  removeGoal(patientId: string, goalId: string) {
    const p = patients.find((x) => x.id === patientId);
    if (!p?.goals) return;
    p.goals = p.goals.filter((g) => g.id !== goalId);
    _recomputeCarePlan(p.id, "goal_removed");
    emit();
  },
  addProgressNote(patientId: string, note: Omit<ProgressNote, "id">) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    const row: ProgressNote = {
      ...note,
      id: uid(),
      // Everything written today is human-authored; the seam exists so a
      // machine-drafted note is representable without changing signing.
      authorSource: note.authorSource ?? "human",
      status: note.status ?? "draft",
    };
    p.progressNotes = [row, ...(p.progressNotes ?? [])];
    _recomputeCarePlan(p.id, "progress_note");
    appendAudit({
      category: "clinical",
      action: "note_drafted",
      patientId,
      actorId: note.clinicianId,
      detail: {
        noteId: row.id,
        sessionType: row.sessionType,
        authorSource: row.authorSource,
        category: row.category ?? null,
      },
    });
    emit();
    return row;
  },

  // ----- Note sign / cosign lifecycle -------------------------------------
  // TODO(auth): attestation is checkbox-only, exactly like Orders / MAR /
  // Refusal. Signer eligibility is ROLE-based; Adelante has no credentialing
  // -> signing RPC, so unlike the reference EMR there is no license/NPI check.
  _findNote(patientId: string, noteId: string) {
    const p = patients.find((x) => x.id === patientId);
    const n = p?.progressNotes?.find((x) => x.id === noteId);
    return { p, n };
  },

  signProgressNote(
    patientId: string,
    noteId: string,
    input: {
      signedBy: string;
      role: string;
      attested: boolean;
      cosignRequired?: boolean;
      cosignRole?: string[];
      /**
       * §Phase 3b — autofill content resolved at SIGN time. Once written it is
       * never recomputed, so the signed record reflects what was true when it
       * was attested.
       */
      autofillSnapshots?: AutofillSnapshot[];
      /**
       * §Crisis escalation — required when the note's scoring lands in a band
       * with `triggersCrisis`. There is no third option: the signer either
       * escalates or records why not. Silence is not a valid outcome.
       */
      crisisDecision?:
        | { kind: "escalate" }
        | { kind: "not_escalating"; reason: string };
    },
  ): ProgressNote {
    const { n } = AdelanteEHR._findNote(patientId, noteId);
    if (!n) throw new Error("Note not found.");
    const status = noteStatus(n);
    if (status !== "draft" && status !== "declined")
      throw new Error("Only a draft note can be signed.");
    if (!input.attested) throw new Error("Attestation is required to sign a note.");
    const selfSign = (NOTE_SELF_SIGN_ROLES as readonly string[]).includes(input.role);
    const cosignRequired = input.cosignRequired ?? !selfSign;
    if (!selfSign && !cosignRequired)
      throw new Error("Your role cannot sign this note without a cosigner.");

    // Crisis-band gate — evaluated BEFORE any mutation so a blocked note stays
    // an untouched draft.
    const crisisScores = crisisTriggeringScores(n.templateSchema, n.templateAnswers ?? {});
    if (crisisScores.length > 0) {
      const decision = input.crisisDecision;
      if (!decision)
        throw new Error(
          "This score is in a crisis band — escalate now or record why you are not escalating.",
        );
      if (decision.kind === "not_escalating" && (decision.reason?.trim().length ?? 0) < 3)
        throw new Error("A reason of at least 3 characters is required when not escalating.");
    }

    n.signedBy = input.signedBy;
    n.signedAt = new Date().toISOString();
    if (input.autofillSnapshots) n.autofillSnapshots = input.autofillSnapshots;
    n.cosignRequired = cosignRequired;
    n.cosignRole = input.cosignRole?.length ? input.cosignRole : undefined;
    n.status = cosignRequired ? "cosign_pending" : "signed";
    // A new signature clears any prior decline trail from the record's face.
    n.declineReason = undefined;
    n.declinedBy = undefined;
    n.declinedAt = undefined;
    appendAudit({
      category: "clinical",
      action: "note_signed",
      patientId,
      actorId: input.signedBy,
      actorRole: input.role,
      detail: {
        noteId,
        status: n.status,
        cosignRequired,
        cosignRole: n.cosignRole ?? null,
        authorSource: n.authorSource ?? "human",
      },
    });
    // §Notification feed — cosign routing. No named-cosigner field exists on
    // ProgressNote, so a note routes to its eligible cosign role pool.
    if (cosignRequired) {
      const roles = (n.cosignRole?.length
        ? n.cosignRole
        : (NOTE_SELF_SIGN_ROLES as readonly string[])) as StaffRole[];
      const subject = `Cosignature needed — ${n.templateTitle ?? "progress note"}`;
      const body = `${input.signedBy} signed a note for ${patientLabel(patientId)} that requires your cosignature.`;
      for (const r of roles) {
        AdelanteEHR.notify({
          recipientRole: r,
          category: "cosign_request",
          subject,
          body,
          linkRoute: "/cosign-inbox",
          patientId,
        });
      }
    }
    if (crisisScores.length > 0 && input.crisisDecision) {
      const detail = crisisScores.map(describeCrisisScore).join("; ");
      if (input.crisisDecision.kind === "escalate") {
        AdelanteEHR.flagCrisis(patientId, input.signedBy, detail, {
          triggerSource: "screener_score",
          sourceNoteId: noteId,
        });
      } else {
        appendAudit({
          category: "clinical",
          action: "crisis_escalation_declined",
          patientId,
          actorId: input.signedBy,
          actorRole: input.role,
          detail: {
            noteId,
            triggerDetail: detail,
            reason: input.crisisDecision.reason.trim(),
          },
        });
      }
    }
    // §Phase 3c — automations fire on the transition to a FINAL signature.
    // A note routed for cosignature is not final yet, so nothing runs until
    // the cosigner attests (see cosignProgressNote).
    if (n.status === "signed")
      AdelanteEHR.runNoteAutomations(patientId, noteId, {
        actorId: input.signedBy,
        actorRole: input.role,
      });
    emit();
    return n;
  },

  cosignProgressNote(
    patientId: string,
    noteId: string,
    input: { cosignedBy: string; role: string; attested: boolean; comment?: string },
  ): ProgressNote {
    const { n } = AdelanteEHR._findNote(patientId, noteId);
    if (!n) throw new Error("Note not found.");
    if (noteStatus(n) !== "cosign_pending") throw new Error("This note is not awaiting cosign.");
    if (!input.attested) throw new Error("Attestation is required to cosign a note.");
    if (!(NOTE_SELF_SIGN_ROLES as readonly string[]).includes(input.role))
      throw new Error("Your role cannot cosign clinical notes.");
    if (n.cosignRole?.length && !n.cosignRole.includes(input.role))
      throw new Error("This note requires a different cosigning role.");
    if (n.signedBy === input.cosignedBy)
      throw new Error("A note cannot be cosigned by its signer.");

    n.cosignedBy = input.cosignedBy;
    n.cosignedAt = new Date().toISOString();
    n.cosignComment = input.comment?.trim() || undefined;
    n.status = "cosigned";
    appendAudit({
      category: "clinical",
      action: "note_cosigned",
      patientId,
      actorId: input.cosignedBy,
      actorRole: input.role,
      detail: { noteId, comment: n.cosignComment ?? null, signedBy: n.signedBy ?? null },
    });
    AdelanteEHR.runNoteAutomations(patientId, noteId, {
      actorId: input.cosignedBy,
      actorRole: input.role,
    });
    emit();
    return n;
  },

  // ----- §Phase 3c: post-sign automations ---------------------------------
  //
  // Conservative by construction:
  //   visible   — every artifact carries sourceNoteId + sourceAutomationId and
  //               renders an "Auto-created from …" trace in the UI.
  //   reversible— a task can be completed/snoozed and a draft note deleted or
  //               simply left unsigned. Nothing here touches the signed record.
  //   idempotent— the run log below is checked before firing and appended to
  //               after, so a (noteId, automationId) pair fires at most once
  //               for the life of the note.
  //
  // NOT SUPPORTED, deliberately: order / order_set actions. See the scope note
  // in templateSchema.ts — nothing here can place a medication order.

  listNoteAutomationRuns(noteId?: string): NoteAutomationRun[] {
    return noteAutomationRuns
      .filter((r) => !noteId || r.noteId === noteId)
      .map((r) => ({ ...r }));
  },

  hasAutomationRun(noteId: string, automationId: string): boolean {
    return noteAutomationRuns.some((r) => r.noteId === noteId && r.automationId === automationId);
  },

  /**
   * The automations that WOULD fire for a note right now, given its answers
   * and the patient's active problems. Backs the pre-sign summary the
   * clinician sees, and is the same selection the runner uses — one source of
   * truth, so the preview cannot disagree with the behaviour.
   */
  plannedNoteAutomations(
    patientId: string,
    schema: TemplateSchema | undefined,
    answers: TemplateAnswers | undefined,
  ): Automation[] {
    const active = AdelanteEHR.listProblems(patientId)
      .filter(isProblemClinicallyActive)
      .map((p) => ({ category: p.category, icd10Code: p.icd10Code }));
    return plannedAutomations(schema, answers ?? {}, active);
  },

  /**
   * Execute a signed note's automations exactly once each. Safe to call again:
   * already-logged pairs are skipped.
   */
  runNoteAutomations(
    patientId: string,
    noteId: string,
    actor: { actorId: string; actorRole?: string },
  ): NoteAutomationRun[] {
    const { p, n } = AdelanteEHR._findNote(patientId, noteId);
    if (!p || !n) return [];
    const planned = AdelanteEHR.plannedNoteAutomations(patientId, n.templateSchema, n.templateAnswers);
    const fired: NoteAutomationRun[] = [];

    for (const automation of planned) {
      // Idempotency gate. Non-negotiable — checked before ANY side effect.
      if (AdelanteEHR.hasAutomationRun(noteId, automation.id)) continue;

      const run: NoteAutomationRun = {
        noteId,
        automationId: automation.id,
        patientId,
        ranAt: new Date().toISOString(),
        resultKind: "skipped",
      };

      if (automation.action.kind === "schedule_task") {
        const { taskType, dueInDays, priority } = automation.action;
        const due = new Date();
        due.setDate(due.getDate() + (Number.isFinite(dueInDays) ? dueInDays : 0));
        // Reuses the ONE task creation path — no parallel task system.
        const task = AdelanteEHR.createCaseTask({
          patientId,
          // Automations create work for the patient's case manager when there
          // is one; otherwise it lands with the signer so it is never orphaned.
          assignedTo: p.caseManagerId ?? actor.actorId,
          title: taskType,
          detail: `${automation.label} — auto-created when "${n.templateTitle ?? "a progress note"}" was signed.`,
          dueDate: due.toISOString().slice(0, 10),
          origin: "note_automation",
          sourceNoteId: noteId,
          sourceAutomationId: automation.id,
          sourceTemplateTitle: n.templateTitle,
          priority: priority ?? "routine",
        });
        run.resultKind = task ? "case_task" : "skipped";
        run.resultId = task?.id;
        if (!task) run.skipReason = "task_creation_failed";
      } else {
        const key = automation.action.templateKey?.trim() || n.templateKey;
        // Latest active version of the target key — never a superseded row.
        const target = key
          ? AdelanteEHR.listNoteTemplates().find((t) => t.key.toLowerCase() === key.toLowerCase())
          : undefined;
        if (!target) {
          run.skipReason = key
            ? `no_active_template_for_key:${key}`
            : "no_template_key_on_source_note";
        } else {
          const draft = AdelanteEHR.addProgressNote(patientId, {
            clinicianId: n.clinicianId,
            date: new Date().toISOString(),
            sessionType: n.sessionType,
            subjective: "",
            objective: "",
            assessment: "",
            plan: "",
            category: n.category,
            // Authored by a human later; the automation only opened the draft.
            authorSource: "human",
            status: "draft",
            templateId: target.id,
            templateKey: target.key,
            templateTitle: target.title,
            templateVersion: target.version,
            templateSchema: target.schema,
            templateAnswers: {},
            automationOrigin: {
              sourceNoteId: noteId,
              automationId: automation.id,
              label: automation.label,
              sourceTemplateTitle: n.templateTitle,
            },
          });
          run.resultKind = draft ? "draft_note" : "skipped";
          run.resultId = draft?.id;
          if (!draft) run.skipReason = "draft_creation_failed";
        }
      }

      noteAutomationRuns.push(run);
      fired.push(run);
      appendAudit({
        category: "clinical",
        action: "note_automation_ran",
        patientId,
        actorId: actor.actorId,
        actorRole: actor.actorRole,
        detail: {
          noteId,
          automationId: automation.id,
          label: automation.label,
          summary: summarizeAutomation(automation),
          actionKind: automation.action.kind,
          resultKind: run.resultKind,
          resultId: run.resultId ?? null,
          skipReason: run.skipReason ?? null,
        },
      });
    }

    if (fired.length) emit();
    return fired;
  },

  /**
   * Decline a cosign request. The note returns to `draft` so the author can
   * revise and re-sign.
   *
   * KNOWN GAP vs. the reference EMR: the reference also voids orders signed in
   * the same encounter. Adelante has no note<->order link (orders are not
   * encounter-scoped and carry no noteId), so no orders are touched here. The
   * decline is recorded with `ordersVoided: 0` and `orderCascade:
   * "unavailable_no_note_order_link"` so the omission is visible in the audit
   * log rather than silently absent.
   */
  declineProgressNoteCosign(
    patientId: string,
    noteId: string,
    input: { declinedBy: string; role: string; reason: string },
  ): ProgressNote {
    const { n } = AdelanteEHR._findNote(patientId, noteId);
    if (!n) throw new Error("Note not found.");
    if (noteStatus(n) !== "cosign_pending") throw new Error("This note is not awaiting cosign.");
    const reason = (input.reason ?? "").trim();
    if (reason.length < 3)
      throw new Error("A decline reason of at least 3 characters is required.");

    n.declineReason = reason;
    n.declinedBy = input.declinedBy;
    n.declinedAt = new Date().toISOString();
    n.status = "draft";
    n.signedBy = undefined;
    n.signedAt = undefined;
    n.cosignedBy = undefined;
    n.cosignedAt = undefined;
    n.cosignComment = undefined;
    appendAudit({
      category: "clinical",
      action: "note_cosign_declined",
      patientId,
      actorId: input.declinedBy,
      actorRole: input.role,
      detail: {
        noteId,
        reason,
        returnedTo: "draft",
        ordersVoided: 0,
        orderCascade: "unavailable_no_note_order_link",
      },
    });
    emit();
    return n;
  },

  /** Cross-patient cosign queue: signed notes still awaiting a cosignature. */
  listNotesAwaitingCosign(): { patient: Patient; note: ProgressNote }[] {
    const out: { patient: Patient; note: ProgressNote }[] = [];
    for (const p of patients) {
      for (const n of p.progressNotes ?? []) {
        if (n.cosignRequired && !n.cosignedAt && noteStatus(n) === "cosign_pending") {
          out.push({ patient: p, note: n });
        }
      }
    }
    return out.sort((a, b) => (a.note.signedAt ?? "").localeCompare(b.note.signedAt ?? ""));
  },

  // ----- §Inbox: unsigned notes + provider requests -----
  /**
   * Cross-patient drafts authored BY this staff identity. `authorId` is the
   * same token the Notes tab writes to `clinicianId` (`clinicianId ?? staffId`),
   * so a queue never shows another clinician's unfinished work. Oldest first.
   */
  listDraftNotesBy(authorId: string): { patient: Patient; note: ProgressNote }[] {
    const me = (authorId ?? "").trim();
    if (!me) return [];
    const out: { patient: Patient; note: ProgressNote }[] = [];
    for (const p of patients) {
      for (const n of p.progressNotes ?? []) {
        if (n.clinicianId === me && noteStatus(n) === "draft" && !n.signedBy) {
          out.push({ patient: p, note: n });
        }
      }
    }
    return out.sort((a, b) => a.note.date.localeCompare(b.note.date));
  },

  listProviderRequests(): ProviderRequest[] {
    return [...providerRequests].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  createProviderRequest(input: {
    patientId: string;
    requestType: ProviderRequest["requestType"];
    context: string;
    requestedBy: string;
    requestedByRole: StaffRole;
  }): ProviderRequest | undefined {
    const context = input.context.trim();
    if (!context) return undefined;
    const row: ProviderRequest = {
      id: uid(),
      patientId: input.patientId,
      requestType: input.requestType,
      context,
      requestedBy: input.requestedBy,
      requestedByRole: input.requestedByRole,
      status: "open",
      createdAt: new Date().toISOString(),
    };
    providerRequests.unshift(row);
    appendAudit({
      category: "clinical",
      action: "provider_request_created",
      patientId: row.patientId,
      actorId: row.requestedBy,
      actorRole: row.requestedByRole,
      detail: { requestId: row.id, requestType: row.requestType },
    });
    emit();
    return row;
  },

  /**
   * Claim = "I'm taking this". No reason required and no takeover path: a
   * claimed request is simply not claimable again. Releasing is the escape
   * hatch if someone claims the wrong row.
   */
  claimProviderRequest(id: string, staffName: string, role: StaffRole): boolean {
    const r = providerRequests.find((x) => x.id === id);
    if (!r || r.status !== "open") return false;
    r.status = "claimed";
    r.claimedBy = staffName;
    r.assignedTo = staffName;
    r.claimedAt = new Date().toISOString();
    appendAudit({
      category: "clinical",
      action: "provider_request_claimed",
      patientId: r.patientId,
      actorId: staffName,
      actorRole: role,
      detail: { requestId: r.id },
    });
    emit();
    return true;
  },

  /** Undo a claim (wrong row, handing off). Returns it to the unclaimed pool. */
  releaseProviderRequest(id: string, staffName: string, role: StaffRole): boolean {
    const r = providerRequests.find((x) => x.id === id);
    if (!r || r.status !== "claimed") return false;
    r.status = "open";
    r.claimedBy = undefined;
    r.assignedTo = undefined;
    r.claimedAt = undefined;
    appendAudit({
      category: "clinical",
      action: "provider_request_released",
      patientId: r.patientId,
      actorId: staffName,
      actorRole: role,
      detail: { requestId: r.id },
    });
    emit();
    return true;
  },

  /** Complete + report back to the original requester through the feed. */
  completeProviderRequest(
    id: string,
    staffName: string,
    role: StaffRole,
    outcome?: string,
  ): boolean {
    const r = providerRequests.find((x) => x.id === id);
    if (!r || r.status === "done") return false;
    r.status = "done";
    r.outcome = outcome?.trim() || undefined;
    r.completedBy = staffName;
    r.completedAt = new Date().toISOString();
    if (!r.assignedTo) r.assignedTo = staffName;
    AdelanteEHR.notify({
      recipientStaffId: r.requestedBy,
      category: "provider_request_completed",
      subject: `Request completed — ${patientLabel(r.patientId)}`,
      body: r.outcome
        ? `${staffName} completed your ${r.requestType === "order_entry" ? "order-entry" : "question"} request: ${r.outcome}`
        : `${staffName} completed your ${r.requestType === "order_entry" ? "order-entry" : "question"} request.`,
      linkRoute: "/inbox",
      patientId: r.patientId,
    });
    appendAudit({
      category: "clinical",
      action: "provider_request_completed",
      patientId: r.patientId,
      actorId: staffName,
      actorRole: role,
      detail: { requestId: r.id, hasOutcome: Boolean(r.outcome) },
    });
    emit();
    return true;
  },

  // ----- Consent state + audit log -----
  getConsentState(patientId: string) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return { part2Sud: false, ecmShare: false, sms: true };
    const base = p.consentState ?? {
      part2Sud: p.consents.part2Sud,
      ecmShare: Boolean(p.coverage?.ecmEligible),
      sms: p.smsFallback,
    };
    // §ASCMI — Part 2 is now DERIVED from the structured record, evaluated
    // live on every read. The legacy boolean is only a fallback for patients
    // who have no ConsentRecord captured yet.
    return { ...base, part2Sud: AdelanteEHR.isConsentCategoryAuthorized(patientId, "sud_treatment") };
  },

  // ----- §ASCMI structured consent records -------------------------------
  listConsentRecords(patientId?: string): ConsentRecord[] {
    return consentRecords
      .filter((r) => !patientId || r.patientId === patientId)
      .map((r) => ({ ...r, status: effectiveConsentStatus(r) }))
      .sort((a, b) => +new Date(b.signedAt) - +new Date(a.signedAt));
  },
  /** The single record currently in force for a patient, if any. */
  activeConsentRecord(patientId: string, at = new Date()): ConsentRecord | undefined {
    return consentRecords.find(
      (r) => r.patientId === patientId && effectiveConsentStatus(r, at) === "active",
    );
  },
  /**
   * LIVE consent check — no caching anywhere. Every gate calls this at the
   * moment of access, which is what makes revocation/expiry auto-stop access
   * with no code path needing to be told to stop.
   */
  isConsentCategoryAuthorized(
    patientId: string,
    category: ConsentCategory,
    at = new Date(),
  ): boolean {
    const has = consentRecords.some((r) => r.patientId === patientId);
    if (!has) {
      // Legacy fallback: patients with no structured record yet.
      const p = patients.find((x) => x.id === patientId);
      if (!p) return false;
      if (category !== "sud_treatment") return false;
      return p.consentState?.part2Sud ?? p.consents.part2Sud;
    }
    const rec = AdelanteEHR.activeConsentRecord(patientId, at);
    if (!rec) return false;
    return Boolean(rec.sections.find((s) => s.category === category)?.authorized);
  },
  createConsentRecord(input: {
    patientId: string;
    formType: ConsentFormType;
    source: string;
    signedByName: string;
    relationship?: "patient" | "guardian" | "proxy";
    attested: boolean;
    effectiveDate: string;
    expirationDate?: string;
    sections: ConsentRecordSection[];
    capturedBy: { staffId?: string; staffName: string; role: string };
    supersedesId?: string;
  }): ConsentRecord {
    if (!patients.some((p) => p.id === input.patientId)) throw new Error("Patient not found.");
    if (!input.attested) throw new Error("Attestation is required to capture a consent record.");
    if (input.signedByName.trim().length < 2)
      throw new Error("A typed signature name is required.");
    if (!input.effectiveDate) throw new Error("An effective date is required.");
    const now = new Date().toISOString();
    // A new record supersedes whatever was in force — history is preserved.
    const prior = AdelanteEHR.activeConsentRecord(input.patientId);
    if (prior) prior.status = "superseded";
    const rec: ConsentRecord = {
      id: uid(),
      patientId: input.patientId,
      formType: input.formType,
      source: input.source,
      signedAt: now,
      signedBy: { name: input.signedByName.trim(), relationship: input.relationship ?? "patient" },
      capturedBy: input.capturedBy,
      attestationMethod: "checkbox_only",
      effectiveDate: input.effectiveDate,
      expirationDate: input.expirationDate,
      status: "active",
      supersedesId: input.supersedesId ?? prior?.id,
      sections: input.sections,
    };
    consentRecords.unshift(rec);
    appendAudit({
      category: "consent",
      action: "consent_record_created",
      patientId: rec.patientId,
      actorId: input.capturedBy.staffName,
      actorRole: input.capturedBy.role,
      detail: {
        consentRecordId: rec.id,
        formType: rec.formType,
        source: rec.source,
        effectiveDate: rec.effectiveDate,
        expirationDate: rec.expirationDate,
        supersedesId: rec.supersedesId,
        categories: rec.sections.filter((s) => s.authorized).map((s) => s.category),
      },
    });
    emit();
    return rec;
  },
  revokeConsentRecord(
    recordId: string,
    input: { reason: string; revokedBy: string; role: string },
  ): ConsentRecord {
    const rec = consentRecords.find((r) => r.id === recordId);
    if (!rec) throw new Error("Consent record not found.");
    if (rec.status === "revoked") throw new Error("This record is already revoked.");
    if (input.reason.trim().length < 3) throw new Error("A revocation reason is required.");
    // Never delete: the original stays on file, status transitions only.
    rec.status = "revoked";
    rec.revokedAt = new Date().toISOString();
    rec.revokedBy = input.revokedBy;
    rec.revocationReason = input.reason.trim();
    appendAudit({
      category: "consent",
      action: "consent_record_revoked",
      patientId: rec.patientId,
      actorId: input.revokedBy,
      actorRole: input.role,
      detail: { consentRecordId: rec.id, formType: rec.formType, reason: rec.revocationReason },
    });
    emit();
    return rec;
  },
  /**
   * §ASCMI disclosure trail — fired when consent-gated content is actually
   * INCLUDED in an export/print. Category-level only: never the content.
   */
  recordConsentDisclosure(input: {
    patientId: string;
    categories: ConsentCategory[];
    purpose: string;
    role: string;
    actorId?: string;
    itemCount?: number;
  }) {
    const rec = AdelanteEHR.activeConsentRecord(input.patientId);
    appendAudit({
      category: "disclosure",
      action: "consent_gated_content_disclosed",
      patientId: input.patientId,
      actorRole: input.role,
      actorId: input.actorId,
      detail: {
        categories: input.categories,
        purpose: input.purpose,
        count: input.itemCount,
        consentRecordId: rec?.id,
      },
    });
  },

  setConsent(patientId: string, purpose: ConsentPurpose, granted: boolean, note?: string) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    const prev = p.consentState ?? {
      part2Sud: p.consents.part2Sud,
      ecmShare: Boolean(p.coverage?.ecmEligible),
      sms: p.smsFallback,
    };
    if (purpose !== "hipaa") {
      p.consentState = { ...prev, [purpose]: granted } as Patient["consentState"];
    }
    if (purpose === "part2Sud") p.consents.part2Sud = granted;
    if (purpose === "sms") p.smsFallback = granted;
    // Keep the structured record authoritative: the legacy per-purpose toggle
    // now MIRRORS into it, so there is still exactly one source of truth.
    if (purpose === "part2Sud" && consentRecords.some((r) => r.patientId === p.id)) {
      const active = AdelanteEHR.activeConsentRecord(p.id);
      if (!granted && active) {
        active.status = "revoked";
        active.revokedAt = new Date().toISOString();
        active.revokedBy = "legacy consent toggle";
        active.revocationReason = note ?? "Part 2 consent toggled off";
      } else if (granted && !active) {
        consentRecords.unshift({
          id: uid(),
          patientId: p.id,
          formType: "NonAB133",
          source: "legacy consent toggle",
          signedAt: new Date().toISOString(),
          signedBy: { name: `${p.firstName} ${p.lastName}`, relationship: "patient" },
          attestationMethod: "checkbox_only",
          effectiveDate: new Date().toISOString().slice(0, 10),
          status: "active",
          sections: CONSENT_CATEGORIES.map((c) => ({
            category: c.key,
            authorized: c.key === "sud_treatment",
          })),
        });
      }
    }
    p.consentEvents = [
      ...(p.consentEvents ?? []),
      {
        id: uid(),
        purpose,
        action: granted ? "granted" : "revoked",
        at: new Date().toISOString(),
        actor: "patient",
        note,
      },
    ];
    appendAudit({
      category: "consent",
      action: granted ? "granted" : "revoked",
      patientId: p.id,
      detail: { purpose, note },
    });
    emit();
  },
  listAllConsentEvents() {
    return patients
      .flatMap((p) => (p.consentEvents ?? []).map((e) => ({ ...e, programId: p.programId })))
      .sort((a, b) => +new Date(b.at) - +new Date(a.at));
  },

  // Single source of truth for "is SMS reminders / fallback active?"
  // Reads revocable consent first; falls back to legacy patient.smsFallback.
  isSmsOn(patientId: string): boolean {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return false;
    return p.consentState?.sms ?? p.smsFallback;
  },

  // ----- ECM / Community Supports flags -----
  setEcmEligible(patientId: string, eligible: boolean) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    p.coverage = {
      ...(p.coverage ?? { status: "none_unsure", verified: "not_found" }),
      ecmEligible: eligible,
    };
    emit();
  },
  setCommunitySupport(patientId: string, key: "housing" | "food" | "transport", on: boolean) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    const base = p.coverage ?? {
      status: "none_unsure" as CoverageStatus,
      verified: "not_found" as const,
    };
    p.coverage = {
      ...base,
      communitySupports: { ...(base.communitySupports ?? {}), [key]: on },
    };
    emit();
  },
  setJiReentry(patientId: string, on: boolean) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    const base = p.coverage ?? {
      status: "none_unsure" as CoverageStatus,
      verified: "not_found" as const,
    };
    p.coverage = { ...base, jiReentryFlag: on };
    emit();
  },
  markCoverageVerified(patientId: string) {
    const p = patients.find((x) => x.id === patientId);
    if (!p?.coverage) return;
    p.coverage = { ...p.coverage, verified: "verified", status: "active" };
    emit();
  },
  requestReactivation(patientId: string) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    p.tasks = [
      {
        id: uid(),
        kind: "reactivation",
        label: "Medi-Cal reactivation requested with county",
        createdAt: new Date().toISOString(),
      },
      ...(p.tasks ?? []),
    ];
    if (p.coverage) p.coverage = { ...p.coverage, verified: "pending" };
    emit();
  },
  addEnrollmentAssistTask(patientId: string) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    p.tasks = [
      {
        id: uid(),
        kind: "enrollment_assist",
        label: "Case manager will help with BenefitsCal enrollment",
        createdAt: new Date().toISOString(),
      },
      ...(p.tasks ?? []),
    ];
    emit();
  },

  // ----- Re-screening cadence -----
  // Returns screener keys due for re-screening based on day 30/60/90 cadence.
  rescreensDue(
    patientId: string,
  ): { key: string; lastDays: number | null; nextDue: 30 | 60 | 90 }[] {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return [];
    const keys = ["phq-9", "gad-7", "audit", "dast-10", "pcl-5"];
    const out: { key: string; lastDays: number | null; nextDue: 30 | 60 | 90 }[] = [];
    const now = Date.now();
    for (const key of keys) {
      const history = (p.screenerHistory ?? []).filter((h) => h.key === key);
      if (history.length === 0) continue;
      const last = history.reduce((acc, h) =>
        +new Date(h.completedAt) > +new Date(acc.completedAt) ? h : acc,
      );
      const days = Math.floor((now - +new Date(last.completedAt)) / (1000 * 60 * 60 * 24));
      const intervals: (30 | 60 | 90)[] = [30, 60, 90];
      const due = intervals.find((d) => days >= d);
      if (due) out.push({ key, lastDays: days, nextDue: due });
    }
    return out;
  },
  sendRescreenTask(patientId: string, key: string) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    p.tasks = [
      {
        id: uid(),
        kind: "rescreen",
        label: `Re-screen requested: ${key.toUpperCase()}`,
        screenerKey: key,
        createdAt: new Date().toISOString(),
      },
      ...(p.tasks ?? []),
    ];
    emit();
  },
  completeTask(patientId: string, taskId: string) {
    const p = patients.find((x) => x.id === patientId);
    const t = p?.tasks?.find((x) => x.id === taskId);
    if (!t) return;
    t.completedAt = new Date().toISOString();
    emit();
  },

  // Analytics helpers
  stats() {
    const enrolled = patients.length;
    const completed = appointments.filter((a) => a.status === "attended").length;
    const total = appointments.filter((a) => a.status !== "scheduled").length;
    const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);
    const intakeVelocityDays = 2.4; // mock: avg referral → first session
    const billing = {
      draft: appointments.filter((a) => a.billingStatus === "draft").length,
      submitted: appointments.filter((a) => a.billingStatus === "submitted").length,
      paid: appointments.filter((a) => a.billingStatus === "paid").length,
      denied: appointments.filter((a) => a.billingStatus === "denied").length,
    };
    return { enrolled, completionRate, intakeVelocityDays, billing };
  },

  // ----- §3c — T-minus helper (days until release; negative = post-release) -----
  tMinus(patientId: string): number | null {
    const p = patients.find((x) => x.id === patientId);
    if (!p?.releaseDate) return null;
    const ms = +new Date(p.releaseDate) - Date.now();
    return Math.round(ms / (1000 * 60 * 60 * 24));
  },

  // ----- SDOH plan items -----
  addSdohItem(
    patientId: string,
    input: { need: string; note?: string; visibleToPatient?: boolean },
  ) {
    const p = patients.find((x) => x.id === patientId);
    if (!p || !input.need.trim()) return;
    const item: SdohPlanItem = {
      id: uid(),
      need: input.need.trim(),
      status: "identified",
      note: input.note,
      visibleToPatient: input.visibleToPatient ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    p.sdohPlan = { items: [item, ...(p.sdohPlan?.items ?? [])] };
    _recomputeCarePlan(p.id, "sdoh_added");
    emit();
  },
  setSdohStatus(patientId: string, itemId: string, status: SdohStatus, note?: string) {
    const p = patients.find((x) => x.id === patientId);
    const item = p?.sdohPlan?.items.find((i) => i.id === itemId);
    if (!item) return;
    item.status = status;
    if (note !== undefined) item.note = note;
    item.updatedAt = new Date().toISOString();
    if (p) _recomputeCarePlan(p.id, "sdoh_status");
    emit();
  },
  setSdohVisibility(patientId: string, itemId: string, visible: boolean) {
    const p = patients.find((x) => x.id === patientId);
    const item = p?.sdohPlan?.items.find((i) => i.id === itemId);
    if (!item) return;
    item.visibleToPatient = visible;
    item.updatedAt = new Date().toISOString();
    emit();
  },
  removeSdohItem(patientId: string, itemId: string) {
    const p = patients.find((x) => x.id === patientId);
    if (!p?.sdohPlan) return;
    p.sdohPlan.items = p.sdohPlan.items.filter((i) => i.id !== itemId);
    emit();
  },

  // ----- Resource referral status/notes -----
  setResourceReferralStatus(
    patientId: string,
    referralId: string,
    status: ResourceReferral["status"],
    note?: string,
  ) {
    const p = patients.find((x) => x.id === patientId);
    const r = p?.resourceReferrals?.find((x) => x.id === referralId);
    if (!r) return;
    r.status = status;
    if (note !== undefined) r.note = note;
    r.updatedAt = new Date().toISOString();
    emit();
  },
  setResourceReferralVisibility(patientId: string, referralId: string, visible: boolean) {
    const p = patients.find((x) => x.id === patientId);
    const r = p?.resourceReferrals?.find((x) => x.id === referralId);
    if (!r) return;
    r.visibleToPatient = visible;
    r.updatedAt = new Date().toISOString();
    emit();
  },

  // ----- External contacts -----
  addExternalContact(patientId: string, input: Omit<ExternalContact, "id" | "createdAt">) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    p.externalContacts = [
      { ...input, id: uid(), createdAt: new Date().toISOString() },
      ...(p.externalContacts ?? []),
    ];
    emit();
  },
  removeExternalContact(patientId: string, contactId: string) {
    const p = patients.find((x) => x.id === patientId);
    if (!p?.externalContacts) return;
    p.externalContacts = p.externalContacts.filter((c) => c.id !== contactId);
    emit();
  },

  // ----- Coordination log -----
  addCoordinationEntry(patientId: string, input: Omit<CoordinationEntry, "id">) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    p.coordinationLog = [{ ...input, id: uid() }, ...(p.coordinationLog ?? [])];
    emit();
  },

  // ----- Peer notes -----
  addPeerNote(patientId: string, input: Omit<PeerNote, "id">) {
    const p = patients.find((x) => x.id === patientId);
    if (!p || !input.text.trim()) return;
    const note: PeerNote = { ...input, id: uid() };
    p.peerNotes = [note, ...(p.peerNotes ?? [])];
    emit();
    // Returned so the billing hook in ehr-ext can key a claim off this note.
    return note;
  },

  // ----- Contact preferences -----
  setContactPrefs(patientId: string, prefs: NonNullable<Patient["contactPrefs"]>) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    p.contactPrefs = prefs;
    emit();
  },

  // ----- Eligibility notes -----
  setEligibilityNote(patientId: string, key: EligibilityFlagKey, note: string, asOf?: string) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    p.eligibilityNotes = {
      ...(p.eligibilityNotes ?? {}),
      [key]: { note, asOf, updatedAt: new Date().toISOString() },
    };
    emit();
  },

  // ---------- Case task queue ----------
  // (§v3.0 Phase 2 pre-release API is defined just above the task queue it
  // reuses — every pre-release form is tracked as an ordinary CaseTask row.)

  // ---------- §v3.0 Phase 2 — pre-release episodes -----------------------
  listPreReleaseEpisodes(patientId?: string): PreReleaseEpisode[] {
    return preReleaseEpisodes
      .filter((e) => !patientId || e.patientId === patientId)
      .sort((a, b) => +new Date(b.openedAt) - +new Date(a.openedAt));
  },
  getPreReleaseEpisode(id: string): PreReleaseEpisode | undefined {
    return preReleaseEpisodes.find((e) => e.id === id);
  },
  /** The episode an ECM Provider's D0 intake should read for this patient. */
  activePreReleaseEpisode(patientId: string): PreReleaseEpisode | undefined {
    return preReleaseEpisodes.find((e) => e.patientId === patientId && e.status !== "closed");
  },
  openPreReleaseEpisode(input: {
    patientId: string;
    anticipatedReleaseDate: string;
    cfCareManagerStaffId: string;
    cfCareManagerName: string;
    facilityId?: string;
    bookingId?: string;
    receivingEcmStaffId?: string;
    openedBy: string;
    actorRole: string;
  }): PreReleaseEpisode {
    if (!patients.some((p) => p.id === input.patientId)) throw new Error("Patient not found.");
    if (!input.anticipatedReleaseDate)
      throw new Error("An anticipated release date is required to open a pre-release episode.");
    const existing = AdelanteEHR.activePreReleaseEpisode(input.patientId);
    if (existing) return existing;
    const facility = facilities.find((f) => f.id === input.facilityId);
    const ep: PreReleaseEpisode = {
      id: uid(),
      patientId: input.patientId,
      facilityId: input.facilityId,
      facilityName: facility?.name,
      bookingId: input.bookingId,
      anticipatedReleaseDate: input.anticipatedReleaseDate,
      cfCareManagerStaffId: input.cfCareManagerStaffId,
      cfCareManagerName: input.cfCareManagerName,
      receivingEcmStaffId: input.receivingEcmStaffId,
      status: "open",
      openedAt: new Date().toISOString(),
      openedBy: input.openedBy,
    };
    preReleaseEpisodes.unshift(ep);
    // Every form becomes a real worklist row — no parallel task mechanism.
    for (const def of PRE_RELEASE_FORMS) {
      AdelanteEHR.createCaseTask({
        patientId: ep.patientId,
        assignedTo: "",
        title: `Pre-release — ${def.label}`,
        detail: `${PRE_RELEASE_FORM_CATEGORIES.find((c) => c.key === def.category)?.label ?? def.category} · release ${ep.anticipatedReleaseDate}`,
        dueDate: ep.anticipatedReleaseDate,
        taskType: "pre_release_form",
        allowedRoles: ["cf_care_manager", "ecm_provider"],
        facilityId: ep.facilityId,
        facilityContext: true,
        source: "pre_release_episode",
        dedupeKey: `prerelease:${ep.id}:${def.key}`,
      });
    }
    appendAudit({
      category: "clinical",
      action: "pre_release_episode_opened",
      patientId: ep.patientId,
      actorId: input.openedBy,
      actorRole: input.actorRole,
      detail: {
        episodeId: ep.id,
        cfCareManagerStaffId: ep.cfCareManagerStaffId,
        anticipatedReleaseDate: ep.anticipatedReleaseDate,
      },
    });
    emit();
    return ep;
  },
  preReleaseTaskFor(episodeId: string, formKey: string): CaseTask | undefined {
    return caseTasks.find((t) => t.dedupeKey === `prerelease:${episodeId}:${formKey}`);
  },
  /**
   * Closes an episode (member released, transferred, or opened in error). The
   * episode and its captured forms are retained — they are the hand-off
   * record the ECM Provider reads at D0 — but the patient becomes eligible
   * for a new episode on a subsequent booking.
   */
  closePreReleaseEpisode(input: {
    episodeId: string;
    reason: string;
    closedBy: string;
    actorRole: string;
  }): PreReleaseEpisode {
    const ep = preReleaseEpisodes.find((e) => e.id === input.episodeId);
    if (!ep) throw new Error("Pre-release episode not found.");
    if (!input.reason.trim()) throw new Error("A reason is required to close a pre-release episode.");
    ep.status = "closed";
    ep.closedAt = new Date().toISOString();
    ep.closedReason = input.reason.trim();
    appendAudit({
      category: "clinical",
      action: "pre_release_episode_closed",
      patientId: ep.patientId,
      actorId: input.closedBy,
      actorRole: input.actorRole,
      detail: { episodeId: ep.id, reason: ep.closedReason },
    });
    emit();
    return ep;
  },
  listPreReleaseForms(episodeId: string): PreReleaseFormRecord[] {
    return preReleaseForms.filter((f) => f.episodeId === episodeId);
  },
  getPreReleaseForm(episodeId: string, formKey: string): PreReleaseFormRecord | undefined {
    return preReleaseForms.find((f) => f.episodeId === episodeId && f.formKey === formKey);
  },
  /**
   * The whole checklist for an episode: every category, its definition, the
   * captured record (if any) and a live status. Consent forms derive their
   * status from the ConsentRecord ledger, and transition planning from the
   * Reentry Care Plan — neither duplicates state into a form record.
   */
  preReleaseChecklist(episodeId: string): {
    def: PreReleaseFormDef;
    record?: PreReleaseFormRecord;
    task?: CaseTask;
    status: PreReleaseFormStatus;
  }[] {
    const ep = AdelanteEHR.getPreReleaseEpisode(episodeId);
    const plan = reentryCarePlans.find((p) => p.episodeId === episodeId);
    let changed = false;
    const rows = PRE_RELEASE_FORMS.map((def) => {
      const record = AdelanteEHR.getPreReleaseForm(episodeId, def.key);
      const task = AdelanteEHR.preReleaseTaskFor(episodeId, def.key);
      let status: PreReleaseFormStatus = record?.status ?? "not_started";
      if (def.consentCategory && ep) {
        status = AdelanteEHR.isConsentCategoryAuthorized(ep.patientId, def.consentCategory)
          ? "complete"
          : "not_started";
      }
      if (def.satisfiedByCarePlan) {
        status = plan?.status === "completed" ? "complete" : plan ? "in_progress" : "not_started";
      }
      // Keep the worklist row honest for the derived rows.
      if (task && status === "complete" && task.status !== "done") {
        AdelanteEHR.completeCaseTask(task.id);
        changed = true;
      }
      return { def, record, task, status };
    });
    if (changed) emit();
    return rows;
  },
  /**
   * Structured field capture for the two non-consent categories. Deliberately
   * refuses the consent and transition-planning categories: those have their
   * own instruments and must not be shadow-captured as loose fields.
   */
  savePreReleaseForm(input: {
    episodeId: string;
    formKey: string;
    values: Record<string, string | boolean>;
    complete: boolean;
    attribution: CfAttribution;
  }): PreReleaseFormRecord {
    const ep = AdelanteEHR.getPreReleaseEpisode(input.episodeId);
    if (!ep) throw new Error("Pre-release episode not found.");
    const def = PRE_RELEASE_FORMS.find((d) => d.key === input.formKey);
    if (!def) throw new Error("Unknown pre-release form.");
    assertCfEntryScope(ep, input.attribution, `pre_release_form:${input.formKey}`);
    if (def.consentCategory)
      throw new Error(
        "Release & consent forms are captured in the consent ledger, not as form fields.",
      );
    if (def.satisfiedByCarePlan)
      throw new Error("Transition planning is captured on the Reentry Care Plan.");
    if (input.complete) {
      const missing = def.fields
        .filter((f) => f.required)
        .filter((f) => {
          const v = input.values[f.key];
          return v === undefined || v === "" || v === null;
        });
      if (missing.length)
        throw new Error(`Required before completion: ${missing.map((f) => f.label).join(", ")}`);
    }
    const now = new Date().toISOString();
    let rec = AdelanteEHR.getPreReleaseForm(input.episodeId, input.formKey);
    if (!rec) {
      rec = {
        id: uid(),
        episodeId: ep.id,
        patientId: ep.patientId,
        category: def.category,
        formKey: def.key,
        values: {},
        status: "in_progress",
        updatedAt: now,
        attribution: input.attribution,
        taskId: AdelanteEHR.preReleaseTaskFor(ep.id, def.key)?.id,
      };
      preReleaseForms.unshift(rec);
    }
    rec.values = { ...rec.values, ...input.values };
    rec.attribution = input.attribution;
    rec.updatedAt = now;
    rec.status = input.complete ? "complete" : "in_progress";
    rec.completedAt = input.complete ? now : undefined;
    if (rec.taskId) {
      if (input.complete) AdelanteEHR.completeCaseTask(rec.taskId);
      else AdelanteEHR.reopenCaseTask(rec.taskId);
    }
    appendAudit({
      category: "clinical",
      action: cfAuditAction(
        input.complete ? "pre_release_form_completed" : "pre_release_form_saved",
        input.attribution,
      ),
      patientId: ep.patientId,
      actorId: input.attribution.enteredBy.staffName,
      actorRole: input.attribution.enteredBy.role,
      detail: {
        episodeId: ep.id,
        formKey: def.key,
        category: def.category,
        // Field VALUES are never audited — only which fields were touched.
        fields: Object.keys(input.values),
        ...cfAuditIdentities(input.attribution),
      },
    });
    emit();
    return rec;
  },

  // ---------- §v3.0 Phase 2 — Person-Centered Reentry Care Plan ----------
  getReentryCarePlan(episodeId: string): ReentryCarePlan | undefined {
    return reentryCarePlans.find((p) => p.episodeId === episodeId);
  },
  /**
   * The ECM Provider's D0 intake read: a queryable structured record, not a
   * PDF or a note.
   */
  reentryCarePlanForPatient(patientId: string): ReentryCarePlan | undefined {
    return reentryCarePlans
      .filter((p) => p.patientId === patientId)
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))[0];
  },
  saveReentryCarePlan(input: {
    episodeId: string;
    housing: ReentryCarePlan["housing"];
    appointments: Omit<ReentryAppointment, "id">[];
    pharmacy?: ReentryCarePlan["pharmacy"];
    dmeNeeds?: string[];
    notesToEcm?: string;
    attribution: CfAttribution;
  }): ReentryCarePlan {
    const ep = AdelanteEHR.getPreReleaseEpisode(input.episodeId);
    if (!ep) throw new Error("Pre-release episode not found.");
    let plan = AdelanteEHR.getReentryCarePlan(ep.id);
    if (plan?.status === "completed")
      throw new Error("This care plan is completed and member-signed; it can no longer be edited.");
    const now = new Date().toISOString();
    const appointments: ReentryAppointment[] = input.appointments.map((a) => ({ ...a, id: uid() }));
    if (!plan) {
      plan = {
        id: uid(),
        episodeId: ep.id,
        patientId: ep.patientId,
        housing: input.housing,
        appointments,
        pharmacy: input.pharmacy,
        dmeNeeds: input.dmeNeeds ?? [],
        notesToEcm: input.notesToEcm,
        status: "draft",
        attribution: input.attribution,
        updatedAt: now,
      };
      reentryCarePlans.unshift(plan);
    } else {
      plan.housing = input.housing;
      plan.appointments = appointments;
      plan.pharmacy = input.pharmacy;
      plan.dmeNeeds = input.dmeNeeds ?? [];
      plan.notesToEcm = input.notesToEcm;
      plan.attribution = input.attribution;
      plan.updatedAt = now;
    }
    emit();
    return plan;
  },
  /**
   * Completion + member signature + enrollment-code issue, in ONE transaction:
   * the code is the identity token for the later General Population match, so
   * a signed plan without a code must never be reachable.
   */
  completeReentryCarePlan(input: {
    episodeId: string;
    memberSignatureName: string;
    relationship?: "patient" | "guardian" | "proxy";
    attested: boolean;
    attribution: CfAttribution;
  }): { plan: ReentryCarePlan; enrollmentCode: EnrollmentCode } {
    const ep = AdelanteEHR.getPreReleaseEpisode(input.episodeId);
    if (!ep) throw new Error("Pre-release episode not found.");
    const plan = AdelanteEHR.getReentryCarePlan(ep.id);
    if (!plan) throw new Error("Save the care plan before completing it.");
    if (plan.status === "completed") throw new Error("This care plan is already completed.");
    if (!input.attested) throw new Error("Member attestation is required.");
    if (input.memberSignatureName.trim().length < 2)
      throw new Error("A typed member signature name is required.");
    if (!plan.housing.arrangement.trim())
      throw new Error("A post-release housing plan is required.");
    const kinds = new Set(plan.appointments.map((a) => a.kind));
    const missingKinds = (["mental_health", "med_management", "sud"] as ReentryAppointmentKind[])
      .filter((k) => !kinds.has(k));
    if (missingKinds.length === 3)
      throw new Error("At least one scheduled first appointment is required.");
    const undated = plan.appointments.filter((a) => !a.start || !a.providerName.trim());
    if (undated.length)
      throw new Error(
        "Every appointment needs a real date/time and provider — referrals without an appointment do not count.",
      );
    const now = new Date();
    const nowIso = now.toISOString();
    const expires = new Date(now.getTime() + ENROLLMENT_CODE_TTL_DAYS * 86400000).toISOString();
    const code: EnrollmentCode = {
      code: generateEnrollmentCode(),
      patientId: ep.patientId,
      episodeId: ep.id,
      carePlanId: plan.id,
      issuedAt: nowIso,
      expiresAt: expires,
    };
    enrollmentCodes.unshift(code);
    plan.status = "completed";
    plan.completedAt = nowIso;
    plan.updatedAt = nowIso;
    plan.enrollmentCode = code.code;
    plan.memberSignature = {
      name: input.memberSignatureName.trim(),
      relationship: input.relationship ?? "patient",
      attestationMethod: "checkbox_only",
      signedAt: nowIso,
    };
    const task = AdelanteEHR.preReleaseTaskFor(ep.id, "reentry_care_plan");
    if (task) AdelanteEHR.completeCaseTask(task.id);
    appendAudit({
      category: "clinical",
      action: "reentry_care_plan_completed",
      patientId: ep.patientId,
      actorId: input.attribution.enteredBy.staffName,
      actorRole: input.attribution.enteredBy.role,
      detail: {
        episodeId: ep.id,
        carePlanId: plan.id,
        // The code itself is an identity token — audit its existence, not its value.
        enrollmentCodeIssued: true,
        enrollmentCodeExpiresAt: code.expiresAt,
        appointments: plan.appointments.length,
        attributedTo: input.attribution.attributedTo?.staffName,
        proxyEntry: Boolean(input.attribution.attributedTo),
      },
    });
    emit();
    return { plan, enrollmentCode: code };
  },
  listEnrollmentCodes(patientId?: string): EnrollmentCode[] {
    return enrollmentCodes.filter((c) => !patientId || c.patientId === patientId);
  },
  getEnrollmentCode(code: string): EnrollmentCode | undefined {
    return enrollmentCodes.find((c) => c.code === code.trim().toUpperCase());
  },
  /** Validity read only — the consumption flow itself is a later phase. */
  enrollmentCodeStatus(
    code: string,
    at = new Date(),
  ): "valid" | "expired" | "consumed" | "unknown" {
    const rec = AdelanteEHR.getEnrollmentCode(code);
    if (!rec) return "unknown";
    if (rec.consumedAt) return "consumed";
    return +new Date(rec.expiresAt) < +at ? "expired" : "valid";
  },
  listCaseTasks(): CaseTask[] {
    return [...caseTasks];
  },
  caseTasksForCM(cmId: string): CaseTask[] {
    return caseTasks.filter((t) => t.assignedTo === cmId);
  },
  caseTasksForPatient(patientId: string): CaseTask[] {
    return caseTasks.filter((t) => t.patientId === patientId);
  },

  // ----- §Notification feed (Phase 1) -----
  /**
   * Internal helper. UI never calls this directly — every notification is
   * raised from inside the method that already performs the action.
   */
  notify(input: {
    recipientStaffId?: string;
    recipientRole?: StaffRole;
    category: NotificationCategory;
    subject: string;
    body: string;
    linkRoute?: string;
    linkParams?: Record<string, string>;
    patientId?: string;
  }): AppNotification | undefined {
    if (!input.recipientStaffId && !input.recipientRole) return undefined;
    const row: AppNotification = {
      id: uid(),
      recipientStaffId: input.recipientStaffId || undefined,
      // Exactly one addressing mode — a specific person wins over a broadcast.
      recipientRole: input.recipientStaffId ? undefined : input.recipientRole,
      category: input.category,
      subject: input.subject,
      body: input.body,
      linkRoute: input.linkRoute,
      linkParams: input.linkParams,
      patientId: input.patientId,
      createdAt: new Date().toISOString(),
    };
    notifications.unshift(row);
    emit();
    return row;
  },
  listNotifications(): AppNotification[] {
    return [...notifications];
  },
  /**
   * Everything addressed to this staff identity: direct (by roster id OR
   * display name — both are used as identity tokens across this build) or
   * broadcast to their role. Newest first.
   */
  listNotificationsFor(staffName: string, role?: StaffRole): AppNotification[] {
    const me = (staffName ?? "").trim();
    return notifications
      .filter(
        (n) =>
          (!!n.recipientStaffId && !!me && n.recipientStaffId === me) ||
          (!!n.recipientRole && !!role && n.recipientRole === role),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  markNotificationRead(id: string, staffName: string): void {
    const row = notifications.find((n) => n.id === id);
    if (!row || row.readAt) return;
    row.readAt = new Date().toISOString();
    appendAudit({
      category: "access",
      action: "notification_read",
      actorId: staffName,
      patientId: row.patientId,
      detail: { notificationId: row.id, notificationCategory: row.category },
    });
    emit();
  },
  markAllNotificationsRead(staffName: string, role?: StaffRole): void {
    const rows = AdelanteEHR.listNotificationsFor(staffName, role).filter((n) => !n.readAt);
    if (!rows.length) return;
    const now = new Date().toISOString();
    for (const r of rows) r.readAt = now;
    appendAudit({
      category: "access",
      action: "notifications_all_read",
      actorId: staffName,
      detail: { count: rows.length },
    });
    emit();
  },

  // ----- §Care messaging (Phase 2): one thread per patient -----
  /** Thread contents, oldest first. Bodies are returned verbatim. */
  listCareMessages(patientId: string): CareMessage[] {
    const p = patients.find((x) => x.id === patientId);
    return [...(p?.careMessages ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  /**
   * Patient-authored message. The body is stored exactly as typed — never
   * translated, trimmed of meaning, or rewritten (same rule as every other
   * patient-authored surface in this build).
   */
  sendPatientMessage(
    patientId: string,
    body: string,
    selfFlagged?: boolean,
  ): CareMessage | undefined {
    const p = patients.find((x) => x.id === patientId);
    if (!p || !body.trim()) return undefined;
    const now = new Date().toISOString();
    const msg: CareMessage = {
      id: uid(),
      threadPatientId: patientId,
      authorType: "patient",
      authorName: `${p.firstName} ${p.lastName}`,
      body,
      createdAt: now,
      // Authoring is reading, for the author's own side only.
      readByPatientAt: now,
      // §Patient self-flag — same fields the staff reviewer path writes, so
      // the existing mask check needs no special case.
      ...(selfFlagged
        ? {
            sudFlagged: true,
            sudFlaggedBy: `${p.firstName} ${p.lastName}`,
            sudFlaggedAt: now,
            sudFlaggedByPatient: true,
          }
        : {}),
    };
    p.careMessages = [...(p.careMessages ?? []), msg];
    appendAudit({
      category: "access",
      action: "care_message_sent",
      patientId,
      actorId: msg.authorName,
      detail: { authorType: "patient", messageId: msg.id },
    });
    if (selfFlagged) {
      appendAudit({
        category: "access",
        action: "care_message_sud_flagged",
        patientId,
        actorId: msg.authorName,
        detail: { messageId: msg.id, authorType: "patient", selfFlagged: true },
      });
    }
    // §Notification feed — direct-address the assigned case manager when the
    // id resolves to a roster identity; otherwise broadcast to the role.
    const cmName = caseManagers.find((c) => c.id === p.caseManagerId)?.name;
    AdelanteEHR.notify({
      recipientStaffId: cmName || undefined,
      recipientRole: cmName ? undefined : "ecm_provider",
      category: "patient_message",
      subject: `New message — ${patientLabel(patientId)}`,
      body: "A patient sent a message to their care team.",
      linkRoute: "/record/$patientId",
      linkParams: { patientId, section: "messages" },
      patientId,
    });
    // §Self-flag blind-spot safety net — a self-flagged message is masked from
    // any role that fails the SUD consent check for THIS patient, which can
    // include the very case manager the notification above targets. When that
    // happens, also broadcast to a role that is genuinely un-gated for this
    // content class, so a real authorized reader is alerted. Same generic body
    // and link — no new information is disclosed.
    if (selfFlagged && canAccess("ecm_provider", "screeners_sud", p).locked) {
      // Same matrix-derived selection as the staff-flag path. No flagger to
      // exclude here — the patient authored the flag, not a staff member.
      const backstop = pickSudBackstopRole(p);
      if (backstop) {
        AdelanteEHR.notify({
          recipientRole: backstop,
          category: "patient_message",
          subject: `New message — ${patientLabel(patientId)}`,
          body: "A patient sent a message to their care team.",
          linkRoute: "/record/$patientId",
          linkParams: { patientId, section: "messages" },
          patientId,
        });
      }
    }
    emit();
    return msg;
  },
  sendStaffMessage(patientId: string, staffName: string, body: string): CareMessage | undefined {
    const p = patients.find((x) => x.id === patientId);
    if (!p || !body.trim()) return undefined;
    const msg: CareMessage = {
      id: uid(),
      threadPatientId: patientId,
      authorType: "staff",
      authorName: staffName,
      body,
      createdAt: new Date().toISOString(),
      readByStaffAt: new Date().toISOString(),
    };
    p.careMessages = [...(p.careMessages ?? []), msg];
    appendAudit({
      category: "access",
      action: "care_message_sent",
      patientId,
      actorId: staffName,
      detail: { authorType: "staff", messageId: msg.id },
    });
    emit();
    return msg;
  },
  /** Clears the PATIENT's unread side only. Staff unread is untouched. */
  markMessagesReadByPatient(patientId: string): void {
    return AdelanteEHR._markMessagesReadByPatient(patientId);
  },
  /**
   * §Part 2 gate on a specific message. Protective action — no reason
   * required — but always audited. Gated to write-level `patient_messaging`
   * roles (the same roles that can reply); when `role` is omitted the caller
   * is treated as an already-gated UI path.
   */
  flagMessageAsSud(
    patientId: string,
    messageId: string,
    staffName: string,
    role?: StaffRole,
  ): boolean {
    return setCareMessageSudFlag(patientId, messageId, staffName, role, true);
  },
  unflagMessageAsSud(
    patientId: string,
    messageId: string,
    staffName: string,
    role?: StaffRole,
  ): boolean {
    return setCareMessageSudFlag(patientId, messageId, staffName, role, false);
  },
  _markMessagesReadByPatient(patientId: string): void {
    const p = patients.find((x) => x.id === patientId);
    if (!p?.careMessages?.length) return;
    const now = new Date().toISOString();
    let touched = 0;
    for (const m of p.careMessages) {
      if (m.authorType === "staff" && !m.readByPatientAt) {
        m.readByPatientAt = now;
        touched++;
      }
    }
    if (!touched) return;
    emit();
  },
  /** Clears the STAFF unread side only. Patient unread is untouched. */
  markMessagesReadByStaff(patientId: string, staffName: string): void {
    const p = patients.find((x) => x.id === patientId);
    if (!p?.careMessages?.length) return;
    const now = new Date().toISOString();
    let touched = 0;
    for (const m of p.careMessages) {
      if (m.authorType === "patient" && !m.readByStaffAt) {
        m.readByStaffAt = now;
        touched++;
      }
    }
    if (!touched) return;
    appendAudit({
      category: "access",
      action: "care_messages_read",
      patientId,
      actorId: staffName,
      detail: { count: touched },
    });
    emit();
  },
  /** Staff replies the patient hasn't seen yet. */
  unreadCountForPatient(patientId: string): number {
    const p = patients.find((x) => x.id === patientId);
    return (p?.careMessages ?? []).filter((m) => m.authorType === "staff" && !m.readByPatientAt)
      .length;
  },
  /** Patient messages no staff member has opened yet. */
  unreadCountForStaff(patientId: string): number {
    const p = patients.find((x) => x.id === patientId);
    return (p?.careMessages ?? []).filter((m) => m.authorType === "patient" && !m.readByStaffAt)
      .length;
  },
  /**
   * Cross-patient message queue. Threads with staff-unread messages, oldest
   * unread first — the longest-waiting patient is the top of the list.
   */
  listUnreadMessageThreads(): {
    patient: Patient;
    unread: number;
    oldestUnreadAt: string;
    latest: CareMessage;
  }[] {
    const rows: { patient: Patient; unread: number; oldestUnreadAt: string; latest: CareMessage }[] =
      [];
    for (const p of patients) {
      const msgs = p.careMessages ?? [];
      const unread = msgs.filter((m) => m.authorType === "patient" && !m.readByStaffAt);
      if (!unread.length) continue;
      const oldest = unread.reduce((a, b) => (a.createdAt <= b.createdAt ? a : b));
      const latest = msgs.reduce((a, b) => (a.createdAt >= b.createdAt ? a : b));
      rows.push({ patient: p, unread: unread.length, oldestUnreadAt: oldest.createdAt, latest });
    }
    return rows.sort((a, b) => a.oldestUnreadAt.localeCompare(b.oldestUnreadAt));
  },

  createCaseTask(input: {
    patientId: string;
    assignedTo: string;
    title: string;
    detail?: string;
    dueDate: string;
    origin?: CaseTaskOrigin;
    dedupeKey?: string;
    /** §Phase 3c provenance — set only by the automation runner. */
    sourceNoteId?: string;
    sourceAutomationId?: string;
    sourceTemplateTitle?: string;
    priority?: CaseTask["priority"];
    taskType?: string;
    allowedRoles?: StaffRole[];
    facilityId?: string;
    housingUnit?: string;
    source?: string;
    /** §Phase B — set only by the protocol scheduler. */
    protocolInstanceId?: string;
    roundNumber?: number;
    templateId?: string;
    /** §Facility & Custody — see `CaseTask.facilityContext`. */
    facilityContext?: boolean;
    /** §Scheduling rules — set only by `runSchedulingRulesNow`. */
    sourceRuleId?: string;
  }): CaseTask | undefined {
    if (input.dedupeKey) {
      const existing = caseTasks.find(
        (t) => t.dedupeKey === input.dedupeKey && t.status !== "done",
      );
      if (existing) return existing;
    }
    const task: CaseTask = {
      id: uid(),
      patientId: input.patientId,
      assignedTo: input.assignedTo,
      title: input.title,
      detail: input.detail,
      dueDate: input.dueDate,
      status: "open",
      origin: input.origin ?? "manual",
      createdAt: new Date().toISOString(),
      dedupeKey: input.dedupeKey,
      sourceNoteId: input.sourceNoteId,
      sourceAutomationId: input.sourceAutomationId,
      sourceTemplateTitle: input.sourceTemplateTitle,
      priority: input.priority,
      worklistStatus: "pending",
      taskType: input.taskType,
      allowedRoles: input.allowedRoles?.length ? [...input.allowedRoles] : undefined,
      facilityId: input.facilityId,
      housingUnit: input.housingUnit,
      source: input.source ?? input.origin ?? "manual",
      protocolInstanceId: input.protocolInstanceId,
      roundNumber: input.roundNumber,
      templateId: input.templateId,
      facilityContext: input.facilityContext,
      sourceRuleId: input.sourceRuleId,
    };
    caseTasks.unshift(task);
    // §Notification feed — direct-address the assignee only (never their whole
    // role). `assignedTo` is a caseManagerId; the roster identity token is the
    // person's display name, so resolve it when we can.
    const assigneeName = caseManagers.find((c) => c.id === task.assignedTo)?.name;
    AdelanteEHR.notify({
      recipientStaffId: assigneeName || task.assignedTo,
      category: "task_assigned",
      subject: `Task assigned — ${task.title}`,
      body: `${task.detail ?? `New task for ${patientLabel(task.patientId)}`} (due ${task.dueDate})`,
      linkRoute: "/record/$patientId",
      linkParams: { patientId: task.patientId, section: "tasks" },
      patientId: task.patientId,
    });
    emit();
    return task;
  },
  completeCaseTask(id: string) {
    const t = caseTasks.find((x) => x.id === id);
    if (!t) return;
    t.status = "done";
    t.completedAt = new Date().toISOString();
    t.worklistStatus = "completed";
    emit();
  },
  reopenCaseTask(id: string) {
    const t = caseTasks.find((x) => x.id === id);
    if (!t) return;
    t.status = "open";
    t.completedAt = undefined;
    t.snoozedUntil = undefined;
    t.worklistStatus = t.claimedBy ? "in_progress" : "pending";
    emit();
  },
  snoozeCaseTask(id: string, days = 3) {
    const t = caseTasks.find((x) => x.id === id);
    if (!t) return;
    const until = new Date();
    until.setDate(until.getDate() + days);
    t.status = "snoozed";
    t.snoozedUntil = until.toISOString();
    emit();
  },

  // ---------- §Worklist Phase A: pool claim + status ----------
  /**
   * Claim an unclaimed task. Simple claim/release (the Provider Request
   * pattern), not the reasoned-takeover pattern used for controlled-substance
   * dose claims: a second claim fails cleanly and release is the escape hatch.
   */
  claimWorklistTask(id: string, staffName: string, role: StaffRole): boolean {
    const t = caseTasks.find((x) => x.id === id);
    if (!t || t.claimedBy || worklistStatusFor(t) === "completed") return false;
    t.claimedBy = staffName;
    t.claimedAt = new Date().toISOString();
    t.worklistStatus = "in_progress";
    appendAudit({
      category: "clinical",
      action: "worklist_task_claimed",
      patientId: t.patientId,
      actorId: staffName,
      actorRole: role,
      detail: { taskId: t.id, title: t.title },
    });
    emit();
    return true;
  },
  /** Return a claimed task to the pool. Only the claimer may release it. */
  releaseWorklistTask(id: string, staffName: string, role: StaffRole): boolean {
    const t = caseTasks.find((x) => x.id === id);
    if (!t || t.claimedBy !== staffName) return false;
    t.claimedBy = undefined;
    t.claimedAt = undefined;
    t.worklistStatus = worklistStatusFor(t) === "completed" ? "completed" : "pending";
    appendAudit({
      category: "clinical",
      action: "worklist_task_released",
      patientId: t.patientId,
      actorId: staffName,
      actorRole: role,
      detail: { taskId: t.id },
    });
    emit();
    return true;
  },
  /** Explicit worklist status change (cancel / miss / complete / reopen). */
  setWorklistStatus(
    id: string,
    next: WorklistStatus,
    staffName: string,
    role: StaffRole,
  ): boolean {
    const t = caseTasks.find((x) => x.id === id);
    if (!t || worklistStatusFor(t) === next) return false;
    const prev = worklistStatusFor(t);
    t.worklistStatus = next;
    // Keep the legacy CM-queue lifecycle consistent so existing consumers
    // (caseTasksForCM, overdueTasks) never disagree with the worklist.
    if (next === "completed") {
      t.status = "done";
      t.completedAt = t.completedAt ?? new Date().toISOString();
    } else if (next === "cancelled" || next === "missed") {
      t.status = "done";
      t.completedAt = t.completedAt ?? new Date().toISOString();
    } else {
      t.status = "open";
      t.completedAt = undefined;
    }
    appendAudit({
      category: "clinical",
      action: "worklist_task_status",
      patientId: t.patientId,
      actorId: staffName,
      actorRole: role,
      detail: { taskId: t.id, from: prev, to: next },
    });
    emit();
    return true;
  },
  /** Distinct task types actually in use, for the filter facet. */
  worklistTaskTypes(): string[] {
    return [...new Set(caseTasks.map((t) => t.taskType).filter(Boolean) as string[])].sort();
  },

  // ---------- §Worklist Phase B: protocol scheduling ----------
  /**
   * Templates a protocol may be started against: latest active version, with
   * scoring configured. A protocol with no scored template is a bare
   * reminder, not a protocol — so the picker never offers one.
   */
  listProtocolTemplates(): NoteTemplate[] {
    return AdelanteEHR.listNoteTemplates().filter((t) => (t.schema?.scoring?.length ?? 0) > 0);
  },

  listProtocolInstances(patientId?: string): ProtocolInstance[] {
    return protocolInstances
      .filter((p) => !patientId || p.patientId === patientId)
      .map((p) => ({ ...p }))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  },

  /** Round tasks for one instance, ascending by round number. */
  protocolRounds(instanceId: string): CaseTask[] {
    return caseTasks
      .filter((t) => t.protocolInstanceId === instanceId)
      .sort((a, b) => (a.roundNumber ?? 0) - (b.roundNumber ?? 0));
  },

  /**
   * Pre-schedules `totalRounds` worklist rows at `startedAt + n*cadence`.
   * Throws with a clear message when the template is missing / inactive /
   * superseded / unscored — there is deliberately no generic-form fallback.
   */
  startProtocol(
    patientId: string,
    protocolKey: string,
    templateId: string,
    cadenceMinutes: number,
    totalRounds: number,
    staffName: string,
    role?: StaffRole,
  ): ProtocolInstance {
    const p = patients.find((x) => x.id === patientId);
    if (!p) throw new Error("Patient not found.");
    if (!protocolKey.trim()) throw new Error("A protocol name is required.");
    if (!Number.isFinite(cadenceMinutes) || cadenceMinutes < 1)
      throw new Error("Cadence must be at least 1 minute.");
    if (!Number.isFinite(totalRounds) || totalRounds < 1)
      throw new Error("A protocol needs at least 1 round.");
    const tpl = noteTemplates.find((t) => t.id === templateId);
    if (!tpl) throw new Error("That note template no longer exists.");
    if (tpl.supersededBy)
      throw new Error("That template version has been superseded — pick the current version.");
    if (!tpl.active)
      throw new Error(`"${tpl.title}" is inactive — a protocol needs an active template.`);
    if (!(tpl.schema?.scoring?.length ?? 0))
      throw new Error(
        `"${tpl.title}" has no scoring configured. A protocol must run against a scored template — author scoring in the template builder first.`,
      );

    const startedAt = new Date();
    const instance: ProtocolInstance = {
      id: uid(),
      patientId,
      protocolKey: protocolKey.trim(),
      templateId,
      startedBy: staffName,
      startedAt: startedAt.toISOString(),
      cadenceMinutes,
      totalRounds,
      status: "active",
    };
    protocolInstances.unshift(instance);

    // §Facility & Custody — additive tagging only: rounds started while the
    // patient is in an open booking episode carry the facility context (and
    // that facility's id) so the Facility protocols view can filter them.
    const booking = AdelanteEHR.listBookings(patientId)[0];
    const inCustody = Boolean(booking && !booking.releasedAt);

    for (let n = 1; n <= totalRounds; n++) {
      const due = new Date(startedAt.getTime() + n * cadenceMinutes * 60_000);
      AdelanteEHR.createCaseTask({
        patientId,
        // Rounds are pool work, not a personal assignment: they route to the
        // patient's case manager only so the existing CM queue stays coherent.
        assignedTo: p.caseManagerId ?? staffName,
        title: `${instance.protocolKey} round ${n}/${totalRounds}`,
        detail: `Document on "${tpl.title}" (scored).`,
        dueDate: due.toISOString(),
        origin: "manual",
        taskType: "protocol_round",
        source: `protocol:${instance.protocolKey}`,
        priority: "urgent",
        protocolInstanceId: instance.id,
        roundNumber: n,
        templateId,
        facilityContext: inCustody || undefined,
        facilityId: inCustody ? booking?.facilityId : undefined,
        housingUnit: inCustody
          ? AdelanteEHR.currentHousingUnit(patientId)
          : undefined,
      });
    }

    appendAudit({
      category: "clinical",
      action: "protocol_started",
      patientId,
      actorId: staffName,
      actorRole: role,
      detail: {
        instanceId: instance.id,
        protocolKey: instance.protocolKey,
        templateId,
        templateTitle: tpl.title,
        cadenceMinutes,
        totalRounds,
      },
    });
    emit();
    return instance;
  },

  /**
   * Stops an active protocol and cancels every round that has not already
   * been completed. Completed rounds are never touched — they are signed
   * documentation.
   */
  stopProtocol(id: string, staffName: string, reason: string, role?: StaffRole): boolean {
    const inst = protocolInstances.find((x) => x.id === id);
    if (!inst || inst.status !== "active") return false;
    if ((reason ?? "").trim().length < 3)
      throw new Error("A reason of at least 3 characters is required to stop a protocol.");
    let cancelled = 0;
    for (const t of caseTasks.filter((x) => x.protocolInstanceId === id)) {
      const s = worklistStatusFor(t);
      if (s === "completed" || s === "cancelled") continue;
      t.worklistStatus = "cancelled";
      t.status = "done";
      t.completedAt = t.completedAt ?? new Date().toISOString();
      cancelled++;
    }
    inst.status = "stopped";
    inst.stoppedBy = staffName;
    inst.stoppedAt = new Date().toISOString();
    inst.stopReason = reason.trim();
    appendAudit({
      category: "clinical",
      action: "protocol_stopped",
      patientId: inst.patientId,
      actorId: staffName,
      actorRole: role,
      detail: {
        instanceId: inst.id,
        protocolKey: inst.protocolKey,
        reason: inst.stopReason,
        roundsCancelled: cancelled,
      },
    });
    emit();
    return true;
  },

  /**
   * Marks a round done. Completion is derived, not a second lifecycle: when
   * every round is closed out the instance flips to "completed".
   */
  // ---------- §Scheduling rule engine (manual run) ------------------------

  listSchedulingRules(includeInactive = false): SchedulingRule[] {
    return schedulingRules
      .filter((r) => includeInactive || r.active)
      .map((r) => ({ ...r, match: { ...r.match }, allowedRoles: r.allowedRoles?.slice() }))
      .sort((a, b) => a.label.localeCompare(b.label));
  },

  /** Create or update a rule. Deactivation goes through `deactivateSchedulingRule`. */
  saveSchedulingRule(
    input: {
      id?: string;
      key: string;
      label: string;
      description?: string;
      taskType: string;
      match: SchedulingRule["match"];
      cadenceMinutes: number;
      allowedRoles?: StaffRole[];
      priority: TaskPriority;
    },
    staffName: string,
    role?: StaffRole,
  ): SchedulingRule {
    const key = input.key.trim().toLowerCase().replace(/\s+/g, "_");
    const label = input.label.trim();
    const taskType = input.taskType.trim();
    if (!key) throw new Error("A rule key is required.");
    if (!label) throw new Error("A rule label is required.");
    if (!taskType) throw new Error("A task type is required.");
    if (!Number.isFinite(input.cadenceMinutes) || input.cadenceMinutes < 1)
      throw new Error("Cadence must be at least 1 minute.");
    const match = {
      activeProblemCategory: input.match.activeProblemCategory || undefined,
      activeOrderFrequencyCode: input.match.activeOrderFrequencyCode?.toUpperCase() || undefined,
    };
    if (!match.activeProblemCategory && !match.activeOrderFrequencyCode)
      throw new Error("A rule needs at least one condition.");
    const dup = schedulingRules.find((r) => r.key === key && r.id !== input.id);
    if (dup) throw new Error(`Rule key "${key}" is already in use.`);

    const existing = input.id ? schedulingRules.find((r) => r.id === input.id) : undefined;
    if (input.id && !existing) throw new Error("Rule not found.");
    const row: SchedulingRule = existing ?? {
      id: uid(),
      key,
      label,
      taskType,
      match,
      cadenceMinutes: input.cadenceMinutes,
      priority: input.priority,
      active: true,
      createdBy: staffName,
      createdAt: new Date().toISOString(),
    };
    row.key = key;
    row.label = label;
    row.description = input.description?.trim() || undefined;
    row.taskType = taskType;
    row.match = match;
    row.cadenceMinutes = input.cadenceMinutes;
    row.allowedRoles = input.allowedRoles?.length ? [...input.allowedRoles] : undefined;
    row.priority = input.priority;
    if (!existing) schedulingRules.push(row);

    appendAudit({
      category: "clinical",
      action: existing ? "scheduling_rule_updated" : "scheduling_rule_created",
      actorId: staffName,
      actorRole: role,
      detail: { id: row.id, key: row.key, taskType: row.taskType, match: row.match },
    });
    emit();
    return { ...row };
  },

  /** Deactivate, never delete — the generated task history must stay readable. */
  deactivateSchedulingRule(
    id: string,
    staffName: string,
    reason: string,
    role?: StaffRole,
  ): SchedulingRule {
    const row = schedulingRules.find((r) => r.id === id);
    if (!row) throw new Error("Rule not found.");
    const why = (reason ?? "").trim();
    if (!why) throw new Error("A reason is required to deactivate a rule.");
    row.active = false;
    row.deactivatedBy = staffName;
    row.deactivatedAt = new Date().toISOString();
    row.deactivationReason = why;
    appendAudit({
      category: "clinical",
      action: "scheduling_rule_deactivated",
      actorId: staffName,
      actorRole: role,
      detail: { id, key: row.key, reason: why },
    });
    emit();
    return { ...row };
  },

  reactivateSchedulingRule(id: string, staffName: string, role?: StaffRole): SchedulingRule {
    const row = schedulingRules.find((r) => r.id === id);
    if (!row) throw new Error("Rule not found.");
    row.active = true;
    row.deactivatedBy = undefined;
    row.deactivatedAt = undefined;
    row.deactivationReason = undefined;
    appendAudit({
      category: "clinical",
      action: "scheduling_rule_reactivated",
      actorId: staffName,
      actorRole: role,
      detail: { id, key: row.key },
    });
    emit();
    return { ...row };
  },

  /** Patients an active rule currently matches (structured AND-matchers). */
  patientsMatchingRule(rule: SchedulingRule): Patient[] {
    return patients.filter((p) => {
      if (rule.match.activeProblemCategory) {
        const hit = (p.problems ?? []).some(
          (pr) => isProblemClinicallyActive(pr) && pr.category === rule.match.activeProblemCategory,
        );
        if (!hit) return false;
      }
      if (rule.match.activeOrderFrequencyCode) {
        const hit = (p.orders ?? []).some(
          (o) =>
            (o.status === "signed" || o.status === "held") &&
            (o.frequencyCode ?? "").toUpperCase() === rule.match.activeOrderFrequencyCode,
        );
        if (!hit) return false;
      }
      return true;
    });
  },

  /**
   * Manually triggered run. For each active rule, each matching patient gets
   * ONE task per cadence window: the run skips a patient when a task with this
   * `sourceRuleId` was created within `cadenceMinutes` — regardless of whether
   * that task is still open, completed, or cancelled. Checking only open tasks
   * would re-spam the moment the first one is worked.
   */
  runSchedulingRulesNow(
    staffName: string,
    role?: StaffRole,
  ): { total: number; results: { ruleKey: string; tasksCreated: number }[] } {
    const now = Date.now();
    const results: { ruleKey: string; tasksCreated: number }[] = [];
    let total = 0;

    for (const rule of schedulingRules.filter((r) => r.active)) {
      const windowMs = rule.cadenceMinutes * 60_000;
      let created = 0;
      for (const p of AdelanteEHR.patientsMatchingRule(rule)) {
        const recent = caseTasks.some(
          (t) =>
            t.sourceRuleId === rule.id &&
            t.patientId === p.id &&
            now - +new Date(t.createdAt) < windowMs,
        );
        if (recent) continue;
        const made = AdelanteEHR.createCaseTask({
          patientId: p.id,
          assignedTo: p.caseManagerId ?? staffName,
          title: rule.label,
          detail: rule.description,
          dueDate: new Date(now).toISOString(),
          origin: "manual",
          taskType: rule.taskType,
          priority: rule.priority,
          allowedRoles: rule.allowedRoles,
          source: `rule:${rule.key}`,
          sourceRuleId: rule.id,
        });
        if (made) created++;
      }
      results.push({ ruleKey: rule.key, tasksCreated: created });
      total += created;
    }

    appendAudit({
      category: "clinical",
      action: "scheduling_rules_run",
      actorId: staffName,
      actorRole: role,
      detail: { total, results },
    });
    emit();
    return { total, results };
  },

  /**
   * Marks a round done. Completion is derived, not a second lifecycle: when
   * every round is closed out the instance flips to "completed".
   */
  completeProtocolRound(taskId: string, staffName: string, role?: StaffRole): boolean {
    const t = caseTasks.find((x) => x.id === taskId);
    if (!t?.protocolInstanceId) return false;
    const ok = AdelanteEHR.setWorklistStatus(taskId, "completed", staffName, role ?? "pmhnp");
    const inst = protocolInstances.find((x) => x.id === t.protocolInstanceId);
    if (inst && inst.status === "active") {
      const open = caseTasks.filter(
        (x) =>
          x.protocolInstanceId === inst.id &&
          !["completed", "cancelled"].includes(worklistStatusFor(x)),
      );
      if (open.length === 0) inst.status = "completed";
    }
    emit();
    return ok;
  },

  // ---------- Billing lifecycle ----------
  /** Rate card (cents) for demo pricing. */
  chargeForService(service?: ServiceType): number {
    switch (service) {
      case "intake":
        return 22500;
      case "therapy_individual":
        return 16500;
      case "med_management":
        return 19500;
      case "therapy_group":
        return 9500;
      case "case_management":
        return 8000;
      case "peer_support":
        return 6500;
      default:
        return 15000;
    }
  },
  transitionBilling(
    apptId: string,
    to: BillingStatus,
    opts?: { actor?: string; note?: string; denialReason?: string },
  ): { ok: true } | { ok: false; error: string } {
    const a = appointments.find((x) => x.id === apptId);
    if (!a) return { ok: false, error: "Appointment not found." };
    const from = a.billingStatus;
    const allowed: Record<BillingStatus, BillingStatus[]> = {
      draft: ["ready", "write_off"],
      ready: ["submitted", "write_off", "draft"],
      submitted: ["paid", "denied"],
      denied: ["ready", "write_off"],
      paid: [],
      write_off: ["draft"],
    };
    if (!allowed[from].includes(to)) {
      return { ok: false, error: `Cannot move claim from ${from} to ${to}.` };
    }
    if (to === "denied" && !opts?.denialReason) {
      return { ok: false, error: "Denial reason is required." };
    }
    a.billingStatus = to;
    if (to === "submitted") a.submittedAt = new Date().toISOString();
    if (to === "paid") a.paidAt = new Date().toISOString();
    if (to === "denied") a.denialReason = opts?.denialReason;
    a.chargeCents = a.chargeCents ?? AdelanteEHR.chargeForService(a.serviceType);
    a.billingHistory = [
      ...(a.billingHistory ?? []),
      {
        id: uid(),
        at: new Date().toISOString(),
        actor: opts?.actor ?? "billing",
        from,
        to,
        note: opts?.note ?? opts?.denialReason,
      },
    ];
    emit();
    return { ok: true };
  },
  /** ISL/self-pay export: all appointments on ISL lane in the given range. */
  exportIslReport(range?: { from?: string; to?: string }): string {
    const rows = appointments
      .filter((a) => a.fundingLane === "isl_non_medi_cal" || a.fundingLane === "private_pay")
      .filter((a) => (range?.from ? a.start >= range.from : true))
      .filter((a) => (range?.to ? a.start <= range.to : true))
      .sort((a, b) => a.start.localeCompare(b.start));
    const header = [
      "appt_id",
      "date",
      "patient_program_id",
      "clinician",
      "service_type",
      "modality",
      "duration_min",
      "funding_lane",
      "isl_reason",
      "billing_status",
      "charge_usd",
    ].join(",");
    const lines = rows.map((a) => {
      const p = patients.find((x) => x.id === a.patientId);
      const c = clinicians.find((x) => x.id === a.clinicianId);
      const charge = ((a.chargeCents ?? AdelanteEHR.chargeForService(a.serviceType)) / 100).toFixed(
        2,
      );
      return [
        a.id,
        a.start.slice(0, 10),
        p?.programId ?? a.patientId,
        c?.name ?? a.clinicianId,
        a.serviceType ?? "",
        a.modality ?? "video",
        a.durationMin,
        a.fundingLane ?? "",
        a.islReason ?? "",
        a.billingStatus,
        charge,
      ]
        .map((v) => String(v).replace(/,/g, ";"))
        .join(",");
    });
    return [header, ...lines].join("\n");
  },
  /** Credentialing hard-stop: block booking with clinicians whose license expired. */
  canBook(clinicianId: string): { ok: true } | { ok: false; reason: string } {
    const c = clinicians.find((x) => x.id === clinicianId);
    if (!c) return { ok: false, reason: "Clinician not found." };
    const exp = c.licenseExpiresOn;
    if (exp && +new Date(exp) < Date.now()) {
      return { ok: false, reason: `License expired ${exp.slice(0, 10)}. Cannot book.` };
    }
    return { ok: true };
  },
  /** Clinicians whose license has expired or is expiring within `days`. */
  expiringClinicianLicenses(
    days = 30,
  ): { clinician: Clinician; daysUntil: number; expired: boolean }[] {
    const now = Date.now();
    return clinicians
      .filter((c) => Boolean(c.licenseExpiresOn))
      .map((c) => {
        const t = +new Date(c.licenseExpiresOn!);
        const daysUntil = Math.ceil((t - now) / (1000 * 60 * 60 * 24));
        return { clinician: c, daysUntil, expired: daysUntil < 0 };
      })
      .filter((r) => r.expired || r.daysUntil <= days)
      .sort((a, b) => a.daysUntil - b.daysUntil);
  },
  /** Notification deliveries that failed within the given window. */
  recentFailedNotifications(withinHours = 24): Array<{
    patient: Patient;
    notification: ApptNotification;
  }> {
    const cutoff = Date.now() - withinHours * 60 * 60 * 1000;
    const out: Array<{ patient: Patient; notification: ApptNotification }> = [];
    for (const p of patients) {
      for (const n of p.notifications ?? []) {
        if (n.state === "failed" && +new Date(n.at) >= cutoff) {
          out.push({ patient: p, notification: n });
        }
      }
    }
    return out.sort((a, b) => +new Date(b.notification.at) - +new Date(a.notification.at));
  },
  // --- Vendor pass-through helpers (telehealth + eRx) ------------------------
  listMedications(patientId: string) {
    return _vendors.erx.listActiveMedications(patientId);
  },
  telehealthJoinUrl(appointmentId: string, role: "patient" | "clinician") {
    return _vendors.telehealth.getJoinUrl(appointmentId, role);
  },
  erxSsoLaunchUrl(clinicianId: string, patientId: string) {
    return _vendors.erx.ssoLaunchUrl(clinicianId, patientId);
  },
  recordRxEvent(evt: {
    patientId: string;
    clinicianId?: string;
    kind: "sso_launch" | "refill_requested" | "discontinued";
    note?: string;
  }) {
    rxEvents.push({
      id: `rxe_${rxEvents.length + 1}`,
      at: new Date().toISOString(),
      ...evt,
    });
    appendAudit({
      category: "rx",
      action: evt.kind,
      patientId: evt.patientId,
      actorId: evt.clinicianId,
      detail: { note: evt.note },
    });
    emit();
  },
  listRxEvents(patientId: string) {
    return rxEvents.filter((e) => e.patientId === patientId);
  },
  vendorStatus() {
    return {
      telehealth: { name: _vendors.telehealth.vendorName, mode: "mock" as const },
      erx: { name: _vendors.erx.vendorName, mode: "mock" as const },
    };
  },

  // ---------- Unified audit log ----------
  /**
   * §Platform nav — records a blocked attempt to open a gated route.
   * Deliberately carries no patientId and no free text: the denial is about a
   * route + role, so there is nothing clinical to leak here.
   */
  recordNavAccessDenied(input: {
    role: string;
    actorId?: string;
    path: string;
    redirectTo: string;
    entryId?: string;
    label?: string;
  }) {
    appendAudit({
      category: "access",
      action: "nav_access_denied",
      actorRole: input.role,
      actorId: input.actorId,
      detail: {
        path: input.path,
        redirectTo: input.redirectTo,
        entryId: input.entryId,
        label: input.label,
      },
    });
  },

  // ----- §v3.0 Phase 4 — Advocate / Family Member -------------------------
  /**
   * §Quality pass Group A — supervision link created / changed / cleared.
   * Workforce config, no patient context: who was reassigned, by whom, and
   * whether the change leaves them billable.
   */
  recordSupervisionChange(input: {
    staffId: string;
    staffName: string;
    staffRole: string;
    previousSupervisorId?: string;
    supervisorId?: string;
    satisfied: boolean;
    actorRole?: string;
    actorId?: string;
    actorName?: string;
  }) {
    appendAudit({
      category: "access",
      action: input.supervisorId ? "supervision_assigned" : "supervision_cleared",
      actorRole: input.actorRole,
      actorId: input.actorId,
      detail: {
        staffId: input.staffId,
        staffName: input.staffName,
        staffRole: input.staffRole,
        previousSupervisorId: input.previousSupervisorId,
        supervisorId: input.supervisorId,
        satisfied: input.satisfied,
        actorName: input.actorName,
      },
    });
  },

  //
  // Every read below is live-evaluated and every advocate-facing read is
  // audited. There is intentionally no "find my patient" function.

  listAdvocateLinks(patientId?: string): AdvocateLink[] {
    return advocateLinks
      .filter((l) => !patientId || l.patientId === patientId)
      .map((l) => ({ ...l, status: _effectiveAdvocateStatus(l) }))
      .sort((a, b) => +new Date(b.designatedAt) - +new Date(a.designatedAt));
  },

  getAdvocateLink(id: string): AdvocateLink | undefined {
    const l = advocateLinks.find((x) => x.id === id);
    return l ? { ...l, status: _effectiveAdvocateStatus(l) } : undefined;
  },

  /**
   * The ONLY lookup path into an advocate link. Keyed on the invitation code
   * the advocate received directly. Never accepts patient-identifying input.
   */
  advocateLinkByCode(code: string): AdvocateLink | undefined {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return undefined;
    const l = advocateLinks.find((x) => x.invitationCode === trimmed);
    return l ? { ...l, status: _effectiveAdvocateStatus(l) } : undefined;
  },

  /**
   * Designation — by the patient, or by the CF Care Manager / ECM Provider on
   * the patient's behalf during pre-release intake. The code is returned to
   * the DESIGNATION transaction (which sends it to `invitationSentTo`), not to
   * the patient surface: relaying it through the patient is the tampering /
   * impersonation vector this whole mechanism exists to close.
   */
  createAdvocateInvitation(input: {
    patientId: string;
    advocateName: string;
    relationship?: string;
    invitationSentTo: string;
    invitationChannel: "email" | "sms";
    designatedBy: AdvocateLink["designatedBy"];
    /** Days until an unclaimed invitation lapses. */
    expiresInDays?: number;
  }): AdvocateLink {
    const name = input.advocateName.trim();
    const contact = input.invitationSentTo.trim();
    if (!name) throw new Error("An advocate name is required.");
    if (!contact) throw new Error("A direct contact for the advocate is required.");
    if (!patients.some((p) => p.id === input.patientId)) throw new Error("Unknown patient.");
    const days = input.expiresInDays ?? 14;
    const link: AdvocateLink = {
      id: `adv_${uid()}`,
      patientId: input.patientId,
      advocateName: name,
      ...(input.relationship?.trim() ? { relationship: input.relationship.trim() } : {}),
      invitationSentTo: contact,
      invitationChannel: input.invitationChannel,
      invitationCode: _advocateInviteCode(),
      invitationExpiresAt: new Date(Date.now() + days * 86400_000).toISOString(),
      designatedBy: input.designatedBy,
      designatedAt: new Date().toISOString(),
      status: "invited",
    };
    advocateLinks.unshift(link);
    appendAudit({
      category: "advocate",
      action: "advocate_invited",
      patientId: link.patientId,
      actorRole: link.designatedBy.actor,
      detail: {
        advocateLinkId: link.id,
        advocateName: link.advocateName,
        invitationChannel: link.invitationChannel,
        // Contact is recorded so a mis-delivered invitation is traceable; the
        // CODE itself is never written to the audit log.
        invitationSentTo: link.invitationSentTo,
        expiresAt: link.invitationExpiresAt,
      },
    });
    emit();
    return { ...link };
  },

  /**
   * Claim requires BOTH halves: the invitation code AND an explicitly
   * confirmed authorization type. Neither alone grants anything.
   */
  claimAdvocateInvitation(input: {
    code: string;
    authorizationType: AdvocateAuthorizationType;
    attestedName: string;
  }): AdvocateLink {
    const found = advocateLinks.find(
      (x) => x.invitationCode === input.code.trim().toUpperCase(),
    );
    if (!found) throw new Error("That invitation code isn't valid.");
    const status = _effectiveAdvocateStatus(found);
    if (status === "expired") throw new Error("That invitation has expired.");
    if (status === "revoked") throw new Error("That invitation was revoked.");
    if (status === "active") throw new Error("That invitation has already been claimed.");
    const attested = input.attestedName.trim();
    if (!attested) throw new Error("Type your full name to attest to your authorization.");

    found.status = "active";
    found.authorizationType = input.authorizationType;
    found.authorizationConfirmedAt = new Date().toISOString();
    found.authorizationAttestedName = attested;
    found.claimedAt = found.authorizationConfirmedAt;
    appendAudit({
      category: "advocate",
      action: "advocate_connection_claimed",
      patientId: found.patientId,
      actorRole: "advocate",
      actorId: found.id,
      detail: {
        advocateLinkId: found.id,
        advocateName: found.advocateName,
        authorizationType: found.authorizationType,
        attestedName: attested,
      },
    });
    emit();
    return { ...found };
  },

  /**
   * AHCD activation — a physician's capacity determination. Separate call
   * because it is a clinical act, not an advocate self-assertion.
   */
  activateAdvocateAhcd(linkId: string, physicianName: string): AdvocateLink {
    const link = advocateLinks.find((l) => l.id === linkId);
    if (!link) throw new Error("Unknown advocate connection.");
    if (link.authorizationType !== "ahcd")
      throw new Error("Only an AHCD connection can be activated this way.");
    const who = physicianName.trim();
    if (!who) throw new Error("The determining physician must be named.");
    link.ahcdActivatedAt = new Date().toISOString();
    link.ahcdActivatedBy = who;
    appendAudit({
      category: "advocate",
      action: "advocate_ahcd_activated",
      patientId: link.patientId,
      actorId: who,
      detail: { advocateLinkId: link.id, advocateName: link.advocateName },
    });
    emit();
    return { ...link };
  },

  revokeAdvocateLink(linkId: string, revokedBy: string, reason: string): AdvocateLink {
    const link = advocateLinks.find((l) => l.id === linkId);
    if (!link) throw new Error("Unknown advocate connection.");
    const why = reason.trim();
    if (!why) throw new Error("A reason is required to revoke advocate access.");
    link.status = "revoked";
    link.revokedAt = new Date().toISOString();
    link.revokedBy = revokedBy;
    link.revokeReason = why;
    appendAudit({
      category: "advocate",
      action: "advocate_access_revoked",
      patientId: link.patientId,
      actorId: revokedBy,
      detail: { advocateLinkId: link.id, advocateName: link.advocateName, reason: why },
    });
    emit();
    return { ...link };
  },

  /**
   * The live gate. Facts are read fresh every call — a revocation or an ROI
   * expiry stops access everywhere with nothing needing to be told to stop.
   */
  advocateAccess(linkId: string): AdvocateAccessDecision {
    const link = advocateLinks.find((l) => l.id === linkId);
    if (!link)
      return {
        allowed: false,
        permissions: [],
        reason: "No advocate connection.",
        denyReason: "no_link",
      };
    return advocateAccessDecision({
      status: _effectiveAdvocateStatus(link),
      ...(link.authorizationType ? { authorizationType: link.authorizationType } : {}),
      roiCollateralActive: AdelanteEHR.isConsentCategoryAuthorized(
        link.patientId,
        COLLATERAL_ROI_CATEGORY,
      ),
      ahcdActivated: Boolean(link.ahcdActivatedAt),
    });
  },

  advocateCan(linkId: string, permission: AdvocatePermission): boolean {
    const d = AdelanteEHR.advocateAccess(linkId);
    return d.allowed && d.permissions.includes(permission);
  },

  /**
   * The ONLY data surface an advocate has in this pass: the patient's upcoming
   * schedule, as a minimal DTO. Nothing clinical crosses this boundary — no
   * note, diagnosis, medication, care-plan or message field is read here, so
   * widening scope requires a deliberate edit, not an accident.
   *
   * JUDGMENT CALL (flagged): group TOPICS are withheld for
   * `sud_clinical_preauth` groups, because a topic string on a SUD-track group
   * is itself Part 2 content. Open psychoeducational topics are shown.
   *
   * EXCEPTION (consent-conditional): when an active `advocate_sud_disclosure`
   * ConsentRecord is on file for this patient AND this advocate's link is
   * valid, SUD group topics and appointment service-type labels are shown.
   * Both checks, every read — see `_advocatePart2Unmasked`.
   */
  advocateSchedule(
    linkId: string,
    now = new Date(),
  ): {
    allowed: boolean;
    reason: string;
    items: {
      kind: "appointment" | "group";
      id: string;
      start: string;
      durationMin: number;
      label: string;
      modality?: string;
      locationName?: string;
    }[];
  } {
    const decision = AdelanteEHR.advocateAccess(linkId);
    const link = advocateLinks.find((l) => l.id === linkId);
    if (!decision.allowed || !decision.permissions.includes("schedule_view") || !link) {
      if (link)
        appendAudit({
          category: "advocate",
          action: "advocate_access_denied",
          patientId: link.patientId,
          actorRole: "advocate",
          actorId: link.id,
          detail: {
            advocateLinkId: link.id,
            advocateName: link.advocateName,
            authorizationType: link.authorizationType,
            resource: "upcoming_schedule",
            denyReason: decision.denyReason,
          },
        });
      return { allowed: false, reason: decision.reason, items: [] };
    }

    const from = +now;
    const items: ReturnType<typeof AdelanteEHR.advocateSchedule>["items"] = [];
    // Consent-conditional Part 2 exception. Default is masked; this is the
    // only thing that lifts it, and it is re-evaluated on every read.
    const part2Ok = _advocatePart2Unmasked(link);

    for (const a of AdelanteEHR.appointmentsForPatient(link.patientId)) {
      if (+new Date(a.start) < from) continue;
      if (a.status === "cancelled") continue;
      const loc = a.locationId ? AdelanteEHR.getLocation(a.locationId) : undefined;
      items.push({
        kind: "appointment",
        id: a.id,
        start: a.start,
        durationMin: a.durationMin,
        // Deliberately generic: the service type can imply SUD treatment.
        // Only a patient-signed Part 2 disclosure authorization reveals it.
        label:
          part2Ok && a.serviceType
            ? (AdelanteEHR.getServiceType(a.serviceType)?.label ?? "Appointment")
            : "Appointment",
        ...(a.modality ? { modality: a.modality } : {}),
        ...(loc ? { locationName: loc.name } : {}),
      });
    }

    for (const g of AdelanteEHR.groupsForPatient(link.patientId)) {
      const loc = g.locationId ? AdelanteEHR.getLocation(g.locationId) : undefined;
      for (const start of AdelanteEHR.groupOccurrenceStarts(g.id, 6)) {
        if (+new Date(start) < from) continue;
        items.push({
          kind: "group",
          id: `${g.id}_${start}`,
          start,
          durationMin: g.durationMin,
          label:
            g.category === "open_psychoeducational" || part2Ok ? g.topic : "Group session",
          modality: g.modality,
          ...(loc ? { locationName: loc.name } : {}),
        });
      }
    }

    items.sort((a, b) => +new Date(a.start) - +new Date(b.start));
    appendAudit({
      category: "advocate",
      action: "advocate_schedule_viewed",
      patientId: link.patientId,
      actorRole: "advocate",
      actorId: link.id,
      detail: {
        advocateLinkId: link.id,
        advocateName: link.advocateName,
        authorizationType: link.authorizationType,
        resource: "upcoming_schedule",
        itemCount: items.length,
        // Auditable: whether the Part 2 disclosure exception was in force.
        part2Disclosed: part2Ok,
      },
    });
    return { allowed: true, reason: decision.reason, items };
  },
  // ----- §Phase 4 expansion — coordination / participation / eligibility ----
  //
  // Every method below funnels through `_advocateGate`, so there is exactly
  // ONE place that decides whether an advocate may touch anything, and exactly
  // one place that audits the attempt. 42 CFR Part 2 masking is applied INSIDE
  // each read, on top of the gate — no permission and no tier lifts it.

  /**
   * Housing / food / transport coordination activity, read side. This is the
   * patient's existing SDOH plan (`care_coordination` infrastructure), not a
   * parallel advocate log.
   *
   * PART 2: any item whose need or note text is SUD-identifying is dropped
   * entirely, and only a COUNT is returned — never a description.
   */
  advocateCoordination(linkId: string): {
    allowed: boolean;
    reason: string;
    canWrite: boolean;
    items: { id: string; need: string; status: SdohStatus; note?: string; updatedAt: string }[];
    maskedCount: number;
  } {
    const gate = _advocateGate(linkId, "coordination_view", "care_coordination");
    if (!gate.ok)
      return { allowed: false, reason: gate.reason, canWrite: false, items: [], maskedCount: 0 };
    const all = _patient(gate.link.patientId)?.sdohPlan?.items ?? [];
    const visible = all.filter((i) => !_advocateSudText(`${i.need} ${i.note ?? ""}`));
    _advocateAudit(gate.link, "advocate_coordination_viewed", "care_coordination", {
      itemCount: visible.length,
      maskedCount: all.length - visible.length,
    });
    return {
      allowed: true,
      reason: gate.reason,
      canWrite: AdelanteEHR.advocateCan(linkId, "coordination_write"),
      items: visible.map((i) => ({
        id: i.id,
        need: i.need,
        status: i.status,
        ...(i.note ? { note: i.note } : {}),
        updatedAt: i.updatedAt,
      })),
      maskedCount: all.length - visible.length,
    };
  },

  /**
   * Coordination write. Reuses `addSdohItem` so the item lands in the same
   * closed-loop workflow the care team already works, attributed to the
   * advocate in the note text (there is no separate authorship field on
   * `SdohPlanItem`, and inventing one would fork the model).
   */
  advocateAddCoordinationNeed(
    linkId: string,
    input: { need: string; note?: string },
  ): { ok: boolean; reason: string } {
    const gate = _advocateGate(linkId, "coordination_write", "care_coordination");
    if (!gate.ok) return { ok: false, reason: gate.reason };
    const need = input.need.trim();
    if (!need) return { ok: false, reason: "Describe the need." };
    // Advocates may not introduce Part 2 content either — the mask is
    // bidirectional, so an advocate cannot write SUD detail into a surface
    // they are not permitted to read back.
    if (_advocateSudText(`${need} ${input.note ?? ""}`))
      return {
        ok: false,
        reason:
          "Substance-use treatment details can't be entered here. Please contact the care team directly.",
      };
    AdelanteEHR.addSdohItem(gate.link.patientId, {
      need,
      note: `${input.note ? `${input.note} ` : ""}(Raised by ${gate.link.advocateName}, advocate)`,
    });
    _advocateAudit(gate.link, "advocate_coordination_added", "care_coordination", { need });
    return { ok: true, reason: "Added." };
  },

  /**
   * Reentry care plan PARTICIPATION — read the coordination-relevant plan
   * sections plus the advocate contribution stream. Clinical fields are not
   * included; authorship stays with the ECM Provider / CF Care Manager.
   */
  advocateCarePlanParticipation(linkId: string): {
    allowed: boolean;
    reason: string;
    canWrite: boolean;
    plan?: {
      status: ReentryCarePlan["status"];
      housing: ReentryCarePlan["housing"];
      appointmentCount: number;
      pharmacyName?: string;
      dmeNeeds: string[];
    };
    contributions: AdvocateContribution[];
  } {
    const gate = _advocateGate(linkId, "care_plan_participation_view", "reentry_care_plan");
    if (!gate.ok)
      return { allowed: false, reason: gate.reason, canWrite: false, contributions: [] };
    const plan = AdelanteEHR.reentryCarePlanForPatient(gate.link.patientId);
    _advocateAudit(gate.link, "advocate_care_plan_participation_viewed", "reentry_care_plan", {
      hasPlan: Boolean(plan),
    });
    return {
      allowed: true,
      reason: gate.reason,
      canWrite: AdelanteEHR.advocateCan(linkId, "care_plan_participation_write"),
      ...(plan
        ? {
            plan: {
              status: plan.status,
              housing: plan.housing,
              appointmentCount: plan.appointments.length,
              ...(plan.pharmacy?.name ? { pharmacyName: plan.pharmacy.name } : {}),
              dmeNeeds: plan.dmeNeeds,
            },
          }
        : {}),
      contributions: advocateContributions
        .filter((c) => c.advocateLinkId === gate.link.id)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        .map((c) => ({ ...c })),
    };
  },

  advocateAddCarePlanComment(
    linkId: string,
    input: { section: AdvocateContributionSection; text: string },
  ): { ok: boolean; reason: string } {
    const gate = _advocateGate(linkId, "care_plan_participation_write", "reentry_care_plan");
    if (!gate.ok) return { ok: false, reason: gate.reason };
    const text = input.text.trim();
    if (!text) return { ok: false, reason: "Write something first." };
    if (_advocateSudText(text))
      return {
        ok: false,
        reason:
          "Substance-use treatment details can't be entered here. Please contact the care team directly.",
      };
    advocateContributions.unshift({
      id: uid(),
      advocateLinkId: gate.link.id,
      patientId: gate.link.patientId,
      section: input.section,
      text,
      authorName: gate.link.advocateName,
      createdAt: new Date().toISOString(),
    });
    _advocateAudit(gate.link, "advocate_care_plan_comment_added", "reentry_care_plan", {
      section: input.section,
    });
    emit();
    return { ok: true, reason: "Sent to the care team." };
  },

  /** Care-team side: contributions an advocate has attached to this patient. */
  advocateContributionsForPatient(patientId: string): AdvocateContribution[] {
    return advocateContributions
      .filter((c) => c.patientId === patientId)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .map((c) => ({ ...c }));
  },

  /**
   * Medi-Cal application assistance visibility — the read side of the existing
   * `eligibility` RecordClass workflow. Status and verification only; no
   * clinical eligibility criteria, no SUD-based qualification detail.
   */
  advocateEligibilityAssist(linkId: string): {
    allowed: boolean;
    reason: string;
    canAct: boolean;
    coverage?: { status: CoverageStatus; verified: string; countyOfRelease?: string };
  } {
    const gate = _advocateGate(linkId, "eligibility_assist_view", "eligibility");
    if (!gate.ok) return { allowed: false, reason: gate.reason, canAct: false };
    const cov = _patient(gate.link.patientId)?.coverage;
    _advocateAudit(gate.link, "advocate_eligibility_viewed", "eligibility", {
      status: cov?.status,
    });
    return {
      allowed: true,
      reason: gate.reason,
      canAct: AdelanteEHR.advocateCan(linkId, "eligibility_assist_write"),
      ...(cov
        ? {
            coverage: {
              status: cov.status,
              verified: cov.verified,
              ...(cov.countyOfRelease ? { countyOfRelease: cov.countyOfRelease } : {}),
            },
          }
        : {}),
    };
  },

  /**
   * Acting on the member's behalf on an application. PLACEHOLDER: this records
   * the attestation and audits it; it does not submit anything, because the
   * real DHCS submission path and form content are not defined here.
   */
  advocateAttestEligibilityAssist(
    linkId: string,
    input: { attestedName: string; note?: string },
  ): { ok: boolean; reason: string } {
    const gate = _advocateGate(linkId, "eligibility_assist_write", "eligibility");
    if (!gate.ok) return { ok: false, reason: gate.reason };
    const name = input.attestedName.trim();
    if (!name) return { ok: false, reason: "Type your name to attest." };
    _advocateAudit(gate.link, "advocate_eligibility_assist_attested", "eligibility", {
      attestedName: name,
      note: input.note,
      placeholder: "no_submission_path_defined",
    });
    return { ok: true, reason: "Attestation recorded." };
  },

  /**
   * Decision-making tier ONLY: the clinical care-plan snapshot. Part 2 content
   * is stripped here as well — SUD focus areas, sensitive medications,
   * sensitive screeners and SUD problems never cross this boundary, and the
   * hidden-problem count is reported without any description.
   */
  advocateCarePlanClinical(linkId: string): {
    allowed: boolean;
    reason: string;
    summary?: string;
    focusAreas: { key: string; label: string; severity?: string }[];
    activeGoals: { id: string; text: string }[];
    activeProblems: { label: string }[];
    hiddenSensitiveCount: number;
  } {
    const gate = _advocateGate(linkId, "care_plan_clinical_view", "care_plan");
    if (!gate.ok)
      return {
        allowed: false,
        reason: gate.reason,
        focusAreas: [],
        activeGoals: [],
        activeProblems: [],
        hiddenSensitiveCount: 0,
      };
    const cp = AdelanteEHR.getCarePlan(gate.link.patientId);
    const focusAll = cp?.focusAreas ?? [];
    const focus = focusAll.filter((f) => !f.sensitive);
    const problemsAll = cp?.activeProblems ?? [];
    const problems = problemsAll.filter((pr) => !pr.sensitive);
    const hidden =
      focusAll.length -
      focus.length +
      (problemsAll.length - problems.length) +
      (cp?.hiddenSudProblems ?? 0) +
      (cp?.medications ?? []).filter((m) => m.sensitive).length +
      (cp?.screenerHighlights ?? []).filter((h) => h.sensitive).length;
    _advocateAudit(gate.link, "advocate_care_plan_clinical_viewed", "care_plan", {
      hiddenSensitiveCount: hidden,
    });
    return {
      allowed: true,
      reason: gate.reason,
      ...(cp?.summary ? { summary: cp.summary } : {}),
      focusAreas: focus.map((f) => ({
        key: f.key,
        label: f.label,
        ...(f.severity ? { severity: f.severity } : {}),
      })),
      activeGoals: (cp?.activeGoals ?? []).map((g) => ({ id: g.id, text: g.text })),
      activeProblems: problems.map((pr) => ({ label: pr.label })),
      hiddenSensitiveCount: hidden,
    };
  },


  // ----- §v3.0 Phase 5 — documents -----------------------------------------
  //
  // STORAGE HONESTY FLAG: metadata only, no bytes, no encryption, no object
  // store. See `src/lib/documents.ts`.

  listPatientDocuments(patientId: string): PatientDocument[] {
    return patientDocuments
      .filter((d) => d.patientId === patientId)
      .sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt))
      .map((d) => ({ ...d }));
  },

  getPatientDocument(id: string): PatientDocument | undefined {
    const d = patientDocuments.find((x) => x.id === id);
    return d ? { ...d } : undefined;
  },

  /**
   * Documents that have actually entered the clinical chart: VERIFIED only.
   * An unverified upload is visible in review surfaces (with a pending badge)
   * but is never chart content.
   */
  chartDocuments(patientId: string): PatientDocument[] {
    return AdelanteEHR.listPatientDocuments(patientId).filter(
      (d) => d.verification === "verified",
    );
  },

  documentUploaderLabel(doc: PatientDocument): string {
    return _documentUploaderLabel(doc.uploader);
  },

  documentOwnerRole(patientId: string): "cf_care_manager" | "ecm_provider" {
    return _documentOwnerRole(patientId);
  },

  /**
   * THE single ingest path. Every upload — patient, staff-assisted, advocate —
   * funnels through here, so the scan gate and the unverified default cannot
   * be bypassed by adding a caller.
   */
  uploadPatientDocument(input: {
    patientId: string;
    file: UploadCandidate;
    uploader: DocumentUploader;
    /** REQUIRED at upload time. There is no "classify later" path. */
    isPart2: boolean;
    docType?: string;
    note?: string;
  }): { ok: true; document: PatientDocument } | { ok: false; reason: string; threat?: string } {
    if (!_patient(input.patientId)) return { ok: false, reason: "Unknown patient." };

    // Gate #1 — malware scan BEFORE anything is stored. A flagged file leaves
    // no document record at all; only the rejection is recorded.
    const scan = scanUpload(input.file);
    if (!scan.clean) {
      appendAudit({
        category: "clinical",
        action: "document_upload_rejected",
        patientId: input.patientId,
        actorRole: input.uploader.role ?? input.uploader.kind,
        actorId: input.uploader.staffId ?? input.uploader.advocateLinkId,
        detail: {
          fileName: input.file.fileName,
          threat: scan.threat,
          uploader: _documentUploaderLabel(input.uploader),
        },
      });
      emit();
      return { ok: false, reason: scan.reason, threat: scan.threat };
    }

    const now = new Date().toISOString();
    const doc: PatientDocument = {
      id: `doc_${uid()}`,
      patientId: input.patientId,
      fileName: input.file.fileName.trim(),
      mimeType: input.file.mimeType,
      sizeBytes: input.file.sizeBytes,
      ...(input.docType ? { docType: input.docType } : {}),
      ...(input.note ? { note: input.note } : {}),
      uploadedAt: now,
      uploader: { ...input.uploader },
      isPart2: input.isPart2,
      part2ClassifiedBy: input.uploader.name,
      part2ClassifiedAt: now,
      verification: "unverified",
      scan: { engine: "prototype_stub", scannedAt: now, result: "clean" },
      storage: "metadata_only_no_object_store",
    };
    patientDocuments.unshift(doc);
    appendAudit({
      category: "clinical",
      action: "document_uploaded",
      patientId: doc.patientId,
      actorRole: input.uploader.role ?? input.uploader.kind,
      actorId: input.uploader.staffId ?? input.uploader.advocateLinkId,
      detail: {
        documentId: doc.id,
        fileName: doc.fileName,
        uploader: _documentUploaderLabel(doc.uploader),
        uploaderKind: doc.uploader.kind,
        isPart2: doc.isPart2,
        verification: doc.verification,
        routedTo: _documentOwnerRole(doc.patientId),
      },
    });
    emit();
    return { ok: true, document: { ...doc } };
  },

  /**
   * The verify queue. Ownership is DERIVED from the patient's Phase 2 episode
   * status, never assigned by hand. Passing a role filters to that role's own
   * queue; omitting it returns everything pending.
   */
  documentVerifyQueue(role?: StaffRole): {
    document: PatientDocument;
    patientName: string;
    ownerRole: "cf_care_manager" | "ecm_provider";
    uploaderLabel: string;
  }[] {
    return patientDocuments
      .filter((d) => d.verification === "unverified")
      .map((d) => {
        const p = _patient(d.patientId);
        return {
          document: { ...d },
          patientName: p ? `${p.firstName} ${p.lastName}` : d.patientId,
          ownerRole: _documentOwnerRole(d.patientId),
          uploaderLabel: _documentUploaderLabel(d.uploader),
        };
      })
      .filter((row) => !role || row.ownerRole === role)
      .sort((a, b) => +new Date(a.document.uploadedAt) - +new Date(b.document.uploadedAt));
  },

  /** Promotion: unverified → verified. Real, audited, attributable action. */
  verifyPatientDocument(
    documentId: string,
    by: { staffId?: string; staffName: string; role: StaffRole },
  ): { ok: boolean; reason: string } {
    const doc = patientDocuments.find((d) => d.id === documentId);
    if (!doc) return { ok: false, reason: "That document no longer exists." };
    if (doc.verification === "verified") return { ok: false, reason: "Already verified." };
    doc.verification = "verified";
    doc.promotedBy = by.staffName;
    doc.promotedByRole = by.role;
    doc.promotedAt = new Date().toISOString();
    appendAudit({
      category: "clinical",
      action: "document_verified",
      patientId: doc.patientId,
      actorRole: by.role,
      ...(by.staffId ? { actorId: by.staffId } : {}),
      detail: {
        documentId: doc.id,
        fileName: doc.fileName,
        uploader: _documentUploaderLabel(doc.uploader),
        isPart2: doc.isPart2,
        promotedBy: by.staffName,
        promotedAt: doc.promotedAt,
      },
    });
    emit();
    return { ok: true, reason: "Added to the chart." };
  },

  rejectPatientDocument(
    documentId: string,
    by: { staffId?: string; staffName: string; role: StaffRole; reason: string },
  ): { ok: boolean; reason: string } {
    const doc = patientDocuments.find((d) => d.id === documentId);
    if (!doc) return { ok: false, reason: "That document no longer exists." };
    const why = by.reason.trim();
    if (!why) return { ok: false, reason: "A reason is required." };
    doc.verification = "rejected";
    doc.rejectedReason = why;
    doc.promotedBy = by.staffName;
    doc.promotedAt = new Date().toISOString();
    appendAudit({
      category: "clinical",
      action: "document_rejected",
      patientId: doc.patientId,
      actorRole: by.role,
      ...(by.staffId ? { actorId: by.staffId } : {}),
      detail: { documentId: doc.id, fileName: doc.fileName, reason: why },
    });
    emit();
    return { ok: true, reason: "Marked as not accepted." };
  },

  // ----- advocate document surface (extends Phase 4) ------------------------

  /**
   * Advocate upload. Supportive, non-decision-making: it rides the advocate's
   * EXISTING valid claimed link (`document_upload`, held by both tiers) — a
   * revoked or unclaimed link uploads nothing. The advocate classifies Part 2
   * at upload like every other uploader.
   */
  advocateUploadDocument(
    linkId: string,
    input: { file: UploadCandidate; isPart2: boolean; docType?: string; note?: string },
  ): { ok: boolean; reason: string; documentId?: string } {
    const gate = _advocateGate(linkId, "document_upload", "documents");
    if (!gate.ok) return { ok: false, reason: gate.reason };
    const res = AdelanteEHR.uploadPatientDocument({
      patientId: gate.link.patientId,
      file: input.file,
      isPart2: input.isPart2,
      ...(input.docType ? { docType: input.docType } : {}),
      ...(input.note ? { note: input.note } : {}),
      uploader: {
        kind: "advocate",
        name: gate.link.advocateName,
        advocateLinkId: gate.link.id,
      },
    });
    if (!res.ok) {
      _advocateAudit(gate.link, "advocate_document_upload_rejected", "documents", {
        fileName: input.file.fileName,
        threat: res.threat,
      });
      return { ok: false, reason: res.reason };
    }
    _advocateAudit(gate.link, "advocate_document_uploaded", "documents", {
      documentId: res.document.id,
      fileName: res.document.fileName,
      isPart2: res.document.isPart2,
    });
    return { ok: true, reason: "Sent for review.", documentId: res.document.id };
  },

  /**
   * Advocate document review. Part 2 documents are RESTRICTED, not hidden:
   * the row still appears with a specific explanation, exactly as a masked SUD
   * group still appears as "Group session". The gate is Phase 4's
   * `_advocatePart2Unmasked` called directly — one consent check, not a second
   * implementation of it.
   */
  advocateDocuments(linkId: string): {
    allowed: boolean;
    reason: string;
    canUpload: boolean;
    items: {
      id: string;
      fileName: string;
      uploadedAt: string;
      uploaderLabel: string;
      verification: DocumentVerificationStatus;
      isPart2: boolean;
      restricted: boolean;
      restrictionMessage?: string;
      docType?: string;
    }[];
  } {
    const gate = _advocateGate(linkId, "document_view", "documents");
    if (!gate.ok) return { allowed: false, reason: gate.reason, canUpload: false, items: [] };
    const part2Ok = _advocatePart2Unmasked(gate.link);
    const items = AdelanteEHR.listPatientDocuments(gate.link.patientId).map((d) => {
      const vis = advocateDocumentVisibility({ isPart2: d.isPart2, part2Unmasked: part2Ok });
      return {
        id: d.id,
        // A restricted document's own FILE NAME can be Part 2 content, so it
        // is replaced rather than shown — the row's existence is the signal.
        fileName: vis.restricted ? "Protected document" : d.fileName,
        uploadedAt: d.uploadedAt,
        uploaderLabel: _documentUploaderLabel(d.uploader),
        verification: d.verification,
        isPart2: d.isPart2,
        restricted: vis.restricted,
        ...(vis.restrictionMessage ? { restrictionMessage: vis.restrictionMessage } : {}),
        ...(d.docType && !vis.restricted ? { docType: d.docType } : {}),
      };
    });
    _advocateAudit(gate.link, "advocate_documents_viewed", "documents", {
      itemCount: items.length,
      restrictedCount: items.filter((i) => i.restricted).length,
      part2Disclosed: part2Ok,
    });
    return {
      allowed: true,
      reason: gate.reason,
      canUpload: AdelanteEHR.advocateCan(linkId, "document_upload"),
      items,
    };
  },

  // ----- §Phase 4 expansion — advocate as their own patient ----------------
  //
  // ONE identity, TWO records. The advocate keeps a single sign-in; opening
  // their own care creates a NORMAL `Patient` via the NORMAL `createPatient`
  // path and routes them into the standard intake flow. There is no advocate
  // flavour of patient, and no field on either record that lets one side read
  // the other: `selfPatientId` is only ever resolved by
  // `advocateSelfPatient`, which never returns anything about
  // `link.patientId`, and every advocate-side read above resolves
  // `link.patientId` and never consults `selfPatientId`.

  /** The advocate's OWN patient record, if they have opened one. */
  advocateSelfPatient(linkId: string): Patient | undefined {
    const link = advocateLinks.find((l) => l.id === linkId);
    if (!link?.selfPatientId) return undefined;
    // Belt and braces: a self record can never be the advocated-for record.
    if (link.selfPatientId === link.patientId) return undefined;
    const p = _patient(link.selfPatientId);
    return p ? { ...p } : undefined;
  },

  /**
   * "Would you like support for yourself too?" — accepted. Creates the
   * advocate's own Patient record and returns it so the caller can hand off to
   * the standard intake route. Idempotent.
   */
  startAdvocateSelfCare(
    linkId: string,
    input: { firstName: string; lastName: string; dob?: string; phone?: string },
  ): Patient {
    const link = advocateLinks.find((l) => l.id === linkId);
    if (!link) throw new Error("Unknown advocate connection.");
    const existing = AdelanteEHR.advocateSelfPatient(linkId);
    if (existing) return existing;
    if (!input.firstName.trim() || !input.lastName.trim())
      throw new Error("Your first and last name are required.");
    const p = AdelanteEHR.createPatient({
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      ...(input.dob ? { dob: input.dob } : {}),
      ...(input.phone ? { phone: input.phone } : {}),
    });
    if (p.id === link.patientId)
      throw new Error("A self record cannot be the person you are advocating for.");
    link.selfPatientId = p.id;
    link.selfPatientStartedAt = new Date().toISOString();
    // Audited against the ADVOCATE'S OWN record, not the advocated-for
    // patient's: this event is not part of the other person's chart.
    appendAudit({
      category: "advocate",
      action: "advocate_self_care_started",
      patientId: p.id,
      actorRole: "advocate",
      actorId: link.id,
      detail: { advocateLinkId: link.id, advocateName: link.advocateName },
    });
    emit();
    return p;
  },

  declineAdvocateSelfCare(linkId: string) {
    const link = advocateLinks.find((l) => l.id === linkId);
    if (!link) return;
    link.selfCareOfferDeclinedAt = new Date().toISOString();
    emit();
  },

  /**
   * §Phase 3 community billing — a refused claim attempt (Peer / CHW).
   * Recorded at the point of the attempt so the block is visible in the same
   * audit stream as everything else, not discovered later at claims review.
   */
  recordCommunityBillingBlocked(input: {
    patientId: string;
    actorId?: string;
    actorRole?: string;
    service: "peer_support" | "chw_services";
    reasonCode: string;
    reason: string;
    detail?: Record<string, unknown>;
  }) {
    appendAudit({
      category: "clinical",
      action: "community_billing_blocked",
      patientId: input.patientId,
      actorId: input.actorId,
      actorRole: input.actorRole,
      detail: {
        service: input.service,
        reasonCode: input.reasonCode,
        reason: input.reason,
        ...input.detail,
      },
    });
  },
  listAuditEvents(
    filter: {
      patientId?: string;
      category?: AuditCategory | AuditCategory[];
      since?: string;
      until?: string;
      actorRole?: string;
      limit?: number;
    } = {},
  ): AuditEvent[] {
    const cats = Array.isArray(filter.category)
      ? new Set(filter.category)
      : filter.category
        ? new Set([filter.category])
        : null;
    const sinceMs = filter.since ? +new Date(filter.since) : 0;
    const untilMs = filter.until ? +new Date(filter.until) : 0;
    const out = auditEvents.filter((e) => {
      if (filter.patientId && e.patientId !== filter.patientId) return false;
      if (cats && !cats.has(e.category)) return false;
      if (sinceMs && +new Date(e.at) < sinceMs) return false;
      if (untilMs && +new Date(e.at) > untilMs) return false;
      if (filter.actorRole && (e.actorRole ?? "") !== filter.actorRole) return false;
      return true;
    });
    return filter.limit ? out.slice(0, filter.limit) : out;
  },

  // ---------- Catalog strength-resolution telemetry ----------
  /** Audit trail for exported goal-status-change logs (who took a copy, and when). */
  recordGoalAuditExport(input: {
    filename: string;
    rowCount: number;
    staffName: string;
    filters: Record<string, string | undefined>;
  }) {
    appendAudit({
      category: "care_plan",
      action: "goal_audit_exported",
      actorRole: "admin",
      actorId: input.staffName,
      detail: {
        filename: input.filename,
        rowCount: input.rowCount,
        format: "csv",
        ...input.filters,
      },
    });
    emit();
  },
  /** Audit trail for exported refusal documents (who took a copy, and when). */
  recordRefusalFormExport(input: {
    patientId: string;
    formId: string;
    filename: string;
    staffName: string;
  }) {
    appendAudit({
      category: "clinical",
      action: "refusal_form_exported",
      patientId: input.patientId,
      actorId: input.staffName,
      detail: { formId: input.formId, filename: input.filename, format: "pdf" },
    });
    emit();
  },

  // Recorded at catalog-selection time so admins can see how often RxNav data
  // was insufficient, not just which orders ended up manually dosed.
  recordCatalogResolution(input: {
    rxcui?: string;
    productName: string;
    path: CatalogResolutionPath;
    doseForm?: string;
  }) {
    appendAudit({
      category: "rx",
      action: "catalog_strength_resolution",
      detail: {
        rxcui: input.rxcui,
        productName: input.productName,
        path: input.path,
        doseForm: input.doseForm,
      },
    });
    emit();
  },

  catalogResolutionMetrics(since?: string): CatalogResolutionMetrics {
    const sinceMs = since ? +new Date(since) : 0;
    const inWindow = (e: AuditEvent) => !sinceMs || +new Date(e.at) >= sinceMs;
    const m: CatalogResolutionMetrics = {
      selections: 0,
      rxnav: 0,
      unitsParsed: 0,
      topical: 0,
      dailymedAttempted: 0,
      dailymedResolved: 0,
      dailymedEmpty: 0,
      signedOrders: 0,
      manualDoseOrders: 0,
      recentManualJustifications: [],
    };
    for (const e of auditEvents) {
      if (!inWindow(e)) continue;
      if (e.action === "catalog_strength_resolution") {
        const path = e.detail?.path as CatalogResolutionPath | undefined;
        m.selections += 1;
        if (path === "rxnav") m.rxnav += 1;
        else if (path === "units_parsed") m.unitsParsed += 1;
        else if (path === "topical") m.topical += 1;
        else if (path === "dailymed_resolved") {
          m.dailymedAttempted += 1;
          m.dailymedResolved += 1;
        } else if (path === "dailymed_empty") {
          m.dailymedAttempted += 1;
          m.dailymedEmpty += 1;
        }
      } else if (e.action === "order_strength_provenance") {
        m.signedOrders += 1;
        const justification = e.detail?.manualDoseJustification as string | undefined;
        if (justification) {
          m.manualDoseOrders += 1;
          if (m.recentManualJustifications.length < 5) {
            m.recentManualJustifications.push({
              at: e.at,
              drugName: String(e.detail?.drugName ?? "—"),
              justification,
            });
          }
        }
      }
    }
    return m;
  },
  // ---------- Medication refill requests ----------
  requestRefill(input: {
    patientId: string;
    medicationId: string;
    pharmacyNote?: string;
    requestedBy?: "patient" | "clinician";
  }): RefillRequest | undefined {
    const meds = _vendors.erx.listActiveMedications(input.patientId);
    const med = meds.find((m) => m.id === input.medicationId);
    if (!med) return undefined;
    // Dedupe: don't stack pending requests for the same medication.
    const existing = refillRequests.find(
      (r) =>
        r.patientId === input.patientId &&
        r.medicationId === input.medicationId &&
        r.status === "pending",
    );
    if (existing) return existing;
    const req: RefillRequest = {
      id: `rx_ref_${refillRequests.length + 1}_${Math.random().toString(36).slice(2, 6)}`,
      patientId: input.patientId,
      medicationId: input.medicationId,
      medicationName: med.name,
      requestedAt: new Date().toISOString(),
      requestedBy: input.requestedBy ?? "patient",
      pharmacyNote: input.pharmacyNote,
      status: "pending",
    };
    refillRequests.unshift(req);
    appendAudit({
      category: "rx",
      action: "refill_requested",
      patientId: input.patientId,
      detail: { medicationId: med.id, medicationName: med.name, requestedBy: req.requestedBy },
    });
    // Surface in the case-task queue so the prescribing team sees it.
    // Assign to the patient's case manager if present; else park unassigned.
    const patient = patients.find((p) => p.id === input.patientId);
    const dueDate = new Date().toISOString().slice(0, 10);
    // Use a stable dedupeKey so multiple visits don't duplicate the task.
    (this as typeof AdelanteEHR).createCaseTask({
      patientId: input.patientId,
      assignedTo: patient?.caseManagerId ?? "",
      title: `Refill request: ${med.name} ${med.dose}`,
      detail:
        `${med.frequency} · prescriber ${med.prescriber}` +
        (input.pharmacyNote ? ` · note: ${input.pharmacyNote}` : ""),
      dueDate,
      origin: "manual",
      dedupeKey: `refill:${req.id}`,
    });
    _recomputeCarePlan(input.patientId, "refill_requested");
    emit();
    return req;
  },
  reviewRefill(input: {
    id: string;
    decision: "approved" | "denied";
    denyReason?: string;
    clinicianId?: string;
  }): RefillRequest | undefined {
    const req = refillRequests.find((r) => r.id === input.id);
    if (!req) return undefined;
    // Detect a prescriber switch: compare against the most recent *prior* refill
    // (any status) for the same medication that had a different reviewer.
    const priorReviewer = refillRequests
      .filter(
        (r) =>
          r.id !== req.id &&
          r.medicationId === req.medicationId &&
          r.patientId === req.patientId &&
          r.reviewedBy,
      )
      .sort((a, b) => +new Date(b.reviewedAt ?? 0) - +new Date(a.reviewedAt ?? 0))[0]?.reviewedBy;
    req.status = input.decision === "approved" ? "sent_to_pharmacy" : "denied";
    req.reviewedBy = input.clinicianId;
    req.reviewedAt = new Date().toISOString();
    if (input.decision === "denied") req.denyReason = input.denyReason;
    if (
      input.decision === "approved" &&
      priorReviewer &&
      input.clinicianId &&
      priorReviewer !== input.clinicianId
    ) {
      _flagProviderSwitch({
        patientId: req.patientId,
        fromClinicianId: priorReviewer,
        toClinicianId: input.clinicianId,
        reason: "refill_review",
        context: `Medication: ${req.medicationName}.`,
        initiatedBy: "clinician",
        linkedRefillId: req.id,
      });
    }
    appendAudit({
      category: "rx",
      action: input.decision === "approved" ? "refill_approved" : "refill_denied",
      patientId: req.patientId,
      actorId: input.clinicianId,
      detail: {
        medicationId: req.medicationId,
        medicationName: req.medicationName,
        denyReason: req.denyReason,
        source: "escribe-mock",
      },
    });
    // Close the linked CM task.
    const task = caseTasks.find((t) => t.dedupeKey === `refill:${req.id}` && t.status !== "done");
    if (task) {
      task.status = "done";
      task.completedAt = new Date().toISOString();
    }
    _recomputeCarePlan(req.patientId, `refill_${input.decision}`);
    emit();
    return req;
  },
  listRefillRequests(filter: { patientId?: string; status?: RefillStatus } = {}): RefillRequest[] {
    return refillRequests.filter((r) => {
      if (filter.patientId && r.patientId !== filter.patientId) return false;
      if (filter.status && r.status !== filter.status) return false;
      return true;
    });
  },

  // ---------- Telehealth session lifecycle ----------
  startTelehealthSession(appointmentId: string): TelehealthSession | undefined {
    const appt = appointments.find((a) => a.id === appointmentId);
    if (!appt) return undefined;
    let session = telehealthSessions.find((s) => s.appointmentId === appointmentId);
    if (session) return session;
    const now = new Date();
    const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    session = {
      id: `th_${telehealthSessions.length + 1}_${Math.random().toString(36).slice(2, 6)}`,
      appointmentId,
      patientId: appt.patientId,
      clinicianId: appt.clinicianId,
      vendor: _vendors.telehealth.vendorName,
      roomId: `rm_${appointmentId}`,
      joinUrlPatient: _vendors.telehealth.getJoinUrl(appointmentId, "patient"),
      joinUrlClinician: _vendors.telehealth.getJoinUrl(appointmentId, "clinician"),
      state: "scheduled",
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
    };
    telehealthSessions.unshift(session);
    appendAudit({
      category: "telehealth",
      action: "session_created",
      patientId: session.patientId,
      detail: { appointmentId, roomId: session.roomId, vendor: session.vendor },
    });
    emit();
    return session;
  },
  markTelehealthJoin(
    appointmentId: string,
    role: "patient" | "clinician",
  ): TelehealthSession | undefined {
    const session = this.startTelehealthSession(appointmentId);
    if (!session) return undefined;
    const now = new Date().toISOString();
    if (role === "clinician") {
      session.state =
        session.state === "patient_joined" || session.state === "in_progress"
          ? "in_progress"
          : "clinician_joined";
    } else {
      session.state =
        session.state === "clinician_joined" || session.state === "in_progress"
          ? "in_progress"
          : "patient_joined";
    }
    if (session.state === "in_progress" && !session.startedAt) {
      session.startedAt = now;
    }
    appendAudit({
      category: "telehealth",
      action: role === "clinician" ? "clinician_joined" : "patient_joined",
      patientId: session.patientId,
      detail: { appointmentId, state: session.state },
    });
    emit();
    return session;
  },
  endTelehealthSession(appointmentId: string, reason?: string): TelehealthSession | undefined {
    const session = telehealthSessions.find((s) => s.appointmentId === appointmentId);
    if (!session || session.state === "ended") return session;
    const now = new Date();
    session.state = "ended";
    session.endedAt = now.toISOString();
    session.endReason = reason;
    if (session.startedAt) {
      session.durationSec = Math.round((now.getTime() - +new Date(session.startedAt)) / 1000);
    }
    appendAudit({
      category: "telehealth",
      action: "session_ended",
      patientId: session.patientId,
      detail: { appointmentId, durationSec: session.durationSec, reason },
    });
    emit();
    return session;
  },
  listTelehealthSessions(filter: { patientId?: string; since?: string } = {}): TelehealthSession[] {
    // Sweep expirations lazily on read.
    const now = Date.now();
    for (const s of telehealthSessions) {
      if (s.state !== "ended" && s.state !== "expired" && +new Date(s.expiresAt) < now) {
        s.state = "expired";
        appendAudit({
          category: "telehealth",
          action: "session_expired",
          patientId: s.patientId,
          detail: { appointmentId: s.appointmentId },
        });
      }
    }
    const sinceMs = filter.since ? +new Date(filter.since) : 0;
    return telehealthSessions.filter((s) => {
      if (filter.patientId && s.patientId !== filter.patientId) return false;
      if (sinceMs && +new Date(s.createdAt) < sinceMs) return false;
      return true;
    });
  },
  getTelehealthSession(appointmentId: string): TelehealthSession | undefined {
    return telehealthSessions.find((s) => s.appointmentId === appointmentId);
  },

  // ---------- Vendor pings ----------
  async pingVendors(): Promise<{ telehealth: PingResult; erx: PingResult }> {
    const [th, er] = await Promise.all([_vendors.telehealth.ping(), _vendors.erx.ping()]);
    const t: PingResult = { vendor: _vendors.telehealth.vendorName, ok: th.ok, at: th.at };
    const e: PingResult = { vendor: _vendors.erx.vendorName, ok: er.ok, at: er.at };
    vendorPings.unshift(t, e);
    if (vendorPings.length > 10) vendorPings.length = 10;
    appendAudit({ category: "vendor", action: "ping", detail: { telehealth: t, erx: e } });
    emit();
    return { telehealth: t, erx: e };
  },
  lastVendorPings(vendor: string): PingResult[] {
    return vendorPings.filter((p) => p.vendor === vendor).slice(0, 5);
  },

  // ---------- Provider switch notifications ----------
  listProviderSwitches(
    filter: {
      patientId?: string;
      clinicianId?: string;
      role?: "outgoing" | "incoming" | "either";
      status?: ProviderSwitchStatus | "any";
    } = {},
  ): ProviderSwitch[] {
    return providerSwitches.filter((s) => {
      if (filter.patientId && s.patientId !== filter.patientId) return false;
      if (filter.clinicianId) {
        const role = filter.role ?? "outgoing";
        if (role === "outgoing" && s.fromClinicianId !== filter.clinicianId) return false;
        if (role === "incoming" && s.toClinicianId !== filter.clinicianId) return false;
        if (
          role === "either" &&
          s.fromClinicianId !== filter.clinicianId &&
          s.toClinicianId !== filter.clinicianId
        )
          return false;
      }
      if (filter.status && filter.status !== "any" && s.status !== filter.status) return false;
      return true;
    });
  },
  getPreviousProviderFor(patientId: string, serviceType?: ServiceType): string | undefined {
    return _previousProviderFor(patientId, serviceType);
  },
  acknowledgeProviderSwitch(
    id: string,
    actorId?: string,
    note?: string,
  ): ProviderSwitch | undefined {
    const s = providerSwitches.find((x) => x.id === id);
    if (!s) return undefined;
    s.status = "acknowledged";
    s.resolvedAt = new Date().toISOString();
    s.resolvedBy = actorId;
    s.resolutionNote = note;
    // Close linked outgoing-clinician task.
    const task = caseTasks.find((t) => t.dedupeKey === `switch-out:${s.id}` && t.status !== "done");
    if (task) {
      task.status = "done";
      task.completedAt = new Date().toISOString();
    }
    appendAudit({
      category: "provider_switch",
      action: "switch_acknowledged",
      patientId: s.patientId,
      actorId,
      detail: { switchId: s.id, note },
    });
    emit();
    return s;
  },
  dismissProviderSwitch(id: string, actorId?: string, note?: string): ProviderSwitch | undefined {
    const s = providerSwitches.find((x) => x.id === id);
    if (!s) return undefined;
    s.status = "dismissed";
    s.resolvedAt = new Date().toISOString();
    s.resolvedBy = actorId;
    s.resolutionNote = note;
    const task = caseTasks.find((t) => t.dedupeKey === `switch-out:${s.id}` && t.status !== "done");
    if (task) {
      task.status = "done";
      task.completedAt = new Date().toISOString();
    }
    appendAudit({
      category: "provider_switch",
      action: "switch_dismissed",
      patientId: s.patientId,
      actorId,
      detail: { switchId: s.id, note },
    });
    emit();
    return s;
  },
  reassignPrimaryClinician(input: {
    patientId: string;
    clinicianId: string;
    initiatedBy?: ProviderSwitch["initiatedBy"];
    context?: string;
  }): ProviderSwitch | undefined {
    const p = patients.find((x) => x.id === input.patientId);
    if (!p) return undefined;
    const prev = p.primaryClinicianId;
    p.primaryClinicianId = input.clinicianId;
    const sw = _flagProviderSwitch({
      patientId: p.id,
      fromClinicianId: prev,
      toClinicianId: input.clinicianId,
      reason: "primary_reassignment",
      context: input.context,
      initiatedBy: input.initiatedBy ?? "admin",
    });
    emit();
    return sw;
  },
  assignCaseManager(input: {
    patientId: string;
    caseManagerId: string;
    actorId?: string;
  }): Patient | undefined {
    const p = patients.find((x) => x.id === input.patientId);
    if (!p) return undefined;
    const prev = p.caseManagerId;
    if (prev === input.caseManagerId) return p;
    p.caseManagerId = input.caseManagerId;
    appendAudit({
      category: "assignment",
      action: prev ? "case_manager_reassigned" : "case_manager_assigned",
      patientId: p.id,
      actorId: input.actorId,
      detail: { from: prev, to: input.caseManagerId },
    });
    emit();
    return p;
  },

  // ---------- Clinical record layer: Problems / Allergies / Alerts ----------
  // Field-for-field mirror of BaggaEMR. Every write appends an audit event
  // with category "clinical"; soft-deletes require a non-empty reason;
  // problem/allergy writes trigger `_recomputeCarePlan` so the patient's
  // plain-language summary stays live.

  listProblems(patientId: string, opts?: { includeDeleted?: boolean }): Problem[] {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return [];
    const rows = p.problems ?? [];
    return opts?.includeDeleted ? [...rows] : rows.filter((r) => !r.deletedAt);
  },
  addProblem(
    patientId: string,
    input: {
      description: string;
      icd10Code?: string;
      snomedCode?: string;
      snomedDisplay?: string;
      category?: Problem["category"];
      priority?: number;
      onsetDate?: string;
      clinicianComment?: string;
      notes?: string;
      enteredBy: string;
    },
  ): Problem {
    const p = patients.find((x) => x.id === patientId);
    if (!p) throw new Error("Patient not found");
    const now = new Date().toISOString();
    const row: Problem = {
      id: uid(),
      patientId,
      description: input.description.trim(),
      icd10Code: input.icd10Code,
      snomedCode: input.snomedCode,
      snomedDisplay: input.snomedDisplay,
      category: input.category,
      priority: input.priority,
      onsetDate: input.onsetDate,
      clinicianComment: input.clinicianComment,
      notes: input.notes,
      status: "active",
      enteredBy: input.enteredBy,
      createdAt: now,
    };
    p.problems = [row, ...(p.problems ?? [])];
    appendAudit({
      category: "clinical",
      action: "problem_added",
      patientId,
      actorId: input.enteredBy,
      detail: { icd10: row.icd10Code, snomed: row.snomedCode, category: row.category },
    });
    _recomputeCarePlan(patientId, "problem_added");
    emit();
    return row;
  },
  updateProblem(
    patientId: string,
    problemId: string,
    patch: Partial<
      Pick<
        Problem,
        | "description"
        | "icd10Code"
        | "snomedCode"
        | "snomedDisplay"
        | "category"
        | "priority"
        | "onsetDate"
        | "clinicianComment"
        | "notes"
      >
    >,
    actor: string,
  ) {
    const p = patients.find((x) => x.id === patientId);
    const row = p?.problems?.find((r) => r.id === problemId);
    if (!p || !row || row.deletedAt) return;
    Object.assign(row, patch);
    row.updatedAt = new Date().toISOString();
    row.updatedBy = actor;
    appendAudit({
      category: "clinical",
      action: "problem_updated",
      patientId,
      actorId: actor,
      detail: { problemId, patch },
    });
    _recomputeCarePlan(patientId, "problem_updated");
    emit();
  },
  resolveProblem(patientId: string, problemId: string, actor: string, resolvedDate?: string) {
    const p = patients.find((x) => x.id === patientId);
    const row = p?.problems?.find((r) => r.id === problemId);
    if (!p || !row || row.deletedAt) return;
    row.status = "resolved";
    row.resolvedBy = actor;
    row.resolvedDate = resolvedDate ?? new Date().toISOString();
    appendAudit({
      category: "clinical",
      action: "problem_resolved",
      patientId,
      actorId: actor,
      detail: { problemId },
    });
    _recomputeCarePlan(patientId, "problem_resolved");
    emit();
  },
  reactivateProblem(patientId: string, problemId: string, actor: string) {
    const p = patients.find((x) => x.id === patientId);
    const row = p?.problems?.find((r) => r.id === problemId);
    if (!p || !row || row.deletedAt) return;
    row.status = "active";
    row.resolvedBy = undefined;
    row.resolvedDate = undefined;
    row.updatedAt = new Date().toISOString();
    row.updatedBy = actor;
    appendAudit({
      category: "clinical",
      action: "problem_reactivated",
      patientId,
      actorId: actor,
      detail: { problemId },
    });
    _recomputeCarePlan(patientId, "problem_reactivated");
    emit();
  },
  softDeleteProblem(patientId: string, problemId: string, reason: string, actor: string) {
    const trimmed = reason?.trim();
    if (!trimmed) throw new Error("A reason is required to remove a problem.");
    const p = patients.find((x) => x.id === patientId);
    const row = p?.problems?.find((r) => r.id === problemId);
    if (!p || !row || row.deletedAt) return;
    row.deletedAt = new Date().toISOString();
    row.deletionReason = trimmed;
    row.updatedAt = row.deletedAt;
    row.updatedBy = actor;
    appendAudit({
      category: "clinical",
      action: "problem_soft_deleted",
      patientId,
      actorId: actor,
      detail: { problemId, reason: trimmed },
    });
    _recomputeCarePlan(patientId, "problem_soft_deleted");
    emit();
  },

  listAllergies(patientId: string, opts?: { includeRemoved?: boolean }): Allergy[] {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return [];
    const rows = p.allergies ?? [];
    return opts?.includeRemoved ? [...rows] : rows.filter((r) => r.active);
  },
  addAllergy(
    patientId: string,
    input: {
      substance: string;
      reaction?: string;
      severity: Allergy["severity"];
      notes?: string;
      enteredBy: string;
    },
  ): Allergy {
    const p = patients.find((x) => x.id === patientId);
    if (!p) throw new Error("Patient not found");
    const row: Allergy = {
      id: uid(),
      patientId,
      substance: input.substance.trim(),
      reaction: input.reaction?.trim() || undefined,
      severity: input.severity,
      notes: input.notes?.trim() || undefined,
      active: true,
      enteredBy: input.enteredBy,
      enteredAt: new Date().toISOString(),
    };
    p.allergies = [row, ...(p.allergies ?? [])];
    appendAudit({
      category: "clinical",
      action: "allergy_added",
      patientId,
      actorId: input.enteredBy,
      detail: { substance: row.substance, severity: row.severity },
    });
    _recomputeCarePlan(patientId, "allergy_added");
    emit();
    return row;
  },
  softDeleteAllergy(patientId: string, allergyId: string, reason: string, actor: string) {
    const trimmed = reason?.trim();
    if (!trimmed) throw new Error("A reason is required to remove an allergy.");
    const p = patients.find((x) => x.id === patientId);
    const row = p?.allergies?.find((r) => r.id === allergyId);
    if (!p || !row || !row.active) return;
    row.active = false;
    row.removedAt = new Date().toISOString();
    row.removedBy = actor;
    row.removedReason = trimmed;
    appendAudit({
      category: "clinical",
      action: "allergy_removed",
      patientId,
      actorId: actor,
      detail: { allergyId, reason: trimmed },
    });
    _recomputeCarePlan(patientId, "allergy_removed");
    emit();
  },

  listAlerts(patientId: string, opts?: { includeRemoved?: boolean }): PatientAlert[] {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return [];
    const rows = p.alerts ?? [];
    return opts?.includeRemoved ? [...rows] : rows.filter((r) => r.active);
  },
  addAlert(
    patientId: string,
    input: {
      label: string;
      severity: PatientAlert["severity"];
      notes?: string;
      enteredBy: string;
    },
  ): PatientAlert {
    const p = patients.find((x) => x.id === patientId);
    if (!p) throw new Error("Patient not found");
    const row: PatientAlert = {
      id: uid(),
      patientId,
      label: input.label.trim(),
      severity: input.severity,
      notes: input.notes?.trim() || undefined,
      active: true,
      enteredBy: input.enteredBy,
      enteredAt: new Date().toISOString(),
    };
    p.alerts = [row, ...(p.alerts ?? [])];
    appendAudit({
      category: "clinical",
      action: "alert_added",
      patientId,
      actorId: input.enteredBy,
      detail: { label: row.label, severity: row.severity },
    });
    emit();
    return row;
  },
  softDeleteAlert(patientId: string, alertId: string, reason: string, actor: string) {
    const trimmed = reason?.trim();
    if (!trimmed) throw new Error("A reason is required to remove an alert.");
    const p = patients.find((x) => x.id === patientId);
    const row = p?.alerts?.find((r) => r.id === alertId);
    if (!p || !row || !row.active) return;
    row.active = false;
    row.removedAt = new Date().toISOString();
    row.removedBy = actor;
    row.removedReason = trimmed;
    appendAudit({
      category: "clinical",
      action: "alert_removed",
      patientId,
      actorId: actor,
      detail: { alertId, reason: trimmed },
    });
    emit();
  },

  // ----- §Crisis escalation ------------------------------------------------
  // Two records, one act: the PatientAlert (the visible flag, created through
  // the SAME addAlert path as every other alert) and the CrisisEscalation
  // (the workflow wrapper the cross-patient queue reads). Resolution closes
  // the alert through softDeleteAlert — there is no second alert-closing path.
  CRISIS_ALERT_LABEL: "Crisis escalation — active",

  listCrisisEscalations(patientId: string, opts?: { status?: CrisisEscalation["status"] }) {
    const p = patients.find((x) => x.id === patientId);
    const rows = p?.crisisEscalations ?? [];
    return opts?.status ? rows.filter((r) => r.status === opts.status) : [...rows];
  },

  /** Cross-patient open queue, oldest-open first (longest open = most urgent). */
  listOpenCrisisEscalations(): { patient: Patient; escalation: CrisisEscalation }[] {
    const out: { patient: Patient; escalation: CrisisEscalation }[] = [];
    for (const p of patients) {
      for (const e of p.crisisEscalations ?? []) {
        if (e.status === "open") out.push({ patient: p, escalation: e });
      }
    }
    return out.sort((a, b) => +new Date(a.escalation.triggeredAt) - +new Date(b.escalation.triggeredAt));
  },

  flagCrisis(
    patientId: string,
    staffName: string,
    reason: string,
    opts?: { triggerSource?: CrisisEscalation["triggerSource"]; sourceNoteId?: string },
  ): CrisisEscalation {
    const detail = reason?.trim();
    if (!detail || detail.length < 3)
      throw new Error("A reason of at least 3 characters is required to flag a crisis.");
    const p = patients.find((x) => x.id === patientId);
    if (!p) throw new Error("Patient not found");
    const alert = AdelanteEHR.addAlert(patientId, {
      label: AdelanteEHR.CRISIS_ALERT_LABEL,
      severity: "critical",
      notes: detail,
      enteredBy: staffName,
    });
    const row: CrisisEscalation = {
      id: uid(),
      patientId,
      alertId: alert.id,
      triggerSource: opts?.triggerSource ?? "manual",
      triggerDetail: detail,
      triggeredBy: staffName,
      triggeredAt: new Date().toISOString(),
      status: "open",
    };
    p.crisisEscalations = [row, ...(p.crisisEscalations ?? [])];
    appendAudit({
      category: "clinical",
      action: "crisis_escalation_flagged",
      patientId,
      actorId: staffName,
      detail: {
        escalationId: row.id,
        alertId: alert.id,
        triggerSource: row.triggerSource,
        triggerDetail: detail,
        sourceNoteId: opts?.sourceNoteId ?? null,
      },
    });
    // §Notification feed — clinical_coordinator owns crisis disposition. This
    // is the single call site for both manual and screener-triggered flags.
    AdelanteEHR.notify({
      recipientRole: "clinical_coordinator",
      category: "crisis_flagged",
      subject: `Crisis flagged — ${patientLabel(patientId)}`,
      body: `${staffName} flagged a crisis (${row.triggerSource === "screener_score" ? "screener score" : "manual"}): ${detail}`,
      linkRoute: "/crisis-queue",
      patientId,
    });
    emit();
    return row;
  },

  resolveCrisisEscalation(
    patientId: string,
    id: string,
    staffName: string,
    input: { contactedWhom?: string; actionsTaken?: string; disposition: string },
  ): CrisisEscalation {
    const disposition = input.disposition?.trim();
    if (!disposition) throw new Error("A disposition is required to resolve a crisis escalation.");
    const p = patients.find((x) => x.id === patientId);
    const row = p?.crisisEscalations?.find((r) => r.id === id);
    if (!p || !row) throw new Error("Crisis escalation not found.");
    if (row.status === "resolved") throw new Error("This escalation is already resolved.");
    row.status = "resolved";
    row.contactedWhom = input.contactedWhom?.trim() || undefined;
    row.actionsTaken = input.actionsTaken?.trim() || undefined;
    row.disposition = disposition;
    row.resolutionReason = disposition;
    row.resolvedBy = staffName;
    row.resolvedAt = new Date().toISOString();
    // Close the visible flag through the existing remove-alert-with-reason path.
    AdelanteEHR.softDeleteAlert(
      patientId,
      row.alertId,
      `Crisis escalation resolved — ${disposition}`,
      staffName,
    );
    appendAudit({
      category: "clinical",
      action: "crisis_escalation_resolved",
      patientId,
      actorId: staffName,
      detail: {
        escalationId: row.id,
        alertId: row.alertId,
        disposition,
        contactedWhom: row.contactedWhom ?? null,
        actionsTaken: row.actionsTaken ?? null,
      },
    });
    emit();
    return row;
  },

  // ----- Orders (§Orders — BaggaEMR OrderCart port, core only) -------------
  // TODO(orders): pharmacy routing / transmission and dispense are NOT here by
  // design. `signOrders` only releases the order to the chart; a later pass
  // must add the transmit step and its own audit action.
  listOrders(patientId: string, opts?: { status?: MedOrder["status"] }): MedOrder[] {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return [];
    const rows = p.orders ?? [];
    return opts?.status ? rows.filter((r) => r.status === opts.status) : [...rows];
  },
  addDraftOrder(
    patientId: string,
    input: Omit<MedOrder, "id" | "patientId" | "status" | "attestedAt" | "attestedBy">,
  ): MedOrder {
    const p = patients.find((x) => x.id === patientId);
    if (!p) throw new Error("Patient not found");
    const row: MedOrder = {
      ...input,
      id: uid(),
      patientId,
      drugName: input.drugName.trim(),
      status: "draft",
      // First-class start date, defaulted to the facility's today. Editable in
      // the Orders tab before signing.
      startDate: input.startDate ?? facilityDateKey(new Date(), p.facilityTimezone),
      createdAt: new Date().toISOString(),
    };
    p.orders = [row, ...(p.orders ?? [])];
    appendAudit({
      category: "clinical",
      action: "order_drafted",
      patientId,
      actorId: input.createdBy,
      detail: { orderId: row.id, drugName: row.drugName, isControlled: !!row.isControlled },
    });
    emit();
    return row;
  },
  updateDraftOrder(patientId: string, orderId: string, patch: Partial<MedOrder>): void {
    const p = patients.find((x) => x.id === patientId);
    const row = p?.orders?.find((o) => o.id === orderId);
    // Signed orders are immutable — amendments belong to a later pass.
    if (!row || row.status !== "draft") return;
    Object.assign(row, patch, { id: row.id, patientId: row.patientId, status: "draft" as const });
    emit();
  },
  removeDraftOrder(patientId: string, orderId: string, actor?: string): void {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    const row = p.orders?.find((o) => o.id === orderId);
    if (!row || row.status !== "draft") return;
    p.orders = (p.orders ?? []).filter((o) => o.id !== orderId);
    appendAudit({
      category: "clinical",
      action: "order_draft_removed",
      patientId,
      actorId: actor,
      detail: { orderId, drugName: row.drugName },
    });
    emit();
  },
  /**
   * §Phase 3b — stamp draft orders staged inside a note's orders_section with
   * the note they came from, once the note row exists. Traceability only: it
   * does not change validation, lifecycle or attestation.
   */
  linkOrdersToNote(patientId: string, noteId: string, orderIds: string[]): void {
    const p = patients.find((x) => x.id === patientId);
    if (!p || orderIds.length === 0) return;
    let touched = 0;
    for (const o of p.orders ?? []) {
      if (!orderIds.includes(o.id) || o.sourceNoteId) continue;
      o.sourceNoteId = noteId;
      touched++;
    }
    if (!touched) return;
    appendAudit({
      category: "clinical",
      action: "order_linked_to_note",
      patientId,
      detail: { noteId, orderIds },
    });
    emit();
  },
  /**
   * Release draft orders to the chart. Callers MUST have run the validation
   * gate (`validateOrder`) and captured attestation first — this method trusts
   * the caller, matching the reference EMR where the cart owns the gate.
   */
  signOrders(
    patientId: string,
    orderIds: string[],
    attestedBy: string,
    opts?: {
      /**
       * Per-order, per-ingredient strength provenance keyed by order id.
       * Computed by the caller (src/lib/orders.ts `strengthProvenanceFor`) —
       * kept out of the store to avoid an ehr <-> roles import cycle.
       */
      strengthProvenance?: Record<string, unknown[]>;
    },
  ): MedOrder[] {
    const p = patients.find((x) => x.id === patientId);
    if (!p) throw new Error("Patient not found");
    const at = new Date().toISOString();
    const signed: MedOrder[] = [];
    for (const id of orderIds) {
      const row = p.orders?.find((o) => o.id === id && o.status === "draft");
      if (!row) continue;
      row.status = "signed";
      row.attestedBy = attestedBy;
      row.attestedAt = at;
      // Safety net for drafts created before startDate existed, or cleared in
      // the UI: a signed order always carries a real start date.
      row.startDate ??= facilityDateKey(new Date(), p.facilityTimezone);
      signed.push(row);
    }
    if (signed.length) {
      appendAudit({
        category: "clinical",
        action: "orders_signed",
        patientId,
        actorId: attestedBy,
        detail: {
          orderIds: signed.map((o) => o.id),
          drugNames: signed.map((o) => o.drugName),
          // Flagged so audit reviewers know identity was not re-verified.
          attestationMethod: "checkbox_only",
        },
      });
      // Separate entry per order so reviewers can tell a machine-validated
      // strength (RxNav/DailyMed/units) from a hand-typed one.
      for (const o of signed) {
        const ingredients = opts?.strengthProvenance?.[o.id];
        if (!ingredients?.length) continue;
        appendAudit({
          category: "clinical",
          action: "order_strength_provenance",
          patientId,
          actorId: attestedBy,
          detail: {
            orderId: o.id,
            drugName: o.drugName,
            rxcui: o.rxcui,
            strengthText: o.strengthText,
            doseAxis: o.doseAxis,
            manualDose: o.manualDose ?? undefined,
            manualDoseJustification: o.manualDoseJustification ?? undefined,
            ingredients,
          },
        });
      }
      emit();
    }
    return signed;
  },

  // ----- Order lifecycle (manual transitions only) --------------------------
  // No full per-order history array: every transition below writes an audit
  // event carrying actor, timestamp, from/to status and reason, so the audit
  // trail IS the history — same convention as problem/allergy soft-deletes.
  // The latest-transition fields on the row are the fast read path.
  _transitionOrder(
    patientId: string,
    orderId: string,
    to: Extract<MedOrder["status"], "signed" | "held" | "discontinued" | "completed">,
    staffName: string,
    reason: string | undefined,
    opts: { from: MedOrder["status"][]; requireReason: boolean; action: string },
  ): MedOrder {
    const p = patients.find((x) => x.id === patientId);
    const row = p?.orders?.find((o) => o.id === orderId);
    if (!row) throw new Error("Order not found");
    if (!opts.from.includes(row.status))
      throw new Error(`This order cannot move from ${row.status} to ${to}.`);
    const trimmed = reason?.trim();
    if (opts.requireReason && !trimmed) throw new Error("A reason is required.");
    const from = row.status;
    row.status = to;
    row.statusReason = trimmed || undefined;
    row.statusChangedBy = staffName;
    row.statusChangedAt = new Date().toISOString();
    appendAudit({
      category: "clinical",
      action: opts.action,
      patientId,
      actorId: staffName,
      detail: { orderId, drugName: row.drugName, from, to, reason: trimmed ?? null },
    });
    emit();
    return row;
  },
  /** Reversible pause. Reason required. */
  holdOrder(patientId: string, orderId: string, staffName: string, reason: string): MedOrder {
    return AdelanteEHR._transitionOrder(patientId, orderId, "held", staffName, reason, {
      from: ["signed"],
      requireReason: true,
      action: "order_held",
    });
  },
  /** Resume a held order. Resuming is not the risky direction — no reason required. */
  resumeOrder(patientId: string, orderId: string, staffName: string): MedOrder {
    return AdelanteEHR._transitionOrder(patientId, orderId, "signed", staffName, undefined, {
      from: ["held"],
      requireReason: false,
      action: "order_resumed",
    });
  },
  /** Terminal stop. Reason required; there is no path back to signed. */
  discontinueOrder(
    patientId: string,
    orderId: string,
    staffName: string,
    reason: string,
  ): MedOrder {
    return AdelanteEHR._transitionOrder(patientId, orderId, "discontinued", staffName, reason, {
      from: ["signed", "held"],
      requireReason: true,
      action: "order_discontinued",
    });
  },
  /** Terminal "course finished" marker. Manual only — no scheduling tie-in. */
  completeOrder(patientId: string, orderId: string, staffName: string): MedOrder {
    return AdelanteEHR._transitionOrder(patientId, orderId, "completed", staffName, undefined, {
      from: ["signed", "held"],
      requireReason: false,
      action: "order_completed",
    });
  },

  // ----- MAR (§MAR Phase 1 — scheduled doses only) --------------------------
  listAdministrations(patientId: string, opts?: { orderId?: string }): DoseAdministration[] {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return [];
    const rows = p.administrations ?? [];
    return opts?.orderId ? rows.filter((r) => r.orderId === opts.orderId) : [...rows];
  },
  listDoseClaims(patientId: string): DoseClaim[] {
    return [...(patients.find((x) => x.id === patientId)?.doseClaims ?? [])];
  },
  /**
   * §MAR Phase 2 — PRN eligibility. Counts live (non-voided) GIVEN
   * administrations for this order in the trailing 24h against the frequency
   * catalog's `maxPerDay` ceiling.
   *
   * §Admin governance — also enforces the catalog's `minGapMinutes` spacing
   * rule against the most recent live GIVEN dose. The two rules share one
   * `blocked` flag on purpose: charting sees a single ineligible state, and
   * `blockedBy` only says which rule produced it (for the message). A
   * frequency with no `minGapMinutes` is unaffected — `eligibleAt` stays
   * undefined and the gap branch never runs.
   *
   * The gap looks at the last live GIVEN dose regardless of the 24h window,
   * so a gap longer than a day still measures from the real dose rather than
   * silently unblocking when the dose ages out of the count window.
   */
  prnEligibility(
    patientId: string,
    orderId: string,
    now: Date = new Date(),
  ): {
    given: number;
    max?: number;
    lastGivenAt?: string;
    blocked: boolean;
    /** Which rule blocked, when one did. */
    blockedBy?: "max" | "gap";
    minGapMinutes?: number;
    /** Instant the gap rule clears. Absent when no gap rule applies. */
    eligibleAt?: string;
    /** Milliseconds still to wait under the gap rule; 0 once elapsed. */
    waitMs: number;
  } {
    const p = patients.find((x) => x.id === patientId);
    const order = p?.orders?.find((o) => o.id === orderId);
    const freq = frequencyByCode(order?.frequencyCode);
    const max = freq?.maxPerDay;
    const minGapMinutes = freq?.minGapMinutes;
    const since = now.getTime() - 24 * 3600_000;
    const live = (p?.administrations ?? [])
      .filter(
        (a) =>
          a.orderId === orderId &&
          !a.voided &&
          a.action === "given",
      )
      .sort((a, b) => b.chartedAt.localeCompare(a.chartedAt));
    const rows = live.filter((a) => new Date(a.chartedAt).getTime() >= since);
    const lastGivenAt = live[0]?.chartedAt;

    const maxBlocked = max !== undefined && rows.length >= max;
    let eligibleAt: string | undefined;
    let waitMs = 0;
    if (minGapMinutes !== undefined && minGapMinutes > 0 && lastGivenAt) {
      const clearsAt = new Date(lastGivenAt).getTime() + minGapMinutes * 60_000;
      eligibleAt = new Date(clearsAt).toISOString();
      waitMs = Math.max(0, clearsAt - now.getTime());
    }
    const gapBlocked = waitMs > 0;
    return {
      given: rows.length,
      max,
      lastGivenAt,
      blocked: maxBlocked || gapBlocked,
      blockedBy: maxBlocked ? "max" : gapBlocked ? "gap" : undefined,
      minGapMinutes,
      eligibleAt,
      waitMs,
    };
  },
  /**
   * Chart one scheduled dose. Validation is action-specific: refused/held need
   * a reason, and anything charted more than 4h after the scheduled time needs
   * a late-entry reason. Voided prior entries do not block re-charting.
   */
  chartDose(
    patientId: string,
    orderId: string,
    scheduledAt: string,
    action: DoseAdministration["action"],
    reason: string | undefined,
    staffName: string,
    batchId: string,
    lateEntryReason?: string,
    opts?: { witnessedBy?: string; mouthCheckAttested?: boolean },
  ): DoseAdministration {
    const p = patients.find((x) => x.id === patientId);
    if (!p) throw new Error("Patient not found");
    const order = p.orders?.find((o) => o.id === orderId);
    if (!order) throw new Error("Order not found");
    const trimmed = reason?.trim();
    if ((action === "refused" || action === "held") && !trimmed)
      throw new Error("A reason is required to chart a refused or held dose.");
    // ----- §MAR Phase 2 gates -------------------------------------------------
    if (order.isKop)
      throw new Error(
        "KOP orders are issued as a patient supply, not charted as a bedside administration.",
      );
    const prn = !!frequencyByCode(order.frequencyCode)?.isPrn;
    if (prn && action === "given" && !trimmed)
      throw new Error("A PRN dose requires an indication reason.");
    const witness = opts?.witnessedBy?.trim();
    if (action === "given") {
      if (prn) {
        const elig = AdelanteEHR.prnEligibility(patientId, orderId);
        if (elig.blockedBy === "max")
          throw new Error(`PRN limit reached — ${elig.given}/${elig.max} given in the last 24h.`);
        if (elig.blockedBy === "gap")
          throw new Error(
            `Minimum interval not met — this order requires ${elig.minGapMinutes} minutes between doses. Eligible in ${waitLabel(elig.waitMs)}.`,
          );
      }
      if (requiresDoseWitness(order) && !witness)
        throw new Error(
          "A second clinician must witness this Schedule II administration before it can be charted as given.",
        );
    }
    const chartedAt = new Date();
    const lateBy = chartedAt.getTime() - new Date(scheduledAt).getTime();
    const late = lateBy > LATE_ENTRY_THRESHOLD_HOURS * 3600_000;
    const lateTrimmed = lateEntryReason?.trim();
    if (late && !lateTrimmed)
      throw new Error(
        `This dose is more than ${LATE_ENTRY_THRESHOLD_HOURS} hours late — a late-entry reason is required.`,
      );
    const already = (p.administrations ?? []).find(
      (a) => a.orderId === orderId && a.scheduledAt === scheduledAt && !a.voided,
    );
    if (already) throw new Error("This dose is already charted.");
    const row: DoseAdministration = {
      id: uid(),
      patientId,
      orderId,
      scheduledAt,
      action,
      reason: trimmed || undefined,
      chartedBy: staffName,
      chartedAt: chartedAt.toISOString(),
      lateEntryReason: late ? lateTrimmed : undefined,
      witnessedBy: action === "given" ? witness || undefined : undefined,
      isPrn: prn || undefined,
      mouthCheckAttested: opts?.mouthCheckAttested || undefined,
      batchId,
    };
    p.administrations = [row, ...(p.administrations ?? [])];
    // Charting consumes any claim on the slot.
    p.doseClaims = (p.doseClaims ?? []).filter(
      (c) => !(c.orderId === orderId && c.scheduledAt === scheduledAt),
    );
    appendAudit({
      category: "clinical",
      action: "dose_charted",
      patientId,
      actorId: staffName,
      detail: {
        administrationId: row.id,
        orderId,
        drugName: order.drugName,
        scheduledAt,
        doseAction: action,
        reason: trimmed ?? null,
        lateEntryReason: row.lateEntryReason ?? null,
        isPrn: prn,
        deaSchedule: order.deaSchedule ?? null,
        witnessedBy: row.witnessedBy ?? null,
        mouthCheckAttested: !!row.mouthCheckAttested,
        batchId,
        attestationMethod: "checkbox_only",
      },
    });
    emit();
    return row;
  },
  /** Take the slot. Fails if someone else already holds it — use takeoverDose. */
  claimDose(patientId: string, orderId: string, scheduledAt: string, staffName: string): DoseClaim {
    const p = patients.find((x) => x.id === patientId);
    if (!p) throw new Error("Patient not found");
    const existing = (p.doseClaims ?? []).find(
      (c) => c.orderId === orderId && c.scheduledAt === scheduledAt,
    );
    if (existing && existing.claimedBy !== staffName)
      throw new Error(`This dose is already claimed by ${existing.claimedBy}.`);
    if (existing) return existing;
    const claim: DoseClaim = {
      orderId,
      scheduledAt,
      claimedBy: staffName,
      claimedAt: new Date().toISOString(),
    };
    p.doseClaims = [claim, ...(p.doseClaims ?? [])];
    appendAudit({
      category: "clinical",
      action: "dose_claimed",
      patientId,
      actorId: staffName,
      detail: { orderId, scheduledAt },
    });
    // §Notification feed — a staged CII dose cannot be charted without a
    // second clinician. The witness pool is the same pmhnp/therapist pool
    // `witnessCandidates` offers in the MAR UI, so broadcast to both roles.
    const claimedOrder = p.orders?.find((o) => o.id === orderId);
    if (claimedOrder && requiresDoseWitness(claimedOrder)) {
      for (const r of ["pmhnp", "therapist"] as StaffRole[]) {
        AdelanteEHR.notify({
          recipientRole: r,
          category: "mar_witness_needed",
          subject: `Witness needed — Schedule II dose for ${patientLabel(patientId)}`,
          body: `${staffName} staged ${claimedOrder.drugName || "a controlled medication"} scheduled ${new Date(scheduledAt).toLocaleString()}. A second clinician must witness administration.`,
          linkRoute: "/record/$patientId",
          linkParams: { patientId, section: "mar" },
          patientId,
        });
      }
    }
    emit();
    return claim;
  },
  /** Give up your own claim. Releasing someone else's requires takeoverDose. */
  releaseDose(patientId: string, orderId: string, scheduledAt: string, staffName: string): void {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    const existing = (p.doseClaims ?? []).find(
      (c) => c.orderId === orderId && c.scheduledAt === scheduledAt,
    );
    if (!existing) return;
    if (existing.claimedBy !== staffName)
      throw new Error(`Only ${existing.claimedBy} can release this claim — use takeover instead.`);
    p.doseClaims = (p.doseClaims ?? []).filter((c) => c !== existing);
    appendAudit({
      category: "clinical",
      action: "dose_claim_released",
      patientId,
      actorId: staffName,
      detail: { orderId, scheduledAt },
    });
    emit();
  },
  /** Seize another nurse's claim. Reason required and always audit-logged. */
  takeoverDose(
    patientId: string,
    orderId: string,
    scheduledAt: string,
    staffName: string,
    reason: string,
  ): DoseClaim {
    const p = patients.find((x) => x.id === patientId);
    if (!p) throw new Error("Patient not found");
    const trimmed = reason?.trim();
    if (!trimmed) throw new Error("A reason is required to take over a claimed dose.");
    const existing = (p.doseClaims ?? []).find(
      (c) => c.orderId === orderId && c.scheduledAt === scheduledAt,
    );
    if (!existing) throw new Error("This dose is not claimed — claim it instead.");
    if (existing.claimedBy === staffName) return existing;
    const previous = existing.claimedBy;
    const claim: DoseClaim = {
      orderId,
      scheduledAt,
      claimedBy: staffName,
      claimedAt: new Date().toISOString(),
    };
    p.doseClaims = [claim, ...(p.doseClaims ?? []).filter((c) => c !== existing)];
    appendAudit({
      category: "clinical",
      action: "dose_claim_takeover",
      patientId,
      actorId: staffName,
      detail: { orderId, scheduledAt, previousClaimant: previous, reason: trimmed },
    });
    emit();
    return claim;
  },
  /**
   * Void every administration charted in one batch. Reason required (min 3
   * chars). Entries are retained with void metadata — never deleted.
   */
  voidBatch(
    patientId: string,
    batchId: string,
    staffName: string,
    reason: string,
  ): DoseAdministration[] {
    const p = patients.find((x) => x.id === patientId);
    if (!p) throw new Error("Patient not found");
    const trimmed = reason?.trim() ?? "";
    if (trimmed.length < 3) throw new Error("A void reason of at least 3 characters is required.");
    const rows = (p.administrations ?? []).filter((a) => a.batchId === batchId && !a.voided);
    if (!rows.length) throw new Error("Nothing to void in this batch.");
    const at = new Date().toISOString();
    for (const r of rows) {
      r.voided = true;
      r.voidReason = trimmed;
      r.voidedBy = staffName;
      r.voidedAt = at;
    }
    appendAudit({
      category: "clinical",
      action: "dose_batch_voided",
      patientId,
      actorId: staffName,
      detail: {
        batchId,
        administrationIds: rows.map((r) => r.id),
        count: rows.length,
        reason: trimmed,
      },
    });
    emit();
    return rows;
  },

  // ----- KOP issuance (§MAR Phase 2) ----------------------------------------
  listKopIssuances(patientId: string, opts?: { orderId?: string }): KopIssuance[] {
    const rows = patients.find((x) => x.id === patientId)?.kopIssuances ?? [];
    return opts?.orderId ? rows.filter((r) => r.orderId === opts.orderId) : [...rows];
  },
  /** The open (not-yet-returned) issuance for an order, if any. */
  activeKopIssuance(patientId: string, orderId: string): KopIssuance | undefined {
    return (patients.find((x) => x.id === patientId)?.kopIssuances ?? []).find(
      (r) => r.orderId === orderId && !r.returnedAt,
    );
  },
  /**
   * Issue a KOP supply. Refuses a second ACTIVE issuance for the same order —
   * the existing one must be returned first.
   */
  issueKop(input: {
    patientId: string;
    orderId: string;
    daysSupply: number;
    quantity: number;
    patientSignatureName: string;
    issuedBy: string;
    notes?: string;
  }): KopIssuance {
    const p = patients.find((x) => x.id === input.patientId);
    if (!p) throw new Error("Patient not found");
    const order = p.orders?.find((o) => o.id === input.orderId);
    if (!order) throw new Error("Order not found");
    if (!order.isKop) throw new Error("This order is not marked keep-on-person.");
    const open = AdelanteEHR.activeKopIssuance(input.patientId, input.orderId);
    if (open)
      throw new Error(
        `An active KOP supply already exists for this order — ${open.daysSupply} day(s) issued ${new Date(open.issuedAt).toLocaleDateString()}. Record its return first.`,
      );
    const signature = input.patientSignatureName?.trim();
    if (!signature) throw new Error("The patient's typed signature name is required.");
    if (!(input.daysSupply > 0)) throw new Error("Days supply must be greater than zero.");
    if (!(input.quantity > 0)) throw new Error("Quantity must be greater than zero.");
    const row: KopIssuance = {
      id: uid(),
      patientId: input.patientId,
      orderId: input.orderId,
      daysSupply: input.daysSupply,
      quantity: input.quantity,
      patientSignatureName: signature,
      issuedBy: input.issuedBy,
      issuedAt: new Date().toISOString(),
      notes: input.notes?.trim() || undefined,
    };
    p.kopIssuances = [row, ...(p.kopIssuances ?? [])];
    appendAudit({
      category: "clinical",
      action: "kop_issued",
      patientId: input.patientId,
      actorId: input.issuedBy,
      detail: {
        issuanceId: row.id,
        orderId: row.orderId,
        drugName: order.drugName,
        daysSupply: row.daysSupply,
        quantity: row.quantity,
        patientSignatureName: row.patientSignatureName,
      },
    });
    emit();
    return row;
  },
  /** Record the return of an issued KOP supply. */
  returnKop(patientId: string, issuanceId: string, staffName: string): KopIssuance {
    const p = patients.find((x) => x.id === patientId);
    if (!p) throw new Error("Patient not found");
    const row = (p.kopIssuances ?? []).find((r) => r.id === issuanceId);
    if (!row) throw new Error("KOP issuance not found");
    if (row.returnedAt) throw new Error("This supply has already been returned.");
    row.returnedAt = new Date().toISOString();
    row.returnedBy = staffName;
    appendAudit({
      category: "clinical",
      action: "kop_returned",
      patientId,
      actorId: staffName,
      detail: { issuanceId: row.id, orderId: row.orderId },
    });
    emit();
    return row;
  },

  // ----- Refusal legal document (§MAR Phase 3) ------------------------------
  listRefusalForms(patientId: string, opts?: { status?: RefusalForm["status"] }): RefusalForm[] {
    const rows = patients.find((x) => x.id === patientId)?.refusalForms ?? [];
    return opts?.status ? rows.filter((r) => r.status === opts.status) : [...rows];
  },
  /** Simple queryable to-do surface for "Sign later" forms. No worklist yet. */
  pendingRefusalForms(patientId: string): RefusalForm[] {
    return AdelanteEHR.listRefusalForms(patientId, { status: "pending_signature" });
  },
  getRefusalForm(patientId: string, formId: string): RefusalForm | undefined {
    return (patients.find((x) => x.id === patientId)?.refusalForms ?? []).find(
      (r) => r.id === formId,
    );
  },
  /** Required sign-off slots for promoting a draft translation. */
  riskTextReviewerRoles() {
    return REQUIRED_RISK_TEXT_REVIEWER_ROLES.map((r) => ({ ...r }));
  },
  /** Governance state for every translated risk-text catalog. */
  listRiskTextReviews(): RiskTextReview[] {
    return riskTextReviews.map((r) => ({ ...r, signoffs: r.signoffs.map((s) => ({ ...s })) }));
  },
  getRiskTextReview(language: string): RiskTextReview | undefined {
    const r = riskTextReviews.find((x) => x.language === language.toLowerCase().split("-")[0]);
    return r ? { ...r, signoffs: r.signoffs.map((s) => ({ ...s })) } : undefined;
  },
  /**
   * Record one clinical sign-off. When both required roles are present the
   * language is promoted (es-v1-draft → es-v1) and new forms are created with
   * `riskTextReviewed: true` and a LOCKED English snapshot.
   */
  signRiskTextReview(input: {
    language: string;
    role: RiskTextReviewerRole;
    reviewerName: string;
    note?: string;
  }): RiskTextReview {
    const lang = input.language.toLowerCase().split("-")[0];
    const review = riskTextReviews.find((x) => x.language === lang);
    if (!review) throw new Error("No translated risk-text catalog for this language.");
    if (!REQUIRED_RISK_TEXT_REVIEWER_ROLES.some((r) => r.role === input.role))
      throw new Error("Unknown reviewer role.");
    const reviewerName = input.reviewerName.trim();
    if (!reviewerName) throw new Error("Reviewer name is required to record a sign-off.");
    if (review.signoffs.some((s) => s.role === input.role))
      throw new Error("This role has already signed off. Revoke the approval to re-sign.");

    const signoff: RiskTextSignoff = {
      role: input.role,
      reviewerName,
      signedAt: new Date().toISOString(),
      note: input.note?.trim() || undefined,
    };
    review.signoffs = [...review.signoffs, signoff];
    review.revokedReason = undefined;
    review.revokedAt = undefined;
    review.revokedBy = undefined;

    appendAudit({
      category: "clinical",
      action: "risk_text_review_signed",
      actorId: reviewerName,
      detail: {
        language: lang,
        role: input.role,
        draftVersion: review.draftVersion,
        note: signoff.note ?? null,
        signoffCount: review.signoffs.length,
        requiredSignoffs: REQUIRED_RISK_TEXT_REVIEWER_ROLES.length,
      },
    });

    const complete = REQUIRED_RISK_TEXT_REVIEWER_ROLES.every((r) =>
      review.signoffs.some((s) => s.role === r.role),
    );
    if (complete && review.status !== "approved") {
      review.status = "approved";
      review.effectiveVersion =
        PROMOTED_RISK_TEXT_VERSION[review.draftVersion] ?? review.draftVersion;
      review.approvedAt = signoff.signedAt;
      appendAudit({
        category: "clinical",
        action: "risk_text_version_promoted",
        actorId: reviewerName,
        detail: {
          language: lang,
          fromVersion: review.draftVersion,
          toVersion: review.effectiveVersion,
          signedOffBy: review.signoffs.map((s) => `${s.reviewerName} (${s.role})`),
          englishSnapshotLocked: true,
        },
      });
    }
    emit();
    return { ...review, signoffs: review.signoffs.map((s) => ({ ...s })) };
  },
  /** Demote an approved translation back to draft. Reason required. */
  revokeRiskTextReview(language: string, reason: string, actorName: string): RiskTextReview {
    const lang = language.toLowerCase().split("-")[0];
    const review = riskTextReviews.find((x) => x.language === lang);
    if (!review) throw new Error("No translated risk-text catalog for this language.");
    const why = reason.trim();
    if (!why) throw new Error("A reason is required to revoke clinical sign-off.");
    const previous = review.effectiveVersion;
    review.signoffs = [];
    review.status = "draft";
    review.effectiveVersion = review.draftVersion;
    review.approvedAt = undefined;
    review.revokedReason = why;
    review.revokedAt = new Date().toISOString();
    review.revokedBy = actorName;
    appendAudit({
      category: "clinical",
      action: "risk_text_review_revoked",
      actorId: actorName,
      detail: {
        language: lang,
        fromVersion: previous,
        toVersion: review.draftVersion,
        reason: why,
      },
    });
    emit();
    return { ...review, signoffs: [] };
  },
  /**
   * Create the pending shell for a refused dose. Called automatically right
   * after the refusal is charted — the shell exists whether or not the nurse
   * ever opens the dialog, so an abandoned form is visible as outstanding work
   * rather than silently absent.
   */
  createRefusalFormShell(patientId: string, administrationId: string, staffName: string) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) throw new Error("Patient not found");
    const admin = (p.administrations ?? []).find((a) => a.id === administrationId);
    if (!admin) throw new Error("Administration not found");
    if (admin.action !== "refused")
      throw new Error("A refusal document only applies to a refused dose.");
    const existing = (p.refusalForms ?? []).find((r) => r.administrationId === administrationId);
    if (existing) return existing;
    const order = p.orders?.find((o) => o.id === admin.orderId);
    const medClass = medClassGuess(
      [order?.drugName, order?.productName, ...(order?.ingredientNames ?? [])]
        .filter(Boolean)
        .join(" "),
    );
    const capacityFlagsAtSigning = capacityFlagsFrom(p.alerts);
    const languageCode = p.preferredLanguage ?? "en";
    // Presented in the patient's language when a catalog exists; Spanish is a
    // DRAFT translation pending clinical sign-off (see refusal.ts).
    const risk = riskTextFor(medClass, languageCode, riskTextApprovalLookup());
    const row: RefusalForm = {
      id: uid(),
      patientId,
      administrationId,
      status: "pending_signature",
      medClass,
      riskTextVersion: risk.version,
      riskTextSnapshot: risk.text,
      riskTextSnapshotEn: risk.englishText,
      riskTextReviewed: risk.reviewed,
      riskTextSnapshotEnLocked: risk.englishSnapshotLocked,
      languageCode,
      capacityFlagsAtSigning,
      guardianRequired: isMinorPatient(p),
      nurseAttested: false,
      patientSigned: false,
      witnessRequired: false,
      attestationMethod: "checkbox_only",
      createdAt: new Date().toISOString(),
      createdBy: staffName,
    };
    p.refusalForms = [row, ...(p.refusalForms ?? [])];
    appendAudit({
      category: "clinical",
      action: "refusal_form_created",
      patientId,
      actorId: staffName,
      detail: {
        formId: row.id,
        administrationId,
        orderId: admin.orderId,
        drugName: order?.drugName ?? null,
        medClass,
        riskTextVersion: row.riskTextVersion,
        languageCode: row.languageCode,
        riskTextReviewed: row.riskTextReviewed,
        riskTextSnapshotEnLocked: row.riskTextSnapshotEnLocked ?? false,
        capacityFlagsAtSigning,
        guardianRequired: row.guardianRequired,
      },
    });
    emit();
    return row;
  },
  /**
   * Finalize a refusal document. Validation is the ported `canFinalize` rule
   * set (nurse attestation, patient signed/declined branch, interpreter when
   * non-English, witness when a non-capacity-flagged patient declines, nurse
   * signature always).
   */
  finalizeRefusalForm(
    patientId: string,
    formId: string,
    payload: RefusalFinalizePayload,
    staffName: string,
  ): RefusalForm {
    const p = patients.find((x) => x.id === patientId);
    if (!p) throw new Error("Patient not found");
    const form = (p.refusalForms ?? []).find((r) => r.id === formId);
    if (!form) throw new Error("Refusal form not found");
    if (form.status === "finalized") throw new Error("This refusal form is already finalized.");
    const problems = refusalFinalizeProblems(form, payload);
    if (problems.length) throw new Error(problems[0]);

    form.nurseAttested = true;
    form.nurseSignatureDataUrl = payload.nurseSignatureDataUrl;
    form.nurseNote = payload.nurseNote?.trim() || undefined;
    form.patientSigned = payload.patientMode === "signed";
    form.patientSignatureDataUrl =
      payload.patientMode === "signed" ? payload.patientSignatureDataUrl : undefined;
    form.patientDeclineReason =
      payload.patientMode === "declined" ? payload.patientDeclineReason?.trim() : undefined;
    form.patientDeclineNotes =
      payload.patientMode === "declined"
        ? payload.patientDeclineNotes?.trim() || undefined
        : undefined;
    form.witnessRequired = witnessRequiredFor(payload.patientMode, form.capacityFlagsAtSigning);
    form.witnessStaffName = form.witnessRequired
      ? payload.witnessStaffName?.trim()
      : payload.witnessStaffName?.trim() || undefined;
    form.witnessSignatureDataUrl = payload.witnessSignatureDataUrl;
    form.interpreterUsed = payload.interpreterUsed;
    form.interpreterMethod = payload.interpreterMethod;
    form.interpreterName = payload.interpreterName?.trim() || undefined;
    form.interpreterAbsentJustification =
      payload.interpreterAbsentJustification?.trim() || undefined;
    form.status = "finalized";
    form.finalizedBy = staffName;
    form.finalizedAt = new Date().toISOString();

    appendAudit({
      category: "clinical",
      action: "refusal_form_finalized",
      patientId,
      actorId: staffName,
      detail: {
        formId: form.id,
        administrationId: form.administrationId,
        medClass: form.medClass,
        riskTextVersion: form.riskTextVersion,
        // Both frozen wordings are recorded on the audit entry: the disclosure
        // the patient was actually read, and the clinically reviewed English
        // text retained alongside it, plus the review flags that say which is
        // authoritative. A later catalog promotion cannot rewrite this row.
        languageCode: form.languageCode,
        riskTextReviewed: form.riskTextReviewed ?? true,
        riskTextSnapshotEnLocked: form.riskTextSnapshotEnLocked ?? false,
        riskTextSnapshot: form.riskTextSnapshot,
        riskTextSnapshotEn: form.riskTextSnapshotEn ?? form.riskTextSnapshot,
        patientSigned: form.patientSigned,
        patientDeclineReason: form.patientDeclineReason ?? null,
        witnessRequired: form.witnessRequired,
        witnessStaffName: form.witnessStaffName ?? null,
        capacityFlagsAtSigning: form.capacityFlagsAtSigning,
        guardianRequired: form.guardianRequired,
        interpreterMethod: form.interpreterMethod ?? null,
        attestationMethod: "checkbox_only",
      },
    });
    emit();
    return form;
  },
  /**
   * Live (non-voided) refusals of one order in the trailing window. Drives the
   * 3-in-7-days escalation trigger.
   */
  refusalsInWindow(
    patientId: string,
    orderId: string,
    days: number = ESCALATION_WINDOW_DAYS,
    now: Date = new Date(),
  ): DoseAdministration[] {
    const since = now.getTime() - days * 86_400_000;
    return (patients.find((x) => x.id === patientId)?.administrations ?? []).filter(
      (a) =>
        a.orderId === orderId &&
        a.action === "refused" &&
        !a.voided &&
        new Date(a.chartedAt).getTime() >= since,
    );
  },
  /** True once this order hits the refusal threshold inside the window. */
  refusalEscalationDue(patientId: string, orderId: string, now?: Date): boolean {
    return (
      AdelanteEHR.refusalsInWindow(patientId, orderId, ESCALATION_WINDOW_DAYS, now).length >=
      ESCALATION_REFUSAL_THRESHOLD
    );
  },

  /**
   * Cross-patient nurse worklist feed: every refusal document still awaiting a
   * signature, oldest first (these are legal follow-ons — the queue should not
   * be sorted newest-first or they age out of view).
   */
  listPendingRefusalForms(opts: { patientId?: string } = {}): {
    form: RefusalForm;
    patient: Patient;
    administration?: DoseAdministration;
    order?: MedOrder;
  }[] {
    return patients
      .filter((p) => !opts.patientId || p.id === opts.patientId)
      .flatMap((p) =>
        (p.refusalForms ?? [])
          .filter((f) => f.status === "pending_signature")
          .map((form) => {
            const administration = (p.administrations ?? []).find(
              (a) => a.id === form.administrationId,
            );
            return {
              form,
              patient: p,
              administration,
              order: (p.orders ?? []).find((o) => o.id === administration?.orderId),
            };
          }),
      )
      .sort((a, b) => a.form.createdAt.localeCompare(b.form.createdAt));
  },

  /**
   * Record the escalation decision — scheduled provider follow-up or a
   * documented deferral. Either way it lands on the audit trail; there is no
   * silent dismissal.
   */
  recordRefusalEscalation(
    patientId: string,
    input: {
      formId: string;
      orderId: string;
      decision: "scheduled" | "deferred";
      discipline?: string;
      followUpAt?: string;
      deferralReason?: string;
      notes?: string;
    },
    staffName: string,
  ): void {
    const p = patients.find((x) => x.id === patientId);
    if (!p) throw new Error("Patient not found");
    if (input.decision === "scheduled") {
      const err = validateEscalationTime(input.followUpAt ?? "");
      if (err) throw new Error(err);
      if (!input.discipline) throw new Error("Select the provider discipline to follow up.");
    } else if (!input.deferralReason?.trim()) {
      throw new Error("A deferral reason is required.");
    }
    appendAudit({
      category: "clinical",
      action:
        input.decision === "scheduled"
          ? "refusal_escalation_scheduled"
          : "refusal_escalation_deferred",
      patientId,
      actorId: staffName,
      detail: {
        formId: input.formId,
        orderId: input.orderId,
        discipline: input.discipline ?? null,
        followUpAt: input.followUpAt ?? null,
        deferralReason: input.deferralReason?.trim() ?? null,
        notes: input.notes?.trim() || null,
        refusalsInWindow: AdelanteEHR.refusalsInWindow(patientId, input.orderId).length,
        windowDays: ESCALATION_WINDOW_DAYS,
      },
    });
    emit();
  },

  // ----- §Custody tracking: bookings + housing moves ----------------------

  /** Active facilities first, then alphabetical. */
  listFacilities(includeInactive = false): Facility[] {
    return facilities
      .filter((f) => includeInactive || f.active)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  getFacility(facilityId: string | undefined): Facility | undefined {
    return facilities.find((f) => f.id === facilityId);
  },

  /** Match on the normalized name, so typo/dash/case variants collapse. */
  findFacilityByName(name: string): Facility | undefined {
    const key = normalizeFacilityName(name);
    if (!key) return undefined;
    return facilities.find((f) => normalizeFacilityName(f.name) === key);
  },

  /**
   * Resolve a facility for a write. Prefers an explicit id, then a normalized
   * name match, and only then creates a new facility — so a clinician typing
   * an existing site slightly differently reuses that site's id instead of
   * spawning a duplicate bucket.
   */
  ensureFacility(
    input: { facilityId?: string; facilityName?: string; kind?: FacilityKind; city?: string },
    staffName: string,
  ): Facility {
    if (input.facilityId) {
      const byId = AdelanteEHR.getFacility(input.facilityId);
      if (!byId) throw new Error("Facility not found.");
      return byId;
    }
    const name = (input.facilityName ?? "").trim().replace(/\s+/g, " ");
    if (!name) throw new Error("A facility is required.");
    const existing = AdelanteEHR.findFacilityByName(name);
    if (existing) return existing;
    const row: Facility = {
      id: uid(),
      name,
      kind: input.kind ?? "other",
      city: input.city?.trim() || undefined,
      active: true,
      createdBy: staffName,
      createdAt: new Date().toISOString(),
    };
    facilities.push(row);
    appendAudit({
      category: "clinical",
      action: "facility_created",
      actorId: staffName,
      detail: { facilityId: row.id, name: row.name, kind: row.kind, city: row.city ?? null },
    });
    emit();
    return row;
  },

  /**
   * Rename a facility. Existing bookings/moves keep their display snapshot;
   * only future writes and id-based rollups pick up the new name.
   */
  renameFacility(facilityId: string, name: string, staffName: string): Facility {
    const row = facilities.find((f) => f.id === facilityId);
    if (!row) throw new Error("Facility not found.");
    const next = (name ?? "").trim().replace(/\s+/g, " ");
    if (!next) throw new Error("A facility name is required.");
    const clash = AdelanteEHR.findFacilityByName(next);
    if (clash && clash.id !== facilityId)
      throw new Error(`"${clash.name}" already exists — merge instead of renaming.`);
    const from = row.name;
    row.name = next;
    appendAudit({
      category: "clinical",
      action: "facility_renamed",
      actorId: staffName,
      detail: { facilityId, from, to: next },
    });
    emit();
    return row;
  },

  /**
   * Admin-created facility. Unlike `ensureFacility` this refuses to silently
   * reuse a normalized-name match — the admin should merge instead.
   */
  createFacility(
    input: {
      name: string;
      kind: FacilityKind;
      city?: string;
      timezone?: string;
    } & Partial<FacilityProfile>,
    staffName: string,
  ): Facility {
    const name = (input.name ?? "").trim().replace(/\s+/g, " ");
    if (!name) throw new Error("A facility name is required.");
    const clash = AdelanteEHR.findFacilityByName(name);
    if (clash) throw new Error(`"${clash.name}" already exists.`);
    const row: Facility = {
      id: uid(),
      name,
      kind: input.kind,
      city: input.city?.trim() || undefined,
      timezone: input.timezone?.trim() || undefined,
      ...normalizeFacilityProfile(input),
      active: true,
      createdBy: staffName,
      createdAt: new Date().toISOString(),
    };
    facilities.push(row);
    appendAudit({
      category: "clinical",
      action: "facility_created",
      actorId: staffName,
      detail: { facilityId: row.id, name: row.name, kind: row.kind, city: row.city ?? null },
    });
    emit();
    return row;
  },

  /** Edit name/type/city/timezone. Name changes route through renameFacility rules. */
  updateFacility(
    facilityId: string,
    patch: {
      name?: string;
      kind?: FacilityKind;
      city?: string;
      timezone?: string;
    } & Partial<FacilityProfile>,
    staffName: string,
  ): Facility {
    const row = facilities.find((f) => f.id === facilityId);
    if (!row) throw new Error("Facility not found.");
    if (patch.name !== undefined) AdelanteEHR.renameFacility(facilityId, patch.name, staffName);
    // Snapshot only the fields this patch can touch, so the audit diff stays
    // readable instead of dumping the whole record on every keystroke-save.
    const snapshot = () => {
      const out: Record<string, string | null> = {
        kind: row.kind,
        city: row.city ?? null,
        timezone: row.timezone ?? null,
      };
      for (const key of FACILITY_PROFILE_FIELDS) {
        if (patch[key] !== undefined) out[key] = row[key] ?? null;
      }
      return out;
    };
    const before = snapshot();
    if (patch.kind !== undefined) row.kind = patch.kind;
    if (patch.city !== undefined) row.city = patch.city.trim() || undefined;
    if (patch.timezone !== undefined) row.timezone = patch.timezone.trim() || undefined;
    Object.assign(row, normalizeFacilityProfile(patch));
    appendAudit({
      category: "clinical",
      action: "facility_updated",
      actorId: staffName,
      detail: { facilityId, before, after: snapshot() },
    });
    emit();
    return row;
  },

  /**
   * Deactivate/reactivate. History is never deleted — an inactive facility
   * simply drops out of pickers while its historical rows keep resolving.
   */
  setFacilityActive(
    facilityId: string,
    active: boolean,
    reason: string,
    staffName: string,
  ): Facility {
    const row = facilities.find((f) => f.id === facilityId);
    if (!row) throw new Error("Facility not found.");
    const why = (reason ?? "").trim();
    if (!why) throw new Error("A reason is required.");
    row.active = active;
    appendAudit({
      category: "clinical",
      action: active ? "facility_reactivated" : "facility_deactivated",
      actorId: staffName,
      detail: { facilityId, name: row.name, reason: why },
    });
    emit();
    return row;
  },

  /**
   * Merge a duplicate into a surviving facility: every booking and housing
   * move is repointed to the target id, the source is deactivated (kept for
   * audit), and the count of repointed rows is recorded.
   */
  mergeFacilities(
    sourceId: string,
    targetId: string,
    reason: string,
    staffName: string,
  ): { bookings: number; housingMoves: number; target: Facility } {
    if (sourceId === targetId) throw new Error("Pick two different facilities.");
    const source = facilities.find((f) => f.id === sourceId);
    const target = facilities.find((f) => f.id === targetId);
    if (!source || !target) throw new Error("Facility not found.");
    const why = (reason ?? "").trim();
    if (!why) throw new Error("A merge reason is required.");

    let bookings = 0;
    let housingMoves = 0;
    for (const p of patients) {
      for (const b of p.bookings ?? []) {
        if (b.facilityId === sourceId) {
          b.facilityId = targetId;
          b.facilityName = target.name;
          bookings += 1;
        }
      }
      for (const m of p.housingMoves ?? []) {
        if (m.facilityId === sourceId) {
          m.facilityId = targetId;
          m.facilityName = target.name;
          housingMoves += 1;
        }
      }
    }
    source.active = false;
    appendAudit({
      category: "clinical",
      action: "facility_merged",
      actorId: staffName,
      detail: {
        sourceId,
        sourceName: source.name,
        targetId,
        targetName: target.name,
        bookings,
        housingMoves,
        reason: why,
      },
    });
    emit();
    return { bookings, housingMoves, target };
  },

  /** Per-facility rollup — the reporting this entity exists to make possible. */
  facilityBookingStats(): {
    facility: Facility;
    bookings: number;
    currentlyBooked: number;
    housingMoves: number;
  }[] {
    const all = AdelanteEHR.listBookings();
    const moves = AdelanteEHR.listHousingMoves();
    return AdelanteEHR.listFacilities(true)
      .map((facility) => ({
        facility,
        bookings: all.filter((b) => b.facilityId === facility.id).length,
        currentlyBooked: all.filter((b) => b.facilityId === facility.id && !b.releasedAt).length,
        housingMoves: moves.filter((m) => m.facilityId === facility.id).length,
      }))
      .filter((r) => r.bookings > 0 || r.facility.active);
  },

  addBooking(
    patientId: string,
    input: {
      bookingNumber: string;
      /** Either an id (autocomplete pick) or a name (free-typed, resolved). */
      facilityId?: string;
      facilityName?: string;
      bookedAt: string;
      bookingReason?: string;
      releasedAt?: string;
    },
    staffName: string,
  ): Booking {
    const p = patients.find((x) => x.id === patientId);
    if (!p) throw new Error("Patient not found");
    const bookingNumber = input.bookingNumber?.trim();
    if (!bookingNumber) throw new Error("A booking number is required.");
    const facility = AdelanteEHR.ensureFacility(
      { facilityId: input.facilityId, facilityName: input.facilityName, kind: "county_jail" },
      staffName,
    );
    if (!input.bookedAt) throw new Error("A booked date is required.");
    if (input.releasedAt && input.releasedAt < input.bookedAt)
      throw new Error("Release cannot precede booking.");
    const row: Booking = {
      id: uid(),
      patientId,
      bookingNumber,
      facilityId: facility.id,
      facilityName: facility.name,
      bookedAt: input.bookedAt,
      releasedAt: input.releasedAt || undefined,
      bookingReason: input.bookingReason?.trim() || undefined,
      createdBy: staffName,
      createdAt: new Date().toISOString(),
    };
    p.bookings = [row, ...(p.bookings ?? [])];
    appendAudit({
      category: "clinical",
      action: "booking_added",
      patientId,
      actorId: staffName,
      detail: {
        bookingId: row.id,
        bookingNumber: row.bookingNumber,
        facilityId: row.facilityId,
        facilityName: row.facilityName,
        bookedAt: row.bookedAt,
        releasedAt: row.releasedAt ?? null,
      },
    });
    emit();
    return row;
  },

  /** Close an open booking. Idempotence is deliberately rejected, not silent. */
  closeBooking(bookingId: string, releasedAt: string, staffName: string): Booking {
    const p = patients.find((x) => (x.bookings ?? []).some((b) => b.id === bookingId));
    const row = p?.bookings?.find((b) => b.id === bookingId);
    if (!p || !row) throw new Error("Booking not found");
    if (row.releasedAt) throw new Error("This booking has already been released.");
    if (!releasedAt) throw new Error("A release date is required.");
    if (releasedAt < row.bookedAt) throw new Error("Release cannot precede booking.");
    row.releasedAt = releasedAt;
    appendAudit({
      category: "clinical",
      action: "booking_released",
      patientId: p.id,
      actorId: staffName,
      detail: { bookingId: row.id, bookingNumber: row.bookingNumber, releasedAt },
    });
    emit();
    return row;
  },

  addHousingMove(
    patientId: string,
    input: {
      bookingId: string;
      movedAt: string;
      /** Defaults to the booking's facility when omitted. */
      facilityId?: string;
      facilityName?: string;
      housingUnit: string;
      reason?: string;
    },
    staffName: string,
  ): HousingMove {
    const p = patients.find((x) => x.id === patientId);
    if (!p) throw new Error("Patient not found");
    const booking = (p.bookings ?? []).find((b) => b.id === input.bookingId);
    if (!booking) throw new Error("Select the booking this move belongs to.");
    const housingUnit = input.housingUnit?.trim();
    if (!housingUnit) throw new Error("A housing unit is required.");
    if (!input.movedAt) throw new Error("A move date is required.");
    // A move usually stays inside the booking's facility; an explicit id/name
    // covers an inter-facility transfer inside the same booking episode.
    const facility =
      input.facilityId || input.facilityName?.trim()
        ? AdelanteEHR.ensureFacility(
            { facilityId: input.facilityId, facilityName: input.facilityName, kind: "county_jail" },
            staffName,
          )
        : (AdelanteEHR.getFacility(booking.facilityId) ?? {
            id: booking.facilityId,
            name: booking.facilityName,
          });
    const row: HousingMove = {
      id: uid(),
      patientId,
      bookingId: booking.id,
      movedAt: input.movedAt,
      facilityId: facility.id,
      facilityName: facility.name,
      housingUnit,
      reason: input.reason?.trim() || undefined,
      createdBy: staffName,
      createdAt: new Date().toISOString(),
    };
    p.housingMoves = [row, ...(p.housingMoves ?? [])];
    appendAudit({
      category: "clinical",
      action: "housing_move_added",
      patientId,
      actorId: staffName,
      detail: {
        moveId: row.id,
        bookingId: row.bookingId,
        bookingNumber: booking.bookingNumber,
        housingUnit: row.housingUnit,
        facilityId: row.facilityId,
        facilityName: row.facilityName,
        movedAt: row.movedAt,
      },
    });
    emit();
    return row;
  },

  /** Newest booking first. Omit `patientId` for the cross-patient list. */
  listBookings(patientId?: string): Booking[] {
    return patients
      .filter((p) => !patientId || p.id === patientId)
      .flatMap((p) => p.bookings ?? [])
      .slice()
      .sort((a, b) => b.bookedAt.localeCompare(a.bookedAt));
  },

  listHousingMoves(patientId?: string, bookingId?: string): HousingMove[] {
    return patients
      .filter((p) => !patientId || p.id === patientId)
      .flatMap((p) => p.housingMoves ?? [])
      .filter((m) => !bookingId || m.bookingId === bookingId)
      .slice()
      .sort((a, b) => b.movedAt.localeCompare(a.movedAt));
  },

  /** True when the most recent booking episode has no release recorded. */
  isCurrentlyBooked(patientId: string): boolean {
    const latest = AdelanteEHR.listBookings(patientId)[0];
    return Boolean(latest && !latest.releasedAt);
  },

  /** Current housing unit = the newest move on the patient's newest booking. */
  currentHousingUnit(patientId: string): string | undefined {
    const latest = AdelanteEHR.listBookings(patientId)[0];
    if (!latest) return undefined;
    return AdelanteEHR.listHousingMoves(patientId, latest.id)[0]?.housingUnit;
  },

  /** Facility of the patient's newest booking episode, resolved by id. */
  currentFacility(patientId: string): Facility | undefined {
    const latest = AdelanteEHR.listBookings(patientId)[0];
    return latest ? AdelanteEHR.getFacility(latest.facilityId) : undefined;
  },

  /**
   * §Released patient search — cross-patient roster query.
   *
   * Date range is compared on CALENDAR DATE ONLY (YYYY-MM-DD), never on the
   * full timestamp: a release recorded at 14:00 on the `to` date must be
   * included, which a raw `<= to` timestamp compare silently drops.
   */
  searchReleasedPatients(criteria: {
    programId?: string;
    lastName?: string;
    firstName?: string;
    dob?: string;
    releasedFrom?: string;
    releasedTo?: string;
    facilityId?: string;
  }): {
    patient: Patient;
    lastReleasedAt: string;
    facilityId: string;
    facilityName: string;
    bookingCount: number;
  }[] {
    const norm = (v?: string) => (v ?? "").trim().toLowerCase();
    const dayOf = (iso: string) => iso.slice(0, 10);
    const out: {
      patient: Patient;
      lastReleasedAt: string;
      facilityId: string;
      facilityName: string;
      bookingCount: number;
    }[] = [];
    for (const p of patients) {
      const bookings = p.bookings ?? [];
      if (!bookings.length) continue;
      if (criteria.programId && !norm(p.programId).includes(norm(criteria.programId))) continue;
      if (criteria.lastName && !norm(p.lastName).includes(norm(criteria.lastName))) continue;
      if (criteria.firstName && !norm(p.firstName).includes(norm(criteria.firstName))) continue;
      if (criteria.dob && p.dob !== criteria.dob) continue;
      const released = bookings
        .filter((b) => b.releasedAt)
        // Facility filter groups on the ID, never the display snapshot.
        .filter((b) => !criteria.facilityId || b.facilityId === criteria.facilityId)
        .filter((b) => {
          const day = dayOf(b.releasedAt!);
          if (criteria.releasedFrom && day < dayOf(criteria.releasedFrom)) return false;
          if (criteria.releasedTo && day > dayOf(criteria.releasedTo)) return false;
          return true;
        })
        .sort((a, b) => b.releasedAt!.localeCompare(a.releasedAt!));
      const latest = released[0];
      if (!latest) continue;
      out.push({
        patient: p,
        lastReleasedAt: latest.releasedAt!,
        facilityId: latest.facilityId,
        facilityName: latest.facilityName,
        bookingCount: bookings.length,
      });
    }
    return out.sort((a, b) => b.lastReleasedAt.localeCompare(a.lastReleasedAt));
  },

  /** Roster of patients whose newest booking is still open. */
  searchBookedPatients(criteria: {
    programId?: string;
    lastName?: string;
    firstName?: string;
    dob?: string;
    facilityId?: string;
  }): { patient: Patient; booking: Booking; housingUnit?: string }[] {
    const norm = (v?: string) => (v ?? "").trim().toLowerCase();
    return patients
      .filter((p) => AdelanteEHR.isCurrentlyBooked(p.id))
      .filter(
        (p) =>
          (!criteria.programId || norm(p.programId).includes(norm(criteria.programId))) &&
          (!criteria.lastName || norm(p.lastName).includes(norm(criteria.lastName))) &&
          (!criteria.firstName || norm(p.firstName).includes(norm(criteria.firstName))) &&
          (!criteria.dob || p.dob === criteria.dob),
      )
      .map((p) => ({
        patient: p,
        booking: AdelanteEHR.listBookings(p.id)[0],
        housingUnit: AdelanteEHR.currentHousingUnit(p.id),
      }))
      .filter((r) => !criteria.facilityId || r.booking.facilityId === criteria.facilityId);
  },

  /**
   * §Shift count — FIRST cross-patient MAR query in this codebase. Every other
   * MAR read is patient-scoped; this one walks the whole population because a
   * controlled count is a unit-level artifact, not a chart-level one.
   */
  listAllAdministrations(
    filter: { from?: string; to?: string; includeVoided?: boolean } = {},
  ): { patient: Patient; order: MedOrder; administration: DoseAdministration }[] {
    const rows: { patient: Patient; order: MedOrder; administration: DoseAdministration }[] = [];
    for (const p of patients) {
      for (const a of p.administrations ?? []) {
        if (a.voided && !filter.includeVoided) continue;
        if (filter.from && a.chartedAt < filter.from) continue;
        if (filter.to && a.chartedAt > filter.to) continue;
        const order = (p.orders ?? []).find((o) => o.id === a.orderId);
        if (!order) continue;
        rows.push({ patient: p, order, administration: a });
      }
    }
    return rows.sort((a, b) =>
      a.administration.chartedAt.localeCompare(b.administration.chartedAt),
    );
  },

  /** Aggregate controlled administrations in a window into count lines. */
  aggregateShiftCount(opts: {
    windowStart: string;
    windowEnd: string;
    housingUnit?: string;
    schedule?: string;
  }): ShiftCountLine[] {
    const rows = AdelanteEHR.listAllAdministrations({
      from: opts.windowStart,
      to: opts.windowEnd,
    }).filter(({ order, patient }) => {
      if (!order.deaSchedule) return false;
      if (opts.schedule && opts.schedule !== "all" && order.deaSchedule !== opts.schedule)
        return false;
      if (opts.housingUnit && AdelanteEHR.currentHousingUnit(patient.id) !== opts.housingUnit)
        return false;
      return true;
    });
    const map = new Map<string, ShiftCountLine & { patientIds: Set<string> }>();
    for (const { order, patient, administration } of rows) {
      const doseLabel =
        order.strengthText || (order.doseTargetMg ? `${order.doseTargetMg} mg` : "—");
      const key = `${order.drugName}|${doseLabel}|${order.deaSchedule}`;
      let line = map.get(key);
      if (!line) {
        line = {
          key,
          drugName: order.drugName,
          doseLabel,
          deaSchedule: order.deaSchedule!,
          given: 0,
          refusedOrHeld: 0,
          patients: 0,
          patientIds: new Set<string>(),
        };
        map.set(key, line);
      }
      if (administration.action === "given") line.given += 1;
      else line.refusedOrHeld += 1;
      line.patientIds.add(patient.id);
      const at = administration.chartedAt;
      if (!line.firstAt || at < line.firstAt) line.firstAt = at;
      if (!line.lastAt || at > line.lastAt) line.lastAt = at;
    }
    return [...map.values()]
      .map(({ patientIds, ...line }) => ({ ...line, patients: patientIds.size }))
      .sort((a, b) => a.drugName.localeCompare(b.drugName));
  },

  /** Sign & lock. Two people, never the same person; the record is immutable. */
  lockShiftCount(input: {
    windowStart: string;
    windowEnd: string;
    housingUnit?: string;
    schedule?: string;
    counterName: string;
    witnessName: string;
    notes?: string;
  }): ShiftCount {
    const counterName = input.counterName?.trim();
    const witnessName = input.witnessName?.trim();
    if (!counterName) throw new Error("A counting staff identity is required.");
    if (!witnessName) throw new Error("A witness is required.");
    if (counterName === witnessName)
      throw new Error("The witness must be a different person than the counter.");
    if (!input.windowStart || !input.windowEnd) throw new Error("A count window is required.");
    if (input.windowEnd <= input.windowStart)
      throw new Error("The window end must be after the start.");
    const lines = AdelanteEHR.aggregateShiftCount(input);
    const row: ShiftCount = {
      id: uid(),
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
      housingUnit: input.housingUnit || undefined,
      scheduleFilter: input.schedule || "all",
      // Frozen snapshot — later charting never rewrites a locked count.
      lines: lines.map((l) => ({ ...l })),
      totalGiven: lines.reduce((n, l) => n + l.given, 0),
      totalRefusedOrHeld: lines.reduce((n, l) => n + l.refusedOrHeld, 0),
      counterName,
      witnessName,
      notes: input.notes?.trim() || undefined,
      signedAt: new Date().toISOString(),
    };
    shiftCounts.unshift(row);
    appendAudit({
      category: "clinical",
      action: "shift_count_locked",
      actorId: counterName,
      detail: {
        shiftCountId: row.id,
        windowStart: row.windowStart,
        windowEnd: row.windowEnd,
        housingUnit: row.housingUnit ?? null,
        scheduleFilter: row.scheduleFilter,
        lineCount: row.lines.length,
        totalGiven: row.totalGiven,
        totalRefusedOrHeld: row.totalRefusedOrHeld,
        witnessName: row.witnessName,
      },
    });
    emit();
    return row;
  },

  /** Locked counts, newest first. Copies out so callers cannot mutate history. */
  listShiftCounts(limit = 20): ShiftCount[] {
    return shiftCounts
      .slice(0, limit)
      .map((c) => ({ ...c, lines: c.lines.map((l) => ({ ...l })) }));
  },

  // ----- §Population health: KPI targets ----------------------------------

  listKpiTargets(includeInactive = false): KpiTarget[] {
    return kpiTargets
      .filter((t) => includeInactive || t.active)
      .map((t) => ({ ...t }))
      .sort((a, b) => a.label.localeCompare(b.label));
  },

  // ----- §Admin governance: frequency catalog -----------------------------
  //
  // The seeded catalog lives in src/lib/frequencies.ts; these wrappers add the
  // audit trail, the in-use protection and the reactive emit. Deactivate,
  // never delete, whenever a frequency is referenced by a live order.

  listFrequencies(includeInactive = false): MedFrequency[] {
    return listFrequencies(includeInactive);
  },

  /** Signed or held orders referencing this code — the delete blocker. */
  frequencyUsage(code: string): { count: number; patientIds: string[] } {
    const patientIds: string[] = [];
    let count = 0;
    for (const p of patients) {
      let hit = false;
      for (const o of p.orders ?? []) {
        if (o.frequencyCode !== code) continue;
        if (o.status !== "signed" && o.status !== "held") continue;
        count += 1;
        hit = true;
      }
      if (hit) patientIds.push(p.id);
    }
    return { count, patientIds };
  },

  /** Create or edit a frequency. Code is the identity and is immutable. */
  saveFrequency(
    input: {
      code: string;
      label: string;
      sigLabel: string;
      description?: string;
      isPrn: boolean;
      adminTimes: number[];
      maxPerDay?: number;
      minGapMinutes?: number;
      intervalDays?: number;
      sortOrder?: number;
    },
    staffName: string,
  ): MedFrequency {
    const code = (input.code ?? "").trim().toUpperCase().replace(/\s+/g, "_");
    if (!code) throw new Error("A frequency code is required.");
    const label = (input.label ?? "").trim();
    if (!label) throw new Error("A frequency label is required.");
    const sigLabel = (input.sigLabel ?? "").trim();
    if (!sigLabel) throw new Error("A sig fragment is required — it prints on the label.");
    const adminTimes = [...new Set(input.adminTimes ?? [])].sort((a, b) => a - b);
    if (adminTimes.some((h) => !Number.isInteger(h) || h < 0 || h > 23))
      throw new Error("Administration times must be whole hours between 0 and 23.");
    if (!input.isPrn && adminTimes.length === 0)
      throw new Error("A scheduled frequency needs at least one administration time.");
    if (input.isPrn && adminTimes.length > 0)
      throw new Error("A PRN frequency has no fixed administration times.");
    if (input.isPrn && input.maxPerDay !== undefined && input.maxPerDay < 1)
      throw new Error("Max per day must be at least 1.");
    if (input.isPrn && input.minGapMinutes !== undefined && input.minGapMinutes < 1)
      throw new Error("Minimum interval must be at least 1 minute.");

    const existing = frequencyByCode(code);
    const row = putFrequency({
      ...(existing ?? {}),
      code,
      label,
      sigLabel,
      description: input.description?.trim() || undefined,
      isPrn: input.isPrn,
      adminTimes,
      maxPerDay: input.isPrn ? input.maxPerDay : undefined,
      minGapMinutes: input.isPrn ? input.minGapMinutes : undefined,
      intervalDays: input.intervalDays && input.intervalDays > 1 ? input.intervalDays : undefined,
      sortOrder: input.sortOrder ?? existing?.sortOrder ?? (listFrequencies(true).length + 1) * 10,
      active: existing?.active ?? true,
      updatedBy: staffName,
      updatedAt: new Date().toISOString(),
    });
    appendAudit({
      category: "clinical",
      action: existing ? "frequency_updated" : "frequency_created",
      actorId: staffName,
      detail: {
        code: row.code,
        label: row.label,
        isPrn: row.isPrn,
        adminTimes: row.adminTimes,
        maxPerDay: row.maxPerDay ?? null,
        minGapMinutes: row.minGapMinutes ?? null,
      },
    });
    emit();
    return row;
  },

  /**
   * Delete a frequency. BLOCKED when any signed/held order references it —
   * the caller is told to deactivate instead, which keeps history resolvable.
   */
  deleteFrequency(code: string, staffName: string): void {
    const row = frequencyByCode(code);
    if (!row) throw new Error("Frequency not found.");
    const usage = AdelanteEHR.frequencyUsage(code);
    if (usage.count > 0)
      throw new Error(
        `${code} is in use by ${usage.count} signed or held order${
          usage.count === 1 ? "" : "s"
        } and cannot be deleted. Deactivate it with a reason instead — it will drop out of the picker while existing orders keep resolving.`,
      );
    dropFrequency(code);
    appendAudit({
      category: "clinical",
      action: "frequency_deleted",
      actorId: staffName,
      detail: { code, label: row.label },
    });
    emit();
  },

  /** Deactivate (reason required) / reactivate. */
  setFrequencyActive(
    code: string,
    active: boolean,
    staffName: string,
    reason?: string,
  ): MedFrequency {
    const row = frequencyByCode(code);
    if (!row) throw new Error("Frequency not found.");
    const why = (reason ?? "").trim();
    if (!active && !why) throw new Error("A reason is required to deactivate a frequency.");
    const usage = AdelanteEHR.frequencyUsage(code);
    const next = putFrequency({
      ...row,
      active,
      deactivatedReason: active ? undefined : why,
      updatedBy: staffName,
      updatedAt: new Date().toISOString(),
    });
    appendAudit({
      category: "clinical",
      action: active ? "frequency_reactivated" : "frequency_deactivated",
      actorId: staffName,
      detail: { code, reason: active ? null : why, ordersInUse: usage.count },
    });
    emit();
    return next;
  },

  // ----- §Admin governance: local RxNav suppressions ----------------------

  listCatalogSuppressions(includeInactive = false): CatalogSuppression[] {
    return catalogSuppressions
      .filter((s) => includeInactive || s.active)
      .map((s) => ({ ...s }))
      .sort((a, b) => (a.drugName ?? a.rxcui ?? "").localeCompare(b.drugName ?? b.rxcui ?? ""));
  },

  addCatalogSuppression(
    input: { rxcui?: string; drugName?: string; reason: string },
    staffName: string,
  ): CatalogSuppression {
    const rxcui = input.rxcui?.trim() || undefined;
    const drugName = input.drugName?.trim().replace(/\s+/g, " ") || undefined;
    const reason = (input.reason ?? "").trim();
    if (!rxcui && !drugName) throw new Error("A drug name or RxCUI is required.");
    if (!reason) throw new Error("A reason is required to suppress a product.");
    const dup = catalogSuppressions.find(
      (s) =>
        s.active &&
        ((rxcui && s.rxcui === rxcui) ||
          (drugName && (s.drugName ?? "").toLowerCase() === drugName.toLowerCase())),
    );
    if (dup) throw new Error("An active suppression already covers that product.");
    const row: CatalogSuppression = {
      id: uid(),
      rxcui,
      drugName,
      reason,
      active: true,
      createdBy: staffName,
      createdAt: new Date().toISOString(),
    };
    catalogSuppressions.push(row);
    appendAudit({
      category: "clinical",
      action: "catalog_suppression_added",
      actorId: staffName,
      detail: { id: row.id, rxcui: rxcui ?? null, drugName: drugName ?? null, reason },
    });
    emit();
    return { ...row };
  },

  /** Lift (reason required) / re-apply a suppression. Rows are never deleted. */
  setCatalogSuppressionActive(
    id: string,
    active: boolean,
    staffName: string,
    reason?: string,
  ): CatalogSuppression {
    const row = catalogSuppressions.find((s) => s.id === id);
    if (!row) throw new Error("Suppression not found.");
    const why = (reason ?? "").trim();
    if (!active && !why) throw new Error("A reason is required to lift a suppression.");
    row.active = active;
    row.deactivatedReason = active ? undefined : why;
    row.updatedBy = staffName;
    row.updatedAt = new Date().toISOString();
    appendAudit({
      category: "clinical",
      action: active ? "catalog_suppression_reapplied" : "catalog_suppression_lifted",
      actorId: staffName,
      detail: { id, drugName: row.drugName ?? null, rxcui: row.rxcui ?? null, reason: why || null },
    });
    emit();
    return { ...row };
  },

  /**
   * §Local additions (minimal fix): distinct off-catalog product names already
   * used on real orders, newest first. This makes a house-brand entry REUSABLE
   * by the next clinician instead of re-typed — without standing up a second
   * catalog registry. Justification is still required on every new order.
   */
  listOffCatalogProducts(): {
    name: string;
    uses: number;
    lastUsedAt: string;
    lastJustification?: string;
  }[] {
    const byName = new Map<
      string,
      { name: string; uses: number; lastUsedAt: string; lastJustification?: string }
    >();
    for (const p of patients) {
      for (const o of p.orders ?? []) {
        if (!o.offCatalog || !o.drugName) continue;
        const key = o.drugName.trim().toLowerCase();
        if (!key) continue;
        const at = o.statusChangedAt ?? o.createdAt ?? "";
        const prev = byName.get(key);
        if (!prev) {
          byName.set(key, {
            name: o.drugName.trim(),
            uses: 1,
            lastUsedAt: at,
            lastJustification: o.offCatalogJustification,
          });
        } else {
          prev.uses += 1;
          if (at > prev.lastUsedAt) {
            prev.lastUsedAt = at;
            prev.lastJustification = o.offCatalogJustification;
          }
        }
      }
    }
    return [...byName.values()].sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
  },

  createKpiTarget(
    input: {
      metricKey: string;
      label: string;
      targetValue: number;
      unit: "percent" | "count";
      effectiveMonth?: string;
      source?: string;
      notes?: string;
    },
    staffName: string,
  ): KpiTarget {
    const label = (input.label ?? "").trim();
    if (!input.metricKey) throw new Error("A metric is required.");
    if (!label) throw new Error("A target label is required.");
    if (!Number.isFinite(input.targetValue)) throw new Error("A numeric target value is required.");
    const row: KpiTarget = {
      id: uid(),
      metricKey: input.metricKey,
      label,
      targetValue: input.targetValue,
      unit: input.unit,
      effectiveMonth: input.effectiveMonth?.trim() || undefined,
      source: input.source?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      active: true,
      createdBy: staffName,
      createdAt: new Date().toISOString(),
    };
    kpiTargets.push(row);
    appendAudit({
      category: "clinical",
      action: "kpi_target_created",
      actorId: staffName,
      detail: {
        targetId: row.id,
        metricKey: row.metricKey,
        targetValue: row.targetValue,
        unit: row.unit,
      },
    });
    emit();
    return row;
  },

  updateKpiTarget(
    targetId: string,
    patch: Partial<
      Pick<
        KpiTarget,
        "label" | "targetValue" | "unit" | "effectiveMonth" | "source" | "notes" | "metricKey"
      >
    >,
    staffName: string,
  ): KpiTarget {
    const row = kpiTargets.find((t) => t.id === targetId);
    if (!row) throw new Error("KPI target not found.");
    const before = { ...row };
    if (patch.metricKey) row.metricKey = patch.metricKey;
    if (patch.label !== undefined) {
      const label = patch.label.trim();
      if (!label) throw new Error("A target label is required.");
      row.label = label;
    }
    if (patch.targetValue !== undefined) {
      if (!Number.isFinite(patch.targetValue))
        throw new Error("A numeric target value is required.");
      row.targetValue = patch.targetValue;
    }
    if (patch.unit) row.unit = patch.unit;
    if (patch.effectiveMonth !== undefined)
      row.effectiveMonth = patch.effectiveMonth.trim() || undefined;
    if (patch.source !== undefined) row.source = patch.source.trim() || undefined;
    if (patch.notes !== undefined) row.notes = patch.notes.trim() || undefined;
    row.updatedBy = staffName;
    row.updatedAt = new Date().toISOString();
    appendAudit({
      category: "clinical",
      action: "kpi_target_updated",
      actorId: staffName,
      detail: {
        targetId,
        from: { metricKey: before.metricKey, targetValue: before.targetValue, unit: before.unit },
        to: { metricKey: row.metricKey, targetValue: row.targetValue, unit: row.unit },
      },
    });
    emit();
    return { ...row };
  },

  /** Deactivate/reactivate. Targets are never deleted — history stays auditable. */
  setKpiTargetActive(targetId: string, active: boolean, staffName: string, reason?: string) {
    const row = kpiTargets.find((t) => t.id === targetId);
    if (!row) throw new Error("KPI target not found.");
    if (!active && !(reason ?? "").trim())
      throw new Error("A reason is required to deactivate a target.");
    row.active = active;
    row.updatedBy = staffName;
    row.updatedAt = new Date().toISOString();
    appendAudit({
      category: "clinical",
      action: active ? "kpi_target_reactivated" : "kpi_target_deactivated",
      actorId: staffName,
      detail: { targetId, metricKey: row.metricKey, reason: reason?.trim() ?? null },
    });
    emit();
    return { ...row };
  },

  // ----- §Population health: CalAIM qualifying codes -----------------------

  listQualifyingCodes(includeInactive = false): CalaimQualifyingCode[] {
    return calaimQualifyingCodes
      .filter((c) => includeInactive || c.active)
      .map((c) => ({ ...c }))
      .sort((a, b) => a.code.localeCompare(b.code));
  },

  /** Add a qualifying code. Rejects an exact duplicate on codeSystem+code. */
  addQualifyingCode(
    input: { codeSystem?: "icd10"; code: string; description?: string },
    staffName: string,
  ): CalaimQualifyingCode {
    const codeSystem = input.codeSystem ?? "icd10";
    const code = (input.code ?? "").trim().toUpperCase();
    if (!code) throw new Error("An ICD-10 code is required.");
    const dupe = calaimQualifyingCodes.find(
      (c) => c.codeSystem === codeSystem && c.code.toUpperCase() === code,
    );
    if (dupe)
      throw new Error(
        dupe.active
          ? `${code} is already a qualifying code.`
          : `${code} already exists as an inactive qualifying code — reactivate it instead.`,
      );
    const row: CalaimQualifyingCode = {
      id: uid(),
      codeSystem,
      code,
      description: input.description?.trim() || undefined,
      active: true,
      createdBy: staffName,
      createdAt: new Date().toISOString(),
    };
    calaimQualifyingCodes.push(row);
    appendAudit({
      category: "clinical",
      action: "calaim_qualifying_code_added",
      actorId: staffName,
      detail: { codeId: row.id, codeSystem, code: row.code, description: row.description ?? null },
    });
    emit();
    return { ...row };
  },

  /** Deactivate with a required reason. Never deleted — history stays auditable. */
  deactivateQualifyingCode(
    codeId: string,
    staffName: string,
    reason: string,
  ): CalaimQualifyingCode {
    const row = calaimQualifyingCodes.find((c) => c.id === codeId);
    if (!row) throw new Error("Qualifying code not found.");
    if (!(reason ?? "").trim())
      throw new Error("A reason is required to deactivate a qualifying code.");
    row.active = false;
    row.deactivatedBy = staffName;
    row.deactivatedAt = new Date().toISOString();
    row.deactivationReason = reason.trim();
    appendAudit({
      category: "clinical",
      action: "calaim_qualifying_code_deactivated",
      actorId: staffName,
      detail: { codeId, code: row.code, reason: row.deactivationReason },
    });
    emit();
    return { ...row };
  },

  /** Reactivate a previously retired code. */
  reactivateQualifyingCode(codeId: string, staffName: string): CalaimQualifyingCode {
    const row = calaimQualifyingCodes.find((c) => c.id === codeId);
    if (!row) throw new Error("Qualifying code not found.");
    row.active = true;
    row.deactivatedBy = undefined;
    row.deactivatedAt = undefined;
    row.deactivationReason = undefined;
    appendAudit({
      category: "clinical",
      action: "calaim_qualifying_code_reactivated",
      actorId: staffName,
      detail: { codeId, code: row.code },
    });
    emit();
    return { ...row };
  },

  // ----- §Clinical documentation: note templates ---------------------------
  // Registry semantics match every other admin registry here: never deleted,
  // deactivation requires a reason, and notes keep their own schema snapshot
  // so retiring a template cannot rewrite documentation history.

  /**
   * Latest version of each template key. Superseded rows are never returned
   * here — they stay queryable via `getNoteTemplate` / `listNoteTemplateVersions`
   * for historical lookups, but must never be selectable for a new note.
   */
  listNoteTemplates(includeInactive = false, includeSuperseded = false): NoteTemplate[] {
    return noteTemplates
      .filter((t) => includeSuperseded || !t.supersededBy)
      .filter((t) => includeInactive || t.active)
      .map((t) => ({ ...t }))
      .sort((a, b) => a.title.localeCompare(b.title) || a.version - b.version);
  },

  /** Full version history for one template key, oldest first. */
  listNoteTemplateVersions(key: string): NoteTemplate[] {
    return noteTemplates
      .filter((t) => t.key.toLowerCase() === key.toLowerCase())
      .map((t) => ({ ...t }))
      .sort((a, b) => a.version - b.version);
  },

  getNoteTemplate(templateId: string): NoteTemplate | undefined {
    const row = noteTemplates.find((t) => t.id === templateId);
    return row ? { ...row } : undefined;
  },

  createNoteTemplate(
    input: {
      key: string;
      title: string;
      description?: string;
      encounterType: string;
      schema: TemplateSchema;
    },
    staffName: string,
  ): NoteTemplate {
    const key = (input.key ?? "").trim();
    const title = (input.title ?? "").trim();
    if (!key) throw new Error("A template key is required.");
    if (!title) throw new Error("A template title is required.");
    if (noteTemplates.some((t) => t.key.toLowerCase() === key.toLowerCase()))
      throw new Error(`A template with the key "${key}" already exists.`);
    const row: NoteTemplate = {
      id: uid(),
      key,
      version: 1,
      title,
      description: (input.description ?? "").trim() || undefined,
      encounterType: (input.encounterType ?? "").trim() || "general",
      schema: input.schema ?? { sections: [] },
      active: true,
      createdBy: staffName,
      createdAt: new Date().toISOString(),
    };
    noteTemplates.push(row);
    appendAudit({
      category: "clinical",
      action: "note_template_created",
      actorId: staffName,
      detail: {
        templateId: row.id,
        key: row.key,
        version: row.version,
        encounterType: row.encounterType,
      },
    });
    emit();
    return { ...row };
  },

  /**
   * Presentation-only edits (title/description/encounterType) patch the row in
   * place. A schema edit changes answer semantics, so it appends a new version
   * instead: existing notes keep pointing at — and validating against — the
   * exact version they were answered on.
   */
  updateNoteTemplate(
    templateId: string,
    patch: Partial<Pick<NoteTemplate, "title" | "description" | "encounterType" | "schema">>,
    staffName: string,
  ): NoteTemplate {
    const row = noteTemplates.find((t) => t.id === templateId);
    if (!row) throw new Error("Template not found.");
    if (row.supersededBy)
      throw new Error("This template version has been superseded. Edit the latest version.");
    const nextTitle = patch.title !== undefined ? patch.title.trim() : row.title;
    if (!nextTitle) throw new Error("A template title is required.");
    // `esReviewed` is a translation-review flag, not answer semantics, so it is
    // excluded from this comparison — approving a translation updates in place
    // instead of publishing a new version. Translated TEXT changes still version.
    const schemaChanged = !!patch.schema && !schemaContentEquals(patch.schema, row.schema);

    if (schemaChanged) {
      const next: NoteTemplate = {
        id: uid(),
        key: row.key,
        version: row.version + 1,
        title: nextTitle,
        description:
          patch.description !== undefined ? patch.description.trim() || undefined : row.description,
        encounterType:
          patch.encounterType !== undefined
            ? patch.encounterType.trim() || "general"
            : row.encounterType,
        schema: patch.schema!,
        active: row.active,
        deactivationReason: row.deactivationReason,
        createdBy: staffName,
        createdAt: new Date().toISOString(),
      };
      row.supersededBy = next.id;
      row.updatedBy = staffName;
      row.updatedAt = next.createdAt;
      noteTemplates.push(next);
      appendAudit({
        category: "clinical",
        action: "note_template_version_created",
        actorId: staffName,
        detail: {
          templateId: next.id,
          supersedes: row.id,
          key: next.key,
          version: next.version,
          sections: next.schema.sections?.length ?? 0,
          fields: (next.schema.sections ?? []).reduce((n, s) => n + (s.fields?.length ?? 0), 0),
        },
      });
      emit();
      return { ...next };
    }

    if (patch.title !== undefined) {
      row.title = nextTitle;
    }
    if (patch.description !== undefined) row.description = patch.description.trim() || undefined;
    if (patch.encounterType !== undefined)
      row.encounterType = patch.encounterType.trim() || "general";
    // Review-flag-only schema edits land on the existing row.
    if (patch.schema) row.schema = patch.schema;
    row.updatedBy = staffName;
    row.updatedAt = new Date().toISOString();
    appendAudit({
      category: "clinical",
      action: "note_template_updated",
      actorId: staffName,
      detail: {
        templateId,
        key: row.key,
        version: row.version,
        schemaChanged: false,
      },
    });
    emit();
    return { ...row };
  },

  /** Deactivate / reactivate. Templates are never deleted. */
  setNoteTemplateActive(
    templateId: string,
    active: boolean,
    staffName: string,
    reason?: string,
  ): NoteTemplate {
    const row = noteTemplates.find((t) => t.id === templateId);
    if (!row) throw new Error("Template not found.");
    if (!active && !(reason ?? "").trim())
      throw new Error("A reason is required to deactivate a template.");
    row.active = active;
    row.deactivationReason = active ? undefined : reason!.trim();
    row.updatedBy = staffName;
    row.updatedAt = new Date().toISOString();
    appendAudit({
      category: "clinical",
      action: active ? "note_template_reactivated" : "note_template_deactivated",
      actorId: staffName,
      detail: { templateId, key: row.key, reason: reason?.trim() ?? null },
    });
    emit();
    return { ...row };
  },

  // ----- §Medication reconciliation ---------------------------------------
  // Reuses the Orders layer rather than duplicating it: seeding reads
  // `isOrderActive`, and the stop/modify cascade on completion goes through
  // the existing `discontinueOrder` transition (audit + statusReason included).

  listMedReconciliations(patientId: string): MedReconciliation[] {
    return [...(patients.find((p) => p.id === patientId)?.medReconciliations ?? [])];
  },

  /** The single open session for this patient, if any. */
  activeMedReconciliation(patientId: string): MedReconciliation | undefined {
    return (patients.find((p) => p.id === patientId)?.medReconciliations ?? []).find(
      (r) => r.status === "in_progress",
    );
  },

  listReconItems(patientId: string, reconId: string): MedReconItem[] {
    return (patients.find((p) => p.id === patientId)?.medReconItems ?? []).filter(
      (i) => i.reconciliationId === reconId,
    );
  },

  /**
   * Open a session and seed one item per currently-active order. Active means
   * signed or held (`isOrderActive`) — drafts and terminal orders are not
   * reconcilable.
   */
  startMedReconciliation(
    patientId: string,
    type: MedReconciliation["type"],
    notes: string | undefined,
    staffName: string,
  ): MedReconciliation {
    const p = patients.find((x) => x.id === patientId);
    if (!p) throw new Error("Patient not found");
    if (AdelanteEHR.activeMedReconciliation(patientId))
      throw new Error("A reconciliation is already in progress for this patient.");
    const row: MedReconciliation = {
      id: uid(),
      patientId,
      type,
      status: "in_progress",
      performedBy: staffName,
      performedAt: new Date().toISOString(),
      notes: notes?.trim() || undefined,
    };
    const seeded = (p.orders ?? []).filter(orderIsActive).map<MedReconItem>((o) => ({
      id: uid(),
      reconciliationId: row.id,
      source: "active_order",
      orderId: o.id,
      drugName: o.drugName,
      dose: o.dose,
      frequency: o.frequency,
      route: o.route,
      decision: "not_reviewed",
    }));
    p.medReconciliations = [row, ...(p.medReconciliations ?? [])];
    p.medReconItems = [...(p.medReconItems ?? []), ...seeded];
    appendAudit({
      category: "clinical",
      action: "med_recon_started",
      patientId,
      actorId: staffName,
      detail: { reconciliationId: row.id, type, seededActiveOrders: seeded.length },
    });
    emit();
    return row;
  },

  updateReconItem(
    patientId: string,
    reconId: string,
    itemId: string,
    patch: Partial<
      Pick<
        MedReconItem,
        | "decision"
        | "newDose"
        | "newFrequency"
        | "newRoute"
        | "decisionNote"
        | "drugName"
        | "dose"
        | "frequency"
        | "route"
      >
    >,
    staffName?: string,
  ): MedReconItem {
    const p = patients.find((x) => x.id === patientId);
    const recon = p?.medReconciliations?.find((r) => r.id === reconId);
    if (!recon) throw new Error("Reconciliation not found.");
    if (recon.status !== "in_progress")
      throw new Error("This reconciliation is closed and can no longer be edited.");
    const row = p?.medReconItems?.find((i) => i.id === itemId && i.reconciliationId === reconId);
    if (!row) throw new Error("Reconciliation item not found.");
    Object.assign(row, patch);
    for (const key of ["newDose", "newFrequency", "newRoute", "decisionNote"] as const) {
      if (row[key] !== undefined) row[key] = String(row[key]).trim() || undefined;
    }
    if (patch.decision) {
      row.decidedBy = staffName ?? recon.performedBy;
      row.decidedAt = new Date().toISOString();
      appendAudit({
        category: "clinical",
        action: "med_recon_item_decided",
        patientId,
        actorId: row.decidedBy,
        detail: {
          reconciliationId: reconId,
          itemId,
          drugName: row.drugName,
          source: row.source,
          orderId: row.orderId ?? null,
          decision: row.decision,
          note: row.decisionNote ?? null,
        },
      });
    }
    emit();
    return row;
  },

  /**
   * Home / prior-to-arrival medication. Informational only: it never creates
   * or touches a real order. Placing an order is an explicit Orders-tab action.
   */
  addHomeReconItem(
    patientId: string,
    reconId: string,
    input: { drugName: string; dose?: string; frequency?: string; route?: string },
    staffName?: string,
  ): MedReconItem {
    const p = patients.find((x) => x.id === patientId);
    const recon = p?.medReconciliations?.find((r) => r.id === reconId);
    if (!p || !recon) throw new Error("Reconciliation not found.");
    if (recon.status !== "in_progress")
      throw new Error("This reconciliation is closed and can no longer be edited.");
    const drugName = input.drugName?.trim();
    if (!drugName) throw new Error("A medication name is required.");
    const row: MedReconItem = {
      id: uid(),
      reconciliationId: reconId,
      source: "home",
      drugName,
      dose: input.dose?.trim() || undefined,
      frequency: input.frequency?.trim() || undefined,
      route: input.route?.trim() || undefined,
      decision: "not_reviewed",
    };
    p.medReconItems = [...(p.medReconItems ?? []), row];
    appendAudit({
      category: "clinical",
      action: "med_recon_home_med_added",
      patientId,
      actorId: staffName ?? recon.performedBy,
      detail: { reconciliationId: reconId, itemId: row.id, drugName },
    });
    emit();
    return row;
  },

  /** Home rows only — an active-order row must be decided, never deleted. */
  removeReconItem(patientId: string, reconId: string, itemId: string, staffName?: string): void {
    const p = patients.find((x) => x.id === patientId);
    const recon = p?.medReconciliations?.find((r) => r.id === reconId);
    if (!p || !recon) throw new Error("Reconciliation not found.");
    if (recon.status !== "in_progress")
      throw new Error("This reconciliation is closed and can no longer be edited.");
    const row = p.medReconItems?.find((i) => i.id === itemId && i.reconciliationId === reconId);
    if (!row) throw new Error("Reconciliation item not found.");
    if (row.source !== "home")
      throw new Error(
        "An active medication must be decided (continue / modify / stop), not removed.",
      );
    p.medReconItems = (p.medReconItems ?? []).filter((i) => i.id !== itemId);
    appendAudit({
      category: "clinical",
      action: "med_recon_item_removed",
      patientId,
      actorId: staffName ?? recon.performedBy,
      detail: { reconciliationId: reconId, itemId, drugName: row.drugName },
    });
    emit();
  },

  /** Persist header notes without closing the session ("Save draft"). */
  saveMedReconciliationNotes(patientId: string, reconId: string, notes: string): MedReconciliation {
    const recon = patients
      .find((x) => x.id === patientId)
      ?.medReconciliations?.find((r) => r.id === reconId);
    if (!recon) throw new Error("Reconciliation not found.");
    if (recon.status !== "in_progress")
      throw new Error("This reconciliation is closed and can no longer be edited.");
    recon.notes = notes.trim() || undefined;
    emit();
    return recon;
  },

  /** Active-order rows still sitting at "not_reviewed" — the completion gate. */
  unreviewedReconItems(patientId: string, reconId: string): MedReconItem[] {
    return AdelanteEHR.listReconItems(patientId, reconId).filter(
      (i) => i.source === "active_order" && i.decision === "not_reviewed",
    );
  },

  /**
   * Close the session. Hard-blocks while any seeded active order is
   * undecided; on success every stop/modify row with an orderId is
   * discontinued through the normal order lifecycle path.
   */
  completeMedReconciliation(
    patientId: string,
    reconId: string,
    staffName: string,
  ): { reconciliation: MedReconciliation; discontinuedOrderIds: string[] } {
    const p = patients.find((x) => x.id === patientId);
    const recon = p?.medReconciliations?.find((r) => r.id === reconId);
    if (!p || !recon) throw new Error("Reconciliation not found.");
    if (recon.status !== "in_progress") throw new Error("This reconciliation is already closed.");
    const pending = AdelanteEHR.unreviewedReconItems(patientId, reconId);
    if (pending.length > 0)
      throw new Error(
        `${pending.length} active medication${pending.length === 1 ? "" : "s"} still need a decision before this reconciliation can be completed.`,
      );
    const items = AdelanteEHR.listReconItems(patientId, reconId);
    const discontinuedOrderIds: string[] = [];
    for (const item of items) {
      if (!item.orderId) continue;
      if (item.decision !== "stop" && item.decision !== "modify") continue;
      const order = p.orders?.find((o) => o.id === item.orderId);
      if (!order || !orderIsActive(order)) continue;
      const reason =
        item.decisionNote?.trim() ||
        `${item.decision === "stop" ? "Stopped" : "Modified"} via medication reconciliation`;
      AdelanteEHR.discontinueOrder(patientId, item.orderId, staffName, reason);
      discontinuedOrderIds.push(item.orderId);
    }
    recon.status = "completed";
    recon.completedAt = new Date().toISOString();
    appendAudit({
      category: "clinical",
      action: "med_recon_completed",
      patientId,
      actorId: staffName,
      detail: {
        reconciliationId: reconId,
        type: recon.type,
        items: items.length,
        decisions: {
          continue: items.filter((i) => i.decision === "continue").length,
          modify: items.filter((i) => i.decision === "modify").length,
          stop: items.filter((i) => i.decision === "stop").length,
          add: items.filter((i) => i.decision === "add").length,
        },
        discontinuedOrderIds,
      },
    });
    emit();
    return { reconciliation: recon, discontinuedOrderIds };
  },

  /** Discard. No order is touched; the session and its items stay as history. */
  cancelMedReconciliation(
    patientId: string,
    reconId: string,
    staffName: string,
  ): MedReconciliation {
    const recon = patients
      .find((x) => x.id === patientId)
      ?.medReconciliations?.find((r) => r.id === reconId);
    if (!recon) throw new Error("Reconciliation not found.");
    if (recon.status !== "in_progress") throw new Error("This reconciliation is already closed.");
    recon.status = "canceled";
    recon.completedAt = new Date().toISOString();
    appendAudit({
      category: "clinical",
      action: "med_recon_canceled",
      patientId,
      actorId: staffName,
      detail: { reconciliationId: reconId, type: recon.type },
    });
    emit();
    return recon;
  },

  // ---------- §Group sessions ----------
  listGroupSessions: () =>
    [...groupSessions].sort((a, b) => +new Date(a.start) - +new Date(b.start)),
  getGroupSession: (id: string) => groupSessions.find((g) => g.id === id),

  createGroupSession(
    input: Omit<GroupSession, "id" | "status" | "createdAt" | "createdBy" | "category"> & {
      createdBy: string;
      /** Defaults to the stricter staff-only billable category. */
      category?: GroupCategory;
    },
  ): GroupSession {
    if (!input.topic.trim()) throw new Error("Give the group a topic.");
    if (input.capacity < 1) throw new Error("Capacity must be at least 1.");
    const row: GroupSession = {
      ...input,
      topic: input.topic.trim(),
      description: input.description?.trim() || undefined,
      // PLACEHOLDER default: the stricter, staff-only, billable category.
      category: input.category ?? "sud_clinical_preauth",
      id: `grp_${uid()}`,
      status: "scheduled",
      createdAt: new Date().toISOString(),
      createdBy: input.createdBy,
    };
    groupSessions.push(row);
    appendAudit({
      category: "clinical",
      action: "group_session_created",
      actorId: input.createdBy,
      detail: {
        groupSessionId: row.id,
        topic: row.topic,
        serviceType: row.serviceType,
        category: row.category,
        recurrence: row.recurrence.kind,
        capacity: row.capacity,
      },
    });
    emit();
    return row;
  },

  updateGroupSession(id: string, patch: Partial<Omit<GroupSession, "id">>, actor: string) {
    const row = groupSessions.find((g) => g.id === id);
    if (!row) throw new Error("Group not found.");
    Object.assign(row, patch);
    appendAudit({
      category: "clinical",
      action: "group_session_updated",
      actorId: actor,
      detail: { groupSessionId: id, fields: Object.keys(patch) },
    });
    emit();
    return row;
  },

  cancelGroupSession(id: string, reason: string, actor: string) {
    const row = groupSessions.find((g) => g.id === id);
    if (!row) throw new Error("Group not found.");
    const trimmed = reason.trim();
    if (!trimmed) throw new Error("A cancellation reason is required.");
    row.status = "cancelled";
    row.cancelledAt = new Date().toISOString();
    row.cancellationReason = trimmed;
    appendAudit({
      category: "clinical",
      action: "group_session_cancelled",
      actorId: actor,
      detail: { groupSessionId: id, reason: trimmed },
    });
    emit();
    return row;
  },

  /**
   * §Group sessions — edit the recurrence pattern and regenerate the FUTURE
   * occurrence list only.
   *
   * History is never rewritten: an occurrence record is preserved when it is
   * in the past, or when attendance was taken, or when it carries a shared
   * note / attendee notes. Only unused future placeholders that no longer
   * line up with the new pattern are dropped.
   */
  updateGroupRecurrence(
    sessionId: string,
    recurrence: GroupRecurrence,
    actor: string,
    opts?: { start?: string },
  ): { session: GroupSession; removedFutureOccurrences: number; upcoming: string[] } {
    const g = groupSessions.find((x) => x.id === sessionId);
    if (!g) throw new Error("Group not found.");
    if (recurrence.kind === "weekly" && recurrence.daysOfWeek?.length === 0)
      throw new Error("Pick at least one weekday for a weekly group.");
    const previous = g.recurrence;
    g.recurrence = recurrence;
    if (opts?.start) g.start = opts.start;

    const now = Date.now();
    const nextStarts = new Set(AdelanteEHR.groupOccurrenceStarts(sessionId, 26));
    let removed = 0;
    for (let i = groupOccurrences.length - 1; i >= 0; i--) {
      const occ = groupOccurrences[i]!;
      if (occ.sessionId !== sessionId) continue;
      const t = Date.parse(occ.occurrenceStart);
      const isPast = !Number.isFinite(t) || t <= now;
      const hasHistory =
        !!occ.attendanceRecordedAt ||
        occ.attendance.length > 0 ||
        !!occ.sharedNote ||
        Object.keys(occ.attendeeNoteIds).length > 0;
      if (isPast || hasHistory) continue;
      if (nextStarts.has(occ.occurrenceStart)) continue;
      groupOccurrences.splice(i, 1);
      removed++;
    }

    appendAudit({
      category: "clinical",
      action: "group_recurrence_updated",
      actorId: actor,
      detail: {
        groupSessionId: sessionId,
        from: previous.kind,
        to: recurrence.kind,
        daysOfWeek: recurrence.daysOfWeek,
        until: recurrence.until,
        removedFutureOccurrences: removed,
      },
    });
    emit();
    return {
      session: g,
      removedFutureOccurrences: removed,
      upcoming: AdelanteEHR.groupOccurrenceStarts(sessionId, 6),
    };
  },

  /** Standing roster for a group (active enrollments unless asked otherwise). */
  listGroupEnrollments(sessionId: string, opts?: { includeEnded?: boolean }) {
    return groupEnrollments.filter(
      (e) => e.sessionId === sessionId && (opts?.includeEnded || !e.endedAt),
    );
  },

  /** Every active group a patient is enrolled in. */
  groupsForPatient(patientId: string): GroupSession[] {
    const ids = groupEnrollments
      .filter((e) => e.patientId === patientId && !e.endedAt)
      .map((e) => e.sessionId);
    return groupSessions.filter((g) => ids.includes(g.id) && g.status !== "cancelled");
  },

  // -------------------------------------------------------------------------
  // §Group sessions — care-plan eligibility gate.
  //
  // PLACEHOLDER CRITERIA. This gate is a real, enforced precondition for every
  // enrollment path (staff, patient self-service, and the future Authorized
  // Representative / Collateral path), but WHAT makes a patient eligible is
  // not decided here — `reason` is free text and `curriculumNeedTag` is an
  // invented label pending Christi/SME content.
  // -------------------------------------------------------------------------
  getGroupEligibility(patientId: string): GroupEligibility | undefined {
    return patients.find((p) => p.id === patientId)?.groupEligibility;
  },

  isGroupEligible(patientId: string): boolean {
    return !!patients.find((p) => p.id === patientId)?.groupEligibility;
  },

  setGroupEligibility(input: {
    patientId: string;
    reason: string;
    curriculumNeedTag?: string;
    /** StaffRole string — must be in GROUP_ELIGIBILITY_ROLES. */
    role: string;
    actor: string;
  }): GroupEligibility {
    const p = patients.find((x) => x.id === input.patientId);
    if (!p) throw new Error("Patient not found.");
    if (!(GROUP_ELIGIBILITY_ROLES as readonly string[]).includes(input.role))
      throw new Error("Only a therapist, PMHNP or case manager can set group eligibility.");
    const reason = input.reason.trim();
    if (!reason) throw new Error("A clinical reason is required.");
    p.groupEligibility = {
      eligible: true,
      reason,
      curriculumNeedTag: input.curriculumNeedTag?.trim() || undefined,
      setAt: new Date().toISOString(),
      setBy: input.actor,
      setByRole: input.role,
    };
    _recomputeCarePlan(p.id, "group_eligibility");
    appendAudit({
      category: "clinical",
      action: "group_eligibility_set",
      patientId: p.id,
      actorId: input.actor,
      detail: { role: input.role, curriculumNeedTag: p.groupEligibility.curriculumNeedTag },
    });
    emit();
    return p.groupEligibility;
  },

  clearGroupEligibility(patientId: string, reason: string, actor: string) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) throw new Error("Patient not found.");
    const trimmed = reason.trim();
    if (!trimmed) throw new Error("A reason is required to remove group eligibility.");
    p.groupEligibility = undefined;
    _recomputeCarePlan(p.id, "group_eligibility_cleared");
    appendAudit({
      category: "clinical",
      action: "group_eligibility_cleared",
      patientId: p.id,
      actorId: actor,
      detail: { reason: trimmed },
    });
    emit();
  },

  /**
   * THE single place that decides whether an actor may enroll this patient in
   * this group. Staff, patient self-service and (later) the DHCS Authorized
   * Representative / Collateral role all funnel through here — adding the
   * advocate means adding one branch below, not touching enrollment logic.
   */
  assertEnrollmentAllowed(
    group: GroupSession,
    patientId: string,
    initiator: EnrollmentInitiator,
  ): void {
    // Every refusal is audited before it throws, so the admin group-audit view
    // can show blocked attempts from the SAME logging mechanism as everything
    // else — no parallel log.
    const block = (reasonCode: string, message: string): never => {
      appendAudit({
        category: "clinical",
        action: "group_enrollment_blocked",
        patientId,
        actorId: initiator.actorId,
        detail: {
          groupSessionId: group.id,
          topic: group.topic,
          category: group.category,
          initiatedBy: initiator.kind,
          reasonCode,
          reason: message,
        },
      });
      throw new Error(message);
    };
    if (group.status === "cancelled") block("group_cancelled", "That group is cancelled.");
    if (!AdelanteEHR.isGroupEligible(patientId))
      block(
        "no_eligibility",
        "Group eligibility has not been set for this patient. A therapist, PMHNP or case manager must set it before any enrollment.",
      );
    if (initiator.kind === "patient") {
      if (group.category !== "open_psychoeducational")
        block("staff_enrolled_only", "This group is staff-enrolled only.");
      if (initiator.actorId !== patientId)
        block("not_self", "You can only book groups for yourself.");
    }
    // Capacity is a real precondition on EVERY path (staff, self-service and
    // later the advocate path), not just the staff write. Someone already on
    // the roster is not "another seat", so they never trip it.
    const active = AdelanteEHR.listGroupEnrollments(group.id);
    const alreadyOnRoster = active.some((e) => e.patientId === patientId);
    if (!alreadyOnRoster && active.length >= group.capacity)
      block(
        "at_capacity",
        `This group is full — ${active.length} of ${group.capacity} places are taken.`,
      );
    // FUTURE: `initiator.kind === "advocate"` (Authorized Representative /
    // Collateral, CalAIM DMC-ODS) plugs in here — it will need its own
    // relationship + consent check. Do not scatter that logic elsewhere.
  },

  /**
   * Open groups this patient may self-book: open category only, eligibility
   * set, not cancelled, not already enrolled, not at capacity. Used by the
   * patient scheduling page — `sud_clinical_preauth` can never appear here.
   */
  openGroupsForPatient(patientId: string): GroupSession[] {
    if (!AdelanteEHR.isGroupEligible(patientId)) return [];
    const enrolled = new Set(AdelanteEHR.groupsForPatient(patientId).map((g) => g.id));
    return groupSessions.filter(
      (g) =>
        g.category === "open_psychoeducational" &&
        g.status !== "cancelled" &&
        !enrolled.has(g.id) &&
        AdelanteEHR.listGroupEnrollments(g.id).length < g.capacity,
    );
  },

  /**
   * Patient self-service enrollment. Open psychoeducational groups only —
   * routed through the same `enrollInGroup` write so there is one enrollment
   * implementation, not a parallel patient path.
   */
  selfEnrollInGroup(input: { sessionId: string; patientId: string }): GroupSessionEnrollment {
    return AdelanteEHR.enrollInGroup({
      sessionId: input.sessionId,
      patientId: input.patientId,
      enrolledBy: input.patientId,
      initiator: { kind: "patient", actorId: input.patientId },
    });
  },

  /**
   * Enrollment write. Defaults to a staff initiator; patient self-service
   * comes through `selfEnrollInGroup`. Every path is gated by
   * `assertEnrollmentAllowed` — including the care-plan eligibility flag.
   */
  enrollInGroup(input: {
    sessionId: string;
    patientId: string;
    enrolledBy: string;
    initiator?: EnrollmentInitiator;
  }): GroupSessionEnrollment {
    const group = groupSessions.find((g) => g.id === input.sessionId);
    if (!group) throw new Error("Group not found.");
    const initiator: EnrollmentInitiator = input.initiator ?? {
      kind: "staff",
      actorId: input.enrolledBy,
    };
    AdelanteEHR.assertEnrollmentAllowed(group, input.patientId, initiator);
    const already = groupEnrollments.find(
      (e) => e.sessionId === input.sessionId && e.patientId === input.patientId && !e.endedAt,
    );
    if (already) return already;
    // Capacity is enforced (and audited) in `assertEnrollmentAllowed` above.
    // PLACEHOLDER limit: the group's OWN capacity field only — no DHCS
    // group-size rule is encoded anywhere.
    const row: GroupSessionEnrollment = {
      id: `gre_${uid()}`,
      sessionId: input.sessionId,
      patientId: input.patientId,
      enrolledAt: new Date().toISOString(),
      enrolledBy: input.enrolledBy,
    };
    groupEnrollments.push(row);
    appendAudit({
      category: "clinical",
      action: "group_enrollment_added",
      patientId: input.patientId,
      actorId: input.enrolledBy,
      detail: {
        groupSessionId: input.sessionId,
        enrollmentId: row.id,
        category: group.category,
        initiatedBy: initiator.kind,
      },
    });
    emit();
    return row;
  },

  endGroupEnrollment(enrollmentId: string, reason: string, actor: string) {
    const row = groupEnrollments.find((e) => e.id === enrollmentId);
    if (!row) throw new Error("Enrollment not found.");
    const trimmed = reason.trim();
    if (!trimmed) throw new Error("A reason is required to end an enrollment.");
    row.endedAt = new Date().toISOString();
    row.endReason = trimmed;
    appendAudit({
      category: "clinical",
      action: "group_enrollment_ended",
      patientId: row.patientId,
      actorId: actor,
      detail: { groupSessionId: row.sessionId, enrollmentId, reason: trimmed },
    });
    emit();
    return row;
  },

  /** Projected occurrence start times for a group. Pure date math. */
  groupOccurrenceStarts(sessionId: string, count = 8): string[] {
    const g = groupSessions.find((x) => x.id === sessionId);
    if (!g) return [];
    const first = new Date(g.start);
    if (g.recurrence.kind === "none") return [first.toISOString()];
    const days = g.recurrence.daysOfWeek?.length
      ? g.recurrence.daysOfWeek
      : [first.getDay()];
    const until = g.recurrence.until ? new Date(`${g.recurrence.until}T23:59:59`) : undefined;
    const out: string[] = [];
    const cursor = new Date(first);
    for (let i = 0; i < count * 7 + 7 && out.length < count; i++) {
      if (days.includes(cursor.getDay()) && +cursor >= +first) {
        if (until && +cursor > +until) break;
        out.push(new Date(cursor).toISOString());
      }
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(first.getHours(), first.getMinutes(), 0, 0);
    }
    // Apply single-occurrence exceptions: cancelled meetings disappear, moved
    // meetings surface at their new time. The recurrence pattern is untouched.
    const records = groupOccurrences.filter((o) => o.sessionId === sessionId);
    const projected: string[] = [];
    for (const start of out) {
      const rec = records.find((r) => r.occurrenceStart === start);
      if (rec?.status === "cancelled") continue;
      projected.push(rec?.movedToStart ?? start);
    }
    for (const rec of records) {
      if (rec.movedFromStart && !projected.includes(rec.occurrenceStart))
        projected.push(rec.occurrenceStart);
    }
    return [...new Set(projected)].sort();
  },

  /**
   * §Group sessions — occurrence-level exceptions (NOT the recurrence editor).
   *
   * Hard rule shared with every other correction path in this feature: an
   * occurrence that is in the past, or that already carries attendance, a
   * shared note or attendee notes, can never be silently rewritten. Those
   * cases throw; the correction path is documentation amendment, not
   * cancelling the meeting out from under the record.
   */
  assertGroupOccurrenceMutable(sessionId: string, occurrenceStart: string, now = new Date()) {
    const g = groupSessions.find((x) => x.id === sessionId);
    if (!g) throw new Error("Group not found.");
    const t = Date.parse(occurrenceStart);
    if (!Number.isFinite(t)) throw new Error("That occurrence time is not valid.");
    if (t <= now.getTime())
      throw new Error("That occurrence is in the past — past meetings can't be changed.");
    const occ = groupOccurrences.find(
      (o) => o.sessionId === sessionId && o.occurrenceStart === occurrenceStart,
    );
    if (occ) {
      if (occ.status === "cancelled") throw new Error("That occurrence is already cancelled.");
      if (occ.movedToStart) throw new Error("That occurrence has already been moved.");
      const hasHistory =
        !!occ.attendanceRecordedAt ||
        occ.attendance.length > 0 ||
        !!occ.sharedNote ||
        Object.keys(occ.attendeeNoteIds).length > 0;
      if (hasHistory)
        throw new Error(
          "Attendance or notes already exist for that occurrence — amend the documentation instead.",
        );
    }
    return occ;
  },

  cancelGroupOccurrence(
    sessionId: string,
    occurrenceStart: string,
    reason: string,
    actor: string,
  ): GroupOccurrenceRecord {
    const trimmed = reason.trim();
    if (!trimmed) throw new Error("A reason is required to cancel a meeting.");
    AdelanteEHR.assertGroupOccurrenceMutable(sessionId, occurrenceStart);
    const row = _ensureGroupOccurrence(sessionId, occurrenceStart);
    row.status = "cancelled";
    row.cancelReason = trimmed;
    row.cancelledAt = new Date().toISOString();
    row.cancelledBy = actor;
    appendAudit({
      category: "clinical",
      action: "group_occurrence_cancelled",
      actorId: actor,
      detail: { groupSessionId: sessionId, occurrenceStart, reason: trimmed },
    });
    emit();
    return row;
  },

  rescheduleGroupOccurrence(
    sessionId: string,
    occurrenceStart: string,
    newStart: string,
    reason: string,
    actor: string,
  ): { from: GroupOccurrenceRecord; to: GroupOccurrenceRecord } {
    const trimmed = reason.trim();
    if (!trimmed) throw new Error("A reason is required to move a meeting.");
    const t = Date.parse(newStart);
    if (!Number.isFinite(t)) throw new Error("Pick a valid new date and time.");
    if (t <= Date.now()) throw new Error("The new time has to be in the future.");
    AdelanteEHR.assertGroupOccurrenceMutable(sessionId, occurrenceStart);
    if (newStart === occurrenceStart) throw new Error("That is the same time.");
    const existing = groupOccurrences.find(
      (o) => o.sessionId === sessionId && o.occurrenceStart === newStart,
    );
    if (existing) throw new Error("A meeting already exists at that time.");
    const from = _ensureGroupOccurrence(sessionId, occurrenceStart);
    from.movedToStart = newStart;
    from.rescheduleReason = trimmed;
    const to = _ensureGroupOccurrence(sessionId, newStart);
    to.movedFromStart = occurrenceStart;
    to.rescheduleReason = trimmed;
    appendAudit({
      category: "clinical",
      action: "group_occurrence_rescheduled",
      actorId: actor,
      detail: { groupSessionId: sessionId, from: occurrenceStart, to: newStart, reason: trimmed },
    });
    emit();
    return { from, to };
  },

  listGroupOccurrenceRecords: (sessionId: string) =>
    groupOccurrences.filter((o) => o.sessionId === sessionId),

  getGroupOccurrence(sessionId: string, occurrenceStart: string) {
    return groupOccurrences.find(
      (o) => o.sessionId === sessionId && o.occurrenceStart === occurrenceStart,
    );
  },

  /** Facilitator-recorded per-occurrence attendance. */
  recordGroupAttendance(
    sessionId: string,
    occurrenceStart: string,
    entries: GroupAttendanceEntry[],
    actor: string,
  ): GroupOccurrenceRecord {
    const g = groupSessions.find((x) => x.id === sessionId);
    if (!g) throw new Error("Group not found.");
    const row = _ensureGroupOccurrence(sessionId, occurrenceStart);
    row.attendance = entries;
    row.attendanceRecordedAt = new Date().toISOString();
    row.attendanceRecordedBy = actor;
    appendAudit({
      category: "clinical",
      action: "group_attendance_recorded",
      actorId: actor,
      detail: {
        groupSessionId: sessionId,
        occurrenceStart,
        present: entries.filter((e) => e.status !== "absent").length,
        absent: entries.filter((e) => e.status === "absent").length,
      },
    });
    emit();
    return row;
  },

  /**
   * Document one occurrence: ONE shared group note + ONE individualized
   * ProgressNote per present/late attendee. The per-attendee note is the
   * billing-critical artifact — a blanket group note for everyone is a real
   * DMC-ODS audit/denial risk, so the two are always produced together.
   *
   * The attendee notes are ordinary ProgressNotes (`category: "group"`), so
   * they inherit the existing signing, masking and consent gates untouched.
   */
  documentGroupOccurrence(input: {
    sessionId: string;
    occurrenceStart: string;
    facilitatorId: string;
    topicCovered: string;
    groupProcess: string;
    /** patientId -> that patient's individualized participation narrative. */
    perAttendee: Record<string, string>;
    actor: string;
  }): { occurrence: GroupOccurrenceRecord; attendeeNoteIds: string[] } {
    const g = groupSessions.find((x) => x.id === input.sessionId);
    if (!g) throw new Error("Group not found.");
    const row = _ensureGroupOccurrence(input.sessionId, input.occurrenceStart);
    const present = row.attendance.filter((a) => a.status !== "absent");
    if (present.length === 0) throw new Error("Record attendance before documenting.");
    const missing = present.filter((a) => !(input.perAttendee[a.patientId] ?? "").trim());
    if (missing.length > 0)
      throw new Error("Every present attendee needs their own individualized note.");

    row.sharedNote = {
      topicCovered: input.topicCovered.trim(),
      groupProcess: input.groupProcess.trim(),
      facilitatorId: input.facilitatorId,
      rosterSnapshot: row.attendance.map((a) => ({ ...a })),
      createdAt: new Date().toISOString(),
      signedBy: input.actor,
      signedAt: new Date().toISOString(),
    };

    const noteIds: string[] = [];
    for (const a of present) {
      const saved = AdelanteEHR.addProgressNote(a.patientId, {
        clinicianId: input.facilitatorId,
        date: input.occurrenceStart,
        sessionType: "group",
        subjective: input.perAttendee[a.patientId]!.trim(),
        objective: `Attendance: ${a.status}. Group topic: ${g.topic}.`,
        assessment: "",
        plan: "",
        category: "group",
        status: "draft",
        groupRef: {
          sessionId: g.id,
          occurrenceStart: input.occurrenceStart,
          facilitatorId: input.facilitatorId,
          // Open psychoeducational groups are engagement, not claims.
          billingEligible: isBillableGroupCategory(g.category),
          // PLACEHOLDER: no CPT/H-code invented. Billing supplies this.
          billingCodePlaceholder: undefined,
        },
      });
      if (saved) {
        row.attendeeNoteIds[a.patientId] = saved.id;
        noteIds.push(saved.id);
      }
    }

    appendAudit({
      category: "clinical",
      action: "group_occurrence_documented",
      actorId: input.actor,
      detail: {
        groupSessionId: g.id,
        occurrenceStart: input.occurrenceStart,
        attendeeNotes: noteIds.length,
        sharedNote: true,
      },
    });
    emit();
    return { occurrence: row, attendeeNoteIds: noteIds };
  },
};

// Re-export vendor types so consumers only import from "@/lib/ehr".
export type { Medication } from "./vendors";

// ---------------------------------------------------------------------------
// DEMO SEED — end-to-end refusal walkthrough, built through the real store API.
// Unlike the hand-written Alicia R. fixture above, this patient's order is
// drafted → signed → charted-refused through AdelanteEHR itself, so the audit
// trail, validation gates and refusal shell are all produced the same way a
// live clinician would produce them. Remove with the rest of the mock store.
// ---------------------------------------------------------------------------
{
  const PATIENT_ID = "p-demo-mar-seed";
  const PMHNP = "Dr. R. Bagga, PMHNP-BC";
  const NURSE = "Rosa T., LVN";
  const tz = "America/Los_Angeles";
  const seedPatient: Patient = {
    id: PATIENT_ID,
    programId: "ADL-2026-901",
    firstName: "Marcus",
    lastName: "Whitfield",
    dob: "1988-11-04",
    phone: "+15595550191",
    releaseDate: "2026-07-10",
    enrolledAt: "2026-07-12",
    episodeDay: 19,
    smsFallback: true,
    facilityTimezone: tz,
    consents: { hipaa: true, part2Sud: true, signedAt: "2026-07-12" },
    screeners: {},
    needs: { housing: false, food: false, employment: false, transport: false },
    carePlanSummary: "Demo record seeded through the store API for the MAR refusal walkthrough.",
    caseManagerId: "cm1",
    alerts: [],
    allergies: [],
    problems: [],
    orders: [],
    administrations: [],
    refusalForms: [],
  };
  patients.push(seedPatient);

  const draft = AdelanteEHR.addDraftOrder(PATIENT_ID, {
    drugName: "Sertraline",
    productName: "Sertraline 50 MG Oral Tablet",
    rxcui: "312940",
    strengthText: "50 MG",
    strengthSource: "rxnav",
    doseForm: "Oral Tablet",
    ingredientNames: ["Sertraline"],
    doseAxis: "mg",
    doseTargetMg: 50,
    unitsPerAdmin: 1,
    route: "PO",
    frequency: "twice daily",
    frequencyCode: "BID",
    durationValue: 30,
    durationUnit: "days",
    quantity: 60,
    daysSupply: 30,
    sig: "Take 1 tablet (50 mg) by mouth twice daily",
    dispenseRoute: "pharmacy",
    indicationText: "Major depressive disorder",
    startDate: facilityDateKey(new Date(), tz),
    createdBy: PMHNP,
  } as Omit<MedOrder, "id" | "patientId" | "status" | "attestedAt" | "attestedBy">);
  AdelanteEHR.signOrders(PATIENT_ID, [draft.id], PMHNP);

  // Chart the earliest BID slot for today as refused so the pending refusal
  // document exists the moment the MAR tab is opened.
  const dateKey = facilityDateKey(new Date(), tz);
  const [y, m, d] = dateKey.split("-").map(Number);
  const firstHour = frequencyByCode("BID")?.adminTimes[0] ?? 8;
  const scheduledAt = fromFacilityWallClock(
    { year: y, month: m, day: d, hour: firstHour },
    tz,
  ).toISOString();
  const refused = AdelanteEHR.chartDose(
    PATIENT_ID,
    draft.id,
    scheduledAt,
    "refused",
    "Patient declined morning dose — states medication makes him feel flat.",
    NURSE,
    `batch-${PATIENT_ID}-seed`,
    "Seeded demo entry charted after the scheduled window.",
  );
  AdelanteEHR.createRefusalFormShell(PATIENT_ID, refused.id, NURSE);
}

// ---------------------------------------------------------------------------
// DEMO SEED — Spanish-language refusal walkthrough. Same store-API path as the
// English seed above, but `preferredLanguage: "es"` so the refusal shell
// snapshots the DRAFT Spanish risk text (amber banner + English disclosure)
// and the interpreter section is required. Drives the browser e2e in e2e/.
// ---------------------------------------------------------------------------
{
  const PATIENT_ID = "p-demo-mar-seed-es";
  const PMHNP = "Dr. R. Bagga, PMHNP-BC";
  const NURSE = "Rosa T., LVN";
  const tz = "America/Los_Angeles";
  const seedPatient: Patient = {
    id: PATIENT_ID,
    programId: "ADL-2026-902",
    firstName: "Lucía",
    lastName: "Moreno",
    dob: "1991-03-22",
    phone: "+15595550192",
    releaseDate: "2026-07-08",
    enrolledAt: "2026-07-11",
    episodeDay: 20,
    smsFallback: true,
    facilityTimezone: tz,
    preferredLanguage: "es",
    consents: { hipaa: true, part2Sud: true, signedAt: "2026-07-11" },
    screeners: {},
    needs: { housing: false, food: false, employment: false, transport: false },
    carePlanSummary:
      "Spanish-preferred demo record seeded through the store API for the refusal translation walkthrough.",
    caseManagerId: "cm1",
    alerts: [],
    allergies: [],
    problems: [],
    orders: [],
    administrations: [],
    refusalForms: [],
  };
  patients.push(seedPatient);

  const draft = AdelanteEHR.addDraftOrder(PATIENT_ID, {
    drugName: "Sertraline",
    productName: "Sertraline 50 MG Oral Tablet",
    rxcui: "312940",
    strengthText: "50 MG",
    strengthSource: "rxnav",
    doseForm: "Oral Tablet",
    ingredientNames: ["Sertraline"],
    doseAxis: "mg",
    doseTargetMg: 50,
    unitsPerAdmin: 1,
    route: "PO",
    frequency: "twice daily",
    frequencyCode: "BID",
    durationValue: 30,
    durationUnit: "days",
    quantity: 60,
    daysSupply: 30,
    sig: "Take 1 tablet (50 mg) by mouth twice daily",
    dispenseRoute: "pharmacy",
    indicationText: "Major depressive disorder",
    startDate: facilityDateKey(new Date(), tz),
    createdBy: PMHNP,
  } as Omit<MedOrder, "id" | "patientId" | "status" | "attestedAt" | "attestedBy">);
  AdelanteEHR.signOrders(PATIENT_ID, [draft.id], PMHNP);

  const dateKeyEs = facilityDateKey(new Date(), tz);
  const [ey, em, ed] = dateKeyEs.split("-").map(Number);
  const esHour = frequencyByCode("BID")?.adminTimes[0] ?? 8;
  const refusedEs = AdelanteEHR.chartDose(
    PATIENT_ID,
    draft.id,
    fromFacilityWallClock({ year: ey, month: em, day: ed, hour: esHour }, tz).toISOString(),
    "refused",
    "La paciente rechazó la dosis de la mañana.",
    NURSE,
    `batch-${PATIENT_ID}-seed`,
    "Seeded demo entry charted after the scheduled window.",
  );
  AdelanteEHR.createRefusalFormShell(PATIENT_ID, refusedEs.id, NURSE);
}

import { useSyncExternalStore } from "react";
export function useEhr<T>(selector: () => T): T {
  // Subscribe to a stable version number so we don't loop on new-array snapshots.
  useSyncExternalStore(
    (cb) => AdelanteEHR.subscribe(cb),
    () => version,
    () => version,
  );
  return selector();
}

// ---------------------------------------------------------------------------
// DEMO SEED — §Custody tracking + controlled shift count.
// Bookings/housing moves are written through the real store API so the audit
// trail matches live use. One patient stays currently booked, one is released
// TODAY (exercising the calendar-date boundary in released search), and a CIV
// order is charted for two patients so Shift Count has real MAR data to
// aggregate. Remove with the rest of the mock store.
// ---------------------------------------------------------------------------
{
  const CM = "Luz Herrera";
  const PMHNP = "Dr. R. Bagga, PMHNP-BC";
  const NURSE = "Rosa T., LVN";
  const iso = (d: Date) => d.toISOString();
  const daysAgo = (n: number) => iso(new Date(Date.now() - n * 86400_000));
  const todayAt = (hour: number) => {
    const d = new Date();
    d.setHours(hour, 0, 0, 0);
    return iso(d);
  };

  try {
    // p1 — released today at 14:00 (the boundary case the reference had wrong).
    const b1 = AdelanteEHR.addBooking(
      "p1",
      {
        bookingNumber: "BK-2026-1041",
        facilityId: "fac-fresno-main",
        bookedAt: daysAgo(46),
        bookingReason: "Probation violation",
      },
      CM,
    );
    AdelanteEHR.addHousingMove(
      "p1",
      {
        bookingId: b1.id,
        movedAt: daysAgo(45),
        // No facility given: the move inherits the booking's facility id.
        housingUnit: "Unit 3B",
        reason: "Initial classification",
      },
      CM,
    );
    AdelanteEHR.addHousingMove(
      "p1",
      {
        bookingId: b1.id,
        movedAt: daysAgo(12),
        housingUnit: "Med Obs 1",
        reason: "Medical observation",
      },
      CM,
    );
    AdelanteEHR.closeBooking(b1.id, todayAt(14), CM);

    // p2 — currently booked, no release recorded.
    const b2 = AdelanteEHR.addBooking(
      "p2",
      {
        bookingNumber: "BK-2026-1177",
        // Deliberately typed with a hyphen and lowercase: normalization folds
        // this onto fac-fresno-north instead of minting a duplicate site.
        facilityName: "fresno county jail - north annex",
        bookedAt: daysAgo(9),
        bookingReason: "Pending arraignment",
      },
      CM,
    );
    AdelanteEHR.addHousingMove(
      "p2",
      {
        bookingId: b2.id,
        movedAt: daysAgo(9),
        housingUnit: "Unit 1A",
        reason: "Intake housing",
      },
      CM,
    );

    // Controlled (CIV) order charted for two patients — Shift Count fodder.
    for (const pid of ["p1", "p2"]) {
      const draft = AdelanteEHR.addDraftOrder(pid, {
        drugName: "Lorazepam",
        productName: "Lorazepam 1 MG Oral Tablet",
        rxcui: "197898",
        strengthText: "1 MG",
        strengthSource: "rxnav",
        doseForm: "Oral Tablet",
        ingredientNames: ["Lorazepam"],
        doseAxis: "mg",
        doseTargetMg: 1,
        unitsPerAdmin: 1,
        route: "PO",
        frequency: "twice daily",
        frequencyCode: "BID",
        durationValue: 14,
        durationUnit: "days",
        quantity: 28,
        daysSupply: 14,
        sig: "Take 1 tablet (1 mg) by mouth twice daily",
        dispenseRoute: "pharmacy",
        isControlled: true,
        deaSchedule: "CIV",
        indicationText: "Alcohol withdrawal management",
        startDate: new Date().toISOString().slice(0, 10),
        createdBy: PMHNP,
      } as Omit<MedOrder, "id" | "patientId" | "status" | "attestedAt" | "attestedBy">);
      AdelanteEHR.signOrders(pid, [draft.id], PMHNP);
      AdelanteEHR.chartDose(
        pid,
        draft.id,
        todayAt(8),
        pid === "p2" ? "refused" : "given",
        pid === "p2" ? "Patient declined the morning dose." : undefined,
        NURSE,
        `batch-shiftcount-seed-${pid}`,
        "Seeded demo entry charted outside the scheduled window.",
      );
    }
  } catch {
    /* Seeding is best-effort; a validation change must never break boot. */
  }
}

// ---------------------------------------------------------------------------
// DEMO SEED — §Worklist Phase A. A handful of cross-facility tasks so the
// worklist isn't an empty shell: a mix of directly-assigned and pool-open
// rows, two facilities, one overdue and one STAT. Written through the real
// createCaseTask API so the notification feed behaves exactly as in live use.
// ---------------------------------------------------------------------------
{
  const day = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);
  try {
    AdelanteEHR.createCaseTask({
      patientId: "p1",
      assignedTo: "cm1",
      title: "Medication pass — morning",
      detail: "Chart the 08:00 pass for Unit 3B.",
      dueDate: day(-2),
      taskType: "med_pass",
      priority: "urgent",
      allowedRoles: ["pmhnp", "therapist"],
      facilityId: "fac-fresno-main",
      housingUnit: "Unit 3B",
      source: "manual",
      dedupeKey: "worklist-seed-1",
    });
    AdelanteEHR.createCaseTask({
      patientId: "p2",
      assignedTo: "",
      title: "Intake packet review",
      detail: "Unclaimed — open to the case management pool.",
      dueDate: day(0),
      taskType: "intake_packet",
      priority: "stat",
      allowedRoles: ["ecm_provider"],
      facilityId: "fac-tulare-adult",
      housingUnit: "Unit 1A",
      source: "manual",
      dedupeKey: "worklist-seed-2",
    });
    AdelanteEHR.createCaseTask({
      patientId: "p1",
      assignedTo: "",
      title: "Housing move follow-up call",
      dueDate: day(3),
      taskType: "coordination",
      allowedRoles: [],
      facilityId: "fac-fresno-north",
      source: "manual",
      dedupeKey: "worklist-seed-3",
    });
  } catch {
    /* Seeding is best-effort; never break boot. */
  }
}
