// §4 — Acting staff role + record-class RBAC matrix.
// Additive layer on top of the existing persona routing; never replaces it.

import { useSyncExternalStore } from "react";
import { AdelanteEHR, type ConsentCategory, type Patient, type ProgressNote } from "./ehr";

export type StaffRole =
  | "ecm_provider"
  | "peer_specialist"
  | "therapist"
  | "pmhnp"
  | "billing"
  | "clinical_coordinator"
  | "credentialing_coordinator"
  | "billing_coordinator"
  | "sys_admin";

export const STAFF_ROLES: { key: StaffRole; label: string }[] = [
  { key: "ecm_provider", label: "Case manager" },
  { key: "peer_specialist", label: "Peer specialist" },
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
  | "group_notes";

export type AccessLevel = "none" | "read" | "write" | "summary" | "consent_gated";

// Matrix mirrors §4b. `consent_gated` = read/write allowed only when the
// matching Part-2 consent is currently granted.
const MATRIX: Record<RecordClass, Partial<Record<StaffRole, AccessLevel>>> = {
  demographics: {
    ecm_provider: "write",
    peer_specialist: "read",
    therapist: "read",
    pmhnp: "read",
    billing: "read",
  },
  screeners_mh: {
    ecm_provider: "write",
    peer_specialist: "read",
    therapist: "read",
    pmhnp: "read",
  },
  screeners_sud: {
    ecm_provider: "consent_gated",
    peer_specialist: "consent_gated",
    // Policy: therapist and pmhnp are both direct treating clinicians with a
    // legitimate clinical need to know SUD status without a separate consent
    // gate. ecm_provider/peer_specialist stay gated because care coordination
    // is not clinical treatment — that distinction is the actual line.
    therapist: "read",
    pmhnp: "read",
  },
  psych_eval: { ecm_provider: "read", peer_specialist: "read", therapist: "read", pmhnp: "write" },
  care_plan: { ecm_provider: "write", peer_specialist: "read", therapist: "write", pmhnp: "write" },
  therapy_notes: { therapist: "write", pmhnp: "read", ecm_provider: "read" },
  meds_erx: { pmhnp: "write", therapist: "read", ecm_provider: "read" },
  telehealth_room: {
    pmhnp: "write",
    therapist: "write",
    ecm_provider: "read",
    peer_specialist: "none" as AccessLevel,
  },
  sdoh: { ecm_provider: "write", peer_specialist: "write", therapist: "write", pmhnp: "write" },
  self_help: {
    ecm_provider: "write",
    peer_specialist: "write",
    therapist: "write",
    pmhnp: "write",
  },
  sud_treatment: {
    pmhnp: "write",
    therapist: "consent_gated",
    ecm_provider: "consent_gated",
    peer_specialist: "consent_gated",
    billing: "consent_gated",
  },
  case_notes: { ecm_provider: "write", peer_specialist: "read", therapist: "read", pmhnp: "read" },
  peer_notes: { peer_specialist: "write", ecm_provider: "read", therapist: "read", pmhnp: "read" },
  documents: { ecm_provider: "write", therapist: "read", pmhnp: "read" },
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
  },
  allergies: {
    pmhnp: "write",
    therapist: "write",
    ecm_provider: "read",
    peer_specialist: "read",
    clinical_coordinator: "read",
  },
  alerts: {
    pmhnp: "write",
    therapist: "write",
    ecm_provider: "write",
    peer_specialist: "read",
    clinical_coordinator: "read",
  },
  eligibility: {
    ecm_provider: "write",
    billing: "write",
    billing_coordinator: "write",
    therapist: "read",
    pmhnp: "read",
    clinical_coordinator: "read",
  },
  care_coordination: {
    ecm_provider: "write",
    therapist: "write",
    pmhnp: "write",
    peer_specialist: "read",
    clinical_coordinator: "read",
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
    sys_admin: "read",
    billing: "none",
    billing_coordinator: "none",
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
  },
  // §Group sessions — documentation. Gated EXACTLY like `sud_treatment`, just
  // pointed at the `group_participation` consent category. No parallel check:
  // every group note flows through canAccess() like any other note.
  group_notes: {
    therapist: "write",
    pmhnp: "write",
    ecm_provider: "consent_gated",
    peer_specialist: "consent_gated",
    clinical_coordinator: "consent_gated",
    billing: "consent_gated",
  },
};

/**
 * §ASCMI — which structured consent category unlocks each consent-gated
 * record class. Placeholder categories (see CONSENT_CATEGORIES in ehr.ts).
 */
const CONSENT_GATE_CATEGORY: Partial<Record<RecordClass, ConsentCategory>> = {
  screeners_sud: "sud_treatment",
  sud_treatment: "sud_treatment",
  // OPEN QUESTION (Christi): is group participation legally its own ASCMI
  // category, or covered by general treatment consent? Placeholder mapping.
  group_notes: "group_participation",
};

/**
 * Which record class gates a given note. One place, so masking can never
 * diverge between the chart, print/export and autofill.
 */
export function noteGateClass(
  note: Pick<ProgressNote, "category" | "restrictedTier">,
): RecordClass | undefined {
  if (note.restrictedTier === "psychotherapy_notes") return "psychotherapy_notes";
  if (note.category === "sud") return "screeners_sud";
  if (note.category === "group") return "group_notes";
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
];

export function canFlagCrisis(role: StaffRole): boolean {
  return CRISIS_FLAG_ROLES.includes(role);
}

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
}

export const STAFF_ROSTER: StaffMember[] = [
  { id: "s-cm1", name: "Luz Herrera", role: "ecm_provider", credential: "CCM" },
  { id: "s-peer1", name: "Andre Willis", role: "peer_specialist", credential: "CPSS" },
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
