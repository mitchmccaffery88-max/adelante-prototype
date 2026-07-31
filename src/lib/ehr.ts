// AdelanteEHR — single seam for all clinical-backend reads/writes.
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

export type DocumentClass =
  | "id"
  | "release_paperwork"
  | "benefits"
  | "prior_clinical"
  | "part2_program_record";

export interface PatientDocument {
  id: string;
  fileName: string;
  uploadedBy: "patient" | "staff";
  uploadedAt: string;
  state: "unverified" | "verified" | "rejected";
  classification?: DocumentClass;
  promotedBy?: string;
  scan: "clean" | "pending";
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
export function requiresDoseWitness(order: Pick<MedOrder, "isControlled" | "deaSchedule">): boolean {
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
  // ----- MVP EMR extension (all optional, backward compatible) -----
  /** Linked treatment episodes (not collapsed). §3a */
  episodes?: Episode[];
  /** Release date provenance. §3c — coexists with the flat `releaseDate` string. */
  releaseDateMeta?: ReleaseDateMeta;
  /** Patient-uploaded / staff-uploaded documents. §3d */
  documents?: PatientDocument[];
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
  // ----- Clinical record layer (Problems / Allergies / Alerts). §BaggaEMR mirror -----
  /** Diagnosed problems (active + resolved + soft-deleted). Mirror of BaggaEMR `patient_problems`. */
  problems?: Problem[];
  /** Allergies (active + removed). Mirror of BaggaEMR `patient_allergies`. */
  allergies?: Allergy[];
  /** Staff-visible patient safety alerts (free-text label). Mirror of BaggaEMR `patient_alerts`. */
  alerts?: PatientAlert[];
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
}

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
  room?: string;
  inPersonServices: ServiceType[];
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
  role: "case_manager" | "peer_support";
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
  source: "screener" | "clinician" | "case_manager" | "self_help";
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
  updatedBy: "system" | "clinician" | "case_manager";
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
  category?: "sud" | "mental_health" | "pregnancy" | "medical";
  /**
   * Provenance seam for a future AI-drafting layer ("Adel", separate project).
   * Schema only: nothing in this app writes "ai_draft" today. The point is that
   * authorship and signature are already distinct states — content may in
   * principle be machine-drafted, but only a human signature makes it a signed
   * legal record, and masking is unaffected by this field.
   */
  authorSource?: NoteAuthorSource;
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
}

export type NoteAuthorSource = "human" | "ai_draft";
export type NoteStatus = "draft" | "signed" | "cosign_pending" | "cosigned" | "declined";

/** Roles that may sign a note at all, and that may sign without a cosigner. */
export const NOTE_SELF_SIGN_ROLES = ["pmhnp", "therapist"] as const;

/** A note is masked exactly like a SUD problem entry — one gate, one rule. */
export function isNoteSudSensitive(note: ProgressNote): boolean {
  return note.category === "sud";
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

export interface PatientTask {
  id: string;
  kind: "rescreen" | "enrollment_assist" | "reactivation";
  label: string;
  screenerKey?: string;
  createdAt: string;
  completedAt?: string;
}

export type ApptNotificationKind = "booked" | "rescheduled" | "cancelled" | "confirmed";
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
export type CaseTaskOrigin =
  | "manual"
  | "missed_appt"
  | "screener_flag"
  | "referral_stale"
  | "notification_failed"
  | "provider_switch";

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
        enteredBy: "case_manager",
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
  { id: "cm1", name: "Lupita Sanchez, MSW", role: "case_manager" },
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
import { frequencyByCode } from "./frequencies";
import { facilityDateKey, fromFacilityWallClock } from "./facilityTime";
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
  | "rx"
  | "telehealth"
  | "vendor"
  | "access"
  | "provider_switch"
  | "care_plan"
  | "assignment"
  | "clinical";
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

/**
 * §Shift count — locked controlled-substance reconciliations. Top-level store:
 * a shift count spans every patient on the unit, so it has no owning Patient.
 */
const shiftCounts: ShiftCount[] = [];

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
  initiatedBy: "patient" | "clinician" | "case_manager" | "admin" | "system";
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

function _composeSummary(p: Patient, parts: {
  goalsOpen: number;
  sdohOpen: number;
  medsActive: number;
  nextApptStart?: string;
}): string {
  if (!p.intakeCompletedAt) return "Care plan will appear here after intake.";
  const out: string[] = [];
  const phq = p.screeners["phq-9"];
  const gad = p.screeners["gad-7"];
  if (phq) out.push(`Your mood check (PHQ-9) shows ${phq.severity.toLowerCase()} symptoms.`);
  if (gad) out.push(`Your worry check (GAD-7) shows ${gad.severity.toLowerCase()} anxiety.`);
  if (parts.goalsOpen)
    out.push(`You're working on ${parts.goalsOpen} goal${parts.goalsOpen === 1 ? "" : "s"} with your care team.`);
  if (parts.sdohOpen)
    out.push(`${parts.sdohOpen} life need${parts.sdohOpen === 1 ? "" : "s"} (like housing or food) are in progress.`);
  if (parts.medsActive)
    out.push(`Your care team is managing ${parts.medsActive} medication${parts.medsActive === 1 ? "" : "s"} with you.`);
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
  if (phq) focusAreas.push({ key: "mh", label: "Mood & anxiety", severity: `PHQ-9 ${phq.severity}` });
  else if (gad) focusAreas.push({ key: "mh", label: "Mood & anxiety", severity: `GAD-7 ${gad.severity}` });
  const hasSud = p.needs?.substanceUse || p.screeners["audit"] || p.screeners["dast-10"];
  if (hasSud)
    focusAreas.push({ key: "sud", label: "Substance use support", sensitive: true });
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
      source: t.kind === "rescreen" ? "screener" : "case_manager",
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
  setGoalStatus(patientId: string, goalId: string, status: Goal["status"], updatedBy?: string) {
    const p = patients.find((x) => x.id === patientId);
    const g = p?.goals?.find((x) => x.id === goalId);
    if (!g) return;
    g.status = status;
    if (updatedBy) g.updatedBy = updatedBy;
    if (p) _recomputeCarePlan(p.id, "goal_status");
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

    n.signedBy = input.signedBy;
    n.signedAt = new Date().toISOString();
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
    if (n.signedBy === input.cosignedBy) throw new Error("A note cannot be cosigned by its signer.");

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
    emit();
    return n;
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
    if (reason.length < 3) throw new Error("A decline reason of at least 3 characters is required.");

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

  // ----- Consent state + audit log -----
  getConsentState(patientId: string) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return { part2Sud: false, ecmShare: false, sms: true };
    return (
      p.consentState ?? {
        part2Sud: p.consents.part2Sud,
        ecmShare: Boolean(p.coverage?.ecmEligible),
        sms: p.smsFallback,
      }
    );
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

  // ----- §3d — Documents (mock upload/verify queue) -----
  uploadDocument(
    patientId: string,
    input: { fileName: string; uploadedBy: "patient" | "staff"; classification?: DocumentClass },
  ) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    const doc: PatientDocument = {
      id: uid(),
      fileName: input.fileName,
      uploadedBy: input.uploadedBy,
      uploadedAt: new Date().toISOString(),
      state: "unverified",
      classification: input.classification,
      scan: "clean", // real impl: kick off virus scan; §11 out-of-scope
    };
    p.documents = [doc, ...(p.documents ?? [])];
    emit();
    return doc;
  },
  classifyDocument(patientId: string, documentId: string, classification: DocumentClass) {
    const d = patients.find((x) => x.id === patientId)?.documents?.find((x) => x.id === documentId);
    if (!d) return;
    d.classification = classification;
    emit();
  },
  verifyDocument(patientId: string, documentId: string, staffLabel: string) {
    const d = patients.find((x) => x.id === patientId)?.documents?.find((x) => x.id === documentId);
    if (!d) return;
    d.state = "verified";
    d.promotedBy = staffLabel;
    emit();
  },
  rejectDocument(patientId: string, documentId: string) {
    const d = patients.find((x) => x.id === patientId)?.documents?.find((x) => x.id === documentId);
    if (!d) return;
    d.state = "rejected";
    emit();
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
    p.peerNotes = [{ ...input, id: uid() }, ...(p.peerNotes ?? [])];
    emit();
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
  listCaseTasks(): CaseTask[] {
    return [...caseTasks];
  },
  caseTasksForCM(cmId: string): CaseTask[] {
    return caseTasks.filter((t) => t.assignedTo === cmId);
  },
  caseTasksForPatient(patientId: string): CaseTask[] {
    return caseTasks.filter((t) => t.patientId === patientId);
  },
  createCaseTask(input: {
    patientId: string;
    assignedTo: string;
    title: string;
    detail?: string;
    dueDate: string;
    origin?: CaseTaskOrigin;
    dedupeKey?: string;
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
    };
    caseTasks.unshift(task);
    emit();
    return task;
  },
  completeCaseTask(id: string) {
    const t = caseTasks.find((x) => x.id === id);
    if (!t) return;
    t.status = "done";
    t.completedAt = new Date().toISOString();
    emit();
  },
  reopenCaseTask(id: string) {
    const t = caseTasks.find((x) => x.id === id);
    if (!t) return;
    t.status = "open";
    t.completedAt = undefined;
    t.snoozedUntil = undefined;
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
  listAuditEvents(
    filter: {
      patientId?: string;
      category?: AuditCategory | AuditCategory[];
      since?: string;
      limit?: number;
    } = {},
  ): AuditEvent[] {
    const cats = Array.isArray(filter.category)
      ? new Set(filter.category)
      : filter.category
        ? new Set([filter.category])
        : null;
    const sinceMs = filter.since ? +new Date(filter.since) : 0;
    const out = auditEvents.filter((e) => {
      if (filter.patientId && e.patientId !== filter.patientId) return false;
      if (cats && !cats.has(e.category)) return false;
      if (sinceMs && +new Date(e.at) < sinceMs) return false;
      return true;
    });
    return filter.limit ? out.slice(0, filter.limit) : out;
  },

  // ---------- Catalog strength-resolution telemetry ----------
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
   */
  prnEligibility(
    patientId: string,
    orderId: string,
    now: Date = new Date(),
  ): { given: number; max?: number; lastGivenAt?: string; blocked: boolean } {
    const p = patients.find((x) => x.id === patientId);
    const order = p?.orders?.find((o) => o.id === orderId);
    const max = frequencyByCode(order?.frequencyCode)?.maxPerDay;
    const since = now.getTime() - 24 * 3600_000;
    const rows = (p?.administrations ?? [])
      .filter(
        (a) =>
          a.orderId === orderId &&
          !a.voided &&
          a.action === "given" &&
          new Date(a.chartedAt).getTime() >= since,
      )
      .sort((a, b) => b.chartedAt.localeCompare(a.chartedAt));
    return {
      given: rows.length,
      max,
      lastGivenAt: rows[0]?.chartedAt,
      blocked: max !== undefined && rows.length >= max,
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
        if (elig.blocked)
          throw new Error(
            `PRN limit reached — ${elig.given}/${elig.max} given in the last 24h.`,
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
  listRefusalForms(
    patientId: string,
    opts?: { status?: RefusalForm["status"] },
  ): RefusalForm[] {
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
      detail: { language: lang, fromVersion: previous, toVersion: review.draftVersion, reason: why },
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
    input: { name: string; kind: FacilityKind; city?: string; timezone?: string },
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
    patch: { name?: string; kind?: FacilityKind; city?: string; timezone?: string },
    staffName: string,
  ): Facility {
    const row = facilities.find((f) => f.id === facilityId);
    if (!row) throw new Error("Facility not found.");
    if (patch.name !== undefined) AdelanteEHR.renameFacility(facilityId, patch.name, staffName);
    const before = { kind: row.kind, city: row.city ?? null, timezone: row.timezone ?? null };
    if (patch.kind !== undefined) row.kind = patch.kind;
    if (patch.city !== undefined) row.city = patch.city.trim() || undefined;
    if (patch.timezone !== undefined) row.timezone = patch.timezone.trim() || undefined;
    appendAudit({
      category: "clinical",
      action: "facility_updated",
      actorId: staffName,
      detail: {
        facilityId,
        before,
        after: { kind: row.kind, city: row.city ?? null, timezone: row.timezone ?? null },
      },
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
    return rows.sort((a, b) => a.administration.chartedAt.localeCompare(b.administration.chartedAt));
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
      const doseLabel = order.strengthText || (order.doseTargetMg ? `${order.doseTargetMg} mg` : "—");
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
    return shiftCounts.slice(0, limit).map((c) => ({ ...c, lines: c.lines.map((l) => ({ ...l })) }));
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
