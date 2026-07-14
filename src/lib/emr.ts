// ============================================================================
// Adelante EMR wireframe — synthetic data model.
// Prototype only. No backend. No PHI. All state in-memory + React subscribers.
// ============================================================================

import { useSyncExternalStore } from "react";

// ---------- Roles ----------
export type Role =
  | "patient"
  | "referral_submitter"
  | "case_manager"
  | "peer_specialist"
  | "therapist"
  | "pmhnp"
  | "billing"
  | "sys_admin";

export const ROLES: { id: Role; label: string; hint: string }[] = [
  { id: "patient", label: "Patient user", hint: "Personal dashboard" },
  { id: "referral_submitter", label: "Referral submitter", hint: "External portal" },
  { id: "case_manager", label: "Case manager", hint: "Caseload & intake" },
  { id: "peer_specialist", label: "Peer specialist", hint: "Adherence & outreach" },
  { id: "therapist", label: "Licensed therapist", hint: "Progress notes" },
  { id: "pmhnp", label: "PMHNP (prescriber)", hint: "Psych eval & meds" },
  { id: "billing", label: "Billing & credentialing", hint: "Claims & rates" },
  { id: "sys_admin", label: "System admin", hint: "Users & audit" },
];

// ---------- Domain ----------
export type EpisodeType = "MH" | "SUD" | "ECM" | "JI_PRE" | "BHSA";
export type FundingLane =
  | "medicaid_ffs"
  | "dmc_ods"
  | "ecm"
  | "private_pay"
  | "isl"
  | "bhsa"
  | "non_billable";

export const LANE_LABEL: Record<FundingLane, string> = {
  medicaid_ffs: "Medi-Cal FFS",
  dmc_ods: "DMC-ODS",
  ecm: "ECM",
  private_pay: "Private pay",
  isl: "ISL — non-Medi-Cal (reportable)",
  bhsa: "BHSA",
  non_billable: "Non-billable",
};

export const EPISODE_LABEL: Record<EpisodeType, string> = {
  MH: "Mental health",
  SUD: "SUD / DMC-ODS",
  ECM: "ECM",
  JI_PRE: "JI pre-release",
  BHSA: "BHSA outreach",
};

export type EpisodeStatus =
  | "pending_eligibility"
  | "assessment"
  | "diagnosis_confirmed"
  | "in_treatment"
  | "step_change"
  | "closed";

export interface Episode {
  id: string;
  type: EpisodeType;
  status: EpisodeStatus;
  openedAt: string;
  closedAt?: string;
  county: "Tulare";
  notes?: string;
}

export interface ReleaseDate {
  expected: string; // ISO date
  source: "jail_records" | "case_manager" | "self_reported";
  confidence: "confirmed" | "estimated" | "self_reported";
  history: { at: string; expected: string; note: string }[];
}

export type ConsentType =
  | "treatment"
  | "telehealth"
  | "part2_sud"
  | "roi"
  | "communication_sms"
  | "portal"
  | "proxy"
  | "group";

export type ConsentStatus =
  | "not_offered"
  | "offered"
  | "active"
  | "limited"
  | "revoked"
  | "expired";

export interface Consent {
  id: string;
  type: ConsentType;
  scope: string;
  recipients: string[];
  status: ConsentStatus;
  effectiveAt?: string;
  expiresAt?: string;
  revokedAt?: string;
}

export interface DisclosureLog {
  id: string;
  at: string;
  consentId?: string;
  recipient: string;
  summary: string;
}

export type PayerStatus = "medi_cal_active" | "medi_cal_pending" | "private" | "uninsured";
export interface PayerSpan {
  status: PayerStatus;
  aidCode?: string;
  countyOfResponsibility: "Tulare";
  mcp?: string;
  from: string;
  to?: string;
}

export interface ClinicalEvent {
  id: string;
  personId: string;
  episodeId: string;
  kind:
    | "psych_eval"
    | "therapy_note"
    | "cm_note"
    | "peer_contact"
    | "screening"
    | "medication"
    | "case_plan_update"
    | "sdoh_update"
    | "isl_encounter";
  at: string;
  author: string;
  authorRole: Role;
  lane: FundingLane;
  title: string;
  body?: string;
  part2?: boolean;
}

export type ScreenerKind = "PHQ9" | "GAD7" | "PCL5" | "AUDIT" | "DAST10";
export interface ScreenerResult {
  id: string;
  kind: ScreenerKind;
  at: string;
  items: number[]; // item-level
  score: number;
  interpretation: string;
  part2?: boolean; // AUDIT / DAST-10
}

export type ReferralStatus = "sent" | "accepted" | "scheduled" | "completed" | "not_completed";
export interface CommunityReferral {
  id: string;
  category: "housing" | "food" | "transport" | "benefits" | "employment" | "legal";
  provider: string;
  status: ReferralStatus;
  createdAt: string;
  part2SharedWithConsent?: boolean;
}

export interface SelfHelpAssignment {
  id: string;
  module: string;
  cadence: "daily" | "weekly";
  completedDates: string[];
}

export interface Medication {
  id: string;
  name: string;
  dose: string;
  epcs?: boolean; // controlled
  prescribedAt: string;
  prescriber: string;
}

export interface UploadedDoc {
  id: string;
  personId: string;
  uploader: string;
  uploadedAt: string;
  fileName: string;
  classification?: "id" | "release" | "benefits" | "prior_clinical" | "part2_program";
  verified: boolean;
  scanState: "clean" | "pending";
  part2: boolean;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  actorRole: Role;
  action: string;
  personId?: string;
}

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  cin?: string;
  language: "en" | "es";
  phone?: string;
  address?: string;
  emergencyContact?: string;
  episodes: Episode[];
  releaseDate?: ReleaseDate;
  consents: Consent[];
  disclosures: DisclosureLog[];
  payer: PayerSpan[];
  problems: string[];
  diagnoses: { code: string; label: string }[];
  medications: Medication[];
  events: ClinicalEvent[];
  screeners: ScreenerResult[];
  carePlan: { goals: string[]; interventions: string[]; responsible: string; targetDate?: string };
  sdohPlan: { need: string; status: string }[];
  communityReferrals: CommunityReferral[];
  selfHelp: SelfHelpAssignment[];
  riskTier: "low" | "moderate" | "high";
  lastContactAt?: string;
  nextAppointmentAt?: string;
  tags?: string[];
}

// ---------- Billing ----------
export type ClaimStatus = "not_eligible" | "pre_bill_hold" | "ready" | "submitted" | "paid" | "denied";
export interface Claim {
  id: string;
  personId: string;
  eventId: string;
  lane: FundingLane;
  code: string;
  amount: number;
  payer: string;
  status: ClaimStatus;
}
export interface CodeRateRow {
  id: string;
  code: string;
  modifier?: string;
  description: string;
  rate: number;
  effectiveFrom: string;
  effectiveTo?: string;
  county: "Tulare";
  version: number;
}
export interface Provider {
  id: string;
  name: string;
  licenseNumber: string;
  licenseType: string;
  scope: string;
  supervisor?: string;
  npi: string;
  dea?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  dmcCertified: boolean;
  role: Role;
}

export type BillingEntity = "bagga_clinic" | "adelante";

// ============================================================================
// Store
// ============================================================================
interface State {
  role: Role;
  currentPersonId: string;
  people: Person[];
  claims: Claim[];
  codeRates: CodeRateRow[];
  providers: Provider[];
  audit: AuditEntry[];
  billingEntity: BillingEntity;
  breakGlassOpen: boolean;
  countyPipelineNote: boolean;
}

const listeners = new Set<() => void>();
// Docs live in a separate mutable queue so multiple people can share verify state.
const docQueue: UploadedDoc[] = [];
let state: State = seedState();
function emit() {
  listeners.forEach((l) => l());
}
function update(fn: (s: State) => State) {
  state = fn(state);
  emit();
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function getState() {
  return state;
}
export function useEMR<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => subscribe(l),
    () => selector(state),
    () => selector(state),
  );
}

// ---------- Actions ----------
export const EMR = {
  setRole(role: Role) {
    update((s) => ({ ...s, role }));
    audit(role, "system", `Switched role to ${role}`);
  },
  setCurrentPerson(id: string) {
    update((s) => ({ ...s, currentPersonId: id }));
  },
  setBillingEntity(e: BillingEntity) {
    update((s) => ({ ...s, billingEntity: e }));
    audit(state.role, "system", `Billing entity set to ${e}`);
  },
  toggleBreakGlass() {
    const now = !state.breakGlassOpen;
    update((s) => ({ ...s, breakGlassOpen: now }));
    if (now) audit(state.role, "sys_admin", "Break-glass audit access opened");
  },
  revokeConsent(personId: string, consentId: string) {
    update((s) => ({
      ...s,
      people: s.people.map((p) =>
        p.id !== personId
          ? p
          : {
              ...p,
              consents: p.consents.map((c) =>
                c.id === consentId
                  ? { ...c, status: "revoked", revokedAt: new Date().toISOString() }
                  : c,
              ),
            },
      ),
    }));
    audit(state.role, "user", `Revoked consent ${consentId}`, personId);
  },
  reactivateConsent(personId: string, consentId: string) {
    update((s) => ({
      ...s,
      people: s.people.map((p) =>
        p.id !== personId
          ? p
          : {
              ...p,
              consents: p.consents.map((c) =>
                c.id === consentId
                  ? { ...c, status: "active", revokedAt: undefined, effectiveAt: new Date().toISOString() }
                  : c,
              ),
            },
      ),
    }));
    audit(state.role, "user", `Reactivated consent ${consentId}`, personId);
  },
  verifyDoc(personId: string, docId: string) {
    update((s) => ({
      ...s,
      people: s.people.map((p) => {
        if (p.id !== personId) return p;
        // Docs live on person via tag list; here we handle only the queue module below.
        return p;
      }),
    }));
    verifyDocInQueue(docId);
    audit(state.role, "user", `Promoted doc ${docId} to chart`, personId);
  },
  addUploadedDoc(personId: string, fileName: string) {
    const id = "doc_" + Math.random().toString(36).slice(2, 8);
    docQueue.push({
      id,
      personId,
      uploader: state.role,
      uploadedAt: new Date().toISOString(),
      fileName,
      verified: false,
      scanState: "clean",
      part2: /part.?2|sud/i.test(fileName),
    });
    emit();
    audit(state.role, "user", `Uploaded document ${fileName}`, personId);
  },
  classifyDoc(docId: string, classification: UploadedDoc["classification"]) {
    const d = docQueue.find((x) => x.id === docId);
    if (d) {
      d.classification = classification;
      if (classification === "part2_program") d.part2 = true;
      emit();
    }
  },
  rejectDoc(docId: string) {
    const i = docQueue.findIndex((x) => x.id === docId);
    if (i >= 0) {
      docQueue.splice(i, 1);
      emit();
      audit(state.role, "user", `Rejected document ${docId}`);
    }
  },
  submitReferral(payload: ExternalReferral) {
    const id = "p_" + Math.random().toString(36).slice(2, 8);
    const person: Person = {
      id,
      firstName: payload.firstName,
      lastName: payload.lastName,
      dob: payload.dob,
      cin: payload.cin,
      language: payload.language,
      phone: payload.phone,
      episodes: [
        {
          id: "e_" + Math.random().toString(36).slice(2, 8),
          type: "JI_PRE",
          status: "pending_eligibility",
          openedAt: new Date().toISOString(),
          county: "Tulare",
          notes: `Referred by ${payload.referrerName} (${payload.referrerOrg})`,
        },
      ],
      releaseDate: payload.releaseDate
        ? {
            expected: payload.releaseDate,
            source: "case_manager",
            confidence: payload.releaseConfidence,
            history: [{ at: new Date().toISOString(), expected: payload.releaseDate, note: "Initial referral" }],
          }
        : undefined,
      consents: [
        makeConsent("treatment", payload.consents.treatment),
        makeConsent("telehealth", payload.consents.telehealth),
        makeConsent("part2_sud", payload.consents.part2),
        makeConsent("communication_sms", payload.consents.sms),
      ],
      disclosures: [],
      payer: [{ status: "medi_cal_pending", countyOfResponsibility: "Tulare", from: new Date().toISOString().slice(0, 10) }],
      problems: [],
      diagnoses: [],
      medications: [],
      events: [],
      screeners: [],
      carePlan: { goals: [], interventions: [], responsible: "Unassigned" },
      sdohPlan: [],
      communityReferrals: [],
      selfHelp: [],
      riskTier: "moderate",
    };
    update((s) => ({ ...s, people: [person, ...s.people] }));
    audit("referral_submitter", payload.referrerName, `New referral for ${payload.firstName} ${payload.lastName}`, id);
    return id;
  },
  addEvent(personId: string, ev: Omit<ClinicalEvent, "id" | "personId">) {
    const full: ClinicalEvent = { ...ev, id: "ev_" + Math.random().toString(36).slice(2, 8), personId };
    update((s) => ({
      ...s,
      people: s.people.map((p) => (p.id === personId ? { ...p, events: [full, ...p.events] } : p)),
    }));
    audit(state.role, "user", `Logged ${ev.kind}: ${ev.title}`, personId);
    return full.id;
  },
  logEscalation(personId: string, kind: "clinical_crisis" | "sdoh_urgent") {
    audit(state.role, "user", `Crisis escalation: ${kind}`, personId);
  },
  toggleCountyPipelineNote() {
    update((s) => ({ ...s, countyPipelineNote: !s.countyPipelineNote }));
  },
};

export interface ExternalReferral {
  referrerName: string;
  referrerOrg: string;
  referrerRole: string;
  firstName: string;
  lastName: string;
  dob: string;
  cin?: string;
  county: "Tulare";
  custodyFacility?: string;
  bookingDate?: string;
  releaseDate?: string;
  releaseConfidence: ReleaseDate["confidence"];
  pendingCharges?: string;
  sudKnown?: "yes" | "no" | "unknown";
  currentMedications?: string;
  phone?: string;
  language: "en" | "es";
  consents: { treatment: boolean; telehealth: boolean; part2: boolean; sms: boolean };
}

function makeConsent(type: ConsentType, active: boolean): Consent {
  return {
    id: "c_" + Math.random().toString(36).slice(2, 8),
    type,
    scope: type === "part2_sud" ? "SUD treatment records" : type,
    recipients: [],
    status: active ? "active" : "offered",
    effectiveAt: active ? new Date().toISOString() : undefined,
  };
}

function audit(role: Role, actor: string, action: string, personId?: string) {
  const entry: AuditEntry = {
    id: "a_" + Math.random().toString(36).slice(2, 10),
    at: new Date().toISOString(),
    actor,
    actorRole: role,
    action,
    personId,
  };
  state = { ...state, audit: [entry, ...state.audit] };
  emit();
}

function verifyDocInQueue(docId: string) {
  const d = docQueue.find((x) => x.id === docId);
  if (d) {
    d.verified = true;
    emit();
  }
}
export function listDocs() {
  return [...docQueue];
}
export function docsForPerson(personId: string) {
  return docQueue.filter((d) => d.personId === personId);
}

// ============================================================================
// RBAC — the record-access matrix (§4)
// ============================================================================
export type RecordClass =
  | "demographics"
  | "referral_packet"
  | "screening_general"
  | "screening_sud"
  | "psych_eval"
  | "care_plan"
  | "therapy_notes"
  | "medications"
  | "sdoh_plan"
  | "self_help"
  | "case_management"
  | "peer_contacts"
  | "documents"
  | "sud_treatment"
  | "billing"
  | "audit";

export type Access =
  | "read_edit"
  | "read_write"
  | "read"
  | "read_own"
  | "summary"
  | "dx_only"
  | "consent_gated"
  | "billable_toggle"
  | "read_break_glass"
  | "none";

const MATRIX: Record<RecordClass, Record<Role, Access>> = {
  demographics: {
    patient: "read_edit", peer_specialist: "read", case_manager: "read_write",
    therapist: "read", pmhnp: "read", billing: "read", sys_admin: "none",
    referral_submitter: "none",
  },
  referral_packet: {
    patient: "none", peer_specialist: "read", case_manager: "read_write",
    therapist: "read", pmhnp: "read", billing: "read", sys_admin: "none",
    referral_submitter: "read_write",
  },
  screening_general: {
    patient: "read_own", peer_specialist: "read", case_manager: "read_write",
    therapist: "read", pmhnp: "read", billing: "none", sys_admin: "none",
    referral_submitter: "none",
  },
  screening_sud: {
    patient: "read_own", peer_specialist: "consent_gated", case_manager: "consent_gated",
    therapist: "consent_gated", pmhnp: "read", billing: "none", sys_admin: "none",
    referral_submitter: "none",
  },
  psych_eval: {
    patient: "summary", peer_specialist: "none", case_manager: "read",
    therapist: "read", pmhnp: "read_write", billing: "dx_only", sys_admin: "none",
    referral_submitter: "none",
  },
  care_plan: {
    patient: "read_edit", peer_specialist: "read_write", case_manager: "read_write",
    therapist: "read_write", pmhnp: "read_write", billing: "none", sys_admin: "none",
    referral_submitter: "none",
  },
  therapy_notes: {
    patient: "none", peer_specialist: "none", case_manager: "read",
    therapist: "read_write", pmhnp: "read", billing: "none", sys_admin: "none",
    referral_submitter: "none",
  },
  medications: {
    patient: "read_own", peer_specialist: "none", case_manager: "read",
    therapist: "read", pmhnp: "read_write", billing: "none", sys_admin: "none",
    referral_submitter: "none",
  },
  sdoh_plan: {
    patient: "read_edit", peer_specialist: "read_write", case_manager: "read_write",
    therapist: "read_write", pmhnp: "read_write", billing: "none", sys_admin: "none",
    referral_submitter: "none",
  },
  self_help: {
    patient: "read_edit", peer_specialist: "read_write", case_manager: "read_write",
    therapist: "read_write", pmhnp: "read_write", billing: "none", sys_admin: "none",
    referral_submitter: "none",
  },
  case_management: {
    patient: "none", peer_specialist: "read", case_manager: "read_write",
    therapist: "read", pmhnp: "read", billing: "none", sys_admin: "none",
    referral_submitter: "none",
  },
  peer_contacts: {
    patient: "none", peer_specialist: "read_write", case_manager: "read",
    therapist: "read", pmhnp: "read", billing: "billable_toggle", sys_admin: "none",
    referral_submitter: "none",
  },
  documents: {
    patient: "read_edit", peer_specialist: "none", case_manager: "read_write",
    therapist: "read", pmhnp: "read", billing: "none", sys_admin: "none",
    referral_submitter: "none",
  },
  sud_treatment: {
    patient: "read_own", peer_specialist: "consent_gated", case_manager: "consent_gated",
    therapist: "consent_gated", pmhnp: "read_write", billing: "consent_gated", sys_admin: "none",
    referral_submitter: "none",
  },
  billing: {
    patient: "none", peer_specialist: "none", case_manager: "none",
    therapist: "none", pmhnp: "none", billing: "read_write", sys_admin: "none",
    referral_submitter: "none",
  },
  audit: {
    patient: "none", peer_specialist: "none", case_manager: "none",
    therapist: "none", pmhnp: "none", billing: "none", sys_admin: "read_break_glass",
    referral_submitter: "none",
  },
};

export function accessFor(role: Role, recordClass: RecordClass): Access {
  return MATRIX[recordClass][role];
}

export function isWritable(a: Access) {
  return a === "read_edit" || a === "read_write";
}
export function isReadable(a: Access) {
  return a !== "none" && a !== "consent_gated";
}

/** Given a person + record class, resolve Part-2 gating for the current role. */
export function resolveGate(person: Person, role: Role, recordClass: RecordClass) {
  const a = accessFor(role, recordClass);
  if (a !== "consent_gated") return { access: a, unlocked: a !== "none", reason: "" };
  const part2 = person.consents.find((c) => c.type === "part2_sud" && c.status === "active");
  if (part2) return { access: "read" as Access, unlocked: true, reason: "" };
  return {
    access: "consent_gated" as Access,
    unlocked: false,
    reason: "42 CFR Part 2 — active SUD consent required to view this section.",
  };
}

// ============================================================================
// Seed data (§18 scenarios)
// ============================================================================
function iso(daysFromNow: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
}
function isoDate(daysFromNow: number) {
  return iso(daysFromNow).slice(0, 10);
}

function seedPerson(id: string, patch: Partial<Person>): Person {
  return {
    id,
    firstName: "",
    lastName: "",
    dob: "1990-01-01",
    language: "en",
    episodes: [],
    consents: [],
    disclosures: [],
    payer: [{ status: "medi_cal_active", countyOfResponsibility: "Tulare", from: isoDate(-90) }],
    problems: [],
    diagnoses: [],
    medications: [],
    events: [],
    screeners: [],
    carePlan: { goals: [], interventions: [], responsible: "Case manager" },
    sdohPlan: [],
    communityReferrals: [],
    selfHelp: [],
    riskTier: "moderate",
    ...patch,
  } as Person;
}

function seedState(): State {
  const p1 = seedPerson("p_maria", {
    firstName: "Maria",
    lastName: "Ochoa",
    dob: "1988-03-14",
    cin: "9AB123456C",
    language: "es",
    phone: "(559) 555-0101",
    episodes: [
      { id: "e1", type: "MH", status: "in_treatment", openedAt: iso(-40), county: "Tulare" },
      { id: "e2", type: "SUD", status: "in_treatment", openedAt: iso(-30), county: "Tulare" },
    ],
    consents: [
      { id: "c1", type: "treatment", scope: "General", recipients: [], status: "active", effectiveAt: iso(-40) },
      { id: "c2", type: "part2_sud", scope: "SUD records to Adelante team", recipients: ["Adelante clinical team"], status: "active", effectiveAt: iso(-30) },
      { id: "c3", type: "communication_sms", scope: "Appointment reminders", recipients: [], status: "active", effectiveAt: iso(-40) },
    ],
    problems: ["Major depressive disorder, recurrent, moderate", "Alcohol use disorder, moderate"],
    diagnoses: [{ code: "F33.1", label: "MDD, recurrent, moderate" }, { code: "F10.20", label: "Alcohol use disorder, moderate" }],
    medications: [{ id: "m1", name: "Sertraline", dose: "50 mg PO daily", prescribedAt: iso(-20), prescriber: "Dr. Bagga" }],
    riskTier: "moderate",
    lastContactAt: iso(-3),
    nextAppointmentAt: iso(2),
    tags: ["Co-occurring", "Part 2 unlocked"],
  });

  const p2 = seedPerson("p_darnell", {
    firstName: "Darnell",
    lastName: "Reeves",
    dob: "1982-11-02",
    cin: "9BC223344D",
    phone: "(559) 555-0142",
    episodes: [
      { id: "e1", type: "MH", status: "in_treatment", openedAt: iso(-25), county: "Tulare" },
      { id: "e2", type: "SUD", status: "assessment", openedAt: iso(-10), county: "Tulare" },
    ],
    consents: [
      { id: "c1", type: "treatment", scope: "General", recipients: [], status: "active", effectiveAt: iso(-25) },
      { id: "c2", type: "part2_sud", scope: "SUD records", recipients: [], status: "offered" },
    ],
    problems: ["PTSD"],
    diagnoses: [{ code: "F43.10", label: "PTSD" }],
    riskTier: "high",
    tags: ["Co-occurring", "Part 2 LOCKED"],
    lastContactAt: iso(-6),
  });

  const p3 = seedPerson("p_amina", {
    firstName: "Amina",
    lastName: "Cole",
    dob: "1995-06-30",
    cin: "9CD334455E",
    episodes: [{ id: "e1", type: "MH", status: "in_treatment", openedAt: iso(-15), county: "Tulare" }],
    consents: [{ id: "c1", type: "treatment", scope: "General", recipients: [], status: "active", effectiveAt: iso(-15) }],
    problems: ["Generalized anxiety disorder, mild"],
    diagnoses: [{ code: "F41.1", label: "GAD" }],
    selfHelp: [
      { id: "s1", module: "Mindful breathing (5 min)", cadence: "daily", completedDates: [iso(-2), iso(-1)] },
      { id: "s2", module: "Resilience training", cadence: "weekly", completedDates: [iso(-5)] },
    ],
    riskTier: "low",
    tags: ["MH-only", "Routed to self-help"],
  });

  const p4 = seedPerson("p_jose", {
    firstName: "José",
    lastName: "Ramírez",
    dob: "1978-09-19",
    cin: "9DE445566F",
    language: "es",
    episodes: [{ id: "e1", type: "JI_PRE", status: "pending_eligibility", openedAt: iso(-14), county: "Tulare" }],
    releaseDate: {
      expected: isoDate(21),
      source: "jail_records",
      confidence: "confirmed",
      history: [
        { at: iso(-14), expected: isoDate(28), note: "Initial estimate at booking" },
        { at: iso(-3), expected: isoDate(21), note: "Confirmed via jail JMS" },
      ],
    },
    consents: [{ id: "c1", type: "treatment", scope: "General", recipients: [], status: "offered" }],
    payer: [{ status: "medi_cal_pending", countyOfResponsibility: "Tulare", from: isoDate(-14) }],
    riskTier: "high",
    tags: ["JI pre-release", "T−21"],
  });

  const p5 = seedPerson("p_tanya", {
    firstName: "Tanya",
    lastName: "Bell",
    dob: "1970-01-08",
    episodes: [{ id: "e1", type: "MH", status: "in_treatment", openedAt: iso(-20), county: "Tulare" }],
    consents: [{ id: "c1", type: "treatment", scope: "General", recipients: [], status: "active", effectiveAt: iso(-20) }],
    payer: [{ status: "uninsured", countyOfResponsibility: "Tulare", from: isoDate(-20) }],
    diagnoses: [{ code: "F32.1", label: "MDD, single episode, moderate" }],
    riskTier: "moderate",
    tags: ["Uninsured", "ISL-reportable"],
  });

  const p6 = seedPerson("p_marcus", {
    firstName: "Marcus",
    lastName: "Kim",
    dob: "1985-04-25",
    episodes: [{ id: "e1", type: "MH", status: "in_treatment", openedAt: iso(-45), county: "Tulare" }],
    consents: [{ id: "c1", type: "treatment", scope: "General", recipients: [], status: "active", effectiveAt: iso(-45) }],
    payer: [{ status: "private", countyOfResponsibility: "Tulare", from: isoDate(-45) }],
    riskTier: "low",
    tags: ["Private pay"],
  });

  const p7 = seedPerson("p_lila", {
    firstName: "Lila",
    lastName: "Nguyen",
    dob: "1992-12-11",
    cin: "9EF556677G",
    episodes: [
      { id: "e1", type: "MH", status: "in_treatment", openedAt: iso(-30), county: "Tulare" },
      { id: "e2", type: "SUD", status: "in_treatment", openedAt: iso(-20), county: "Tulare" },
    ],
    consents: [
      { id: "c1", type: "treatment", scope: "General", recipients: [], status: "active", effectiveAt: iso(-30) },
      { id: "c2", type: "part2_sud", scope: "SUD records", recipients: [], status: "offered" },
    ],
    tags: ["Uploaded Part 2 doc pending verify"],
    riskTier: "moderate",
  });

  const p8 = seedPerson("p_kevin", {
    firstName: "Kevin",
    lastName: "Alvarez",
    dob: "1990-07-04",
    cin: "9FG667788H",
    episodes: [{ id: "e1", type: "MH", status: "in_treatment", openedAt: iso(-50), county: "Tulare" }],
    consents: [{ id: "c1", type: "treatment", scope: "General", recipients: [], status: "active", effectiveAt: iso(-50) }],
    riskTier: "high",
    lastContactAt: iso(-14),
    tags: ["High-dropout risk", "Peer re-engagement"],
  });

  // Seed a Part 2 program-record doc for p7.
  docQueue.push({
    id: "doc_part2_lila",
    personId: "p_lila",
    uploader: "case_manager",
    uploadedAt: iso(-1),
    fileName: "SUD_program_record_prior.pdf",
    verified: false,
    scanState: "clean",
    part2: true,
    classification: "part2_program",
  });
  docQueue.push({
    id: "doc_id_maria",
    personId: "p_maria",
    uploader: "patient",
    uploadedAt: iso(-4),
    fileName: "state_id.jpg",
    verified: false,
    scanState: "clean",
    part2: false,
    classification: "id",
  });

  const people = [p1, p2, p3, p4, p5, p6, p7, p8];

  // Seed one event per person so lists have content.
  people.forEach((p) => {
    p.events = [
      {
        id: "ev_" + p.id,
        personId: p.id,
        episodeId: p.episodes[0].id,
        kind: "cm_note",
        at: iso(-2),
        author: "Sofia Delgado",
        authorRole: "case_manager",
        lane: p.payer[0].status === "uninsured" ? "isl" : p.payer[0].status === "private" ? "private_pay" : "medicaid_ffs",
        title: "Weekly check-in",
        body: "Phone contact. Confirmed appointment for next week.",
      },
    ];
    if (p.episodes.some((e) => e.type === "SUD")) {
      p.events.unshift({
        id: "ev_sud_" + p.id,
        personId: p.id,
        episodeId: p.episodes.find((e) => e.type === "SUD")!.id,
        kind: "screening",
        at: iso(-5),
        author: "System",
        authorRole: "case_manager",
        lane: "dmc_ods",
        title: "AUDIT screening captured",
        part2: true,
      });
    }
  });

  return {
    role: "case_manager",
    currentPersonId: "p_maria",
    people,
    audit: [
      { id: "a_seed", at: iso(-1), actor: "system", actorRole: "sys_admin", action: "Prototype seeded" },
    ],
    breakGlassOpen: false,
    billingEntity: "bagga_clinic",
    countyPipelineNote: false,
    claims: [
      { id: "cl1", personId: "p_maria", eventId: "ev_p_maria", lane: "medicaid_ffs", code: "90837", amount: 148, payer: "Medi-Cal MCP · Health Net", status: "ready" },
      { id: "cl2", personId: "p_tanya", eventId: "ev_p_tanya", lane: "isl", code: "H0002", amount: 0, payer: "N/A — ISL reportable", status: "not_eligible" },
      { id: "cl3", personId: "p_marcus", eventId: "ev_p_marcus", lane: "private_pay", code: "90834", amount: 175, payer: "Self", status: "paid" },
      { id: "cl4", personId: "p_darnell", eventId: "ev_sud_p_darnell", lane: "dmc_ods", code: "H0001", amount: 92, payer: "Medi-Cal DMC-ODS", status: "pre_bill_hold" },
    ],
    codeRates: [
      { id: "r1", code: "90791", description: "Psych diagnostic eval", rate: 210, effectiveFrom: isoDate(-365), county: "Tulare", version: 2 },
      { id: "r2", code: "90837", description: "Psychotherapy 60 min", rate: 148, effectiveFrom: isoDate(-365), county: "Tulare", version: 2 },
      { id: "r3", code: "90834", description: "Psychotherapy 45 min", rate: 118, effectiveFrom: isoDate(-365), county: "Tulare", version: 2 },
      { id: "r4", code: "H0001", description: "SUD assessment (DMC-ODS)", rate: 92, effectiveFrom: isoDate(-365), county: "Tulare", version: 1 },
      { id: "r5", code: "H0038", modifier: "HQ", description: "Peer support, group (SB 803)", rate: 42, effectiveFrom: isoDate(-365), county: "Tulare", version: 1 },
    ],
    providers: [
      { id: "pr1", name: "Dr. R. Bagga", licenseNumber: "CA-PMHNP-88421", licenseType: "PMHNP", scope: "Adult psych + MAT", npi: "1234567890", dea: "BB1234567", effectiveFrom: isoDate(-800), dmcCertified: true, role: "pmhnp" },
      { id: "pr2", name: "L. Torres, LCSW", licenseNumber: "LCSW-32219", licenseType: "LCSW", scope: "Adult therapy · LPHA", npi: "9876543210", effectiveFrom: isoDate(-500), dmcCertified: true, role: "therapist" },
      { id: "pr3", name: "S. Delgado", licenseNumber: "CM-2024-01", licenseType: "Case manager", scope: "ECM + reentry", supervisor: "L. Torres, LCSW", npi: "—", effectiveFrom: isoDate(-300), dmcCertified: false, role: "case_manager" },
      { id: "pr4", name: "J. Rivera, CPRP", licenseNumber: "PEER-2024-04", licenseType: "Peer specialist", scope: "SB 803 billable peer", supervisor: "L. Torres, LCSW", npi: "—", effectiveFrom: isoDate(-200), dmcCertified: false, role: "peer_specialist" },
    ],
  };
}

// ---------- Small utilities ----------
export function tMinusDays(iso: string) {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  if (days > 0) return `T−${days}d`;
  if (days === 0) return "Today";
  return `T+${-days}d`;
}
