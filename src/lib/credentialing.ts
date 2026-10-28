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
  dea?: { number: string; expiresAt?: string };
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
  | "supervision_expired";

/** Neutral reason labels — safe for Billing and the Credentialing Coordinator. */
export const CREDENTIALING_REASON_LABEL: Record<CredentialingReasonCode, string> = {
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
};

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
  "sud_counseling",
  "sud_group_odf",
  "sud_group_iot",
];
export const isBillableServiceType = (s?: string) => !!s && BILLABLE_SERVICE_TYPES.includes(s);

export interface CredentialingCheckInput {
  /** Payer name; the enrollment check runs only when a payer is known. */
  payer?: string;
  /** Service type id; the enrollment check runs only when a service type is known. */
  serviceType?: string;
  /** ISO date/datetime of the service. */
  dateOfService: string;
}

export type CredentialingCheckResult = { ok: true } | { ok: false; reasons: CredentialingReasonCode[] };

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
  if (!record) return { ok: false, reasons: ["no_record"] };
  const dos = input.dateOfService;
  const d = asDay(dos);

  // License or registration, verified and unexpired on the date of service.
  if (record.license) {
    if (!record.license.verifiedAt) reasons.push("license_not_verified");
    if (record.license.expiresAt && asDay(record.license.expiresAt) < d) reasons.push("license_expired");
  } else if (record.registration) {
    if (!record.registration.verifiedAt) reasons.push("registration_not_verified");
    if (record.registration.expiresAt && asDay(record.registration.expiresAt) < d) reasons.push("registration_expired");
  } else {
    reasons.push("license_missing");
  }

  // Exclusion monitoring: every list checked, clear, and not overdue.
  for (const { key } of EXCLUSION_LISTS) {
    const latest = record.exclusionChecks
      .filter((c) => c.list === key)
      .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0];
    if (!latest) {
      reasons.push("exclusion_check_overdue");
      continue;
    }
    if (latest.result === "hit") reasons.push("exclusion_hit");
    else if (asDay(latest.nextDueAt) < d) reasons.push("exclusion_check_overdue");
  }

  // Payer enrollment for this service type — only when both are known.
  if (input.payer && input.serviceType) {
    const enrolled = record.enrollments.some(
      (e) =>
        e.payer === input.payer &&
        (e.serviceType === "*" || e.serviceType === input.serviceType) &&
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

  return reasons.length ? { ok: false, reasons } : { ok: true };
}

// ---------------------------------------------------------------- store

const records: ClinicianCredentialing[] = [];
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
  return staffId ? records.find((r) => r.staffId === staffId) : undefined;
}
export function credentialingRecordForClinician(clinicianId: string | undefined): ClinicianCredentialing | undefined {
  return clinicianId ? records.find((r) => r.clinicianId === clinicianId) : undefined;
}
export function listCredentialingRecords(): ClinicianCredentialing[] {
  return records;
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
): CredentialingCheckResult {
  return evaluateCredentialing(credentialingRecordForStaff(staffId), { payer, serviceType, dateOfService });
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

function recordFor(staffId: string): ClinicianCredentialing {
  const existing = credentialingRecordForStaff(staffId);
  if (existing) return existing;
  const member = getStaffMember(staffId);
  const created: ClinicianCredentialing = {
    staffId,
    clinicianId: member?.clinicianId,
    exclusionChecks: [],
    enrollments: [],
    documentStatus: "simulated_unavailable",
  };
  records.push(created);
  return created;
}

// ---------------------------------------------------------------- mutations
// Each is wrapped by a registry action (one audit row). The role gate here
// matches the registry `allowed()` exactly.

export function upsertLicense(actor: CredentialingActor, staffId: string, license: LicenseRecord): ClinicianCredentialing {
  assertCredentialing(actor);
  const r = recordFor(staffId);
  r.license = license;
  emit();
  return r;
}

export function recordVerification(
  actor: CredentialingActor,
  staffId: string,
  input: { source: VerificationSource; at?: string },
): ClinicianCredentialing {
  assertCredentialing(actor);
  const r = recordFor(staffId);
  const target = r.license ?? r.registration;
  if (!target) throw new Error("There is no license or registration on file to verify.");
  const at = input.at ?? iso();
  if (r.license) {
    r.license = { ...r.license, verifiedAt: at, verifiedBy: actor.staffId ?? actor.role, verificationSource: input.source };
  } else if (r.registration) {
    r.registration = { ...r.registration, verifiedAt: at, verifiedBy: actor.staffId ?? actor.role };
  }
  emit();
  return r;
}

export function recordExclusionCheck(
  actor: CredentialingActor,
  staffId: string,
  input: { list: ExclusionList; result: "clear" | "hit"; checkedAt?: string },
): ClinicianCredentialing {
  assertCredentialing(actor);
  const r = recordFor(staffId);
  const checkedAt = input.checkedAt ?? iso();
  const nextDueAt = new Date(+new Date(checkedAt) + CREDENTIALING_DRAFT.exclusionCadenceDays * dayMs).toISOString();
  r.exclusionChecks = [...r.exclusionChecks.filter((c) => c.list !== input.list), { list: input.list, checkedAt, result: input.result, nextDueAt }];
  if (input.result === "hit") {
    // Urgent, neutral, ids-only: the clinical coordinator and sys_admin see
    // this notice; the audit row comes from the registry action.
    notices.push({ id: uid(), kind: "exclusion_hit", staffId, at: checkedAt });
  }
  emit();
  return r;
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
  const r = recordFor(staffId);
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
  emit();
  return r;
}

export function recordAttestation(
  actor: CredentialingActor,
  staffId: string,
  input: { covers: Attestation18019["covers"]; signedAt?: string },
): ClinicianCredentialing {
  assertCredentialing(actor);
  const r = recordFor(staffId);
  const all = Object.values(input.covers).every(Boolean);
  r.attestation = {
    status: all ? "signed" : "pending",
    signedAt: all ? (input.signedAt ?? iso()) : undefined,
    signedBy: all ? (actor.staffId ?? actor.role) : undefined,
    covers: input.covers,
  };
  emit();
  return r;
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
  for (const r of records) {
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
      const threshold = CREDENTIALING_DRAFT.expiryTaskThresholdsDays.find((t) => daysLeft <= t);
      if (threshold !== undefined) out.push({ staffId: r.staffId, item: c.item, expiresAt: c.expiresAt, daysLeft, threshold });
    }
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

export interface ExclusionDueRow {
  staffId: string;
  list: ExclusionList;
  state: "due" | "overdue" | "never";
  nextDueAt?: string;
}

export function exclusionChecksDue(now: Date = new Date()): ExclusionDueRow[] {
  const today = asDay(now.toISOString());
  const out: ExclusionDueRow[] = [];
  for (const r of records) {
    for (const { key } of EXCLUSION_LISTS) {
      const latest = r.exclusionChecks.filter((c) => c.list === key).sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0];
      if (!latest) out.push({ staffId: r.staffId, list: key, state: "never" });
      else if (asDay(latest.nextDueAt) < today) out.push({ staffId: r.staffId, list: key, state: "overdue", nextDueAt: latest.nextDueAt });
      else if (asDay(latest.nextDueAt) - today <= 7) out.push({ staffId: r.staffId, list: key, state: "due", nextDueAt: latest.nextDueAt });
    }
  }
  return out;
}

export function recredentialingDue(now: Date = new Date()): { staffId: string; dueAt: string; daysLeft: number }[] {
  const today = asDay(now.toISOString());
  return records
    .filter((r) => r.recredentialingDueAt)
    .map((r) => ({ staffId: r.staffId, dueAt: r.recredentialingDueAt!, daysLeft: asDay(r.recredentialingDueAt!) - today }))
    .filter((r) => r.daysLeft <= 90)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export function enrollmentsPending(): { staffId: string; payer: string; serviceType: string; status: ServiceEnrollmentStatus }[] {
  const out: { staffId: string; payer: string; serviceType: string; status: ServiceEnrollmentStatus }[] = [];
  for (const r of records)
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
  for (const r of records) {
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
    const res = credentialedForService(member.id, payerForPatient(a.patientId), a.serviceType, a.start);
    if (!res.ok) out.push({ kind: "appointment", id: a.id, staffId: member.id, reasons: res.reasons });
  }
  for (const c of claims) {
    if (c.state === "void" || c.state === "paid") continue;
    const member = STAFF_ROSTER.find((s) => s.clinicianId === c.clinicianId);
    if (!member) continue;
    const res = credentialedForService(member.id, payerForPatient(c.patientId), undefined, c.serviceDate ?? iso());
    if (!res.ok) out.push({ kind: "claim", id: c.id, staffId: member.id, reasons: res.reasons });
  }
  return out;
}

/** Count-only projection — the Credentialing Coordinator may see HOW MANY claims are affected, never claim details. */
export function affectedClaimCount(staffId: string, claims: ClaimLike[], payerForPatient: (patientId: string) => string | undefined): number {
  return credentialingReviewFlags([], claims, payerForPatient).filter((f) => f.staffId === staffId).length;
}

// ---------------------------------------------------------------- demo seeds (fictional)
// Seeded through this module's own store core at load. License numbers are
// obviously fake. Five required scenarios:
//   c1 Marisol Reyes  — fully credentialed and enrolled;
//   c4 Kayla Nguyen   — associate (ASW) with a supervisor;
//   c2 James Okafor   — license expiring within 30 days;
//   c3 Anita Brooks   — Medi-Cal enrolled, NOT enrolled for the DMC-ODS service;
//   c5 Dr. Bagga      — overdue exclusion check.

const SEED_ACTOR: CredentialingActor = { role: "sys_admin", staffId: "seed" };

function daysFromNow(n: number): string {
  return new Date(Date.now() + n * dayMs).toISOString();
}

function seedRecord(r: ClinicianCredentialing) {
  records.push({ ...r, seed: true });
}

function seedExclusions(staffId: string, checkedDaysAgo: number): ExclusionCheck[] {
  return EXCLUSION_LISTS.map(({ key }) => ({
    list: key,
    checkedAt: daysFromNow(-checkedDaysAgo),
    result: "clear" as const,
    nextDueAt: daysFromNow(-checkedDaysAgo + CREDENTIALING_DRAFT.exclusionCadenceDays),
  }));
}

function seedDemo() {
  // c1 — fully credentialed and enrolled.
  seedRecord({
    staffId: "s-th1",
    clinicianId: "c1",
    license: { licenseType: "LCSW", number: "LCSW-88213", state: "CA", issuedAt: "2021-01-15", expiresAt: daysFromNow(210), verificationSource: "bbs", verifiedAt: daysFromNow(-30), verifiedBy: "s-cred1", method: "manual" },
    npi: "1000000001",
    malpractice: { carrier: "Demo Mutual", policy: "MP-4429", expiresAt: daysFromNow(400) },
    educationAttestedAt: daysFromNow(-60),
    ceAttestedAt: daysFromNow(-60),
    exclusionChecks: seedExclusions("s-th1", 10),
    attestation: { status: "signed", signedAt: daysFromNow(-60), signedBy: "s-cred1", covers: { limitationsAffectingJobFunctions: true, licenseLossOrFelonyHistory: true, privilegeLossOrDiscipline: true, noPresentIllegalDrugUse: true, accuracyAndCompleteness: true } },
    enrollments: [
      { payer: "Medi-Cal FFS", serviceType: "*", status: "active", effectiveAt: "2024-06-01" },
      { payer: "Health Net Medi-Cal", serviceType: "*", status: "active", effectiveAt: "2024-06-01" },
      { payer: "Tulare County MHP", serviceType: "*", status: "active", effectiveAt: "2024-06-01" },
      { payer: "Anthem Blue Cross Medi-Cal", serviceType: "*", status: "submitted" },
    ],
    recredentialingDueAt: daysFromNow(2 * 365),
    documentStatus: "simulated_unavailable",
  });

  // c4 — registered associate (ASW) with a licensed supervisor on file.
  seedRecord({
    staffId: "s-tr1",
    clinicianId: "c4",
    registration: {
      registrationType: "ASW",
      number: "ASW-99123",
      expiresAt: daysFromNow(300),
      verifiedAt: daysFromNow(-20),
      verifiedBy: "s-cred1",
      supervision: { supervisorStaffId: "s-th1", start: daysFromNow(-180) },
    },
    npi: "1000000004",
    exclusionChecks: seedExclusions("s-tr1", 12),
    attestation: { status: "signed", signedAt: daysFromNow(-50), signedBy: "s-cred1", covers: { limitationsAffectingJobFunctions: true, licenseLossOrFelonyHistory: true, privilegeLossOrDiscipline: true, noPresentIllegalDrugUse: true, accuracyAndCompleteness: true } },
    enrollments: [{ payer: "Medi-Cal FFS", serviceType: "*", status: "active", effectiveAt: "2024-09-01" }],
    recredentialingDueAt: daysFromNow(2 * 365),
    documentStatus: "simulated_unavailable",
  });

  // c2 — license expiring within 30 days.
  seedRecord({
    staffId: "s-th2",
    clinicianId: "c2",
    license: { licenseType: "PsyD", number: "PSY-55501", state: "CA", issuedAt: "2019-05-01", expiresAt: daysFromNow(25), verificationSource: "bbs", verifiedAt: daysFromNow(-90), verifiedBy: "s-cred1", method: "manual" },
    npi: "1000000002",
    malpractice: { carrier: "Demo Mutual", policy: "MP-8810", expiresAt: daysFromNow(300) },
    exclusionChecks: seedExclusions("s-th2", 8),
    attestation: { status: "signed", signedAt: daysFromNow(-90), signedBy: "s-cred1", covers: { limitationsAffectingJobFunctions: true, licenseLossOrFelonyHistory: true, privilegeLossOrDiscipline: true, noPresentIllegalDrugUse: true, accuracyAndCompleteness: true } },
    enrollments: [{ payer: "Medi-Cal FFS", serviceType: "*", status: "active", effectiveAt: "2024-06-01" }],
    recredentialingDueAt: daysFromNow(2 * 365),
    documentStatus: "simulated_unavailable",
  });

  // c3 — Medi-Cal enrolled, NOT enrolled for the DMC-ODS service.
  seedRecord({
    staffId: "s-th3",
    clinicianId: "c3",
    license: { licenseType: "PMHNP", number: "PMHNP-32101", state: "CA", issuedAt: "2020-03-01", expiresAt: daysFromNow(320), verificationSource: "brn", verifiedAt: daysFromNow(-15), verifiedBy: "s-cred1", method: "manual" },
    npi: "1000000003",
    dea: { number: "BW-7788221", expiresAt: daysFromNow(400) },
    boardCertification: "PMHNP-BC",
    malpractice: { carrier: "Demo Mutual", policy: "MP-1199", expiresAt: daysFromNow(350) },
    exclusionChecks: seedExclusions("s-th3", 6),
    attestation: { status: "signed", signedAt: daysFromNow(-40), signedBy: "s-cred1", covers: { limitationsAffectingJobFunctions: true, licenseLossOrFelonyHistory: true, privilegeLossOrDiscipline: true, noPresentIllegalDrugUse: true, accuracyAndCompleteness: true } },
    enrollments: [
      { payer: "Medi-Cal FFS", serviceType: "med_management", status: "active", effectiveAt: "2024-06-01" },
      { payer: "Medi-Cal FFS", serviceType: "therapy_individual", status: "active", effectiveAt: "2024-06-01" },
      { payer: "Tulare County DMC-ODS", serviceType: "sud_counseling", status: "not_started" },
    ],
    recredentialingDueAt: daysFromNow(2 * 365),
    documentStatus: "simulated_unavailable",
  });

  // c5 — overdue exclusion check (checked 45 days ago against a 30-day cadence).
  seedRecord({
    staffId: "s-np1",
    clinicianId: "c5",
    license: { licenseType: "MD", number: "G-77701", state: "CA", issuedAt: "2005-07-01", expiresAt: daysFromNow(500), verificationSource: "medical_board_ca", verifiedAt: daysFromNow(-10), verifiedBy: "s-cred1", method: "manual" },
    npi: "1000000005",
    dea: { number: "BB-1234563", expiresAt: daysFromNow(600) },
    boardCertification: "Psychiatry",
    malpractice: { carrier: "Demo Mutual", policy: "MP-0001", expiresAt: daysFromNow(500) },
    exclusionChecks: seedExclusions("s-np1", 45),
    attestation: { status: "signed", signedAt: daysFromNow(-100), signedBy: "s-cred1", covers: { limitationsAffectingJobFunctions: true, licenseLossOrFelonyHistory: true, privilegeLossOrDiscipline: true, noPresentIllegalDrugUse: true, accuracyAndCompleteness: true } },
    enrollments: [
      { payer: "Medi-Cal FFS", serviceType: "*", status: "active", effectiveAt: "2024-06-01" },
      { payer: "Tulare County MHP", serviceType: "*", status: "active", effectiveAt: "2024-06-01" },
    ],
    recredentialingDueAt: daysFromNow(60),
    documentStatus: "simulated_unavailable",
  });

  // c6 — trainee with NO supervision record (already not billable in the demo).
  seedRecord({
    staffId: "s-tr2",
    clinicianId: "c6",
    registration: { registrationType: "AMFT", number: "AMFT-88210", expiresAt: daysFromNow(200), verifiedAt: daysFromNow(-25), verifiedBy: "s-cred1" },
    exclusionChecks: seedExclusions("s-tr2", 14),
    attestation: { status: "pending", covers: { limitationsAffectingJobFunctions: true, licenseLossOrFelonyHistory: true, privilegeLossOrDiscipline: true, noPresentIllegalDrugUse: true, accuracyAndCompleteness: false } },
    enrollments: [],
    documentStatus: "simulated_unavailable",
  });

  // c7 — SUD counselor (certified, registration-style credential).
  seedRecord({
    staffId: "s-sudc1",
    clinicianId: "c7",
    registration: {
      registrationType: "SUDCC-II",
      number: "SUDCC-33445",
      expiresAt: daysFromNow(150),
      verifiedAt: daysFromNow(-18),
      verifiedBy: "s-cred1",
      supervision: { supervisorStaffId: "s-np1", start: daysFromNow(-365) },
    },
    exclusionChecks: seedExclusions("s-sudc1", 9),
    attestation: { status: "signed", signedAt: daysFromNow(-30), signedBy: "s-cred1", covers: { limitationsAffectingJobFunctions: true, licenseLossOrFelonyHistory: true, privilegeLossOrDiscipline: true, noPresentIllegalDrugUse: true, accuracyAndCompleteness: true } },
    enrollments: [{ payer: "Tulare County DMC-ODS", serviceType: "*", status: "active", effectiveAt: "2024-08-01" }],
    recredentialingDueAt: daysFromNow(2 * 365),
    documentStatus: "simulated_unavailable",
  });

  void SEED_ACTOR;
}

seedDemo();
