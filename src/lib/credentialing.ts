// 27 Oct (Mitch) — clinician credentialing: record, verification, exclusion
// monitoring, payer enrollment and the ONE "credentialed for this service"
// rule. Draft — pending the go-live permissions audit and compliance review.
// Governing rule for county MHP / DMC-ODS: DHCS MHSUDS Information Notice
// 18-019.
//
// Why this exists: the billing-readiness check "rendering clinician
// credentialed" used to read the free-text `credential` string on the staff
// row ("LCSW", "M.D."). A clearinghouse never checks credentialing (it does
// eligibility 270/271 and claims 837/835), so credentialing needs its own
// record, verification and monitoring.
//
// Boundaries:
//  • This module never imports ehr.ts / ehr-ext.ts (they import THIS module
//    for the booking block and readiness rule). Appointments and claims reach
//    the derivations as parameters.
//  • Every runtime mutation is a registry action (chartActions.ts) with one
//    audit row; the store functions below re-check the same role gate so the
//    store and the button can never disagree.
//  • Document uploads stay Simulated until secure storage exists (phase 5):
//    this record carries document STATUS only, never files.
//  • Non-manual monitor channels are disabled and Simulated, switchable by
//    configuration only. CVO delegation is allowed per IN 18-019, but
//    Adelante stays responsible.

import { useSyncExternalStore } from "react";
import { STAFF_ROSTER, getStaffMember, type StaffRole } from "./roles";
import { canAssistCredentials } from "./credentialAccess";
import { ADELANTE_POLICY_LABEL, fundingRequiresEnrollment, isAdelantePolicySource, type FundingFlag, type FundingSource } from "./fundingSource";

export const CREDENTIALING_DRAFT_LABEL = "Draft — pending go-live permissions audit and compliance review";

/** Draft settings — the cadence is to be confirmed against the Tulare and Kings county contracts. */
export const CREDENTIALING_DRAFT = {
  label: CREDENTIALING_DRAFT_LABEL,
  /** Exclusion-list re-check cadence (OIG / SAM.gov / Medi-Cal S&I). Default monthly. */
  exclusionCadenceDays: 30,
  /** Re-credentialing interval — every 3 years at most. */
  recredentialingYears: 3,
  /** Coordinator task thresholds before an expiry. */
  expiryTaskThresholdsDays: [90, 60, 30] as const,
  /** The clinician's own neutral heads-up. */
  clinicianHeadsUpDays: 30,
} as const;

// ---------------------------------------------------------------- types

export type VerificationSource = "bbs" | "medical_board_ca" | "brn" | "county_registry" | "other";

export interface LicenseRecord {
  licenseType: string;
  number: string;
  state: string;
  issuedAt?: string;
  expiresAt?: string;
  verificationSource?: VerificationSource;
  verifiedAt?: string;
  verifiedBy?: string;
  /** Manual lookup only for now; other channels are monitor-adapter work. */
  method: "manual";
}

export interface SupervisionRecord {
  supervisorStaffId: string;
  start: string;
  end?: string;
}

/** Registered associates and trainees (AMFT, ASW, APCC, SUDCC, …). */
export interface RegistrationRecord {
  registrationType: string;
  number: string;
  expiresAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  supervision?: SupervisionRecord;
}

export type ExclusionList = "oig" | "sam_gov" | "medi_cal_suspended";
export const EXCLUSION_LISTS: { key: ExclusionList; label: string }[] = [
  { key: "oig", label: "OIG exclusion list" },
  { key: "sam_gov", label: "SAM.gov" },
  { key: "medi_cal_suspended", label: "Medi-Cal Suspended & Ineligible Provider List" },
];

export interface ExclusionCheck {
  list: ExclusionList;
  checkedAt: string;
  result: "clear" | "hit";
  nextDueAt: string;
}

/** Signed attestation per DHCS MHSUDS IN 18-019. */
export interface Attestation18019 {
  status: "signed" | "pending";
  signedAt?: string;
  signedBy?: string;
  covers: {
    limitationsAffectingJobFunctions: boolean;
    licenseLossOrFelonyHistory: boolean;
    privilegeLossOrDiscipline: boolean;
    noPresentIllegalDrugUse: boolean;
    accuracyAndCompleteness: boolean;
  };
}

export type ServiceEnrollmentStatus = "not_started" | "submitted" | "active" | "inactive";

export const ENROLLMENT_STATUS_LABEL: Record<ServiceEnrollmentStatus, string> = {
  not_started: "Not started",
  submitted: "Submitted",
  active: "Active",
  inactive: "Inactive",
};
export const enrollmentStatusLabel = (s: ServiceEnrollmentStatus) => ENROLLMENT_STATUS_LABEL[s];

export interface ServicePayerEnrollment {
  payer: string;
  /** Service type id, or "*" for every service type with that payer. */
  serviceType: string;
  status: ServiceEnrollmentStatus;
  effectiveAt?: string;
  /** CAQH ProView ID for commercial enrollment. */
  caqhId?: string;
}

export type CredentialDocumentStatus = "on_file" | "pending" | "simulated_unavailable";

export interface ClinicianCredentialing {
  staffId: string;
  clinicianId?: string;
  license?: LicenseRecord;
  registration?: RegistrationRecord;
  npi?: string;
  dea?: { number: string; expiresAt?: string; verifiedAt?: string };
  boardCertification?: string;
  malpractice?: { carrier: string; policy: string; expiresAt?: string };
  /** Education/training and continuing-education status — attested for now. */
  educationAttestedAt?: string;
  ceAttestedAt?: string;
  exclusionChecks: ExclusionCheck[];
  attestation?: Attestation18019;
  enrollments: ServicePayerEnrollment[];
  recredentialingDueAt?: string;
  documentStatus: CredentialDocumentStatus;
  /**
   * 29 Oct (Mitch) — billable roles without a clinical license. Draft —
   * confirm with compliance. Checked only when the service is billable for
   * the resolved funding source; non-billable peer/CHW work is never blocked.
   */
  peerCertification?: { number: string; issuingBody: string; issuedAt?: string; expiresAt?: string; verifiedAt?: string };
  chwQualification?: { kind: "certificate" | "experience_attestation"; number?: string; issuingBody?: string; issuedAt?: string; expiresAt?: string; attestedAt?: string };
  /** Supervising provider on file (peer: supervising provider; CHW: supervising licensed provider). */
  supervisingProviderStaffId?: string;
  ecmTraining?: { attestedAt: string; expiresAt?: string };
  /** Seed rows are demo data; runtime rows come through registry actions. */
  seed?: boolean;
}

/** Urgent neutral notice for the clinical coordinator and sys_admin (exclusion hit). Ids only. */
export interface CredentialingNotice {
  id: string;
  kind: "exclusion_hit";
  staffId: string;
  at: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

// ---------------------------------------------------------------- the ONE rule

export type CredentialingReasonCode =
  | "payer_missing"
  | "service_missing"
  | "no_record"
  | "license_missing"
  | "license_not_verified"
  | "license_expired"
  | "registration_not_verified"
  | "registration_expired"
  | "exclusion_hit"
  | "exclusion_check_overdue"
  | "payer_not_enrolled"
  | "supervision_missing"
  | "supervision_expired"
  | "dea_not_verified"
  | "dea_expired"
  // 29 Oct — billable roles without a clinical license (Draft, confirm with compliance).
  | "peer_certification_missing"
  | "peer_certification_expired"
  | "chw_qualification_missing"
  | "chw_qualification_expired"
  | "supervising_provider_missing"
  | "ecm_training_missing"
  | "ecm_contract_missing";

/** Neutral reason labels — safe for Billing and the Credentialing Coordinator. */
export const CREDENTIALING_REASON_LABEL: Record<CredentialingReasonCode, string> = {
  payer_missing: "Payer not recorded — needs review",
  service_missing: "Service type not recorded — needs review",
  no_record: "No credentialing record on file",
  license_missing: "No license or registration on file",
  license_not_verified: "License not verified",
  license_expired: "License expired before the date of service",
  registration_not_verified: "Registration not verified",
  registration_expired: "Registration expired before the date of service",
  exclusion_hit: "Exclusion-list check returned a match",
  exclusion_check_overdue: "Exclusion-list check is overdue",
  payer_not_enrolled: "Not enrolled with this payer for this service",
  supervision_missing: "No supervision record on file",
  supervision_expired: "Supervision record not active on the date of service",
  dea_not_verified: "DEA registration not verified on the date of service",
  dea_expired: "DEA registration expired or expiry not recorded on the date of service",
  peer_certification_missing: "Peer Support Specialist certification not on file",
  peer_certification_expired: "Peer Support Specialist certification expired before the date of service",
  chw_qualification_missing: "CHW certificate or experience attestation not on file",
  chw_qualification_expired: "CHW certificate expired before the date of service",
  supervising_provider_missing: "No supervising provider on file",
  ecm_training_missing: "ECM training attestation not on file",
  ecm_contract_missing: "No organization ECM contract with this plan",
};

/** Draft — confirm with compliance. Each requirement for billable roles without a clinical license. */
export const UNLICENSED_ROLE_REQUIREMENTS_DRAFT = {
  label: "Draft — confirm with compliance",
  peer_specialist: ["Medi-Cal Peer Support Specialist certification (number, issuing body, issue and expiry dates)", "Supervising provider on file"],
  community_health_worker: ["CHW certificate or qualifying-experience attestation", "Supervising licensed provider on file"],
  ecm_provider: ["Required ECM training attestation", "Organization ECM contract with that plan (organization level, per plan)"],
} as const;
export type UnlicensedBillableRole = keyof Omit<typeof UNLICENSED_ROLE_REQUIREMENTS_DRAFT, "label">;
export const isUnlicensedBillableRole = (role?: string): role is UnlicensedBillableRole =>
  role === "peer_specialist" || role === "community_health_worker" || role === "ecm_provider";

/** Organization-level ECM contracts per plan (Draft, fictional demo rows). */
export const ECM_ORG_CONTRACTS_DRAFT: { payer: string; status: "active" | "pending"; effectiveAt?: string }[] = [
  { payer: "Health Net Medi-Cal", status: "active", effectiveAt: "2025-01-01" },
  { payer: "Anthem Blue Cross Medi-Cal", status: "pending" },
];

/** Reason label; private-pay and grant visits say exclusion screening is Adelante policy. */
export function credentialingReasonLabel(code: CredentialingReasonCode, source?: FundingSource): string {
  const base = CREDENTIALING_REASON_LABEL[code];
  return isAdelantePolicySource(source) && (code === "exclusion_hit" || code === "exclusion_check_overdue") ? `${base} — ${ADELANTE_POLICY_LABEL}` : base;
}

/** The label every other role sees — never the reasons. */
export const CREDENTIALING_NEUTRAL_LABEL = "Credentialing — needs review";

/**
 * Billable service types (Draft). Non-billable support work (peer support,
 * case management, care coordination) is never blocked by credentialing.
 */
export const BILLABLE_SERVICE_TYPES: readonly string[] = [
  "intake",
  "therapy_individual",
  "therapy_group",
  "med_management",
  "controlled_med_moud",
  "sud_counseling",
  "sud_group_odf",
  "sud_group_iot",
];
export const isBillableServiceType = (s?: string) => !!s && BILLABLE_SERVICE_TYPES.includes(s);

// The existing EHR service catalog owns this Draft classification. Registration
// avoids importing the EHR store back into its credentialing evaluator.
let serviceRequiresDea: (serviceType?: string) => boolean = () => false;
export function registerCredentialingServiceCatalog(read: (serviceType?: string) => boolean): void {
  serviceRequiresDea = read;
}

export interface CredentialingCheckInput {
  /** Payer name; the enrollment check runs only when a payer is known. */
  payer?: string;
  /** Service type id; the enrollment check runs only when a service type is known. */
  serviceType?: string;
  /** ISO date/datetime of the service. */
  dateOfService: string;
  /**
   * 28 Oct fix (Mitch, Draft): the moment exclusion screening is judged.
   * Booking passes now; billing readiness passes the date of service.
   * Omitted = the date of service (historical mode).
   */
  asOf?: string;
  /**
   * 29 Oct (Mitch, Draft): the resolved funding source for this appointment.
   * When present it decides which checks run; omitted = the earlier
   * payer-string behaviour (kept for existing callers).
   */
  fundingSource?: FundingSource;
}

/** Neutral Billing flags the rule raises without blocking. */
export type CredentialingFlag = Extract<FundingFlag, "out_of_network_review" | "medicare_review">;
export type CredentialingCheckResult =
  | { ok: true; flags?: CredentialingFlag[] }
  | { ok: false; reasons: CredentialingReasonCode[]; flags?: CredentialingFlag[] };

const dayMs = 86400_000;
const asDay = (iso: string) => Math.floor(+new Date(iso) / dayMs);

function supervisionActiveOn(s: SupervisionRecord | undefined, dos: string): boolean {
  if (!s) return false;
  const d = asDay(dos);
  if (asDay(s.start) > d) return false;
  if (s.end && asDay(s.end) < d) return false;
  return true;
}

/**
 * THE rule (pure). On the date of service the clinician must have:
 *  • a verified license or registration that hadn't expired;
 *  • no exclusion hit, with the last check on every list not overdue;
 *  • active enrollment with that payer for that service type (when known);
 *  • for associates and trainees, an active supervision record.
 */
export function evaluateCredentialing(
  record: ClinicianCredentialing | undefined,
  input: CredentialingCheckInput,
): CredentialingCheckResult {
  const reasons: CredentialingReasonCode[] = [];
  const flags: CredentialingFlag[] = [];
  // 29 Oct: non-billable services get no credential check (role gates still apply upstream).
  if (input.fundingSource === "non_billable") return { ok: true };
  if (!record) return { ok: false, reasons: ["no_record"] };
  const dos = input.dateOfService;
  const d = asDay(dos);
  const staffRole = getStaffMember(record.staffId)?.role;
  const unlicensed = !record.license && !record.registration && isUnlicensedBillableRole(staffRole);

  // License or registration, verified and unexpired on the date of service.
  if (unlicensed) {
    // 29 Oct (Draft — confirm with compliance): role credentials replace the license.
    const notExpired = (e?: string) => !e || asDay(e) >= d;
    if (staffRole === "peer_specialist") {
      const c = record.peerCertification;
      if (!c?.number.trim() || !c.issuingBody.trim()) reasons.push("peer_certification_missing");
      else if (!notExpired(c.expiresAt)) reasons.push("peer_certification_expired");
      if (!record.supervisingProviderStaffId) reasons.push("supervising_provider_missing");
    } else if (staffRole === "community_health_worker") {
      const q = record.chwQualification;
      if (!q || (q.kind === "certificate" ? !q.number?.trim() : !q.attestedAt)) reasons.push("chw_qualification_missing");
      else if (q.kind === "certificate" && !notExpired(q.expiresAt)) reasons.push("chw_qualification_expired");
      if (!record.supervisingProviderStaffId) reasons.push("supervising_provider_missing");
    } else if (staffRole === "ecm_provider") {
      if (!record.ecmTraining?.attestedAt || !notExpired(record.ecmTraining.expiresAt)) reasons.push("ecm_training_missing");
      const contract = ECM_ORG_CONTRACTS_DRAFT.some((k) => k.payer === input.payer && k.status === "active" && (!k.effectiveAt || asDay(k.effectiveAt) <= d));
      if (!contract) reasons.push("ecm_contract_missing");
    }
  } else if (record.license) {
    if (!record.license.verifiedAt || asDay(record.license.verifiedAt) > d) reasons.push("license_not_verified");
    if (record.license.expiresAt && asDay(record.license.expiresAt) < d) reasons.push("license_expired");
  } else if (record.registration) {
    if (!record.registration.verifiedAt || asDay(record.registration.verifiedAt) > d) reasons.push("registration_not_verified");
    if (record.registration.expiresAt && asDay(record.registration.expiresAt) < d) reasons.push("registration_expired");
  } else {
    reasons.push("license_missing");
  }

  // 28 Oct carry-over: prescribers require verified, dated DEA evidence only
  // for explicitly controlled-substance services. Never infer from SUD status.
  const role = getStaffMember(record.staffId)?.role;
  if (serviceRequiresDea(input.serviceType) && (role === "pmhnp" || role === "physician")) {
    if (!record.dea?.number.trim() || !record.dea.verifiedAt || !Number.isFinite(asDay(record.dea.verifiedAt)) || asDay(record.dea.verifiedAt) > d) reasons.push("dea_not_verified");
    if (!record.dea?.expiresAt || !Number.isFinite(asDay(record.dea.expiresAt)) || asDay(record.dea.expiresAt) < d) reasons.push("dea_expired");
  }

  // 28 Oct fix: exclusion screening is judged as of `asOf` (never requires a
  // check that hasn't happened yet); end-dated items stay on the date of service.
  const x = input.asOf ? asDay(input.asOf) : d;
  for (const { key } of EXCLUSION_LISTS) {
    const latest = record.exclusionChecks
      .filter((c) => c.list === key && asDay(c.checkedAt) <= x)
      .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0];
    if (!latest) reasons.push("exclusion_check_overdue");
    else if (latest.result === "hit") reasons.push("exclusion_hit");
    else if (asDay(latest.nextDueAt) < x) reasons.push("exclusion_check_overdue");
  }

  // 29 Oct: payer enrollment only where the funding source requires it.
  const enrollment = input.fundingSource ? (unlicensed ? "none" : fundingRequiresEnrollment(input.fundingSource)) : "required";
  const enrolledFor = () => {
    const specific = record.enrollments.some((e) => e.payer === input.payer && e.serviceType === input.serviceType);
    return record.enrollments.some(
      (e) =>
        e.payer === input.payer &&
        (specific ? e.serviceType === input.serviceType : e.serviceType === "*" || e.serviceType === input.serviceType) &&
        e.status === "active" &&
        (!e.effectiveAt || asDay(e.effectiveAt) <= d),
    );
  };
  // 28 Oct credentialing reconciliation: unknown facts cannot silently pass.
  if (enrollment === "required" && !input.payer) reasons.push("payer_missing");
  if (!input.serviceType) reasons.push("service_missing");
  if (enrollment === "in_network_flag") {
    if (!input.payer || !input.serviceType || !enrolledFor()) flags.push("out_of_network_review");
  } else if (enrollment === "review_flag") {
    flags.push("medicare_review");
  }
  if (enrollment === "required" && input.payer && input.serviceType) {
    // 28 Oct MOUD service type: a service-specific row for this payer takes
    // precedence over the payer-wide "*" row, so "not started" is never overridden.
    const specific = record.enrollments.some((e) => e.payer === input.payer && e.serviceType === input.serviceType);
    const enrolled = record.enrollments.some(
      (e) =>
        e.payer === input.payer &&
        (specific ? e.serviceType === input.serviceType : e.serviceType === "*" || e.serviceType === input.serviceType) &&
        e.status === "active" &&
        (!e.effectiveAt || asDay(e.effectiveAt) <= d),
    );
    if (!enrolled) reasons.push("payer_not_enrolled");
  }

  // Associates and trainees need an active supervision record.
  if (record.registration && !record.license) {
    if (!record.registration.supervision) reasons.push("supervision_missing");
    else if (!supervisionActiveOn(record.registration.supervision, dos)) reasons.push("supervision_expired");
  }

  const f = flags.length ? { flags } : {};
  return reasons.length ? { ok: false, reasons, ...f } : { ok: true, ...f };
}

// ---------------------------------------------------------------- store

// 28 Oct credentialing reconciliation: ehr-ext self-registers the sole authority.
export interface CredentialingAuthority {
  list(): ClinicianCredentialing[];
  write(staffId: string, change: (record: ClinicianCredentialing) => void): ClinicianCredentialing;
  subscribe(listener: () => void): () => void;
  auditTransition?(staffId: string, actor: CredentialingActor, blocked: boolean): void;
}
let authority: CredentialingAuthority | undefined;
export function registerCredentialingAuthority(source: CredentialingAuthority) {
  authority = source;
  source.subscribe(emit);
}

const notices: CredentialingNotice[] = [];

let version = 0;
const listeners = new Set<() => void>();
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
/** React hook — same version-counter pattern as useEhrExt. */
export function useCredentialing<T>(selector: () => T): T {
  useSyncExternalStore(subscribe, () => version, () => version);
  return selector();
}

const iso = () => new Date().toISOString();
const uid = () => `cred-${Math.random().toString(36).slice(2, 10)}`;

export function credentialingRecordForStaff(staffId: string | undefined): ClinicianCredentialing | undefined {
  return staffId ? listCredentialingRecords().find((r) => r.staffId === staffId) : undefined;
}
export function credentialingRecordForClinician(clinicianId: string | undefined): ClinicianCredentialing | undefined {
  return clinicianId ? listCredentialingRecords().find((r) => r.clinicianId === clinicianId) : undefined;
}
export function listCredentialingRecords(): ClinicianCredentialing[] {
  return authority?.list() ?? [];
}
export function listCredentialingNotices(): CredentialingNotice[] {
  return notices;
}

/** Store-reading wrapper matching the spec signature. */
export function credentialedForService(
  staffId: string,
  payer: string | undefined,
  serviceType: string | undefined,
  dateOfService: string,
  opts: { asOf?: string; fundingSource?: FundingSource } = {},
): CredentialingCheckResult {
  const asOf = opts.asOf ?? new Date().toISOString();
  return evaluateCredentialing(credentialingRecordForStaff(staffId), { payer, serviceType, dateOfService, asOf, ...(opts.fundingSource ? { fundingSource: opts.fundingSource } : {}) });
}

// 28 Oct fix: ehr self-registers its booked visits so the coordinator tile can
// show checks falling due before them (no ehr import here — avoids a cycle).
let bookedVisitSource: (() => AppointmentLike[]) | undefined;
export function registerBookedVisitSource(source: () => AppointmentLike[]) {
  bookedVisitSource = source;
}

// ---------------------------------------------------------------- guards

export interface CredentialingActor {
  role: StaffRole;
  staffId?: string;
}

export const CREDENTIALING_DENIED = "Credentialing work is owned by the credentialing coordinator.";

/** The store-level gate — the SAME check the registry actions use. */
export function canManageCredentialing(role: StaffRole): boolean {
  return canAssistCredentials(role);
}

function assertCredentialing(actor: CredentialingActor) {
  if (!canManageCredentialing(actor.role)) throw new Error(CREDENTIALING_DENIED);
}

function writeRecord(actor: CredentialingActor, staffId: string, change: (record: ClinicianCredentialing) => void) {
  if (!authority) throw new Error("Credential records are not ready.");
  const before = blockedClinicians().some(r => r.staffId === staffId);
  const record = authority.write(staffId, change);
  const after = blockedClinicians().some(r => r.staffId === staffId);
  if (before !== after) authority.auditTransition?.(staffId, actor, after);
  return record;
}

// ---------------------------------------------------------------- mutations
// Each is wrapped by a registry action (one audit row). The role gate here
// matches the registry `allowed()` exactly.

export function upsertLicense(actor: CredentialingActor, staffId: string, license: LicenseRecord): ClinicianCredentialing {
  assertCredentialing(actor);
  return writeRecord(actor, staffId, (r) => {
  r.license = license;
  });
}

export function recordVerification(
  actor: CredentialingActor,
  staffId: string,
  input: { source: VerificationSource; at?: string },
): ClinicianCredentialing {
  assertCredentialing(actor);
  return writeRecord(actor, staffId, (r) => {
  const target = r.license ?? r.registration;
  if (!target) throw new Error("There is no license or registration on file to verify.");
  const at = input.at ?? iso();
  if (r.license) {
    r.license = { ...r.license, verifiedAt: at, verifiedBy: actor.staffId ?? actor.role, verificationSource: input.source };
  } else if (r.registration) {
    r.registration = { ...r.registration, verifiedAt: at, verifiedBy: actor.staffId ?? actor.role };
  }
  });
}

export function recordExclusionCheck(
  actor: CredentialingActor,
  staffId: string,
  input: { list: ExclusionList; result: "clear" | "hit"; checkedAt?: string },
): ClinicianCredentialing {
  assertCredentialing(actor);
  return writeRecord(actor, staffId, (r) => {
  const checkedAt = input.checkedAt ?? iso();
  const nextDueAt = new Date(+new Date(checkedAt) + CREDENTIALING_DRAFT.exclusionCadenceDays * dayMs).toISOString();
  r.exclusionChecks = [...r.exclusionChecks, { list: input.list, checkedAt, result: input.result, nextDueAt }];
  if (input.result === "hit") {
    // Urgent, neutral, ids-only: the clinical coordinator and sys_admin see
    // this notice; the audit row comes from the registry action.
    notices.push({ id: uid(), kind: "exclusion_hit", staffId, at: checkedAt });
  }
  });
}

export function acknowledgeCredentialingNotice(actor: CredentialingActor, noticeId: string): void {
  if (actor.role !== "clinical_coordinator" && actor.role !== "sys_admin")
    throw new Error("Only the clinical coordinator or a system administrator can acknowledge this.");
  const n = notices.find((x) => x.id === noticeId);
  if (!n || n.acknowledgedAt) return;
  n.acknowledgedAt = iso();
  n.acknowledgedBy = actor.staffId ?? actor.role;
  emit();
}

export function setServiceEnrollment(
  actor: CredentialingActor,
  staffId: string,
  input: { payer: string; serviceType: string; status: ServiceEnrollmentStatus; effectiveAt?: string; caqhId?: string },
): ClinicianCredentialing {
  assertCredentialing(actor);
  return writeRecord(actor, staffId, (r) => {
  const i = r.enrollments.findIndex((e) => e.payer === input.payer && e.serviceType === input.serviceType);
  const row: ServicePayerEnrollment = {
    payer: input.payer,
    serviceType: input.serviceType,
    status: input.status,
    ...(input.effectiveAt ? { effectiveAt: input.effectiveAt } : {}),
    ...(input.caqhId ? { caqhId: input.caqhId } : {}),
  };
  if (i >= 0) r.enrollments[i] = row;
  else r.enrollments.push(row);
  });
}

export function recordAttestation(
  actor: CredentialingActor,
  staffId: string,
  input: { covers: Attestation18019["covers"]; signedAt?: string },
): ClinicianCredentialing {
  assertCredentialing(actor);
  return writeRecord(actor, staffId, (r) => {
  const all = Object.values(input.covers).every(Boolean);
  r.attestation = {
    status: all ? "signed" : "pending",
    signedAt: all ? (input.signedAt ?? iso()) : undefined,
    signedBy: all ? (actor.staffId ?? actor.role) : undefined,
    covers: input.covers,
  };
  });
}

// 28 Oct credentialing reconciliation: extended fields write through the same authority.
export function updateCredentialingProfile(actor: CredentialingActor, staffId: string, patch: Partial<ClinicianCredentialing>) {
  assertCredentialing(actor);
  return writeRecord(actor, staffId, r => Object.assign(r, patch, { staffId: r.staffId, clinicianId: r.clinicianId }));
}

// ---------------------------------------------------------------- monitor adapter (Simulated)

export type CredentialMonitorChannel = "manual" | "vendor" | "exclusion_file" | "cvo";

export interface CredentialMonitorAdapter {
  channel: CredentialMonitorChannel;
  label: string;
  enabled: boolean;
  simulated: boolean;
  note: string;
}

/**
 * Channel configuration. Manual is the only live channel: the coordinator
 * records what they verified. Everything else is disabled and Simulated,
 * switchable by configuration only. CVO delegation is permitted by IN 18-019;
 * Adelante remains responsible for the result.
 */
export const MONITOR_CHANNELS: readonly CredentialMonitorAdapter[] = [
  { channel: "manual", label: "Manual lookup", enabled: true, simulated: false, note: "The coordinator records what they verified on the source site." },
  { channel: "vendor", label: "Monitoring vendor", enabled: false, simulated: true, note: "Simulated — no vendor is connected." },
  { channel: "exclusion_file", label: "Exclusion-list file check", enabled: false, simulated: true, note: "Simulated — OIG and Medi-Cal publish downloadable lists; SAM.gov has an API. None are connected." },
  { channel: "cvo", label: "CVO continuous monitoring", enabled: false, simulated: true, note: "Simulated — delegation to a credentialing verification organization is allowed per IN 18-019; Adelante stays responsible." },
] as const;

export function monitorChannel(channel: CredentialMonitorChannel): CredentialMonitorAdapter {
  return MONITOR_CHANNELS.find((c) => c.channel === channel) ?? MONITOR_CHANNELS[0];
}

/** Running a non-manual channel is a simulated no-op until a real adapter exists. */
export function runMonitorChannel(
  actor: CredentialingActor,
  channel: CredentialMonitorChannel,
): { ok: true; simulated: boolean; note: string } {
  assertCredentialing(actor);
  const adapter = monitorChannel(channel);
  if (channel === "manual") throw new Error("Manual checks are recorded on the clinician's record, not run.");
  return { ok: true, simulated: true, note: adapter.note };
}

// ---------------------------------------------------------------- derivations (Today work)

export interface ExpiringItem {
  staffId: string;
  item: string;
  expiresAt: string;
  daysLeft: number;
  threshold: (typeof CREDENTIALING_DRAFT.expiryTaskThresholdsDays)[number];
}

/** License / registration / DEA / malpractice expiries crossing the 90/60/30 thresholds. */
export function expiringItems(now: Date = new Date()): ExpiringItem[] {
  const today = asDay(now.toISOString());
  const out: ExpiringItem[] = [];
  for (const r of listCredentialingRecords()) {
    const candidates: { item: string; expiresAt?: string }[] = [
      { item: "License", expiresAt: r.license?.expiresAt },
      { item: "Registration", expiresAt: r.registration?.expiresAt },
      { item: "DEA registration", expiresAt: r.dea?.expiresAt },
      { item: "Malpractice coverage", expiresAt: r.malpractice?.expiresAt },
    ];
    for (const c of candidates) {
      if (!c.expiresAt) continue;
      const daysLeft = asDay(c.expiresAt) - today;
      if (daysLeft < 0) continue; // expired rows fail the rule itself; they are not "expiring"
      // Tightest crossed threshold: 25 days left → 30, 80 days left → 90.
      const threshold = [...CREDENTIALING_DRAFT.expiryTaskThresholdsDays].sort((a, b) => a - b).find((t) => daysLeft <= t);
      if (threshold !== undefined) out.push({ staffId: r.staffId, item: c.item, expiresAt: c.expiresAt, daysLeft, threshold });
    }
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

export interface ExclusionDueRow {
  staffId: string;
  list: ExclusionList;
  state: "due" | "overdue" | "never" | "before_visits";
  nextDueAt?: string;
  /** Booked billable visits dated after the check falls due (count only). */
  visitsAfterDue?: number;
}

export function exclusionChecksDue(now: Date = new Date()): ExclusionDueRow[] {
  const today = asDay(now.toISOString());
  const out: ExclusionDueRow[] = [];
  for (const r of listCredentialingRecords()) {
    for (const { key } of EXCLUSION_LISTS) {
      const latest = r.exclusionChecks.filter((c) => c.list === key).sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0];
      if (!latest) out.push({ staffId: r.staffId, list: key, state: "never" });
      else if (asDay(latest.nextDueAt) < today) out.push({ staffId: r.staffId, list: key, state: "overdue", nextDueAt: latest.nextDueAt });
      else {
        const due = asDay(latest.nextDueAt);
        const visitsAfterDue = r.clinicianId
          ? (bookedVisitSource?.() ?? []).filter(
              (a) => a.clinicianId === r.clinicianId && a.status === "scheduled" && isBillableServiceType(a.serviceType) && asDay(a.start) > due,
            ).length
          : 0;
        if (visitsAfterDue > 0) out.push({ staffId: r.staffId, list: key, state: "before_visits", nextDueAt: latest.nextDueAt, visitsAfterDue });
        else if (due - today <= 7) out.push({ staffId: r.staffId, list: key, state: "due", nextDueAt: latest.nextDueAt });
      }
    }
  }
  return out;
}

export function recredentialingDue(now: Date = new Date()): { staffId: string; dueAt: string; daysLeft: number }[] {
  const today = asDay(now.toISOString());
  return listCredentialingRecords()
    .filter((r) => r.recredentialingDueAt)
    .map((r) => ({ staffId: r.staffId, dueAt: r.recredentialingDueAt!, daysLeft: asDay(r.recredentialingDueAt!) - today }))
    .filter((r) => r.daysLeft <= 90)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export function enrollmentsPending(): { staffId: string; payer: string; serviceType: string; status: ServiceEnrollmentStatus }[] {
  const out: { staffId: string; payer: string; serviceType: string; status: ServiceEnrollmentStatus }[] = [];
  for (const r of listCredentialingRecords())
    for (const e of r.enrollments)
      if (e.status === "submitted" || e.status === "not_started")
        out.push({ staffId: r.staffId, payer: e.payer, serviceType: e.serviceType, status: e.status });
  return out;
}

export interface BlockedClinician {
  staffId: string;
  payer: string;
  serviceType: string;
  reasons: CredentialingReasonCode[];
}

/**
 * Clinicians currently failing the rule for a billable service they would
 * otherwise render. Evaluated per active enrollment payer (or "no payer on
 * file" when none), for every billable service type.
 */
export function blockedClinicians(now: Date = new Date()): BlockedClinician[] {
  const dos = now.toISOString();
  const out: BlockedClinician[] = [];
  for (const r of listCredentialingRecords()) {
    const member = getStaffMember(r.staffId);
    if (!member?.clinicianId) continue;
    const payers = [...new Set(r.enrollments.filter((e) => e.status === "active").map((e) => e.payer))];
    for (const payer of payers.length ? payers : [undefined]) {
      for (const serviceType of BILLABLE_SERVICE_TYPES) {
        const res = evaluateCredentialing(r, { payer, serviceType, dateOfService: dos });
        if (!res.ok) out.push({ staffId: r.staffId, payer: payer ?? "No payer on file", serviceType, reasons: res.reasons });
      }
    }
  }
  return out;
}

/** The 4–6 Today tiles for the Credentialing Coordinator. */
export function credentialingTiles(now: Date = new Date()) {
  const expiring = expiringItems(now);
  const exclusions = exclusionChecksDue(now);
  const recred = recredentialingDue(now);
  const pending = enrollmentsPending();
  const blocked = blockedClinicians(now);
  return [
    { key: "expiring", label: "Expiring soon", count: expiring.length, items: expiring },
    { key: "exclusions", label: "Exclusion checks due", count: exclusions.length, items: exclusions },
    { key: "recredentialing", label: "Re-credentialing due", count: recred.length, items: recred },
    { key: "enrollment", label: "Payer enrollment pending", count: pending.length, items: pending },
    { key: "blocked", label: "Blocked clinicians", count: new Set(blocked.map((b) => b.staffId)).size, items: blocked },
  ] as const;
}

/** The clinician's own neutral heads-up at 30 days — never the reasons of others. */
export function clinicianCredentialNotices(staffId: string, now: Date = new Date()): string[] {
  return expiringItems(now)
    .filter((i) => i.staffId === staffId && i.daysLeft <= CREDENTIALING_DRAFT.clinicianHeadsUpDays)
    .map((i) => `Your ${i.item.toLowerCase()} expires on ${i.expiresAt.slice(0, 10)}. The credentialing coordinator has been notified.`);
}

// ---------------------------------------------------------------- review flags (derived, never mutating)

interface AppointmentLike {
  id: string;
  clinicianId: string;
  patientId: string;
  start: string;
  status: string;
  serviceType?: string;
}
interface ClaimLike {
  id: string;
  clinicianId: string;
  patientId: string;
  serviceDate?: string;
  state: string;
  serviceType?: string;
}

export interface CredentialingReviewFlag {
  kind: "appointment" | "claim";
  id: string;
  staffId: string;
  reasons: CredentialingReasonCode[];
}

/**
 * Existing appointments and claims whose rendering clinician currently fails
 * the rule — flagged for Billing review, NEVER cancelled, deleted or changed.
 * Pure: callers pass the store rows in.
 */
export function credentialingReviewFlags(
  appointments: AppointmentLike[],
  claims: ClaimLike[],
  payerForPatient: (patientId: string) => string | undefined,
): CredentialingReviewFlag[] {
  const out: CredentialingReviewFlag[] = [];
  for (const a of appointments) {
    if (a.status !== "scheduled" || !isBillableServiceType(a.serviceType)) continue;
    const member = STAFF_ROSTER.find((s) => s.clinicianId === a.clinicianId);
    if (!member) continue;
    // 28 Oct fix: judged as of now until the visit day, then on the visit day — flag, never cancel.
    const now = new Date().toISOString();
    const res = credentialedForService(member.id, payerForPatient(a.patientId), a.serviceType, a.start, { asOf: a.start < now ? a.start : now });
    if (!res.ok) out.push({ kind: "appointment", id: a.id, staffId: member.id, reasons: res.reasons });
  }
  for (const c of claims) {
    if (c.state === "void" || c.state === "paid") continue;
    const member = STAFF_ROSTER.find((s) => s.clinicianId === c.clinicianId);
    if (!member) continue;
    // Billing readiness: exclusion judged on the date of service (unchanged mode).
    const res = credentialedForService(member.id, payerForPatient(c.patientId), c.serviceType, c.serviceDate ?? "", { asOf: c.serviceDate ?? "" });
    if (!res.ok) out.push({ kind: "claim", id: c.id, staffId: member.id, reasons: res.reasons });
  }
  return out;
}

/** Count-only projection — the Credentialing Coordinator may see HOW MANY claims are affected, never claim details. */
export function affectedClaimCount(staffId: string, claims: ClaimLike[], payerForPatient: (patientId: string) => string | undefined): number {
  return credentialingReviewFlags([], claims, payerForPatient).filter((f) => f.staffId === staffId).length;
}

