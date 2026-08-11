// §4 — Acting staff role + record-class RBAC matrix.
// Additive layer on top of the existing persona routing; never replaces it.

import { useSyncExternalStore } from "react";
import {
  AdelanteEHR,
  type ConsentCategory,
  type GroupCategory,
  type Patient,
  type ProgressNote,
} from "./ehr";

export type StaffRole =
  | "ecm_provider"
  // §v3.0 role architecture — Correctional Facility Care Manager. Works the
  // pre-release D90→0 countdown inside/with the facility; distinct from the
  // ECM Provider, whose D0–90 program clock starts AT release. Deliberately
  // given a thin record-class grant list: their surface is the CF task list /
  // Reentry Care Plan (Phase 2), not the full chart.
  | "cf_care_manager"
  | "sud_counselor"
  | "clinical_trainee"
  | "medical_assistant"
  | "peer_specialist"
  // §v3.0 Phase 3 — Community Health Worker. Non-licensed community-based
  // role that documents CHW services (G0019/G0022) billed through an
  // enrolled supervising provider; see SUPERVISION_REQUIRED_ROLES below.
  | "community_health_worker"
  | "therapist"
  | "pmhnp"
  | "billing"
  | "clinical_coordinator"
  | "credentialing_coordinator"
  | "billing_coordinator"
  | "sys_admin";

export const STAFF_ROLES: { key: StaffRole; label: string }[] = [
  { key: "ecm_provider", label: "ECM Provider" },
  { key: "cf_care_manager", label: "CF Care Manager" },
  { key: "sud_counselor", label: "SUD Counselor" },
  { key: "clinical_trainee", label: "Clinical Trainee" },
  { key: "medical_assistant", label: "Medical Assistant" },
  { key: "peer_specialist", label: "Peer specialist" },
  { key: "community_health_worker", label: "Community Health Worker" },
  { key: "therapist", label: "Therapist" },
  { key: "pmhnp", label: "PMHNP" },
  { key: "billing", label: "Billing coordinator" },
  { key: "clinical_coordinator", label: "Clinical coordinator" },
  { key: "credentialing_coordinator", label: "Credentialing coordinator" },
  { key: "billing_coordinator", label: "Billing coordinator (expanded)" },
  { key: "sys_admin", label: "System admin" },
];

export type RecordClass =
  | "demographics"
  | "screeners_mh"
  | "screeners_sud"
  | "psych_eval"
  | "care_plan"
  | "therapy_notes"
  | "meds_erx"
  | "telehealth_room"
  | "sdoh"
  | "self_help"
  | "sud_treatment"
  // §ASCMI stricter tier — see PSYCHOTHERAPY_NOTES_TIER note below.
  | "psychotherapy_notes"
  | "case_notes"
  | "peer_notes"
  // §v3.0 Phase 3 — CHW service documentation. Its own class (not `peer_notes`)
  // because the two roles bill under different HCPCS families and neither
  // should be able to author the other's record.
  | "chw_notes"
  | "documents"
  | "billing"
  | "consent_ledger"
  | "problems"
  | "allergies"
  | "alerts"
  | "eligibility"
  | "care_coordination"
  | "custody_tracking"
  // §Facility & Custody reorg — physical controlled-substance stock and
  // chain-of-custody reconciliation. Deliberately NOT `custody_tracking`
  // (facility/incarceration) and NOT `meds_erx` (prescribing/transmission):
  // an outpatient site counts a narcotics box without doing facility work.
  | "controlled_substance_custody"
  | "population_health"
  | "crisis_queue"
  | "patient_messaging"
  | "provider_requests"
  | "worklist"
  | "note_templates"
  | "catalog_governance"
  | "scheduling_rules"
  // §Group sessions — managing the group itself (schedule, roster, attendance).
  | "group_sessions"
  // §Group sessions — the clinical documentation produced by a group.
  | "group_notes"
  // §Quality pass Group A — who supervises whom. Workforce configuration, not
  // patient data: it decides billability of supervised roles, so it sits in
  // the same config tier as note_templates / scheduling_rules rather than
  // getting a parallel permission system of its own.
  | "staff_supervision"
  // §Front-door Phase 3 (Tier 2) — operating the sign-up / code-redemption
  // front door ON SOMEONE'S BEHALF. A record class, not a new permission
  // concept: it slots into the same matrix, the same canAccess() call and the
  // same nav gate as every other surface.
  | "assisted_signup";

export type AccessLevel = "none" | "read" | "write" | "summary" | "consent_gated";

// Matrix mirrors §4b. `consent_gated` = read/write allowed only when the
// matching Part-2 consent is currently granted.
const MATRIX: Record<RecordClass, Partial<Record<StaffRole, AccessLevel>>> = {
  demographics: {
    ecm_provider: "write",
    // §v3.0 — new roles. Each grant below was decided per-class, not copied
    // from ecm_provider: cf_care_manager only needs identity to work the
    // pre-release list; clinical_trainee / medical_assistant read only.
    cf_care_manager: "read",
    sud_counselor: "write",
    clinical_trainee: "read",
    medical_assistant: "read",
    peer_specialist: "read",
    community_health_worker: "read",
    therapist: "read",
    pmhnp: "read",
    billing: "read",
  },
  screeners_mh: {
    ecm_provider: "write",
    sud_counselor: "read",
    clinical_trainee: "read",
    peer_specialist: "read",
    therapist: "read",
    pmhnp: "read",
  },
  screeners_sud: {
    ecm_provider: "consent_gated",
    peer_specialist: "consent_gated",
    // DMC-ODS: the SUD counselor IS the treating provider for this material,
    // so they sit with therapist/pmhnp, not with coordination roles.
    sud_counselor: "read",
    // A trainee treats under supervision but is not the consent holder.
    clinical_trainee: "consent_gated",
    medical_assistant: "none",
    cf_care_manager: "none",
    // Policy: therapist and pmhnp are both direct treating clinicians with a
    // legitimate clinical need to know SUD status without a separate consent
    // gate. ecm_provider/peer_specialist stay gated because care coordination
    // is not clinical treatment — that distinction is the actual line.
    therapist: "read",
    pmhnp: "read",
  },
  psych_eval: {
    ecm_provider: "read",
    peer_specialist: "read",
    therapist: "read",
    pmhnp: "write",
    sud_counselor: "read",
    clinical_trainee: "read",
  },
  care_plan: {
    ecm_provider: "write",
    peer_specialist: "read",
    therapist: "write",
    pmhnp: "write",
    sud_counselor: "write",
    clinical_trainee: "read",
    cf_care_manager: "read",
  },
  // A trainee may AUTHOR a note; they can never self-sign it —
  // NOTE_SELF_SIGN_ROLES (ehr.ts) is pmhnp/therapist only, so every trainee
  // note routes for cosignature by construction.
  therapy_notes: {
    therapist: "write",
    pmhnp: "read",
    ecm_provider: "read",
    sud_counselor: "read",
    clinical_trainee: "write",
  },
  // Medical assistant reads the med list to support MAT administration; the
  // write path is NOT here — see canRecordMatAdministration(), which also
  // requires an active supervision link.
  meds_erx: {
    pmhnp: "write",
    therapist: "read",
    ecm_provider: "read",
    medical_assistant: "read",
    clinical_trainee: "read",
  },
  telehealth_room: {
    pmhnp: "write",
    therapist: "write",
    sud_counselor: "write",
    clinical_trainee: "read",
    ecm_provider: "read",
    peer_specialist: "none" as AccessLevel,
  },
  sdoh: {
    ecm_provider: "write",
    peer_specialist: "write",
    community_health_worker: "write",
    therapist: "write",
    pmhnp: "write",
    sud_counselor: "write",
    cf_care_manager: "write",
  },
  self_help: {
    ecm_provider: "write",
    peer_specialist: "write",
    therapist: "write",
    pmhnp: "write",
    sud_counselor: "write",
  },
  sud_treatment: {
    pmhnp: "write",
    therapist: "consent_gated",
    sud_counselor: "write",
    clinical_trainee: "consent_gated",
    ecm_provider: "consent_gated",
    peer_specialist: "consent_gated",
    billing: "consent_gated",
  },
  case_notes: {
    ecm_provider: "write",
    peer_specialist: "read",
    community_health_worker: "read",
    therapist: "read",
    pmhnp: "read",
    sud_counselor: "write",
    clinical_trainee: "write",
    cf_care_manager: "read",
  },
  peer_notes: { peer_specialist: "write", ecm_provider: "read", therapist: "read", pmhnp: "read" },
  chw_notes: {
    community_health_worker: "write",
    ecm_provider: "read",
    therapist: "read",
    pmhnp: "read",
    clinical_coordinator: "read",
  },
  documents: {
    ecm_provider: "write",
    therapist: "read",
    pmhnp: "read",
    sud_counselor: "read",
    cf_care_manager: "read",
    medical_assistant: "read",
  },
  billing: { billing: "write" },
  consent_ledger: {
    // §ASCMI — consent capture must be writable by someone. ecm_provider
    // writes because they are the role that actually sits with the patient
    // and captures the form; sys_admin writes for correction/administration.
    // Clinical roles stay read-only: reading the ledger is need-to-know,
    // authoring a legal consent instrument is not part of their workflow.
    ecm_provider: "write",
    peer_specialist: "read",
    therapist: "read",
    pmhnp: "read",
    billing: "read",
    sys_admin: "write",
    // DMC-ODS consent is captured at intake by the counselor too.
    sud_counselor: "write",
    cf_care_manager: "read",
  },
  /**
   * §ASCMI psychotherapy-notes tier — SCAFFOLD ONLY, DEFAULT DENY.
   * Strictly more restrictive than `screeners_sud` / `sud_treatment`: no role
   * has access, and SUD consent does NOT unlock it (ASCMI does not authorize
   * release of psychotherapy notes). Deliberately UNAPPLIED to any real
   * template or note today — deciding which documentation qualifies is a
   * clinical-content call and needs clinical author sign-off (Christi /
   * Dr. Bagga) before anything is tagged with it.
   */
  psychotherapy_notes: {},
  // Clinical record layer (BaggaEMR mirror). Prescribers (pmhnp) and
  // therapists write; ecm_provider / peer_specialist can read for
  // coordination; billing reads Problems only for claim coding.
  problems: {
    pmhnp: "write",
    therapist: "write",
    ecm_provider: "read",
    peer_specialist: "read",
    billing: "read",
    clinical_coordinator: "read",
    sud_counselor: "read",
    clinical_trainee: "read",
    medical_assistant: "read",
  },
  allergies: {
    pmhnp: "write",
    therapist: "write",
    ecm_provider: "read",
    peer_specialist: "read",
    clinical_coordinator: "read",
    sud_counselor: "read",
    clinical_trainee: "read",
    medical_assistant: "read",
  },
  alerts: {
    pmhnp: "write",
    therapist: "write",
    ecm_provider: "write",
    peer_specialist: "read",
    clinical_coordinator: "read",
    sud_counselor: "read",
    clinical_trainee: "read",
    medical_assistant: "read",
  },
  eligibility: {
    ecm_provider: "write",
    billing: "write",
    billing_coordinator: "write",
    therapist: "read",
    pmhnp: "read",
    clinical_coordinator: "read",
    sud_counselor: "read",
    cf_care_manager: "read",
  },
  care_coordination: {
    ecm_provider: "write",
    therapist: "write",
    pmhnp: "write",
    peer_specialist: "read",
    community_health_worker: "write",
    clinical_coordinator: "read",
    sud_counselor: "write",
    // Reentry coordination is the CF Care Manager's entire job.
    cf_care_manager: "write",
    clinical_trainee: "read",
  },
  // §Custody tracking (bookings, housing moves, released search). Custody
  // status is coordination data, so case management owns the write path;
  // clinicians read it for context. Billing gets nothing — custody history is
  // not claim-relevant and would be an unnecessary exposure.
  custody_tracking: {
    ecm_provider: "write",
    clinical_coordinator: "write",
    therapist: "read",
    pmhnp: "read",
    peer_specialist: "read",
    sys_admin: "read",
    // Pre-release work happens inside the facility record.
    cf_care_manager: "write",
  },
  // §Facility & Custody reorg — controlled-substance custody: physical stock
  // on hand and chain-of-custody reconciliation (Shift count).
  //
  // Why this is its own class and not one of the two it sits between:
  //  - NOT `meds_erx`: that class is e-prescribing / pharmacy routing — an
  //    order leaving the building. A shift count is about the tangible stock
  //    in the cabinet; the two can be granted to different people.
  //  - NOT `custody_tracking`: in this codebase "custody" there means
  //    facility/incarceration (Released Patient Search, Facilities, booking
  //    episodes). Gating Shift count on it would force facility permissions
  //    onto an outpatient site that merely reconciles sample/emergency stock,
  //    breaking the exact use case this separation exists to serve.
  //
  // Starting grant deliberately MIRRORS `meds_erx` exactly, so this reorg is
  // access-neutral: nobody who can reach Shift count today loses it. Tightening
  // it (e.g. dropping the two read roles, or adding clinical_coordinator as a
  // second signer) is a follow-on policy decision, not a refactor side effect.
  controlled_substance_custody: {
    pmhnp: "write",
    therapist: "read",
    ecm_provider: "read",
    // §v3.0 — kept exactly mirrored to `meds_erx` for the new roles too, so
    // the access-neutrality invariant in navSections.test.ts still holds.
    medical_assistant: "read",
    clinical_trainee: "read",
  },
  // §Population health dashboards. Cross-patient aggregate + drill-down to
  // PHI, and revenue-adjacent, so this is read-by-default and write only for
  // the two roles that own reporting configuration:
  //  - sys_admin: config/oversight tier (KPI targets are operational config,
  //    not clinical authorship), consistent with its role elsewhere.
  //  - clinical_coordinator: owns the clinical targets themselves.
  // Billing + billing_coordinator read (revenue-relevant), clinical roles
  // read, peer_specialist gets nothing — aggregate cross-patient exposure is
  // outside the peer scope everywhere else in this matrix.
  population_health: {
    sys_admin: "write",
    clinical_coordinator: "write",
    billing: "read",
    billing_coordinator: "read",
    pmhnp: "read",
    therapist: "read",
    ecm_provider: "read",
    peer_specialist: "none",
  },
  // §Clinical documentation templates. Authoring a template is clinical
  // configuration, not patient care: sys_admin + clinical_coordinator write,
  // documenting clinicians read (they pick templates when writing notes),
  // billing gets nothing — template structure is not claim data.
  note_templates: {
    sys_admin: "write",
    clinical_coordinator: "write",
    pmhnp: "read",
    therapist: "read",
    ecm_provider: "read",
    peer_specialist: "read",
  },
  // §Admin governance — frequency catalog + local RxNav suppressions. Same
  // tier as note_templates/KPI targets: sys_admin + clinical_coordinator own
  // the config, prescribing/administering roles read it (they see WHY a
  // product is missing from search), billing gets nothing.
  catalog_governance: {
    sys_admin: "write",
    clinical_coordinator: "write",
    pmhnp: "read",
    therapist: "read",
    ecm_provider: "read",
    peer_specialist: "none",
    billing: "none",
    billing_coordinator: "none",
  },
  // §Crisis escalation queue. Cross-patient, NOT patient-scoped, and more
  // clinically sensitive than population_health with no revenue angle:
  // clinical_coordinator + sys_admin write (they own disposition), the
  // treating clinical roles read. Billing, billing_coordinator, and
  // peer_specialist are deliberately excluded — peers can still FLAG a crisis
  // from a patient record, they just don't get population-wide visibility.
  crisis_queue: {
    sys_admin: "write",
    clinical_coordinator: "write",
    pmhnp: "read",
    therapist: "read",
    ecm_provider: "read",
    peer_specialist: "none",
    billing: "none",
    billing_coordinator: "none",
  },
  // §Patient<->clinician messaging (Phase 2). Its own class rather than
  // reusing `case_notes`: case_notes gives therapist/pmhnp read-only, but a
  // clinician who can see a patient's message must be able to answer it.
  // Treating roles write, peer_specialist reads (they coordinate but don't
  // own the reply), clinical_coordinator reads for oversight, billing gets
  // nothing — message content is not claim data.
  patient_messaging: {
    ecm_provider: "write",
    therapist: "write",
    pmhnp: "write",
    peer_specialist: "read",
    clinical_coordinator: "read",
    sys_admin: "read",
    billing: "none",
    billing_coordinator: "none",
    sud_counselor: "write",
    cf_care_manager: "read",
    clinical_trainee: "read",
    medical_assistant: "none",
  },
  // §Inbox — provider request queue. Its own class because the traffic runs
  // BOTH directions: a case manager asks a prescriber to enter an order, a
  // prescriber asks a therapist a question. So every role that can be on
  // either end gets write (create + claim + complete); peer_specialist and
  // clinical_coordinator read for coordination/oversight; billing is out —
  // these are clinical asks, not claim data.
  provider_requests: {
    ecm_provider: "write",
    therapist: "write",
    pmhnp: "write",
    clinical_coordinator: "read",
    peer_specialist: "read",
    sys_admin: "read",
    billing: "none",
    billing_coordinator: "none",
    sud_counselor: "write",
    clinical_trainee: "read",
    medical_assistant: "read",
    cf_care_manager: "none",
  },
  // §Worklist Phase A — cross-facility operational task table. NOT
  // patient-scoped, so it follows the crisis_queue / population_health
  // reasoning: the roles that actually do and claim the work write;
  // oversight roles read; revenue roles get nothing because operational task
  // assignment is not claim data. peer_specialist reads (they coordinate on
  // shared work) but does not claim — one difference from crisis_queue, where
  // peers get "none": a worklist row is routine operational work, not
  // population-wide clinical risk exposure.
  worklist: {
    ecm_provider: "write",
    therapist: "write",
    pmhnp: "write",
    clinical_coordinator: "read",
    peer_specialist: "read",
    community_health_worker: "write",
    sys_admin: "read",
    billing: "none",
    billing_coordinator: "none",
    sud_counselor: "write",
    // CF task list lands here in Phase 2; write so they can claim their rows.
    cf_care_manager: "write",
    clinical_trainee: "read",
    medical_assistant: "read",
  },
  // §Scheduling rule engine — admin config that MANUFACTURES worklist rows.
  // Same tier as note_templates / KPI targets / catalog_governance:
  // sys_admin + clinical_coordinator author the rules, the roles that work
  // the resulting tasks read them (so a task's `source: "rule:…"` tag is
  // explainable), revenue roles get nothing.
  scheduling_rules: {
    sys_admin: "write",
    clinical_coordinator: "write",
    pmhnp: "read",
    therapist: "read",
    ecm_provider: "read",
    peer_specialist: "none",
    billing: "none",
    billing_coordinator: "none",
  },
  // §Group sessions — scheduling/roster management. Group placement is a
  // clinical decision, so the roles that make it (therapist, pmhnp,
  // ecm_provider) write; clinical_coordinator writes for the same oversight
  // reason it owns protocols and crisis disposition; peer_specialist reads
  // (they co-facilitate and need the schedule) but does not place patients;
  // billing reads because group attendance drives per-attendee claims.
  group_sessions: {
    therapist: "write",
    pmhnp: "write",
    ecm_provider: "write",
    clinical_coordinator: "write",
    sys_admin: "write",
    peer_specialist: "read",
    billing: "read",
    billing_coordinator: "read",
    sud_counselor: "write",
    clinical_trainee: "read",
  },
  // §Quality pass Group A — supervision assignment. Write is the workforce
  // oversight tier: sys_admin (system of record) + clinical_coordinator (owns
  // clinical staffing, exactly as it owns protocols, crisis disposition and
  // scheduling rules). LPHA supervisors read so they can see who is attached
  // to them; the supervised roles read their OWN status through the banner.
  // Nobody else — this is not patient data and not billing data.
  staff_supervision: {
    sys_admin: "write",
    clinical_coordinator: "write",
    therapist: "read",
    pmhnp: "read",
    clinical_trainee: "read",
    medical_assistant: "read",
    community_health_worker: "read",
  },
  // §Front-door Phase 3 — Tier 2 assisted sign-up. Write for exactly the
  // roles that sit with a person at the moment of enrollment:
  //  - ecm_provider: owns D0–90 enrollment and already writes demographics;
  //  - cf_care_manager: issues the RE- code, so is the natural person to help
  //    claim it when the release-day hand-off happens in the room;
  //  - peer_specialist: the whole point of the role is walking alongside
  //    someone through exactly this step.
  // sys_admin writes for correction/support. Everyone else is omitted: this
  // creates identity records and consumes single-use enrollment codes, and
  // no other role does enrollment work.
  assisted_signup: {
    ecm_provider: "write",
    cf_care_manager: "write",
    peer_specialist: "write",
    sys_admin: "write",
  },
// §Group sessions — documentation. Gated EXACTLY like `sud_treatment`, and
  // now pointed at the `sud_treatment` category itself: the old
  // `group_participation` placeholder was repurposed into telehealth consent
  // and an OPTIONAL confidentiality acknowledgment, neither of which is a
  // legitimate gate on clinical note visibility (an optional, default-off ack
  // would silently unlock/lock the chart). No parallel check: every group
  // note still flows through canAccess() like any other note.
  group_notes: {
    therapist: "write",
    pmhnp: "write",
    ecm_provider: "consent_gated",
    peer_specialist: "consent_gated",
    clinical_coordinator: "consent_gated",
    billing: "consent_gated",
    sud_counselor: "write",
    clinical_trainee: "consent_gated",
  },
};

/**
 * §ASCMI — which structured consent category unlocks each consent-gated
 * record class. Placeholder categories (see CONSENT_CATEGORIES in ehr.ts).
 */
const CONSENT_GATE_CATEGORY: Partial<Record<RecordClass, ConsentCategory>> = {
  screeners_sud: "sud_treatment",
  sud_treatment: "sud_treatment",
  // Only SUD-clinical group notes ever reach this class (noteGateClass()
  // routes the two non-SUD categories away from it), so `sud_treatment` is
  // the honest mapping. Telehealth/confidentiality consents gate
  // PARTICIPATION, not record visibility, and live in the occurrence flow.
  group_notes: "sud_treatment",
};

/**
 * Which record class gates a given note. One place, so masking can never
 * diverge between the chart, print/export and autofill.
 */
export function noteGateClass(
  note: Pick<ProgressNote, "category" | "restrictedTier"> &
    Partial<Pick<ProgressNote, "groupRef">>,
): RecordClass | undefined {
  if (note.restrictedTier === "psychotherapy_notes") return "psychotherapy_notes";
  if (note.category === "sud") return "screeners_sud";
  if (note.category === "group") {
    // §Group notes — category-aware. Only `sud_clinical_preauth` is genuine
    // 42 CFR Part 2 treatment content, so only it routes through the
    // consent-gated `group_notes` class. `skills_education` and
    // `open_psychoeducational` are not SUD-sensitive: they fall back to the
    // SAME tier ordinary (non-Part 2) progress notes already use — no record
    // class at all, i.e. chart access governs. That is the existing tier, not
    // a new one. An unstamped legacy group note keeps the conservative
    // Part 2 gate.
    const cat = note.groupRef?.category;
    if (cat === "skills_education" || cat === "open_psychoeducational") return undefined;
    return "group_notes";
  }
  return undefined;
}

export function canAccess(
  role: StaffRole,
  cls: RecordClass,
  patient?: Patient,
): { level: AccessLevel; locked: boolean; reason?: string } {
  const level = MATRIX[cls]?.[role] ?? "none";
  if (level === "consent_gated") {
    // LIVE check against the structured ConsentRecord — never cached. Expiry
    // and revocation therefore stop access at the next call, with no other
    // code path needing to be notified.
    const category = CONSENT_GATE_CATEGORY[cls] ?? "sud_treatment";
    const granted = patient
      ? AdelanteEHR.isConsentCategoryAuthorized(patient.id, category)
      : false;
    return granted
      ? { level: "read", locked: false }
      : { level: "none", locked: true, reason: "42 CFR Part 2 — consent required" };
  }
  return { level, locked: level === "none" };
}

/**
 * §Crisis escalation — flagging is deliberately broader than the crisis QUEUE.
 * Anyone clinical-facing can observe a crisis and raise the flag; cross-patient
 * visibility and disposition remain gated by the `crisis_queue` record class.
 */
export const CRISIS_FLAG_ROLES: StaffRole[] = [
  "pmhnp",
  "therapist",
  "ecm_provider",
  "peer_specialist",
  "clinical_coordinator",
  "sys_admin",
  // §v3.0 — clinical-facing roles can raise a flag; cross-patient queue
  // visibility still comes from the `crisis_queue` class, which they lack.
  "sud_counselor",
  "clinical_trainee",
];

export function canFlagCrisis(role: StaffRole): boolean {
  return CRISIS_FLAG_ROLES.includes(role);
}

/**
 * §Front-door Phase 3 — Tier 2 gate. Derived FROM the matrix, never a second
 * list: change `assisted_signup` above and this follows automatically.
 */
export function canRunAssistedSignup(role: StaffRole): boolean {
  return canAccess(role, "assisted_signup").level === "write";
}

export const ASSISTED_SIGNUP_ROLES: StaffRole[] = STAFF_ROLES.map((r) => r.key).filter(
  canRunAssistedSignup,
);

/**
 * §Worklist Phase B — starting/stopping a withdrawal or safety protocol.
 * Deliberately NOT a new RecordClass: the rounds it produces are ordinary
 * `worklist` rows, and the only extra rule is WHO may initiate. Initiation is
 * clinical judgment (a scored withdrawal protocol is a treatment decision),
 * so it matches `NOTE_SELF_SIGN_ROLES`: pmhnp + therapist. clinical_coordinator
 * is included for the same oversight reason it owns crisis disposition.
 * ecm_provider / peer_specialist keep their `worklist` read/write on the rows
 * themselves — they can see and claim rounds, just not start or stop one.
 */
export const PROTOCOL_MANAGE_ROLES: StaffRole[] = ["pmhnp", "therapist", "clinical_coordinator"];

export function canManageProtocol(role: StaffRole): boolean {
  return PROTOCOL_MANAGE_ROLES.includes(role);
}

// ----- Acting-role store (localStorage-backed, subscribable) -----
const KEY = "adelante.actingRole";
const STAFF_KEY = "adelante.actingStaffId";

// ----- Seeded staff roster -----
// Adelante models authorship as a named person, not a role string. Every
// role has at least one seeded staff member so there is always a real
// identity available for authorship + per-record authorization.
export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  credential?: string;
  /** Links this staff member to a clinical provider record in AdelanteEHR. */
  clinicianId?: string;
  /**
   * §v3.0 supervision — id of the LPHA-tier StaffMember who supervises this
   * person. A real, queryable field (not a comment): roles in
   * SUPERVISION_REQUIRED_ROLES are not billable without it, and the
   * MAT-administration capability check reads it directly.
   */
  supervisedBy?: string;
  /**
   * §v3.0 CF Care Manager dual access mode.
   *  - "direct": facility/contract staff who log in themselves.
   *  - "proxy": a CF Care Manager who is NOT a platform user; their task-list
   *    activity is entered on their behalf by the receiving ECM Provider.
   * Only meaningful for `cf_care_manager`.
   */
  accessMode?: "direct" | "proxy";
}

export const STAFF_ROSTER: StaffMember[] = [
  { id: "s-cm1", name: "Luz Herrera", role: "ecm_provider", credential: "CCM" },
  {
    id: "s-cf1",
    name: "Rosa Delgado",
    role: "cf_care_manager",
    credential: "CF Care Manager",
    accessMode: "direct",
  },
  {
    // Not a platform user — exists so ECM Providers have a real identity to
    // attribute proxy-entered CF task-list activity to.
    id: "s-cf2",
    name: "Darnell Pope (facility contract)",
    role: "cf_care_manager",
    accessMode: "proxy",
  },
  { id: "s-sudc1", name: "Elena Vargas", role: "sud_counselor", credential: "SUDCC-II" },
  {
    id: "s-tr1",
    name: "Kayla Nguyen",
    role: "clinical_trainee",
    credential: "ASW",
    supervisedBy: "s-th1",
  },
  {
    id: "s-ma1",
    name: "Jorge Peña",
    role: "medical_assistant",
    credential: "CMA",
    supervisedBy: "s-np1",
  },
  { id: "s-peer1", name: "Andre Willis", role: "peer_specialist", credential: "CPSS" },
  {
    // §Phase 3 — CHW services are billed through an ENROLLED supervising
    // provider, so the supervision link is not optional paperwork: without it
    // `isBillableStaff` is false and no CHW claim can be created.
    id: "s-chw1",
    name: "Maribel Ortiz",
    role: "community_health_worker",
    credential: "CHW",
    supervisedBy: "s-np1",
  },
  {
    id: "s-th1",
    name: "Dr. Marisol Reyes",
    role: "therapist",
    credential: "LCSW",
    clinicianId: "c1",
  },
  {
    id: "s-th2",
    name: "Dr. James Okafor",
    role: "therapist",
    credential: "PsyD",
    clinicianId: "c2",
  },
  { id: "s-th3", name: "Anita Brooks", role: "therapist", credential: "LMFT", clinicianId: "c3" },
  { id: "s-np1", name: "Dr. R. Bagga", role: "pmhnp", credential: "PMHNP-BC" },
  { id: "s-bill1", name: "Tonya Price", role: "billing" },
  { id: "s-cc1", name: "Priya Raman", role: "clinical_coordinator" },
  { id: "s-cred1", name: "Marcus Webb", role: "credentialing_coordinator" },
  { id: "s-bc1", name: "Deneen Ford", role: "billing_coordinator" },
  { id: "s-admin1", name: "Adelante System Admin", role: "sys_admin" },
];

export function staffForRole(role: StaffRole): StaffMember[] {
  return STAFF_ROSTER.filter((s) => s.role === role);
}
export function getStaffMember(id: string | null | undefined): StaffMember | undefined {
  return STAFF_ROSTER.find((s) => s.id === id);
}

// ----- §v3.0 supervision relationship -------------------------------------
//
// Nothing in the codebase modelled supervision before this: notes have a
// cosign lifecycle (`cosignRequired` / `cosignedBy` in ehr.ts), but that is
// per-DOCUMENT attestation after the fact, not a standing person-to-person
// relationship — there is no "attending" concept anywhere. So this is new
// architecture, deliberately kept as a single link (`StaffMember.supervisedBy`)
// that both new supervised roles reuse rather than two parallel mechanisms.
// Note cosign continues to work exactly as before and is unaffected.

/** Roles that may hold a supervision link (LPHA tier). */
export const LPHA_SUPERVISOR_ROLES: StaffRole[] = ["therapist", "pmhnp"];

/**
 * Roles whose scope of practice REQUIRES documented supervision.
 *
 * §Phase 3 — `community_health_worker` joins the existing two rather than
 * getting a parallel "supervising provider" link: DHCS requires CHW services
 * to be billed through an enrolled supervising provider, which is exactly the
 * relationship `supervisedBy` already models (LPHA tier = enrolled provider
 * here). The billing gate reads `isBillableStaff` like everything else.
 */
export const SUPERVISION_REQUIRED_ROLES: StaffRole[] = [
  "clinical_trainee",
  "medical_assistant",
  "community_health_worker",
];

export function requiresSupervision(role: StaffRole): boolean {
  return SUPERVISION_REQUIRED_ROLES.includes(role);
}

/** The supervising staff member, if the link exists AND points at an LPHA. */
export function getSupervisor(staffId: string | null | undefined): StaffMember | undefined {
  const sup = getStaffMember(getStaffMember(staffId)?.supervisedBy);
  return sup && LPHA_SUPERVISOR_ROLES.includes(sup.role) ? sup : undefined;
}

export interface SupervisionStatus {
  required: boolean;
  supervisor?: StaffMember;
  /** True when the role's supervision requirement is met (or not required). */
  satisfied: boolean;
  /** Why it is not satisfied — surfaced as an "incomplete setup" flag. */
  reason?: string;
}

export function supervisionStatus(staffId: string | null | undefined): SupervisionStatus {
  const member = getStaffMember(staffId);
  if (!member) return { required: false, satisfied: false, reason: "Unknown staff member." };
  const required = requiresSupervision(member.role);
  if (!required) return { required: false, satisfied: true };
  const raw = getStaffMember(member.supervisedBy);
  if (!raw)
    return {
      required: true,
      satisfied: false,
      reason: "No supervising LPHA is assigned — supervision setup is incomplete.",
    };
  if (!LPHA_SUPERVISOR_ROLES.includes(raw.role))
    return {
      required: true,
      supervisor: raw,
      satisfied: false,
      reason: `${raw.name} is not an LPHA-tier supervisor (Therapist or PMHNP).`,
    };
  return { required: true, supervisor: raw, satisfied: true };
}

/**
 * Billable status for supervision-dependent roles. Phase 3 owns the actual
 * billing hooks; this is the gate they will call, so the rule ("no documented
 * supervision, not billable") exists as enforced code now rather than a note.
 */
export function isBillableStaff(staffId: string | null | undefined): boolean {
  return supervisionStatus(staffId).satisfied;
}

/**
 * Medical Assistant write scope: MAT medication-administration support only,
 * and only while a supervision link is in place. Reuses the trainee mechanism
 * above instead of inventing a second one, per the MA role definition.
 */
export function canRecordMatAdministration(staffId: string | null | undefined): boolean {
  const member = getStaffMember(staffId);
  if (!member) return false;
  if (member.role === "pmhnp" || member.role === "therapist") return true;
  if (member.role !== "medical_assistant") return false;
  return supervisionStatus(member.id).satisfied;
}

// ----- §Quality pass Group A — supervision administration ------------------
//
// One mutation path. It applies the SAME LPHA rule `supervisionStatus()`
// already enforces (LPHA_SUPERVISOR_ROLES) instead of re-deriving eligibility,
// so the admin screen can never write a link the status function would then
// reject. Every accepted change is audited and notifies subscribers, which is
// what makes the clinician banner a live read rather than a login snapshot.

/** Staff whose role requires supervision — the admin screen's working set. */
export function supervisedStaff(): StaffMember[] {
  return STAFF_ROSTER.filter((s) => requiresSupervision(s.role));
}

/** Everyone eligible to BE a supervisor (LPHA tier). */
export function supervisorCandidates(): StaffMember[] {
  return STAFF_ROSTER.filter((s) => LPHA_SUPERVISOR_ROLES.includes(s.role));
}

export interface SupervisionAssignResult {
  ok: boolean;
  reason?: string;
  status?: SupervisionStatus;
}

/**
 * Assign / change / clear (`supervisorId = null`) a supervision link.
 * Rejects a non-LPHA supervisor with the same wording `supervisionStatus()`
 * uses, so the negative case reads identically wherever it surfaces.
 */
export function assignSupervisor(
  staffId: string,
  supervisorId: string | null,
  actor?: { role?: StaffRole; staffId?: string; staffName?: string },
): SupervisionAssignResult {
  const member = getStaffMember(staffId);
  if (!member) return { ok: false, reason: "Unknown staff member." };
  if (!requiresSupervision(member.role))
    return { ok: false, reason: `${member.name}'s role does not carry a supervision link.` };

  const previous = member.supervisedBy;
  if (supervisorId) {
    const sup = getStaffMember(supervisorId);
    if (!sup) return { ok: false, reason: "Unknown supervisor." };
    if (sup.id === member.id)
      return { ok: false, reason: "A staff member cannot supervise themselves." };
    if (!LPHA_SUPERVISOR_ROLES.includes(sup.role))
      return {
        ok: false,
        reason: `${sup.name} is not an LPHA-tier supervisor (Therapist or PMHNP).`,
      };
    member.supervisedBy = sup.id;
  } else {
    delete member.supervisedBy;
  }

  supervisionRevision += 1;
  const status = supervisionStatus(member.id);
  AdelanteEHR.recordSupervisionChange({
    staffId: member.id,
    staffName: member.name,
    staffRole: member.role,
    previousSupervisorId: previous,
    supervisorId: member.supervisedBy,
    satisfied: status.satisfied,
    actorRole: actor?.role,
    actorId: actor?.staffId,
    actorName: actor?.staffName,
  });
  notify();
  return { ok: true, status };
}

let supervisionRevision = 0;

// ----- §v3.0 CF Care Manager proxy entry ----------------------------------

/**
 * Roles allowed to record CF Care Manager task-list activity on behalf of a
 * CF Care Manager who is not a direct platform user. The receiving ECM
 * Provider owns the hand-off, so they are the proxy; sys_admin for correction.
 */
export const CF_PROXY_ROLES: StaffRole[] = ["ecm_provider", "sys_admin"];

export interface CfProxyCheck {
  allowed: boolean;
  reason?: string;
}

/**
 * May `actorStaffId` enter CF work attributed to `onBehalfOfStaffId`?
 * A direct-login CF Care Manager is NOT proxyable — if they can log in, their
 * own entries must be their own.
 */
export function canProxyForCfCareManager(
  actorStaffId: string | null | undefined,
  onBehalfOfStaffId: string | null | undefined,
): CfProxyCheck {
  const actor = getStaffMember(actorStaffId);
  const subject = getStaffMember(onBehalfOfStaffId);
  if (!actor) return { allowed: false, reason: "Unknown acting staff member." };
  if (!subject || subject.role !== "cf_care_manager")
    return { allowed: false, reason: "Proxy entry only applies to CF Care Managers." };
  if (subject.accessMode !== "proxy")
    return {
      allowed: false,
      reason: `${subject.name} logs in directly — their activity cannot be proxy-entered.`,
    };
  if (!CF_PROXY_ROLES.includes(actor.role))
    return { allowed: false, reason: "Only an ECM Provider may enter CF activity on behalf." };
  return { allowed: true };
}

// ----- §v3.0 Phase 2 — pre-release form write scope ------------------------
//
// THE `eligibility` WRITE QUESTION. Phase 1 gave cf_care_manager
// `eligibility: "read"`. Phase 2 needs them to key SSApp / Pre-Release
// Screening data. Re-granting the whole class to "write" was rejected:
// `eligibility` also covers live coverage status, ECM/CalAIM lane assignment
// and the eligibility notes billing works from — a facility contractor
// keying a pre-release packet has no business editing any of that, and the
// grant would silently follow them everywhere the class is checked.
//
// So the write path is NARROW and workflow-scoped: the class stays "read",
// and writing happens only through `savePreReleaseForm`, which is reachable
// only for a form attached to a pre-release episode, and only for the two
// non-consent categories. Clinical & assessment is granted the same way and
// pointedly does NOT imply `therapy_notes` — structured screening flags are
// not narrative documentation.
export const PRE_RELEASE_FORM_WRITE_ROLES: StaffRole[] = [
  "cf_care_manager",
  "ecm_provider",
  "sys_admin",
];

export function canWritePreReleaseForm(
  role: StaffRole,
  category: "medi_cal_enrollment" | "clinical_assessment" | "release_consent" | "transition_planning",
): { allowed: boolean; reason?: string } {
  if (category === "release_consent")
    return {
      allowed: false,
      reason: "Release & consent forms are captured in the consent ledger, not here.",
    };
  if (!PRE_RELEASE_FORM_WRITE_ROLES.includes(role))
    return { allowed: false, reason: "Only CF Care Managers and ECM Providers work this list." };
  return { allowed: true };
}

/** Reading the pre-release surface at all (episode, checklist, care plan). */
export function canReadPreRelease(role: StaffRole): boolean {
  return canAccess(role, "care_coordination").level !== "none";
}

let acting: StaffRole = (() => {
  try {
    const v = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    return (v as StaffRole) || "ecm_provider";
  } catch {
    return "ecm_provider";
  }
})();

let actingStaffId: string = (() => {
  try {
    const v = typeof window !== "undefined" ? window.localStorage.getItem(STAFF_KEY) : null;
    const m = getStaffMember(v);
    if (m && m.role === acting) return m.id;
  } catch {
    /* no-op */
  }
  return staffForRole(acting)[0]?.id ?? STAFF_ROSTER[0].id;
})();

const subs = new Set<() => void>();
const notify = () => subs.forEach((s) => s());

function persist(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* no-op */
  }
}

export function setActingRole(role: StaffRole) {
  acting = role;
  persist(KEY, role);
  // Keep the acting identity consistent with the acting role.
  if (getStaffMember(actingStaffId)?.role !== role) {
    actingStaffId = staffForRole(role)[0]?.id ?? actingStaffId;
    persist(STAFF_KEY, actingStaffId);
  }
  notify();
}

/** Set the acting person; keeps the acting role in sync with their role. */
export function setActingStaff(staffId: string) {
  const m = getStaffMember(staffId);
  if (!m) return;
  actingStaffId = m.id;
  persist(STAFF_KEY, m.id);
  if (acting !== m.role) {
    acting = m.role;
    persist(KEY, m.role);
  }
  notify();
}
export function getActingRole(): StaffRole {
  return acting;
}
export function getActingStaff(): StaffMember {
  return getStaffMember(actingStaffId) ?? STAFF_ROSTER[0];
}

function subscribe(cb: () => void) {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}

export function useActingRole(): [StaffRole, (r: StaffRole) => void] {
  const role = useSyncExternalStore(
    subscribe,
    () => acting,
    () => acting,
  );
  return [role, setActingRole];
}

/**
 * First-class acting staff identity. Authorship fields should capture
 * `staffName` (human-readable, stable in the demo roster) and per-record
 * authorization should compare `clinicianId` / `staffId`.
 */
export function useActingStaff(): {
  role: StaffRole;
  staffId: string;
  staffName: string;
  clinicianId?: string;
  setActingStaff: (id: string) => void;
} {
  const id = useSyncExternalStore(
    subscribe,
    () => actingStaffId,
    () => actingStaffId,
  );
  const role = useSyncExternalStore(
    subscribe,
    () => acting,
    () => acting,
  );
  const member = getStaffMember(id) ?? STAFF_ROSTER[0];
  return {
    role,
    staffId: member.id,
    staffName: member.name,
    clinicianId: member.clinicianId,
    setActingStaff,
  };
}

/**
 * §Quality pass Group A — LIVE supervision status.
 * Subscribes to the same store `setActingStaff` notifies and re-reads
 * `supervisionStatus()` on every render, so a reassignment or revocation is
 * reflected immediately without a second status computation or a cache.
 */
export function useSupervisionStatus(staffId: string | null | undefined): SupervisionStatus {
  useSyncExternalStore(
    subscribe,
    () => supervisionRevision,
    () => supervisionRevision,
  );
  return supervisionStatus(staffId);
}
