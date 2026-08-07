// §v3.0 role architecture — Phase 3.
//
// Billing RULES for the two community-based roles (Peer Specialist,
// Community Health Worker). This module owns policy only: code selection,
// unit math, supervision + CHW/ECM mutual exclusivity. The actual claim rows
// are created by `AdelanteEHRExt` (same `claims` list the Claims Worklist
// already reads), exactly like the group-session per-attendee hook — no
// second claims pipeline.
//
// Lives outside ehr-ext.ts because it needs the staff roster (roles.ts), and
// roles.ts imports ehr.ts; keeping the policy here avoids an import cycle.

import type { Patient } from "./ehr";
import { getStaffMember, supervisionStatus } from "./roles";

/** Peer support services taxonomy (informational, carried on the claim). */
export const PEER_SUPPORT_TAXONOMY = "175T00000X";
/** HCPCS: individual peer support per 15 min / group peer support. */
export const PEER_CODES = { individual: "H0038", group: "H0025" } as const;
export const PEER_UNIT_MINUTES = 15;

/**
 * HCPCS for CHW services: G0019 is the service following an initiating visit,
 * G0022 covers additional time in the same month. 30-minute units, capped at
 * 2 hours (four units) per calendar day.
 */
export const CHW_CODES = { initiating: "G0019", additional: "G0022" } as const;
export const CHW_UNIT_MINUTES = 30;
export const CHW_MAX_UNITS_PER_DAY = 4;

export interface BillingDecision {
  allowed: boolean;
  /** Stable machine code for audit rows / tests. */
  reasonCode?: string;
  reason?: string;
  serviceCode?: string;
  taxonomy?: string;
  units?: number;
  /** Enrolled provider the claim is billed through (CHW). */
  supervisingStaffId?: string;
}

// ----- ECM enrollment window ----------------------------------------------
//
// There is no dedicated "ECM enrollment" entity in the data model. What DOES
// exist is `Patient.episodes`, which already carries `type: "ecm"` with
// `openedAt` / `closedAt` — i.e. a real enrollment window, not something that
// has to be inferred from case status. A `declined` episode state is treated
// as never-enrolled, which is the DHCS carve-out CHW may bill under.

export interface EcmWindow {
  episodeId: string;
  openedAt: string;
  closedAt?: string;
  state: string;
}

const day = (iso: string) => iso.slice(0, 10);

export function ecmWindows(patient: Pick<Patient, "episodes">): EcmWindow[] {
  return (patient.episodes ?? [])
    .filter((e) => e.type === "ecm" && e.state !== "declined")
    .map((e) => ({ episodeId: e.id, openedAt: e.openedAt, state: e.state, closedAt: e.closedAt }));
}

/** The ECM window covering `dateISO`, if the member is enrolled that day. */
export function activeEcmWindowOn(
  patient: Pick<Patient, "episodes">,
  dateISO: string,
): EcmWindow | undefined {
  const d = day(dateISO);
  return ecmWindows(patient).find(
    (w) => day(w.openedAt) <= d && (!w.closedAt || day(w.closedAt) >= d),
  );
}

// ----- Peer Specialist ------------------------------------------------------

export function peerBillingDecision(input: {
  staffId?: string | null;
  mode?: string;
  minutes: number;
}): BillingDecision {
  const staff = getStaffMember(input.staffId);
  if (!staff || staff.role !== "peer_specialist")
    return {
      allowed: false,
      reasonCode: "not_peer_specialist",
      reason: "Only a Peer Specialist can generate a peer support claim.",
    };
  if (input.minutes <= 0)
    return {
      allowed: false,
      reasonCode: "no_service_time",
      reason: "Peer support claims require documented service time.",
    };
  const group = input.mode === "group";
  return {
    allowed: true,
    serviceCode: group ? PEER_CODES.group : PEER_CODES.individual,
    taxonomy: PEER_SUPPORT_TAXONOMY,
    // Group peer support is a session-level code; individual is per 15 min.
    units: group ? 1 : Math.max(1, Math.ceil(input.minutes / PEER_UNIT_MINUTES)),
  };
}

// ----- Community Health Worker ---------------------------------------------

export function chwBillingDecision(input: {
  patient: Pick<Patient, "episodes">;
  staffId?: string | null;
  dateISO: string;
  minutes: number;
  /** CHW units already claimed for this member on this calendar day. */
  unitsAlreadyBilledToday: number;
  /** True when a CHW claim already exists for this member this month. */
  hasPriorClaimThisMonth: boolean;
}): BillingDecision {
  const staff = getStaffMember(input.staffId);
  if (!staff || staff.role !== "community_health_worker")
    return {
      allowed: false,
      reasonCode: "not_chw",
      reason: "Only a Community Health Worker can generate a CHW services claim.",
    };

  // Supervision is a billing prerequisite, not a formality.
  const sup = supervisionStatus(staff.id);
  if (!sup.satisfied)
    return {
      allowed: false,
      reasonCode: "no_supervising_provider",
      reason:
        sup.reason ??
        "CHW services must be billed through an enrolled supervising provider.",
    };

  // MUTUAL EXCLUSIVITY: DHCS prohibits billing standalone CHW services while
  // the member is enrolled in ECM. Enforced HERE, at the claim attempt, with
  // an audit row — the same discipline as the open-group billing split.
  const ecm = activeEcmWindowOn(input.patient, input.dateISO);
  if (ecm)
    return {
      allowed: false,
      reasonCode: "ecm_concurrent",
      reason: `Member is enrolled in ECM (episode ${ecm.episodeId}, opened ${day(
        ecm.openedAt,
      )}${ecm.closedAt ? `, closes ${day(ecm.closedAt)}` : ""}). Standalone CHW services cannot be billed concurrently with ECM.`,
    };

  if (input.minutes <= 0)
    return {
      allowed: false,
      reasonCode: "no_service_time",
      reason: "CHW claims require documented service time.",
    };

  const remaining = CHW_MAX_UNITS_PER_DAY - input.unitsAlreadyBilledToday;
  if (remaining <= 0)
    return {
      allowed: false,
      reasonCode: "daily_unit_cap",
      reason: `Daily CHW limit reached (${CHW_MAX_UNITS_PER_DAY} × ${CHW_UNIT_MINUTES}-minute units = 2 hours).`,
    };

  const requested = Math.max(1, Math.ceil(input.minutes / CHW_UNIT_MINUTES));
  return {
    allowed: true,
    serviceCode: input.hasPriorClaimThisMonth ? CHW_CODES.additional : CHW_CODES.initiating,
    units: Math.min(requested, remaining),
    supervisingStaffId: sup.supervisor?.id,
  };
}