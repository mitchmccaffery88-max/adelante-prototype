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
  | "sys_admin";

export const STAFF_ROLES: { key: StaffRole; label: string }[] = [
  { key: "case_manager", label: "Case manager" },
  { key: "peer_specialist", label: "Peer specialist" },
  { key: "therapist", label: "Therapist" },
  { key: "pmhnp", label: "PMHNP" },
  { key: "billing", label: "Billing coordinator" },
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
  | "consent_ledger";

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
let acting: StaffRole = (() => {
  try {
    const v = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    return (v as StaffRole) || "case_manager";
  } catch {
    return "case_manager";
  }
})();
const subs = new Set<() => void>();

export function setActingRole(role: StaffRole) {
  acting = role;
  try {
    window.localStorage.setItem(KEY, role);
  } catch {
    /* no-op */
  }
  subs.forEach((s) => s());
}
export function getActingRole(): StaffRole {
  return acting;
}
export function useActingRole(): [StaffRole, (r: StaffRole) => void] {
  const role = useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
    () => acting,
    () => acting,
  );
  return [role, setActingRole];
}
