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
  type ServiceType,
} from "./ehr";
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
  uploadedAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
  verificationMethod?: "primary_source" | "attestation";
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

export interface CoverageSpan {
  id: string;
  patientId: string;
  payer: string;
  plan?: string;
  memberId?: string;
  from: string;
  to?: string;
  source: "self_report" | "verified_270_271" | "front_desk";
}

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
  | "partial";
export interface Claim {
  id: string;
  encounterId: string;
  patientId: string;
  clinicianId: string;
  state: ClaimState;
  chargeCents: number;
  denialReason?: string;
  updatedAt: string;
  history: { at: string; state: ClaimState; actor?: string; note?: string }[];
  /** §Phase 3 — HCPCS/CPT when the generating hook knows it (Peer, CHW). */
  serviceCode?: string;
  units?: number;
  taxonomy?: string;
  /** Enrolled provider the claim is billed through (CHW services). */
  supervisingStaffId?: string;
}

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

const coverageSpans: CoverageSpan[] = [
  { id: uid(), patientId: "p1", payer: "Medi-Cal FFS", memberId: "9CIN0001", from: "2025-01-01", source: "verified_270_271" },
  { id: uid(), patientId: "p2", payer: "Health Net Medi-Cal", memberId: "9CIN0002", from: "2025-06-01", source: "self_report" },
  { id: uid(), patientId: "p3", payer: "Tulare County MHP", from: "2025-03-15", source: "front_desk" },
];

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

  coverageForPatient: (pid: string) => coverageSpans.filter((c) => c.patientId === pid),
  activeCoverageFor(pid: string, at = new Date().toISOString()) {
    return coverageSpans.find(
      (c) => c.patientId === pid && +new Date(c.from) <= +new Date(at) && (!c.to || +new Date(c.to) >= +new Date(at)),
    );
  },

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

  addCredential(input: Omit<CredentialDoc, "id" | "uploadedAt">) {
    const c: CredentialDoc = { ...input, id: uid(), uploadedAt: iso() };
    credentials.push(c);
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
      ehrBus.publish({ type: "credential.updated", clinicianId });
    }
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

  signNote(encounterId: string, clinicianId: string, method: "human" | "machine_assisted" = "human") {
    if (this.isNoteSigned(encounterId)) return;
    noteSignatures.push({ id: uid(), encounterId, clinicianId, signedAt: iso(), method });
    ehrBus.publish({ type: "note.signed", encounterId, clinicianId });
    // Advance any linked claim
    const claim = claims.find((c) => c.encounterId === encounterId);
    if (claim && claim.state === "documented") {
      claim.state = "signed";
      claim.updatedAt = iso();
      claim.history.push({ at: iso(), state: "signed", actor: clinicianId });
      ehrBus.publish({ type: "claim.updated", claimId: claim.id, state: claim.state });
    }
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
      chargeCents: appt.chargeCents ?? AdelanteEHR.chargeForService?.(appt.serviceType) ?? 12000,
      updatedAt: iso(),
      history: [{ at: iso(), state: "documented", actor: "system" }],
    };
    claims.push(claim);
    ehrBus.publish({ type: "claim.updated", claimId: claim.id, state: claim.state });
    return claim;
  },
  advanceClaim(claimId: string, to: ClaimState, actor?: string, denialReason?: string) {
    const c = claims.find((x) => x.id === claimId);
    if (!c) return;
    c.state = to;
    c.updatedAt = iso();
    if (denialReason) c.denialReason = denialReason;
    c.history.push({ at: iso(), state: to, actor, note: denialReason });
    ehrBus.publish({ type: "claim.updated", claimId: c.id, state: to });
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
    chargeCents?: number;
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
      chargeCents:
        input.chargeCents ?? AdelanteEHR.chargeForService?.("therapy_group") ?? 12000,
      ...(session && groupBillingCode(session.category)
        ? { serviceCode: groupBillingCode(session.category) }
        : {}),
      updatedAt: iso(),
      history: [{ at: iso(), state: "documented", actor: "system", note: `note:${input.noteId}` }],
    };
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
    chargeCents?: number;
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
      chargeCents:
        input.chargeCents ?? AdelanteEHR.chargeForService?.("peer_support") ?? 6000,
      serviceCode: decision.serviceCode,
      units: decision.units,
      taxonomy: decision.taxonomy,
      updatedAt: iso(),
      history: [
        { at: iso(), state: "documented", actor: "system", note: `peer_note:${input.peerNoteId}` },
      ],
    };
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
    chargeCents?: number;
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
      chargeCents:
        input.chargeCents ?? AdelanteEHR.chargeForService?.("case_management") ?? 5000,
      serviceCode: decision.serviceCode,
      units: decision.units,
      supervisingStaffId: decision.supervisingStaffId,
      updatedAt: iso(),
      history: [
        { at: iso(), state: "documented", actor: "system", note: `chw_note:${input.noteId}` },
      ],
    };
    claims.push(claim);
    ehrBus.publish({ type: "claim.updated", claimId: claim.id, state: claim.state });
    return claim;
  },

  subscribe,
};

// Seed a few completed-but-unsigned encounters for the notes queue demo.
(() => {
  const appts = AdelanteEHR.listAppointments?.() ?? [];
  appts
    .filter((a) => a.status === "attended")
    .slice(0, 3)
    .forEach((a, i) => {
      if (i === 0) {
        // First one is signed to show the mix.
        noteSignatures.push({ id: uid(), encounterId: a.id, clinicianId: a.clinicianId, signedAt: iso(), method: "human" });
      }
      AdelanteEHRExt.upsertClaimFromEncounter(a.id);
    });
})();

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