// §4 — Acting staff role + record-class RBAC matrix.
// Additive layer on top of the existing persona routing; never replaces it.

import { useSyncExternalStore } from "react";
import { AdelanteEHR, type Patient } from "./ehr";

export type StaffRole =
  | "case_manager"
  | "peer_specialist"
  | "therapist"
  | "pmhnp"
  | "billing"
  | "clinical_coordinator"
  | "credentialing_coordinator"
  | "billing_coordinator"
  | "sys_admin";

export const STAFF_ROLES: { key: StaffRole; label: string }[] = [
  { key: "case_manager", label: "Case manager" },
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
  | "population_health"
  | "crisis_queue"
  | "patient_messaging"
  | "note_templates";

export type AccessLevel = "none" | "read" | "write" | "summary" | "consent_gated";

// Matrix mirrors §4b. `consent_gated` = read/write allowed only when the
// matching Part-2 consent is currently granted.
const MATRIX: Record<RecordClass, Partial<Record<StaffRole, AccessLevel>>> = {
  demographics: {
    case_manager: "write",
    peer_specialist: "read",
    therapist: "read",
    pmhnp: "read",
    billing: "read",
  },
  screeners_mh: {
    case_manager: "write",
    peer_specialist: "read",
    therapist: "read",
    pmhnp: "read",
  },
  screeners_sud: {
    case_manager: "consent_gated",
    peer_specialist: "consent_gated",
    // Policy: therapist and pmhnp are both direct treating clinicians with a
    // legitimate clinical need to know SUD status without a separate consent
    // gate. case_manager/peer_specialist stay gated because care coordination
    // is not clinical treatment — that distinction is the actual line.
    therapist: "read",
    pmhnp: "read",
  },
  psych_eval: { case_manager: "read", peer_specialist: "read", therapist: "read", pmhnp: "write" },
  care_plan: { case_manager: "write", peer_specialist: "read", therapist: "write", pmhnp: "write" },
  therapy_notes: { therapist: "write", pmhnp: "read", case_manager: "read" },
  meds_erx: { pmhnp: "write", therapist: "read", case_manager: "read" },
  telehealth_room: {
    pmhnp: "write",
    therapist: "write",
    case_manager: "read",
    peer_specialist: "none" as AccessLevel,
  },
  sdoh: { case_manager: "write", peer_specialist: "write", therapist: "write", pmhnp: "write" },
  self_help: {
    case_manager: "write",
    peer_specialist: "write",
    therapist: "write",
    pmhnp: "write",
  },
  sud_treatment: {
    pmhnp: "write",
    therapist: "consent_gated",
    case_manager: "consent_gated",
    peer_specialist: "consent_gated",
    billing: "consent_gated",
  },
  case_notes: { case_manager: "write", peer_specialist: "read", therapist: "read", pmhnp: "read" },
  peer_notes: { peer_specialist: "write", case_manager: "read", therapist: "read", pmhnp: "read" },
  documents: { case_manager: "write", therapist: "read", pmhnp: "read" },
  billing: { billing: "write" },
  consent_ledger: {
    case_manager: "read",
    peer_specialist: "read",
    therapist: "read",
    pmhnp: "read",
    billing: "read",
    sys_admin: "read",
  },
  // Clinical record layer (BaggaEMR mirror). Prescribers (pmhnp) and
  // therapists write; case_manager / peer_specialist can read for
  // coordination; billing reads Problems only for claim coding.
  problems: {
    pmhnp: "write",
    therapist: "write",
    case_manager: "read",
    peer_specialist: "read",
    billing: "read",
    clinical_coordinator: "read",
  },
  allergies: {
    pmhnp: "write",
    therapist: "write",
    case_manager: "read",
    peer_specialist: "read",
    clinical_coordinator: "read",
  },
  alerts: {
    pmhnp: "write",
    therapist: "write",
    case_manager: "write",
    peer_specialist: "read",
    clinical_coordinator: "read",
  },
  eligibility: {
    case_manager: "write",
    billing: "write",
    billing_coordinator: "write",
    therapist: "read",
    pmhnp: "read",
    clinical_coordinator: "read",
  },
  care_coordination: {
    case_manager: "write",
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
    case_manager: "write",
    clinical_coordinator: "write",
    therapist: "read",
    pmhnp: "read",
    peer_specialist: "read",
    sys_admin: "read",
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
    case_manager: "read",
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
    case_manager: "read",
    peer_specialist: "read",
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
    case_manager: "read",
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
    case_manager: "write",
    therapist: "write",
    pmhnp: "write",
    peer_specialist: "read",
    clinical_coordinator: "read",
    sys_admin: "read",
    billing: "none",
    billing_coordinator: "none",
  },
};

export function canAccess(
  role: StaffRole,
  cls: RecordClass,
  patient?: Patient,
): { level: AccessLevel; locked: boolean; reason?: string } {
  const level = MATRIX[cls]?.[role] ?? "none";
  if (level === "consent_gated") {
    const state = patient ? AdelanteEHR.getConsentState(patient.id) : null;
    const granted = Boolean(state?.part2Sud);
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
  "case_manager",
  "peer_specialist",
  "clinical_coordinator",
  "sys_admin",
];

export function canFlagCrisis(role: StaffRole): boolean {
  return CRISIS_FLAG_ROLES.includes(role);
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
  { id: "s-cm1", name: "Luz Herrera", role: "case_manager", credential: "CCM" },
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
    return (v as StaffRole) || "case_manager";
  } catch {
    return "case_manager";
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
