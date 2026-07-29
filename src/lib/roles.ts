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
  | "care_coordination";

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
    therapist: "consent_gated",
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
  const role = useSyncExternalStore(subscribe, () => acting, () => acting);
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
  const id = useSyncExternalStore(subscribe, () => actingStaffId, () => actingStaffId);
  const role = useSyncExternalStore(subscribe, () => acting, () => acting);
  const member = getStaffMember(id) ?? STAFF_ROSTER[0];
  return {
    role,
    staffId: member.id,
    staffName: member.name,
    clinicianId: member.clinicianId,
    setActingStaff,
  };
}
