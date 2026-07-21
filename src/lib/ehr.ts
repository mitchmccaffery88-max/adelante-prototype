// AdelanteEHR — single seam for all clinical-backend reads/writes.
// Adelante is the EHR of record. Do NOT import vendor SDKs outside
// `src/lib/vendors/*`; route vendor traffic through the helpers below
// (telehealth room, eRx medications) so adapters stay swappable.
// Today this is an in-memory mock; swap the in-memory store for a real
// backend when wiring the native Adelante EHR persistence layer.

export type ReferralStatus = "submitted" | "contacted" | "enrolled";
export type SessionStatus = "scheduled" | "attended" | "no_show" | "cancelled";
export type BillingStatus =
  | "draft"
  | "ready"
  | "submitted"
  | "paid"
  | "denied"
  | "write_off";
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

export type EpisodeType =
  | "mental_health"
  | "sud_dmc_ods"
  | "ecm"
  | "ji_pre_release"
  | "bhsa";

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

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
  email?: string;
  releaseDate: string;
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
  { id: "intake", label: "First visit (intake)", helper: "Get set up with your care team.", allowedModalities: ["video", "in_person"], defaultDurationMin: 60 },
  { id: "therapy_individual", label: "Talk with a counselor", helper: "A private one-on-one session.", allowedModalities: ["video", "phone", "in_person"], defaultDurationMin: 50 },
  { id: "therapy_group", label: "Group session", helper: "Meet with others in a supported group.", allowedModalities: ["in_person", "video"], defaultDurationMin: 60 },
  { id: "med_management", label: "Medication visit", helper: "Talk with a prescriber about medications.", allowedModalities: ["video", "in_person"], defaultDurationMin: 30 },
  { id: "peer_support", label: "Peer support", helper: "Connect with someone who's been there.", allowedModalities: ["video", "phone", "in_person"], defaultDurationMin: 45 },
  { id: "case_management", label: "Meet your case manager", helper: "Get help with resources and next steps.", allowedModalities: ["video", "phone", "in_person"], defaultDurationMin: 30 },
  { id: "care_coordination", label: "Care coordination", helper: "Line up outside services and support.", allowedModalities: ["video", "phone"], defaultDurationMin: 30 },
];

const LOCATIONS: ClinicLocation[] = [
  {
    id: "loc-visalia",
    name: "Adelante Visalia Hub",
    address: "1201 S Mooney Blvd",
    city: "Visalia, CA",
    room: "Suite 200",
    inPersonServices: ["intake", "therapy_individual", "therapy_group", "med_management", "peer_support", "case_management"],
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

export type EligibilityFlagKey =
  | "ecm"
  | "jiReentry"
  | "cs_housing"
  | "cs_food"
  | "cs_transport";
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
  | "notification_failed";

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
    services: ["intake", "therapy_individual", "therapy_group", "case_management", "care_coordination"],
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
      { key: "phq-9", score: 18, severity: "Moderately Severe", completedAt: "2026-05-12", timepoint: "intake" },
      { key: "phq-9", score: 14, severity: "Moderate", completedAt: "2026-06-11", timepoint: "day30" },
      { key: "gad-7", score: 13, severity: "Moderate", completedAt: "2026-05-12", timepoint: "intake" },
      { key: "gad-7", score: 11, severity: "Moderate", completedAt: "2026-06-11", timepoint: "day30" },
    ],
    goals: [
      { id: "g1", text: "Attend weekly therapy sessions", status: "in_progress", createdAt: "2026-05-12" },
      { id: "g2", text: "Secure stable housing within 60 days", status: "open", createdAt: "2026-05-12" },
      { id: "g3", text: "Reconnect with one supportive family member", status: "done", createdAt: "2026-05-12" },
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
      "phq-9": { key: "phq-9", score: 18, severity: "Moderately Severe", completedAt: "2026-04-05" },
      "audit": { key: "audit", score: 16, severity: "High risk", completedAt: "2026-04-05" },
    },
    needs: { housing: true, food: true, employment: true, transport: true, substanceUse: true, benefits: true },
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
      { key: "phq-9", score: 22, severity: "Severe", completedAt: "2026-04-05", timepoint: "intake" },
      { key: "phq-9", score: 18, severity: "Moderately Severe", completedAt: "2026-05-05", timepoint: "day30" },
      { key: "phq-9", score: 14, severity: "Moderate", completedAt: "2026-06-04", timepoint: "day60" },
    ],
    // §3a — co-occurring: Marcus carries both a mental-health and a SUD/DMC-ODS episode.
    episodes: [
      { id: "ep-p3-mh", type: "mental_health", state: "active", openedAt: "2026-04-05" },
      { id: "ep-p3-sud", type: "sud_dmc_ods", state: "engaged", openedAt: "2026-04-05" },
    ],
  },
];

const today = new Date();
const inHours = (h: number) => new Date(today.getTime() + h * 3600 * 1000).toISOString();
const ago = (h: number) => new Date(today.getTime() - h * 3600 * 1000).toISOString();

const appointments: Appointment[] = [
  { id: "a1", patientId: "p1", clinicianId: "c1", start: inHours(26), durationMin: 50, status: "scheduled", billingStatus: "draft" },
  { id: "a2", patientId: "p1", clinicianId: "c1", start: ago(72), durationMin: 50, status: "attended", billingStatus: "submitted" },
  { id: "a3", patientId: "p2", clinicianId: "c2", start: inHours(4), durationMin: 50, status: "scheduled", billingStatus: "draft" },
  { id: "a4", patientId: "p3", clinicianId: "c1", start: ago(48), durationMin: 50, status: "no_show", billingStatus: "draft" },
  { id: "a5", patientId: "p3", clinicianId: "c1", start: ago(240), durationMin: 50, status: "attended", billingStatus: "paid" },
  { id: "a6", patientId: "p2", clinicianId: "c2", start: ago(120), durationMin: 50, status: "attended", billingStatus: "denied" },
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

// Vendor adapters (telehealth video + eRx medication management). Kept
// behind AdelanteEHR helpers so UI code never talks to vendors directly.
import { vendors as _vendors } from "./vendors";
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
  | "access";
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
function appendAudit(evt: Omit<AuditEvent, "id" | "at"> & { at?: string }) {
  const patient = evt.patientId
    ? patients.find((p) => p.id === evt.patientId)
    : undefined;
  auditEvents.unshift({
    id: `au_${auditEvents.length + 1}_${Math.random().toString(36).slice(2, 6)}`,
    at: evt.at ?? new Date().toISOString(),
    programId: patient?.programId,
    ...evt,
  });
}

// ----- Refill request lifecycle -------------------------------------------
export type RefillStatus =
  | "pending"
  | "approved"
  | "denied"
  | "sent_to_pharmacy";
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

export const AdelanteEHR = {
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
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
    emit();
  },
  // Reads
  listReferrals: () => [...referrals].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
  listPatients: () => patients,
  getPatient: (id: string) => patients.find((p) => p.id === id),
  listClinicians: () => clinicians,
  getClinician: (id: string) => clinicians.find((c) => c.id === id),
  listServiceTypes: () => SERVICE_TYPES,
  getServiceType: (id?: ServiceType) => SERVICE_TYPES.find((s) => s.id === id),
  listLocations: () => LOCATIONS,
  getLocation: (id?: string) => LOCATIONS.find((l) => l.id === id),
  cliniciansForService(
    serviceType?: ServiceType,
    opts?: { locationId?: string },
  ) {
    return clinicians.filter((c) => {
      const svcOk = !serviceType || !c.services || c.services.includes(serviceType);
      const locOk =
        !opts?.locationId ||
        !c.locationIds ||
        c.locationIds.includes(opts.locationId);
      return svcOk && locOk;
    });
  },
  locationsForService(serviceType?: ServiceType) {
    if (!serviceType) return LOCATIONS;
    return LOCATIONS.filter((l) => l.inPersonServices.includes(serviceType));
  },
  listCaseManagers: () => caseManagers,
  getCaseManager: (id?: string) => caseManagers.find((c) => c.id === id),
  patientsForCaseManager: (cmId: string) =>
    patients.filter((p) => p.caseManagerId === cmId),
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
    const canSendSms =
      !requestManualOutreach && !!rest.phone && rest.consentToContact;
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
    const offset =
      clinicianId === "c1" ? 0 : clinicianId === "c2" ? 1 : 2;
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
  updateCarePlanSummary(patientId: string, summary: string) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    p.carePlanSummary = summary;
    emit();
  },
  addGoal(patientId: string, text: string) {
    const p = patients.find((x) => x.id === patientId);
    if (!p || !text.trim()) return;
    p.goals = [
      ...(p.goals ?? []),
      { id: uid(), text: text.trim(), status: "open", createdAt: new Date().toISOString() },
    ];
    emit();
  },
  setGoalStatus(patientId: string, goalId: string, status: Goal["status"]) {
    const p = patients.find((x) => x.id === patientId);
    const g = p?.goals?.find((x) => x.id === goalId);
    if (!g) return;
    g.status = status;
    emit();
  },
  removeGoal(patientId: string, goalId: string) {
    const p = patients.find((x) => x.id === patientId);
    if (!p?.goals) return;
    p.goals = p.goals.filter((g) => g.id !== goalId);
    emit();
  },
  addProgressNote(patientId: string, note: Omit<ProgressNote, "id">) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    p.progressNotes = [{ ...note, id: uid() }, ...(p.progressNotes ?? [])];
    emit();
  },

  // ----- Consent state + audit log -----
  getConsentState(patientId: string) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return { part2Sud: false, ecmShare: false, sms: true };
    return p.consentState ?? {
      part2Sud: p.consents.part2Sud,
      ecmShare: Boolean(p.coverage?.ecmEligible),
      sms: p.smsFallback,
    };
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
      .flatMap((p) =>
        (p.consentEvents ?? []).map((e) => ({ ...e, programId: p.programId })),
      )
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
    p.coverage = { ...(p.coverage ?? { status: "none_unsure", verified: "not_found" }), ecmEligible: eligible };
    emit();
  },
  setCommunitySupport(
    patientId: string,
    key: "housing" | "food" | "transport",
    on: boolean,
  ) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    const base = p.coverage ?? { status: "none_unsure" as CoverageStatus, verified: "not_found" as const };
    p.coverage = {
      ...base,
      communitySupports: { ...(base.communitySupports ?? {}), [key]: on },
    };
    emit();
  },
  setJiReentry(patientId: string, on: boolean) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    const base = p.coverage ?? { status: "none_unsure" as CoverageStatus, verified: "not_found" as const };
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
  rescreensDue(patientId: string): { key: string; lastDays: number | null; nextDue: 30 | 60 | 90 }[] {
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
  addSdohItem(patientId: string, input: { need: string; note?: string; visibleToPatient?: boolean }) {
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
    emit();
  },
  setSdohStatus(patientId: string, itemId: string, status: SdohStatus, note?: string) {
    const p = patients.find((x) => x.id === patientId);
    const item = p?.sdohPlan?.items.find((i) => i.id === itemId);
    if (!item) return;
    item.status = status;
    if (note !== undefined) item.note = note;
    item.updatedAt = new Date().toISOString();
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
  setResourceReferralStatus(patientId: string, referralId: string, status: ResourceReferral["status"], note?: string) {
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
    p.coordinationLog = [
      { ...input, id: uid() },
      ...(p.coordinationLog ?? []),
    ];
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
      const charge = ((a.chargeCents ?? AdelanteEHR.chargeForService(a.serviceType)) / 100).toFixed(2);
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
  expiringClinicianLicenses(days = 30): { clinician: Clinician; daysUntil: number; expired: boolean }[] {
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
  listAuditEvents(filter: {
    patientId?: string;
    category?: AuditCategory | AuditCategory[];
    since?: string;
    limit?: number;
  } = {}): AuditEvent[] {
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
    req.status = input.decision === "approved" ? "sent_to_pharmacy" : "denied";
    req.reviewedBy = input.clinicianId;
    req.reviewedAt = new Date().toISOString();
    if (input.decision === "denied") req.denyReason = input.denyReason;
    appendAudit({
      category: "rx",
      action:
        input.decision === "approved" ? "refill_approved" : "refill_denied",
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
    const task = caseTasks.find(
      (t) => t.dedupeKey === `refill:${req.id}` && t.status !== "done",
    );
    if (task) {
      task.status = "done";
      task.completedAt = new Date().toISOString();
    }
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
  markTelehealthJoin(appointmentId: string, role: "patient" | "clinician"): TelehealthSession | undefined {
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
      session.durationSec = Math.round(
        (now.getTime() - +new Date(session.startedAt)) / 1000,
      );
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
      if (
        s.state !== "ended" &&
        s.state !== "expired" &&
        +new Date(s.expiresAt) < now
      ) {
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
    const [th, er] = await Promise.all([
      _vendors.telehealth.ping(),
      _vendors.erx.ping(),
    ]);
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
};

// Re-export vendor types so consumers only import from "@/lib/ehr".
export type { Medication } from "./vendors";

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