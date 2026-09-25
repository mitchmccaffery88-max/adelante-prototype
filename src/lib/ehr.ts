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
// §EHR audit Phase 1d — persisted attestation artifact. Type-only: the
// primitive is a leaf module and must never pull the store in.
import { attestationRecordProblem, type AttestationRecord } from "./attestation";
// §EHR audit Phase 2b — template scope tiers. Type-only here; the value
// helpers (clone/locked-field rules) live in the leaf module and are imported
// by the write paths below.
import type { TemplateScope } from "./templateScope";
import { buildPersonalClone, lockedFieldViolations } from "./templateScope";

import type { CoverageType, HeardAboutSource, TriState } from "./frontDoor";
import type { HelperAttribution, SignupCredentialMeta } from "./signup";
// §Reporting Tier 2 — structured CalOMS history. Type-only: caloms.ts imports
// types back from here, and an erased import keeps that cycle harmless.
import type {
  CalomsProfile,
  DischargeRecord,
  JusticeInvolvementSelfReport,
  PriorTreatmentHistory,
  SubstanceUseProfile,
} from "./caloms";
import { helperAuditDetail } from "./signup";
import { mergeCoverage, type CoveragePatch } from "./coverageStatus";
import {
  MEDI_CAL_FOLLOW_UP_TASK_TITLE,
  matchExistingRecord,
  shouldRunSafetyNetLookup,
  type LookupResult,
  type LookupSubject,
} from "./missedHandoff";
export type { CoverageType, HeardAboutSource, TriState } from "./frontDoor";
// Value import of the shared consent gate. Only ever called inside methods,
// so the roles<->ehr module cycle resolves before any call happens.
import { canAccess, getActingRole, getActingStaff, STAFF_ROLES } from "./roles";
import {
  referralNeedsOutreachTask,
  referrerHasContact,
  REFERRER_CONTACT_REQUIRED_MSG,
  type ReferralOutreachAttempt,
  type ReferralOutreachOutcome,
  type ReferralOutreachState,
} from "./referralOutreach";

/**
 * §Part 2 store gate — WHO is reading. `system` is reserved for internal
 * derivation that never returns Part 2 content to a caller (care-plan
 * recompute, workflow status), and must not be used by UI or reports.
 */
export type ScreenerViewer =
  | { kind: "system" }
  | { kind: "staff"; role?: StaffRole; staffId?: string }
  | { kind: "patient"; patientId: string }
  | { kind: "advocate"; linkId: string };

/** Thrown by the store when a Part 2-covered read is refused. */
export class Part2AccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Part2AccessError";
  }
}
// §v3.0 Phase 4 — advocate access policy. Pure module, imports nothing back
// from here, so there is no cycle.
import {
  advocateAccessDecision,
  type AdvocateAccessDecision,
  type AdvocateAuthorizationType,
  type AdvocatePermission,
  advocateSudAccess,
  type AdvocateSudAccessMode,
  ADVOCATE_SUD_DISCLOSURE_CATEGORY,
  advocateTier,
  // §Phase 4.2 — AHCD activation + frontline validation checklist.
  AHCD_CHECKLIST_ITEMS,
  ahcdActivationReadiness,
  ahcdDeterminationExpired,
  ahcdPart2ScopeUnclear,
  isAhcdDeterminationRole,
  type AhcdActivationState,
  type AhcdChecklistItemKey,
  type AhcdChecklistOutcome,
  type AhcdChecklistState,
  type AhcdDeterminationRole,
} from "./advocate";
// §Advocate build 1 — consent-documentation requirements. Pure definitions.
import {
  ADVOCATE_DOC_REQUIREMENTS,
  ADVOCATE_DOCS_BY_TYPE,
  type AdvocateDocRequirementKey,
  type AdvocateDocRequirementStatus,
} from "./advocateDocs";
import { isAdvocateDemoClaimEnabled } from "./advocateDemo";
// §Advocate build 3 — messaging review gate + communication-rights axis.
import {
  ADVOCATE_MESSAGING_REVIEW,
  advocateCommunicationRightsDecision,
  type AdvocateCommunicationRightsDecision,
} from "./advocateMessaging";
import { visibleAdvocateMessageBody, isAdvocateMessageBodyMasked } from "./careMessageMasking";
// §5-stage recovery journey — pure model + the pending clinical-review flag.
import {
  RECOVERY_STAGE_REVIEW,
  isRecoveryStageId,
  type RecoveryStageId,
} from "./recoveryStages";
// §CF pre-release intake — capacity / legal-authority policy. Pure module.
import {
  capacityGateDecision,
  capacityRequiresSurrogate,
  type CapacityGateDecision,
  type IntakeCapacityStatus,
  type LegalAuthorityType,
} from "./capacity";
// §Adelante Journey Phase 5 — self-help Library. Content + pure selectors.
// The module imports nothing at runtime (its population import is type-only),
// so there is no cycle back into this store.
import { getExercise, getLibraryItem, LIBRARY_ITEMS, EXERCISES } from "./library";
import type { SavedToolkitItem, ToolkitOrigin } from "./library";
import * as Engagement from "./engagement";
import * as SafetyPlanStore from "./safetyPlan";
// §Adelante Journey Phase 7 part 2 — patient-reported adherence / side effects.
// Foreign-keyed to real MedOrders and derived MAR slots; see the header note in
// the module. Its ehr import is type-only, so there is no runtime cycle.
import * as MedAdherence from "./medAdherence";
import {
  SHORT_FORM_SCREENERS,
  isShortFormPositive,
  QUICK_CHECK_INTERVAL_DAYS,
  severityFor as _severityFor,
  shortFormByKey,
  scoreScreener,
  screenerByKey,
  SCREENERS,
  isPart2Screener,
  type ScreenerDomainResult,
} from "./screeners";
export type { LibraryCategory, LibraryItem, Exercise, SavedToolkitItem } from "./library";
// §v3.0 Phase 5 — patient documents. Pure policy module (scan gate, queue
// ownership, Part 2 restriction messaging); imports nothing back from here.
import {
  scanUpload,
  verifyQueueOwnerRole,
  advocateDocumentVisibility,
  documentDownloadDecision,
  documentDownloadPayload,
  type UploadCandidate,
  type DocumentUploaderKind,
  type DocumentVerificationStatus,
} from "./documents";
// §Message-routing gap #1 — out-of-band alert dispatch (SMS via Twilio when
// configured). Pure transport: no recipient or escalation policy lives there.
import { dispatchStaffAlert } from "./staffAlerts";
import {
  composeGroupNotification,
  dispatchGroupNotification,
  withGroupNotificationsSuppressed,
  type GroupNotificationEvent,
  type GroupNotificationTrigger,
} from "./groupNotifications";

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
  /**
   * §Advocate build 3 — "advocate" is a real third author kind, not a staff
   * sub-role: an advocate is an external authorized person, has no StaffRole,
   * and must never be attributed to the care team. Unread accounting below
   * still keys on "patient" / "staff" explicitly, so advocate messages never
   * silently inflate a queue count.
   */
  authorType: "patient" | "staff" | "advocate";
  /** Patient's own name, or the staff display name. Never altered. */
  authorName: string;
  /** Advocate messages only — which link authored it. */
  authorAdvocateLinkId?: string;
  /**
   * §Peer messaging — the acting staff role at the time of authorship, stored
   * on staff messages only. Deliberately NOT a new `authorType` value: every
   * other surface in this build distinguishes staff types by StaffRole on top
   * of a named identity, never by forking the author kind. `authorType` stays
   * `patient | staff` so read/unread, masking and the queue keep working
   * unchanged; the role only drives display attribution ("Peer specialist ·
   * Andre Willis") and is captured in the audit trail.
   */
  authorRole?: StaffRole;
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

/**
 * §Referrals Rework Phase 4a — `declined` is an ENDED state, not a fourth
 * step. Anything that renders progress must branch on it rather than index it
 * into the three-stage order, and anything counting "active" must exclude it.
 */
export type ReferralStatus = "submitted" | "contacted" | "enrolled" | "declined";
export const REFERRAL_PROGRESS_STAGES = ["submitted", "contacted", "enrolled"] as const;
export type ReferralProgressStage = (typeof REFERRAL_PROGRESS_STAGES)[number];
/** True for states that are over — no further progress will be made. */
export function isReferralClosed(s: ReferralStatus): boolean {
  return s === "declined" || s === "enrolled";
}
export type SessionStatus = "scheduled" | "attended" | "no_show" | "cancelled";
export type CoverageStatus =
  | "active"
  | "suspended"
  | "none_unsure"
  | "other"
  | "private_pay"
  | "uninsured"
  /** §Phase 8a — coverage type is not Medi-Cal, so no Medi-Cal status applies. */
  | "not_applicable";
export type ReferralSource =
  | "probation"
  | "parole"
  | "drug_court"
  | "correctional"
  // §Front-door Phase 4. Deliberately NOT `peer_specialist`: that name belongs
  // to Adelante's own employed, billable StaffRole. A community peer is an
  // outside, unverified referrer and must stay distinct in code and reporting.
  | "community_based_organization"
  | "community_peer"
  | "self"
  | "other";

/** Single source of truth for human-readable referral-source labels. */
export const REFERRAL_SOURCE_LABELS: Record<ReferralSource, string> = {
  probation: "Probation",
  parole: "Parole",
  drug_court: "Drug court / reentry court",
  correctional: "Correctional health",
  community_based_organization: "Community-based organization",
  community_peer: "Community peer specialist (not Adelante staff)",
  self: "Self / family / friend",
  other: "Other",
};

/**
 * Front-door entry sequence (Phase 1). Recorded before intake begins so the
 * downstream flow knows how the person arrived. Types live in
 * `src/lib/frontDoor.ts` so the pure routing logic stays testable.
 */
export interface FrontDoorEntry {
  /** Q1 — "Do you already have a care plan or case manager with Adelante?" */
  existingCare: TriState;
  /**
   * Phase 2 hook. Set when Q1 === "unsure": a later safety-net record lookup
   * picks these up. Phase 1 only writes the flag; nothing consumes it yet.
   */
  recordLookupPending?: boolean;
  /** Q2 — arriving as a family member / advocate. */
  helpingSomeoneElse?: TriState;
  /** Q3 — seeking care for themselves. */
  seekingCareForSelf?: TriState;
  /** Phase 1c — only collected on the general-population path. */
  heardAbout?: HeardAboutSource;
  /** Free text captured on the Q3 = no escape screen (placeholder path). */
  otherHelpNote?: string;
  recordedAt: string;
}

/**
 * §Front-door Phase 2 — the "missed pre-release coordination" flag. Written
 * only by `generateMissedHandoffCatchUp`, after a safety-net lookup came back
 * with no existing record.
 */
export interface MissedPreReleaseFlag {
  flaggedAt: string;
  /** Why the lookup ran: "record_lookup_pending" or "justice_involvement". */
  trigger: "record_lookup_pending" | "justice_involvement";
  /** The person running the intake session, who owns the catch-up list. */
  ownerStaffId?: string;
  ownerName: string;
  ownerRole: string;
  /** The day-one catch-up episode carrying the task list. */
  episodeId: string;
  /** Medi-Cal is flagged for active troubleshooting, never assumed automatic. */
  mediCalFollowUpRequired: boolean;
}

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

/**
 * §Pre-release pipeline — see `Patient.custody`.
 *
 * `source` is a single literal today because the pre-release episode is the
 * only real producer of this fact. It is a field rather than an assumption so
 * a second real source (a genuine jail feed) has somewhere honest to land.
 */
export interface PatientCustody {
  state: "in_custody" | "released" | "unknown";
  source: "pre_release_episode";
  episodeId: string;
  facilityName?: string;
  bookingNumber?: string;
  anticipatedReleaseDate?: string;
  confirmedReleaseDate?: string;
  updatedAt: string;
}


export type SdohStatus =
  | "identified"
  | "sent"
  | "accepted"
  | "scheduled"
  | "completed"
  | "not_completed";
/**
 * §Intake/SDOH Redesign Phase 2 — provenance on a social-need row.
 *
 * Same convention as `ResourceReferralSource` / `CalomsDataSource`: a small
 * closed string union stored on the record itself, never inferred at read
 * time. The values name HOW the need was established, because that changes
 * how much weight it carries:
 *  - `pre_release_hrsn`   a positive domain on the scored CMS AHC-HRSN tool
 *  - `intake_self_report` a checkbox the person ticked in their own intake
 *  - `staff_assessed`     a staff member identified it in the chart
 *  - `advocate_reported`  raised by a linked advocate through coordination
 */
export type SdohItemSource =
  | "pre_release_hrsn"
  | "intake_self_report"
  | "staff_assessed"
  | "advocate_reported";

export const SDOH_SOURCE_LABEL: Record<SdohItemSource, string> = {
  pre_release_hrsn: "From pre-release screening",
  intake_self_report: "Self-reported at intake",
  staff_assessed: "Staff-identified",
  advocate_reported: "Raised by advocate",
};

/**
 * §5d-2 — the AHC-HRSN domain whose needs are staff-only by default.
 * Keyed on the real domain key declared in `AHC_HRSN.domains`.
 */
export const HRSN_SAFETY_DOMAIN_KEY = "safety";

// ---------------------------------------------------------------------------
// §5d-3 — the structured activity log carried by BOTH a social need and a
// resource referral. Append-only and attributed, modelled on `CaseTaskNote`.
// STAFF-ONLY: no patient-facing or advocate-facing selector reads `log`.
// ---------------------------------------------------------------------------

export type SdohLogEntryType =
  | "contact_attempt"
  | "org_update"
  | "client_update"
  | "barrier"
  | "document"
  | "next_step";

export const SDOH_LOG_ENTRY_TYPE_LABEL: Record<SdohLogEntryType, string> = {
  contact_attempt: "Contact attempt",
  org_update: "Update from organization",
  client_update: "Update from client",
  barrier: "Barrier",
  document: "Document",
  next_step: "Next step",
};

export type SdohContactMethod = "phone" | "email" | "in_person" | "portal" | "fax";

export const SDOH_CONTACT_METHOD_LABEL: Record<SdohContactMethod, string> = {
  phone: "Phone",
  email: "Email",
  in_person: "In person",
  portal: "Portal",
  fax: "Fax",
};

/**
 * DRAFT barrier list. Pending clinical review — labelled as such on screen.
 * Not a ratified taxonomy; no category is added outside this list.
 */
export const SDOH_BARRIERS = [
  "transportation",
  "id_documents",
  "eligibility",
  "waitlist",
  "cost",
  "language",
  "schedule_conflict",
  "criminal_record_restriction",
  "lost_contact",
  "other",
] as const;

export type SdohBarrier = (typeof SDOH_BARRIERS)[number];

export const SDOH_BARRIER_LABEL: Record<SdohBarrier, string> = {
  transportation: "Transportation",
  id_documents: "ID / documents",
  eligibility: "Eligibility",
  waitlist: "Waitlist",
  cost: "Cost",
  language: "Language",
  schedule_conflict: "Schedule / work conflict",
  criminal_record_restriction: "Criminal-record restriction",
  lost_contact: "Lost contact",
  other: "Other",
};

export const SDOH_BARRIERS_DRAFT_NOTE =
  "Draft barrier list — pending clinical review. Not a ratified taxonomy.";

export interface SdohLogEntry {
  id: string;
  text: string;
  entryType: SdohLogEntryType;
  authorName: string;
  authorRole: StaffRole;
  at: string;
  /** Contact detail — who at the organization, how, and what came of it. */
  contactName?: string;
  contactMethod?: SdohContactMethod;
  contactResult?: string;
  barriers?: SdohBarrier[];
  documentsNeeded?: string[];
  documentsCollected?: string[];
  nextStep?: string;
  nextStepDueDate?: string;
  /** Set when this entry produced a real `CaseTask`. */
  taskId?: string;
}

/** What a caller may supply; identity and timestamp are stamped here. */
export type SdohLogEntryInput = Omit<SdohLogEntry, "id" | "authorName" | "authorRole" | "at">;

export interface SdohPlanItem {

  id: string;
  need: string;
  /** How this need was established. Required — see `SdohItemSource`. */
  source: SdohItemSource;
  // §5d-2 — NO `referralId` back-pointer. A need can hold many referrals; the
  // link lives on `ResourceReferral.sdohItemId` and is read through
  // `AdelanteEHR.referralsForNeed()`. One source of truth.

  status: SdohStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
  visibleToPatient?: boolean;
  /**
   * §5d-2 — this need came from the interpersonal-safety domain. It defaults
   * to staff-only and every patient- or advocate-facing surface must respect
   * that: someone may be living with the person harming them. Staff can still
   * choose to share it, after an explicit warning.
   */
  safetySensitive?: boolean;

  /**
   * §5d-3 — append-only, attributed activity log. STAFF-ONLY on every need,
   * regardless of `visibleToPatient`.
   */
  log?: SdohLogEntry[];


  /** §5d-1 attribution — who created/last changed this need. */
  createdBy?: string;
  createdByRole?: StaffRole;
  lastUpdatedBy?: string;
  lastUpdatedByRole?: StaffRole;

  /**
   * §Crisis Redesign Phase 2 — SDOH-urgent lane. Set when staff deliberately
   * escalate this need into the crisis queue as `category: "sdoh"`. Urgency is
   * NEVER inferred from the need text or status: marking a social need urgent
   * enough to be worked as a crisis is a human judgement call.
   */
  urgentEscalationId?: string;
  urgentFlaggedBy?: string;
  urgentFlaggedAt?: string;
}

export interface SelfHelpModule {
  key: string;
  title: string;
  cadence: string;
  assignedBy: string;
  completedAt?: string;
}

/**
 * §Phase 3b — how a plan on file got there. There is NO automated eligibility
 * transaction in this app (no 270/271, no clearinghouse), so no value here may
 * claim an electronic verification: a staff-recorded check is the strongest
 * provenance available.
 */
export type CoveragePlanSource =
  | "self_report"
  | "front_desk"
  | "staff_checked"
  /** §Phase 8c — created/updated from an electronic 270/271 response. */
  | "electronic_270_271"
  | ReportedBenefitsSource;

/**
 * §Phase 8b — WHO reported benefits information. Every value is unverified
 * and never counts as a staff eligibility check.
 */
export type ReportedBenefitsSource =
  | "patient_reported"
  | "staff_recorded_patient_report"
  | "referrer_reported"
  | "partner_reported";

export const REPORTED_BENEFITS_SOURCES: ReportedBenefitsSource[] = [
  "patient_reported",
  "staff_recorded_patient_report",
  "referrer_reported",
  "partner_reported",
];

export const REPORTED_SOURCE_LABEL: Record<ReportedBenefitsSource, string> = {
  patient_reported: "Patient reported (self-service intake)",
  staff_recorded_patient_report: "Patient report recorded by staff",
  referrer_reported: "Referrer reported",
  partner_reported: "Partner reported (pre-release roster)",
};

export const COVERAGE_PLAN_SOURCE_LABEL: Record<CoveragePlanSource, string> = {
  ...REPORTED_SOURCE_LABEL,
  self_report: "Client told us",
  front_desk: "Front desk / paperwork",
  staff_checked: "Staff checked with the plan or county",
  electronic_270_271: "Electronic eligibility (270/271)",
};

/**
 * §Phase 3b — a dated payer span on the patient's coverage record. This is the
 * migrated home of the former `CoverageSpan` in `ehr-ext.ts`, which was a
 * second, disconnected coverage shape. `Patient.coverage` is the single source
 * of truth for coverage; this is the "which plan, for what dates" detail it
 * previously lacked.
 *
 * `memberId` is the PLAN-issued member number. It is NOT a CIN — `Patient.cin`
 * is the one canonical CIN, and nothing here may duplicate it.
 */
export interface CoveragePlanSpan {
  id: string;
  payer: string;
  plan?: string;
  memberId?: string;
  /** YYYY-MM-DD */
  from: string;
  /** YYYY-MM-DD; absent means still current. */
  to?: string;
  source: CoveragePlanSource;
  recordedBy?: string;
  recordedByRole?: StaffRole;
  recordedAt?: string;
  /** §Phase 8b — reference-list plan chosen, with its name at that time. */
  managedCarePlanId?: string;
  managedCarePlanName?: string;
  /** §Phase 8c — from an electronic response. */
  aidCode?: string;
  shareOfCostCents?: number;
  /** §Phase 8c — plan name from a response that matched nothing on the list. */
  planNotOnList?: boolean;
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
  /** §Emergency-contact expansion — reachability beyond a single phone. */
  email?: string;
  address?: string;
  /** Free text: "call after 6pm", "does not know about treatment", etc. */
  notes?: string;
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
  /** §Phase 8b — optional benefits the referrer reported; applied at enrollment. */
  reportedBenefits?: IntakeBenefitsAnswers;
  referringAgency: string;
  referrerName: string;
  referrerEmail?: string;
  referrerPhone?: string;
  referralSource: ReferralSource;
  countyOfRelease?: string;
  consentToContact: boolean;
  status: ReferralStatus;
  createdAt: string;
  /**
   * ONLY set when a welcome text genuinely left the building. Before Phase 4a
   * this was stamped at submission time with nothing ever sent.
   */
  smsSentAt?: string;
  /** Real, truthful outcome of the welcome-text attempt. */
  welcomeSms?: {
    status: "sent" | "not_configured" | "failed";
    at: string;
    detail?: string;
  };
  outreachTask?: "manual_call";
  /**
   * §Phase 4c — how the referrer answered "is this individual
   * justice-involved?". Deliberately three-state and optional: unanswered on
   * pre-4c records, and never silently coerced to "no".
   */
  justiceInvolved?: "yes" | "no" | "unsure";
  /**
   * §Phase 4c — truthful log of status-change texts to the REFERRER. Same
   * honesty rule as `welcomeSms`: an entry only exists if a send was really
   * attempted, and only `sent` means a message left the building.
   */
  referrerUpdates?: {
    event: "received" | "contacted" | "enrolled" | "declined";
    status: "sent" | "not_configured" | "failed";
    at: string;
    detail?: string;
  }[];
  // Set when enrollReferral materializes a Patient row.
  enrolledPatientId?: string;
  // ----- §Phase 4a disposition history (who moved this, when, why) ---------
  contactedAt?: string;
  contactedBy?: ReferralActor;
  /** Absent on records created before submission attribution existed. */
  submittedBy?: ReferralSubmitter;
  enrolledAt?: string;
  enrolledBy?: ReferralActor;
  declinedAt?: string;
  declinedBy?: ReferralActor;
  /** Staff-side only — never shown on the public referrer-facing tracker. */
  declineReason?: string;
  declineNote?: string;
  /**
   * §Phase 4e — real manual-outreach work and its attempt trail. Before this
   * existed, `outreachTask: "manual_call"` was a decorative flag: no task, no
   * owner, no due date, and no record that anyone had tried to call.
   */
  outreach?: ReferralOutreachState;
}

/** Real staff attribution for a referral disposition. */
export interface ReferralActor {
  staffId: string;
  name: string;
  role: string;
}

/**
 * Who submitted a referral. Public-form submissions have no authenticated
 * actor, so they are recorded honestly as external — never attributed to
 * whichever staff identity happens to be in the browser.
 */
export type ReferralSubmitter = { kind: "staff"; actor: ReferralActor } | { kind: "external" };

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
  /**
   * §Pre-release build 3 — the pre-release episode this order was initiated
   * from. Traceability only, exactly like `sourceNoteId`: a MAT order started
   * in the pre-release workspace is an ordinary `MedOrder` and follows the
   * same validation, lifecycle and attestation as any other.
   */
  preReleaseEpisodeId?: string;
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
  // §Recovery start date deliberately does NOT live here. It is patient-only
  // self-tracking (`src/lib/selfTracking.ts`) until it is clinically validated
  // as medically necessary. Do not add it back without that sign-off.
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
  /**
   * §Phase 7d — how a general-population patient pays. Set by billing only
   * (via AdelanteEHRExt.setPaymentArrangement). Unset = not recorded yet.
   */
  paymentArrangement?: "self_pay" | "sliding_fee" | "grant_isl";
  /** §Phase 7d follow-up — who last set the arrangement, and when. */
  paymentArrangementSetBy?: { id: string; name: string; role: string; at: string };
  // Medi-Cal eligibility & coverage (§4d)
  coverage?: {
    status: CoverageStatus;
    /** "verified" only with a recorded staff check; patient answers are "self_reported". */
    verified: "verified" | "pending" | "not_found" | "self_reported";
    countyOfRelease?: string;
    jiReentryFlag?: boolean;
    /**
     * Payer bucket — independent of `status` and of justice involvement.
     * A Medicare patient with justice-involvement history is representable:
     * coverageType "medicare" + justiceInvolvement "yes".
     */
    coverageType?: CoverageType;
    /**
     * Justice-involvement history, fully independent of the payer. Drives the
     * reentry safety-net messaging (never the coverage type — see
     * `coverageMessage` in src/lib/frontDoor.ts).
     */
    justiceInvolvement?: TriState;
    ecmEligible?: boolean;
    otherPlanName?: string;
    communitySupports?: {
      housing?: boolean;
      food?: boolean;
      transport?: boolean;
    };
    /**
     * §Front-door Phase 2 — Medi-Cal needs ACTIVE troubleshooting; the passive
     * "reactivates automatically" messaging must not be shown to this person.
     */
    mediCalReactivationFollowUp?: boolean;
    /**
     * §Phase 3b — dated payer spans, migrated here from the former standalone
     * `CoverageSpan` store. Newest first. The outer `status`/`verified` stay
     * the current summary view.
     */
    plans?: CoveragePlanSpan[];

    /**
     * §Phase 3a — append-only log of human eligibility checks, newest first.
     * `verified` above is the current summary; this is who checked and how.
     */
    verifications?: CoverageVerificationRecord[];
    /** §Phase 8b — non-Medi-Cal answer as the person gave it. */
    nonMediCalReport?: NonMediCalReport;
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
  /**
   * §Part B1 — "What are you looking for?" (About You). Content, resources and
   * recommendations only; never changes which screeners are offered. The
   * substance-use choice is NOT stored here: it is merged into the Part 2
   * masked `needs.substanceUse`, and only when Part 2 consent is on file.
   */
  seeking?: { mentalHealth: boolean; medication: boolean; answeredAt: string };
  /**
   * §Part B1 — goals SUGGESTED from the About You answers. They are never on
   * the care plan until a clinician accepts one (attributed + audited).
   */
  suggestedGoals?: SuggestedGoal[];
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
  /**
   * §Emergency-contact expansion — the real list. `emergencyContact` above is
   * kept in sync with the first entry so pre-existing read sites still work.
   */
  emergencyContacts?: EmergencyContact[];
  /**
   * §Self-service sign-up — PROTOTYPE ONLY. Records that the person chose a
   * password/PIN at sign-up. The secret itself is never stored and nothing
   * verifies it; see the honesty note in `src/lib/signup.ts`.
   */
  signupCredential?: SignupCredentialMeta;
  /**
   * §Front-door Phase 3 — who, if anyone, helped this person sign up.
   * Tier 1 is unverified free text; Tier 2 is a real authenticated staff
   * operator. Absent for unassisted self-service AND for staff-provisioned
   * Track A records, which are unchanged.
   */
  signupAssistedBy?: HelperAttribution;
  address?: string;
  /** CIN / Medi-Cal ID (9 characters). Helps disambiguate similar names. */
  cin?: string;
  // Link back to the referral that enrolled this patient, if any.
  referralId?: string;
  /**
   * Front-door entry sequence (Phase 1) — how this person arrived, captured
   * before intake begins. See `src/lib/frontDoor.ts`.
   */
  frontDoor?: FrontDoorEntry;
  /**
   * §Front-door Phase 2 — set when the safety-net lookup found no existing
   * record for someone who should have had pre-release coordination. Staff
   * see this so a day-one catch-up task list makes sense outside the normal
   * 90-day pre-release window.
   */
  missedPreReleaseCoordination?: MissedPreReleaseFlag;
  // Appointment-related notifications (booked / rescheduled / cancelled).
  notifications?: ApptNotification[];
  // §Messaging Phase 2 — one ongoing care-team thread per patient.
  careMessages?: CareMessage[];
  // ----- MVP EMR extension (all optional, backward compatible) -----
  /** Linked treatment episodes (not collapsed). §3a */
  episodes?: Episode[];
  /** Release date provenance. §3c — coexists with the flat `releaseDate` string. */
  releaseDateMeta?: ReleaseDateMeta;
  /**
   * §Pre-release pipeline — custody state carried FORWARD from the real
   * pre-release episode, not inferred.
   *
   * Deliberately NOT derived from `Booking`: the pre-release surface never
   * creates a booking row, so booking-derived custody is silently wrong for
   * this whole population. The booking-derived checks elsewhere (facility
   * protocol tagging, facility views) are untouched and keep their own
   * meaning — this field is the episode's own statement about the person.
   *
   * ABSENCE MEANS UNKNOWN, never "not in custody".
   */
  custody?: PatientCustody;

  /** SDOH need → referral → closed-loop status. §3e */
  sdohPlan?: { items: SdohPlanItem[] };
  /**
   * §Reporting Tier 2 — structured CalOMS-shaped history (substance use,
   * prior treatment, discharge) plus the SELF-REPORTED justice-involvement
   * estimates. See `src/lib/caloms.ts` for why employment and living
   * arrangement are deliberately NOT duplicated in here.
   */
  calomsProfile?: CalomsProfile;
  /** Assigned self-help modules with completion. §3f */
  selfHelpPlan?: { modules: SelfHelpModule[] };
  /** External coordination log (§4-CM). */
  externalContacts?: ExternalContact[];
  coordinationLog?: CoordinationEntry[];
  /** Peer-specialist notes. */
  peerNotes?: PeerNote[];
  /** Per-flag context notes for eligibility (source, as-of, why). */
  eligibilityNotes?: Partial<Record<EligibilityFlagKey, EligibilityNote>>;
  /** §Phase 3a — append-only attribution for every eligibility-flag change. */
  eligibilityFlagLog?: EligibilityFlagEvent[];

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
  // ----- §Adelante Journey Phase 5 — self-help Library / Exercises ---------
  //
  // DELIBERATELY ABSENT. Library/Exercise progress is engagement data, not
  // clinical documentation, and lives in `src/lib/engagement.ts` keyed by
  // patient id. Do not add `completedLibraryItems` / `completedExercises` /
  // `savedToolkitItems` back here — the whole point is that the designated
  // clinical record does not carry, export or disclose them.
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
  /**
   * §Pre-release build 2 — population-health fields. All optional, so every
   * result written before this build stays valid.
   */
  /** Raw item responses, in question order. */
  responses?: number[];
  /** True when the total met the instrument's standard positive cutoff. */
  positive?: boolean;
  /** Per-domain positivity for domain instruments (AHC-HRSN). */
  domains?: ScreenerDomainResult[];
  /** Where the result was administered, for cohort slicing. */
  context?: "intake" | "pre_release" | "patient_self" | "clinic";
  /** Set when administered inside a pre-release episode. */
  episodeId?: string;
  /**
   * §Part 2 author/actor exception — WHO personally administered this specific
   * result. Same `CfAttribution` shape the pre-release build already produces
   * (`enteredBy` plus, for proxy entries, the CF Care Manager the work is
   * attributed to), so there is no parallel identity mechanism. Absent for
   * patient-self and legacy results.
   */
  administeredBy?: CfAttribution;
  /**
   * §Pre-release pipeline — how this result got here.
   *
   * "imported_roster" means a partner sent domain-level yes/no in a
   * spreadsheet: no item responses exist and no score was computed, so this
   * must never be read or displayed as an administered, scored interview.
   * Absent means the instrument was actually administered in the app.
   */
  provenance?: "imported_roster";
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

/**
 * How an appointment came to exist. Same convention as `SdohItemSource` /
 * `CalomsDataSource` / `ResourceReferralSource`: a small string union plus a
 * `*_SOURCE_LABEL` record for display. No second convention.
 *
 *  - `pre_release`     arranged by the pre-release / reentry team on a care plan
 *  - `self_scheduled`  the patient booked it themselves in the portal
 *  - `staff_scheduled` a staff member booked it from a staff surface
 */
export type AppointmentSource = "pre_release" | "self_scheduled" | "staff_scheduled";

export const APPOINTMENT_SOURCE_LABEL: Record<AppointmentSource, string> = {
  pre_release: "Arranged before release",
  self_scheduled: "Booked by patient",
  staff_scheduled: "Booked by staff",
};

export interface SuggestedGoal {
  id: string;
  text: string;
  reason: "seeking_medication" | "seeking_mental_health";
  status: "suggested" | "accepted" | "dismissed";
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  decidedByRole?: string;
  /** The Goal created on acceptance. */
  goalId?: string;
}

export const SUGGESTED_GOAL_TEXT: Record<SuggestedGoal["reason"], string> = {
  seeking_medication: "Meet with a prescriber about medication",
  seeking_mental_health: "Start regular counseling sessions",
};

export interface Appointment {
  id: string;
  patientId: string;
  clinicianId: string;
  start: string; // ISO
  durationMin: number;
  status: SessionStatus;
  /** How this appointment was created. Required — see `AppointmentSource`. */
  source: AppointmentSource;
  videoUrl?: string;
  fundingLane?: FundingLane;
  /** What kind of visit this is (added in scheduling v2). */
  serviceType?: ServiceType;
  /** How the visit happens. Legacy rows may be undefined; treat as "video". */
  modality?: "video" | "phone" | "in_person";
  /** Required when modality === "in_person". */
  locationId?: string;
  /**
   * Optional per-visit charge override. §Phase 7b — billing STATUS lives only
   * on the Claim (ehr-ext.ts); the amount is read once, at claim creation,
   * through `claimChargeCents`.
   */
  chargeCents?: number;
  /** When funding lane is ISL, why this encounter fell into ISL. */
  islReason?: "uninsured" | "benefit_exhausted" | "restricted_setting";
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

/**
 * §Phase 4 step 1 — the referral category vocabulary IS the real directory
 * vocabulary. These ids are `RESOURCE_CATEGORIES[].id` from
 * `communityResources.ts`, verbatim (a test asserts the two stay identical).
 * Declared literally here so `ehr.ts` stays free of a content-module import.
 */
export type ResourceReferralCategory =
  | "housing"
  | "emergency_shelter"
  | "food"
  | "employment"
  | "transportation"
  | "recovery_meetings"
  | "support_groups"
  | "family_reunification"
  | "healthcare"
  | "education"
  | "parenting"
  | "financial"
  | "legal"
  | "life_skills";

/** Where a referral came from. Mirrors `CarePlanSdohSlice.source`'s real value. */
export type ResourceReferralSource = "internal" | "pre_release";

/**
 * §5d-2 — real referral outcomes. The three earlier values map honestly:
 *  - `pending`   unchanged
 *  - `accepted`  -> `connected` (a partner accepting the person is the
 *                  strongest "link made" signal that value ever carried)
 *  - `completed` -> `closed`    (work finished; it never claimed success, so
 *                  it must not silently become `connected`)
 */
export type ResourceReferralOutcome =
  | "pending"
  | "connected"
  | "waitlisted"
  | "not_eligible"
  | "declined_by_client"
  | "unreachable"
  | "closed";

export const RESOURCE_REFERRAL_OUTCOMES: ResourceReferralOutcome[] = [
  "pending",
  "connected",
  "waitlisted",
  "not_eligible",
  "declined_by_client",
  "unreachable",
  "closed",
];

export const RESOURCE_REFERRAL_OUTCOME_LABEL: Record<ResourceReferralOutcome, string> = {
  pending: "Pending",
  connected: "Connected",
  waitlisted: "Waitlisted",
  not_eligible: "Not eligible",
  declined_by_client: "Declined by client",
  unreachable: "Unreachable",
  closed: "Closed",
};

/** Outcomes that end the referral's active work. */
export const RESOURCE_REFERRAL_CLOSED_OUTCOMES: ResourceReferralOutcome[] = [
  "not_eligible",
  "declined_by_client",
  "unreachable",
  "closed",
];


export interface ResourceReferral {
  id: string;
  category: ResourceReferralCategory;
  /**
   * Free text, always the record of truth for WHO the person was sent to.
   * For an external referral (out of area, not yet sourced, stale info) this
   * is the only identification there is — and it keeps working exactly as
   * before when `resourceId` is absent.
   */
  provider: string;
  /**
   * Optional link to a real directory org (`CommunityResource.id`). When set
   * the referral is closed-loop against a real listing. It is NEVER cleared
   * when that listing is later unpublished or removed — see
   * `resourceLinkState()` in `referralLinks.ts`, which flags the link as no
   * longer active while the referral record itself stays intact.
   */
  resourceId?: string;
  /** Internal care-team referral vs. one ingested from a release assessment. */
  source?: ResourceReferralSource;
  /**
   * §5d-2 — the real need this referral was made for. A need can hold MANY
   * referrals over time (first org waitlisted, second connected), so the link
   * is stored here and only here; `SdohPlanItem` holds no back-pointer and
   * `referralsForNeed()` is the one lookup.
   */
  sdohItemId?: string;
  status: ResourceReferralOutcome;
  /** §5d-2 — why the outcome is what it is. Required for any non-pending outcome. */
  outcomeReason?: string;

  createdAt: string;
  updatedAt?: string;
  note?: string;
  followUpDate?: string;
  /**
   * §5d-3 — append-only, attributed activity log. STAFF-ONLY, and masked with
   * the rest of the row for a Part 2-gated viewer on a SUD-sensitive category.
   */
  log?: SdohLogEntry[];
  visibleToPatient?: boolean;
  // 42 CFR Part 2 guardrail — must be true to share SUD-identifying detail externally.
  // §5d-1: stamped by the data layer from the patient's LIVE consent at creation,
  // never from the acting viewer's own access level.
  sudDisclosureConsent?: boolean;
  /** §5d-1 attribution — who created/last changed this referral. */
  createdBy?: string;
  createdByRole?: StaffRole;
  lastUpdatedBy?: string;
  lastUpdatedByRole?: StaffRole;
}

/**
 * §5d-1 — referral categories whose very existence can disclose SUD treatment
 * status. Same two the patient-facing matcher already refuses to name
 * (`sdohResourceMatch.ts`), which imports THIS constant so the two sides can
 * never drift. Other categories (housing, legal, healthcare…) are not
 * SUD-identifying by category.
 */
export const PART2_SENSITIVE_REFERRAL_CATEGORIES: readonly ResourceReferralCategory[] = [
  "recovery_meetings",
  "support_groups",
];

export function isPart2SensitiveCategory(category: string): boolean {
  return (PART2_SENSITIVE_REFERRAL_CATEGORIES as readonly string[]).includes(category);
}

/** Thrown when a Part 2 sensitive referral is attempted without patient consent. */
export class Part2ConsentRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Part2ConsentRequiredError";
  }
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

/**
 * §Phase 3a — how a human actually checked Medi-Cal eligibility. There is NO
 * automated eligibility check in this app (no 270/271, no clearinghouse, no
 * EDI — see the Build 2 note on the admin dashboard). Every value here
 * describes a channel a staff member used themselves and is recording after
 * the fact.
 */
export type CoverageCheckChannel =
  | "phone_county"
  | "medi_cal_portal"
  | "fax"
  | "in_person"
  | "other"
  /** §Phase 8b — someone REPORTED coverage; nobody checked. Never a staff check. */
  | "reported"
  /** §Phase 8c — the payer's own electronic answer. Counts as verified; always
   *  labelled "Electronic". Written only by applyEligibilityResponse. */
  | "electronic_270_271";

export const COVERAGE_CHECK_CHANNEL_LABEL: Record<CoverageCheckChannel, string> = {
  phone_county: "Phone — county / plan",
  medi_cal_portal: "Medi-Cal provider portal (checked by hand)",
  reported: "Reported — needs staff verification",
  electronic_270_271: "Electronic eligibility (270/271)",
  fax: "Fax reply",
  in_person: "In person — card or paperwork seen",
  other: "Other channel",
};

/**
 * What a human check found. Deliberately SEPARATE from `coverage.status`:
 * recording that someone looked is not the same claim as "this person is
 * covered", and the two must never be set by one unattributed click.
 */
export type CoverageCheckResult = "verified" | "not_found" | "pending";

export interface CoverageVerificationRecord {
  id: string;
  checkedAt: string;
  checkedBy: string;
  checkedByRole: StaffRole;
  channel: CoverageCheckChannel;
  /** Free text — who was spoken to, reference number, what the portal said. */
  channelNote?: string;
  result: CoverageCheckResult;
  /**
   * Whether `Patient.cin` was on file at the time of the check. The CIN value
   * itself is NEVER copied here — `Patient.cin` is the one canonical field
   * (see the Phase 3a investigation); a second copy could silently disagree.
   */
  cinOnFile: boolean;
  /** True when this check is what first put a CIN on the patient record. */
  cinRecordedNow?: boolean;
  /** Coverage status the checker explicitly confirmed, if they confirmed one. */
  statusConfirmed?: CoverageStatus;
  /**
   * §Phase 8b — present ONLY on reported (not checked) records. A record with
   * a reportSource is never a staff check, whatever its other fields say.
   */
  reportSource?: ReportedBenefitsSource;
  /** §Phase 8c — present only on electronic records. */
  electronic?: ElectronicEligibilityDetail;
}

/** §Phase 8c — what an electronic 270/271 response carried. */
export type ElectronicResponseStatus = "active" | "inactive" | "not_found" | "error";
export interface ElectronicEligibilityDetail {
  /** 270 trace / transaction id. */
  transactionId: string;
  vendor: string;
  /** Pointer to the stored raw response — NEVER the payload itself. */
  rawResponseRef?: string;
  responseStatus: ElectronicResponseStatus;
  errorReason?: string;
  benefits?: {
    aidCode?: string;
    shareOfCostCents?: number;
    managedCarePlan?: { payerName: string; planId?: string; matchedListId?: string; matchedListName?: string };
    coverageStart?: string;
    coverageEnd?: string;
    payerId?: string;
  };
}

/**
 * §Phase 8b/8c — true for a record that COUNTS as a check: a human staff check
 * or an electronic payer response. Reported records never count.
 */
export function isStaffCheck(v: CoverageVerificationRecord): boolean {
  return !v.reportSource;
}
export function isElectronicCheck(v: CoverageVerificationRecord): boolean {
  return v.channel === "electronic_270_271";
}

/** §Phase 8b — what a non-Medi-Cal person told us about paying. */
export type NonMediCalReport =
  | "no_insurance"
  | "private_insurance"
  | "prefer_self_pay"
  | "medicare"
  | "other"
  | "unknown";

/** §Phase 8b — answers from the shared benefits step. */
export interface IntakeBenefitsAnswers {
  /** Absent = nothing said about coverage type (e.g. a roster row with only a CIN). */
  coverageType?: CoverageType;
  nonMediCalReport?: NonMediCalReport;
  cin?: string;
  managedCarePlan?: { id: string; name: string; kind: "plan" | "ffs" | "other" | "unknown"; otherName?: string };
  mediCalStatus?: CoverageStatus;
  /** Private-insurance plan name, or "other" description. */
  planName?: string;
}

export interface IntakeBenefitsResult {
  ok: boolean;
  error?: string;
  cinWritten: boolean;
  cinMismatch: boolean;
  cinDuplicate?: string;
  planSpanAdded: boolean;
  verificationAdded: boolean;
  taskId?: string;
}

export const CIN_RE = /^[A-Z0-9]{9}$/;
export function normalizeCinValue(v: string): string {
  return v.replace(/\s+/g, "").toUpperCase();
}

/** §Phase 3a — one attributed change to an eligibility flag. Append-only. */
export interface EligibilityFlagEvent {
  id: string;
  key: EligibilityFlagKey;
  value: boolean;
  at: string;
  actorId: string;
  actorRole: StaffRole;
}

/** Who performed a Medi-Cal action. Required on every Phase 3a mutation. */
export interface CoverageActor {
  actorId: string;
  actorRole: StaffRole;
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
  /** §Pre-release build 4 — this row came out of the pre-release episode. */
  source?: "pre_release";
}
export interface CarePlanSdohSlice {
  need: string;
  status: SdohStatus;
  /** §Pre-release build 4 — identified by the pre-release AHC-HRSN screening. */
  source?: "pre_release";
}

/**
 * §Pre-release build 4 — CalAIM continuity slice.
 *
 * The CalAIM requirement is that the plan SURVIVES the custody→community
 * transition, so the reconciliation runs pre-release → CalAIM, live, and it
 * is recomputed while the person is still in custody (not only at release):
 * the ECM Provider must be able to see the plan they are inheriting BEFORE
 * day zero, and there must be no window in which the plan is blank.
 *
 * Every field here is DERIVED at recompute time from the real records
 * (episode, capacity determination, advocate links, chart orders, scheduling
 * store, screener results) — nothing is copied, so nothing goes stale.
 */
export interface CarePlanPreReleaseSlice {
  episodeId: string;
  status: PreReleaseEpisodeStatus;
  anticipatedReleaseDate: string;
  facilityName?: string;
  receivingEcmStaffId?: string;
  /** Build-1 capacity gate state, e.g. "self_consent" / "surrogate_required". */
  capacityState: string;
  /** Build-1 designations — names only, no invitation material. */
  advocates: { name: string; relationship?: string; authorizationType?: string }[];
  /** Build-3 bookings, resolved live against the real scheduling store. */
  appointments: {
    kind: ReentryAppointmentKind;
    start: string;
    providerName: string;
    status?: string;
  }[];
  /** Count of pre-release screenings on the chart. */
  screeningsCaptured: number;
  housingArrangement?: string;
  /**
   * Build-3 MAT — 42 CFR Part 2 content. Present in the snapshot but ALWAYS
   * flagged sensitive; surfaces must gate it exactly like the SUD slices.
   */
  matMedications: { name: string; status: string }[];
  /** True when any Part 2-covered content is present in this slice. */
  sensitive: boolean;
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
  /**
   * §Pre-release build 4 — present whenever the patient has (or had) a
   * pre-release episode, so the community-side care plan already reflects
   * custody-side work instead of starting blank at release.
   */
  preRelease?: CarePlanPreReleaseSlice;
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
  /**
   * `assisted_signup` is the manual stopgap flag raised by a helper during an
   * assisted intake/sign-up. It is a SIGNAL SOURCE into the same escalation
   * record — kept distinct from `manual` (clinician-initiated from the chart)
   * and `screener_score` so the automated-vs-manual catch rate is measurable.
   */
  triggerSource:
    | "manual"
    | "screener_score"
    | "assisted_signup"
    | "message_pattern"
    /**
     * §Build A item 5 — the patient asked for their care team themselves from
     * /crisis. Same escalation record, same queue, same out-of-band alert:
     * only the attribution differs, so a self-initiated ask stays visibly
     * distinct from a clinician flag or an automated text catch.
     */
    | "patient_request"
    /**
     * §Crisis Redesign Phase 2 — an SDOH plan item a staff member marked
     * urgent enough to work as a crisis (housing loss tonight, no meds and no
     * transport, etc.). Always written with `category: "sdoh"`.
     */
    | "sdoh_urgent";
  /** e.g. "PHQ-9 total 22 (severe band)" or the manual reason. */
  triggerDetail?: string;
  triggeredBy: string;
  triggeredAt: string;
  status: "open" | "resolved";
  /**
   * §Crisis Redesign Phase 1 — DRAFT CLASSIFICATION, NOT A CLINICAL TAXONOMY.
   * Structure only, so severity/category can be reported on and refined once
   * Christi / Dr. Bagga make the real clinical decision. Every trigger that
   * exists today writes `critical` / `clinical`, because that is genuinely
   * what every one of them is right now: `flagCrisis` hardcodes a critical
   * linked PatientAlert for all sources and there is no SDOH lane at all.
   * `classificationStatus` is what the UI reads to render the
   * "draft — pending clinical review" indicator; do NOT promote anything to
   * "reviewed" in code without that sign-off.
   */
  severity: CrisisSeverity;
  category: CrisisCategory;
  classificationStatus: "draft" | "reviewed";
  /**
   * §Crisis Redesign Phase 1 — claim/assignment. Claiming is advisory, not a
   * lock: it exists so two responders do not both work the same row. Anyone
   * with queue write access can still resolve an unclaimed or other-claimed
   * escalation; nothing is blocked on the claim.
   */
  claimedBy?: string;
  claimedAt?: string;
  /**
   * §Crisis Redesign Phase 1 — re-trigger. A second real signal while this row
   * is still open is NO LONGER DROPPED: it appends here and bumps
   * `lastTriggeredAt`, so the repeat is visible instead of silent.
   */
  retriggers?: CrisisRetrigger[];
  /** Most recent signal on this row — equals `triggeredAt` until a re-trigger. */
  lastTriggeredAt?: string;
  /**
   * §Crisis Redesign Phase 2 — aging / SLA. Stamped ONCE, the first time a
   * sweep observes this row past its DRAFT response threshold (see
   * `src/lib/crisisPolicy.ts`). Presence of the stamp is what stops the
   * supervisor re-notification firing on every sweep tick.
   */
  slaBreachAt?: string;
  contactedWhom?: string;
  actionsTaken?: string;
  /**
   * §Crisis Redesign Phase 2 — structured disposition. `dispositionCode` is
   * the picked DRAFT category (see CRISIS_DISPOSITIONS in
   * `src/lib/crisisPolicy.ts`); `disposition` stays the human-readable string
   * so every existing reader, audit entry and alert-removal reason keeps
   * working. `other` carries its real free text in `disposition`.
   */
  dispositionCode?: string;
  disposition?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionReason?: string;
}

/**
 * DRAFT severity ladder — clearly-labeled placeholder structure, pending real
 * clinical review. Do not add values or reassign meaning without that review.
 */
export type CrisisSeverity = "critical" | "urgent" | "routine";

/** DRAFT category set — same caveat as CrisisSeverity. */
export type CrisisCategory = "clinical" | "sdoh" | "unclassified";

export interface CrisisRetrigger {
  at: string;
  by: string;
  detail: string;
}

/** Shown wherever a draft severity/category value is rendered. */
export const CRISIS_CLASSIFICATION_DRAFT_LABEL =
  "Draft classification — pending clinical review";

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

/**
 * §Scheduling rules — the cadence-window idempotency check, shared by the dry
 * run and the real run so a preview can never disagree with what commits.
 * Counts completed and cancelled tasks too: checking only open tasks would
 * re-spam the moment the first one is worked.
 */
function _ruleCadenceBlocked(rule: SchedulingRule, patientId: string, now: number): boolean {
  const windowMs = rule.cadenceMinutes * 60_000;
  return caseTasks.some(
    (t) =>
      t.sourceRuleId === rule.id &&
      t.patientId === patientId &&
      now - +new Date(t.createdAt) < windowMs,
  );
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
  /**
   * §EHR audit Phase 1d — the persisted attestation + drawn signature, built
   * by the shared primitive in `attestation.ts`. Carries the frozen wording
   * the signer actually read (`statementSnapshot` / `statementVersion`), the
   * same way `RefusalForm` freezes its risk text. Optional: notes signed
   * before this existed, and non-interactive/test paths, have none.
   */
  attestation?: AttestationRecord;

  cosignRequired?: boolean;
  /** Roles eligible to cosign. Empty/undefined = any eligible clinical role. */
  cosignRole?: string[];
  cosignedBy?: string;
  cosignedAt?: string;
  cosignComment?: string;
  /** §Phase 7b.1 — signer identity as recorded at signing (not the session). */
  signedById?: string;
  signedRole?: string;
  cosignedById?: string;
  cosignedRole?: string;
  /** §Phase 7b.1 — the cosigner's own versioned attestation + drawn mark. */
  cosignAttestation?: AttestationRecord;
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
  /**
   * §EHR audit Phase 2b — scope tier. Absent on every pre-2b row, which means
   * `global`: those templates were authored by admins and are visible to
   * everyone today, so that is their honest existing meaning.
   */
  scope?: TemplateScope;
  /** Set when `scope === "department"`. A discipline id from `templateScope.ts`. */
  departmentId?: string;
  /** Set when `scope === "personal"`. The owning StaffMember id. */
  ownerStaffId?: string;
  /**
   * Provenance for a personal clone. Recorded for display only — a clone has
   * its own independent version chain and never touches the source's.
   */
  clonedFrom?: { templateId: string; key: string; version: number; title: string };
  /** Locked field keys inherited from the source at clone time. */
  inheritedLockedKeys?: string[];
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
  // §Group sessions — the former generic `group_participation` PLACEHOLDER is
  // gone. Christi's answer describes TWO distinct concerns, so they are two
  // keys, not one with sub-fields:
  //   1. telehealth consent   -> the pre-existing `telehealth_services` key
  //      below (a real, required, per-member gate on virtual participation);
  //   2. group confidentiality acknowledgment -> `group_confidentiality_ack`,
  //      OPTIONAL and county-configurable (default OFF). NOT a DHCS mandate.
  | "group_confidentiality_ack"
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
  | "advocate_sud_disclosure"
  // §Adelante Journey Phase 3 — the ONE new category the PO two-tier split
  // needs. It covers ONLY voluntary, patient-controlled care-coordination
  // sharing with a probation/parole officer. Legally MANDATED PO disclosure
  // deliberately has NO category here: it is not consent-based and must never
  // be representable as a revocable authorization. See src/lib/poDisclosure.ts.
  | "po_voluntary_coordination";

// §Adelante Journey Phase 3 — the category the PO two-tier split
// needs. It covers ONLY voluntary, patient-controlled care-coordination
// sharing with a probation/parole officer. Legally MANDATED PO disclosure
// deliberately has NO category here: it is not consent-based and must never
// be representable as a revocable authorization. See src/lib/poDisclosure.ts.
// PLACEHOLDER label, same discipline as every other category in this file.

export const CONSENT_CATEGORIES: { key: ConsentCategory; label: string }[] = [
  { key: "sud_treatment", label: "SUD treatment (placeholder)" },
  { key: "mental_health", label: "Mental health (placeholder)" },
  { key: "case_coordination", label: "Case coordination (placeholder)" },
  { key: "billing", label: "Billing (placeholder)" },
  {
    key: "group_confidentiality_ack",
    label:
      "Group confidentiality acknowledgment — optional, county-configurable (placeholder wording)",
  },
  { key: "pre_release_services", label: "Pre-release services (placeholder)" },
  {
    key: "telehealth_services",
    label:
      "Telehealth services consent — required before virtual participation (placeholder wording)",
  },
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
  {
    key: "po_voluntary_coordination",
    label:
      "Voluntary care-coordination sharing with probation/parole — patient-controlled, revocable (placeholder)",
  },
];

/** The ONLY consent category a probation/parole disclosure may ever turn on. */
export const PO_VOLUNTARY_CONSENT_CATEGORY: ConsentCategory = "po_voluntary_coordination";

/** The ASCMI category a DHCS Collateral advocate's access hard-depends on. */
export const COLLATERAL_ROI_CATEGORY: ConsentCategory = "roi_collateral";

/**
 * §Group sessions — telehealth. Reuses the EXISTING `telehealth_services`
 * ConsentRecord category rather than minting a group-specific one: the
 * disclosure elements below are about telehealth as a delivery mode, not
 * about groups, and a member who consented to telehealth for individual care
 * has consented to the same disclosures.
 */
export const TELEHEALTH_CONSENT_CATEGORY: ConsentCategory = "telehealth_services";

/** Optional (default OFF) county-configurable group confidentiality ack. */
export const GROUP_CONFIDENTIALITY_CATEGORY: ConsentCategory = "group_confidentiality_ack";

/**
 * REAL DHCS-required disclosure elements for telehealth consent. The legal
 * WORDING is still placeholder and flagged as such in the capture UI, but
 * these four elements are real content and must actually be presented.
 */
export const TELEHEALTH_DISCLOSURE_ELEMENTS: { key: string; text: string }[] = [
  {
    key: "right_to_in_person",
    text: "You have the right to receive these services in person instead of by video or phone.",
  },
  {
    key: "voluntary_revocable",
    text: "Telehealth is voluntary. You may withdraw this consent at any time without losing services.",
  },
  {
    key: "transportation_benefits",
    text: "Telehealth can remove travel time, transportation cost and childcare barriers to attending.",
  },
  {
    key: "limitations",
    text: "Telehealth has limitations: no hands-on assessment, possible technology failure, and privacy depends on where you take the session.",
  },
];

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
  /**
   * §Pre-release intake build 1 — the EARLY, required branch point. Listed
   * first because it is sequenced first: nothing consent-dependent below it
   * may honestly proceed until it is answered.
   */
  | "capacity_authority"
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
    key: "capacity_authority",
    label: "Capacity & legal authority",
    helper:
      "Required first. Can this individual participate in and consent to their own intake — and if not, who legally can?",
  },
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
  /**
   * §Pre-release intake build 1 — satisfied by the capacity & legal-authority
   * determination, not by field capture. Exactly one def carries this.
   */
  satisfiedByCapacityStep?: boolean;
  /**
   * This step depends on somebody being able to CONSENT. It is blocked (and
   * visibly flagged) whenever the capacity gate says nobody currently can —
   * either because capacity was never determined, or because the individual
   * is impaired and no legal-authority instrument is in force.
   */
  requiresConsentCapacity?: boolean;
  /**
   * §Pre-release build 2 — satisfied by REAL completed screener results
   * (`ScreenerResult` keys), not by field capture. The checklist row reads the
   * patient's ordinary screener record; `savePreReleaseForm` refuses these
   * defs so a placeholder flag can never stand in for a real instrument.
   */
  satisfiedByScreeners?: string[];
}

export const PRE_RELEASE_FORMS: PreReleaseFormDef[] = [
  {
    key: "capacity_authority",
    category: "capacity_authority",
    label: "Capacity determination & advocate/legal authority",
    fields: [],
    satisfiedByCapacityStep: true,
  },
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
      {
        key: "suspensionStatus",
        label: "Suspension status",
        type: "select",
        options: ["Unknown", "Suspended", "Active", "Terminated"],
      },
      {
        key: "anticipatedReleaseDate",
        label: "Anticipated release date",
        type: "date",
        required: true,
      },
    ],
  },
  {
    key: "dhcs_hra",
    category: "clinical_assessment",
    label: "Health-Related Social Needs screening (AHC-HRSN core)",
    fields: [],
    // Real instrument, administered and stored exactly like AUDIT-10/DAST-10.
    satisfiedByScreeners: ["ahc-hrsn"],
    requiresConsentCapacity: true,
  },
  {
    key: "bh_sud_loc",
    category: "clinical_assessment",
    label: "SUD screening — AUDIT-10 & DAST-10",
    requiresConsentCapacity: true,
    fields: [],
    satisfiedByScreeners: ["audit", "dast-10"],
  },
  {
    key: "informed_consent_prerelease",
    category: "release_consent",
    label: "Informed Consent for Pre-Release Services (placeholder)",
    fields: [],
    consentCategory: "pre_release_services",
    requiresConsentCapacity: true,
  },
  {
    key: "telehealth_consent",
    category: "release_consent",
    label: "Telehealth Informed Consent (placeholder)",
    fields: [],
    consentCategory: "telehealth_services",
    requiresConsentCapacity: true,
  },
  {
    key: "information_sharing_authorization",
    category: "release_consent",
    label: "Information Sharing / Disclosure Authorization (placeholder)",
    fields: [],
    consentCategory: "information_sharing_disclosure",
    requiresConsentCapacity: true,
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

/**
 * §Pre-release build 3 — the prescriber gate for MAT ordering.
 *
 * Deliberately NOT a pre-release-specific permission: it is the SAME
 * `meds_erx` write level the Orders tab and the note orders_section already
 * use to decide who may place a medication order. If the matrix changes, the
 * pre-release entry point changes with it.
 */
export function canPrescribeMedications(role: StaffRole): boolean {
  return canAccess(role, "meds_erx").level === "write";
}

/**
 * Which real `ServiceType` each reentry appointment kind books against. The
 * pre-release step books into the ordinary scheduling system; this map only
 * chooses a sensible default service for the kind.
 */
export const REENTRY_APPT_SERVICE_TYPE: Record<ReentryAppointmentKind, ServiceType> = {
  mental_health: "therapy_individual",
  med_management: "med_management",
  sud: "therapy_individual",
};

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
  /**
   * §Front-door Phase 2 — this episode was opened AFTER release, at intake,
   * because pre-release coordination never happened. Same forms, same tasks,
   * compressed into day one.
   */
  missedHandoff?: boolean;
  /**
   * §Pre-release pipeline — the CONFIRMED release date, set when a human
   * confirms the person is actually out. Before this existed the confirmed
   * date was written only into an audit detail blob and was unqueryable.
   * `anticipatedReleaseDate` above stays untouched: anticipated and actual are
   * different facts and both are worth keeping.
   */
  actualReleaseDate?: string;
  /**
   * §Pre-release pipeline — booking number as supplied by the correctional
   * partner. A free-text identifier, NOT a link to a `Booking` row: the
   * pre-release surface never creates one, and inventing a booking from a
   * spreadsheet cell would make the custody inference elsewhere lie.
   */
  bookingNumber?: string;
}

export type PreReleaseFormStatus = "not_started" | "in_progress" | "complete";

/**
 * §Pre-release intake build 1 — the recorded answer to the capacity question,
 * plus the advocate links identified off the back of it.
 *
 * The advocate links are POINTERS into the existing four-tier model. Nothing
 * about authority is duplicated here: whether an instrument is in force is
 * always re-read live through `advocateAccess`.
 */
export interface PreReleaseCapacityDetermination {
  id: string;
  episodeId: string;
  patientId: string;
  status: IntakeCapacityStatus;
  /** What the CF Care Manager observed, in their own words. */
  basis: string;
  determinedBy: string;
  determinedByRole: string;
  determinedAt: string;
  /**
   * Same CF attribution every other pre-release entry carries: who keyed it,
   * and whose episode work it belongs to when proxy-entered.
   */
  attribution: CfAttribution;
  /**
   * Advocates identified during this step, in invitation order. The expected
   * instrument is what the CF Care Manager BELIEVES is out there; the real
   * `authorizationType` is only ever set by the advocate at claim time, which
   * is why both are kept.
   */
  identifiedAdvocates: {
    advocateLinkId: string;
    expectedAuthorization:
      | LegalAuthorityType
      | "hipaa_authorization"
      | "dhcs_authorized_representative"
      | "family_participation";
  }[];
}

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
  /** Present for pre-release codes; absent for §9a record-claim codes. */
  episodeId?: string;
  carePlanId?: string;
  /** §Phase 9a — why the code exists. Absent on older rows = pre_release. */
  purpose?: "pre_release" | "record_claim";
  /** §Phase 9a — staff id of whoever issued a record-claim code. */
  issuedBy?: string;
  issuedAt: string;
  expiresAt: string;
  consumedAt?: string;
  consumedBy?: string;
}

/**
 * §Phase 9a — roles that may issue a sign-in (record-claim) code. Mirrors who
 * can issue a pre-release code today: the CF Care Manager (owner) and an ECM
 * Provider (proxy entry). Nobody else.
 */
export const RECORD_CLAIM_CODE_ROLES: readonly string[] = ["cf_care_manager", "ecm_provider"];

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
  | "reminder"
  /**
   * §Group E item 1 — a document the patient sent was reviewed and added to
   * their record. Rides the SAME notification path as every scheduled-contact
   * notice (profile in-app real; sms/email simulated), with the synthetic ref
   * `document:<id>` in place of an appointment id — the same trick the group
   * reminder sweep already uses.
   */
  | "document_verified";
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
  | "note_automation"
  /** §Phase 4.2 (6.5) — AHCD frontline validation checklist item. */
  | "advocate_ahcd_validation"
  /** §Phase 7 part 2 — patient reported a medication side effect. */
  | "med_side_effect"
  /** §Phase 4f — enrollment from a referral needs a care team and intake. */
  | "referral_enrollment_setup"
  /** §5d-3 — a follow-up on a social need or a resource referral. */
  | "sdoh_follow_up";

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
  // ----- §Dashboard Standardization Phase 5c (optional; legacy rows read fine) -----
  /** Attributed free-text notes added while working the task. */
  notes?: CaseTaskNote[];
  /** Who last edited title/detail/due/priority, and when. */
  lastEditedBy?: string;
  lastEditedAt?: string;
}

/** An attributed working note on a task. */
export interface CaseTaskNote {
  id: string;
  text: string;
  authorName: string;
  authorRole: StaffRole;
  at: string;
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
    licenseExpiresOn: "2028-12-31",
  },
  {
    id: "c2",
    name: "Dr. James Okafor",
    credential: "PsyD",
    mediCalCredentialed: true,
    mediCalStatus: "active",
    services: ["therapy_individual", "med_management", "intake"],
    locationIds: ["loc-visalia"],
    licenseExpiresOn: "2028-12-31",
  },
  {
    id: "c3",
    name: "Anita Brooks",
    credential: "LMFT",
    mediCalCredentialed: false,
    mediCalStatus: "pending",
    services: ["therapy_individual", "peer_support", "case_management"],
    locationIds: ["loc-porterville"],
    licenseExpiresOn: "2028-12-31",
  },
  {
    // §Demo — trainee (ASW) supervised by Dr. Reyes; her notes need cosign.
    id: "c4",
    name: "Kayla Nguyen",
    credential: "ASW",
    mediCalCredentialed: false,
    mediCalStatus: "pending",
    services: ["therapy_individual", "case_management"],
    locationIds: ["loc-visalia"],
    licenseExpiresOn: "2028-12-31",
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
    // Fictional demo CIN. Real Medi-Cal shape: 8 digits + 1 letter (9 chars).
    cin: "70010001A",
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
    // §Reporting Tier 2 — structured CalOMS history, so the reporting area has
    // real rows instead of an empty demo.
    calomsProfile: {
      substanceUse: {
        entries: [
          {
            rank: "primary",
            substance: "methamphetamine",
            route: "smoking",
            frequency: "3_6_per_week",
            ageAtFirstUse: 19,
          },
        ],
        source: "self_report",
        recordedAt: "2026-05-12T16:00:00.000Z",
      },
      priorTreatment: {
        priorEpisodes: "two_to_four",
        lastTreatmentType: "residential",
        source: "self_report",
        recordedAt: "2026-05-12T16:02:00.000Z",
      },
      justice: {
        arrestsPast12Months: 2,
        timeInCustodyMonths: 8,
        justiceReferralSource: "probation",
        source: "self_report",
        recordedAt: "2026-05-12T16:05:00.000Z",
      },
    },
    carePlanSummary: "Weekly therapy with Dr. Reyes; housing navigator referral pending.",
    // §P2 item 3 — the SDOH needs the care manager identified, with the real
    // status the patient surface renders (referred / in-process / receiving).
    sdohPlan: {
      items: [
        {
          id: "sdoh1",
          source: "staff_assessed",
          need: "Transitional housing placement",
          status: "sent",
          note: "Referred to Tulare Reentry Housing Collaborative.",
          visibleToPatient: true,
          createdAt: "2026-05-13",
          updatedAt: "2026-05-20",
        },
        {
          id: "sdoh2",
          source: "staff_assessed",
          need: "Rides to appointments",
          status: "scheduled",
          note: "Medi-Cal transportation set up for therapy days.",
          visibleToPatient: true,
          createdAt: "2026-05-13",
          updatedAt: "2026-05-28",
        },
        {
          id: "sdoh3",
          source: "staff_assessed",
          need: "Job readiness program",
          status: "identified",
          visibleToPatient: true,
          createdAt: "2026-05-30",
          updatedAt: "2026-05-30",
        },
      ],
    },
    intakeCompletedAt: "2026-05-12",
    coverage: {
      status: "active",
      verified: "self_reported", // §Phase 8a — no recorded check on file (was "verified")
      countyOfRelease: "Tulare",
      jiReentryFlag: true,
      ecmEligible: true,
      // §Phase 3b — migrated from the former standalone CoverageSpan store.
      // The old seed claimed a 270/271 verification; no such transaction
      // exists in this app, so it is recorded as a staff check instead.
      plans: [
        {
          id: "covplan-p1-1",
          payer: "Medi-Cal FFS",
          from: "2025-01-01",
          source: "staff_checked",
        },
      ],

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
    cin: "70010002B",
    releaseDate: "2026-05-22",
    enrolledAt: "2026-05-24",
    episodeDay: 11,
    smsFallback: false,
    consents: { hipaa: true, part2Sud: false },
    screeners: {
      "phq-9": { key: "phq-9", score: 8, severity: "Mild", completedAt: "2026-05-24" },
    },
    needs: { housing: false, food: true, employment: true, transport: false },
    calomsProfile: {
      substanceUse: {
        entries: [
          {
            rank: "primary",
            substance: "alcohol",
            route: "oral",
            frequency: "1_2_per_week",
            ageAtFirstUse: 16,
          },
        ],
        source: "self_report",
        recordedAt: "2026-05-24T17:00:00.000Z",
      },
      priorTreatment: {
        priorEpisodes: "one",
        lastTreatmentType: "outpatient",
        source: "self_report",
        recordedAt: "2026-05-24T17:01:00.000Z",
      },
    },
    carePlanSummary: "Biweekly check-ins; CalFresh enrollment in progress.",
    coverage: {
      status: "suspended",
      verified: "pending",
      countyOfRelease: "Tulare",
      jiReentryFlag: true,
      plans: [
        {
          id: "covplan-p2-1",
          payer: "Health Net Medi-Cal",
          memberId: "HN-2049881",
          from: "2025-06-01",
          source: "self_report",
        },
      ],

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
    cin: "70010003C",
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
      verified: "self_reported", // §Phase 8a — no recorded check on file (was "verified")
      countyOfRelease: "Tulare",
      jiReentryFlag: true,
      ecmEligible: true,
      plans: [
        {
          id: "covplan-p3-1",
          payer: "Tulare County MHP",
          from: "2025-03-15",
          source: "front_desk",
        },
      ],

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

// §QA 5-state pass — the general-population demo persona. Deliberately carries
// NO justice signal at all: no pre-release episode, no `jiReentryFlag`, no
// referral record and a non-justice `heardAbout`, so `resolvePopulationTrack`
// resolves her to `general_population` from live facts rather than a flag.
patients.push({
  id: "p4",
  programId: "ADL-2026-004",
  firstName: "Alicia",
  lastName: "Serrano",
  dob: "1991-06-17",
  phone: "+15595550104",
  cin: "70010004D",
  email: "alicia.r@example.com",
  // No custody history. `releaseDate` is required by the type, so it mirrors
  // her enrollment date and is never surfaced for a general-population track.
  releaseDate: "2026-03-02",
  enrolledAt: "2026-03-02",
  episodeDay: 34,
  smsFallback: true,
  consents: { hipaa: true, part2Sud: true, signedAt: "2026-03-02" },
  screeners: {
    "phq-9": { key: "phq-9", score: 9, severity: "Mild", completedAt: "2026-03-02" },
    "gad-7": { key: "gad-7", score: 7, severity: "Mild", completedAt: "2026-03-02" },
  },
  needs: { housing: false, food: false, employment: true, transport: false, substanceUse: true },
  carePlanSummary: "Outpatient SUD counseling + weekly peer group; self-referred.",
  intakeCompletedAt: "2026-03-02",
  coverage: {
    status: "active",
    verified: "self_reported", // §Phase 8a — no recorded check on file (was "verified")
    countyOfRelease: "Tulare",
    justiceInvolvement: "no",
  },
  frontDoor: {
    existingCare: "yes",
    seekingCareForSelf: "yes",
    heardAbout: "word_of_mouth",
    recordedAt: "2026-03-02T15:00:00.000Z",
  },
  caseManagerId: "cm2",
});

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
    source: "staff_scheduled",
  },
  {
    id: "a2",
    patientId: "p1",
    clinicianId: "c1",
    start: ago(72),
    durationMin: 50,
    status: "attended",
    source: "staff_scheduled",
  },
  {
    id: "a3",
    patientId: "p2",
    clinicianId: "c2",
    start: inHours(4),
    durationMin: 50,
    status: "scheduled",
    source: "staff_scheduled",
  },
  {
    id: "a4",
    patientId: "p3",
    clinicianId: "c1",
    start: ago(48),
    durationMin: 50,
    status: "no_show",
    source: "staff_scheduled",
  },
  {
    id: "a5",
    patientId: "p3",
    clinicianId: "c1",
    start: ago(240),
    durationMin: 50,
    status: "attended",
    source: "staff_scheduled",
  },
  {
    id: "a6",
    patientId: "p2",
    clinicianId: "c2",
    start: ago(120),
    durationMin: 50,
    status: "attended",
    source: "staff_scheduled",
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
    welcomeSms: { status: "sent" as const, at: ago(72 * 24 - 0.05) },
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
    welcomeSms: { status: "sent" as const, at: ago(48 - 0.05) },
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
    welcomeSms: { status: "sent" as const, at: ago(2 - 0.05) },
  },
];

const caseManagers: CaseManager[] = [
  { id: "cm1", name: "Lupita Sanchez, MSW", role: "ecm_provider" },
  { id: "cm2", name: "Trey Wilson", role: "peer_support" },
];

type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;
function _activeGroupEnrollees(sessionId: string): string[] {
  return groupEnrollments.filter((e) => e.sessionId === sessionId && !e.endedAt).map((e) => e.patientId);
}
function _groupTrigger(actor: string): GroupNotificationTrigger {
  return { actorId: actor, kind: patients.some((p) => p.id === actor) ? "patient" : "staff" };
}
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};

// Session: which patient is "logged in" for the demo. Defaults to a patient
// who has not yet completed intake so the first-time flow is visible.
let currentPatientId = "p2";

// §Adelante Journey Phase 5 — the engagement store (`src/lib/engagement.ts`)
// is structurally separate from the clinical record, but its writes still
// belong in the one audit stream and still have to wake the UI. Wire both
// here rather than letting engagement import the EHR (that would recreate the
// coupling the separation exists to remove).
Engagement.subscribeEngagement(() => emit());
Engagement.setEngagementAuditSink((evt) => {
  appendAudit({
    category: "clinical",
    action: evt.action,
    patientId: evt.patientId,
    ...(_patient(evt.patientId)?.programId
      ? { programId: _patient(evt.patientId)!.programId }
      : {}),
    actorRole: evt.actorRole,
    detail: evt.detail,
  });
});

// §Adelante Journey Phase 7 — the safety plan store (`src/lib/safetyPlan.ts`)
// is clinical-ADJACENT: separate store (patient-authored), but its audit lands
// in the same clinical stream and its writes wake the same UI subscribers.
SafetyPlanStore.subscribeSafetyPlan(() => emit());
SafetyPlanStore.setSafetyPlanAuditSink((evt) => {
  appendAudit({
    category: "clinical",
    action: evt.action,
    patientId: evt.patientId,
    ...(_patient(evt.patientId)?.programId
      ? { programId: _patient(evt.patientId)!.programId }
      : {}),
    actorRole: evt.actorRole,
    detail: evt.detail,
  });
});

// §Adelante Journey Phase 7 part 2 — patient-reported adherence / side effects.
// Same treatment: separate store, one clinical audit stream, one UI wake-up.
MedAdherence.subscribeMedAdherence(() => emit());
MedAdherence.setMedAdherenceAuditSink((evt) => {
  appendAudit({
    category: "clinical",
    action: evt.action,
    patientId: evt.patientId,
    ...(_patient(evt.patientId)?.programId
      ? { programId: _patient(evt.patientId)!.programId }
      : {}),
    actorRole: evt.actorRole,
    detail: evt.detail,
  });
});

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

// ---------------------------------------------------------------------------
// §Message-routing gap #3 — anonymous front-door crisis alert.
//
// Crisis language can arrive from someone who is not a patient yet (the
// front-door "what brings you here" note). There is no chart to attach a
// CrisisEscalation to, so instead of silently dropping the detection we raise
// a real, appropriately-scoped staff alert: same recipient role as the Crisis
// Queue (clinical_coordinator), same out-of-band transport, surfaced on the
// Crisis Queue page. It is deliberately NOT a CrisisEscalation and NOT a
// patient record — no chart is created for someone who never asked for one.
// ---------------------------------------------------------------------------
export interface AnonymousCrisisAlert {
  id: string;
  /** Where the text came from, e.g. "the front-door note". */
  surface: string;
  /** Which detection patterns fired — the audit detail, never the raw text. */
  patternIds: string[];
  createdAt: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  /** How the person can be reached back, when they volunteered it. */
  contact?: string;
}
const anonymousCrisisAlerts: AnonymousCrisisAlert[] = [];

// ---------------------------------------------------------------------------
// §Front-door "what brings you here" — NON-CLINICAL community inquiry store.
//
// WHY THIS IS NOT AN EHR RECORD: this step is reached only by someone who
// said they are NOT seeking MH / SUD / medication care for themselves. No
// patient exists, no treatment relationship exists, and creating a chart for
// a person who never asked for one would be wrong. It is also deliberately
// NOT a `ProviderRequest`: that structure is staff→staff, requires a
// patientId, and is claimed out of the clinical inbox.
//
// PART 2 / PHI NOTE (real, not theoretical): free text is free text. Someone
// may still describe their own substance use or mental health here despite
// the page's framing. This store therefore behaves as if that is possible:
// the body is treated as confidential contact-us content, it is never copied
// into a chart, never copied into an audit `detail`, and never merged into a
// patient record automatically. If the person later becomes a patient, staff
// re-collect the clinical history through intake rather than importing this
// text. Access is gated by its own record class (`community_inquiries`).
// ---------------------------------------------------------------------------
export type CommunityInquiryStatus = "new" | "contacted" | "resolved";
export interface CommunityInquiry {
  id: string;
  /** Verbatim free text the person wrote. Never copied into a chart. */
  body: string;
  /** Required at capture — the page promises a human follow-up. */
  contact: string;
  contactKind: "email" | "phone";
  /** True when crisis language fired at capture time. */
  crisisFlagged: boolean;
  /** Detection pattern ids — the audit detail, never the raw text. */
  patternIds?: string[];
  createdAt: string;
  status: CommunityInquiryStatus;
  dispositionBy?: string;
  dispositionAt?: string;
  dispositionNote?: string;
}
const communityInquiries: CommunityInquiry[] = [];

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
 * Roles that may change a message's 42 CFR Part 2 flag. Originally the
 * write-level `patient_messaging` set; it is now deliberately NARROWER than
 * that set: `peer_specialist` has messaging write (they answer members) but is
 * `consent_gated` for `screeners_sud`, and flagging REMOVES visibility, so a
 * consent-gated role must not be able to mask content from treating roles.
 * Duplicated as a value here only because `ehr.ts` may import `roles.ts` for
 * TYPES only (roles.ts imports ehr.ts at runtime).
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

/**
 * §Advocate build 1 — one consent-documentation requirement on one link.
 * The DEFINITION (label, plain language) lives in `advocateDocs.ts`; only the
 * state lives here, so UI copy can change without touching stored data.
 */
export interface AdvocateDocRequirementState {
  key: AdvocateDocRequirementKey;
  status: AdvocateDocRequirementStatus;
  /** The advocate's own confirmation at claim time (or a later resend). */
  attestedAt?: string;
  attestedName?: string;
  /** Staff confirmation that the real document is on file. */
  verifiedAt?: string;
  verifiedBy?: string;
  verificationRef?: string;
  /** Set when staff (re)request this document outside a new invite cycle. */
  requestedAt?: string;
  requestedBy?: string;
  requestCount?: number;
  /**
   * §Advocate build 3 — the advocate said "I'm waiting on you" for a row only
   * STAFF can move. Rate-limited to once a day per row by
   * `advocateNudgeCareTeam`; recorded so a nudge is auditable and cannot be
   * used as a channel for anything but "still waiting".
   */
  nudgedAt?: string;
  nudgeCount?: number;
}

export interface AdvocateLink {
  id: string;
  patientId: string;
  /** Who the patient designated. Free text supplied by the DESIGNATOR only. */
  advocateName: string;
  relationship?: string;
  /**
   * §Advocate Access Redesign Phase 2 (final) — the advocate's OWN profile
   * fields, editable by them on `/advocate/my-profile`. Contact/display only:
   * nothing here participates in the authorization decision.
   */
  contactPhone?: string;
  preferredLanguage?: "en" | "es";
  /** Where the invitation was sent — the advocate's own contact, direct. */
  invitationSentTo: string;
  invitationChannel: "email" | "sms";
  /**
   * Single-use, high-entropy. Consumed by `claimAdvocateInvitation`; retained
   * afterwards only so the claim cannot be replayed (status guards that too).
   */
  invitationCode: string;
  invitationExpiresAt: string;
  /**
   * §Advocate build 1 — the 14-day window is a property of the invitation
   * being RECEIVED, not of the row being written. Kept separately from
   * `invitationExpiresAt` so the window can be re-based when delivery is
   * confirmed (see `recordAdvocateInvitationDelivery`).
   */
  invitationWindowDays: number;
  /** When the notification transport confirmed a send. Starts the window. */
  notificationSentAt?: string;
  notificationDelivery?: {
    status: "pending" | "sent" | "not_configured" | "failed";
    at: string;
    detail?: string;
  };
  /** Persistent deep link embedded in the notification. */
  claimLink?: string;
  /**
   * The instrument the INVITER expects this person to hold. Advisory only:
   * it selects which documentation requirements are shown at claim time, and
   * is never a substitute for the advocate's own confirmed
   * `authorizationType` below. An invitation still grants nothing.
   */
  expectedAuthorizationType?: AdvocateAuthorizationType;
  /** §Advocate build 1 — consent-documentation trail. See `advocateDocs.ts`. */
  documentRequirements?: AdvocateDocRequirementState[];
  designatedBy: {
    actor: "patient" | "cf_care_manager" | "ecm_provider" | "administrator";
    name: string;
  };
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
   * Retained as the denormalised "when/who" of the CURRENT activation; the
   * authoritative state lives in `ahcdActivation` below (§Phase 4.2).
   */
  ahcdActivatedAt?: string;
  ahcdActivatedBy?: string;
  /**
   * §Phase 4.2 (6.4) — the real `dormant → clinically active` state, with the
   * clinician and role that determined incapacity and an optional review date
   * for a TEMPORARY determination. Once the review date passes the link is
   * dormant again; see `ahcdDeterminationExpired`.
   */
  ahcdActivation?: {
    state: AhcdActivationState;
    determinedAt: string;
    determinedBy: string;
    determinedByRole: AhcdDeterminationRole;
    /** The clinician's own words for the basis of the determination. */
    basis: string;
    /** True when a review date was set, i.e. the determination is temporary. */
    temporary: boolean;
    /** YYYY-MM-DD. Past this date the determination no longer authorises. */
    reviewByDate?: string;
    deactivatedAt?: string;
    deactivatedBy?: string;
    deactivatedReason?: string;
  };
  /**
   * §Phase 4.2 (6.5) — the frontline validation checklist. Five independently
   * trackable findings, each mirrored by a real CaseTask on the CF Care
   * Manager's worklist.
   */
  ahcdValidation?: AhcdChecklistState;
  /**
   * §Phase 4.1 — conservator tier precondition. Certified court documents are
   * a real, recorded fact, not an implied consequence of picking the type at
   * claim time. Absent this, `advocateAccessDecision` denies with
   * `conservatorship_docs_missing`. (Verification UI is a follow-up.)
   */
  conservatorshipDocs?: {
    verifiedAt: string;
    verifiedBy: string;
    courtOrderRef: string;
    documentId?: string;
  };
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
  /**
   * §Group E item 1 — in-app notices addressed to THIS advocate. Same
   * `ApptNotification` shape and same channel/state vocabulary as the
   * patient's own feed, deliberately: there is one notification model in this
   * build, not an advocate-flavoured second one. `profile` is a real in-app
   * delivery; `sms` is the same SIMULATED transport used everywhere else.
   */
  notifications?: ApptNotification[];
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
 * §Group D item 1 — RESOLVED (was a placeholder): a contribution is now
 * formally REVIEWED by the plan owner. "Accepted" is a STATUS on the
 * contribution, not a copy of the text into the plan: the ECM Provider /
 * CF Care Manager remains the sole author of every authoritative
 * `ReentryCarePlan` field, so acceptance means "read, and taken into the
 * plan by the owner in their own words". Nothing is auto-merged, and the
 * plan stays byte-identical unless the owner edits it themselves.
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
  /**
   * Review state. `pending` until the plan owner acts. `accepted` =
   * incorporated by the owner; `declined` = considered and not taken up.
   * Both terminal states require the reviewer's identity and role.
   */
  review: {
    status: AdvocateContributionReviewStatus;
    reviewedBy?: string;
    reviewedByRole?: AdvocatePlanOwnerRole;
    reviewedAt?: string;
    note?: string;
  };
}

export type AdvocateContributionReviewStatus = "pending" | "accepted" | "declined";

/**
 * Who may formally accept advocate input into the plan. Deliberately the SAME
 * two roles that own the plan, and the SAME episode-derived ownership rule the
 * Phase 5 document verify queue already uses (`verifyQueueOwnerRole`): the CF
 * Care Manager owns it while a pre-release episode is open, the ECM Provider
 * owns it after handoff. Both may act at any time (a plan can be in flight),
 * but the queue names the owner so work is not silently dropped at handoff.
 */
export type AdvocatePlanOwnerRole = "cf_care_manager" | "ecm_provider";
export const ADVOCATE_REVIEW_ROLES: AdvocatePlanOwnerRole[] = ["cf_care_manager", "ecm_provider"];

/**
 * §Group D item 2 — an advocate eligibility-assist attestation, as a REVIEWABLE
 * record rather than an audit row alone. Phase 4's behaviour is unchanged: this
 * still submits nothing to DHCS. What is new is that the attestation is now
 * visible to the plan-owning roles with a review status and its own trail.
 */
export interface AdvocateEligibilityAttestation {
  id: string;
  advocateLinkId: string;
  patientId: string;
  advocateName: string;
  attestedName: string;
  note?: string;
  createdAt: string;
  /** Honest flag, carried on the record itself. */
  submission: "no_submission_path_defined";
  review: {
    status: "pending" | "reviewed";
    reviewedBy?: string;
    reviewedByRole?: AdvocatePlanOwnerRole;
    reviewedAt?: string;
    note?: string;
  };
}

const advocateContributions: AdvocateContribution[] = [];
const advocateEligibilityAttestations: AdvocateEligibilityAttestation[] = [];

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

/**
 * §Advocate build 1 — seed the documentation rows for an authorization type.
 * Staff-only rows (clinician activation, court order) start `pending` and can
 * never be self-attested by the advocate.
 */
function _advocateRequirementRows(
  type: AdvocateAuthorizationType,
): AdvocateDocRequirementState[] {
  return ADVOCATE_DOCS_BY_TYPE[type].map((key) => ({ key, status: "pending" as const }));
}

/**
 * Non-reversible short fingerprint of an invitation code. Lets the audit log
 * tie a generation event to a specific code WITHOUT ever storing the code —
 * the invariant that the code lives only in the advocate's own channel.
 */
function _advocateCodeFingerprint(code: string): string {
  let h = 2166136261;
  for (let i = 0; i < code.length; i++) {
    h ^= code.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Persistent deep link embedded in the notification. Deliberately carries the
 * code only — no patient id, no link id — so a forwarded link leaks nothing
 * about who the invitation concerns.
 */
function _advocateClaimLink(link: AdvocateLink): string {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://adelmvp1.lovable.app";
  return `${origin}/advocate?code=${encodeURIComponent(link.invitationCode)}`;
}

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
  return _advocatePart2Gates(link).unmasked;
}

/** Stable worklist key per checklist item, mirroring `prerelease:<id>:<key>`. */
function _ahcdTaskKey(linkId: string, item: AhcdChecklistItemKey): string {
  return `ahcd:${linkId}:${item}`;
}

/**
 * §Phase 4.2 (6.5) — open the five validation items as real CaseTasks on the
 * CF Care Manager's worklist. Same mechanism as the pre-release checklist:
 * `dedupeKey` for idempotency, `allowedRoles` for routing, no parallel store.
 */
function _openAhcdValidationTasks(link: AdvocateLink): void {
  for (const item of AHCD_CHECKLIST_ITEMS) {
    AdelanteEHR.createCaseTask({
      patientId: link.patientId,
      assignedTo: "",
      title: `AHCD validation ${item.order}/5 — ${item.label}`,
      detail: `${link.advocateName} (${link.relationship}). ${item.detail}`,
      dueDate: new Date().toISOString().slice(0, 10),
      taskType: "ahcd_validation",
      allowedRoles: ["cf_care_manager", "ecm_provider"],
      origin: "advocate_ahcd_validation",
      dedupeKey: _ahcdTaskKey(link.id, item.key),
    });
  }
}

/**
 * The live activation state. A temporary determination whose review date has
 * passed is expired HERE, on read, so nothing has to be told to expire it —
 * the same live-evaluation approach `_effectiveAdvocateStatus` uses for the
 * link itself. The lapse is written back once (and audited) so the worklist
 * and the audit trail agree with what the gate just decided.
 */
function _ahcdEffective(link: AdvocateLink): { active: boolean; expired: boolean } {
  const a = link.ahcdActivation;
  if (!a || a.state !== "clinically_active")
    return { active: false, expired: a?.state === "expired" };
  if (!ahcdDeterminationExpired(a)) return { active: true, expired: false };
  AdelanteEHR.deactivateAdvocateAhcd(link.id, {
    deactivatedBy: "system",
    reason: `Temporary incapacity determination lapsed on its review date (${a.reviewByDate}).`,
    expired: true,
  });
  return { active: false, expired: true };
}

/**
 * The same two gates, reported individually so the audit row (and the consent
 * audit viewer, §Group D item 7) can show WHICH of the two passed. There is
 * still exactly one evaluation of the rule — `advocateSudAccess` — and this
 * is the only place either fact is gathered.
 */
function _advocatePart2Gates(link: AdvocateLink): {
  linkValid: boolean;
  sudDisclosureConsentActive: boolean;
  unmasked: boolean;
  /** §Phase 4.1 — WHY it is (un)masked: the tier's SUD mode and the basis. */
  sudMode: AdvocateSudAccessMode;
  sudBasis: "consent" | "authority" | "none";
} {
  const linkValid = AdelanteEHR.advocateAccess(link.id).allowed;
  const sudDisclosureConsentActive = AdelanteEHR.isConsentCategoryAuthorized(
    link.patientId,
    ADVOCATE_SUD_DISCLOSURE_CATEGORY,
  );
  const tier = link.authorizationType ? advocateTier(link.authorizationType) : undefined;
  if (!tier)
    return {
      linkValid,
      sudDisclosureConsentActive,
      unmasked: false,
      sudMode: "categorically_barred",
      sudBasis: "none",
    };
  // §Phase 4.2 (6.5 item 5) — an AHCD whose text does not plainly reach Part 2
  // records falls back to the ASCMI consent path for SUD content only.
  const decision = advocateSudAccess(tier, {
    linkValid,
    sudDisclosureConsentActive,
    ...(link.authorizationType === "ahcd"
      ? { ahcdPart2ScopeUnclear: ahcdPart2ScopeUnclear(link.ahcdValidation ?? {}) }
      : {}),
  });
  return {
    linkValid,
    sudDisclosureConsentActive,
    unmasked: decision.unmasked,
    sudMode: decision.mode,
    sudBasis: decision.basis,
  };
}

function _patient(id: string): Patient | undefined {
  return patients.find((x) => x.id === id);
}

/**
 * §Group E item 1 — who gets told a document was promoted into the record.
 *
 * The patient always. An advocate ONLY if they would be allowed to see that
 * document RIGHT NOW, decided by the Phase 4 / Group D gates and nothing else:
 *   • `_advocateGate(..., "document_view")` — link claimed, live, permission
 *     held; and
 *   • for a Part 2 document, `advocateDocumentVisibility` fed by
 *     `_advocatePart2Gates` — the same call the list and the download make.
 * A notification is a disclosure ("this person has a new document"), so it
 * cannot be looser than the read it announces.
 */
function _advocatesNotifiableForDocument(doc: PatientDocument): AdvocateLink[] {
  return advocateLinks.filter((link) => {
    if (link.patientId !== doc.patientId) return false;
    const decision = AdelanteEHR.advocateAccess(link.id);
    if (!decision.allowed || !decision.permissions.includes("document_view")) return false;
    const vis = advocateDocumentVisibility({
      isPart2: doc.isPart2,
      part2Unmasked: _advocatePart2Gates(link).unmasked,
    });
    return !vis.restricted;
  });
}

/** One notice, both audiences, over the existing transport. */
function _notifyDocumentVerified(doc: PatientDocument): void {
  const ref = `document:${doc.id}`;
  // Patient — the existing fan-out (profile real, sms/email simulated,
  // `isSmsOn` respected inside it). No second SMS path is created here.
  AdelanteEHR.notifyAppointmentChange({
    patientId: doc.patientId,
    apptId: ref,
    kind: "document_verified",
  });
  const now = new Date().toISOString();
  for (const link of _advocatesNotifiableForDocument(doc)) {
    const entries: ApptNotification[] = [
      {
        id: uid(),
        apptId: ref,
        kind: "document_verified",
        at: now,
        channel: "profile",
        state: "delivered",
        sentAt: now,
        deliveredAt: now,
      },
    ];
    if (link.invitationChannel === "sms")
      // Simulated exactly like the patient's SMS: queued, never actually sent.
      entries.push({
        id: uid(),
        apptId: ref,
        kind: "document_verified",
        at: now,
        channel: "sms",
        state: "queued",
      });
    link.notifications = [...entries, ...(link.notifications ?? [])].slice(0, 40);
    _advocateAudit(link, "advocate_document_verified_notified", "documents", {
      documentId: doc.id,
      isPart2: doc.isPart2,
      channels: entries.map((e) => e.channel),
    });
  }
}

/** Uniform advocate audit row — every advocate touch lands in one shape. */
/**
 * §Advocate Build 2 — advocate RSVPs live BESIDE the appointment, never on it.
 * `Appointment.status` is a clinical attendance record owned by staff; an
 * advocate's "they'll be there" is a different fact with a different author.
 */
export interface AdvocateApptRsvp {
  apptId: string;
  advocateLinkId: string;
  response: "yes" | "no";
  at: string;
}
const advocateApptRsvps: AdvocateApptRsvp[] = [];

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
      reason: decision.allowed ? "Your authorization doesn't include this." : decision.reason,
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
        // §Reporting Tier 2 follow-up — discharge status/reason used to be two
        // free-text questions here, disconnected from anything queryable. They
        // are retired: the structured DischargeRecord is the one source, and
        // this read-only card shows it (or points at where to record it).
        id: "ds_discharge",
        title: "Discharge status and reason",
        type: "autofill_section",
        fields: [],
        autofill: { source: "discharge_record" },
      },
      {
        id: "ds_narrative",
        title: "Clinician narrative",
        fields: [
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
/** Real acting-staff attribution for a referral disposition (§Phase 4a). */
/**
 * §Phase 7b — ehr-ext owns claims and registers here at load, so ehr.ts can
 * open a claim when a visit is attended and read billing status for exports
 * without a circular import.
 */
export interface ClaimBridge {
  onAttended(apptId: string): void;
  /** §Phase 7b.1 — a note reached its FINAL signature (sign or cosign). */
  onNoteFinal(patientId: string, noteId: string): void;
  bucketFor(apptId: string): string | undefined;
  chargeFor(apptId: string): number | undefined;
  bucketCounts(): Record<string, number>;
}
let _claimBridge: ClaimBridge | null = null;
export function registerClaimBridge(b: ClaimBridge) {
  _claimBridge = b;
}

function _referralActor(): ReferralActor {
  const staff = getActingStaff();
  return { staffId: staff.id, name: staff.name, role: getActingRole() };
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
// ----- §5-stage recovery journey ------------------------------------------
/**
 * One append-only stage entry. Nothing is ever mutated or deleted: a change of
 * mind is a new row, so the history reads as a real conversation between the
 * patient and the care team rather than a single overwritten field.
 */
export interface RecoveryStageEntry {
  id: string;
  patientId: string;
  stage: RecoveryStageId;
  at: string;
  setByActor: "patient" | "staff";
  setByName: string;
  setByRole?: string;
  note?: string;
  previousStage?: RecoveryStageId;
  /** Snapshot of the review flag at write time — demo rows stay identifiable. */
  reviewPending: boolean;
}
const recoveryStageEntries: RecoveryStageEntry[] = [];

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

/**
 * The patient's own scheduled appointment that overlaps [start, start+duration),
 * if any. Real interval overlap, not just an identical start time — a 50-minute
 * therapy visit and a 30-minute follow-up starting 10 minutes later collide just
 * as hard as two visits at the same moment.
 */
function _patientOverlap(
  patientId: string,
  startISO: string,
  durationMin: number,
  excludeApptId?: string,
): Appointment | undefined {
  const s = new Date(startISO).getTime();
  if (Number.isNaN(s)) return undefined;
  const e = s + Math.max(0, durationMin) * 60_000;
  return appointments.find((x) => {
    if (x.id === excludeApptId) return false;
    if (x.patientId !== patientId) return false;
    if (x.status !== "scheduled") return false;
    const xs = new Date(x.start).getTime();
    if (Number.isNaN(xs)) return false;
    const xe = xs + Math.max(0, x.durationMin) * 60_000;
    return xs < e && s < xe;
  });
}

function _patientOverlapMessage(existing: Appointment): string {
  const when = new Date(existing.start).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const who = clinicians.find((c) => c.id === existing.clinicianId)?.name;
  return `You already have an appointment at that time (${when}${who ? ` with ${who}` : ""}). Pick another time, or reschedule that visit instead.`;
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

/**
 * §Pre-release build 4 — derive the CalAIM continuity slice from the REAL
 * pre-release records. Direction of reconciliation is pre-release → CalAIM:
 * the pre-release workspace is where the data is captured, and the CalAIM
 * plan is the artefact the community care team (ECM Provider, case manager,
 * the patient) reads everywhere else in the system.
 *
 * Runs on every recompute, including while the person is still in custody,
 * and keeps running after the episode closes — the plan a released member
 * carries into the community is the same plan, not a copy of it.
 */
function _preReleaseCarePlanSlice(p: Patient): CarePlanPreReleaseSlice | undefined {
  const ep = preReleaseEpisodes
    .filter((e) => e.patientId === p.id)
    .sort((a, b) => +new Date(b.openedAt) - +new Date(a.openedAt))[0];
  if (!ep) return undefined;
  const plan = reentryCarePlans.find((r) => r.episodeId === ep.id);
  const capacity = AdelanteEHR.preReleaseCapacityState(ep.id);
  const matMedications = (p.orders ?? [])
    .filter(
      (o) =>
        o.preReleaseEpisodeId === ep.id &&
        (o.status === "signed" || o.status === "held") &&
        SUD_MED_RE.test(o.productName ?? o.drugName),
    )
    .map((o) => ({ name: o.productName ?? o.drugName, status: o.status }));
  const bookings = (plan?.appointments ?? [])
    .filter((a) => a.apptId)
    .map((a) => {
      const live = appointments.find((x) => x.id === a.apptId);
      return {
        kind: a.kind,
        start: live?.start ?? a.start,
        providerName: a.providerName,
        ...(live?.status ? { status: live.status } : {}),
      };
    });
  const screeningsCaptured = Object.values(p.screeners ?? {}).filter(
    (r) => r?.context === "pre_release",
  ).length;
  return {
    episodeId: ep.id,
    status: ep.status,
    anticipatedReleaseDate: ep.anticipatedReleaseDate,
    ...(ep.facilityName ? { facilityName: ep.facilityName } : {}),
    ...(ep.receivingEcmStaffId ? { receivingEcmStaffId: ep.receivingEcmStaffId } : {}),
    capacityState: capacity.decision.state,
    advocates: advocateLinks
      .filter((l) => l.patientId === p.id && l.status === "active")
      .map((l) => ({
        name: l.advocateName,
        ...(l.relationship ? { relationship: l.relationship } : {}),
        ...(l.authorizationType ? { authorizationType: l.authorizationType } : {}),
      })),
    appointments: bookings,
    screeningsCaptured,
    ...(plan?.housing.arrangement ? { housingArrangement: plan.housing.arrangement } : {}),
    matMedications,
    sensitive: matMedications.length > 0,
  };
}

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

  // §Pre-release build 4 — the chart's own signed orders are a real
  // medication source too, not just the eRx vendor feed. This is how MAT
  // started in the pre-release workspace (build 3) reaches the CalAIM plan:
  // read live off `p.orders`, deduped by name, never copied.
  const chartOrders = (p.orders ?? []).filter((o) => o.status === "signed" || o.status === "held");
  for (const o of chartOrders) {
    const name = o.productName ?? o.drugName;
    if (medications.some((m) => m.name.toLowerCase() === name.toLowerCase())) continue;
    medications.push({
      name,
      state: "active",
      sensitive: SUD_MED_RE.test(name),
      ...(o.preReleaseEpisodeId ? { source: "pre_release" as const } : {}),
    });
  }

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

  // §Pre-release build 4 — social needs identified by the AHC-HRSN screening
  // (build 2) are real, captured needs; surface them as open SDOH rows until
  // the community team creates a real referral row for the same need.
  const hrsn = p.screeners["ahc-hrsn"];
  for (const d of hrsn?.domains ?? []) {
    if (!d.positive) continue;
    // §5d-2 — interpersonal safety is never synthesized into a plan row: its
    // needs are materialized as real STAFF-ONLY items and a synthesized row
    // carries no visibility of its own.
    if (d.key === HRSN_SAFETY_DOMAIN_KEY) continue;
    const label = d.label;
    if (sdohItems.some((i) => i.need.toLowerCase() === label.toLowerCase())) continue;
    if (sdohOpen.some((i) => i.need.toLowerCase() === label.toLowerCase())) continue;
    sdohOpen.push({ need: label, status: "identified", source: "pre_release" });

  }

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

  // §Pre-release build 4 — CalAIM continuity slice, derived live.
  const preRelease = _preReleaseCarePlanSlice(p);

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
    ...(preRelease ? { preRelease } : {}),
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
 * §Group sessions — CATEGORY TAXONOMY (DHCS-sourced content from Christi).
 * Three buckets: two billable, one engagement-only.
 */
export type GroupCategory = "sud_clinical_preauth" | "skills_education" | "open_psychoeducational";

/**
 * Billing content per category — real DHCS codes, no longer placeholders.
 *
 * INTERPRETATION (flagged): `selfService` is DERIVED from category here.
 * `skills_education` is billable but behaves like an open group for
 * enrollment (eligible patients self-book), because "is it billable" and
 * "who may place a patient in it" are different questions. If a group ever
 * needs billable+staff-placed or non-billable+staff-placed in a combination
 * this table can't express, promote `selfService` to its own field on
 * GroupSession rather than widening the taxonomy.
 */
export const GROUP_BILLING: Record<
  GroupCategory,
  {
    billable: boolean;
    /** HCPCS code used on the claim. Absent for non-billable categories. */
    code?: string;
    /** Short human label for the code. */
    codeLabel?: string;
    /** One-line billing status shown next to the category selector. */
    statusLabel: string;
    /** True when eligible patients may self-book from /schedule. */
    selfService: boolean;
  }
> = {
  sud_clinical_preauth: {
    billable: true,
    code: "H0005",
    codeLabel: "SUD Group Counseling",
    statusLabel: "Billable — H0005 SUD Group Counseling",
    selfService: false,
  },
  skills_education: {
    billable: true,
    code: "H2014",
    codeLabel: "Skills Training and Development, Group (per 15 min)",
    statusLabel: "Billable — H2014 Skills Training and Development, Group (per 15 min)",
    selfService: true,
  },
  open_psychoeducational: {
    billable: false,
    statusLabel: "Non-billable — engagement/reach only, not a clinical claim",
    selfService: true,
  },
};

export const GROUP_CATEGORIES: { key: GroupCategory; label: string; helper: string }[] = [
  {
    key: "sud_clinical_preauth",
    label: "SUD / clinically pre-authorized",
    helper:
      "Staff enroll patients. Individualized attendee notes bill as H0005 and flow to the Claims Worklist.",
  },
  {
    key: "skills_education",
    label: "Skills training & education",
    helper:
      "Eligible patients can self-enroll from their scheduling page. Individualized attendee notes bill as H2014.",
  },
  {
    key: "open_psychoeducational",
    label: "Open psychoeducational",
    helper:
      "Eligible patients can self-enroll from their scheduling page. Attendance is tracked for engagement reporting only — never billed.",
  },
];

/** True when this category's attendee notes may create claims. */
export function isBillableGroupCategory(category: GroupCategory): boolean {
  return GROUP_BILLING[category]?.billable === true;
}

/** HCPCS code for a billable category, or undefined when non-billable. */
export function groupBillingCode(category: GroupCategory): string | undefined {
  return GROUP_BILLING[category]?.code;
}

/** True when eligible patients may self-book this category from /schedule. */
export function isSelfServiceGroupCategory(category: GroupCategory): boolean {
  return GROUP_BILLING[category]?.selfService === true;
}

/**
 * DHCS group size: 2–12, same limit for telehealth. 12 is the hard regulatory
 * ceiling; a county may configure a LOWER local cap, never a higher one. No
 * county-specific cap is invented here — 12 is the default.
 */
export const GROUP_CAPACITY_MIN = 2;
export const GROUP_CAPACITY_MAX = 12;

/**
 * Occurrence-level DHCS rule: an occurrence with fewer than 2 present
 * attendees functions as an individual session in practice and is not
 * billable as a group. Distinct from the category-level split — the
 * occurrence still happens and is still documented normally.
 */
export const GROUP_MIN_BILLABLE_ATTENDEES = 2;

/** Both gates together: billable category AND enough attendees present. */
export function isOccurrenceBillable(category: GroupCategory, presentCount: number): boolean {
  return isBillableGroupCategory(category) && presentCount >= GROUP_MIN_BILLABLE_ATTENDEES;
}

/**
 * §Group sessions — modality lives on the OCCURRENCE, not the session: a
 * recurring group can meet in person one week and by video the next, and the
 * note has to reflect how the service was ACTUALLY delivered because that is
 * how it is billed.
 */
export type GroupOccurrenceModality = "in_person" | "video" | "audio_only";

export const GROUP_OCCURRENCE_MODALITIES: { key: GroupOccurrenceModality; label: string }[] = [
  { key: "in_person", label: "In person" },
  { key: "video", label: "Video (telehealth)" },
  { key: "audio_only", label: "Audio only (telephone)" },
];

/** Virtual = telehealth consent applies. In-person never checks it. */
export function isVirtualGroupModality(m: GroupOccurrenceModality): boolean {
  return m === "video" || m === "audio_only";
}

/** Session-level default, mapped onto the occurrence-level union. */
export function defaultOccurrenceModality(
  sessionModality: "video" | "phone" | "in_person",
): GroupOccurrenceModality {
  return sessionModality === "phone"
    ? "audio_only"
    : sessionModality === "video"
      ? "video"
      : "in_person";
}

/**
 * §Group sessions — virtual room / join link.
 *
 * Mirrors the 1:1 `TelehealthSession` shape (roomId + join url from the mock
 * telehealth vendor), but a group is deliberately NOT an Appointment, so it
 * carries its own field rather than borrowing that record. Two levels, exactly
 * like modality: a session-level standing room, optionally overridden for one
 * occurrence. Absent = no link has been added yet — readers say so rather than
 * inventing a URL.
 */
export interface GroupVirtualRoom {
  roomId: string;
  joinUrl: string;
  setAt: string;
  setBy: string;
}



/**
 * County/admin configuration. The group confidentiality acknowledgment is
 * explicitly NOT a DHCS mandate, so it ships OFF and a county can turn it on.
 */
const groupConfig: { requireConfidentialityAck: boolean } = {
  requireConfidentialityAck: false,
};

/**
 * Single place the regulatory roster range is enforced, so no write path
 * (create or edit) can configure a group above the DHCS ceiling of 12.
 */
function _assertGroupCapacity(capacity: number): void {
  if (!Number.isFinite(capacity) || capacity < GROUP_CAPACITY_MIN)
    throw new Error(`Capacity must be at least ${GROUP_CAPACITY_MIN} (DHCS group minimum).`);
  if (capacity > GROUP_CAPACITY_MAX)
    throw new Error(
      `Capacity cannot exceed ${GROUP_CAPACITY_MAX} — the DHCS regulatory maximum. A lower local cap is allowed.`,
    );
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
   * §Multi-facilitator. Real list of additional practitioners who may deliver
   * this group. Per-occurrence direct-care MINUTES are not stored here — they
   * are recorded at documentation time on the occurrence, because two
   * facilitators genuinely can (and often do) deliver different durations.
   * `coFacilitatorId` above is the retired single-slot field, kept only so
   * legacy rows still read; new code writes `coFacilitatorIds`.
   */
  coFacilitatorIds?: string[];
  /**
   * Reuses the existing `ServiceType` union: `therapy_group` already exists,
   * so no new service taxonomy is invented here.
   */
  serviceType: ServiceType;
  modality: "video" | "phone" | "in_person";
  locationId?: string;
  /** Standing virtual room for this group. Absent = no link added yet. */
  virtualRoom?: GroupVirtualRoom;

  /**
   * Three categories (DHCS content via Christi). "Pre-authorization" is still
   * read as INTERNAL clinical eligibility/placement approval, not payer-facing
   * prior auth.
   *
   *   sud_clinical_preauth   — staff-only enrollment, billable H0005.
   *   skills_education       — patient self-service, billable H2014.
   *   open_psychoeducational — patient self-service, NON-billing engagement.
   */
  category: GroupCategory;
  /** ISO datetime of the first occurrence. */
  start: string;
  durationMin: number;
  /** Roster cap. DHCS allows 2–12; configurable below 12, never above. */
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

/**
 * §Multi-facilitator minute tracking (Christi / DHCS crosswalk).
 *
 * When 2+ practitioners deliver one group, the note must document EACH
 * provider's specific involvement AND their own duration of direct patient
 * care. San Francisco county splits this into separate notes per facilitator
 * purely because their EHR cannot record different service times per
 * provider — an EHR constraint, explicitly NOT a rule to replicate. Here the
 * minutes are per-facilitator on ONE occurrence, and every individualized
 * attendee note renders the full list.
 */
export interface GroupFacilitatorMinutes {
  staffId: string;
  role: "primary" | "co";
  /** Direct patient-care minutes delivered by THIS provider, independently. */
  minutes: number;
  /** This provider's specific involvement (what they actually did). */
  involvement: string;
}

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
  /**
   * How THIS meeting is delivered. Absent = not yet chosen; readers fall back
   * to `defaultOccurrenceModality(session.modality)`.
   */
  modality?: GroupOccurrenceModality;
  modalitySetAt?: string;
  modalitySetBy?: string;
  /** One-meeting override of the group's standing virtual room. */
  virtualRoom?: GroupVirtualRoom;

  /**
   * Per-facilitator direct-care minutes for THIS meeting. Absent = not yet
   * documented; readers fall back to `defaultGroupFacilitators(session)`.
   */
  facilitators?: GroupFacilitatorMinutes[];
  /**
   * §Designated rendering provider. DHCS duplicate-claim logic keys on member
   * CIN + rendering provider NPI + procedure code + date, so each beneficiary
   * claim carries exactly ONE rendering provider. Defaults to the primary
   * facilitator, changeable per occurrence.
   *
   * OPEN — COUNTY CONFIRMATION REQUIRED: whether a SECOND facilitator's time
   * is ever separately claimable is NOT decided here. DHCS is silent; we
   * resolve conservatively (co-facilitator time is documented only, never
   * separately claimed). Do not treat this as settled policy.
   */
  renderingProviderId?: string;
  renderingProviderSetAt?: string;
  renderingProviderSetBy?: string;
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
 * `billingCode` carries the real HCPCS code (H0005 / H2014) for billable
 * occurrences. The Claims Worklist reads charges from `ehr-ext` claims, and a
 * group attendee claim is created from this reference (see
 * `upsertClaimFromGroupAttendee` in ehr-ext.ts).
 */
export interface GroupAttendeeNoteRef {
  sessionId: string;
  occurrenceStart: string;
  facilitatorId: string;
  /**
   * FULL facilitator list with each provider's independent minutes and
   * involvement, snapshotted at documentation time. Rendered on every
   * individualized attendee note (one note per client, all providers shown).
   */
  facilitators?: GroupFacilitatorMinutes[];
  /** The single designated rendering provider that flows to the claim. */
  renderingProviderId?: string;
  /**
   * Individualized attendee notes are the billable unit in DMC-ODS. False for
   * a non-billable category OR an occurrence with fewer than 2 present.
   */
  billingEligible: boolean;
  /** HCPCS code when billable; absent otherwise. */
  billingCode?: string;
  /** How the service was actually delivered for THIS occurrence. */
  modality?: GroupOccurrenceModality;
  /**
   * Group category at documentation time. Drives note access resolution
   * (see noteGateClass): only `sud_clinical_preauth` is Part 2 content.
   */
  category?: GroupCategory;
}

/**
 * Default facilitator list for a session: primary first, then co-facilitators
 * (new list field, falling back to the retired single slot). Minutes default
 * to the scheduled session length and are meant to be EDITED per provider —
 * that editability is the whole point of the model.
 */
export function defaultGroupFacilitators(session: GroupSession): GroupFacilitatorMinutes[] {
  const cos = session.coFacilitatorIds?.length
    ? session.coFacilitatorIds
    : session.coFacilitatorId
      ? [session.coFacilitatorId]
      : [];
  return [
    {
      staffId: session.facilitatorId,
      role: "primary" as const,
      minutes: session.durationMin,
      involvement: "",
    },
    ...cos
      .filter((id) => id && id !== session.facilitatorId)
      .map((id) => ({
        staffId: id,
        role: "co" as const,
        minutes: session.durationMin,
        involvement: "",
      })),
  ];
}

/** Sensible default rendering provider: the primary facilitator. */
export function defaultRenderingProviderId(facilitators: GroupFacilitatorMinutes[]): string {
  return (facilitators.find((f) => f.role === "primary") ?? facilitators[0])?.staffId ?? "";
}

/** Normalize + validate a documented facilitator list. Throws on bad input. */
export function normalizeGroupFacilitators(
  input: GroupFacilitatorMinutes[] | undefined,
  session: GroupSession,
): GroupFacilitatorMinutes[] {
  const list = (input?.length ? input : defaultGroupFacilitators(session)).map((f) => ({
    staffId: f.staffId,
    role: f.role,
    minutes: Math.round(Number(f.minutes) || 0),
    involvement: (f.involvement ?? "").trim(),
  }));
  if (list.length === 0) throw new Error("At least one facilitator is required.");
  if (new Set(list.map((f) => f.staffId)).size !== list.length)
    throw new Error("Each facilitator can only be listed once.");
  if (list.some((f) => f.minutes <= 0))
    throw new Error("Every facilitator needs their own direct-care minutes.");
  if (list.filter((f) => f.role === "primary").length !== 1)
    throw new Error("Exactly one facilitator must be marked primary.");
  return list;
}

const groupSessions: GroupSession[] = [];
const groupEnrollments: GroupSessionEnrollment[] = [];
const groupOccurrences: GroupOccurrenceRecord[] = [];

// §v3.0 Phase 2 — pre-release episode stores.
const preReleaseEpisodes: PreReleaseEpisode[] = [];
const preReleaseForms: PreReleaseFormRecord[] = [];
const preReleaseCapacity: PreReleaseCapacityDetermination[] = [];
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

/**
 * §Pre-release pipeline — carry a real episode release date onto the patient.
 *
 * Two confidences, two rules:
 *  - "estimated" (the ANTICIPATED date): fill-if-empty only. It must never
 *    overwrite a date a human already confirmed.
 *  - "confirmed": always wins, because a person actually being out beats any
 *    earlier projection.
 * Every change appends to `releaseDateMeta.history`, so the projection that
 * preceded a confirmation is still readable.
 */
function _applyEpisodeReleaseDate(
  patientId: string,
  date: string,
  confidence: "estimated" | "confirmed",
): boolean {
  const p = patients.find((x) => x.id === patientId);
  if (!p || !date) return false;
  const confirmed = confidence === "confirmed";
  if (!confirmed && p.releaseDate) return false;
  if (p.releaseDate === date && p.releaseDateMeta?.confidence === confidence) return false;
  const source: ReleaseSource = confirmed ? "confirmed" : "custody";
  const prior = p.releaseDateMeta;
  p.releaseDate = date;
  p.releaseDateMeta = {
    source,
    confidence,
    history: [
      ...(prior?.history ?? []),
      { date, changedAt: new Date().toISOString(), source },
    ],
  };
  return true;
}

/** §Pre-release pipeline — mirror the episode's custody statement onto the patient. */
function _setPatientCustody(ep: PreReleaseEpisode, state: PatientCustody["state"]): void {
  const p = patients.find((x) => x.id === ep.patientId);
  if (!p) return;
  const booking = ep.bookingId ? (p.bookings ?? []).find((b) => b.id === ep.bookingId) : undefined;
  p.custody = {
    state,
    source: "pre_release_episode",
    episodeId: ep.id,
    ...(ep.facilityName ? { facilityName: ep.facilityName } : {}),
    ...(booking?.bookingNumber ? { bookingNumber: booking.bookingNumber } : {}),
    ...(ep.anticipatedReleaseDate
      ? { anticipatedReleaseDate: ep.anticipatedReleaseDate }
      : {}),
    ...(ep.actualReleaseDate ? { confirmedReleaseDate: ep.actualReleaseDate } : {}),
    updatedAt: new Date().toISOString(),
  };
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
  // ----- §5-stage recovery journey ----------------------------------------
  // The stage is SET BY A PERSON, never computed. Both the patient and the
  // care team can set it: the model is a self-check the patient is meant to
  // recognise themselves in, so locking it to staff would make it an
  // assessment done TO them — exactly what the pending clinical review is
  // about. Every change is an append-only audited row, so a care-team
  // correction and a patient's own reading are both visible and reversible.
  /**
   * Full append-only history, newest first. Ordered by INSERTION, not by the
   * timestamp string: two entries written in the same millisecond (a
   * correction made right after a mistake) must still read back in the order
   * they happened.
   */
  recoveryStageHistory(patientId: string): RecoveryStageEntry[] {
    return recoveryStageEntries.filter((e) => e.patientId === patientId).reverse();
  },
  /** The current stage, or undefined when nobody has set one yet. */
  getRecoveryStage(patientId: string): RecoveryStageEntry | undefined {
    return AdelanteEHR.recoveryStageHistory(patientId)[0];
  },
  setRecoveryStage(input: {
    patientId: string;
    stage: RecoveryStageId;
    setBy: { actor: "patient" | "staff"; name: string; role?: string };
    note?: string;
  }): RecoveryStageEntry {
    if (!isRecoveryStageId(input.stage)) throw new Error("Unknown recovery stage");
    const previous = AdelanteEHR.getRecoveryStage(input.patientId);
    const entry: RecoveryStageEntry = {
      id: `rstage_${recoveryStageEntries.length + 1}_${Math.random().toString(36).slice(2, 6)}`,
      patientId: input.patientId,
      stage: input.stage,
      at: new Date().toISOString(),
      setByActor: input.setBy.actor,
      setByName: input.setBy.name,
      ...(input.setBy.role ? { setByRole: input.setBy.role } : {}),
      ...(input.note ? { note: input.note } : {}),
      ...(previous ? { previousStage: previous.stage } : {}),
      reviewPending: RECOVERY_STAGE_REVIEW.pending,
    };
    recoveryStageEntries.push(entry);
    appendAudit({
      category: "care_plan",
      action: "recovery_stage_set",
      patientId: input.patientId,
      actorId: input.setBy.name,
      detail: {
        stage: entry.stage,
        previousStage: entry.previousStage ?? null,
        setBy: entry.setByActor,
        role: entry.setByRole ?? null,
        // Recorded so a reviewer can tell demo-era rows from post-sign-off ones.
        clinicalReviewPending: entry.reviewPending,
      },
    });
    emit();
    return entry;
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
    // Persist so a hard reload / deep link does not silently drop the person
    // back onto the default demo record. Rehydrated on mount by AppShell
    // (never at module scope — SSR renders the default and the client would
    // otherwise hydrate against a different patient).
    try {
      window.localStorage.setItem("adelante.currentPatientId", id);
    } catch {
      /* storage unavailable (SSR / private mode) — in-memory only */
    }
    emit();
  },
  // P0 — create a new patient from signup. Minimal seed; intake fills the rest.
  createPatient(input: {
    firstName: string;
    lastName: string;
    dob?: string;
    phone?: string;
    email?: string;
    preferredLanguage?: PreferredLanguage;
    referralId?: string;
    cin?: string;
    /**
     * §Self-service sign-up — prototype credential metadata only (no secret).
     * Absent for every staff-provisioned path (Track A caseload upload,
     * referral conversion), which is unchanged.
     */
    signupCredential?: SignupCredentialMeta;
    /**
     * §Front-door Phase 3 — Tier 1 informal helper or Tier 2 staff operator.
     * Attribution only; it grants nothing and gates nothing.
     */
    signupAssistedBy?: HelperAttribution;
  }): Patient {
    const assisted = input.signupAssistedBy;
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
      ...(input.email ? { email: input.email } : {}),
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
      ...(input.signupCredential ? { signupCredential: input.signupCredential } : {}),
      ...(assisted ? { signupAssistedBy: assisted } : {}),
    };
    patients.push(p);
    // Only the front door audits itself: Track A / referral conversion calls
    // pass no credential and no helper, and stay silent exactly as before.
    if (input.signupCredential) {
      appendAudit({
        category: "clinical",
        action: assisted?.tier === 2 ? "patient_signup_created_assisted" : "patient_signup_created",
        patientId: p.id,
        actorId: assisted?.tier === 2 ? (assisted.operatorStaffId ?? p.id) : p.id,
        actorRole: assisted?.tier === 2 ? (assisted.operatorRole ?? "staff") : "patient",
        detail: {
          credentialKind: input.signupCredential.kind,
          ...helperAuditDetail(assisted),
        },
      });
    }
    emit();
    return p;
  },
  // P1 — patch identity / contact-prefs fields.
  /**
   * §Pre-release pipeline — a human confirms the release date already on the
   * record (optionally correcting it). This is the ONLY way an estimated
   * custody-supplied date becomes "confirmed" from a screen.
   */
  confirmReleaseDate(input: {
    patientId: string;
    date?: string;
    actorId: string;
    actorRole: string;
  }): void {
    const p = patients.find((x) => x.id === input.patientId);
    if (!p) return;
    const date = input.date || p.releaseDate;
    if (!date) return;
    const prior = p.releaseDateMeta;
    p.releaseDate = date;
    p.releaseDateMeta = {
      source: "confirmed",
      confidence: "confirmed",
      history: [
        ...(prior?.history ?? []),
        { date, changedAt: new Date().toISOString(), source: "confirmed" as ReleaseSource },
      ],
    };
    appendAudit({
      category: "clinical",
      action: "release_date_confirmed",
      patientId: p.id,
      actorId: input.actorId,
      actorRole: input.actorRole,
      detail: { date, priorConfidence: prior?.confidence ?? "unknown" },
    });
    emit();
  },
  updateProfile(

    patientId: string,
    patch: IntakeProfilePatch & Partial<
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
        | "emergencyContacts"
        | "address"
        | "cin"
      >
    >,
  ) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    // §Pre-release pipeline — a hand-typed date is a DIFFERENT fact from the
    // custody-supplied one. Record it as such instead of letting it inherit
    // the episode's provenance and masquerade as confirmed.
    if (patch.releaseDate !== undefined && patch.releaseDate !== p.releaseDate) {
      const prior = p.releaseDateMeta;
      p.releaseDateMeta = patch.releaseDate
        ? {
            source: "self_report",
            confidence: "self_reported",
            history: [
              ...(prior?.history ?? []),
              {
                date: patch.releaseDate,
                changedAt: new Date().toISOString(),
                source: "self_report" as ReleaseSource,
              },
            ],
          }
        : prior;
    }
    Object.assign(p, patch);

    // Keep the legacy single field pointing at the primary contact so older
    // read sites (profile dialog, patient home, chart tab) stay correct.
    if (patch.emergencyContacts) {
      const [primary] = patch.emergencyContacts;
      if (primary) p.emergencyContact = primary;
      else delete p.emergencyContact;
    } else if (patch.emergencyContact) {
      // Legacy single-field writers become the primary of the list.
      const rest = (p.emergencyContacts ?? []).slice(1);
      p.emergencyContacts = [patch.emergencyContact, ...rest];
    }
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
    // Phase 3: `Patient.needs` stays written for the real consumers that still
    // read it (`needs.substanceUse` in the care-plan SUD signal, the CalOMS
    // employment field). MERGED, not replaced — intake only collects four
    // categories, and a whole-object assignment silently erased flags like
    // `substanceUse` that intake never asks about.
    p.needs = { ...(p.needs ?? {}), ...payload.needs };
    // §Consent re-prompt safety — intake is re-enterable (re-screen tasks
    // deep-link back to /intake). A second pass through this flow must never
    // DOWNGRADE a consent that is already on file: an abandoned or skipped
    // re-consent is not a revocation. Revocation happens only through the
    // consent ledger (`revokeConsentRecord` / `setConsent(..., false)`), which
    // records reason, actor and timestamp. So this write is grant-only.
    p.consents = {
      hipaa: payload.hipaa || p.consents.hipaa,
      part2Sud: payload.part2Sud || p.consents.part2Sud,
      signedAt: p.consents.signedAt ?? now,
    };
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
    input: Omit<
      Referral,
      "id" | "status" | "createdAt" | "smsSentAt" | "outreachTask" | "submittedBy"
    > & {
      requestManualOutreach?: boolean;
      /** Which form was used. Staff → the acting staff member is resolved here. */
      channel: "staff" | "public";
    },
  ) {
    const { requestManualOutreach, channel, ...rest } = input;
    // Don't trust the UI alone: the referrer phone-or-email rule is enforced
    // here too. Blank strings are normalised away so "   " can't satisfy it.
    rest.referrerPhone = rest.referrerPhone?.trim() || undefined;
    rest.referrerEmail = rest.referrerEmail?.trim() || undefined;
    if (!referrerHasContact(rest)) throw new Error(REFERRER_CONTACT_REQUIRED_MSG);
    const submittedBy: ReferralSubmitter =
      channel === "staff" ? { kind: "staff", actor: _referralActor() } : { kind: "external" };
    // Fallback: no phone, no contact consent, or referrer explicitly requested
    // manual outreach → skip the Twilio welcome-text trigger and queue a
    // manual-call task for the care team instead.
    const canSendSms = !requestManualOutreach && !!rest.phone && rest.consentToContact;
    const now = new Date();
    // §Phase 4e — when no welcome text can go out, real work is created here,
    // not just a flag: an open, dated, role-pooled outreach task on the
    // referral itself. Due tomorrow, matching the promise the form makes.
    const reason = requestManualOutreach
      ? "no_phone"
      : referralNeedsOutreachTask({ phone: rest.phone, consentToContact: rest.consentToContact });
    const due = new Date(now.getTime() + 24 * 3600 * 1000).toISOString().slice(0, 10);
    const r: Referral = {
      ...rest,
      id: uid(),
      status: "submitted",
      createdAt: now.toISOString(),
      submittedBy,
      // §Phase 4a — NOTHING is stamped as sent here. The caller attempts a
      // real send and writes the real outcome back via
      // `recordReferralWelcomeDelivery`.
      ...(canSendSms ? {} : { outreachTask: "manual_call" as const }),
      ...(canSendSms || !reason
        ? {}
        : {
            outreach: {
              attempts: [],
              task: {
                reason: reason as "no_phone" | "no_consent",
                createdAt: now.toISOString(),
                dueDate: due,
                status: "open" as const,
                allowedRoles: STAFF_ROLES.map((r) => r.key).filter(
                  (role) => canAccess(role, "care_coordination").level === "write",
                ),
              },
            } satisfies ReferralOutreachState,
          }),
    };
    referrals.unshift(r);
    appendAudit({
      category: "clinical",
      action: "referral_submitted",
      at: r.createdAt,
      actorId: submittedBy.kind === "staff" ? submittedBy.actor.staffId : "external",
      actorRole: submittedBy.kind === "staff" ? submittedBy.actor.role : undefined,
      // Which contact kinds were given — never the third-party values themselves.
      detail: {
        referralId: r.id,
        channel,
        referralSource: r.referralSource,
        referringAgency: r.referringAgency,
        referrerName: r.referrerName,
        referrerContactProvided: [
          ...(r.referrerPhone ? ["phone"] : []),
          ...(r.referrerEmail ? ["email"] : []),
        ],
      },
    });
    emit();
    return r;
  },
  /** True when a welcome text should be attempted for this referral. */
  referralWantsWelcomeSms(r: Referral): boolean {
    return !r.outreachTask && !!r.phone && r.consentToContact && !r.welcomeSms;
  },
  /** Truthful write-back of a real send attempt. */
  recordReferralWelcomeDelivery(
    id: string,
    result: { status: "sent" | "not_configured" | "failed"; detail?: string },
  ) {
    const r = referrals.find((x) => x.id === id);
    if (!r) return;
    const at = new Date().toISOString();
    r.welcomeSms = { status: result.status, at, detail: result.detail };
    // `smsSentAt` means "a message genuinely left" — never set on a failure.
    if (result.status === "sent") r.smsSentAt = at;
    emit();
  },
  /** §Phase 4c — truthful write-back of a referrer status-change text. */
  recordReferrerUpdateDelivery(
    id: string,
    result: {
      event: "received" | "contacted" | "enrolled" | "declined";
      status: "sent" | "not_configured" | "failed";
      detail?: string;
    },
  ) {
    const r = referrals.find((x) => x.id === id);
    if (!r) return;
    r.referrerUpdates = [
      ...(r.referrerUpdates ?? []),
      {
        event: result.event,
        status: result.status,
        at: new Date().toISOString(),
        ...(result.detail ? { detail: result.detail } : {}),
      },
    ];
    emit();
  },

  // ----- §Phase 4e manual outreach ------------------------------------------
  /** Take ownership of an open outreach task (pool claim, as on `CaseTask`). */
  claimReferralOutreach(id: string) {
    const r = referrals.find((x) => x.id === id);
    const task = r?.outreach?.task;
    if (!r || !task || task.status !== "open") return;
    const who = _referralActor();
    task.claimedBy = who;
    task.claimedAt = new Date().toISOString();
    appendAudit({
      category: "clinical",
      action: "referral_outreach_claimed",
      actorId: who.staffId,
      actorRole: who.role,
      detail: { referralId: r.id },
    });
    emit();
  },
  /**
   * Log a real manual outreach attempt. A `reached` outcome closes the task
   * and marks the referral contacted — that IS the contact, so recording it
   * twice would be dishonest bookkeeping.
   */
  logReferralOutreachAttempt(
    id: string,
    input: { outcome: ReferralOutreachOutcome; note?: string },
  ) {
    const r = referrals.find((x) => x.id === id);
    if (!r) return;
    const who = _referralActor();
    const at = new Date().toISOString();
    const attempt: ReferralOutreachAttempt = {
      id: uid(),
      at,
      outcome: input.outcome,
      by: who,
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    };
    r.outreach = {
      task: r.outreach?.task,
      attempts: [...(r.outreach?.attempts ?? []), attempt],
    };
    if (input.outcome === "reached") {
      if (r.outreach.task && r.outreach.task.status === "open") {
        r.outreach.task.status = "done";
        r.outreach.task.completedAt = at;
        r.outreach.task.completedBy = who;
      }
      if (r.status === "submitted") {
        r.status = "contacted";
        r.contactedAt = at;
        r.contactedBy = who;
      }
    }
    appendAudit({
      category: "clinical",
      action: "referral_outreach_attempt",
      actorId: who.staffId,
      actorRole: who.role,
      detail: { referralId: r.id, outcome: input.outcome },
    });
    emit();
  },
  /** Close the outreach task without a successful contact (e.g. handed off). */
  completeReferralOutreachTask(id: string) {
    const r = referrals.find((x) => x.id === id);
    const task = r?.outreach?.task;
    if (!r || !task || task.status !== "open") return;
    const who = _referralActor();
    task.status = "done";
    task.completedAt = new Date().toISOString();
    task.completedBy = who;
    appendAudit({
      category: "clinical",
      action: "referral_outreach_closed",
      actorId: who.staffId,
      actorRole: who.role,
      detail: { referralId: r.id },
    });
    emit();
  },

  // ----- §Phase 4a referral dispositions ------------------------------------
  markReferralContacted(id: string) {
    const r = referrals.find((x) => x.id === id);
    if (!r) return;
    if (r.status !== "submitted") throw new Error("Only a submitted referral can be marked contacted.");
    const who = _referralActor();
    r.status = "contacted";
    r.contactedAt = new Date().toISOString();
    r.contactedBy = who;
    appendAudit({
      category: "clinical",
      action: "referral_contacted",
      actorId: who.staffId,
      actorRole: who.role,
      detail: { referralId: r.id },
    });
    emit();
  },
  /**
   * Materializes the client record. Carries the referral context that used to
   * be silently dropped, using the fields that already exist on the record —
   * release date and county of release. Referrer, agency and source are NOT
   * duplicated: the record links back to the referral, which holds them.
   *
   * Deliberately does NOT set `frontDoor.heardAbout`: a justice referral
   * source there would change the person's resolved population track, which
   * is a separate concern from recording how they arrived.
   */
  enrollReferral(id: string) {
    const r = referrals.find((x) => x.id === id);
    if (!r) return undefined;
    if (r.status === "enrolled") return r.enrolledPatientId;
    if (r.status === "declined") throw new Error("This referral was declined and cannot be enrolled.");
    const who = _referralActor();
    const p = AdelanteEHR.createPatient({
      firstName: r.firstName,
      lastName: r.lastName,
      dob: r.dob,
      phone: r.phone,
      email: r.email,
      referralId: r.id,
      cin: r.cin,
    });
    if (r.releaseDate) p.releaseDate = r.releaseDate;
    if (r.countyOfRelease) {
      p.coverage = {
        ...(p.coverage ?? { status: "none_unsure" as CoverageStatus, verified: "pending" as const }),
        countyOfRelease: r.countyOfRelease,
      };
    }
    // §Phase 8b — referrer-reported benefits go through the one write path.
    if (r.reportedBenefits?.coverageType || r.cin) {
      AdelanteEHR.recordIntakeBenefits(
        p.id,
        { ...(r.reportedBenefits ?? {}), ...(r.cin ? { cin: r.cin } : {}) },
        { source: "referrer_reported", via: "referral_conversion", actorId: who.staffId, actorName: r.referrerName, actorRole: who.role },
      );
    }
    r.status = "enrolled";
    r.enrolledPatientId = p.id;
    r.enrolledAt = new Date().toISOString();
    r.enrolledBy = who;
    appendAudit({
      category: "clinical",
      action: "referral_enrolled",
      patientId: p.id,
      actorId: who.staffId,
      actorRole: who.role,
      detail: {
        referralId: r.id,
        referralSource: r.referralSource,
        referringAgency: r.referringAgency,
        referrerName: r.referrerName,
      },
    });
    // §Phase 4f — enrollment used to end here, leaving nobody responsible for
    // the four setup steps. A real patient row now exists, so this is ordinary
    // patient-keyed work: unassigned to a role pool, claimable, deduped on the
    // referral so a re-enroll can never double it.
    const setupDue = new Date();
    setupDue.setDate(setupDue.getDate() + 3);
    AdelanteEHR.createCaseTask({
      patientId: p.id,
      assignedTo: "",
      title: "New enrollment — assign care team and book intake",
      detail: `${p.firstName} ${p.lastName} enrolled from a referral${r.referringAgency ? ` (${r.referringAgency})` : ""}. Assign a case manager and a primary clinician, then complete intake and book the first session.`,
      dueDate: setupDue.toISOString().slice(0, 10),
      origin: "referral_enrollment_setup",
      taskType: "enrollment_setup",
      allowedRoles: STAFF_ROLES.map((s) => s.key).filter(
        (role) => canAccess(role, "care_coordination").level === "write",
      ),
      dedupeKey: `enrollment-setup:${r.id}`,
    });
    emit();
    return p.id;
  },
  declineReferral(id: string, input: { reason: string; note?: string }) {
    const r = referrals.find((x) => x.id === id);
    if (!r) return;
    if (r.status === "enrolled") throw new Error("An enrolled referral cannot be declined.");
    if (!input.reason) throw new Error("A decline reason is required.");
    const who = _referralActor();
    r.status = "declined";
    r.declinedAt = new Date().toISOString();
    r.declinedBy = who;
    r.declineReason = input.reason;
    if (input.note) r.declineNote = input.note;
    appendAudit({
      category: "clinical",
      action: "referral_declined",
      actorId: who.staffId,
      actorRole: who.role,
      detail: { referralId: r.id, reason: input.reason, ...(input.note ? { note: input.note } : {}) },
    });
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
    /** How this booking was created. Defaults to `staff_scheduled`. */
    source?: AppointmentSource;
    /**
     * Staff-only escape hatch for a deliberate overlap on the patient's own
     * calendar (e.g. a correction in progress, or a paired visit a human has
     * judged to be fine). Never set from patient self-booking.
     */
    allowPatientOverlap?: boolean;
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
    // Patient-level conflict: the clinician check above says nothing about the
    // patient's OWN calendar, so a patient could self-book straight over an
    // appointment the pre-release team arranged with a different clinician.
    if (!input.allowPatientOverlap) {
      const own = _patientOverlap(input.patientId, input.start, input.durationMin);
      if (own) throw new Error(_patientOverlapMessage(own));
    }
    const { allowPatientOverlap: _ignored, ...fields } = input;
    const a: Appointment = {
      ...fields,
      source: input.source ?? "staff_scheduled",
      id: uid(),
      status: "scheduled",
    };
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
    // Same patient-level guard as booking: moving a visit must not land it on
    // top of another visit the same patient already has.
    const ownOverlap = _patientOverlap(
      a.patientId,
      newStart,
      patch?.durationMin ?? a.durationMin,
      apptId,
    );
    if (ownOverlap) throw new Error(_patientOverlapMessage(ownOverlap));
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
      // §Phase 7b — an attended visit opens its claim at `documented`. The
      // claim (not the visit) carries billing status from here on.
      _claimBridge?.onAttended(a.id);
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
    // (see screener helpers below)
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    p.crisisFlag = { source, raisedAt: new Date().toISOString() };
    emit();
  },
  /** Latest stored result for an instrument — the one the checklist reads. */
  /**
   * §Part 2 store gate — is this viewer allowed to read THIS instrument for
   * THIS patient? One evaluation point, reusing the mechanisms that already
   * govern every other piece of Part 2 content:
   *   • staff → `canAccess(role, "screeners_sud", patient)`, the same class
   *     `noteGateClass()` routes SUD notes through and the same live ASCMI
   *     `sud_treatment` consent check;
   *   • advocate → `advocatePart2Access(linkId)`, i.e. the Phase 4
   *     `advocateSudAccess` axis, plus the link's own patient scope;
   *   • patient → their own record, always.
   * Non-Part 2 instruments (PHQ-9/GAD-7/PHQ-2/GAD-2/PCL-5/AHC-HRSN) are never
   * gated here — Part 2 is not a general chart lock.
   */
  screenerAccess(
    patientId: string,
    key: string,
    viewer: ScreenerViewer = { kind: "staff" },
  ): { part2: boolean; allowed: boolean; reason?: string } {
    if (!isPart2Screener(key)) return { part2: false, allowed: true };
    if (viewer.kind === "system") return { part2: true, allowed: true };
    if (viewer.kind === "patient")
      return viewer.patientId === patientId
        ? { part2: true, allowed: true }
        : { part2: true, allowed: false, reason: "A patient may only read their own screeners." };
    if (viewer.kind === "advocate") {
      const link = advocateLinks.find((l) => l.id === viewer.linkId);
      if (!link || link.patientId !== patientId)
        return { part2: true, allowed: false, reason: "No advocate connection to this patient." };
      const gate = AdelanteEHR.advocatePart2Access(link.id);
      return gate.unmasked
        ? { part2: true, allowed: true }
        : {
            part2: true,
            allowed: false,
            reason: "42 CFR Part 2 content is masked for this advocate connection.",
          };
    }
    const role = viewer.role ?? getActingRole();
    const patient = patients.find((x) => x.id === patientId);
    /**
     * §Author/actor exception — the person who PERSONALLY administered THIS
     * result keeps read access to it, whatever their role's general
     * `screeners_sud` matrix entry says. Scoped to authorship of one specific
     * stored result: it never widens a role, never reaches another patient,
     * and never reaches a result the viewer did not key. Proxy entries count
     * both identities, matching how the entry was authorized when written.
     */
    const staffId = viewer.staffId ?? (viewer.role ? undefined : getActingStaff()?.id);
    if (staffId) {
      const admin = patient?.screeners[key]?.administeredBy;
      if (admin && (admin.enteredBy.staffId === staffId || admin.attributedTo?.staffId === staffId))
        return { part2: true, allowed: true };
    }
    const gate = canAccess(role, "screeners_sud", patient);
    return gate.locked
      ? {
          part2: true,
          allowed: false,
          reason: gate.reason ?? "42 CFR Part 2 consent required to view this screener.",
        }
      : { part2: true, allowed: true };
  },
  /**
   * Latest stored result for an instrument. ENFORCED at the store: a Part 2
   * instrument read by an unauthorized caller throws — it is not silently
   * reported as "never administered", which would be a different (and false)
   * clinical statement. UI that wants to render a masked row should call
   * `viewScreenerResult` instead.
   */
  getScreenerResult(
    patientId: string,
    key: string,
    viewer: ScreenerViewer = { kind: "staff" },
  ): ScreenerResult | undefined {
    const gate = AdelanteEHR.screenerAccess(patientId, key, viewer);
    if (!gate.allowed) throw new Part2AccessError(gate.reason ?? "Access denied.");
    return patients.find((x) => x.id === patientId)?.screeners[key];
  },
  /** Non-throwing read for UI: either the result, or an explained mask. */
  viewScreenerResult(
    patientId: string,
    key: string,
    viewer: ScreenerViewer = { kind: "staff" },
  ): { restricted: boolean; reason?: string; result?: ScreenerResult } {
    const gate = AdelanteEHR.screenerAccess(patientId, key, viewer);
    if (!gate.allowed) return { restricted: true, reason: gate.reason };
    const result = patients.find((x) => x.id === patientId)?.screeners[key];
    return result ? { restricted: false, result } : { restricted: false };
  },
  /**
   * Existence only, no score/severity/answers. Workflow completion ("this
   * checklist step has been done") is not a disclosure of Part 2 CONTENT, so
   * this is deliberately ungated — it is what the pre-release checklist uses.
   */
  hasScreenerResult(patientId: string, key: string): boolean {
    return Boolean(patients.find((x) => x.id === patientId)?.screeners[key]);
  },
  /**
   * §Pre-release build 2 — population-health rollup over the SAME
   * `ScreenerResult` storage every instrument already writes to. No parallel
   * analytics table: positive-screen rates and SDOH domain prevalence are
   * derived from `patient.screeners` / `screenerHistory` on demand.
   */
  /**
   * §Part 2 — aggregates are computed over the cohort the VIEWER may actually
   * read. Counts and rates are not individual-level disclosures, but a cohort
   * of one makes them exactly that, so the same `screenerAccess` gate filters
   * the contributing patients per Part 2 instrument. A row whose cohort was
   * narrowed is flagged `restricted`, and a row with no readable patients is
   * reported as zero-administered rather than silently blended into the rest.
   * Non-Part 2 instruments and SDOH domain prevalence are unaffected.
   */
  screenerPopulationSummary(
    opts: { keys?: string[]; patientIds?: string[]; viewer?: ScreenerViewer } = {},
  ): {
    instruments: {
      key: string;
      name: string;
      administered: number;
      positive: number;
      positiveRate: number;
      restricted?: boolean;
    }[];
    sdohDomains: { key: string; label: string; positive: number; screened: number; rate: number }[];
  } {
    const cohort = patients.filter((p) => !opts.patientIds || opts.patientIds.includes(p.id));
    const viewer: ScreenerViewer = opts.viewer ?? { kind: "staff" };
    const keys =
      opts.keys ?? Array.from(new Set(cohort.flatMap((p) => Object.keys(p.screeners ?? {}))));
    const instruments = keys.map((key) => {
      const def = screenerByKey(key);
      const part2 = isPart2Screener(key);
      const readable = part2
        ? cohort.filter((p) => AdelanteEHR.screenerAccess(p.id, key, viewer).allowed)
        : cohort;
      const results = readable
        .map((p) => p.screeners[key])
        .filter((r): r is ScreenerResult => Boolean(r));
      const positive = results.filter(
        (r) =>
          r.positive ?? (def?.positiveCutoff !== undefined ? r.score >= def.positiveCutoff : false),
      ).length;
      const row: {
        key: string;
        name: string;
        administered: number;
        positive: number;
        positiveRate: number;
        restricted?: boolean;
      } = {
        key,
        name: def?.name ?? key,
        administered: results.length,
        positive,
        positiveRate: results.length ? positive / results.length : 0,
      };
      if (part2 && readable.length < cohort.length) row.restricted = true;
      return row;
    });
    // Domain prevalence across everyone with a domain instrument on file.
    const tally = new Map<string, { label: string; positive: number; screened: number }>();
    for (const p of cohort) {
      for (const r of Object.values(p.screeners ?? {})) {
        if (!r?.domains) continue;
        if (opts.keys && !opts.keys.includes(r.key)) continue;
        for (const d of r.domains) {
          const row = tally.get(d.key) ?? { label: d.label, positive: 0, screened: 0 };
          row.screened += 1;
          if (d.positive) row.positive += 1;
          tally.set(d.key, row);
        }
      }
    }
    return {
      instruments,
      sdohDomains: [...tally.entries()].map(([key, v]) => ({
        key,
        label: v.label,
        positive: v.positive,
        screened: v.screened,
        rate: v.screened ? v.positive / v.screened : 0,
      })),
    };
  },
  /**
   * §Phase 8a — MERGES into existing coverage (never replaces). Plans, check
   * history and flags the patch doesn't mention survive; "verified" without a
   * recorded check is downgraded to "self_reported". Audited with the list of
   * changed fields.
   */
  setCoverage(
    patientId: string,
    patch: CoveragePatch,
    actor?: { id: string; role: string; source?: string },
  ) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    const before = p.coverage;
    const { next, changed } = mergeCoverage(before, patch);
    p.coverage = next;
    if (changed.length) {
      appendAudit({
        category: "clinical",
        action: "coverage_updated",
        actorId: actor?.id ?? "patient_self",
        actorRole: actor?.role ?? "patient",
        patientId,
        detail: {
          source: actor?.source ?? "intake",
          changed,
          statusFrom: before?.status,
          statusTo: next.status,
          typeFrom: before?.coverageType,
          typeTo: next.coverageType,
          verifiedTo: next.verified,
          plansKept: next.plans?.length ?? 0,
          checksKept: next.verifications?.length ?? 0,
        },
      });
    }
    emit();
  },

  // ---------- §Adelante Journey Phase 5 — self-help Library / Exercises ----
  //
  // FACADE ONLY. The data lives in `src/lib/engagement.ts`, keyed by patient
  // id — it is engagement data, not clinical documentation, and no longer sits
  // on `Patient`. These wrappers exist so callers keep one entry point and so
  // writes still fan out to the EHR subscriber set; they hold no state.

  /** Lesson ids this patient has completed. */
  completedLibraryItems(patientId: string): string[] {
    return Engagement.completedLibraryItems(patientId);
  },

  /** Exercise ids this patient has completed. */
  completedExercises(patientId: string): string[] {
    return Engagement.completedExercises(patientId);
  },

  savedToolkitItems(patientId: string): SavedToolkitItem[] {
    return Engagement.savedToolkitItems(patientId);
  },

  /** §Phase 5b — Recovery module lesson ids this patient has completed. */
  completedRecoveryLessons(patientId: string): string[] {
    return Engagement.completedRecoveryLessons(patientId);
  },

  /** §Phase 5b — structured tool-flow selections for one recovery lesson. */
  recoveryToolFlow(patientId: string, lessonId: string) {
    return Engagement.recoveryToolFlow(patientId, lessonId);
  },

  /**
   * §Lesson-player Build 2 — the patient's own in-progress lesson work
   * (current step, free text, activity selections). Patient-scoped read; it is
   * deliberately NOT part of any advocate or cohort DTO.
   */
  lessonResponse(patientId: string, surface: Engagement.LessonSurface, lessonId: string) {
    return Engagement.lessonResponse(patientId, surface, lessonId);
  },

  /** Save in-progress lesson work. Merge semantics; audited once per lesson. */
  saveLessonResponse(
    patientId: string,
    surface: Engagement.LessonSurface,
    lessonId: string,
    patch: Engagement.LessonResponsePatch,
    opts: { actorRole?: string } = {},
  ) {
    return Engagement.saveLessonResponse(patientId, surface, lessonId, patch, opts);
  },

  clearLessonResponse(patientId: string, surface: Engagement.LessonSurface, lessonId: string) {
    Engagement.clearLessonResponse(patientId, surface, lessonId);
  },

  completeRecoveryLesson(
    patientId: string,
    lessonId: string,
    selection: { warningSigns?: string[]; supportPeople?: string[]; todayAction?: string },
    opts: { saveToolkit?: boolean; actorRole?: string } = {},
  ) {
    return Engagement.completeRecoveryLesson(patientId, lessonId, selection, opts);
  },

  /** Counts for population-health/outcomes joins, by patient id. */
  engagementSummary(patientId: string) {
    return Engagement.engagementSummary(patientId);
  },

  // ---------- §Adelante Journey Phase 7 — Safety plan (Stanley-Brown) -------
  //
  // FACADE ONLY. Data lives in `src/lib/safetyPlan.ts` (clinical-adjacent,
  // patient-authored, gated by the `safety_plan` record class). Callers use
  // one entry point; these wrappers hold no state.
  getSafetyPlan(patientId: string) {
    return SafetyPlanStore.getSafetyPlan(patientId);
  },
  ensureSafetyPlan(patientId: string, author?: string) {
    if (!_patient(patientId)) return undefined;
    return SafetyPlanStore.ensureSafetyPlan(patientId, author);
  },
  safetyPlanEntries(patientId: string, sectionId?: SafetyPlanStore.SafetyPlanSectionId) {
    return SafetyPlanStore.safetyPlanEntries(patientId, sectionId);
  },
  safetyPlanSummary(patientId: string) {
    return SafetyPlanStore.safetyPlanSummary(patientId);
  },
  addSafetyPlanEntry(
    patientId: string,
    input: Parameters<typeof SafetyPlanStore.addSafetyPlanEntry>[1],
  ) {
    return SafetyPlanStore.addSafetyPlanEntry(patientId, input);
  },
  updateSafetyPlanEntry(
    patientId: string,
    entryId: string,
    patch: Parameters<typeof SafetyPlanStore.updateSafetyPlanEntry>[2],
  ) {
    return SafetyPlanStore.updateSafetyPlanEntry(patientId, entryId, patch);
  },
  removeSafetyPlanEntry(patientId: string, entryId: string, opts?: { actorRole?: string }) {
    return SafetyPlanStore.removeSafetyPlanEntry(patientId, entryId, opts ?? {});
  },
  markSafetyPlanReviewed(patientId: string, reviewedBy: string, actorRole?: string) {
    return SafetyPlanStore.markSafetyPlanReviewed(patientId, reviewedBy, actorRole);
  },

  // ---------- §Phase 7 part 2 — PHQ-2 / GAD-2 weekly quick check ----------
  //
  // The short forms are stored through the SAME `recordScreener` path as the
  // full instruments (same `ScreenerResult`, same `screenerHistory`, same
  // `screeners_mh` record class, same care-plan recompute). The only new
  // behaviour is the gateway: at or above the standard cutoff of 3 we create
  // the real follow-up work for the FULL instrument — a `PatientTask` of the
  // existing "rescreen" kind (the same shape `rescreensDue` produces) plus a
  // CaseTask for the clinician who administers it.
  recordQuickCheck(
    patientId: string,
    answers: { "phq-2"?: number[]; "gad-2"?: number[] },
    opts: { actorRole?: string } = {},
  ): {
    results: ScreenerResult[];
    escalated: { shortFormKey: string; fullFormKey: string; score: number; taskId: string }[];
  } {
    const p = _patient(patientId);
    const results: ScreenerResult[] = [];
    const escalated: {
      shortFormKey: string;
      fullFormKey: string;
      score: number;
      taskId: string;
    }[] = [];
    if (!p) return { results, escalated };
    const completedAt = new Date().toISOString();
    for (const def of SHORT_FORM_SCREENERS) {
      const items = answers[def.key as "phq-2" | "gad-2"];
      if (!items || items.length === 0) continue;
      const score = items.reduce((a, b) => a + (Number(b) || 0), 0);
      const result: ScreenerResult = {
        key: def.key,
        score,
        severity: _severityFor(def, score),
        completedAt,
        timepoint: "adhoc",
      };
      AdelanteEHR.recordScreener(patientId, result);
      results.push(result);
      if (!isShortFormPositive(def, score)) continue;
      // Real, traceable hand-off into the full instrument.
      const taskId = uid();
      p.tasks = [
        {
          id: taskId,
          kind: "rescreen",
          label: `Complete the full ${def.fullFormKey.toUpperCase()} — your ${def.name} quick check suggested it would help`,
          screenerKey: def.fullFormKey,
          createdAt: completedAt,
        },
        ...(p.tasks ?? []),
      ];
      AdelanteEHR.createCaseTask({
        patientId,
        assignedTo: p.caseManagerId ?? "",
        title: `Administer ${def.fullFormKey.toUpperCase()} — positive ${def.name} (${score}/6)`,
        detail: `${def.name} quick check scored ${score} (cutoff ${def.positiveCutoff}). Administer the full ${def.fullFormKey.toUpperCase()} and document the result.`,
        dueDate: new Date().toISOString().slice(0, 10),
        origin: "screener_flag",
        allowedRoles: ["ecm_provider", "therapist", "pmhnp", "clinical_trainee"],
        dedupeKey: `shortform:${patientId}:${def.key}:${completedAt.slice(0, 10)}`,
      });
      escalated.push({
        shortFormKey: def.key,
        fullFormKey: def.fullFormKey,
        score,
        taskId,
      });
      appendAudit({
        category: "clinical",
        action: "short_form_escalated",
        patientId,
        actorRole: opts.actorRole ?? "patient",
        detail: { shortFormKey: def.key, fullFormKey: def.fullFormKey, score },
      });
    }
    emit();
    return { results, escalated };
  },

  /** Last completed quick check across both short forms. */
  lastQuickCheckAt(patientId: string): string | undefined {
    const p = _patient(patientId);
    const rows = (p?.screenerHistory ?? []).filter((h) => shortFormByKey(h.key));
    return rows
      .map((r) => r.completedAt)
      .sort()
      .pop();
  },

  /**
   * §Patient portal Build 2 — every quick-check completion instant, for the
   * dashboard's check-in streak. Short forms only (the same `shortFormByKey`
   * filter `lastQuickCheckAt` uses), so this never exposes an AUDIT-10 /
   * DAST-10 date and needs no Part 2 gate.
   */
  quickCheckDates(patientId: string): string[] {
    const p = _patient(patientId);
    return (p?.screenerHistory ?? [])
      .filter((h) => shortFormByKey(h.key))
      .map((r) => r.completedAt);
  },

  /** Weekly cadence: due when never done, or 7+ days since the last one. */
  quickCheckDue(patientId: string): boolean {
    const last = AdelanteEHR.lastQuickCheckAt(patientId);
    if (!last) return true;
    const days = (Date.now() - new Date(last).getTime()) / 86_400_000;
    return days >= QUICK_CHECK_INTERVAL_DAYS;
  },

  /** Open full-instrument follow-ups produced by a positive quick check. */
  pendingFullScreeners(patientId: string): PatientTask[] {
    return (_patient(patientId)?.tasks ?? []).filter(
      (t) => t.kind === "rescreen" && !t.completedAt,
    );
  },

  // ---------- §Phase 7 part 2 — medication adherence self-report ----------
  //
  // FACADE ONLY. Rows live in `src/lib/medAdherence.ts` and reference real
  // MedOrder ids and real derived MAR slots. Charting a dose is still staff-
  // only (`chartDose`) — nothing here writes a DoseAdministration.
  selfReportDose(patientId: string, input: Parameters<typeof MedAdherence.recordSelfReport>[1]) {
    if (!_patient(patientId)) return undefined;
    return MedAdherence.recordSelfReport(patientId, input);
  },
  listDoseSelfReports(patientId: string, opts?: { orderId?: string; facilityDate?: string }) {
    return MedAdherence.listSelfReports(patientId, opts);
  },
  adherenceWeek(patientId: string, opts?: { days?: number; endDate?: Date; orderId?: string }) {
    const p = _patient(patientId);
    return p ? MedAdherence.adherenceWeek(p, opts) : [];
  },
  /** Today's real MAR slots plus the patient's self-report on each. */
  patientDoseChecklist(patientId: string, dateKey?: string) {
    const p = _patient(patientId);
    if (!p) return [];
    return MedAdherence.doseChecklist(p, dateKey);
  },

  /**
   * Patient-reported side effect on a REAL order. Creates the staff work item
   * so it lands on a surface someone actually works, never unread data.
   */
  reportMedSideEffect(
    patientId: string,
    input: {
      orderId: string;
      severity: MedAdherence.SideEffectSeverity;
      note: string;
      reportedBy?: string;
      actorRole?: string;
    },
  ) {
    const p = _patient(patientId);
    if (!p) return undefined;
    const order = p.orders?.find((o) => o.id === input.orderId);
    if (!order) throw new Error("That medication is not on your current order list.");
    const drugName = order.productName ?? order.drugName;
    const report = MedAdherence.addSideEffectReport(patientId, { ...input, drugName });
    const task = AdelanteEHR.createCaseTask({
      patientId,
      assignedTo: p.caseManagerId ?? "",
      title: `Side effect reported — ${drugName} (${report.severity})`,
      detail: `${p.firstName} ${p.lastName} reported a ${report.severity} side effect on ${drugName}. Patient note: "${report.note}"`,
      dueDate: new Date().toISOString().slice(0, 10),
      origin: "med_side_effect",
      priority: report.severity === "severe" ? "urgent" : "routine",
      allowedRoles: ["pmhnp", "ecm_provider", "therapist", "medical_assistant"],
      dedupeKey: `sideeffect:${report.id}`,
    });
    if (task) MedAdherence.attachSideEffectTask(patientId, report.id, task.id);
    return MedAdherence.listSideEffectReports(patientId, { orderId: input.orderId })[0];
  },
  listMedSideEffects(patientId: string, opts?: { orderId?: string; openOnly?: boolean }) {
    return MedAdherence.listSideEffectReports(patientId, opts);
  },
  allMedSideEffects(opts?: { openOnly?: boolean }) {
    return MedAdherence.allSideEffectReports(opts);
  },
  acknowledgeMedSideEffect(patientId: string, reportId: string, by: string, actorRole?: string) {
    return MedAdherence.acknowledgeSideEffect(patientId, reportId, by, actorRole);
  },

  /** Mark a lesson complete. Idempotent; auto-saves the toolkit takeaway. */
  completeLibraryItem(
    patientId: string,
    itemId: string,
    opts: { saveToolkit?: boolean; actorRole?: string } = {},
  ): { completed: boolean; alreadyComplete: boolean } {
    if (!_patient(patientId)) return { completed: false, alreadyComplete: false };
    return Engagement.completeLibraryItem(patientId, itemId, opts);
  },

  /** Mark an exercise complete. Idempotent; same shape as lessons. */
  completeExercise(
    patientId: string,
    exerciseId: string,
    opts: { saveToolkit?: boolean; actorRole?: string } = {},
  ): { completed: boolean; alreadyComplete: boolean } {
    if (!_patient(patientId)) return { completed: false, alreadyComplete: false };
    return Engagement.completeExercise(patientId, exerciseId, opts);
  },

  /** One saved entry per source id. Re-saving refreshes the label. */
  saveToolkitItem(
    patientId: string,
    input: { id: string; label: string; from: ToolkitOrigin },
  ): SavedToolkitItem | undefined {
    if (!_patient(patientId)) return undefined;
    return Engagement.saveToolkitItem(patientId, input);
  },

  removeToolkitItem(patientId: string, id: string): void {
    Engagement.removeToolkitItem(patientId, id);
  },

  // ---------- Front-door entry sequence (Phase 1) ----------

  /** Merge-write the front-door answers. Safe to call once per question. */
  recordFrontDoorEntry(patientId: string, patch: Partial<Omit<FrontDoorEntry, "recordedAt">>) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return undefined;
    const base: FrontDoorEntry = p.frontDoor ?? {
      existingCare: "unsure",
      recordedAt: new Date().toISOString(),
    };
    const next: FrontDoorEntry = { ...base, ...patch, recordedAt: new Date().toISOString() };
    // Phase 2 safety-net lookup hook: "not sure" about an existing record is
    // the thing a later lookup has to resolve. Nothing reads this yet.
    if (patch.existingCare !== undefined) {
      next.recordLookupPending = patch.existingCare === "unsure";
    }
    p.frontDoor = next;
    appendAudit({
      category: "clinical",
      action: "front_door_entry_recorded",
      patientId,
      actorId: "patient",
      detail: { fields: Object.keys(patch) },
    });
    emit();
    return next;
  },

  getFrontDoorEntry(patientId: string): FrontDoorEntry | undefined {
    return patients.find((x) => x.id === patientId)?.frontDoor;
  },

  // ---------- §Front-door Phase 2 — missed pre-release hand-off ----------

  /**
   * Safety-net background lookup. Runs for the Phase 1 "not sure" population
   * (`frontDoor.recordLookupPending`) and for anyone answering yes / not sure
   * to justice-involvement history with no plan already found.
   *
   * A match routes toward the Phase 1 reconnection path (`/start/reconnect`);
   * no match means a genuine missed hand-off and the caller generates the
   * catch-up list. The lookup is DISCLOSED to the person — see
   * `LOOKUP_DISCLOSURE` in src/lib/missedHandoff.ts.
   */
  runSafetyNetRecordLookup(
    patientId: string,
    input: { justiceInvolvement?: TriState } = {},
  ): LookupResult & { ran: boolean } {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return { ran: false, status: "none", candidateIds: [] };
    const ran = shouldRunSafetyNetLookup({
      recordLookupPending: p.frontDoor?.recordLookupPending,
      justiceInvolvement: input.justiceInvolvement ?? p.coverage?.justiceInvolvement,
      existingPlanFound: Boolean(AdelanteEHR.activePreReleaseEpisode(patientId)),
    });
    if (!ran) return { ran: false, status: "none", candidateIds: [] };
    const subject: LookupSubject = {
      id: p.id,
      dob: p.dob,
      cin: p.cin,
      phone: p.phone,
      lastName: p.lastName,
    };
    const result = matchExistingRecord(
      subject,
      patients.map((c) => ({
        id: c.id,
        dob: c.dob,
        cin: c.cin,
        phone: c.phone,
        lastName: c.lastName,
      })),
    );
    appendAudit({
      category: "clinical",
      action: "front_door_safety_net_lookup",
      patientId,
      actorId: "system",
      detail: {
        status: result.status,
        basis: result.basis,
        candidateCount: result.candidateIds.length,
        disclosedToPatient: true,
      },
    });
    emit();
    return { ran: true, ...result };
  },

  /**
   * No match → genuine missed hand-off. Reuses the CF Care Manager's own
   * pre-release task generation (`openPreReleaseEpisode` over
   * `PRE_RELEASE_FORMS`) rather than duplicating a second task list, but
   * compressed to day one of intake, plus a Medi-Cal reactivation task
   * because reactivation must NOT be assumed automatic for this population.
   */
  generateMissedHandoffCatchUp(input: {
    patientId: string;
    ownerStaffId?: string;
    ownerName: string;
    ownerRole: string;
    trigger: MissedPreReleaseFlag["trigger"];
    facilityId?: string;
  }): MissedPreReleaseFlag | undefined {
    const p = patients.find((x) => x.id === input.patientId);
    if (!p) return undefined;
    if (p.missedPreReleaseCoordination) return p.missedPreReleaseCoordination;
    const today = new Date().toISOString().slice(0, 10);
    const ep = AdelanteEHR.openPreReleaseEpisode({
      patientId: p.id,
      anticipatedReleaseDate: today,
      cfCareManagerStaffId: input.ownerStaffId ?? "",
      cfCareManagerName: input.ownerName,
      facilityId: input.facilityId,
      openedBy: input.ownerName,
      actorRole: input.ownerRole,
      missedHandoff: true,
    });
    AdelanteEHR.createCaseTask({
      patientId: p.id,
      assignedTo: "",
      title: MEDI_CAL_FOLLOW_UP_TASK_TITLE,
      detail:
        "Missed pre-release coordination: verify Medi-Cal status with the county and troubleshoot a suspended or terminated record. Do not tell the member it reactivates automatically.",
      dueDate: today,
      taskType: "missed_handoff_catch_up",
      priority: "urgent",
      allowedRoles: ["cf_care_manager", "ecm_provider", "clinical_coordinator"],
      source: "missed_pre_release_handoff",
      dedupeKey: `missedhandoff:${ep.id}:medi_cal_reactivation`,
    });
    if (p.coverage) p.coverage.mediCalReactivationFollowUp = true;
    const flag: MissedPreReleaseFlag = {
      flaggedAt: new Date().toISOString(),
      trigger: input.trigger,
      ownerStaffId: input.ownerStaffId,
      ownerName: input.ownerName,
      ownerRole: input.ownerRole,
      episodeId: ep.id,
      mediCalFollowUpRequired: true,
    };
    p.missedPreReleaseCoordination = flag;
    appendAudit({
      category: "clinical",
      action: "missed_pre_release_coordination_flagged",
      patientId: p.id,
      actorId: input.ownerStaffId ?? input.ownerName,
      actorRole: input.ownerRole,
      detail: { episodeId: ep.id, trigger: input.trigger },
    });
    emit();
    return flag;
  },

  /**
   * True when the person's referral source is already known to the system, so
   * "how did you hear about us" must not be asked. Two known-source paths
   * exist in the model: a formal `Referral` submission (which materializes the
   * Patient with `referralId` set via advanceReferral), and Track A pre-release
   * (an open `PreReleaseEpisode`).
   */
  hasKnownReferralSource(patientId: string): boolean {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return false;
    if (p.referralId) return true;
    return preReleaseEpisodes.some((e) => e.patientId === patientId && e.status !== "closed");
  },
  addCheckIn(patientId: string, checkIn: Omit<CheckIn, "id">) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    p.checkIns = [{ ...checkIn, id: uid() }, ...(p.checkIns ?? [])];
    _recomputeCarePlan(p.id, "check_in");
    emit();
  },
  /**
   * §5d-1 — the ONE create path for resource referrals, for every caller.
   *
   * Two guarantees live here, in the data layer, so no UI can bypass them:
   *  1. A Part 2 sensitive category (recovery/support groups) is refused
   *     unless the patient's LIVE structured consent authorizes SUD
   *     disclosure. It throws — it never creates silently.
   *  2. `sudDisclosureConsent` is stamped from that same live consent, never
   *     from whatever the caller believed (the old bug: the record tab passed
   *     the VIEWER's access gate).
   */
  addResourceReferral(
    patientId: string,
    r: Omit<ResourceReferral, "id" | "createdAt" | "status" | "sudDisclosureConsent">,
    actor?: { staffName: string; role: StaffRole },
  ) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    const consentActive = AdelanteEHR.isConsentCategoryAuthorized(patientId, "sud_treatment");
    if (isPart2SensitiveCategory(r.category) && !consentActive) {
      throw new Part2ConsentRequiredError(
        "42 CFR Part 2 — a recovery or support-group referral discloses SUD treatment status. Capture the patient's Part 2 consent before referring.",
      );
    }
    const now = new Date().toISOString();
    // §5d-2 — a referral for a staff-only need (interpersonal safety) inherits
    // the staff-only default. Someone living with the person harming them must
    // not find a safety referral on their own phone.
    const linkedNeed = r.sdohItemId
      ? p.sdohPlan?.items.find((i) => i.id === r.sdohItemId)
      : undefined;
    const inheritedVisibility =
      r.visibleToPatient ?? (linkedNeed ? linkedNeed.visibleToPatient !== false : undefined);
    const row: ResourceReferral = {
      ...r,
      // Provenance defaults to the real common case: our care team referred
      // them. Pre-release ingestion passes "pre_release" explicitly.
      source: r.source ?? "internal",
      id: uid(),
      createdAt: now,
      status: "pending",
      sudDisclosureConsent: consentActive,
      ...(inheritedVisibility === undefined ? {} : { visibleToPatient: inheritedVisibility }),
      ...(actor ? { createdBy: actor.staffName, createdByRole: actor.role } : {}),
    };
    p.resourceReferrals = [row, ...(p.resourceReferrals ?? [])];
    appendAudit({
      category: "clinical",
      action: "resource_referral_created",
      patientId,
      actorId: actor?.staffName ?? "unattributed",
      ...(actor ? { actorRole: actor.role } : {}),
      detail: {
        referralId: row.id,
        category: row.category,
        ...(row.sdohItemId ? { sdohItemId: row.sdohItemId } : {}),
        ...(row.resourceId ? { resourceId: row.resourceId } : { offDirectory: true }),
        part2Sensitive: isPart2SensitiveCategory(row.category),
        sudDisclosureConsent: consentActive,
      },
    });
    // §5d-2 — making a referral IS the need moving forward. Only the first
    // move is automatic: a need already past `identified` keeps its status.
    if (linkedNeed && linkedNeed.status === "identified") {
      AdelanteEHR.setSdohStatus(patientId, linkedNeed.id, "sent", undefined, actor);
    }

    emit();
    return row;
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
  /**
   * §Part B1 — record the "What are you looking for?" answer. Mental health /
   * medication go on `seeking` and raise SUGGESTED goals only. Substance use
   * merges into `needs.substanceUse` (Part 2 masked) and is dropped unless
   * Part 2 SUD consent is authorized — nothing about substance use is kept
   * without consent. Screener offerings are not touched.
   */
  recordSeeking(
    patientId: string,
    answer: { mentalHealth: boolean; medication: boolean; substanceUse: boolean },
    actor: { id: string; role: string },
  ) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    const now = new Date().toISOString();
    p.seeking = { mentalHealth: answer.mentalHealth, medication: answer.medication, answeredAt: now };
    const sudAllowed = AdelanteEHR.isConsentCategoryAuthorized(patientId, "sud_treatment");
    const sudKept = answer.substanceUse && sudAllowed;
    if (sudKept) p.needs = { ...p.needs, substanceUse: true };
    const want: SuggestedGoal["reason"][] = [
      ...(answer.medication ? (["seeking_medication"] as const) : []),
      ...(answer.mentalHealth ? (["seeking_mental_health"] as const) : []),
    ];
    const existing = p.suggestedGoals ?? [];
    const added: SuggestedGoal[] = want
      .filter((r) => !existing.some((g) => g.reason === r))
      .map((r) => ({ id: uid(), text: SUGGESTED_GOAL_TEXT[r], reason: r, status: "suggested", createdAt: now }));
    p.suggestedGoals = [...existing, ...added];
    appendAudit({
      category: "care_plan",
      action: "seeking_recorded",
      patientId,
      actorId: actor.id,
      actorRole: actor.role,
      // No SUD detail in the audit body — only whether it was kept.
      detail: {
        mentalHealth: answer.mentalHealth,
        medication: answer.medication,
        sudSelectionKept: sudKept,
        suggestedGoalsAdded: added.length,
      },
    });
    emit();
  },
  /** §Part B1 — clinician accepts a suggested goal → a real Goal, audited. */
  acceptSuggestedGoal(patientId: string, suggestionId: string, by: { name: string; role: string }) {
    const p = patients.find((x) => x.id === patientId);
    const g = p?.suggestedGoals?.find((x) => x.id === suggestionId);
    if (!p || !g || g.status !== "suggested") return;
    AdelanteEHR.addGoal(patientId, g.text, by.name);
    const created = p.goals?.[p.goals.length - 1];
    Object.assign(g, {
      status: "accepted",
      decidedAt: new Date().toISOString(),
      decidedBy: by.name,
      decidedByRole: by.role,
      goalId: created?.id,
    });
    appendAudit({
      category: "care_plan",
      action: "suggested_goal_accepted",
      patientId,
      actorId: by.name,
      actorRole: by.role,
      detail: { suggestionId, reason: g.reason, goalId: created?.id },
    });
    emit();
  },
  dismissSuggestedGoal(patientId: string, suggestionId: string, by: { name: string; role: string }) {
    const p = patients.find((x) => x.id === patientId);
    const g = p?.suggestedGoals?.find((x) => x.id === suggestionId);
    if (!p || !g || g.status !== "suggested") return;
    Object.assign(g, { status: "dismissed", decidedAt: new Date().toISOString(), decidedBy: by.name, decidedByRole: by.role });
    appendAudit({
      category: "care_plan",
      action: "suggested_goal_dismissed",
      patientId,
      actorId: by.name,
      actorRole: by.role,
      detail: { suggestionId, reason: g.reason },
    });
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
      /** §Phase 7b.1 — staff/clinician id of the signer, for claim traceability. */
      signedById?: string;
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
      crisisDecision?: { kind: "escalate" } | { kind: "not_escalating"; reason: string };
      /**
       * §EHR audit Phase 1d — the persisted attestation record from the shared
       * primitive. Optional here on purpose: the engine's job is to store what
       * the capture surface produced, and every interactive signing surface
       * now produces one. Requiring it in the store would break non-interactive
       * paths (seeds, automations, tests) that have no capture surface at all,
       * which would be a fake requirement rather than a real one.
       */
      attestation?: AttestationRecord;
    },
  ): ProgressNote {
    const { n } = AdelanteEHR._findNote(patientId, noteId);
    if (!n) throw new Error("Note not found.");
    const status = noteStatus(n);
    if (status !== "draft" && status !== "declined")
      throw new Error("Only a draft note can be signed.");
    if (!input.attested) throw new Error("Attestation is required to sign a note.");
    if (input.attestation && !input.attestation.signatureDataUrl)
      throw new Error("The attestation record is missing its signature.");

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
    n.signedById = input.signedById ?? input.signedBy;
    n.signedRole = input.role;
    n.signedAt = new Date().toISOString();
    if (input.attestation) n.attestation = input.attestation;
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
        // Governance: which wording was attested to, and how identity was
        // (not) established. A later statement edit cannot rewrite this row.
        attestationStatementId: input.attestation?.statementId ?? null,
        attestationStatementVersion: input.attestation?.statementVersion ?? null,
        attestationMethod: input.attestation?.method ?? null,
        signatureCaptured: Boolean(input.attestation?.signatureDataUrl),
      },
    });

    // §Notification feed — cosign routing. No named-cosigner field exists on
    // ProgressNote, so a note routes to its eligible cosign role pool.
    if (cosignRequired) {
      const roles = (
        n.cosignRole?.length ? n.cosignRole : (NOTE_SELF_SIGN_ROLES as readonly string[])
      ) as StaffRole[];
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
    if (n.status === "signed") {
      AdelanteEHR.runNoteAutomations(patientId, noteId, {
        actorId: input.signedBy,
        actorRole: input.role,
      });
      // §Phase 7b.1 — a FINAL signature advances the linked claim (refused
      // inside the claim path when there is no valid attestation).
      _claimBridge?.onNoteFinal(patientId, noteId);
    }
    emit();
    return n;
  },

  /**
   * §Phase 7b.1 — cosign uses the same Phase 1d ceremony as signing: the
   * `progress_note_supervisor_sign` statement at its current version plus a
   * drawn mark (anti-tap checked). Refused otherwise, nothing changes. On
   * success the note is FINAL, so its linked claim advances documented →
   * signed, credited to the cosigner (via the claim bridge).
   */
  cosignProgressNote(
    patientId: string,
    noteId: string,
    input: {
      cosignedBy: string;
      cosignedById?: string;
      role: string;
      attestation?: AttestationRecord;
      comment?: string;
    },
  ): ProgressNote {
    const { n } = AdelanteEHR._findNote(patientId, noteId);
    if (!n) throw new Error("Note not found.");
    if (noteStatus(n) !== "cosign_pending") throw new Error("This note is not awaiting cosign.");
    if (!(NOTE_SELF_SIGN_ROLES as readonly string[]).includes(input.role))
      throw new Error("Your role cannot cosign clinical notes.");
    if (n.cosignRole?.length && !n.cosignRole.includes(input.role))
      throw new Error("This note requires a different cosigning role.");
    if (n.signedBy === input.cosignedBy || (input.cosignedById && n.signedById === input.cosignedById))
      throw new Error("A note cannot be cosigned by its signer.");
    const problem = attestationRecordProblem(input.attestation, "progress_note_supervisor_sign");
    if (problem) throw new Error(problem);

    n.cosignedBy = input.cosignedBy;
    n.cosignedById = input.cosignedById ?? input.cosignedBy;
    n.cosignedRole = input.role;
    n.cosignedAt = new Date().toISOString();
    n.cosignAttestation = input.attestation;
    n.cosignComment = input.comment?.trim() || undefined;
    n.status = "cosigned";
    appendAudit({
      category: "clinical",
      action: "note_cosigned",
      patientId,
      actorId: n.cosignedById,
      actorRole: input.role,
      detail: {
        noteId,
        comment: n.cosignComment ?? null,
        signedBy: n.signedBy ?? null,
        attestationStatementId: input.attestation!.statementId,
        attestationStatementVersion: input.attestation!.statementVersion,
        attestationMethod: input.attestation!.method,
        signatureCaptured: true,
      },
    });
    AdelanteEHR.runNoteAutomations(patientId, noteId, {
      actorId: input.cosignedBy,
      actorRole: input.role,
    });
    _claimBridge?.onNoteFinal(patientId, noteId);
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
    return noteAutomationRuns.filter((r) => !noteId || r.noteId === noteId).map((r) => ({ ...r }));
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
    const planned = AdelanteEHR.plannedNoteAutomations(
      patientId,
      n.templateSchema,
      n.templateAnswers,
    );
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
      // §Phase 3a fix #1 — ECM *eligibility* must never stand in for ECM
      // information-sharing *consent*. Absent an explicit consent record the
      // honest answer is "not granted"; `ecmConsentCapturePending` raises the
      // prompt to go and ask.
      ecmShare: false,

      sms: p.smsFallback,
    };
    // §ASCMI — Part 2 is now DERIVED from the structured record, evaluated
    // live on every read. The legacy boolean is only a fallback for patients
    // who have no ConsentRecord captured yet.
    return {
      ...base,
      part2Sud: AdelanteEHR.isConsentCategoryAuthorized(patientId, "sud_treatment"),
    };
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
      // §Phase 3a fix #1 — see `getConsentState`: eligibility is not consent.
      ecmShare: false,

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
  /**
   * §Phase 3a — append one attributed flag change. Every eligibility flag goes
   * through here, so "who turned this on and when" is never missing.
   */
  _logEligibilityFlag(p: Patient, key: EligibilityFlagKey, value: boolean, actor: CoverageActor) {
    p.eligibilityFlagLog = [
      {
        id: uid(),
        key,
        value,
        at: new Date().toISOString(),
        actorId: actor.actorId,
        actorRole: actor.actorRole,
      },
      ...(p.eligibilityFlagLog ?? []),
    ];
    appendAudit({
      category: "clinical",
      action: "eligibility_flag_changed",
      patientId: p.id,
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      detail: { key, value },
    });
  },
  /**
   * True when ECM eligibility is marked but ECM information-sharing consent
   * has never been captured either way. §Phase 3a: eligibility MUST NOT stand
   * in for consent — this drives an explicit prompt instead of a silent
   * default (see `getConsentState`).
   */
  ecmConsentCapturePending(patientId: string): boolean {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return false;
    return Boolean(p.coverage?.ecmEligible) && p.consentState?.ecmShare === undefined;
  },
  setEcmEligible(patientId: string, eligible: boolean, actor: CoverageActor) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    p.coverage = {
      ...(p.coverage ?? { status: "none_unsure", verified: "not_found" }),
      ecmEligible: eligible,
    };
    AdelanteEHR._logEligibilityFlag(p, "ecm", eligible, actor);
    // §Phase 3a fix #1 — marking someone ECM-eligible used to silently default
    // their ECM information-sharing consent to granted. It no longer does.
    // Instead, marking eligibility raises real work: go and ask them.
    if (eligible && p.consentState?.ecmShare === undefined && p.caseManagerId) {
      AdelanteEHR.createCaseTask({
        patientId,
        assignedTo: p.caseManagerId,
        title: "Capture ECM information-sharing consent",
        detail:
          "Marked ECM-eligible. Eligibility is not consent — ask the client and record their answer on the Consent tab.",
        dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
        origin: "manual",
        taskType: "ecm_consent_capture",
        priority: "routine",
        dedupeKey: `ecmconsent:${patientId}`,
      });
    }
    emit();
  },
  setCommunitySupport(
    patientId: string,
    key: "housing" | "food" | "transport",
    on: boolean,
    actor: CoverageActor,
  ) {
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
    AdelanteEHR._logEligibilityFlag(p, `cs_${key}` as EligibilityFlagKey, on, actor);
    emit();
  },
  setJiReentry(patientId: string, on: boolean, actor: CoverageActor) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    const base = p.coverage ?? {
      status: "none_unsure" as CoverageStatus,
      verified: "not_found" as const,
    };
    p.coverage = { ...base, jiReentryFlag: on };
    AdelanteEHR._logEligibilityFlag(p, "jiReentry", on, actor);
    emit();
  },
  /**
   * §Phase 3a fix #2 + #3 — record a HUMAN eligibility check.
   *
   * This is not an automated verification: nothing in this app queries DHCS
   * (no 270/271, no clearinghouse). A staff member checked through a real
   * channel and is recording that they did, with attribution.
   *
   * Recording the check NEVER changes `coverage.status` on its own. The
   * checker may additionally confirm a status, and that is stored as an
   * explicit, separate field on the same record.
   */
  recordCoverageCheck(
    patientId: string,
    input: {
      channel: CoverageCheckChannel;
      channelNote?: string;
      result: CoverageCheckResult;
      /** CIN as read during the check. Written to `Patient.cin` when absent. */
      cin?: string;
      /** Only set when the checker actually confirmed a coverage status. */
      statusConfirmed?: CoverageStatus;
    } & CoverageActor,
  ): { ok: boolean; error?: string } {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return { ok: false, error: "Patient not found." };
    // §Phase 8b — "reported" is reserved for recordIntakeBenefits; a staff
    // check must name how staff actually checked.
    if (input.channel === "reported" || input.channel === "electronic_270_271") {
      return { ok: false, error: "Choose how you checked — reports and electronic results have their own path." };
    }
    const cin = input.cin?.trim().toUpperCase();
    if (cin && cin.length !== 9) {
      return { ok: false, error: "A CIN is 9 characters. Check the number and try again." };
    }
    // §Phase 3a — Patient.cin is the ONE canonical CIN. Never copied onto the
    // coverage object; filled here only when the record had none.
    let cinRecordedNow = false;
    if (cin && !p.cin) {
      p.cin = cin;
      cinRecordedNow = true;
    }
    const record: CoverageVerificationRecord = {
      id: uid(),
      checkedAt: new Date().toISOString(),
      checkedBy: input.actorId,
      checkedByRole: input.actorRole,
      channel: input.channel,
      channelNote: input.channelNote?.trim() || undefined,
      result: input.result,
      cinOnFile: Boolean(p.cin),
      ...(cinRecordedNow ? { cinRecordedNow: true } : {}),
      ...(input.statusConfirmed ? { statusConfirmed: input.statusConfirmed } : {}),
    };
    const base = p.coverage ?? {
      status: "none_unsure" as CoverageStatus,
      verified: "not_found" as const,
    };
    p.coverage = {
      ...base,
      verified: record.result,
      // Status changes ONLY when the checker explicitly confirmed one.
      ...(input.statusConfirmed ? { status: input.statusConfirmed } : {}),
      verifications: [record, ...(base.verifications ?? [])],
    };
    appendAudit({
      category: "clinical",
      action: "coverage_check_recorded",
      patientId,
      actorId: input.actorId,
      actorRole: input.actorRole,
      detail: {
        channel: record.channel,
        result: record.result,
        cinOnFile: record.cinOnFile,
        cinRecordedNow,
        statusConfirmed: record.statusConfirmed ?? null,
      },
    });
    emit();
    return { ok: true };
  },
  /**
   * §Phase 8c — THE one write path for an electronic eligibility response.
   * Append-only and attributed (the person who asked + the system/vendor).
   *  - adds a verification record on channel electronic_270_271;
   *  - active: adds a plan span, or updates the open span with the same payer
   *    (aid code, share of cost); a payer change closes the old open
   *    electronic/staff span the day before the new start. Reported spans are
   *    kept alongside. Nothing is deleted or backdated.
   *  - not_found / inactive / error: never clears a CIN or closes a span; one
   *    follow-up task for staff (deduped per patient).
   *  - the managed care plan is matched to the 8b list by name; unmatched
   *    names are kept and flagged, the list is never auto-edited.
   */
  applyEligibilityResponse(
    patientId: string,
    response: ElectronicEligibilityDetail,
    input: { actorId: string; actorName: string; actorRole: StaffRole; planList?: { id: string; name: string }[] },
  ): { ok: boolean; error?: string; recordId?: string; spanId?: string; spanAction?: "added" | "updated" | "none"; taskId?: string } {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return { ok: false, error: "Patient not found." };
    if (!response.transactionId) return { ok: false, error: "An electronic response needs a transaction id." };
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const norm = (x: string) => x.trim().toLowerCase().replace(/\s+/g, " ");
    const b = response.benefits;
    let detail = response;
    if (b?.managedCarePlan) {
      const hit = (input.planList ?? []).find((pl) => norm(pl.name) === norm(b.managedCarePlan!.payerName));
      detail = {
        ...response,
        benefits: {
          ...b,
          managedCarePlan: { ...b.managedCarePlan, ...(hit ? { matchedListId: hit.id, matchedListName: hit.name } : {}) },
        },
      };
    }
    const status = response.responseStatus;
    const record: CoverageVerificationRecord = {
      id: uid(),
      checkedAt: now,
      checkedBy: input.actorName,
      checkedByRole: input.actorRole,
      channel: "electronic_270_271",
      channelNote: `${response.vendor} · ${response.transactionId}`,
      result: status === "active" ? "verified" : status === "not_found" ? "not_found" : "pending",
      cinOnFile: Boolean(p.cin),
      electronic: detail,
    };
    const base = p.coverage ?? {
      status: "none_unsure" as CoverageStatus,
      verified: "not_found" as const,
    };
    let plans = [...(base.plans ?? [])];
    let spanId: string | undefined;
    let spanAction: "added" | "updated" | "none" = "none";
    const mcp = detail.benefits?.managedCarePlan;
    if (status === "active") {
      const payer = mcp?.matchedListName ?? mcp?.payerName ?? "Medi-Cal FFS";
      const open = plans.find((sp) => !sp.to && norm(sp.payer) === norm(payer));
      const fields = {
        ...(b?.aidCode ? { aidCode: b.aidCode } : {}),
        ...(typeof b?.shareOfCostCents === "number" ? { shareOfCostCents: b.shareOfCostCents } : {}),
        ...(mcp?.matchedListId ? { managedCarePlanId: mcp.matchedListId, managedCarePlanName: mcp.matchedListName } : {}),
        ...(mcp && !mcp.matchedListId ? { planNotOnList: true } : {}),
      };
      if (open && open.source !== "patient_reported" && open.source !== "staff_recorded_patient_report" && open.source !== "referrer_reported" && open.source !== "partner_reported") {
        plans = plans.map((sp) => (sp.id === open.id ? { ...sp, ...fields, ...(b?.coverageEnd ? { to: b.coverageEnd } : {}) } : sp));
        spanId = open.id;
        spanAction = "updated";
      } else {
        const from = b?.coverageStart ?? today;
        const dayBefore = new Date(new Date(from + "T00:00:00Z").getTime() - 86400000).toISOString().slice(0, 10);
        plans = plans.map((sp) =>
          !sp.to && (sp.source === "electronic_270_271" || sp.source === "staff_checked") && norm(sp.payer) !== norm(payer) && sp.from <= dayBefore
            ? { ...sp, to: dayBefore }
            : sp,
        );
        const span: CoveragePlanSpan = {
          id: uid(),
          payer,
          from,
          ...(b?.coverageEnd ? { to: b.coverageEnd } : {}),
          source: "electronic_270_271",
          recordedBy: input.actorName,
          recordedByRole: input.actorRole,
          recordedAt: now,
          ...(b?.payerId ? { plan: b.payerId } : {}),
          ...fields,
        };
        plans = [...plans, span];
        spanId = span.id;
        spanAction = "added";
      }
    }
    p.coverage = {
      ...base,
      verified: status === "active" ? "verified" : base.verified,
      plans,
      verifications: [record, ...(base.verifications ?? [])],
    };
    let taskId: string | undefined;
    if (status !== "active") {
      const t = AdelanteEHR.createCaseTask({
        patientId,
        assignedTo: "",
        title: "Follow up on electronic eligibility result",
        detail:
          status === "error"
            ? `Electronic check failed (${response.errorReason ?? "no reason given"}). Check by phone or portal.`
            : `Electronic check returned "${status}". Nothing was changed — confirm with the county or plan.`,
        dueDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
        origin: "manual",
        source: "electronic_eligibility",
        taskType: "coverage_follow_up",
        allowedRoles: STAFF_ROLES.map((r) => r.key).filter((r) => canAccess(r, "eligibility").level === "write"),
        dedupeKey: `eligibility-electronic:${patientId}`,
      } as Parameters<typeof AdelanteEHR.createCaseTask>[0]);
      taskId = (t as { id?: string } | undefined)?.id;
    }
    appendAudit({
      category: "clinical",
      action: "electronic_eligibility_applied",
      patientId,
      actorId: input.actorId,
      actorRole: input.actorRole,
      detail: {
        vendor: response.vendor,
        transactionId: response.transactionId,
        rawResponseRef: response.rawResponseRef ?? null,
        responseStatus: status,
        errorReason: response.errorReason ?? null,
        aidCode: b?.aidCode ?? null,
        shareOfCostCents: b?.shareOfCostCents ?? null,
        planMatched: mcp ? Boolean(detail.benefits?.managedCarePlan?.matchedListId) : null,
        spanAction,
        followUpTaskId: taskId ?? null,
        actorName: input.actorName,
      },
    });
    emit();
    return { ok: true, recordId: record.id, spanId, spanAction, taskId };
  },
  /**
   * §Phase 8b — the duplicate-CIN warning, shared by every benefits entry
   * point (lifted from the referral form). Warns; never blocks.
   */
  findCinDuplicate(cin: string, exclude?: { patientId?: string; referralId?: string }): string | undefined {
    const c = normalizeCinValue(cin);
    if (!c) return undefined;
    const mask = `•••••${c.slice(-4)}`;
    const p = patients.find((x) => x.id !== exclude?.patientId && x.cin && normalizeCinValue(x.cin) === c);
    if (p) return `Heads up: this CIN ${mask} is already on another record (${p.programId}).`;
    const r = referrals.find(
      (x) => x.id !== exclude?.referralId && x.status !== "enrolled" && x.cin && normalizeCinValue(x.cin) === c,
    );
    if (r) return `Heads up: a referral already exists for CIN ${mask} — ${r.firstName} ${r.lastName}.`;
    return undefined;
  },
  /**
   * §Phase 8b — THE one write path for reported benefits (intake, staff-
   * assisted intake, the chart, referral conversion, pre-release import).
   *  - merges through the 8a coverage merge; never "verified";
   *  - CIN only into Patient.cin, only when empty (a different CIN on file is
   *    left alone and flagged);
   *  - Medi-Cal/dual: one plan span + one reported verification record,
   *    tagged with WHO reported it; re-runs don't duplicate;
   *  - non-Medi-Cal: one "Set payment arrangement" task for billing, deduped
   *    per patient; never sets the arrangement itself.
   */
  /**
   * §Adel-guided intake (prototype) — save the "About you" answers the patient
   * confirmed one by one in the Adel script. Same `updateProfile` write the
   * form uses; the only addition is the audit row saying it came via Adel.
   */
  saveIntakeProfileViaAdel(
    patientId: string,
    patch: IntakeProfilePatch,
    fieldsConfirmed: string[],
  ): void {
    AdelanteEHR.updateProfile(patientId, patch);
    appendAudit({
      category: "clinical",
      action: "intake_profile_saved",
      patientId,
      actorId: patientId,
      actorRole: "patient",
      detail: { via: "adel_guided_intake", fieldsConfirmed },
    });
  },

  recordIntakeBenefits(
    patientId: string,
    answers: IntakeBenefitsAnswers,
    input: {
      source: ReportedBenefitsSource;
      /** Which screen, for the audit row. */
      via: "self_service_intake" | "staff_assisted_intake" | "chart" | "referral_conversion" | "pre_release_import" | "adel_guided_intake";
      actorId: string;
      actorName: string;
      actorRole: string;
    },
  ): IntakeBenefitsResult {
    const res: IntakeBenefitsResult = {
      ok: true,
      cinWritten: false,
      cinMismatch: false,
      planSpanAdded: false,
      verificationAdded: false,
    };
    const p = patients.find((x) => x.id === patientId);
    if (!p) return { ...res, ok: false, error: "Patient not found." };
    const cin = answers.cin ? normalizeCinValue(answers.cin) : "";
    if (cin && !CIN_RE.test(cin)) {
      return { ...res, ok: false, error: "A CIN is 9 letters or digits. Check the number and try again." };
    }
    const type = answers.coverageType;
    const mediCal = type === "medi_cal" || type === "dual";
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

    if (cin) {
      // The patient's own originating referral is not a duplicate.
      res.cinDuplicate = AdelanteEHR.findCinDuplicate(cin, { patientId, referralId: p.referralId });
      if (!p.cin) {
        p.cin = cin;
        res.cinWritten = true;
      } else if (normalizeCinValue(p.cin) !== cin) {
        res.cinMismatch = true;
      }
    }

    if (type) {
      const existing = p.coverage;
      const hasStaffCheck = (existing?.verifications ?? []).some(isStaffCheck);
      const { next } = mergeCoverage(existing, {
        coverageType: type,
        status: mediCal
          ? (answers.mediCalStatus ?? existing?.status ?? "none_unsure")
          : existing
            ? undefined
            : type === "unknown"
              ? "none_unsure"
              : "not_applicable",
        verified: hasStaffCheck ? undefined : "self_reported",
        nonMediCalReport: mediCal ? undefined : answers.nonMediCalReport,
        otherPlanName: !mediCal && answers.planName?.trim() ? answers.planName.trim() : undefined,
      });
      p.coverage = next;

      // Plan span.
      let payer: string | undefined;
      let planRef: IntakeBenefitsAnswers["managedCarePlan"];
      if (mediCal) {
        planRef = answers.managedCarePlan;
        payer =
          planRef?.kind === "plan"
            ? planRef.name
            : planRef?.kind === "ffs"
              ? "Medi-Cal FFS"
              : planRef?.kind === "other" && planRef.otherName?.trim()
                ? planRef.otherName.trim()
                : "Medi-Cal (plan not known)";
      } else if (type === "medicare") {
        payer = "Medicare";
      } else if (answers.planName?.trim() && (answers.nonMediCalReport === "private_insurance" || answers.nonMediCalReport === "other")) {
        payer = answers.planName.trim();
      }
      if (payer) {
        const dupe = (p.coverage.plans ?? []).some(
          (c) => !c.to && c.payer.trim().toLowerCase() === payer!.toLowerCase(),
        );
        if (!dupe) {
          const span: CoveragePlanSpan = {
            id: uid(),
            payer,
            from: today,
            source: input.source,
            recordedBy: input.actorName,
            recordedByRole: input.actorRole as StaffRole,
            recordedAt: now,
            ...(planRef && planRef.kind !== "unknown" ? { managedCarePlanId: planRef.id, managedCarePlanName: planRef.kind === "other" && planRef.otherName ? planRef.otherName : planRef.name } : {}),
          };
          p.coverage = { ...p.coverage, plans: [span, ...(p.coverage.plans ?? [])] };
          res.planSpanAdded = true;
        }
      }

      // Reported verification record (Medi-Cal only — it feeds the worklist).
      if (mediCal) {
        const checks = p.coverage.verifications ?? [];
        const awaiting = checks.findIndex((v) => v.reportSource === input.source);
        const firstStaff = checks.findIndex(isStaffCheck);
        const stillAwaiting = awaiting >= 0 && (firstStaff < 0 || awaiting < firstStaff);
        if (!stillAwaiting) {
          const record: CoverageVerificationRecord = {
            id: uid(),
            checkedAt: now,
            checkedBy: input.actorName,
            checkedByRole: input.actorRole as StaffRole,
            channel: "reported",
            result: "pending",
            cinOnFile: Boolean(p.cin),
            ...(res.cinWritten ? { cinRecordedNow: true } : {}),
            reportSource: input.source,
          };
          p.coverage = { ...p.coverage, verifications: [record, ...checks] };
          res.verificationAdded = true;
        }
      } else if (!p.paymentArrangement) {
        const due = new Date();
        due.setDate(due.getDate() + 3);
        const t = AdelanteEHR.createCaseTask({
          patientId,
          assignedTo: "",
          title: "Set payment arrangement",
          detail: `Reported at intake: ${answers.nonMediCalReport ?? type}. Choose self-pay, sliding fee or grant/ISL on the chart's payment arrangement card. Intake does not set it.`,
          dueDate: due.toISOString().slice(0, 10),
          origin: "manual",
          source: "intake_benefits",
          taskType: "payment_arrangement",
          allowedRoles: STAFF_ROLES.map((r) => r.key).filter((r) => canAccess(r, "billing").level === "write"),
          dedupeKey: `payment-arrangement:${patientId}`,
        });
        res.taskId = t?.id;
      }
    }

    appendAudit({
      category: "clinical",
      action: "intake_benefits_recorded",
      patientId,
      actorId: input.actorId,
      actorRole: input.actorRole,
      detail: {
        source: input.source,
        via: input.via,
        actorName: input.actorName,
        coverageType: type ?? null,
        nonMediCalReport: answers.nonMediCalReport ?? null,
        managedCarePlanId: answers.managedCarePlan?.id ?? null,
        cinProvided: Boolean(cin),
        cinWritten: res.cinWritten,
        cinMismatch: res.cinMismatch,
        cinDuplicateWarned: Boolean(res.cinDuplicate),
        planSpanAdded: res.planSpanAdded,
        verificationAdded: res.verificationAdded,
        paymentArrangementTaskId: res.taskId ?? null,
      },
    });
    emit();
    return res;
  },
  listCoverageChecks(patientId: string): CoverageVerificationRecord[] {
    return patients.find((x) => x.id === patientId)?.coverage?.verifications ?? [];
  },

  // ----- §Phase 3b — coverage plan spans (one coverage model) --------------
  /** Newest-first payer spans on the patient's coverage record. */
  listCoveragePlans(patientId: string): CoveragePlanSpan[] {
    return patients.find((x) => x.id === patientId)?.coverage?.plans ?? [];
  },
  /** The span covering `at`, if any. Used by scheduling's payer-enrollment check. */
  activeCoveragePlan(patientId: string, at = new Date().toISOString()): CoveragePlanSpan | undefined {
    const when = +new Date(at);
    return AdelanteEHR.listCoveragePlans(patientId).find(
      (c) => +new Date(c.from) <= when && (!c.to || +new Date(c.to) >= when),
    );
  },
  /**
   * Record a plan on file. Attributed, like every other Phase 3a/3b coverage
   * mutation. Adding a plan does NOT change `coverage.status` — knowing which
   * plan someone named is not the same claim as "this coverage is active".
   */
  addCoveragePlan(
    patientId: string,
    input: {
      payer: string;
      plan?: string;
      memberId?: string;
      from: string;
      to?: string;
      source: CoveragePlanSource;
    } & CoverageActor,
  ): { ok: boolean; error?: string } {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return { ok: false, error: "Patient not found." };
    const payer = input.payer.trim();
    if (!payer) return { ok: false, error: "Name the plan or payer." };
    if (!input.from) return { ok: false, error: "A start date is required." };
    if (input.to && input.to < input.from) {
      return { ok: false, error: "The end date is before the start date." };
    }
    const span: CoveragePlanSpan = {
      id: uid(),
      payer,
      ...(input.plan?.trim() ? { plan: input.plan.trim() } : {}),
      ...(input.memberId?.trim() ? { memberId: input.memberId.trim() } : {}),
      from: input.from,
      ...(input.to ? { to: input.to } : {}),
      source: input.source,
      recordedBy: input.actorId,
      recordedByRole: input.actorRole,
      recordedAt: new Date().toISOString(),
    };
    const base = p.coverage ?? {
      status: "none_unsure" as CoverageStatus,
      verified: "not_found" as const,
    };
    p.coverage = { ...base, plans: [span, ...(base.plans ?? [])] };
    appendAudit({
      category: "clinical",
      action: "coverage_plan_added",
      patientId,
      actorId: input.actorId,
      actorRole: input.actorRole,
      detail: { payer: span.payer, from: span.from, to: span.to ?? null, source: span.source },
    });
    emit();
    return { ok: true };
  },
  /** Close an open span. Attributed; never deletes history. */
  endCoveragePlan(
    patientId: string,
    planId: string,
    endDate: string,
    actor: CoverageActor,
  ): { ok: boolean; error?: string } {
    const p = patients.find((x) => x.id === patientId);
    const span = p?.coverage?.plans?.find((c) => c.id === planId);
    if (!p || !span) return { ok: false, error: "That plan is not on this record." };
    if (!endDate) return { ok: false, error: "An end date is required." };
    if (endDate < span.from) return { ok: false, error: "The end date is before the start date." };
    span.to = endDate;
    appendAudit({
      category: "clinical",
      action: "coverage_plan_ended",
      patientId,
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      detail: { payer: span.payer, to: endDate },
    });
    emit();
    return { ok: true };
  },

  /**
   * §Phase 3a fix #4 — reactivation follow-up.
   *
   * Nothing here reaches a county. The real work is a staff follow-up, so
   * this creates a REAL worklist row for the assigned case manager; the
   * client-facing to-do is now honestly worded as "we are working on it"
   * rather than claiming a request was filed with the county.
   */
  requestReactivation(patientId: string, actor: CoverageActor) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return { staffTaskCreated: false };
    p.tasks = [
      {
        id: uid(),
        kind: "reactivation",
        label: "Your case manager is following up on your Medi-Cal with the county",
        createdAt: new Date().toISOString(),
      },
      ...(p.tasks ?? []),
    ];
    let staffTaskCreated = false;
    if (p.caseManagerId) {
      AdelanteEHR.createCaseTask({
        patientId,
        assignedTo: p.caseManagerId,
        title: "Medi-Cal reactivation — follow up with county",
        detail: `Started by ${actor.actorId}. Call the county eligibility line and record the outcome as a coverage check.`,
        dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
        origin: "manual",
        taskType: "medi_cal_reactivation",
        priority: "urgent",
        dedupeKey: `medicalreact:${patientId}`,
      });
      staffTaskCreated = true;
    }
    if (p.coverage) p.coverage = { ...p.coverage, verified: "pending" };
    appendAudit({
      category: "clinical",
      action: "medi_cal_reactivation_started",
      patientId,
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      detail: { staffTaskCreated },
    });
    emit();
    return { staffTaskCreated };
  },
  addEnrollmentAssistTask(patientId: string, actor: CoverageActor) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return { staffTaskCreated: false };
    p.tasks = [
      {
        id: uid(),
        kind: "enrollment_assist",
        label: "Case manager will help with BenefitsCal enrollment",
        createdAt: new Date().toISOString(),
      },
      ...(p.tasks ?? []),
    ];
    let staffTaskCreated = false;
    if (p.caseManagerId) {
      AdelanteEHR.createCaseTask({
        patientId,
        assignedTo: p.caseManagerId,
        title: "BenefitsCal enrollment assistance",
        detail: `Started by ${actor.actorId}. Sit with the client and complete a BenefitsCal application.`,
        dueDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
        origin: "manual",
        taskType: "benefitscal_enrollment",
        priority: "routine",
        dedupeKey: `benefitscal:${patientId}`,
      });
      staffTaskCreated = true;
    }
    appendAudit({
      category: "clinical",
      action: "enrollment_assist_started",
      patientId,
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      detail: { staffTaskCreated },
    });
    emit();
    return { staffTaskCreated };
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
  /**
   * §Phase 9b — what a PATIENT is due to re-take. Union of the existing draft
   * cadence (`rescreensDue`) and any open "rescreen" task, limited to real
   * full instruments, with SUD instruments (AUDIT, DAST-10) only when the
   * live `sud_treatment` consent allows — the same rule intake applies.
   */
  patientReassessmentDue(patientId: string): { key: string; taskIds: string[]; nextDue?: 30 | 60 | 90 }[] {
    const p = patients.find((x) => x.id === patientId);
    if (!p || !p.intakeCompletedAt) return [];
    const sudOk = AdelanteEHR.isConsentCategoryAuthorized(patientId, "sud_treatment");
    const allowed = (key: string) => {
      const def = SCREENERS.find((d) => d.key === key);
      return !!def && (!def.isSud || sudOk);
    };
    const out = new Map<string, { key: string; taskIds: string[]; nextDue?: 30 | 60 | 90 }>();
    for (const d of AdelanteEHR.rescreensDue(patientId)) {
      if (allowed(d.key)) out.set(d.key, { key: d.key, taskIds: [], nextDue: d.nextDue });
    }
    for (const t of p.tasks ?? []) {
      if (t.kind !== "rescreen" || t.completedAt || !t.screenerKey || !allowed(t.screenerKey)) continue;
      const row = out.get(t.screenerKey) ?? { key: t.screenerKey, taskIds: [] };
      row.taskIds.push(t.id);
      out.set(t.screenerKey, row);
    }
    return [...out.values()];
  },
  /**
   * §Phase 9b — the targeted re-screen. Scores through the same
   * `scoreScreener` + `recordScreener` path intake/pre-release use, closes
   * every open re-screen task for this instrument, and audits it.
   */
  completeRescreen(
    patientId: string,
    key: string,
    answers: number[],
    actor: { actorId: string; actorRole: string },
  ): ScreenerResult {
    const p = patients.find((x) => x.id === patientId);
    if (!p) throw new Error("Patient not found.");
    const def = SCREENERS.find((d) => d.key === key);
    if (!def) throw new Error("Unknown questionnaire.");
    if (def.isSud && !AdelanteEHR.isConsentCategoryAuthorized(patientId, "sud_treatment"))
      throw new Error("This questionnaire needs substance-use consent on file.");
    if (answers.length !== def.questions.length || answers.some((a) => typeof a !== "number"))
      throw new Error(`Please answer all ${def.questions.length} questions.`);
    const due = AdelanteEHR.rescreensDue(patientId).find((d) => d.key === key);
    const scored = scoreScreener(def, answers);
    const result: ScreenerResult = {
      key,
      score: scored.score,
      severity: scored.severity,
      completedAt: new Date().toISOString(),
      timepoint: due ? (`day${due.nextDue}` as "day30" | "day60" | "day90") : "adhoc",
      responses: answers,
      // Same item-9 rule intake applies.
      crisisFlag: key === "phq-9" && (answers[8] ?? 0) > 0,
      ...(scored.positive !== undefined ? { positive: scored.positive } : {}),
    };
    AdelanteEHR.recordScreener(patientId, result);
    const closed: string[] = [];
    for (const t of p.tasks ?? []) {
      if (t.kind === "rescreen" && !t.completedAt && t.screenerKey === key) {
        t.completedAt = result.completedAt;
        closed.push(t.id);
      }
    }
    appendAudit({
      category: "clinical",
      action: "rescreen_completed",
      patientId,
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      detail: { screenerKey: key, closedTaskIds: closed, timepoint: result.timepoint },
    });
    emit();
    return result;
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
    const billing = _claimBridge?.bucketCounts() ?? {};
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
    input: {
      need: string;
      note?: string;
      visibleToPatient?: boolean;
      /** §5d-2 — interpersonal-safety need: staff-only unless stated. */
      safetySensitive?: boolean;
      /** §Phase 2 provenance. Defaults to staff-identified, which is what a
       * chart-side "add need" action really is; every other caller passes
       * its own real source. */
      source?: SdohItemSource;
    },
    actor?: { staffName: string; role: StaffRole },
  ) {
    const p = patients.find((x) => x.id === patientId);
    if (!p || !input.need.trim()) return;
    const item: SdohPlanItem = {
      id: uid(),
      need: input.need.trim(),
      source: input.source ?? "staff_assessed",
      status: "identified",
      note: input.note,
      // A safety need defaults to staff-only; every other need keeps the
      // existing patient-visible default.
      visibleToPatient: input.visibleToPatient ?? (input.safetySensitive ? false : true),
      ...(input.safetySensitive ? { safetySensitive: true } : {}),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(actor ? { createdBy: actor.staffName, createdByRole: actor.role } : {}),
    };

    p.sdohPlan = { items: [item, ...(p.sdohPlan?.items ?? [])] };
    appendAudit({
      category: "clinical",
      action: "sdoh_need_created",
      patientId,
      actorId: actor?.staffName ?? "unattributed",
      ...(actor ? { actorRole: actor.role } : {}),
      detail: { itemId: item.id, source: item.source },
    });
    _recomputeCarePlan(p.id, "sdoh_added");
    emit();
  },

  /**
   * §5d-2 — turn positive AHC-HRSN domains into REAL, workable needs.
   *
   * The care plan used to synthesize display-only rows for positive domains
   * with no `SdohPlanItem`; those rows could not be referred, tracked or
   * resolved. This creates the real items (provenance `pre_release_hrsn`),
   * deduped by need label against what is already on file, so nothing is
   * duplicated and nothing is re-sourced.
   *
   * The interpersonal-safety domain materializes STAFF-ONLY. Someone
   * disclosing safety risk may be living with the person harming them, so a
   * safety need must never appear on their portal, their phone or an
   * advocate's view unless a staff member deliberately shares it.
   */
  materializeHrsnNeeds(
    patientId: string,
    actor?: { staffName: string; role: StaffRole },
  ): { created: number } {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return { created: 0 };
    const domains = p.screeners["ahc-hrsn"]?.domains ?? [];
    let created = 0;
    for (const d of domains) {
      if (!d.positive) continue;
      const exists = (p.sdohPlan?.items ?? []).some(
        (i) => i.need.trim().toLowerCase() === d.label.trim().toLowerCase(),
      );
      if (exists) continue;
      AdelanteEHR.addSdohItem(
        patientId,
        {
          need: d.label,
          source: "pre_release_hrsn",
          ...(d.key === HRSN_SAFETY_DOMAIN_KEY ? { safetySensitive: true } : {}),
        },
        actor,
      );
      created++;
    }
    return { created };
  },

  /** Positive AHC-HRSN domains that have no real need row yet. */
  unmaterializedHrsnDomains(patientId: string): { key: string; label: string }[] {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return [];
    const items = p.sdohPlan?.items ?? [];
    return (p.screeners["ahc-hrsn"]?.domains ?? [])
      .filter((d) => d.positive)
      .filter(
        (d) =>
          !items.some((i) => i.need.trim().toLowerCase() === d.label.trim().toLowerCase()),
      )
      .map((d) => ({ key: d.key, label: d.label }));
  },


  /**
   * §Intake/SDOH Redesign Phase 3 — the one write intake uses for social needs.
   *
   * `confirmed` are needs the record already had evidence for and the person
   * has just said still apply. Each carries the provenance it was ESTABLISHED
   * with, not the screen it was confirmed on: a pre-release AHC-HRSN finding
   * stays `pre_release_hrsn` after an intake confirmation. An item that already
   * exists is touched, never duplicated and never re-sourced.
   *
   * `selfReported` are needs with no prior evidence that the person ticked in
   * their own intake — real `SdohPlanItem` rows with `intake_self_report`, not
   * just a boolean on `Patient.needs`.
   *
   * Nothing here CLOSES a need. Intake declining to confirm a staff- or
   * screening-identified need is not the same as that need being resolved, so
   * the item stands and a human works it.
   */
  applyIntakeNeeds(
    patientId: string,
    input: {
      confirmed: { need: string; source: SdohItemSource; existingItemId?: string }[];
      selfReported: { need: string }[];
    },
  ): { created: number; touched: number } {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return { created: 0, touched: 0 };
    const now = new Date().toISOString();
    let created = 0;
    let touched = 0;
    const has = (need: string) =>
      (p.sdohPlan?.items ?? []).find((i) => i.need.trim().toLowerCase() === need.trim().toLowerCase());

    for (const c of input.confirmed) {
      if (!c.need.trim()) continue;
      const existing = (c.existingItemId
        ? p.sdohPlan?.items.find((i) => i.id === c.existingItemId)
        : undefined) ?? has(c.need);
      if (existing) {
        existing.updatedAt = now;
        touched++;
        continue;
      }
      p.sdohPlan = {
        items: [
          {
            id: uid(),
            need: c.need.trim(),
            source: c.source,
            status: "identified",
            visibleToPatient: true,
            createdAt: now,
            updatedAt: now,
          },
          ...(p.sdohPlan?.items ?? []),
        ],
      };
      created++;
    }

    for (const s of input.selfReported) {
      if (!s.need.trim() || has(s.need)) continue;
      p.sdohPlan = {
        items: [
          {
            id: uid(),
            need: s.need.trim(),
            source: "intake_self_report",
            status: "identified",
            visibleToPatient: true,
            createdAt: now,
            updatedAt: now,
          },
          ...(p.sdohPlan?.items ?? []),
        ],
      };
      created++;
    }

    if (created || touched) {
      _recomputeCarePlan(p.id, "intake_needs_reconciled");
      emit();
    }
    return { created, touched };
  },
  setSdohStatus(
    patientId: string,
    itemId: string,
    status: SdohStatus,
    note?: string,
    actor?: { staffName: string; role: StaffRole },
  ) {
    const p = patients.find((x) => x.id === patientId);
    const item = p?.sdohPlan?.items.find((i) => i.id === itemId);
    if (!item) return;
    const prev = item.status;
    const prevNote = item.note;
    item.status = status;
    if (note !== undefined) item.note = note;
    item.updatedAt = new Date().toISOString();
    if (actor) {
      item.lastUpdatedBy = actor.staffName;
      item.lastUpdatedByRole = actor.role;
    }
    appendAudit({
      category: "clinical",
      action: "sdoh_need_status",
      patientId,
      actorId: actor?.staffName ?? "unattributed",
      ...(actor ? { actorRole: actor.role } : {}),
      detail: {
        itemId,
        from: prev,
        to: status,
        ...(note !== undefined && note !== prevNote ? { noteChanged: true } : {}),
      },
    });
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

  // ----- §Reporting Tier 2 — structured CalOMS history -----
  //
  // Reads live on the patient (`calomsProfile`); every field is typed, so the
  // reporting helpers in `calomsReporting.ts` can aggregate them without
  // parsing any narrative text.

  setSubstanceUseProfile(
    patientId: string,
    input: Omit<SubstanceUseProfile, "recordedAt">,
  ): SubstanceUseProfile | null {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return null;
    const profile: SubstanceUseProfile = { ...input, recordedAt: new Date().toISOString() };
    p.calomsProfile = { ...(p.calomsProfile ?? {}), substanceUse: profile };
    emit();
    return profile;
  },

  setPriorTreatmentHistory(
    patientId: string,
    input: Omit<PriorTreatmentHistory, "recordedAt">,
  ): PriorTreatmentHistory | null {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return null;
    const history: PriorTreatmentHistory = { ...input, recordedAt: new Date().toISOString() };
    p.calomsProfile = { ...(p.calomsProfile ?? {}), priorTreatment: history };
    emit();
    return history;
  },

  /** Append-only: a correction is a new row, never an overwrite. */
  recordDischarge(
    patientId: string,
    input: Omit<DischargeRecord, "id" | "recordedAt">,
  ): DischargeRecord | null {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return null;
    const record: DischargeRecord = { ...input, id: uid(), recordedAt: new Date().toISOString() };
    p.calomsProfile = {
      ...(p.calomsProfile ?? {}),
      discharges: [record, ...(p.calomsProfile?.discharges ?? [])],
    };
    emit();
    return record;
  },

  /**
   * Justice-involvement estimates. `source` defaults to "self_report" and can
   * only ever be "self_report" or "pre_release" — there is no facility feed to
   * verify against, so nothing here may claim verification.
   */
  setJusticeSelfReport(
    patientId: string,
    input: Omit<JusticeInvolvementSelfReport, "recordedAt" | "source"> & {
      source?: JusticeInvolvementSelfReport["source"];
    },
  ): JusticeInvolvementSelfReport | null {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return null;
    const report: JusticeInvolvementSelfReport = {
      ...input,
      source: input.source === "pre_release" ? "pre_release" : "self_report",
      recordedAt: new Date().toISOString(),
    };
    p.calomsProfile = { ...(p.calomsProfile ?? {}), justice: report };
    emit();
    return report;
  },

  /** Current (most recent) discharge record, if any. */
  currentDischarge(patientId: string): DischargeRecord | null {
    const p = patients.find((x) => x.id === patientId);
    return p?.calomsProfile?.discharges?.[0] ?? null;
  },
  /**
   * §Crisis Redesign Phase 2 — SDOH-urgent lane trigger.
   *
   * Staff-initiated ONLY. Nothing auto-classifies a social need as urgent:
   * whether "no housing tonight" is a crisis or a Tuesday is a real judgement
   * call, so it takes an explicit action with a reason. The escalation is an
   * ordinary CrisisEscalation with the DRAFT classification
   * severity: "urgent" / category: "sdoh" so it lands in the SDOH lane of the
   * crisis queue rather than the clinical one.
   */
  flagSdohItemUrgent(
    patientId: string,
    itemId: string,
    staffName: string,
    reason: string,
  ): CrisisEscalation {
    const p = patients.find((x) => x.id === patientId);
    const item = p?.sdohPlan?.items.find((i) => i.id === itemId);
    if (!p || !item) throw new Error("Social need not found.");
    if ((reason ?? "").trim().length < 3)
      throw new Error("A reason of at least 3 characters is required to flag a need urgent.");
    const existing = item.urgentEscalationId
      ? p.crisisEscalations?.find((r) => r.id === item.urgentEscalationId)
      : undefined;
    if (existing && existing.status === "open")
      throw new Error("This need is already flagged urgent and open in the crisis queue.");
    const detail = `${item.need} — ${reason?.trim() ?? ""}`.trim();
    const row = AdelanteEHR.flagCrisis(patientId, staffName, detail, {
      triggerSource: "sdoh_urgent",
      severity: "urgent",
      category: "sdoh",
    });
    item.urgentEscalationId = row.id;
    item.urgentFlaggedBy = staffName;
    item.urgentFlaggedAt = row.triggeredAt;
    item.updatedAt = row.triggeredAt;
    emit();
    return row;
  },
  removeSdohItem(patientId: string, itemId: string) {
    const p = patients.find((x) => x.id === patientId);
    if (!p?.sdohPlan) return;
    p.sdohPlan.items = p.sdohPlan.items.filter((i) => i.id !== itemId);
    emit();
  },

  // ----- Resource referral status/notes -----
  /**
   * §5d-2 — read the referrals made for one need. A need can hold many over
   * time; this is the ONE lookup (there is no back-pointer on the need).
   */
  referralsForNeed(patientId: string, itemId: string): ResourceReferral[] {
    const p = patients.find((x) => x.id === patientId);
    return (p?.resourceReferrals ?? []).filter((r) => r.sdohItemId === itemId);
  },

  // ----- §5d-3 activity log (append-only, attributed, STAFF-ONLY) -----
  /**
   * Append an entry to a social need's activity log. There is deliberately no
   * edit and no delete: this is a record of what happened, and rewriting it
   * would make the aging clock and the attribution both lie. An actor is
   * REQUIRED — unlike legacy status writes, an unattributed log entry cannot
   * be created at all.
   */
  appendSdohNeedLog(
    patientId: string,
    itemId: string,
    input: SdohLogEntryInput,
    actor: { staffName: string; role: StaffRole },
  ): SdohLogEntry | undefined {
    const p = patients.find((x) => x.id === patientId);
    const item = p?.sdohPlan?.items.find((i) => i.id === itemId);
    if (!item || !input.text.trim()) return;
    const entry: SdohLogEntry = {
      ...input,
      text: input.text.trim(),
      id: uid(),
      authorName: actor.staffName,
      authorRole: actor.role,
      at: new Date().toISOString(),
    };
    item.log = [...(item.log ?? []), entry];
    item.updatedAt = entry.at;
    appendAudit({
      category: "clinical",
      action: "sdoh_need_log_added",
      patientId,
      actorId: actor.staffName,
      actorRole: actor.role,
      detail: {
        itemId,
        entryId: entry.id,
        entryType: entry.entryType,
        ...(entry.barriers?.length ? { barriers: entry.barriers } : {}),
        ...(entry.nextStepDueDate ? { nextStepDueDate: entry.nextStepDueDate } : {}),
      },
    });
    emit();
    return entry;
  },

  /** Same contract as `appendSdohNeedLog`, for a resource referral. */
  appendReferralLog(
    patientId: string,
    referralId: string,
    input: SdohLogEntryInput,
    actor: { staffName: string; role: StaffRole },
  ): SdohLogEntry | undefined {
    const p = patients.find((x) => x.id === patientId);
    const r = p?.resourceReferrals?.find((x) => x.id === referralId);
    if (!r || !input.text.trim()) return;
    const entry: SdohLogEntry = {
      ...input,
      text: input.text.trim(),
      id: uid(),
      authorName: actor.staffName,
      authorRole: actor.role,
      at: new Date().toISOString(),
    };
    r.log = [...(r.log ?? []), entry];
    r.updatedAt = entry.at;
    appendAudit({
      category: "clinical",
      action: "resource_referral_log_added",
      patientId,
      actorId: actor.staffName,
      actorRole: actor.role,
      detail: {
        referralId,
        entryId: entry.id,
        entryType: entry.entryType,
        ...(entry.barriers?.length ? { barriers: entry.barriers } : {}),
        ...(entry.nextStepDueDate ? { nextStepDueDate: entry.nextStepDueDate } : {}),
      },
    });
    emit();
    return entry;
  },

  /** §5d-3 — set or clear a referral's follow-up date, attributed. */
  setReferralFollowUpDate(
    patientId: string,
    referralId: string,
    followUpDate: string | undefined,
    actor?: { staffName: string; role: StaffRole },
  ) {
    const p = patients.find((x) => x.id === patientId);
    const r = p?.resourceReferrals?.find((x) => x.id === referralId);
    if (!r) return;
    r.followUpDate = followUpDate?.trim() || undefined;
    r.updatedAt = new Date().toISOString();
    if (actor) {
      r.lastUpdatedBy = actor.staffName;
      r.lastUpdatedByRole = actor.role;
    }
    appendAudit({
      category: "clinical",
      action: "resource_referral_follow_up",
      patientId,
      actorId: actor?.staffName ?? "unattributed",
      ...(actor ? { actorRole: actor.role } : {}),
      detail: { referralId, followUpDate: r.followUpDate ?? null },
    });
    emit();
  },

  /**
   * §5d-3 — turn a follow-up date or a logged next step into a REAL case task
   * on the existing creation path, assigned to the patient's case manager.
   *
   * When no case manager is assigned this returns `{ created: false,
   * reason }` and writes nothing. The caller shows that reason: silently
   * creating nothing is the failure mode this replaces (Phase 3a pattern).
   *
   * 42 CFR Part 2: the task title and detail NEVER name the referral category
   * or the organization. Task titles surface in shared queues to staff who may
   * be Part 2-gated, so only "Social-needs follow-up" plus the client appears.
   */
  createSdohFollowUpTask(input: {
    patientId: string;
    dueDate: string;
    /** The need this follows up on, when there is one. */
    sdohItemId?: string;
    /** The referral this follows up on, when there is one. */
    referralId?: string;
    nextStep?: string;
  }): { created: true; task: CaseTask } | { created: false; reason: string } {
    const p = patients.find((x) => x.id === input.patientId);
    if (!p) return { created: false, reason: "Client not found." };
    if (!p.caseManagerId) {
      return {
        created: false,
        reason:
          "No case manager is assigned to this client, so a follow-up task cannot be assigned. Assign a case manager first.",
      };
    }
    const anchor = input.referralId ?? input.sdohItemId ?? "unlinked";
    const task = AdelanteEHR.createCaseTask({
      patientId: input.patientId,
      assignedTo: p.caseManagerId,
      title: "Social-needs follow-up",
      // Deliberately generic — see the Part 2 note above.
      detail: input.nextStep?.trim() || "Follow up on an open social-needs item.",
      dueDate: input.dueDate,
      origin: "sdoh_follow_up",
      taskType: "sdoh_follow_up",
      source: "manual",
      dedupeKey: `sdoh-follow:${anchor}:${input.dueDate}`,
    });
    if (!task) return { created: false, reason: "A follow-up task already exists for that date." };
    return { created: true, task };
  },


  /**
   * §5d-2 — record a real outcome. Any outcome other than `pending` needs a
   * reason: "waitlisted" or "not eligible" with no explanation is not a
   * record anyone can work from. Nothing here touches the linked need —
   * resolving a need is a human decision (see the connected prompt in the UI).
   */
  setResourceReferralStatus(
    patientId: string,
    referralId: string,
    status: ResourceReferralOutcome,
    note?: string,
    actor?: { staffName: string; role: StaffRole },
    outcomeReason?: string,
  ) {
    const p = patients.find((x) => x.id === patientId);
    const r = p?.resourceReferrals?.find((x) => x.id === referralId);
    if (!r) return;
    if (status !== "pending" && !(outcomeReason ?? r.outcomeReason ?? "").trim()) {
      throw new Error("Give a short reason for this outcome.");
    }
    const prev = r.status;
    const prevNote = r.note;
    r.status = status;
    if (outcomeReason !== undefined) r.outcomeReason = outcomeReason.trim() || undefined;
    if (note !== undefined) r.note = note;
    r.updatedAt = new Date().toISOString();
    if (actor) {
      r.lastUpdatedBy = actor.staffName;
      r.lastUpdatedByRole = actor.role;
    }
    appendAudit({
      category: "clinical",
      action: "resource_referral_status",
      patientId,
      actorId: actor?.staffName ?? "unattributed",
      ...(actor ? { actorRole: actor.role } : {}),
      detail: {
        referralId,
        from: prev,
        to: status,
        ...(r.outcomeReason ? { outcomeReason: r.outcomeReason } : {}),
        ...(note !== undefined && note !== prevNote ? { noteChanged: true } : {}),
      },
    });
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
    /** §Pre-release pipeline — partner-supplied facility name when no real `Facility` row matches. */
    facilityName?: string;
    bookingId?: string;
    /** §Pre-release pipeline — partner-supplied booking number (free text, not a `Booking` link). */
    bookingNumber?: string;
    receivingEcmStaffId?: string;
    openedBy: string;
    actorRole: string;
    /** §Front-door Phase 2 — day-one catch-up rather than pre-release timing. */
    missedHandoff?: boolean;
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
      facilityName: facility?.name ?? input.facilityName,
      bookingId: input.bookingId,
      bookingNumber: input.bookingNumber,
      anticipatedReleaseDate: input.anticipatedReleaseDate,
      cfCareManagerStaffId: input.cfCareManagerStaffId,
      cfCareManagerName: input.cfCareManagerName,
      receivingEcmStaffId: input.receivingEcmStaffId,
      status: "open",
      openedAt: new Date().toISOString(),
      openedBy: input.openedBy,
      missedHandoff: input.missedHandoff || undefined,
    };
    preReleaseEpisodes.unshift(ep);
    // Every form becomes a real worklist row — no parallel task mechanism.
    for (const def of PRE_RELEASE_FORMS) {
      AdelanteEHR.createCaseTask({
        patientId: ep.patientId,
        assignedTo: "",
        title: `${ep.missedHandoff ? "Catch-up (missed pre-release)" : "Pre-release"} — ${def.label}`,
        detail: `${PRE_RELEASE_FORM_CATEGORIES.find((c) => c.key === def.category)?.label ?? def.category} · ${ep.missedHandoff ? `due day one of intake (${ep.anticipatedReleaseDate})` : `release ${ep.anticipatedReleaseDate}`}`,
        dueDate: ep.anticipatedReleaseDate,
        taskType: ep.missedHandoff ? "missed_handoff_catch_up" : "pre_release_form",
        priority: ep.missedHandoff ? "urgent" : undefined,
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
    // §Pre-release pipeline — the episode's facts land on the patient record
    // NOW, not at redemption: the record should be right the whole time the
    // person is in custody. Anticipated, so fill-if-empty only.
    _applyEpisodeReleaseDate(ep.patientId, ep.anticipatedReleaseDate, "estimated");
    _setPatientCustody(ep, "in_custody");
    // §Pre-release build 4 — keep the CalAIM plan live with custody-side work.
    _recomputeCarePlan(ep.patientId, "pre_release_episode_opened");
    emit();
    return ep;
  },
  preReleaseTaskFor(episodeId: string, formKey: string): CaseTask | undefined {
    return caseTasks.find((t) => t.dedupeKey === `prerelease:${episodeId}:${formKey}`);
  },

  // ---------- §Pre-release intake build 1 — in-custody profile creation ----
  /**
   * Create the person AND open their pre-release episode as ONE action.
   *
   * For this population the record almost never exists first: the CF Care
   * Manager meets somebody in custody. Both halves reuse the real primitives
   * (`createPatient`, `openPreReleaseEpisode`) unchanged, so the population
   * resolver classifies the new patient as `pre_release_ji` from the moment
   * this returns — an open, non-missed-handoff episode is its strongest
   * signal, and there is nothing extra to remember to set.
   */
  openPreReleaseEpisodeForNewPatient(input: {
    firstName: string;
    lastName: string;
    dob?: string;
    phone?: string;
    preferredLanguage?: PreferredLanguage;
    cin?: string;
    anticipatedReleaseDate: string;
    cfCareManagerStaffId: string;
    cfCareManagerName: string;
    facilityId?: string;
    facilityName?: string;
    bookingId?: string;
    bookingNumber?: string;
    openedBy: string;
    actorRole: string;
  }): { patient: Patient; episode: PreReleaseEpisode } {
    if (!input.firstName.trim() || !input.lastName.trim())
      throw new Error("A first and last name are required to create the record.");
    if (!input.anticipatedReleaseDate)
      throw new Error("An anticipated release date is required to open a pre-release episode.");
    const patient = AdelanteEHR.createPatient({
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      ...(input.dob ? { dob: input.dob } : {}),
      ...(input.phone ? { phone: input.phone } : {}),
      ...(input.preferredLanguage ? { preferredLanguage: input.preferredLanguage } : {}),
      ...(input.cin ? { cin: input.cin } : {}),
    });
    appendAudit({
      category: "clinical",
      action: "in_custody_patient_created",
      patientId: patient.id,
      actorId: input.openedBy,
      actorRole: input.actorRole,
      detail: {
        anticipatedReleaseDate: input.anticipatedReleaseDate,
        facilityId: input.facilityId,
        cfCareManagerStaffId: input.cfCareManagerStaffId,
      },
    });
    const episode = AdelanteEHR.openPreReleaseEpisode({
      patientId: patient.id,
      anticipatedReleaseDate: input.anticipatedReleaseDate,
      cfCareManagerStaffId: input.cfCareManagerStaffId,
      cfCareManagerName: input.cfCareManagerName,
      ...(input.facilityId ? { facilityId: input.facilityId } : {}),
      ...(input.facilityName ? { facilityName: input.facilityName } : {}),
      ...(input.bookingId ? { bookingId: input.bookingId } : {}),
      ...(input.bookingNumber ? { bookingNumber: input.bookingNumber } : {}),
      openedBy: input.openedBy,
      actorRole: input.actorRole,
    });
    return { patient, episode };
  },

  // ---------- §Pre-release intake build 1 — capacity & legal authority -----
  getPreReleaseCapacity(episodeId: string): PreReleaseCapacityDetermination | undefined {
    return preReleaseCapacity.find((c) => c.episodeId === episodeId);
  },

  /**
   * Record (or re-record) the capacity determination. Required and early: the
   * checklist row for it is generated with every episode and this is the only
   * way to satisfy it.
   */
  recordPreReleaseCapacity(input: {
    episodeId: string;
    status: IntakeCapacityStatus;
    basis: string;
    attribution: CfAttribution;
  }): PreReleaseCapacityDetermination {
    const ep = AdelanteEHR.getPreReleaseEpisode(input.episodeId);
    if (!ep) throw new Error("Pre-release episode not found.");
    // Identical mechanism to every other pre-release entry — no stricter or
    // looser rule carved out for the capacity determination.
    assertCfEntryScope(ep, input.attribution, "pre_release_capacity");
    if (!input.basis.trim())
      throw new Error("Record what you observed — the basis for the capacity determination.");
    const now = new Date().toISOString();
    const determinedBy = input.attribution.enteredBy.staffName;
    const determinedByRole = input.attribution.enteredBy.role;
    let rec = preReleaseCapacity.find((c) => c.episodeId === ep.id);
    if (!rec) {
      rec = {
        id: uid(),
        episodeId: ep.id,
        patientId: ep.patientId,
        status: input.status,
        basis: input.basis.trim(),
        determinedBy,
        determinedByRole,
        determinedAt: now,
        attribution: input.attribution,
        identifiedAdvocates: [],
      };
      preReleaseCapacity.unshift(rec);
    } else {
      rec.status = input.status;
      rec.basis = input.basis.trim();
      rec.determinedBy = determinedBy;
      rec.determinedByRole = determinedByRole;
      rec.determinedAt = now;
      rec.attribution = input.attribution;
    }
    appendAudit({
      category: "clinical",
      action: cfAuditAction("pre_release_capacity_determined", input.attribution),
      patientId: ep.patientId,
      actorId: determinedBy,
      actorRole: determinedByRole,
      detail: {
        episodeId: ep.id,
        ...cfAuditIdentities(input.attribution),
        capacity: rec.status,
        requiresSurrogate: capacityRequiresSurrogate(rec.status),
        basis: rec.basis,
      },
    });
    // §Pre-release build 4 — keep the CalAIM plan live with custody-side work.
    _recomputeCarePlan(ep.patientId, "pre_release_capacity");
    emit();
    return { ...rec };
  },

  /**
   * Identify an advocate AT the capacity step, which is the point at which a
   * real invitation goes out. Same one-way designation rule as everywhere
   * else: `createAdvocateInvitation` is the mechanism, unchanged, so the
   * invitation is traceable rather than a recorded name.
   */
  identifyPreReleaseAdvocate(input: {
    episodeId: string;
    advocateName: string;
    relationship?: string;
    invitationSentTo: string;
    invitationChannel: "email" | "sms";
    expectedAuthorization: PreReleaseCapacityDetermination["identifiedAdvocates"][number]["expectedAuthorization"];
    identifiedBy: string;
    actorRole: string;
  }): AdvocateLink {
    const ep = AdelanteEHR.getPreReleaseEpisode(input.episodeId);
    if (!ep) throw new Error("Pre-release episode not found.");
    const rec = preReleaseCapacity.find((c) => c.episodeId === ep.id);
    if (!rec)
      throw new Error(
        "Record the capacity determination first — the advocate step follows from its answer.",
      );
    const link = AdelanteEHR.createAdvocateInvitation({
      patientId: ep.patientId,
      advocateName: input.advocateName,
      ...(input.relationship ? { relationship: input.relationship } : {}),
      invitationSentTo: input.invitationSentTo,
      invitationChannel: input.invitationChannel,
      // The instrument the CF/ECM staffer expects drives which consent
      // documentation the advocate is asked for at claim time.
      expectedAuthorizationType: input.expectedAuthorization,
      designatedBy: {
        actor:
          input.actorRole === "ecm_provider"
            ? "ecm_provider"
            : input.actorRole === "sys_admin"
              ? "administrator"
              : "cf_care_manager",
        name: input.identifiedBy,
      },
    });
    rec.identifiedAdvocates = [
      ...rec.identifiedAdvocates,
      { advocateLinkId: link.id, expectedAuthorization: input.expectedAuthorization },
    ];
    appendAudit({
      category: "advocate",
      action: "pre_release_advocate_identified",
      patientId: ep.patientId,
      actorId: input.identifiedBy,
      actorRole: input.actorRole,
      detail: {
        episodeId: ep.id,
        advocateLinkId: link.id,
        advocateName: link.advocateName,
        expectedAuthorization: input.expectedAuthorization,
        capacity: rec.status,
      },
    });
    // §Pre-release build 4 — keep the CalAIM plan live with custody-side work.
    _recomputeCarePlan(ep.patientId, "pre_release_advocate");
    emit();
    return link;
  },

  /**
   * The live capacity/authority state for an episode. Whether an instrument is
   * in force is re-read through the EXISTING advocate gate every call — a
   * lapsed temporary AHCD determination or a revoked link closes this gate
   * with nothing needing to be told.
   */
  preReleaseCapacityState(episodeId: string): {
    determination?: PreReleaseCapacityDetermination;
    /** Legal-authority links (AHCD / conservatorship) for this patient. */
    authorityLinks: AdvocateLink[];
    activeAuthorityLinkId?: string;
    decision: CapacityGateDecision;
  } {
    const ep = AdelanteEHR.getPreReleaseEpisode(episodeId);
    const determination = preReleaseCapacity.find((c) => c.episodeId === episodeId);
    if (!ep)
      return {
        authorityLinks: [],
        decision: capacityGateDecision({
          legalAuthorityActive: false,
          legalAuthorityPending: false,
        }),
      };
    const expected = new Map(
      (determination?.identifiedAdvocates ?? []).map((a) => [
        a.advocateLinkId,
        a.expectedAuthorization,
      ]),
    );
    const authorityLinks = AdelanteEHR.listAdvocateLinks(ep.patientId).filter((l) => {
      const claimed = l.authorizationType;
      if (claimed) return claimed === "ahcd" || claimed === "conservatorship";
      const exp = expected.get(l.id);
      return exp === "ahcd" || exp === "conservatorship";
    });
    const active = authorityLinks.find((l) => AdelanteEHR.advocateAccess(l.id).allowed);
    const pending = authorityLinks.some((l) => l.status !== "revoked" && l.status !== "expired");
    return {
      ...(determination ? { determination } : {}),
      authorityLinks,
      ...(active ? { activeAuthorityLinkId: active.id } : {}),
      decision: capacityGateDecision({
        ...(determination ? { capacity: determination.status } : {}),
        legalAuthorityActive: Boolean(active),
        legalAuthorityPending: Boolean(!active && pending),
      }),
    };
  },
  /**
   * §Intake/SDOH Phase 1 — the real open → released transition.
   *
   * Release is the clinically meaningful event, and it is the ONLY thing that
   * moves the derived population track off `pre_release_ji` while the episode
   * is still being worked: `resolvePopulationTrack` checks for an open episode
   * first, and `dayZeroAvailability` triggers specifically on
   * `status === "released"`. Closing (below) is the later administrative wrap.
   *
   * Deliberately NOT automatic. `anticipatedReleaseDate` is anticipated —
   * dates slip both ways, and inferring release from a calendar would silently
   * flip what the patient sees. A human confirms the person is actually out.
   */
  /**
   * §Pre-release pipeline — county of release, which lives on `coverage`
   * because that is where the referral path already writes it. A narrow setter
   * rather than a new field: two sources of truth for county would be worse
   * than a slightly odd home for one. `updateProfile` does not cover it.
   */
  setCountyOfRelease(patientId: string, county: string): void {
    const p = patients.find((x) => x.id === patientId);
    if (!p || !county) return;
    p.coverage = {
      ...(p.coverage ?? { status: "none_unsure" as CoverageStatus, verified: "pending" as const }),
      countyOfRelease: county,
    };
    emit();
  },

  /**
   * §Pre-release pipeline — correct the logistics on an OPEN episode from a
   * newer partner roster. Deliberately narrow: release date, facility name and
   * booking number only. Nothing clinical, no status movement.
   */
  updatePreReleaseEpisodeDetails(input: {
    episodeId: string;
    anticipatedReleaseDate?: string;
    facilityName?: string;
    bookingNumber?: string;
    updatedBy: string;
    actorRole: string;
  }): PreReleaseEpisode | undefined {
    const ep = preReleaseEpisodes.find((e) => e.id === input.episodeId);
    if (!ep || ep.status !== "open") return undefined;
    const before = ep.anticipatedReleaseDate;
    if (input.anticipatedReleaseDate) ep.anticipatedReleaseDate = input.anticipatedReleaseDate;
    if (input.facilityName) ep.facilityName = input.facilityName;
    if (input.bookingNumber) ep.bookingNumber = input.bookingNumber;
    // Same fill-if-empty rule as opening: a confirmed date is never overwritten
    // by an anticipated one from a spreadsheet.
    _applyEpisodeReleaseDate(ep.patientId, ep.anticipatedReleaseDate, "estimated");
    _setPatientCustody(ep, "in_custody");
    appendAudit({
      category: "clinical",
      action: "pre_release_episode_details_updated",
      patientId: ep.patientId,
      actorId: input.updatedBy,
      actorRole: input.actorRole,
      detail: {
        episodeId: ep.id,
        previousAnticipatedReleaseDate: before,
        anticipatedReleaseDate: ep.anticipatedReleaseDate,
      },
    });
    emit();
    return ep;
  },
  markPreReleaseEpisodeReleased(input: {
    episodeId: string;
    confirmedBy: string;
    actorRole: string;
    /** Actual release date (ISO date), when it differs from the anticipated one. */
    releasedOn?: string;
  }): PreReleaseEpisode {
    const ep = preReleaseEpisodes.find((e) => e.id === input.episodeId);
    if (!ep) throw new Error("Pre-release episode not found.");
    if (ep.status !== "open")
      throw new Error(`This episode is already ${ep.status}; release can only be confirmed once.`);
    ep.status = "released";
    // §Pre-release pipeline — the confirmed date is now PERSISTED, not just
    // audited. Falling back to the anticipated date is honest here: the human
    // confirming release without correcting the date is asserting it held.
    ep.actualReleaseDate = input.releasedOn || ep.anticipatedReleaseDate;
    _applyEpisodeReleaseDate(ep.patientId, ep.actualReleaseDate, "confirmed");
    _setPatientCustody(ep, "released");
    appendAudit({
      category: "clinical",
      action: "pre_release_episode_released",
      patientId: ep.patientId,
      actorId: input.confirmedBy,
      actorRole: input.actorRole,
      detail: {
        episodeId: ep.id,
        anticipatedReleaseDate: ep.anticipatedReleaseDate,
        actualReleaseDate: ep.actualReleaseDate,
        ...(input.releasedOn ? { releasedOn: input.releasedOn } : {}),
      },
    });
    // Continuity moves to the community plan the moment the person is out.
    _recomputeCarePlan(ep.patientId, "pre_release_episode_released");

    emit();
    return ep;
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
    if (!input.reason.trim())
      throw new Error("A reason is required to close a pre-release episode.");
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
    // §Pre-release build 4 — keep the CalAIM plan live with custody-side work.
    // §Pre-release pipeline — a closed episode stops asserting custody. If it
    // was already confirmed released we keep that; otherwise the honest answer
    // is that we no longer know (transfer, opened in error, lost contact).
    _setPatientCustody(ep, ep.actualReleaseDate ? "released" : "unknown");
    _recomputeCarePlan(ep.patientId, "pre_release_episode_closed");
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
    /** Set when the capacity gate blocks this consent-dependent step. */
    blocked?: string;
  }[] {
    const ep = AdelanteEHR.getPreReleaseEpisode(episodeId);
    const plan = reentryCarePlans.find((p) => p.episodeId === episodeId);
    const capacity = AdelanteEHR.preReleaseCapacityState(episodeId);
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
      if (def.satisfiedByCapacityStep) {
        // Complete only when the branch is genuinely resolved: competent, or
        // impaired WITH a legal-authority instrument actually in force.
        status = capacity.decision.canProceed
          ? "complete"
          : capacity.determination
            ? "in_progress"
            : "not_started";
      }
      if (def.satisfiedByScreeners && ep) {
        // Real completed instruments, read from the ordinary screener record.
        // Existence only — workflow status is not a Part 2 content read.
        const done = def.satisfiedByScreeners.filter((k) =>
          AdelanteEHR.hasScreenerResult(ep.patientId, k),
        ).length;
        status =
          done === def.satisfiedByScreeners.length
            ? "complete"
            : done > 0
              ? "in_progress"
              : "not_started";
      }
      const blocked =
        def.requiresConsentCapacity && !capacity.decision.canProceed && status !== "complete"
          ? capacity.decision.reason
          : undefined;
      // Keep the worklist row honest for the derived rows.
      if (task && status === "complete" && task.status !== "done") {
        AdelanteEHR.completeCaseTask(task.id);
        changed = true;
      }
      return { def, record, task, status, ...(blocked ? { blocked } : {}) };
    });
    if (changed) emit();
    return rows;
  },
  /**
   * Structured field capture for the two non-consent categories. Deliberately
   * refuses the consent and transition-planning categories: those have their
   * own instruments and must not be shadow-captured as loose fields.
   */
  /**
   * §Pre-release build 2 — administer a REAL instrument inside a pre-release
   * episode.
   *
   * This is deliberately NOT a new screening system. It performs the same two
   * pre-release authorization checks every other episode write performs
   * (`assertCfEntryScope` for direct/proxy attribution, and the Build-1
   * capacity gate for consent-dependent steps), then hands off to the exact
   * `scoreScreener` + `recordScreener` path intake uses — same ScreenerResult,
   * same `screenerHistory`, same crisis handling, same care-plan recompute.
   */
  /**
   * §Pre-release pipeline — AHC-HRSN domain results that arrived in a partner
   * roster spreadsheet, NOT administered in the app.
   *
   * Domain positivity only. The item-level answers belong to a real
   * administered interview and are deliberately not invented from a
   * spreadsheet, so `responses` is absent and the result is stamped
   * `provenance: "imported_roster"`. `score` is what it honestly is for this
   * instrument — the count of positive domains.
   */
  recordImportedHrsnDomains(input: {
    episodeId: string;
    domains: { key: string; label: string; positive: boolean }[];
    importedBy: string;
    actorRole: string;
  }): ScreenerResult | undefined {
    const ep = preReleaseEpisodes.find((e) => e.id === input.episodeId);
    if (!ep || input.domains.length === 0) return undefined;
    const score = input.domains.filter((d) => d.positive).length;
    const result: ScreenerResult = {
      key: "ahc-hrsn",
      score,
      severity: score === 0 ? "No identified social needs" : `${score} identified need(s)`,
      completedAt: new Date().toISOString(),
      timepoint: "intake",
      context: "pre_release",
      episodeId: ep.id,
      positive: score >= 1,
      domains: input.domains,
      provenance: "imported_roster",
    };
    AdelanteEHR.recordScreener(ep.patientId, result);
    // §5d-2 — positive domains become REAL, referable needs here, not
    // display-only care-plan rows. Safety materializes staff-only.
    AdelanteEHR.materializeHrsnNeeds(ep.patientId, {
      staffName: input.importedBy,
      role: input.actorRole as StaffRole,
    });

    appendAudit({
      category: "clinical",
      action: "pre_release_hrsn_imported",
      patientId: ep.patientId,
      actorId: input.importedBy,
      actorRole: input.actorRole,
      detail: { episodeId: ep.id, positiveDomains: score },
    });
    emit();
    return result;
  },
  recordPreReleaseScreener(input: {

    episodeId: string;
    screenerKey: string;
    answers: number[];
    attribution: CfAttribution;
  }): ScreenerResult {
    const ep = AdelanteEHR.getPreReleaseEpisode(input.episodeId);
    if (!ep) throw new Error("Pre-release episode not found.");
    const def = screenerByKey(input.screenerKey);
    if (!def) throw new Error("Unknown screening instrument.");
    const owner = PRE_RELEASE_FORMS.find((d) =>
      d.satisfiedByScreeners?.includes(input.screenerKey),
    );
    if (!owner) throw new Error("That instrument is not part of the pre-release checklist.");
    assertCfEntryScope(ep, input.attribution, `pre_release_screener:${input.screenerKey}`);
    if (owner.requiresConsentCapacity) {
      const gate = AdelanteEHR.preReleaseCapacityState(ep.id).decision;
      if (!gate.canProceed) throw new Error(gate.reason);
    }
    if (input.answers.length !== def.questions.length)
      throw new Error(`${def.name} requires all ${def.questions.length} items.`);
    const scored = scoreScreener(def, input.answers);
    const result: ScreenerResult = {
      key: def.key,
      score: scored.score,
      severity: scored.severity,
      completedAt: new Date().toISOString(),
      timepoint: "intake",
      responses: input.answers,
      context: "pre_release",
      episodeId: ep.id,
      administeredBy: input.attribution,
      ...(scored.positive !== undefined ? { positive: scored.positive } : {}),
      ...(scored.domains ? { domains: scored.domains } : {}),
    };
    AdelanteEHR.recordScreener(ep.patientId, result);
    appendAudit({
      category: "clinical",
      action: cfAuditAction("pre_release_screener_recorded", input.attribution),
      patientId: ep.patientId,
      actorId: input.attribution.enteredBy.staffName,
      actorRole: input.attribution.enteredBy.role,
      detail: {
        episodeId: ep.id,
        formKey: owner.key,
        screenerKey: def.key,
        // Score/severity only — item responses are never audited.
        score: scored.score,
        severity: scored.severity,
        ...cfAuditIdentities(input.attribution),
      },
    });
    emit();
    return result;
  },
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
    if (def.satisfiedByCapacityStep)
      throw new Error(
        "Capacity & legal authority is recorded through the capacity determination step.",
      );
    if (def.satisfiedByScreeners)
      throw new Error(
        "This step is satisfied by a real completed screener result, not by form fields.",
      );
    // The real gate: an impaired individual with no legal-authority
    // instrument on file cannot be treated as having consented themselves.
    if (def.requiresConsentCapacity) {
      const gate = AdelanteEHR.preReleaseCapacityState(ep.id).decision;
      if (!gate.canProceed) throw new Error(gate.reason);
    }
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
    // §Pre-release build 4 — keep the CalAIM plan live with custody-side work.
    _recomputeCarePlan(ep.patientId, "pre_release_form");
    emit();
    return rec;
  },

  // ---------- §v3.0 Phase 2 — Person-Centered Reentry Care Plan ----------
  getReentryCarePlan(episodeId: string): ReentryCarePlan | undefined {
    return reentryCarePlans.find((p) => p.episodeId === episodeId);
  },

  // ---------- §Pre-release build 3 — MAT ordering & real appointment booking ----------
  //
  // Neither of these is a parallel tracking system. `orderPreReleaseMat`
  // creates an ordinary draft `MedOrder` through `addDraftOrder`, and
  // `bookPreReleaseAppointment` creates an ordinary `Appointment` through
  // `bookAppointment`. What this layer adds is the two pre-release
  // authorizations: the Build-1 capacity/legal-authority gate (both actions
  // are consent-dependent clinical treatment) and, for the appointment, the
  // ordinary CF direct/proxy entry scope.

  /**
   * Initiate MAT from the pre-release workspace. Prescriber-only: the gate is
   * `canPrescribeMedications`, i.e. `meds_erx` write — the exact gate the
   * Orders tab uses. The prescriber is acting as a clinician, not as the
   * episode's CF Care Manager, so `assertCfEntryScope` deliberately does NOT
   * apply; the capacity gate does.
   */
  orderPreReleaseMat(input: {
    episodeId: string;
    prescriber: { staffId?: string; staffName: string; role: StaffRole };
    order: Omit<MedOrder, "id" | "patientId" | "status" | "attestedAt" | "attestedBy">;
  }): MedOrder {
    const ep = AdelanteEHR.getPreReleaseEpisode(input.episodeId);
    if (!ep) throw new Error("Pre-release episode not found.");
    if (!canPrescribeMedications(input.prescriber.role))
      throw new Error(
        "Only a prescriber (meds_erx write) can initiate MAT. Ask the prescriber to place the order.",
      );
    const gate = AdelanteEHR.preReleaseCapacityState(ep.id).decision;
    if (!gate.canProceed) throw new Error(gate.reason);
    const row = AdelanteEHR.addDraftOrder(ep.patientId, {
      ...input.order,
      createdBy: input.order.createdBy ?? input.prescriber.staffName,
      preReleaseEpisodeId: ep.id,
    });
    appendAudit({
      category: "clinical",
      action: "pre_release_mat_drafted",
      patientId: ep.patientId,
      actorId: input.prescriber.staffName,
      actorRole: input.prescriber.role,
      detail: { episodeId: ep.id, orderId: row.id, drugName: row.drugName },
    });
    emit();
    return row;
  },

  /**
   * Sign MAT drafts staged in the pre-release workspace. Re-checks the
   * capacity gate at sign time (authority can lapse between drafting and
   * signing), then delegates to the ordinary `signOrders` path — same
   * attestation, same provenance audit, same chart.
   */
  signPreReleaseMatOrders(input: {
    episodeId: string;
    orderIds: string[];
    prescriber: { staffName: string; role: StaffRole };
    strengthProvenance?: Record<string, unknown[]>;
  }): MedOrder[] {
    const ep = AdelanteEHR.getPreReleaseEpisode(input.episodeId);
    if (!ep) throw new Error("Pre-release episode not found.");
    if (!canPrescribeMedications(input.prescriber.role))
      throw new Error("Only a prescriber (meds_erx write) can sign medication orders.");
    const gate = AdelanteEHR.preReleaseCapacityState(ep.id).decision;
    if (!gate.canProceed) throw new Error(gate.reason);
    const signed = AdelanteEHR.signOrders(
      ep.patientId,
      input.orderIds,
      input.prescriber.staffName,
      {
        ...(input.strengthProvenance ? { strengthProvenance: input.strengthProvenance } : {}),
      },
    );
    if (signed.length)
      appendAudit({
        category: "clinical",
        action: "pre_release_mat_signed",
        patientId: ep.patientId,
        actorId: input.prescriber.staffName,
        actorRole: input.prescriber.role,
        detail: {
          episodeId: ep.id,
          orderIds: signed.map((o) => o.id),
          drugNames: signed.map((o) => o.drugName),
        },
      });
    return signed;
  },

  /** Orders initiated from a pre-release episode, read off the real chart. */
  listPreReleaseMatOrders(episodeId: string): MedOrder[] {
    const ep = AdelanteEHR.getPreReleaseEpisode(episodeId);
    if (!ep) return [];
    return AdelanteEHR.listOrders(ep.patientId).filter((o) => o.preReleaseEpisodeId === ep.id);
  },

  /**
   * Book the pre-release "first appointment" as a REAL appointment.
   *
   * Before build 3 this step only recorded provider/location strings on the
   * care plan. Now it creates an actual `Appointment` through the same
   * `bookAppointment` the scheduling surfaces use (same credential check,
   * same double-book check, same reminders/notification), and links it back
   * onto the care-plan row via `apptId` so the ECM hand-off view resolves the
   * live booking rather than a typed string.
   */
  bookPreReleaseAppointment(input: {
    episodeId: string;
    kind: ReentryAppointmentKind;
    clinicianId: string;
    start: string;
    durationMin?: number;
    serviceType?: ServiceType;
    modality?: "video" | "phone" | "in_person";
    locationId?: string;
    attribution: CfAttribution;
  }): { appointment: Appointment; carePlanAppointment: ReentryAppointment } {
    const ep = AdelanteEHR.getPreReleaseEpisode(input.episodeId);
    if (!ep) throw new Error("Pre-release episode not found.");
    assertCfEntryScope(ep, input.attribution, `pre_release_appointment:${input.kind}`);
    // Scheduling a treatment appointment is consent-dependent, exactly like
    // the other clinical steps on this checklist.
    const gate = AdelanteEHR.preReleaseCapacityState(ep.id).decision;
    if (!gate.canProceed) throw new Error(gate.reason);
    const plan = AdelanteEHR.getReentryCarePlan(ep.id);
    if (plan?.status === "completed")
      throw new Error("This care plan is completed and member-signed; it can no longer be edited.");
    const serviceType = input.serviceType ?? REENTRY_APPT_SERVICE_TYPE[input.kind];
    const modality = input.modality ?? "in_person";
    const appointment = AdelanteEHR.bookAppointment({
      patientId: ep.patientId,
      clinicianId: input.clinicianId,
      start: new Date(input.start).toISOString(),
      durationMin: input.durationMin ?? 30,
      serviceType,
      modality,
      ...(input.locationId ? { locationId: input.locationId } : {}),
    });
    const clinician = AdelanteEHR.getClinician(input.clinicianId);
    const location = input.locationId ? AdelanteEHR.getLocation(input.locationId) : undefined;
    const carePlanAppointment: ReentryAppointment = {
      id: uid(),
      kind: input.kind,
      apptId: appointment.id,
      start: appointment.start,
      providerName: clinician?.name ?? "Adelante clinician",
      location: location?.name ?? (modality === "in_person" ? "Adelante clinic" : "Telehealth"),
      modality,
    };
    const now = new Date().toISOString();
    if (!plan) {
      reentryCarePlans.unshift({
        id: uid(),
        episodeId: ep.id,
        patientId: ep.patientId,
        housing: { arrangement: "" },
        appointments: [carePlanAppointment],
        dmeNeeds: [],
        status: "draft",
        attribution: input.attribution,
        updatedAt: now,
      });
    } else {
      // Replace any unbooked placeholder of the same kind rather than stacking
      // a second row alongside it.
      const placeholder = plan.appointments.findIndex((a) => a.kind === input.kind && !a.apptId);
      if (placeholder >= 0) plan.appointments.splice(placeholder, 1, carePlanAppointment);
      else plan.appointments = [...plan.appointments, carePlanAppointment];
      plan.attribution = input.attribution;
      plan.updatedAt = now;
    }
    appendAudit({
      category: "clinical",
      action: cfAuditAction("pre_release_appointment_booked", input.attribution),
      patientId: ep.patientId,
      actorId: input.attribution.enteredBy.staffName,
      actorRole: input.attribution.enteredBy.role,
      detail: {
        episodeId: ep.id,
        kind: input.kind,
        apptId: appointment.id,
        clinicianId: input.clinicianId,
        serviceType,
        modality,
        ...cfAuditIdentities(input.attribution),
      },
    });
    // §Pre-release build 4 — the booking is care-plan data the moment it exists.
    _recomputeCarePlan(ep.patientId, "pre_release_appointment_booked");
    emit();
    return { appointment, carePlanAppointment };
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
    assertCfEntryScope(ep, input.attribution, "reentry_care_plan");
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
    // Care-plan section edits were previously attributed but NOT audited at
    // all — closed here, with the same proxy/direct action split.
    appendAudit({
      category: "clinical",
      action: cfAuditAction("reentry_care_plan_saved", input.attribution),
      patientId: ep.patientId,
      actorId: input.attribution.enteredBy.staffName,
      actorRole: input.attribution.enteredBy.role,
      detail: {
        episodeId: ep.id,
        carePlanId: plan.id,
        status: plan.status,
        // Section shape only — never the member's housing/pharmacy values.
        sections: {
          housing: Boolean(plan.housing.arrangement),
          appointments: plan.appointments.length,
          pharmacy: Boolean(plan.pharmacy),
          dmeNeeds: plan.dmeNeeds.length,
          notesToEcm: Boolean(plan.notesToEcm),
        },
        ...cfAuditIdentities(input.attribution),
      },
    });
    // §Pre-release build 4 — keep the CalAIM plan live with custody-side work.
    _recomputeCarePlan(ep.patientId, "reentry_care_plan");
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
    assertCfEntryScope(ep, input.attribution, "reentry_care_plan_completion");
    if (!input.attested) throw new Error("Member attestation is required.");
    if (input.memberSignatureName.trim().length < 2)
      throw new Error("A typed member signature name is required.");
    if (!plan.housing.arrangement.trim())
      throw new Error("A post-release housing plan is required.");
    const kinds = new Set(plan.appointments.map((a) => a.kind));
    const missingKinds = (
      ["mental_health", "med_management", "sud"] as ReentryAppointmentKind[]
    ).filter((k) => !kinds.has(k));
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
      action: cfAuditAction("reentry_care_plan_completed", input.attribution),
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
        ...cfAuditIdentities(input.attribution),
      },
    });
    // §Pre-release build 4 — keep the CalAIM plan live with custody-side work.
    _recomputeCarePlan(ep.patientId, "reentry_care_plan_completed");
    emit();
    return { plan, enrollmentCode: code };
  },
  listEnrollmentCodes(patientId?: string): EnrollmentCode[] {
    return enrollmentCodes.filter((c) => !patientId || c.patientId === patientId);
  },
  /**
   * §Phase 9a — a sign-in code for a record that has no login (referral
   * enrollment, caseload upload). SAME mechanism as the pre-release code:
   * same format, same 90-day expiry, same single-use redemption through
   * `redeemEnrollmentCode`. If an unused, unexpired code already exists it is
   * returned rather than minting a second live token for the same person.
   */
  issueRecordClaimCode(input: {
    patientId: string;
    actorStaffId: string;
    actorName: string;
    actorRole: string;
  }): EnrollmentCode {
    if (!RECORD_CLAIM_CODE_ROLES.includes(input.actorRole))
      throw new Error("Only reentry care managers and ECM providers can issue sign-in codes.");
    const patient = patients.find((p) => p.id === input.patientId);
    if (!patient) throw new Error("Patient not found.");
    if (patient.signupCredential) throw new Error("This person already has a sign-in.");
    const now = new Date();
    const live = enrollmentCodes.find(
      (c) => c.patientId === patient.id && !c.consumedAt && +new Date(c.expiresAt) >= +now,
    );
    if (live) return live;
    const code: EnrollmentCode = {
      code: generateEnrollmentCode(),
      patientId: patient.id,
      purpose: "record_claim",
      issuedBy: input.actorStaffId,
      issuedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ENROLLMENT_CODE_TTL_DAYS * 86400000).toISOString(),
    };
    enrollmentCodes.unshift(code);
    appendAudit({
      category: "clinical",
      action: "record_claim_code_issued",
      patientId: patient.id,
      actorId: input.actorName,
      actorRole: input.actorRole,
      detail: {
        // Identity token — audit its existence, never its value.
        enrollmentCodeIssued: true,
        enrollmentCodeExpiresAt: code.expiresAt,
        issuedByStaffId: input.actorStaffId,
        origin: patient.referralId ? "referral" : "staff_provisioned",
      },
    });
    emit();
    return code;
  },
  getEnrollmentCode(code: string): EnrollmentCode | undefined {
    return enrollmentCodes.find((c) => c.code === code.trim().toUpperCase());
  },
  /** Validity read. Consumption happens in `redeemEnrollmentCode`. */
  enrollmentCodeStatus(
    code: string,
    at = new Date(),
  ): "valid" | "expired" | "consumed" | "unknown" {
    const rec = AdelanteEHR.getEnrollmentCode(code);
    if (!rec) return "unknown";
    if (rec.consumedAt) return "consumed";
    return +new Date(rec.expiresAt) < +at ? "expired" : "valid";
  },
  /**
   * §Front-door Phase 3 — the one place Track A and self-service sign-up meet.
   *
   * A released member types the `RE-XXXX-XXXX` code their CF Care Manager gave
   * them and CLAIMS the record that already exists for them. This must never
   * create a patient: it attaches the same prototype `signupCredential`
   * metadata the self-service path sets, marks the code consumed (single-use,
   * the `consumedAt`/`consumedBy` fields reserved at issue), and returns the
   * existing patient so the caller can route on its real id.
   *
   * Throws on any non-valid status so the caller can't half-claim; the UI
   * checks `enrollmentCodeStatus` first to show the specific message.
   */
  redeemEnrollmentCode(input: {
    code: string;
    credential: SignupCredentialMeta;
    /**
     * §Front-door Phase 3. Tier 1: unverified helper name, recorded only.
     * Tier 2: the authenticated staff operator doing the claim on the
     * person's behalf — THEIR id is what lands in `consumedBy`, because they
     * are who actually consumed the single-use code.
     */
    assistedBy?: HelperAttribution;
    at?: Date;
  }): { patient: Patient; enrollmentCode: EnrollmentCode } {
    const at = input.at ?? new Date();
    const status = AdelanteEHR.enrollmentCodeStatus(input.code, at);
    if (status !== "valid") throw new Error(`This code is ${status}.`);
    const rec = AdelanteEHR.getEnrollmentCode(input.code)!;
    const patient = patients.find((p) => p.id === rec.patientId);
    if (!patient) throw new Error("The record this code belongs to is no longer available.");
    rec.consumedAt = at.toISOString();
    const operatorId = input.assistedBy?.tier === 2 ? input.assistedBy.operatorStaffId : undefined;
    rec.consumedBy = operatorId ?? patient.id;
    patient.signupCredential = input.credential;
    if (input.assistedBy) patient.signupAssistedBy = input.assistedBy;
    // §Pre-release pipeline — the code already carries `episodeId`, so the
    // person should never be asked for a date their own episode holds. Newly
    // opened episodes fill this at open; this repeats it for records created
    // before that existed, and is fill-if-empty so it cannot clobber a
    // confirmed date.
    const redeemEpisode = preReleaseEpisodes.find((e) => e.id === rec.episodeId);
    const releaseDateCopied = redeemEpisode
      ? _applyEpisodeReleaseDate(
          patient.id,
          redeemEpisode.actualReleaseDate || redeemEpisode.anticipatedReleaseDate,
          redeemEpisode.actualReleaseDate ? "confirmed" : "estimated",
        )
      : false;
    if (redeemEpisode && !patient.custody)
      _setPatientCustody(
        redeemEpisode,
        redeemEpisode.status === "open" ? "in_custody" : "released",
      );

    appendAudit({
      category: "clinical",
      action: operatorId ? "enrollment_code_redeemed_assisted" : "enrollment_code_redeemed",
      patientId: patient.id,
      actorId: operatorId ?? patient.id,
      actorRole: operatorId ? (input.assistedBy?.operatorRole ?? "staff") : "patient",
      detail: {
        episodeId: rec.episodeId,
        carePlanId: rec.carePlanId,
        // The code is an identity token — audit the event, never the value.
        credentialKind: input.credential.kind,
        // Always present: the person the claim was FOR, even when a staff
        // operator is the one recorded in `consumedBy`.
        claimedForPatientId: patient.id,
        releaseDateCopied,
        ...(releaseDateCopied
          ? { releaseDateSource: patient.releaseDateMeta?.confidence }
          : {}),

        ...helperAuditDetail(input.assistedBy),
      },
    });
    emit();
    return { patient, enrollmentCode: rec };
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
    // §Message-routing gap #1 — the /message-queue "nobody is told" gap. Only
    // the FIRST unread message in a thread alerts out of band, so one patient
    // typing several messages does not page the on-call repeatedly.
    const unreadFromPatient = (p.careMessages ?? []).filter(
      (m) => m.authorType === "patient" && !m.readByStaffAt,
    ).length;
    if (unreadFromPatient === 1) {
      dispatchStaffAlert({
        kind: "unread_patient_message",
        recipientRole: "ecm_provider",
        subject: "Adelante: new patient message",
        body: "A patient is waiting on a reply. Open the message queue.",
        linkRoute: "/message-queue",
        patientId,
      });
    }
    emit();
    return msg;
  },
  sendStaffMessage(
    patientId: string,
    staffName: string,
    body: string,
    /** Acting role — recorded for display attribution + audit. */
    role?: StaffRole,
  ): CareMessage | undefined {
    const p = patients.find((x) => x.id === patientId);
    if (!p || !body.trim()) return undefined;
    const msg: CareMessage = {
      id: uid(),
      threadPatientId: patientId,
      authorType: "staff",
      authorName: staffName,
      ...(role ? { authorRole: role } : {}),
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
      detail: { authorType: "staff", messageId: msg.id, authorRole: role ?? null },
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
    const rows: {
      patient: Patient;
      unread: number;
      oldestUnreadAt: string;
      latest: CareMessage;
    }[] = [];
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

  // ---------- §Dashboard Standardization Phase 5c: attributed task edits ----
  /**
   * Edit the small set of task fields a worker legitimately owns. Assignment
   * is deliberately NOT editable here — reassignment is a caseload decision
   * handled by the real assignment path, which writes provider-switch records.
   */
  updateCaseTaskFields(
    id: string,
    patch: { title?: string; detail?: string; dueDate?: string; priority?: TaskPriority },
    staffName: string,
    role: StaffRole,
  ): boolean {
    const t = caseTasks.find((x) => x.id === id);
    if (!t) return false;
    const changed: Record<string, { from: unknown; to: unknown }> = {};
    const apply = <K extends "title" | "detail" | "dueDate" | "priority">(key: K) => {
      const next = patch[key];
      if (next === undefined) return;
      const value = typeof next === "string" ? next.trim() : next;
      if (key !== "priority" && !value) return;
      if (t[key] === value) return;
      changed[key] = { from: t[key], to: value };
      (t as unknown as Record<string, unknown>)[key] = value;
    };
    apply("title");
    apply("detail");
    apply("dueDate");
    apply("priority");
    if (!Object.keys(changed).length) return false;
    t.lastEditedBy = staffName;
    t.lastEditedAt = new Date().toISOString();
    appendAudit({
      category: "clinical",
      action: "case_task_updated",
      patientId: t.patientId,
      actorId: staffName,
      actorRole: role,
      detail: { taskId: t.id, changed },
    });
    emit();
    return true;
  },
  /** Append an attributed working note to a task. */
  addCaseTaskNote(id: string, text: string, staffName: string, role: StaffRole): boolean {
    const t = caseTasks.find((x) => x.id === id);
    const body = text.trim();
    if (!t || !body) return false;
    t.notes = [
      ...(t.notes ?? []),
      { id: uid(), text: body, authorName: staffName, authorRole: role, at: new Date().toISOString() },
    ];
    appendAudit({
      category: "clinical",
      action: "case_task_note_added",
      patientId: t.patientId,
      actorId: staffName,
      actorRole: role,
      detail: { taskId: t.id },
    });
    emit();
    return true;
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
  setWorklistStatus(id: string, next: WorklistStatus, staffName: string, role: StaffRole): boolean {
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
        housingUnit: inCustody ? AdelanteEHR.currentHousingUnit(patientId) : undefined,
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
   * §EHR audit Phase 1c — dry run. Same matching AND the same cadence-window
   * skip logic the real run uses, so the preview cannot drift from the commit:
   * both read `_ruleCadenceBlocked`.
   */
  previewSchedulingRules(): {
    total: number;
    rules: {
      ruleId: string;
      ruleKey: string;
      ruleLabel: string;
      wouldCreate: { patientId: string; patientName: string }[];
      skipped: { patientId: string; patientName: string; reason: "cadence_window" }[];
    }[];
  } {
    const now = Date.now();
    let total = 0;
    const rows = schedulingRules
      .filter((r) => r.active)
      .map((rule) => {
        const wouldCreate: { patientId: string; patientName: string }[] = [];
        const skipped: { patientId: string; patientName: string; reason: "cadence_window" }[] = [];
        for (const p of AdelanteEHR.patientsMatchingRule(rule)) {
          const name = `${p.firstName} ${p.lastName}`.trim();
          if (_ruleCadenceBlocked(rule, p.id, now))
            skipped.push({ patientId: p.id, patientName: name, reason: "cadence_window" });
          else wouldCreate.push({ patientId: p.id, patientName: name });
        }
        total += wouldCreate.length;
        return {
          ruleId: rule.id,
          ruleKey: rule.key,
          ruleLabel: rule.label,
          wouldCreate,
          skipped,
        };
      });
    return { total, rules: rows };
  },

  /**
   * Manually triggered run. For each active rule, each matching patient gets
   * ONE task per cadence window: the run skips a patient when a task with this
   * `sourceRuleId` was created within `cadenceMinutes` — regardless of whether
   * that task is still open, completed, or cancelled. Checking only open tasks
   * would re-spam the moment the first one is worked.
   *
   * §EHR audit Phase 1c — execution is gated by the SAME class that authors the
   * rules (`scheduling_rules` write), not by a second, parallel rule.
   */
  runSchedulingRulesNow(
    staffName: string,
    role?: StaffRole,
  ): { runId: string; total: number; results: { ruleKey: string; tasksCreated: number }[] } {
    if (role && canAccess(role, "scheduling_rules").level !== "write")
      throw new Error("Your role can't run scheduling rules.");
    const now = Date.now();
    const runId = `srun_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const results: { ruleKey: string; tasksCreated: number }[] = [];
    let total = 0;

    for (const rule of schedulingRules.filter((r) => r.active)) {
      let created = 0;
      for (const p of AdelanteEHR.patientsMatchingRule(rule)) {
        if (_ruleCadenceBlocked(rule, p.id, now)) continue;
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
        if (!made) continue;
        created++;
        // Per-task execution log — one auditable row per generated task.
        appendAudit({
          category: "clinical",
          action: "scheduling_rule_task_created",
          actorId: staffName,
          actorRole: role,
          patientId: p.id,
          detail: {
            runId,
            ruleId: rule.id,
            ruleKey: rule.key,
            taskId: made.id,
            taskType: rule.taskType,
            priority: rule.priority,
          },
        });
      }
      results.push({ ruleKey: rule.key, tasksCreated: created });
      total += created;
    }

    appendAudit({
      category: "clinical",
      action: "scheduling_rules_run",
      actorId: staffName,
      actorRole: role,
      detail: { runId, total, results },
    });
    emit();
    return { runId, total, results };
  },

  /** §EHR audit Phase 1c — run history, reconstructed from the audit trail. */
  listSchedulingRuleRuns(limit = 20): {
    runId: string;
    at: string;
    actorId?: string;
    actorRole?: StaffRole;
    total: number;
    results: { ruleKey: string; tasksCreated: number }[];
    tasks: { ruleKey: string; taskId: string; patientId: string }[];
  }[] {
    const events = AdelanteEHR.listAuditEvents({});
    const perTask = events.filter((e) => e.action === "scheduling_rule_task_created");
    return events
      .filter((e) => e.action === "scheduling_rules_run")
      .map((e) => {
        const d = (e.detail ?? {}) as {
          runId?: string;
          total?: number;
          results?: { ruleKey: string; tasksCreated: number }[];
        };
        const runId = d.runId ?? e.id;
        return {
          runId,
          at: e.at,
          actorId: e.actorId,
          actorRole: e.actorRole as StaffRole | undefined,
          total: d.total ?? 0,
          results: d.results ?? [],
          tasks: perTask
            .filter((t) => (t.detail as { runId?: string })?.runId === runId)
            .map((t) => {
              const td = t.detail as { ruleKey?: string; taskId?: string };
              return {
                ruleKey: td?.ruleKey ?? "",
                taskId: td?.taskId ?? "",
                patientId: t.patientId ?? "",
              };
            }),
        };
      })
      .sort((a, b) => +new Date(b.at) - +new Date(a.at))
      .slice(0, limit);
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
  /** §Phase 7c — audit row for rate/code-table/claim-pricing changes. */
  /** §Phase 7d — raw write; the billing-write check lives in ehr-ext. */
  _setPaymentArrangement(
    patientId: string,
    value: "self_pay" | "sliding_fee" | "grant_isl",
    setBy?: { id: string; name: string; role: string; at: string },
  ) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return false;
    p.paymentArrangement = value;
    if (setBy) p.paymentArrangementSetBy = setBy;
    // §Phase 8b — the intake prompt is done once billing decides.
    for (const t of caseTasks) {
      if (t.dedupeKey === `payment-arrangement:${patientId}` && t.status !== "done") {
        t.status = "done";
        t.completedAt = new Date().toISOString();
        t.worklistStatus = "completed";
      }
    }
    emit();
    return true;
  },
  recordBillingAudit(input: {
    action: string;
    actorId: string;
    actorRole: string;
    patientId?: string;
    detail: Record<string, unknown>;
  }) {
    appendAudit({
      category: "clinical",
      action: input.action,
      actorId: input.actorId,
      actorRole: input.actorRole,
      ...(input.patientId ? { patientId: input.patientId } : {}),
      detail: input.detail,
    });
    emit();
  },
  /** §Phase 7b — audit row for every claim status move (billing or note signature). */
  recordClaimStatusChange(input: {
    claimId: string;
    patientId: string;
    from: string;
    to: string;
    actorId: string;
    actorRole: string;
    actorName?: string;
    via: "billing" | "note_signature" | "seed_data";
    reason?: string;
    /** §Phase 7b.1 — the signature this move rests on. */
    signature?: Record<string, unknown>;
    seed?: boolean;
  }) {
    appendAudit({
      category: "clinical",
      action: "claim_status_changed",
      patientId: input.patientId,
      actorId: input.actorId,
      actorRole: input.actorRole,
      detail: {
        claimId: input.claimId,
        from: input.from,
        to: input.to,
        via: input.via,
        ...(input.actorName ? { actorName: input.actorName } : {}),
        ...(input.reason ? { reason: input.reason } : {}),
        ...(input.signature ? input.signature : {}),
        ...(input.seed ? { seed: true } : {}),
      },
    });
    emit();
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
      const claimCents = _claimBridge?.chargeFor(a.id);
      const charge = claimCents === undefined ? "" : (claimCents / 100).toFixed(2);
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
        _claimBridge?.bucketFor(a.id) ?? "no_claim",
        charge,
      ]
        .map((v) => String(v).replace(/,/g, ";"))
        .join(",");
    });
    return [header, ...lines].join("\n");
  },
  /**
   * §EHR audit Phase 2a — single source of truth for licence expiry.
   *
   * `Clinician.licenseExpiresOn` is what `canBook` enforces, but the document
   * a human actually looks at is the `license` credential in ehr-ext. Those
   * were two independent dates that could disagree. They are now reconciled in
   * one direction: the credential DOCUMENT is authoritative and writes this
   * field, which `canBook` continues to read. Nothing else writes it.
   */
  setClinicianLicenseExpiry(clinicianId: string, expiresOn: string | undefined) {
    const c = clinicians.find((x) => x.id === clinicianId);
    if (!c) return;
    if (c.licenseExpiresOn === expiresOn) return;
    if (expiresOn) c.licenseExpiresOn = expiresOn;
    else delete c.licenseExpiresOn;
    emit();
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
   * Designation — by the patient, or by the CF Care Manager / ECM Provider /
   * Administrator on the patient's behalf. The code is returned to
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
    /**
     * The instrument the inviter expects. Drives which documentation
     * requirements the claimant is shown; grants nothing on its own.
     */
    expectedAuthorizationType?: AdvocateAuthorizationType;
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
      // PROVISIONAL until delivery is confirmed. The real window starts on
      // notification receipt — see `recordAdvocateInvitationDelivery`.
      invitationExpiresAt: new Date(Date.now() + days * 86400_000).toISOString(),
      invitationWindowDays: days,
      ...(input.expectedAuthorizationType
        ? {
            expectedAuthorizationType: input.expectedAuthorizationType,
            documentRequirements: _advocateRequirementRows(input.expectedAuthorizationType),
          }
        : {}),
      designatedBy: input.designatedBy,
      designatedAt: new Date().toISOString(),
      status: "invited",
    };
    link.claimLink = _advocateClaimLink(link);
    advocateLinks.unshift(link);
    // §Audit fix — code GENERATION is now a real, recorded event. The code
    // itself still never enters the audit log (hard invariant); a short
    // non-reversible fingerprint is written instead so a specific code can be
    // tied to its generation event during an investigation.
    appendAudit({
      category: "advocate",
      action: "advocate_invite_code_generated",
      patientId: link.patientId,
      actorRole: link.designatedBy.actor,
      actorId: link.designatedBy.name,
      detail: {
        advocateLinkId: link.id,
        codeFingerprint: _advocateCodeFingerprint(link.invitationCode),
        windowDays: days,
        windowStartsOn: "notification_delivery",
        ...(input.expectedAuthorizationType
          ? { expectedAuthorizationType: input.expectedAuthorizationType }
          : {}),
      },
    });
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

  // ---------------------------------------------------------------------
  // §Advocate build 1 — delivery + consent-documentation trail.
  // ---------------------------------------------------------------------

  /**
   * Record the outcome of an invitation send and START the 14-day window.
   *
   * The window is deliberately based on the notification event rather than on
   * row creation: an invitation the advocate never received should not be
   * burning its own clock. Today the practical trigger is the transport's
   * send confirmation.
   *
   * TODO(transport): move this call site to a real delivery-confirmation
   * webhook (Twilio status callback / email delivery event) once actual
   * transport exists. `status: "sent"` is currently the strongest signal
   * available and is treated as receipt.
   */
  recordAdvocateInvitationDelivery(
    linkId: string,
    result: { status: "sent" | "not_configured" | "failed"; detail?: string },
  ): AdvocateLink | undefined {
    const link = advocateLinks.find((l) => l.id === linkId);
    if (!link) return undefined;
    const at = new Date().toISOString();
    link.notificationDelivery = {
      status: result.status,
      at,
      ...(result.detail ? { detail: result.detail } : {}),
    };
    if (result.status === "sent" && link.status === "invited") {
      link.notificationSentAt = at;
      link.invitationExpiresAt = new Date(
        +new Date(at) + link.invitationWindowDays * 86400_000,
      ).toISOString();
    }
    appendAudit({
      category: "advocate",
      action: "advocate_invitation_delivery",
      patientId: link.patientId,
      actorRole: "system",
      detail: {
        advocateLinkId: link.id,
        channel: link.invitationChannel,
        deliveryStatus: result.status,
        ...(result.detail ? { deliveryDetail: result.detail } : {}),
        expiresAt: link.invitationExpiresAt,
        windowStarted: result.status === "sent",
      },
    });
    emit();
    return { ...link };
  },

  advocateDocumentRequirements(linkId: string): AdvocateDocRequirementState[] {
    const link = advocateLinks.find((l) => l.id === linkId);
    return (link?.documentRequirements ?? []).map((r) => ({ ...r }));
  },

  /**
   * Staff (re)request a specific missing consent document from an advocate
   * who is already connected — closing a paperwork gap without forcing a new
   * invitation cycle. The advocate keeps their existing claim and link.
   */
  requestAdvocateDocument(input: {
    linkId: string;
    key: AdvocateDocRequirementKey;
    requestedBy: string;
  }): AdvocateLink {
    const link = advocateLinks.find((l) => l.id === input.linkId);
    if (!link) throw new Error("Unknown advocate connection.");
    if (_effectiveAdvocateStatus(link) === "revoked")
      throw new Error("That connection has been removed.");
    link.documentRequirements ??= link.authorizationType
      ? _advocateRequirementRows(link.authorizationType)
      : [];
    let row = link.documentRequirements.find((r) => r.key === input.key);
    if (!row) {
      // Staff can request a document outside the type's default set — e.g. a
      // collateral ROI for a family member who claimed as HIPAA-only.
      row = { key: input.key, status: "pending" };
      link.documentRequirements.push(row);
    }
    row.requestedAt = new Date().toISOString();
    row.requestedBy = input.requestedBy;
    row.requestCount = (row.requestCount ?? 0) + 1;
    // A re-request reopens an attestation that was never verified: the point
    // of asking again is that the real document is still not on file.
    if (row.status === "attested") row.status = "pending";
    appendAudit({
      category: "advocate",
      action: "advocate_document_requested",
      patientId: link.patientId,
      actorId: input.requestedBy,
      detail: {
        advocateLinkId: link.id,
        requirement: input.key,
        requirementLabel: ADVOCATE_DOC_REQUIREMENTS[input.key].label,
        sentTo: link.invitationSentTo,
        requestCount: row.requestCount,
      },
    });
    emit();
    return { ...link };
  },

  /** The advocate's own confirmation. Staff-only rows are refused. */
  attestAdvocateDocumentRequirement(input: {
    linkId: string;
    key: AdvocateDocRequirementKey;
    attestedName: string;
  }): AdvocateLink {
    const link = advocateLinks.find((l) => l.id === input.linkId);
    if (!link) throw new Error("Unknown advocate connection.");
    if (ADVOCATE_DOC_REQUIREMENTS[input.key].staffOnly)
      throw new Error("That step is recorded by staff, not by the advocate.");
    const name = input.attestedName.trim();
    if (!name) throw new Error("Type your full name to confirm.");
    link.documentRequirements ??= [];
    let row = link.documentRequirements.find((r) => r.key === input.key);
    if (!row) {
      row = { key: input.key, status: "pending" };
      link.documentRequirements.push(row);
    }
    if (row.status === "verified") return { ...link };
    row.status = "attested";
    row.attestedAt = new Date().toISOString();
    row.attestedName = name;
    appendAudit({
      category: "advocate",
      action: "advocate_document_attested",
      patientId: link.patientId,
      actorRole: "advocate",
      actorId: link.id,
      detail: { advocateLinkId: link.id, requirement: input.key, attestedName: name },
    });
    emit();
    return { ...link };
  },

  /** Staff confirm the real document is on file. */
  verifyAdvocateDocumentRequirement(input: {
    linkId: string;
    key: AdvocateDocRequirementKey;
    verifiedBy: string;
    verificationRef?: string;
  }): AdvocateLink {
    const link = advocateLinks.find((l) => l.id === input.linkId);
    if (!link) throw new Error("Unknown advocate connection.");
    link.documentRequirements ??= [];
    let row = link.documentRequirements.find((r) => r.key === input.key);
    if (!row) {
      row = { key: input.key, status: "pending" };
      link.documentRequirements.push(row);
    }
    row.status = "verified";
    row.verifiedAt = new Date().toISOString();
    row.verifiedBy = input.verifiedBy;
    if (input.verificationRef?.trim()) row.verificationRef = input.verificationRef.trim();
    appendAudit({
      category: "advocate",
      action: "advocate_document_verified",
      patientId: link.patientId,
      actorId: input.verifiedBy,
      detail: {
        advocateLinkId: link.id,
        requirement: input.key,
        ...(row.verificationRef ? { verificationRef: row.verificationRef } : {}),
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
    /**
     * Requirement keys the advocate ticked at claim time. Staff-only rows are
     * ignored — the advocate cannot self-attest a clinician determination or
     * a certified court order.
     */
    attestedRequirements?: AdvocateDocRequirementKey[];
    /**
     * The patient record the claimer is currently signed in as, when there is
     * a live patient session. Passed explicitly rather than read off the
     * module-level demo session: "who is claiming" is a property of the
     * caller's session, not of store state.
     */
    actingPatientId?: string;
  }): AdvocateLink {
    const typed = input.code.trim().toUpperCase();
    // REAL path first, always: an exact code match resolves normally.
    let found = advocateLinks.find((x) => x.invitationCode === typed);
    let demoBypass = false;
    if (!found && typed && isAdvocateDemoClaimEnabled()) {
      // §TEMPORARY demo affordance — see `advocateDemo.ts` for the safety
      // properties. No transport exists yet, so a reviewer cannot receive a
      // real code. This resolves to an EXISTING open invitation only; it
      // never creates a link and never searches by patient identity.
      found = advocateLinks.find(
        (x) => _effectiveAdvocateStatus(x) === "invited" && !x.claimedAt,
      );
      demoBypass = Boolean(found);
    }
    if (!found) throw new Error("That invitation code isn't valid.");
    // §Product decision — an advocate connection is always to SOMEONE ELSE's
    // record. If the claimer is signed in AS the person this invitation was
    // written for, the claim is self-referential: it would open a second
    // access path to your own record with a different (weaker, schedule-only)
    // permission shape and a misleading "advocate" actor in the audit trail.
    // Block it loudly rather than letting it succeed silently.
    if (input.actingPatientId && found.patientId === input.actingPatientId) {
      throw new Error(
        "This invitation is for the record you're already signed in to. You can't be your own advocate — sign out of that person's account first if you're claiming this for someone else.",
      );
    }
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
    // The confirmed instrument governs the paperwork, not the inviter's
    // expectation: re-seed the rows if the advocate confirmed a different type.
    if (
      !found.documentRequirements ||
      found.expectedAuthorizationType !== input.authorizationType
    ) {
      found.documentRequirements = _advocateRequirementRows(input.authorizationType);
    }
    for (const key of input.attestedRequirements ?? []) {
      const row = found.documentRequirements.find((r) => r.key === key);
      if (!row || ADVOCATE_DOC_REQUIREMENTS[key].staffOnly) continue;
      row.status = "attested";
      row.attestedAt = found.authorizationConfirmedAt;
      row.attestedName = attested;
    }
    // §Phase 4.2 (6.5) — an AHCD claim opens the frontline validation
    // checklist as REAL worklist rows, reusing the pre-release CaseTask
    // pattern rather than inventing a second task mechanism.
    if (found.authorizationType === "ahcd") _openAhcdValidationTasks(found);
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
        attestedRequirements: (found.documentRequirements ?? [])
          .filter((r) => r.status === "attested")
          .map((r) => r.key),
        // A demo-bypassed claim is always distinguishable in the trail.
        ...(demoBypass ? { demoBypass: true } : {}),
      },
    });
    emit();
    return { ...found };
  },

  /**
   * §Phase 4.2 (6.5) — record one frontline validation finding. Each item is
   * independently trackable and closes its own worklist task; there is no
   * single "verified" flag. Item 4 (the incapacity determination) is NOT
   * recorded here — it is the activation itself, so `recordAhcdChecklistItem`
   * refuses it and the caller must go through `activateAdvocateAhcd`.
   */
  recordAhcdChecklistItem(
    linkId: string,
    input: {
      item: AhcdChecklistItemKey;
      outcome: AhcdChecklistOutcome;
      note?: string;
      reviewedBy: string;
    },
  ): AdvocateLink {
    const link = advocateLinks.find((l) => l.id === linkId);
    if (!link) throw new Error("Unknown advocate connection.");
    if (link.authorizationType !== "ahcd")
      throw new Error("The validation checklist only applies to an AHCD connection.");
    if (input.item === "incapacity_determination")
      throw new Error(
        "The incapacity determination is recorded by activating the directive, not by checking a box.",
      );
    const def = AHCD_CHECKLIST_ITEMS.find((i) => i.key === input.item);
    if (!def) throw new Error("Unknown checklist item.");
    if (input.outcome === "unclear" && input.item !== "part2_scope")
      throw new Error("Only the Part 2 scope check can be left unclear.");
    const who = input.reviewedBy.trim();
    if (!who) throw new Error("The reviewer must be named.");
    link.ahcdValidation = {
      ...(link.ahcdValidation ?? {}),
      [input.item]: {
        outcome: input.outcome,
        checkedAt: new Date().toISOString(),
        checkedBy: who,
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      },
    };
    // A failed item invalidates an already-active directive: the authority it
    // rests on turned out not to be valid.
    if (input.outcome === "failed" && _ahcdEffective(link).active) {
      AdelanteEHR.deactivateAdvocateAhcd(link.id, {
        deactivatedBy: who,
        reason: `Validation check failed: ${def.label}.`,
      });
    }
    const task = caseTasks.find((t) => t.dedupeKey === _ahcdTaskKey(link.id, input.item));
    if (task && input.outcome !== "pending") {
      task.status = "done";
      task.completedAt = new Date().toISOString();
    }
    appendAudit({
      category: "advocate",
      action: "advocate_ahcd_validation_recorded",
      patientId: link.patientId,
      actorId: who,
      detail: {
        advocateLinkId: link.id,
        advocateName: link.advocateName,
        item: input.item,
        itemLabel: def.label,
        outcome: input.outcome,
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      },
    });
    emit();
    return { ...link };
  },

  /**
   * The Part 2 axis for one connection, as a readable result: whether SUD
   * content is unmasked, under which mode, and on what basis (patient consent
   * vs the advocate's own legal authority). Single evaluation point, so the
   * UI and the audit trail cannot drift from what the gate actually decided.
   */
  advocatePart2Access(linkId: string) {
    const link = advocateLinks.find((l) => l.id === linkId);
    if (!link)
      return { unmasked: false, mode: "categorically_barred" as const, basis: "none" as const };
    const g = _advocatePart2Gates(link);
    return { unmasked: g.unmasked, mode: g.sudMode, basis: g.sudBasis };
  },

  /** Read the checklist plus whether activation is unblocked. */
  ahcdValidationState(linkId: string) {
    const link = advocateLinks.find((l) => l.id === linkId);
    if (!link) throw new Error("Unknown advocate connection.");
    const state = link.ahcdValidation ?? {};
    return {
      items: AHCD_CHECKLIST_ITEMS.map((i) => ({ ...i, finding: state[i.key] })),
      readiness: ahcdActivationReadiness(state),
      activation: link.ahcdActivation,
      active: _ahcdEffective(link).active,
      part2ScopeUnclear: ahcdPart2ScopeUnclear(state),
    };
  },

  /**
   * §Phase 4.2 (6.4) — AHCD activation. A clinical incapacity determination,
   * not a flag. Three real preconditions, all enforced here:
   *   1. the recorder holds a clinical role that may determine capacity
   *      (`AHCD_DETERMINATION_ROLES`) — a CF Care Manager, peer or admin
   *      cannot do it, and the advocate certainly cannot;
   *   2. the frontline validation checklist (6.5) has cleared identity, agent
   *      identity and § 4701 execution validity, and the Part 2 scope question
   *      has been answered one way or the other;
   *   3. a stated basis for the determination.
   * A `reviewByDate` makes the determination TEMPORARY: it lapses on that date
   * and the link returns to dormant with no further action.
   */
  activateAdvocateAhcd(
    linkId: string,
    input: {
      determinedBy: string;
      determinedByRole: string;
      basis: string;
      /** YYYY-MM-DD. Present ⇒ temporary determination. */
      reviewByDate?: string;
    },
  ): AdvocateLink {
    const link = advocateLinks.find((l) => l.id === linkId);
    if (!link) throw new Error("Unknown advocate connection.");
    if (link.authorizationType !== "ahcd")
      throw new Error("Only an AHCD connection can be activated this way.");
    const who = input.determinedBy.trim();
    if (!who) throw new Error("The determining clinician must be named.");
    if (!isAhcdDeterminationRole(input.determinedByRole))
      throw new Error(
        "Only a PMHNP or licensed therapist may record an incapacity determination. This is a clinical act and cannot be recorded by the staff member working the validation checklist.",
      );
    const basis = input.basis.trim();
    if (!basis) throw new Error("The basis for the incapacity determination is required.");
    const readiness = ahcdActivationReadiness(link.ahcdValidation ?? {});
    if (!readiness.ready)
      throw new Error(readiness.reason ?? "The AHCD validation checklist is not complete.");
    const reviewByDate = input.reviewByDate?.trim();
    if (reviewByDate && reviewByDate < new Date().toISOString().slice(0, 10))
      throw new Error("A review date must be in the future.");
    const now = new Date().toISOString();
    link.ahcdActivation = {
      state: "clinically_active",
      determinedAt: now,
      determinedBy: who,
      determinedByRole: input.determinedByRole as AhcdDeterminationRole,
      basis,
      temporary: Boolean(reviewByDate),
      ...(reviewByDate ? { reviewByDate } : {}),
    };
    link.ahcdActivatedAt = now;
    link.ahcdActivatedBy = who;
    appendAudit({
      category: "advocate",
      action: "advocate_ahcd_activated",
      patientId: link.patientId,
      actorId: who,
      actorRole: input.determinedByRole,
      detail: {
        advocateLinkId: link.id,
        advocateName: link.advocateName,
        state: "dormant -> clinically_active",
        basis,
        temporary: Boolean(reviewByDate),
        ...(reviewByDate ? { reviewByDate } : {}),
        part2ScopeCoveredByDirective: !ahcdPart2ScopeUnclear(link.ahcdValidation ?? {}),
      },
    });
    emit();
    return { ...link };
  },

  /**
   * Return an active directive to dormant — a capacity re-determination, a
   * documentation problem, or the review date lapsing (see `_ahcdEffective`).
   */
  deactivateAdvocateAhcd(
    linkId: string,
    input: { deactivatedBy: string; reason: string; expired?: boolean },
  ): AdvocateLink {
    const link = advocateLinks.find((l) => l.id === linkId);
    if (!link?.ahcdActivation) throw new Error("This directive is not active.");
    const why = input.reason.trim();
    if (!why) throw new Error("A reason is required to deactivate a directive.");
    link.ahcdActivation = {
      ...link.ahcdActivation,
      state: input.expired ? "expired" : "dormant",
      deactivatedAt: new Date().toISOString(),
      deactivatedBy: input.deactivatedBy,
      deactivatedReason: why,
    };
    delete link.ahcdActivatedAt;
    delete link.ahcdActivatedBy;
    appendAudit({
      category: "advocate",
      action: "advocate_ahcd_deactivated",
      patientId: link.patientId,
      actorId: input.deactivatedBy,
      detail: {
        advocateLinkId: link.id,
        advocateName: link.advocateName,
        state: `clinically_active -> ${input.expired ? "expired" : "dormant"}`,
        reason: why,
      },
    });
    emit();
    return { ...link };
  },

  /**
   * §Phase 4.1 — record that certified conservatorship court documents were
   * verified. This is the precondition for ANY conservator-tier access; until
   * it exists the link is claimed but inert.
   */
  recordAdvocateConservatorshipDocs(
    linkId: string,
    input: { verifiedBy: string; courtOrderRef: string; documentId?: string },
  ): AdvocateLink {
    const link = advocateLinks.find((l) => l.id === linkId);
    if (!link) throw new Error("Unknown advocate connection.");
    if (link.authorizationType !== "conservatorship")
      throw new Error("Only a conservatorship connection can record court documents.");
    const who = input.verifiedBy.trim();
    const ref = input.courtOrderRef.trim();
    if (!who) throw new Error("The verifying staff member must be named.");
    if (!ref) throw new Error("A court order reference is required.");
    link.conservatorshipDocs = {
      verifiedAt: new Date().toISOString(),
      verifiedBy: who,
      courtOrderRef: ref,
      ...(input.documentId ? { documentId: input.documentId } : {}),
    };
    appendAudit({
      category: "advocate",
      action: "advocate_conservatorship_docs_verified",
      patientId: link.patientId,
      actorId: who,
      detail: { advocateLinkId: link.id, advocateName: link.advocateName, courtOrderRef: ref },
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
      // §Phase 4.2 — live: an expired temporary determination is NOT activation.
      ahcdActivated: _ahcdEffective(link).active,
      ahcdDeterminationExpired: _ahcdEffective(link).expired,
      conservatorshipDocsOnFile: Boolean(link.conservatorshipDocs),
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
    /**
     * §Group D item 4 — TRUE when the consent-conditional Part 2 exception is
     * in force for this read, so the UI can say WHY SUD detail is visible.
     * Computed in the data layer with the labels it applies to; the UI cannot
     * derive or override it.
     */
    part2Disclosed: boolean;
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
      return { allowed: false, reason: decision.reason, part2Disclosed: false, items: [] };
    }

    const from = +now;
    const items: ReturnType<typeof AdelanteEHR.advocateSchedule>["items"] = [];
    // Consent-conditional Part 2 exception. Default is masked; this is the
    // only thing that lifts it, and it is re-evaluated on every read.
    const gates = _advocatePart2Gates(link);
    const part2Ok = gates.unmasked;

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
          // Only SUD-track topics are Part 2 content; skills-education and
          // open psychoeducational topics are shown.
          label: g.category !== "sud_clinical_preauth" || part2Ok ? g.topic : "Group session",
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
        // §Group D item 7 — WHICH of the two required gates passed.
        advocateLinkValid: gates.linkValid,
        sudDisclosureConsentActive: gates.sudDisclosureConsentActive,
      },
    });
    return { allowed: true, reason: decision.reason, part2Disclosed: part2Ok, items };
  },

  /**
   * §Advocate Build 2 item 1 — the identity banner's ONLY source.
   *
   * Deliberately NOT "does a link row exist". The name of the person an
   * advocate is connected to is itself a disclosure, so it is released on the
   * SAME live decision that guards every other advocate read
   * (`advocateAccess` → `advocateAccessDecision`). An AHCD link whose
   * determination has not been activated by a clinician, a family_participation
   * link with no active ROI, a revoked/expired/unclaimed link and a link whose
   * authorization type was never confirmed all return `allowed: false` and NO
   * name — the UI shows "access pending verification" instead. Only the first
   * name is ever returned; a full name plus a program affiliation is more
   * identifying than the banner needs.
   */
  advocatePatientIdentity(linkId: string): {
    allowed: boolean;
    firstName?: string;
    reason: string;
    denyReason?: AdvocateAccessDecision["denyReason"];
  } {
    const link = advocateLinks.find((l) => l.id === linkId);
    if (!link) return { allowed: false, reason: "This connection no longer exists." };
    const decision = AdelanteEHR.advocateAccess(linkId);
    if (!decision.allowed) {
      return {
        allowed: false,
        reason: decision.reason,
        ...(decision.denyReason ? { denyReason: decision.denyReason } : {}),
      };
    }
    const p = _patient(link.patientId);
    return { allowed: true, reason: decision.reason, ...(p ? { firstName: p.firstName } : {}) };
  },

  // ----- §Advocate build 3 — "what you need next" + gated messaging -----

  /**
   * Everything still standing between this advocate and effective access, read
   * from the REAL Build 1 requirement rows plus the live access decision. No
   * parallel tracking: `advocateDocumentRequirements` is the source of truth
   * for paperwork, `advocateAccess` for whether anything is outstanding at all.
   */
  advocateOutstandingRequirements(linkId: string): {
    accessAllowed: boolean;
    accessReason: string;
    items: {
      key: AdvocateDocRequirementKey;
      status: AdvocateDocRequirementStatus;
      /** TRUE when only staff/clinician action can move this row forward. */
      staffAction: boolean;
      requestedAt?: string;
      nudgedAt?: string;
    }[];
  } {
    const decision = AdelanteEHR.advocateAccess(linkId);
    const rows = AdelanteEHR.advocateDocumentRequirements(linkId);
    return {
      accessAllowed: decision.allowed,
      accessReason: decision.reason,
      items: rows
        .filter((r) => r.status !== "verified")
        .map((r) => ({
          key: r.key,
          status: r.status,
          // Two ways a row is staff-actionable: the requirement is staff-only
          // by definition (clinician activation, certified court order), or
          // the advocate has already attested and is waiting on verification.
          staffAction: Boolean(ADVOCATE_DOC_REQUIREMENTS[r.key].staffOnly) || r.status === "attested",
          ...(r.requestedAt ? { requestedAt: r.requestedAt } : {}),
          ...(r.nudgedAt ? { nudgedAt: r.nudgedAt } : {}),
        })),
    };
  },

  /**
   * "I'm still waiting on you." Allowed ONLY for rows the advocate cannot move
   * themselves, carries no free text, and is rate-limited to once per 24h per
   * row — so it is a status ping, not a message channel (messaging has its own
   * gate, below).
   */
  advocateNudgeCareTeam(input: { linkId: string; key: AdvocateDocRequirementKey }): {
    sent: boolean;
    reason: string;
  } {
    const link = advocateLinks.find((l) => l.id === input.linkId);
    if (!link) return { sent: false, reason: "This connection no longer exists." };
    if (_effectiveAdvocateStatus(link) === "revoked")
      return { sent: false, reason: "That connection has been removed." };
    const row = (link.documentRequirements ?? []).find((r) => r.key === input.key);
    if (!row || row.status === "verified")
      return { sent: false, reason: "Nothing is outstanding on that item." };
    const staffAction =
      Boolean(ADVOCATE_DOC_REQUIREMENTS[input.key].staffOnly) || row.status === "attested";
    if (!staffAction)
      return { sent: false, reason: "This one is yours to complete — nobody is waiting on us." };
    const now = new Date();
    if (row.nudgedAt && now.getTime() - new Date(row.nudgedAt).getTime() < 24 * 60 * 60 * 1000)
      return { sent: false, reason: "You've already let the care team know today." };
    row.nudgedAt = now.toISOString();
    row.nudgeCount = (row.nudgeCount ?? 0) + 1;
    AdelanteEHR.notify({
      recipientRole: "ecm_provider",
      category: "task_assigned",
      subject: `Advocate waiting — ${patientLabel(link.patientId)}`,
      body: `${link.advocateName} is waiting on: ${ADVOCATE_DOC_REQUIREMENTS[input.key].label}.`,
      linkRoute: "/record/$patientId",
      linkParams: { patientId: link.patientId, section: "advocates" },
      patientId: link.patientId,
    });
    appendAudit({
      category: "advocate",
      action: "advocate_document_nudge",
      patientId: link.patientId,
      actorRole: "advocate",
      actorId: link.id,
      detail: {
        advocateLinkId: link.id,
        requirement: input.key,
        nudgeCount: row.nudgeCount,
      },
    });
    emit();
    return { sent: true, reason: "The care team has been told you're waiting." };
  },

  /** The communication-rights axis. Independent of tier and of Part 2. */
  advocateCommunicationRights(linkId: string): AdvocateCommunicationRightsDecision {
    const decision = AdelanteEHR.advocateAccess(linkId);
    return advocateCommunicationRightsDecision({
      accessAllowed: decision.allowed,
      accessReason: decision.reason,
      rows: AdelanteEHR.advocateDocumentRequirements(linkId).map((r) => ({
        key: r.key,
        status: r.status,
      })),
    });
  },

  /**
   * The patient's care-team thread, as an advocate may see it. Same store, same
   * rows as the patient and staff surfaces — no parallel thread.
   *
   * Part 2 masking is applied HERE, in the data layer, from
   * `_advocatePart2Gates` — the identical evaluation the schedule and document
   * reads use — so a UI bug cannot unmask anything, and communication rights
   * have no bearing on it.
   */
  advocateCareMessages(linkId: string): {
    allowed: boolean;
    reason: string;
    reviewPending: boolean;
    part2Disclosed: boolean;
    messages: (CareMessage & { bodyMasked: boolean })[];
  } {
    const link = advocateLinks.find((l) => l.id === linkId);
    const rights = AdelanteEHR.advocateCommunicationRights(linkId);
    const gates = link ? _advocatePart2Gates(link) : { unmasked: false };
    if (!link || !rights.granted)
      return {
        allowed: false,
        reason: link ? rights.reason : "This connection no longer exists.",
        reviewPending: ADVOCATE_MESSAGING_REVIEW.pending,
        part2Disclosed: false,
        messages: [],
      };
    const messages = AdelanteEHR.listCareMessages(link.patientId).map((m) => ({
      ...m,
      body: visibleAdvocateMessageBody(m, gates.unmasked),
      bodyMasked: isAdvocateMessageBodyMasked(m, gates.unmasked),
    }));
    appendAudit({
      category: "access",
      action: "advocate_messages_viewed",
      patientId: link.patientId,
      actorRole: "advocate",
      actorId: link.id,
      detail: {
        advocateLinkId: link.id,
        count: messages.length,
        masked: messages.filter((m) => m.bodyMasked).length,
        part2Disclosed: gates.unmasked,
      },
    });
    return {
      allowed: true,
      reason: rights.reason,
      reviewPending: ADVOCATE_MESSAGING_REVIEW.pending,
      part2Disclosed: gates.unmasked,
      messages,
    };
  },

  /**
   * Advocate-authored message into the patient's care-team thread.
   *
   * THE REVIEW GATE IS ENFORCED HERE, not only in the UI: while
   * `ADVOCATE_MESSAGING_REVIEW.pending` is true the write is refused for every
   * real caller. `allowPendingReview` exists solely so the built feature stays
   * testable in isolation (tests, demo harness) before sign-off; no product
   * code path passes it.
   */
  advocateSendMessage(
    linkId: string,
    body: string,
    opts?: { allowPendingReview?: boolean },
  ): { sent: boolean; reason: string; message?: CareMessage } {
    const link = advocateLinks.find((l) => l.id === linkId);
    if (!link) return { sent: false, reason: "This connection no longer exists." };
    if (ADVOCATE_MESSAGING_REVIEW.pending && !opts?.allowPendingReview)
      return { sent: false, reason: ADVOCATE_MESSAGING_REVIEW.notice };
    const rights = AdelanteEHR.advocateCommunicationRights(linkId);
    if (!rights.granted) return { sent: false, reason: rights.reason };
    if (!body.trim()) return { sent: false, reason: "Nothing to send." };
    const p = _patient(link.patientId);
    if (!p) return { sent: false, reason: "This connection no longer exists." };
    const msg: CareMessage = {
      id: uid(),
      threadPatientId: link.patientId,
      authorType: "advocate",
      authorName: link.advocateName,
      authorAdvocateLinkId: link.id,
      // Verbatim, exactly like every other authored body in this build.
      body,
      createdAt: new Date().toISOString(),
    };
    p.careMessages = [...(p.careMessages ?? []), msg];
    appendAudit({
      category: "access",
      action: "care_message_sent",
      patientId: link.patientId,
      actorRole: "advocate",
      actorId: link.id,
      detail: {
        authorType: "advocate",
        messageId: msg.id,
        advocateLinkId: link.id,
        communicationRightsBasis: rights.basis ?? null,
      },
    });
    AdelanteEHR.notify({
      recipientRole: "ecm_provider",
      category: "patient_message",
      subject: `Advocate message — ${patientLabel(link.patientId)}`,
      body: "An authorized advocate sent a message to the care team.",
      linkRoute: "/record/$patientId",
      linkParams: { patientId: link.patientId, section: "messages" },
      patientId: link.patientId,
    });
    emit();
    return { sent: true, reason: "Sent.", message: msg };
  },

  /**
   * §Advocate Build 2 item 2 — appointment HISTORY, same masking as upcoming.
   *
   * A separate method rather than a `window` flag on `advocateSchedule` so the
   * existing upcoming read keeps its exact shape and audit action. Group
   * occurrences are projected forward only in this build, so history is
   * appointments; the generic-label rule is identical (service type is only
   * revealed under the live Part 2 disclosure exception).
   */
  advocateScheduleHistory(
    linkId: string,
    now = new Date(),
  ): {
    allowed: boolean;
    reason: string;
    part2Disclosed: boolean;
    items: {
      kind: "appointment";
      id: string;
      start: string;
      durationMin: number;
      label: string;
      status: SessionStatus;
      modality?: string;
      locationName?: string;
    }[];
  } {
    const gate = _advocateGate(linkId, "schedule_view", "appointment_history");
    if (!gate.ok) return { allowed: false, reason: gate.reason, part2Disclosed: false, items: [] };
    const link = gate.link;
    const gates = _advocatePart2Gates(link);
    const part2Ok = gates.unmasked;
    const items = AdelanteEHR.appointmentsForPatient(link.patientId)
      .filter((a) => +new Date(a.start) <= +now)
      .sort((a, b) => +new Date(b.start) - +new Date(a.start))
      .slice(0, 20)
      .map((a) => {
        const loc = a.locationId ? AdelanteEHR.getLocation(a.locationId) : undefined;
        return {
          kind: "appointment" as const,
          id: a.id,
          start: a.start,
          durationMin: a.durationMin,
          status: a.status,
          label:
            part2Ok && a.serviceType
              ? (AdelanteEHR.getServiceType(a.serviceType)?.label ?? "Appointment")
              : "Appointment",
          ...(a.modality ? { modality: a.modality } : {}),
          ...(loc ? { locationName: loc.name } : {}),
        };
      });
    _advocateAudit(link, "advocate_schedule_history_viewed", "appointment_history", {
      itemCount: items.length,
      part2Disclosed: part2Ok,
      advocateLinkValid: gates.linkValid,
      sudDisclosureConsentActive: gates.sudDisclosureConsentActive,
    });
    return { allowed: true, reason: gate.reason, part2Disclosed: part2Ok, items };
  },

  /**
   * §Advocate Build 2 item 2 — who may ACT on the schedule.
   *
   * No new permission name was invented (the tier model is out of scope for
   * this build). Scheduling on someone's behalf is an act of directing care,
   * so it is keyed to `care_plan_participation_write`, which the tier table
   * already grants to `ahcd_agent` and `conservator` only:
   *  - hipaa_only  — a HIPAA authorization authorises DISCLOSURE TO the
   *                  holder, not action BY them. Read-only history.
   *  - authorized_representative — authority is eligibility/enrollment; a
   *                  clinical appointment is outside its scope entirely.
   *  - ahcd_agent / conservator — hold the authority to consent to treatment
   *                  and direct placement; moving an appointment is strictly
   *                  narrower than that.
   */
  advocateCanActOnSchedule(linkId: string): boolean {
    return AdelanteEHR.advocateCan(linkId, "care_plan_participation_write");
  },

  /** Reschedule slots for one appointment. Times only — no clinician identity. */
  advocateRescheduleOptions(
    linkId: string,
    apptId: string,
  ): { allowed: boolean; reason: string; slots: string[] } {
    const gate = _advocateGate(linkId, "care_plan_participation_write", "appointment_reschedule");
    if (!gate.ok) return { allowed: false, reason: gate.reason, slots: [] };
    const appt = appointments.find((a) => a.id === apptId && a.patientId === gate.link.patientId);
    if (!appt) return { allowed: false, reason: "That appointment is not available.", slots: [] };
    const slots = AdelanteEHR.getClinicianAvailability(appt.clinicianId, 14, {
      excludeApptId: appt.id,
    }).map((s) => s.start);
    return { allowed: true, reason: gate.reason, slots };
  },

  /** Move an appointment through the SAME store path the patient portal uses. */
  advocateRescheduleAppointment(linkId: string, apptId: string, newStart: string) {
    const gate = _advocateGate(linkId, "care_plan_participation_write", "appointment_reschedule");
    if (!gate.ok) throw new Error(gate.reason);
    const appt = appointments.find((a) => a.id === apptId && a.patientId === gate.link.patientId);
    if (!appt) throw new Error("That appointment is not available.");
    const previousStart = appt.start;
    AdelanteEHR.rescheduleAppointment(apptId, newStart);
    _advocateAudit(gate.link, "advocate_appointment_rescheduled", "appointment_reschedule", {
      apptId,
      previousStart,
      newStart,
    });
    emit();
  },

  /**
   * RSVP — an advocate's stated intent that the patient will attend. It is NOT
   * an attendance record: `SessionStatus` is clinical and stays owned by staff,
   * so this is stored alongside, never written onto the appointment.
   */
  advocateRsvpAppointment(linkId: string, apptId: string, response: "yes" | "no") {
    const gate = _advocateGate(linkId, "care_plan_participation_write", "appointment_rsvp");
    if (!gate.ok) throw new Error(gate.reason);
    const appt = appointments.find((a) => a.id === apptId && a.patientId === gate.link.patientId);
    if (!appt) throw new Error("That appointment is not available.");
    const existing = advocateApptRsvps.find(
      (r) => r.apptId === apptId && r.advocateLinkId === gate.link.id,
    );
    if (existing) {
      existing.response = response;
      existing.at = new Date().toISOString();
    } else {
      advocateApptRsvps.push({
        apptId,
        advocateLinkId: gate.link.id,
        response,
        at: new Date().toISOString(),
      });
    }
    _advocateAudit(gate.link, "advocate_appointment_rsvp", "appointment_rsvp", {
      apptId,
      response,
    });
    emit();
  },

  advocateRsvpFor(linkId: string, apptId: string): AdvocateApptRsvp | undefined {
    return advocateApptRsvps.find((r) => r.apptId === apptId && r.advocateLinkId === linkId);
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
   *
   * §5d-4 — each need now carries its REFERRALS, so an advocate sees the same
   * thread staff and patient see, within their own authority:
   *   - `hipaa_only`   — organisation named only while Part 2 disclosure
   *                      consent is live (consent-conditional).
   *   - `authorized_representative` — categorically barred from Part 2; a
   *                      sensitive referral is always a restricted row.
   *   - `ahcd_agent` / `conservator` — authority-derived; an AHCD whose Part 2
   *                      scope is unclear falls back to the consent path.
   * All four resolve through the ONE existing evaluation
   * (`_advocatePart2Gates` → `advocateSudAccess`); no tier logic is duplicated
   * here. A restricted row carries status only — no category, no provider, no
   * note — because for a Part 2 sensitive referral the CATEGORY is the
   * sensitive fact. The 5d-3 activity log never crosses this boundary at all.
   */
  advocateCoordination(linkId: string): {
    allowed: boolean;
    reason: string;
    canWrite: boolean;
    items: {
      id: string;
      need: string;
      status: SdohStatus;
      note?: string;
      updatedAt: string;
      referrals: {
        id: string;
        status: ResourceReferralOutcome;
        /** Absent on a restricted row. */
        category?: ResourceReferralCategory;
        /** Absent on a restricted row. */
        provider?: string;
        restricted: boolean;
      }[];
    }[];
    maskedCount: number;
  } {
    const gate = _advocateGate(linkId, "coordination_view", "care_coordination");
    if (!gate.ok)
      return { allowed: false, reason: gate.reason, canWrite: false, items: [], maskedCount: 0 };
    const all = _patient(gate.link.patientId)?.sdohPlan?.items ?? [];
    // §5d-2 — staff-only needs (interpersonal safety materializes this way)
    // are withheld from advocates too. An advocate can be the person the
    // patient is unsafe with, or close to them. Counted as masked, never shown.
    const visible = all.filter(
      (i) => i.visibleToPatient !== false && !_advocateSudText(`${i.need} ${i.note ?? ""}`),
    );
    const sudUnmasked = _advocatePart2Gates(gate.link).unmasked;

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
        referrals: AdelanteEHR.referralsForNeed(gate.link.patientId, i.id)
          // A staff-only referral (safety needs default this way) is never
          // shown to an advocate, exactly like its need.
          .filter((r) => r.visibleToPatient !== false)
          .map((r) => {
            const restricted = isPart2SensitiveCategory(r.category) && !sudUnmasked;
            return {
              id: r.id,
              status: r.status,
              ...(restricted ? {} : { category: r.category, provider: r.provider }),
              restricted,
            };
          }),
      })),
      maskedCount: all.length - visible.length,
    };
  },


  /**
   * §P1 My Care de-clutter — PO-sharing AWARENESS for an identified advocate.
   *
   * Real scoping, and the two halves are different questions:
   *  - The PATIENT sees this only on the justice-involved tracks
   *    (`PoDisclosureCard` is `PopulationGate`d) — showing PO sharing to a
   *    General Population member would be actively wrong.
   *  - The ADVOCATE sees it on a knowledge basis only, behind the SAME
   *    population scope. That half is enforced at the render boundary with
   *    `PopulationGate` rather than here: `population.ts` imports this module,
   *    so calling back into it from the store would close an import cycle.
   *    The store still owns the part that matters — link validity, revocation
   *    and the audit trail.
   *
   * It is deliberately awareness-only: whether voluntary sharing is on, and
   * the standing two-tier framing. No clinical content, no Part 2 material,
   * and no control — the advocate cannot grant or revoke. It runs through
   * `_advocateGate` like every other advocate read, so an inactive or revoked
   * link returns nothing and the attempt is audited.
   */
  advocatePoDisclosure(linkId: string): {
    allowed: boolean;
    reason: string;
    voluntaryActive: boolean;
  } {
    const gate = _advocateGate(linkId, "coordination_view", "care_coordination");
    if (!gate.ok) return { allowed: false, reason: gate.reason, voluntaryActive: false };
    const voluntaryActive = AdelanteEHR.isConsentCategoryAuthorized(
      gate.link.patientId,
      PO_VOLUNTARY_CONSENT_CATEGORY,
    );
    _advocateAudit(gate.link, "advocate_po_disclosure_viewed", "care_coordination", {
      voluntaryActive,
    });
    return { allowed: true, reason: gate.reason, voluntaryActive };
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
      source: "advocate_reported",
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
      review: { status: "pending" },
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
      .map((c) => ({ ...c, review: { ...c.review } }));
  },

  /**
   * §Group D item 1 — the plan owner's review queue. Ownership is DERIVED from
   * the patient's pre-release episode with the same rule the document verify
   * queue uses, so nothing has to be assigned by hand.
   */
  advocateContributionQueue(
    filter: { status?: AdvocateContributionReviewStatus } = {},
  ): (AdvocateContribution & { ownerRole: AdvocatePlanOwnerRole; patientName: string })[] {
    return advocateContributions
      .filter((c) => !filter.status || c.review.status === filter.status)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .map((c) => {
        const p = _patient(c.patientId);
        return {
          ...c,
          review: { ...c.review },
          ownerRole: _documentOwnerRole(c.patientId),
          patientName: p ? `${p.firstName} ${p.lastName}` : c.patientId,
        };
      });
  },

  /**
   * Accept or decline an advocate contribution. ACCEPTING DOES NOT COPY TEXT
   * INTO THE PLAN — the authoritative `ReentryCarePlan` is only ever edited by
   * its owner through the normal plan path. This records that the owner read
   * it and took it up (or did not), with a full audit row.
   */
  reviewAdvocateContribution(input: {
    contributionId: string;
    status: Exclude<AdvocateContributionReviewStatus, "pending">;
    reviewerName: string;
    reviewerRole: string;
    note?: string;
  }): { ok: boolean; reason: string } {
    const c = advocateContributions.find((x) => x.id === input.contributionId);
    if (!c) return { ok: false, reason: "That contribution no longer exists." };
    if (!ADVOCATE_REVIEW_ROLES.includes(input.reviewerRole as AdvocatePlanOwnerRole))
      return {
        ok: false,
        reason:
          "Only the ECM Provider or CF Care Manager who owns the plan can accept advocate input.",
      };
    if (!input.reviewerName.trim()) return { ok: false, reason: "Reviewer name is required." };
    c.review = {
      status: input.status,
      reviewedBy: input.reviewerName.trim(),
      reviewedByRole: input.reviewerRole as AdvocatePlanOwnerRole,
      reviewedAt: new Date().toISOString(),
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    };
    appendAudit({
      category: "advocate",
      action: "advocate_contribution_reviewed",
      patientId: c.patientId,
      actorId: input.reviewerName.trim(),
      actorRole: input.reviewerRole,
      detail: {
        advocateLinkId: c.advocateLinkId,
        advocateName: c.authorName,
        contributionId: c.id,
        section: c.section,
        status: input.status,
        note: c.review.note,
        // Explicit: acceptance is a status, not a plan mutation.
        planMutated: false,
      },
    });
    emit();
    return { ok: true, reason: input.status === "accepted" ? "Accepted." : "Declined." };
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
    // §Group D item 2 — the attestation is now a REVIEWABLE record as well as
    // an audit row. Still no submission: see `submission` on the record.
    const record: AdvocateEligibilityAttestation = {
      id: uid(),
      advocateLinkId: gate.link.id,
      patientId: gate.link.patientId,
      advocateName: gate.link.advocateName,
      attestedName: name,
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      createdAt: new Date().toISOString(),
      submission: "no_submission_path_defined",
      review: { status: "pending" },
    };
    advocateEligibilityAttestations.unshift(record);
    _advocateAudit(gate.link, "advocate_eligibility_assist_attested", "eligibility", {
      attestedName: name,
      note: input.note,
      attestationId: record.id,
      placeholder: "no_submission_path_defined",
    });
    emit();
    return { ok: true, reason: "Attestation recorded." };
  },

  /** §Group D item 2 — the clinician/ECM-side review queue for attestations. */
  advocateEligibilityAttestationQueue(
    filter: { status?: "pending" | "reviewed" } = {},
  ): (AdvocateEligibilityAttestation & {
    ownerRole: AdvocatePlanOwnerRole;
    patientName: string;
  })[] {
    return advocateEligibilityAttestations
      .filter((a) => !filter.status || a.review.status === filter.status)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .map((a) => {
        const p = _patient(a.patientId);
        return {
          ...a,
          review: { ...a.review },
          ownerRole: _documentOwnerRole(a.patientId),
          patientName: p ? `${p.firstName} ${p.lastName}` : a.patientId,
        };
      });
  },

  reviewAdvocateEligibilityAttestation(input: {
    attestationId: string;
    reviewerName: string;
    reviewerRole: string;
    note?: string;
  }): { ok: boolean; reason: string } {
    const a = advocateEligibilityAttestations.find((x) => x.id === input.attestationId);
    if (!a) return { ok: false, reason: "That attestation no longer exists." };
    if (!ADVOCATE_REVIEW_ROLES.includes(input.reviewerRole as AdvocatePlanOwnerRole))
      return {
        ok: false,
        reason: "Only the ECM Provider or CF Care Manager can review an advocate attestation.",
      };
    if (!input.reviewerName.trim()) return { ok: false, reason: "Reviewer name is required." };
    a.review = {
      status: "reviewed",
      reviewedBy: input.reviewerName.trim(),
      reviewedByRole: input.reviewerRole as AdvocatePlanOwnerRole,
      reviewedAt: new Date().toISOString(),
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    };
    appendAudit({
      category: "advocate",
      action: "advocate_eligibility_attestation_reviewed",
      patientId: a.patientId,
      actorId: input.reviewerName.trim(),
      actorRole: input.reviewerRole,
      detail: {
        advocateLinkId: a.advocateLinkId,
        advocateName: a.advocateName,
        attestationId: a.id,
        note: a.review.note,
        submission: a.submission,
      },
    });
    emit();
    return { ok: true, reason: "Marked as reviewed." };
  },

  /**
   * Authority tiers ONLY (activated AHCD agent / conservator): the clinical
   * care-plan snapshot. Part 2 content
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
    return AdelanteEHR.listPatientDocuments(patientId).filter((d) => d.verification === "verified");
  },

  documentUploaderLabel(doc: PatientDocument): string {
    return _documentUploaderLabel(doc.uploader);
  },

  /**
   * §Group E item 2 — THE download/view action. There is exactly one of these:
   * patient, staff and advocate viewers all come through here, and the Part 2
   * decision is `documentDownloadDecision`, which is a thin wrapper over
   * `advocateDocumentVisibility` — the same function the restricted RENDERING
   * case calls. No second authorization path exists for downloads, so the two
   * cannot drift: an advocate who sees "Protected document" in the list gets
   * refused here for the same reason, from the same call.
   */
  requestDocumentDownload(input: {
    documentId: string;
    viewer:
      | { kind: "patient" | "staff"; name: string; role?: StaffRole }
      | { kind: "advocate"; linkId: string };
  }):
    | { ok: true; fileName: string; mimeType: string; text: string }
    | { ok: false; reason: string; restricted: boolean } {
    const doc = patientDocuments.find((d) => d.id === input.documentId);
    if (!doc) return { ok: false, reason: "That document no longer exists.", restricted: false };

    let part2Unmasked = true;
    let link: AdvocateLink | undefined;
    if (input.viewer.kind === "advocate") {
      const gate = _advocateGate(input.viewer.linkId, "document_view", "documents");
      if (!gate.ok) return { ok: false, reason: gate.reason, restricted: true };
      link = gate.link;
      if (link.patientId !== doc.patientId)
        return { ok: false, reason: "No advocate connection.", restricted: true };
      part2Unmasked = _advocatePart2Gates(link).unmasked;
    }

    const decision = documentDownloadDecision({
      isPart2: doc.isPart2,
      part2Unmasked,
      verification: doc.verification,
    });
    if (!decision.allowed) {
      if (link)
        _advocateAudit(link, "advocate_document_download_denied", "documents", {
          documentId: doc.id,
          restricted: decision.restricted,
        });
      else
        appendAudit({
          category: "clinical",
          action: "document_download_denied",
          patientId: doc.patientId,
          actorRole: input.viewer.kind === "staff" ? input.viewer.role : "patient",
          actorId: input.viewer.kind === "advocate" ? undefined : input.viewer.name,
          detail: { documentId: doc.id, reason: decision.reason },
        });
      emit();
      return { ok: false, reason: decision.reason, restricted: decision.restricted };
    }

    const payload = documentDownloadPayload({
      id: doc.id,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      ...(doc.docType ? { docType: doc.docType } : {}),
      uploadedAt: doc.uploadedAt,
      uploaderLabel: _documentUploaderLabel(doc.uploader),
      isPart2: doc.isPart2,
      ...(doc.promotedBy ? { promotedBy: doc.promotedBy } : {}),
      ...(doc.promotedAt ? { promotedAt: doc.promotedAt } : {}),
    });
    if (link)
      _advocateAudit(link, "advocate_document_downloaded", "documents", {
        documentId: doc.id,
        isPart2: doc.isPart2,
      });
    else
      appendAudit({
        category: "clinical",
        action: "document_downloaded",
        patientId: doc.patientId,
        actorRole: input.viewer.kind === "staff" ? input.viewer.role : "patient",
        actorId: input.viewer.kind === "advocate" ? undefined : input.viewer.name,
        detail: { documentId: doc.id, fileName: doc.fileName, isPart2: doc.isPart2 },
      });
    emit();
    return { ok: true, ...payload };
  },

  /** §Group E item 1 — this advocate's own in-app notices, newest first. */
  advocateDocumentNotifications(linkId: string): ApptNotification[] {
    const link = advocateLinks.find((l) => l.id === linkId);
    if (!link) return [];
    if (!AdelanteEHR.advocateAccess(linkId).allowed) return [];
    return [...(link.notifications ?? [])];
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
    // §Group E item 1 — tell the patient, and any advocate whose EXISTING
    // access already covers this document. Raised inside the promotion method
    // so no future caller can promote silently.
    _notifyDocumentVerified(doc);
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
    const docGates = _advocatePart2Gates(gate.link);
    const part2Ok = docGates.unmasked;
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
      advocateLinkValid: docGates.linkValid,
      sudDisclosureConsentActive: docGates.sudDisclosureConsentActive,
    });
    return {
      allowed: true,
      reason: gate.reason,
      canUpload: AdelanteEHR.advocateCan(linkId, "document_upload"),
      items,
    };
  },

  /**
   * §Adelante Journey Phase 5 — self-help PROGRESS for an advocate.
   *
   * The read floor: available at `hipaa_only` and above, because completion
   * counts are participation data, not clinical documentation. What it
   * deliberately does NOT return, at any tier: the patient's reflection
   * answers, worksheet text, saved toolkit LABELS (patient-authored free text
   * that can carry anything), notes, or diagnoses. The DTO below is the whole
   * surface — widening it takes a deliberate edit.
   *
   * Part 2: a lesson flagged `part2Sensitive` has its TITLE withheld unless
   * the existing Part 2 gate is lifted for this link — the same rule
   * `advocateSchedule` applies to SUD group topics. The row still counts, so
   * the totals stay honest.
   */
  advocateLibraryProgress(linkId: string): {
    allowed: boolean;
    reason: string;
    part2Disclosed: boolean;
    lessonsCompleted: number;
    lessonsTotal: number;
    exercisesCompleted: number;
    exercisesTotal: number;
    completed: { kind: "lesson" | "exercise"; id: string; title: string; restricted: boolean }[];
  } {
    const gate = _advocateGate(linkId, "library_progress_view", "self_help_progress");
    if (!gate.ok)
      return {
        allowed: false,
        reason: gate.reason,
        part2Disclosed: false,
        lessonsCompleted: 0,
        lessonsTotal: 0,
        exercisesCompleted: 0,
        exercisesTotal: 0,
        completed: [],
      };
    const gates = _advocatePart2Gates(gate.link);
    const part2Ok = gates.unmasked;
    const pid = gate.link.patientId;
    const lessonIds = AdelanteEHR.completedLibraryItems(pid);
    const exerciseIds = AdelanteEHR.completedExercises(pid);
    const completed: {
      kind: "lesson" | "exercise";
      id: string;
      title: string;
      restricted: boolean;
    }[] = [];
    for (const id of lessonIds) {
      const item = getLibraryItem(id);
      if (!item) continue;
      const restricted = Boolean(item.part2Sensitive) && !part2Ok;
      completed.push({
        kind: "lesson",
        id,
        title: restricted ? "Protected lesson" : item.title,
        restricted,
      });
    }
    for (const id of exerciseIds) {
      const ex = getExercise(id);
      if (!ex) continue;
      const restricted = Boolean(ex.part2Sensitive) && !part2Ok;
      completed.push({
        kind: "exercise",
        id,
        title: restricted ? "Protected exercise" : ex.title,
        restricted,
      });
    }
    _advocateAudit(gate.link, "advocate_self_help_progress_viewed", "self_help_progress", {
      lessonsCompleted: lessonIds.length,
      exercisesCompleted: exerciseIds.length,
      restrictedCount: completed.filter((c) => c.restricted).length,
      part2Disclosed: part2Ok,
    });
    return {
      allowed: true,
      reason: gate.reason,
      part2Disclosed: part2Ok,
      lessonsCompleted: lessonIds.length,
      lessonsTotal: LIBRARY_ITEMS.length,
      exercisesCompleted: exerciseIds.length,
      exercisesTotal: EXERCISES.length,
      completed,
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

  /**
   * §Advocate Access Redesign Phase 2 (final) — the advocate edits their own
   * contact details. Deliberately cannot touch `authorizationType`,
   * `documentRequirements`, status, or anything else the access decision
   * reads: this is a profile edit, not a permission change.
   */
  updateAdvocateProfile(
    linkId: string,
    input: {
      advocateName?: string;
      relationship?: string;
      contactPhone?: string;
      preferredLanguage?: "en" | "es";
    },
  ) {
    const link = advocateLinks.find((l) => l.id === linkId);
    if (!link) throw new Error("This connection no longer exists.");
    const name = input.advocateName?.trim();
    if (input.advocateName !== undefined && !name) throw new Error("Your name is required.");
    if (name) link.advocateName = name;
    if (input.relationship !== undefined) link.relationship = input.relationship.trim();
    if (input.contactPhone !== undefined) link.contactPhone = input.contactPhone.trim();
    if (input.preferredLanguage !== undefined) link.preferredLanguage = input.preferredLanguage;
    appendAudit({
      category: "advocate",
      action: "advocate_profile_updated",
      patientId: link.patientId,
      actorRole: "advocate",
      actorId: link.id,
      detail: { advocateLinkId: link.id, fields: Object.keys(input) },
    });
    emit();
    return { ...link };
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

  /**
   * The most recent refused claim attempt, so a note surface can explain WHY
   * without restating the rule. The banner reads the SAME audit row the block
   * wrote — there is no second copy of the reason text to drift from.
   */
  lastCommunityBillingBlock(filter: {
    patientId: string;
    service?: "peer_support" | "chw_services";
    actorId?: string;
    /** Narrows to one note/encounter via the detail payload. */
    noteId?: string;
  }): { at: string; reasonCode: string; reason: string; service: string } | undefined {
    const hit = auditEvents
      .filter(
        (e) =>
          e.action === "community_billing_blocked" &&
          e.patientId === filter.patientId &&
          (!filter.service || e.detail?.["service"] === filter.service) &&
          (!filter.actorId || e.actorId === filter.actorId) &&
          (!filter.noteId ||
            e.detail?.["noteId"] === filter.noteId ||
            e.detail?.["peerNoteId"] === filter.noteId),
      )
      .sort((a, b) => (a.at < b.at ? 1 : -1))[0];
    if (!hit) return undefined;
    return {
      at: hit.at,
      reasonCode: String(hit.detail?.["reasonCode"] ?? "blocked"),
      reason: String(hit.detail?.["reason"] ?? ""),
      service: String(hit.detail?.["service"] ?? ""),
    };
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
    // §Phase 4f — the provider-switch record above is a continuity-of-care
    // artifact, not an assignment record. The Client Journey timeline reads
    // `category: "assignment"`, so without this entry the date it shows falls
    // back to enrollment. Both writes are intentional and independent.
    appendAudit({
      category: "assignment",
      action: prev ? "primary_clinician_reassigned" : "primary_clinician_assigned",
      patientId: p.id,
      detail: { from: prev, to: input.clinicianId, ...(input.context ? { context: input.context } : {}) },
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

  /**
   * §Crisis Redesign Phase 1 — narrowly-scoped peer visibility. Peer
   * specialists (and every other CRISIS_FLAG_ROLES role without
   * `crisis_queue` access) could raise a flag and then never learn what
   * happened to it. This returns ONLY escalations that this actor personally
   * flagged — never the cross-patient queue — so "what came of the flag I
   * raised" is answerable without granting population-wide visibility.
   */
  listCrisisEscalationsFlaggedBy(
    staffName: string,
  ): { patient: Patient; escalation: CrisisEscalation }[] {
    const who = staffName?.trim();
    if (!who) return [];
    const out: { patient: Patient; escalation: CrisisEscalation }[] = [];
    for (const p of patients) {
      for (const e of p.crisisEscalations ?? []) {
        if (e.triggeredBy === who) out.push({ patient: p, escalation: e });
      }
    }
    return out.sort(
      (a, b) => +new Date(b.escalation.triggeredAt) - +new Date(a.escalation.triggeredAt),
    );
  },

  /**
   * §Crisis Redesign Phase 1 — claim. Advisory only: it records who picked the
   * row up so two responders do not double-work it. It does NOT lock
   * resolution. Claiming an already-claimed row by someone else is refused so
   * a claim cannot be silently stolen; unclaim first.
   */
  claimCrisisEscalation(patientId: string, id: string, staffName: string): CrisisEscalation {
    const p = patients.find((x) => x.id === patientId);
    const row = p?.crisisEscalations?.find((r) => r.id === id);
    if (!p || !row) throw new Error("Crisis escalation not found.");
    if (row.status === "resolved") throw new Error("This escalation is already resolved.");
    if (row.claimedBy && row.claimedBy !== staffName)
      throw new Error(`Already claimed by ${row.claimedBy}.`);
    row.claimedBy = staffName;
    row.claimedAt = new Date().toISOString();
    appendAudit({
      category: "clinical",
      action: "crisis_escalation_claimed",
      patientId,
      actorId: staffName,
      detail: { escalationId: row.id },
    });
    emit();
    return row;
  },

  /** Release a claim so somebody else can pick the escalation up. */
  unclaimCrisisEscalation(patientId: string, id: string, staffName: string): CrisisEscalation {
    const p = patients.find((x) => x.id === patientId);
    const row = p?.crisisEscalations?.find((r) => r.id === id);
    if (!p || !row) throw new Error("Crisis escalation not found.");
    const previous = row.claimedBy;
    row.claimedBy = undefined;
    row.claimedAt = undefined;
    appendAudit({
      category: "clinical",
      action: "crisis_escalation_unclaimed",
      patientId,
      actorId: staffName,
      detail: { escalationId: row.id, previousClaimedBy: previous ?? null },
    });
    emit();
    return row;
  },

  /**
   * §Crisis Redesign Phase 1 — re-trigger, replacing a silent drop.
   *
   * Previously a second crisis signal arriving while an escalation was already
   * open for that patient was discarded entirely: clinically the WORST case,
   * because escalating distress is exactly the signal you must not lose. Now
   * the repeat is appended to the existing record, `lastTriggeredAt` is bumped,
   * and the queue renders a "re-triggered" indicator. One record, no lost
   * signal, and no duplicate row flooding the queue either.
   */
  retriggerCrisisEscalation(
    patientId: string,
    id: string,
    staffName: string,
    detail: string,
  ): CrisisEscalation {
    const p = patients.find((x) => x.id === patientId);
    const row = p?.crisisEscalations?.find((r) => r.id === id);
    if (!p || !row) throw new Error("Crisis escalation not found.");
    if (row.status === "resolved") throw new Error("This escalation is already resolved.");
    const at = new Date().toISOString();
    row.retriggers = [...(row.retriggers ?? []), { at, by: staffName, detail }];
    row.lastTriggeredAt = at;
    appendAudit({
      category: "clinical",
      action: "crisis_escalation_retriggered",
      patientId,
      actorId: staffName,
      detail: { escalationId: row.id, triggerDetail: detail, count: row.retriggers.length },
    });
    // Same out-of-band push as a fresh flag — a repeat signal is news.
    AdelanteEHR.notify({
      recipientRole: "clinical_coordinator",
      category: "crisis_flagged",
      subject: `Crisis re-triggered — ${patientLabel(patientId)}`,
      body: `A further crisis signal arrived on an already-open escalation (${row.retriggers.length} repeat${row.retriggers.length === 1 ? "" : "s"}): ${detail}`,
      linkRoute: "/crisis-queue",
      patientId,
    });
    dispatchStaffAlert({
      kind: "crisis_flagged",
      recipientRole: "clinical_coordinator",
      subject: "Adelante: crisis re-triggered",
      body: "A further crisis signal arrived on an already-open escalation. Open the crisis queue.",
      linkRoute: "/crisis-queue",
      patientId,
    });
    emit();
    return row;
  },



  /**
   * Cross-patient open queue. Primary order is unchanged — oldest-open first,
   * because the longest-open escalation is the most urgent thing on screen.
   * §Crisis Redesign Phase 1 adds one rule above it: an escalation that has
   * RE-TRIGGERED (a further signal arrived while it sat open) floats to the
   * top, so a repeat cannot be buried mid-list. Re-triggered rows are
   * themselves oldest-first among each other.
   */
  listOpenCrisisEscalations(opts?: {
    category?: CrisisCategory;
  }): { patient: Patient; escalation: CrisisEscalation }[] {
    const out: { patient: Patient; escalation: CrisisEscalation }[] = [];
    for (const p of patients) {
      for (const e of p.crisisEscalations ?? []) {
        if (e.status !== "open") continue;
        if (opts?.category && e.category !== opts.category) continue;
        out.push({ patient: p, escalation: e });
      }
    }
    return out.sort((a, b) => {
      const ar = (a.escalation.retriggers?.length ?? 0) > 0 ? 0 : 1;
      const br = (b.escalation.retriggers?.length ?? 0) > 0 ? 0 : 1;
      if (ar !== br) return ar - br;
      return +new Date(a.escalation.triggeredAt) - +new Date(b.escalation.triggeredAt);
    });
  },

  /** Open (unacknowledged) anonymous front-door crisis alerts, oldest first. */
  listAnonymousCrisisAlerts(opts?: { includeAcknowledged?: boolean }): AnonymousCrisisAlert[] {
    return anonymousCrisisAlerts
      .filter((a) => opts?.includeAcknowledged || !a.acknowledgedAt)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  raiseAnonymousCrisisAlert(input: {
    surface: string;
    patternIds: string[];
    contact?: string;
  }): AnonymousCrisisAlert {
    const row: AnonymousCrisisAlert = {
      id: uid(),
      surface: input.surface,
      patternIds: [...input.patternIds],
      contact: input.contact?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    anonymousCrisisAlerts.unshift(row);
    appendAudit({
      category: "clinical",
      action: "anonymous_crisis_alert_raised",
      actorId: "Message scan (automated)",
      detail: { alertId: row.id, surface: row.surface, patternIds: row.patternIds },
    });
    AdelanteEHR.notify({
      recipientRole: "clinical_coordinator",
      category: "crisis_flagged",
      subject: "Crisis language — front door (no patient record)",
      body: `Automated flag: crisis language in ${row.surface}. There is no chart for this person yet — see the crisis queue.`,
      linkRoute: "/crisis-queue",
    });
    dispatchStaffAlert({
      kind: "anonymous_crisis",
      recipientRole: "clinical_coordinator",
      subject: "Adelante: crisis language at the front door",
      body: "Someone with no patient record used crisis language. Open the crisis queue.",
      linkRoute: "/crisis-queue",
    });
    emit();
    return row;
  },

  acknowledgeAnonymousCrisisAlert(id: string, staffName: string): boolean {
    const row = anonymousCrisisAlerts.find((a) => a.id === id);
    if (!row || row.acknowledgedAt) return false;
    row.acknowledgedBy = staffName;
    row.acknowledgedAt = new Date().toISOString();
    appendAudit({
      category: "clinical",
      action: "anonymous_crisis_alert_acknowledged",
      actorId: staffName,
      detail: { alertId: row.id },
    });
    emit();
    return true;
  },

  /** Non-clinical front-door inquiries, newest first. */
  listCommunityInquiries(opts?: { includeResolved?: boolean }): CommunityInquiry[] {
    return communityInquiries
      .filter((r) => opts?.includeResolved !== false || r.status !== "resolved")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  createCommunityInquiry(input: {
    body: string;
    contact: string;
    contactKind: "email" | "phone";
    crisisFlagged?: boolean;
    patternIds?: string[];
  }): CommunityInquiry | undefined {
    const body = input.body.trim();
    const contact = input.contact.trim();
    if (!body || !contact) return undefined;
    const row: CommunityInquiry = {
      id: uid(),
      body,
      contact,
      contactKind: input.contactKind,
      crisisFlagged: !!input.crisisFlagged,
      patternIds: input.patternIds ? [...input.patternIds] : undefined,
      createdAt: new Date().toISOString(),
      status: "new",
    };
    communityInquiries.unshift(row);
    // Audit records that an inquiry arrived — never the text itself.
    appendAudit({
      category: "clinical",
      action: "community_inquiry_created",
      actorId: "Front door (self-service)",
      detail: { inquiryId: row.id, crisisFlagged: row.crisisFlagged },
    });
    AdelanteEHR.notify({
      recipientRole: "clinical_coordinator",
      category: "task_assigned",
      subject: "New community inquiry (front door)",
      body: "Someone asked for help finding the right place. They left contact details.",
      linkRoute: "/inbox",
    });
    emit();
    return row;
  },

  dispositionCommunityInquiry(
    id: string,
    status: Exclude<CommunityInquiryStatus, "new">,
    staffName: string,
    note?: string,
  ): boolean {
    const row = communityInquiries.find((r) => r.id === id);
    if (!row || row.status === status) return false;
    row.status = status;
    row.dispositionBy = staffName;
    row.dispositionAt = new Date().toISOString();
    if (note?.trim()) row.dispositionNote = note.trim();
    appendAudit({
      category: "clinical",
      action: "community_inquiry_disposition",
      actorId: staffName,
      detail: { inquiryId: row.id, status },
    });
    emit();
    return true;
  },

  // (community inquiry helpers above)

  flagCrisis(
    patientId: string,
    staffName: string,
    reason: string,
    opts?: {
      triggerSource?: CrisisEscalation["triggerSource"];
      sourceNoteId?: string;
      severity?: CrisisSeverity;
      category?: CrisisCategory;
    },
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
    const now = new Date().toISOString();
    const row: CrisisEscalation = {
      id: uid(),
      patientId,
      alertId: alert.id,
      triggerSource: opts?.triggerSource ?? "manual",
      triggerDetail: detail,
      triggeredBy: staffName,
      triggeredAt: now,
      status: "open",
      // DRAFT defaults — see the CrisisEscalation doc comment. Every trigger
      // that exists today genuinely is critical/clinical; callers may pass
      // drafts explicitly once a real lane exists (Phase 2+).
      severity: opts?.severity ?? "critical",
      category: opts?.category ?? "clinical",
      classificationStatus: "draft",
      lastTriggeredAt: now,
      retriggers: [],
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
    // §Notification feed — clinical_coordinator owns clinical crisis
    // disposition. §Crisis Redesign Phase 2: an SDOH-urgent escalation is
    // case-management work, not clinical disposition, so it is routed to the
    // ECM Provider instead. Single call site for every trigger source.
    const owner: StaffRole = row.category === "sdoh" ? "ecm_provider" : "clinical_coordinator";
    AdelanteEHR.notify({
      recipientRole: owner,
      category: "crisis_flagged",
      subject: `Crisis flagged — ${patientLabel(patientId)}`,
      body: `${staffName} flagged a crisis (${row.triggerSource === "screener_score" ? "screener score" : row.triggerSource === "assisted_signup" ? "manual — sign-up assistance" : row.triggerSource === "message_pattern" ? "automated — crisis language in free text" : row.triggerSource === "patient_request" ? "patient asked for their care team" : "manual"}): ${detail}`,
      linkRoute: "/crisis-queue",
      patientId,
    });
    // §Message-routing gap #1 — same event, pushed out of band so the queue is
    // no longer the only place anyone finds out. Every triggerSource.
    dispatchStaffAlert({
      kind: "crisis_flagged",
      recipientRole: owner,
      subject: "Adelante: crisis flagged",
      // No free text from the trigger — SMS is an unsecured channel.
      body: `A crisis was flagged (${row.triggerSource.replace(/_/g, " ")}). Open the crisis queue.`,
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
    input: {
      contactedWhom?: string;
      actionsTaken?: string;
      disposition: string;
      /**
       * §Crisis Redesign Phase 2 — DRAFT structured disposition category (see
       * CRISIS_DISPOSITIONS in `src/lib/crisisPolicy.ts`). Optional at the
       * model level so every existing caller and test keeps working; the UI
       * always sends one.
       */
      dispositionCode?: string;
    },
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
    row.dispositionCode = input.dispositionCode?.trim() || undefined;
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
        dispositionCode: row.dispositionCode ?? null,
        contactedWhom: row.contactedWhom ?? null,
        actionsTaken: row.actionsTaken ?? null,
      },
    });
    emit();
    return row;
  },

  /**
   * §Crisis Redesign Phase 2 — aging / SLA breach.
   *
   * Called by the sweep in `src/lib/crisisPolicy.ts` (which owns the DRAFT
   * thresholds) when an OPEN escalation — claimed or not — has sat past its
   * response threshold. Idempotent: the `slaBreachAt` stamp is written once,
   * so the supervisor is re-notified once per escalation, not once per tick.
   * Claiming does NOT exempt a row: a claimed-but-untouched escalation is the
   * exact failure mode this is meant to catch.
   */
  markCrisisSlaBreach(
    patientId: string,
    id: string,
    input: { thresholdLabel: string; supervisorRole: StaffRole },
  ): CrisisEscalation | undefined {
    const p = patients.find((x) => x.id === patientId);
    const row = p?.crisisEscalations?.find((r) => r.id === id);
    if (!p || !row || row.status !== "open" || row.slaBreachAt) return undefined;
    row.slaBreachAt = new Date().toISOString();
    appendAudit({
      category: "clinical",
      action: "crisis_escalation_sla_breached",
      patientId,
      actorId: "system",
      detail: {
        escalationId: row.id,
        thresholdLabel: input.thresholdLabel,
        claimedBy: row.claimedBy ?? null,
        severity: row.severity,
        category: row.category,
      },
    });
    AdelanteEHR.notify({
      recipientRole: input.supervisorRole,
      category: "crisis_flagged",
      subject: `Crisis overdue — ${patientLabel(patientId)}`,
      body: `An open escalation has passed its draft ${input.thresholdLabel} response target${row.claimedBy ? ` (claimed by ${row.claimedBy})` : " and is still unclaimed"}. Draft threshold — pending operational policy.`,
      linkRoute: "/crisis-queue",
      patientId,
    });
    dispatchStaffAlert({
      kind: "crisis_flagged",
      recipientRole: input.supervisorRole,
      subject: "Adelante: crisis escalation overdue",
      body: "An open crisis escalation passed its draft response target. Open the crisis queue.",
      linkRoute: "/crisis-queue",
      patientId,
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
      // §Pre-release build 4 — signed orders (incl. pre-release MAT) are a
      // live care-plan medication source, so the plan follows the chart.
      _recomputeCarePlan(patientId, "orders_signed");
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
    // §Pre-release build 4 — lifecycle changes must reach the care plan too.
    _recomputeCarePlan(patientId, opts.action);
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
      .filter((a) => a.orderId === orderId && !a.voided && a.action === "given")
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
      /** §Phase 2b — omitted means `global`, matching every pre-2b row. */
      scope?: TemplateScope;
      departmentId?: string;
      ownerStaffId?: string;
      clonedFrom?: NoteTemplate["clonedFrom"];
      inheritedLockedKeys?: string[];
    },
    staffName: string,
  ): NoteTemplate {
    const key = (input.key ?? "").trim();
    const title = (input.title ?? "").trim();
    if (!key) throw new Error("A template key is required.");
    if (!title) throw new Error("A template title is required.");
    if (noteTemplates.some((t) => t.key.toLowerCase() === key.toLowerCase()))
      throw new Error(`A template with the key "${key}" already exists.`);
    const scope: TemplateScope = input.scope ?? "global";
    if (scope === "department" && !input.departmentId)
      throw new Error("A discipline is required for a department template.");
    if (scope === "personal" && !input.ownerStaffId)
      throw new Error("A personal template needs an owner.");
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
      scope,
      ...(scope === "department" ? { departmentId: input.departmentId } : {}),
      ...(scope === "personal" ? { ownerStaffId: input.ownerStaffId } : {}),
      ...(input.clonedFrom ? { clonedFrom: input.clonedFrom } : {}),
      ...(input.inheritedLockedKeys?.length
        ? { inheritedLockedKeys: [...input.inheritedLockedKeys] }
        : {}),
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
        scope: row.scope,
        departmentId: row.departmentId ?? null,
        ownerStaffId: row.ownerStaffId ?? null,
      },
    });
    emit();
    return { ...row };
  },

  /**
   * §EHR audit Phase 2b — take an independent personal copy of a template.
   *
   * The copy is a NEW key at version 1 with its own history: it never appends
   * to, supersedes, or otherwise touches the source's version chain, so the
   * existing versioning/snapshot guarantee is untouched. Locked fields ride
   * along and are recorded in `inheritedLockedKeys`, which `updateNoteTemplate`
   * enforces on every later edit.
   */
  cloneNoteTemplateToPersonal(
    templateId: string,
    actor: { staffId: string; staffName: string },
  ): NoteTemplate {
    const source = noteTemplates.find((t) => t.id === templateId);
    if (!source) throw new Error("Template not found.");
    if ((source.scope ?? "global") === "personal")
      throw new Error("That is already a personal template.");
    const clone = buildPersonalClone(
      { key: source.key, title: source.title, schema: source.schema },
      { role: "sys_admin", staffId: actor.staffId },
      noteTemplates.map((t) => t.key),
    );
    const locked: string[] = [];
    for (const section of source.schema?.sections ?? []) {
      for (const field of section.fields ?? []) if (field.locked) locked.push(field.key);
    }
    const row = AdelanteEHR.createNoteTemplate(
      {
        key: clone.key,
        title: clone.title,
        description: source.description,
        encounterType: source.encounterType,
        schema: clone.schema,
        scope: "personal",
        ownerStaffId: actor.staffId,
        clonedFrom: {
          templateId: source.id,
          key: source.key,
          version: source.version,
          title: source.title,
        },
        inheritedLockedKeys: locked,
      },
      actor.staffName,
    );
    appendAudit({
      category: "clinical",
      action: "note_template_cloned_to_personal",
      actorId: actor.staffName,
      detail: {
        templateId: row.id,
        sourceTemplateId: source.id,
        sourceKey: source.key,
        sourceVersion: source.version,
        lockedFields: locked.length,
      },
    });
    emit();
    return row;
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
    // §Phase 2b — locked structure inherited from a Global/Department source
    // survives every later edit of a personal clone. Only rows that actually
    // inherited something are checked; a tier author editing their OWN locked
    // fields is exactly who is allowed to change them.
    if (patch.schema && row.inheritedLockedKeys?.length) {
      const violations = lockedFieldViolations(row.inheritedLockedKeys, row.schema, patch.schema);
      if (violations.length) throw new Error(violations.map((v) => v.message).join(" "));
    }
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
        // §Phase 2b — scope/ownership/locked inheritance are identity, not
        // content: a new version of a personal clone is still that person's.
        scope: row.scope,
        ...(row.departmentId ? { departmentId: row.departmentId } : {}),
        ...(row.ownerStaffId ? { ownerStaffId: row.ownerStaffId } : {}),
        ...(row.clonedFrom ? { clonedFrom: row.clonedFrom } : {}),
        ...(row.inheritedLockedKeys?.length
          ? { inheritedLockedKeys: [...row.inheritedLockedKeys] }
          : {}),
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
    _assertGroupCapacity(input.capacity);
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
    if (patch.capacity !== undefined) _assertGroupCapacity(patch.capacity);
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
    AdelanteEHR.notifyGroupChange({
      event: "session_cancelled",
      sessionId: id,
      patientIds: _activeGroupEnrollees(id),
      triggeredBy: _groupTrigger(actor),
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
      if (!isSelfServiceGroupCategory(group.category))
        block("staff_enrolled_only", "This group is staff-enrolled only.");
      if (initiator.actorId !== patientId)
        block("not_self", "You can only book groups for yourself.");
    }
    // §Phase 6b — telehealth consent moves EARLIER. The documentation-time gate
    // (`groupOccurrenceConsentGate`) stays exactly as it is; this is a second,
    // earlier check so nobody is seated in a group they cannot lawfully attend.
    // It follows what the patient would ACTUALLY be asked to attend, not the
    // session's default label — see `groupVirtualExposure`.
    const exposure = AdelanteEHR.groupVirtualExposure(group.id);
    if (
      exposure.virtual &&
      !AdelanteEHR.isConsentCategoryAuthorized(patientId, TELEHEALTH_CONSENT_CATEGORY)
    )
      block(
        "no_telehealth_consent",
        initiator.kind === "patient"
          ? "This group meets by video or phone. Before you can join, your care team needs to go through the telehealth consent with you."
          : "This group has upcoming virtual meetings and this patient has no active telehealth consent on file. Capture telehealth consent before enrolling them.",
      );
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
   * §Phase 6b — does this group expose the patient to a VIRTUAL meeting?
   *
   * Occurrences fall back to the session default, so a virtual-default group is
   * virtual exposure unless every projected upcoming occurrence has been
   * explicitly overridden to in person. Past meetings are irrelevant to a new
   * enrollment and are ignored. This deliberately blocks no more than the real
   * risk: an in-person-only schedule needs no telehealth consent.
   */
  groupVirtualExposure(
    sessionId: string,
    now = new Date(),
  ): { virtual: boolean; firstVirtualStart?: string } {
    const upcoming = AdelanteEHR.groupOccurrenceStarts(sessionId, 8).filter(
      (s) => +new Date(s) >= +now,
    );
    const starts = upcoming.length
      ? upcoming
      : // No upcoming meeting projected (a finished or one-off series): fall back
        // to the group's own default so the answer is never silently "safe".
        [];
    for (const s of starts) {
      if (isVirtualGroupModality(AdelanteEHR.groupOccurrenceModality(sessionId, s)))
        return { virtual: true, firstVirtualStart: s };
    }
    if (!starts.length) {
      const g = groupSessions.find((x) => x.id === sessionId);
      if (g && isVirtualGroupModality(defaultOccurrenceModality(g.modality)))
        return { virtual: true };
    }
    return { virtual: false };
  },

  /**
   * §Phase 6b — the standing virtual room for a group. `joinUrl` empty/undefined
   * clears it; nothing is auto-generated behind the user's back.
   */
  setGroupVirtualRoom(
    sessionId: string,
    joinUrl: string | undefined,
    actor: string,
  ): GroupSession {
    const g = groupSessions.find((x) => x.id === sessionId);
    if (!g) throw new Error("Group not found.");
    const trimmed = joinUrl?.trim();
    g.virtualRoom = trimmed
      ? {
          roomId: `grm_${sessionId}`,
          joinUrl: trimmed,
          setAt: new Date().toISOString(),
          setBy: actor,
        }
      : undefined;
    appendAudit({
      category: "clinical",
      action: trimmed ? "group_virtual_room_set" : "group_virtual_room_cleared",
      actorId: actor,
      detail: { groupSessionId: sessionId },
    });
    emit();
    return g;
  },

  /** One-meeting override of the standing room. */
  setGroupOccurrenceVirtualRoom(
    sessionId: string,
    occurrenceStart: string,
    joinUrl: string | undefined,
    actor: string,
  ): GroupOccurrenceRecord {
    const g = groupSessions.find((x) => x.id === sessionId);
    if (!g) throw new Error("Group not found.");
    const row = _ensureGroupOccurrence(sessionId, occurrenceStart);
    const trimmed = joinUrl?.trim();
    row.virtualRoom = trimmed
      ? {
          roomId: `grm_${sessionId}_${occurrenceStart}`,
          joinUrl: trimmed,
          setAt: new Date().toISOString(),
          setBy: actor,
        }
      : undefined;
    appendAudit({
      category: "clinical",
      action: trimmed ? "group_virtual_room_set" : "group_virtual_room_cleared",
      actorId: actor,
      detail: { groupSessionId: sessionId, occurrenceStart },
    });
    emit();
    return row;
  },

  /** Effective join link for one meeting: occurrence override, else the group's. */
  groupJoinLink(sessionId: string, occurrenceStart?: string): GroupVirtualRoom | undefined {
    if (occurrenceStart) {
      const occ = AdelanteEHR.getGroupOccurrence(sessionId, occurrenceStart);
      if (occ?.virtualRoom) return occ.virtualRoom;
    }
    return groupSessions.find((x) => x.id === sessionId)?.virtualRoom;
  },

  /**
   * Groups this patient may self-book: self-service categories only
   * (`open_psychoeducational` and the billable `skills_education`),
   * eligibility set, not cancelled, not already enrolled, not at capacity.
   * Used by the patient scheduling page — `sud_clinical_preauth` can never
   * appear here.
   *
   * §Phase 6b: virtual groups are hidden from a patient without active
   * telehealth consent, so the page never offers a booking it would then refuse.
   */
  openGroupsForPatient(patientId: string): GroupSession[] {
    if (!AdelanteEHR.isGroupEligible(patientId)) return [];
    const enrolled = new Set(AdelanteEHR.groupsForPatient(patientId).map((g) => g.id));
    const telehealthOk = AdelanteEHR.isConsentCategoryAuthorized(
      patientId,
      TELEHEALTH_CONSENT_CATEGORY,
    );
    return groupSessions.filter(
      (g) =>
        isSelfServiceGroupCategory(g.category) &&
        g.status !== "cancelled" &&
        !enrolled.has(g.id) &&
        (telehealthOk || !AdelanteEHR.groupVirtualExposure(g.id).virtual) &&
        AdelanteEHR.listGroupEnrollments(g.id).length < g.capacity,
    );
  },


  /**
   * Patient self-service enrollment. Self-service categories only — routed
   * through the same `enrollInGroup` write so there is one enrollment
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
    AdelanteEHR.notifyGroupChange({
      event: "enrollment_added",
      sessionId: input.sessionId,
      patientIds: [input.patientId],
      triggeredBy: { actorId: initiator.actorId, kind: initiator.kind === "patient" ? "patient" : "staff" },
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
    AdelanteEHR.notifyGroupChange({
      event: "enrollment_ended",
      sessionId: row.sessionId,
      patientIds: [row.patientId],
      triggeredBy: _groupTrigger(actor),
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
    const days = g.recurrence.daysOfWeek?.length ? g.recurrence.daysOfWeek : [first.getDay()];
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
    AdelanteEHR.notifyGroupChange({
      event: "occurrence_cancelled",
      sessionId,
      patientIds: _activeGroupEnrollees(sessionId),
      triggeredBy: _groupTrigger(actor),
      when: occurrenceStart,
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
    AdelanteEHR.notifyGroupChange({
      event: "occurrence_rescheduled",
      sessionId,
      patientIds: _activeGroupEnrollees(sessionId),
      triggeredBy: _groupTrigger(actor),
      when: occurrenceStart,
      newWhen: newStart,
    });
    emit();
    return { from, to };
  },

  /**
   * §Phase 6c — patient text notification for a group-access change.
   * Consent-to-text and phone-on-file are checked FIRST (same `isSmsOn` +
   * `phone` rule as appointment notifications); without both the attempt is
   * recorded as skipped and nothing is sent. Copy is Part 2-safe via
   * `composeGroupNotification`. Each attempt writes an attributed audit row
   * with no message body.
   */
  notifyGroupChange(input: {
    event: GroupNotificationEvent;
    sessionId: string;
    patientIds: string[];
    triggeredBy: GroupNotificationTrigger;
    when?: string;
    newWhen?: string;
  }) {
    const g = groupSessions.find((x) => x.id === input.sessionId);
    if (!g) return;
    for (const patientId of new Set(input.patientIds)) {
      const p = patients.find((x) => x.id === patientId);
      if (!p) continue;
      const { body, sensitive } = composeGroupNotification({
        event: input.event,
        category: g.category,
        topic: g.topic,
        when: input.when,
        newWhen: input.newWhen,
      });
      const smsOn = AdelanteEHR.isSmsOn(patientId);
      const skipReason = !smsOn ? "no_sms_consent" : !p.phone ? "no_phone" : undefined;
      const rec = dispatchGroupNotification({
        patientId,
        sessionId: g.id,
        event: input.event,
        sensitive,
        body,
        to: skipReason ? undefined : p.phone,
        triggeredBy: input.triggeredBy,
        skipReason,
      });
      if (!rec) continue;
      appendAudit({
        category: "clinical",
        action: "group_notification_attempted",
        patientId,
        actorId: input.triggeredBy.actorId,
        detail: {
          groupSessionId: g.id,
          notificationId: rec.id,
          event: input.event,
          sensitive,
          triggeredByKind: input.triggeredBy.kind,
          outcome: rec.delivery,
          ...(skipReason ? { skipReason } : {}),
        },
      });
    }
  },

  listGroupOccurrenceRecords: (sessionId: string) =>
    groupOccurrences.filter((o) => o.sessionId === sessionId),

  // §Group sessions — county configuration for the OPTIONAL group
  // confidentiality acknowledgment. Default OFF; not a DHCS mandate.
  isGroupConfidentialityAckRequired: () => groupConfig.requireConfidentialityAck,

  setGroupConfidentialityAckRequired(required: boolean, actor: string) {
    groupConfig.requireConfidentialityAck = required;
    appendAudit({
      category: "clinical",
      action: "group_confidentiality_ack_setting_changed",
      actorId: actor,
      detail: { required },
    });
    emit();
  },

  /** Effective modality for one occurrence (falls back to the session default). */
  groupOccurrenceModality(sessionId: string, occurrenceStart: string): GroupOccurrenceModality {
    const g = groupSessions.find((x) => x.id === sessionId);
    const occ = groupOccurrences.find(
      (o) => o.sessionId === sessionId && o.occurrenceStart === occurrenceStart,
    );
    return occ?.modality ?? defaultOccurrenceModality(g?.modality ?? "in_person");
  },

  setGroupOccurrenceModality(
    sessionId: string,
    occurrenceStart: string,
    modality: GroupOccurrenceModality,
    actor: string,
  ): GroupOccurrenceRecord {
    const g = groupSessions.find((x) => x.id === sessionId);
    if (!g) throw new Error("Group not found.");
    const row = _ensureGroupOccurrence(sessionId, occurrenceStart);
    row.modality = modality;
    row.modalitySetAt = new Date().toISOString();
    row.modalitySetBy = actor;
    appendAudit({
      category: "clinical",
      action: "group_occurrence_modality_set",
      actorId: actor,
      detail: { groupSessionId: sessionId, occurrenceStart, modality },
    });
    emit();
    return row;
  },

  /**
   * §Group sessions — per-member telehealth consent gate.
   *
   * REAL per-member check against the structured ConsentRecord ledger (same
   * `isConsentCategoryAuthorized` call every other consent gate uses — no
   * parallel consent mechanism, and no group-level "we asked everyone" flag).
   * An in-person occurrence returns `virtual: false` and blocks nobody.
   */
  groupOccurrenceConsentGate(
    sessionId: string,
    occurrenceStart: string,
  ): {
    modality: GroupOccurrenceModality;
    virtual: boolean;
    /** Rostered members missing ACTIVE telehealth consent. */
    blocked: { patientId: string; name: string }[];
    /** Rostered members missing the OPTIONAL confidentiality ack (when required). */
    confidentialityMissing: { patientId: string; name: string }[];
    confidentialityRequired: boolean;
  } {
    const modality = AdelanteEHR.groupOccurrenceModality(sessionId, occurrenceStart);
    const virtual = isVirtualGroupModality(modality);
    const confidentialityRequired = groupConfig.requireConfidentialityAck;
    const roster = AdelanteEHR.listGroupEnrollments(sessionId);
    const named = (patientId: string) => {
      const p = patients.find((x) => x.id === patientId);
      return { patientId, name: p ? `${p.firstName} ${p.lastName}` : patientId };
    };
    const blocked = virtual
      ? roster
          .filter(
            (e) =>
              !AdelanteEHR.isConsentCategoryAuthorized(e.patientId, TELEHEALTH_CONSENT_CATEGORY),
          )
          .map((e) => named(e.patientId))
      : [];
    const confidentialityMissing = confidentialityRequired
      ? roster
          .filter(
            (e) =>
              !AdelanteEHR.isConsentCategoryAuthorized(e.patientId, GROUP_CONFIDENTIALITY_CATEGORY),
          )
          .map((e) => named(e.patientId))
      : [];
    return { modality, virtual, blocked, confidentialityMissing, confidentialityRequired };
  },

  getGroupOccurrence(sessionId: string, occurrenceStart: string) {
    return groupOccurrences.find(
      (o) => o.sessionId === sessionId && o.occurrenceStart === occurrenceStart,
    );
  },

  /** Effective facilitator list for one occurrence (documented, else default). */
  groupOccurrenceFacilitators(
    sessionId: string,
    occurrenceStart: string,
  ): GroupFacilitatorMinutes[] {
    const g = groupSessions.find((x) => x.id === sessionId);
    if (!g) return [];
    const occ = AdelanteEHR.getGroupOccurrence(sessionId, occurrenceStart);
    return occ?.facilitators?.length ? occ.facilitators : defaultGroupFacilitators(g);
  },

  /** Effective designated rendering provider for one occurrence. */
  groupRenderingProviderId(sessionId: string, occurrenceStart: string): string {
    const occ = AdelanteEHR.getGroupOccurrence(sessionId, occurrenceStart);
    if (occ?.renderingProviderId) return occ.renderingProviderId;
    return defaultRenderingProviderId(
      AdelanteEHR.groupOccurrenceFacilitators(sessionId, occurrenceStart),
    );
  },

  /**
   * Change the designated rendering provider for ONE occurrence. Only a
   * facilitator of that occurrence is eligible — the rendering provider must
   * have actually delivered direct care.
   */
  setGroupRenderingProvider(
    sessionId: string,
    occurrenceStart: string,
    staffId: string,
    actor: string,
  ): GroupOccurrenceRecord {
    const g = groupSessions.find((x) => x.id === sessionId);
    if (!g) throw new Error("Group not found.");
    const eligible = AdelanteEHR.groupOccurrenceFacilitators(sessionId, occurrenceStart);
    if (!eligible.some((f) => f.staffId === staffId))
      throw new Error("The rendering provider must be one of this meeting's facilitators.");
    const row = _ensureGroupOccurrence(sessionId, occurrenceStart);
    row.renderingProviderId = staffId;
    row.renderingProviderSetAt = new Date().toISOString();
    row.renderingProviderSetBy = actor;
    appendAudit({
      category: "clinical",
      action: "group_rendering_provider_set",
      actorId: actor,
      detail: { groupSessionId: sessionId, occurrenceStart, renderingProviderId: staffId },
    });
    emit();
    return row;
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
    /**
     * Full facilitator list with INDEPENDENT per-provider direct-care minutes.
     * Omitted = derived from the session (primary + co-facilitators, session
     * length each).
     */
    facilitators?: GroupFacilitatorMinutes[];
    /** Designated rendering provider; defaults to the primary facilitator. */
    renderingProviderId?: string;
    /** patientId -> that patient's individualized participation narrative. */
    perAttendee: Record<string, string>;
    /**
     * How this meeting was actually delivered. Persisted onto the occurrence
     * and stamped onto every attendee note.
     */
    modality?: GroupOccurrenceModality;
    actor: string;
  }): { occurrence: GroupOccurrenceRecord; attendeeNoteIds: string[] } {
    const g = groupSessions.find((x) => x.id === input.sessionId);
    if (!g) throw new Error("Group not found.");
    const row = _ensureGroupOccurrence(input.sessionId, input.occurrenceStart);
    if (input.modality) {
      row.modality = input.modality;
      row.modalitySetAt = new Date().toISOString();
      row.modalitySetBy = input.actor;
    }
    const modality = row.modality ?? defaultOccurrenceModality(g.modality);
    // §Multi-facilitator: independent minutes per provider, one note per client.
    const facilitators = normalizeGroupFacilitators(input.facilitators, g);
    const renderingProviderId =
      input.renderingProviderId ??
      row.renderingProviderId ??
      defaultRenderingProviderId(facilitators);
    if (!facilitators.some((f) => f.staffId === renderingProviderId))
      throw new Error("The rendering provider must be one of this meeting's facilitators.");
    row.facilitators = facilitators;
    row.renderingProviderId = renderingProviderId;
    row.renderingProviderSetAt = new Date().toISOString();
    row.renderingProviderSetBy = input.actor;
    const present = row.attendance.filter((a) => a.status !== "absent");
    if (present.length === 0) throw new Error("Record attendance before documenting.");
    // §Group sessions — telehealth gate. Per-member, live against the
    // ConsentRecord ledger, and only for a virtual occurrence.
    if (isVirtualGroupModality(modality)) {
      const missing = present.filter(
        (a) => !AdelanteEHR.isConsentCategoryAuthorized(a.patientId, TELEHEALTH_CONSENT_CATEGORY),
      );
      if (missing.length > 0) {
        const names = missing
          .map((a) => {
            const p = patients.find((x) => x.id === a.patientId);
            return p ? `${p.firstName} ${p.lastName}` : a.patientId;
          })
          .join(", ");
        throw new Error(
          `Telehealth consent is required before virtual participation: ${names}. Capture consent, or record them as not attending this meeting.`,
        );
      }
    }
    if (groupConfig.requireConfidentialityAck) {
      const missing = present.filter(
        (a) =>
          !AdelanteEHR.isConsentCategoryAuthorized(a.patientId, GROUP_CONFIDENTIALITY_CATEGORY),
      );
      if (missing.length > 0)
        throw new Error(
          "This county requires a group confidentiality acknowledgment from every attendee before documenting.",
        );
    }
    // Occurrence-level DHCS rule: fewer than 2 present = individual session in
    // practice, so no group claim. The occurrence still happens and is still
    // documented — only the billing flag changes.
    const occurrenceBillable = isOccurrenceBillable(g.category, present.length);
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
      // Every individualized note renders the FULL facilitator list with each
      // provider's own involvement and minutes — the one-note-per-client
      // convention WITHOUT collapsing distinct provider durations.
      const facilitatorLines = facilitators
        .map((f) => {
          const s = clinicians.find((c) => c.id === f.staffId);
          const name = s?.name ?? f.staffId;
          const label = f.role === "primary" ? "primary facilitator" : "co-facilitator";
          const rendering =
            f.staffId === renderingProviderId ? "; designated rendering provider" : "";
          return `${name} (${label}${rendering}) — ${f.minutes} min direct care${f.involvement ? `: ${f.involvement}` : ""}`;
        })
        .join(" | ");
      const saved = AdelanteEHR.addProgressNote(a.patientId, {
        clinicianId: input.facilitatorId,
        date: input.occurrenceStart,
        sessionType: "group",
        subjective: input.perAttendee[a.patientId]!.trim(),
        objective: `Attendance: ${a.status}. Delivered: ${modality.replace("_", " ")}. Group topic: ${g.topic}. Facilitators: ${facilitatorLines}.`,
        assessment: "",
        plan: "",
        category: "group",
        status: "draft",
        groupRef: {
          sessionId: g.id,
          occurrenceStart: input.occurrenceStart,
          facilitatorId: input.facilitatorId,
          facilitators: facilitators.map((f) => ({ ...f })),
          renderingProviderId,
          billingEligible: occurrenceBillable,
          billingCode: occurrenceBillable ? groupBillingCode(g.category) : undefined,
          modality,
          category: g.category,
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
        modality,
        facilitators: facilitators.map((f) => `${f.staffId}:${f.minutes}m`),
        renderingProviderId,
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

// ---------------------------------------------------------------------------
// §Phase 6b DEMO SEED — group sessions + a real mix of group-audit events.
//
// Built entirely through the real store API (never by pushing rows), so every
// event on /group-audit is produced exactly the way a clinician would produce
// it: eligibility set, eligibility later removed, and enrollments genuinely
// refused by `assertEnrollmentAllowed` for three different real reasons.
// Remove with the rest of the mock store.
// ---------------------------------------------------------------------------
withGroupNotificationsSuppressed(() => {
  try {
    const THERAPIST = "Marisol Vega, LCSW";
    const facilitator = AdelanteEHR.listClinicians()[0]?.id;
    if (facilitator) {
      const soon = (days: number, hour: number) => {
        const d = new Date();
        d.setDate(d.getDate() + days);
        d.setHours(hour, 0, 0, 0);
        return d.toISOString();
      };

      const skills = AdelanteEHR.createGroupSession({
        topic: "Skills for everyday life (placeholder curriculum)",
        description:
          "Practical coping and daily-living skills. Curriculum name is a placeholder pending clinical content sign-off.",
        facilitatorId: facilitator,
        serviceType: "therapy_group",
        modality: "in_person",
        category: "skills_education",
        start: soon(2, 10),
        durationMin: 60,
        capacity: 8,
        recurrence: { kind: "weekly", daysOfWeek: [new Date(soon(2, 10)).getDay()] },
        createdBy: THERAPIST,
      });

      const virtualGroup = AdelanteEHR.createGroupSession({
        topic: "Recovery check-in — online (placeholder curriculum)",
        description: "Open check-in group that meets by video.",
        facilitatorId: facilitator,
        serviceType: "therapy_group",
        modality: "video",
        category: "open_psychoeducational",
        start: soon(4, 14),
        durationMin: 45,
        capacity: 10,
        recurrence: { kind: "weekly", daysOfWeek: [new Date(soon(4, 14)).getDay()] },
        createdBy: THERAPIST,
      });
      AdelanteEHR.setGroupVirtualRoom(
        virtualGroup.id,
        "https://video.adelante.mock/room/recovery-checkin",
        THERAPIST,
      );

      const sudGroup = AdelanteEHR.createGroupSession({
        topic: "SUD group counseling (placeholder curriculum)",
        facilitatorId: facilitator,
        serviceType: "therapy_group",
        modality: "in_person",
        category: "sud_clinical_preauth",
        start: soon(3, 13),
        durationMin: 90,
        capacity: 8,
        recurrence: { kind: "weekly", daysOfWeek: [new Date(soon(3, 13)).getDay()] },
        createdBy: THERAPIST,
      });

      // Eligibility set — the only path that opens any enrollment at all.
      AdelanteEHR.setGroupEligibility({
        patientId: "p1",
        reason: "Coping-skills goal on the care plan; ready for a group setting.",
        role: "therapist",
        actor: THERAPIST,
      });
      AdelanteEHR.setGroupEligibility({
        patientId: "p2",
        reason: "Considered for skills group during care-plan review.",
        role: "therapist",
        actor: THERAPIST,
      });

      // A real enrollment that succeeds (in-person, no telehealth consent needed).
      AdelanteEHR.enrollInGroup({ sessionId: skills.id, patientId: "p1", enrolledBy: THERAPIST });

      // Blocked #1 — virtual group, no active telehealth consent (Phase 6b gate).
      try {
        AdelanteEHR.enrollInGroup({
          sessionId: virtualGroup.id,
          patientId: "p1",
          enrolledBy: THERAPIST,
        });
      } catch {
        /* expected — the refusal IS the seeded audit event. */
      }

      // Blocked #2 — patient tries to self-book a staff-only SUD group.
      try {
        AdelanteEHR.enrollInGroup({
          sessionId: sudGroup.id,
          patientId: "p1",
          enrolledBy: "p1",
          initiator: { kind: "patient", actorId: "p1" },
        });
      } catch {
        /* expected */
      }

      // Blocked #3 — no eligibility flag at all.
      try {
        AdelanteEHR.enrollInGroup({ sessionId: skills.id, patientId: "p3", enrolledBy: THERAPIST });
      } catch {
        /* expected */
      }

      // Eligibility removed again after review — the third audit event type.
      AdelanteEHR.clearGroupEligibility(
        "p2",
        "Deferred at care-plan review — individual sessions first.",
        THERAPIST,
      );
    }
  } catch {
    /* Seeding is best-effort; never break boot. */
  }
});

// §Demo persona — pre-release patient with partner-reported social needs, so
// the "What your care team already knows" card and "justice not re-asked" can
// be shown without setup. Built only through the real store API (the same
// calls the pre-release roster import makes). Intake is deliberately left
// incomplete. Marked by `DEMO_PRE_RELEASE_PERSONA` so the switcher finds it.
/** Fields intake's "About you" writes through updateProfile. */
export type IntakeProfilePatch = Partial<
  Pick<
    Patient,
    | "preferredName"
    | "pronouns"
    | "preferredLanguage"
    | "phone"
    | "releaseDate"
    | "contactPrefs"
    | "emergencyContacts"
    | "address"
  >
>;

export const DEMO_PRE_RELEASE_PERSONA = { firstName: "Tomás", lastName: "Reyna" } as const;
try {
  const exists = patients.some(
    (p) =>
      p.firstName === DEMO_PRE_RELEASE_PERSONA.firstName &&
      p.lastName === DEMO_PRE_RELEASE_PERSONA.lastName,
  );
  if (!exists) {
    const release = new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);
    const { episode } = AdelanteEHR.openPreReleaseEpisodeForNewPatient({
      firstName: DEMO_PRE_RELEASE_PERSONA.firstName,
      lastName: DEMO_PRE_RELEASE_PERSONA.lastName,
      dob: "1991-03-14",
      anticipatedReleaseDate: release,
      cfCareManagerStaffId: "s-cf2",
      // Matches the staff directory record for s-cf2 exactly (not s-cf1,
      // whose name would collide with the Rosa demo persona).
      cfCareManagerName: "Darnell Pope (facility contract)",
      facilityName: "Tulare County Adult Pre-Trial Facility",
      openedBy: "s-cf2",
      actorRole: "cf_care_manager",
    });
    AdelanteEHR.recordImportedHrsnDomains({
      episodeId: episode.id,
      domains: [
        { key: "housing", label: "Housing instability & quality", positive: true },
        { key: "food", label: "Food insecurity", positive: true },
        { key: "transportation", label: "Transportation", positive: false },
        { key: "safety", label: "Interpersonal safety", positive: true },
      ],
      importedBy: "s-cf2",
      actorRole: "cf_care_manager",
    });
  }
} catch {
  /* Demo seed is best-effort; never break boot. */
}
