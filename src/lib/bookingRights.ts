// §Scheduling S2 — who may book / reschedule / cancel, and on whose calendar.
// DRAFT — pending clinical sign-off. Pure rules: no store import (ehr.ts calls
// this inside bookAppointment / staffRescheduleAppointment / staffCancel).
//
// Three separate people on every booking:
//   ACTOR            — who books (audit)
//   PATIENT          — who it is for (caseload scope)
//   TARGET CLINICIAN — whose calendar (never empty)
import type { StaffRole } from "./roles";

export const BOOKING_RIGHTS_DRAFT_LABEL = "Draft — pending clinical sign-off";

/** any = every patient; caseload = only my caseload; clinician = unchanged clinician behaviour; none = no booking. */
export type BookingScope = "any" | "caseload" | "clinician" | "none";

export interface BookingRight {
  scope: BookingScope;
  reschedule: boolean;
  /** direct = cancel with reason; request = ask the coordinator to confirm. */
  cancel: "direct" | "request" | "none";
  /** May book substance-use / ASAM visit types (existing Part 2 limits). */
  sudVisits: boolean;
  /** Has an own calendar (a clinician record). */
  ownCalendar: boolean;
}

const CLINICIAN: BookingRight = { scope: "clinician", reschedule: true, cancel: "direct", sudVisits: true, ownCalendar: true };
const NONE: BookingRight = { scope: "none", reschedule: false, cancel: "none", sudVisits: false, ownCalendar: false };

export const BOOKING_RIGHTS: Partial<Record<StaffRole, BookingRight>> = {
  clinical_coordinator: { scope: "any", reschedule: true, cancel: "direct", sudVisits: true, ownCalendar: false },
  ecm_provider: { scope: "caseload", reschedule: true, cancel: "direct", sudVisits: false, ownCalendar: false },
  cf_care_manager: { scope: "caseload", reschedule: true, cancel: "direct", sudVisits: false, ownCalendar: false },
  peer_specialist: { scope: "caseload", reschedule: true, cancel: "request", sudVisits: false, ownCalendar: false },
  community_health_worker: { scope: "caseload", reschedule: true, cancel: "request", sudVisits: false, ownCalendar: false },
  sud_counselor: { scope: "caseload", reschedule: true, cancel: "direct", sudVisits: true, ownCalendar: true },
  therapist: CLINICIAN,
  pmhnp: CLINICIAN,
  physician: CLINICIAN,
  clinical_trainee: CLINICIAN,
  billing: NONE,
  sys_admin: NONE,
};

export function bookingRightFor(role: StaffRole | string | undefined): BookingRight {
  return (role && BOOKING_RIGHTS[role as StaffRole]) || NONE;
}

/** Roles that may book at all (registry + store). */
export function canScheduleRole(role: StaffRole | string | undefined): boolean {
  return bookingRightFor(role).scope !== "none";
}

export const SUD_SERVICE_TYPES = ["sud_counseling", "sud_group_odf", "sud_group_iot"] as const;
export const isSudServiceType = (s?: string) => !!s && (SUD_SERVICE_TYPES as readonly string[]).includes(s);
/** Prescriber / MAT visits go only to physician or PMHNP calendars. */
export const PRESCRIBER_SERVICE_TYPES = ["med_management"] as const;
export const isPrescriberServiceType = (s?: string) => !!s && (PRESCRIBER_SERVICE_TYPES as readonly string[]).includes(s);

export type BookingOp = "book" | "reschedule" | "cancel";
export type BookingCheck = { ok: true } | { ok: false; reason: string; next: string };

export function checkBookingRights(input: {
  role: StaffRole | string;
  op: BookingOp;
  inCaseload: boolean;
  serviceType?: string;
  asam?: boolean;
}): BookingCheck {
  const r = bookingRightFor(input.role);
  if (r.scope === "none")
    return { ok: false, reason: "Your role does not book visits.", next: "Ask a clinical coordinator to schedule this visit." };
  if (input.op === "reschedule" && !r.reschedule)
    return { ok: false, reason: "Your role can't reschedule visits.", next: "Ask a clinical coordinator." };
  if (input.op === "cancel" && r.cancel !== "direct")
    return r.cancel === "request"
      ? { ok: false, reason: "Your role can request a cancellation, not cancel directly.", next: "Use “Request cancellation” — a clinical coordinator confirms it." }
      : { ok: false, reason: "Your role can't cancel visits.", next: "Ask a clinical coordinator." };
  if (r.scope === "caseload" && !input.inCaseload)
    return { ok: false, reason: "This person isn't on your caseload.", next: "Ask a clinical coordinator to schedule for them." };
  if ((isSudServiceType(input.serviceType) || input.asam) && !r.sudVisits)
    return { ok: false, reason: "This visit type isn't available to your role.", next: "Send the request to a clinical coordinator." };
  return { ok: true };
}
