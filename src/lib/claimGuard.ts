// §B3 — ONE claim guardrail (Christi crosswalk 9.6). Every claim-creation
// entry point in ehr-ext.ts calls `assertClaimable` before it mints a claim,
// so "can this service ever become a claim" has exactly one answer.
// Billing stays on hold — this is a guardrail only, it never creates claims.
// Draft — pending billing / clinical sign-off.
import { AdelanteEHR, GROUP_MIN_BILLABLE_ATTENDEES, isBillableGroupCategory, type Appointment } from "./ehr";
import { isAfbiId, AFBI_NOT_CLAIMABLE } from "./afbiGuard";
import { STAFF_ROSTER, type StaffRole } from "./roles";

export const CLAIM_GUARD_DRAFT_LABEL = "Draft — pending billing sign-off";

/** Every place in the app that can mint a claim. A new one must be added here AND call the guard. */
export const CLAIM_ENTRY_POINTS = [
  "upsertClaimFromEncounter",
  "createAsamClaim",
  "upsertClaimFromGroupAttendee",
  "upsertClaimFromPeerNote",
  "upsertClaimFromChwNote",
] as const;
export type ClaimEntryPoint = (typeof CLAIM_ENTRY_POINTS)[number];

/** Staff roles that never render a billable service (Draft). */
export const NON_BILLING_STAFF_ROLES: readonly StaffRole[] = ["billing", "billing_coordinator", "credentialing_coordinator", "sys_admin"];

const CLOSED_VISIT = new Set(["cancelled", "no_show", "late_cancel", "rescheduled"]);

export interface ClaimableInput {
  entry: ClaimEntryPoint;
  patientId?: string;
  /** Source record ids handed to the entry point (visit, note, session…). */
  sourceIds: unknown[];
  appointment?: Pick<Appointment, "status" | "fundingLane" | "clinicianId">;
  /** Clinician id or staff id that would render the service. */
  renderingId?: string;
  group?: { sessionId: string; occurrenceStart: string };
  /** Explicit non-billable tag from the source record. */
  nonBillable?: boolean;
}

/** Why this service can never become a claim, or undefined when it may. */
export function claimRefusal(input: ClaimableInput): string | undefined {
  if (input.sourceIds.some(isAfbiId)) return AFBI_NOT_CLAIMABLE;
  if (input.nonBillable) return "This service is tagged non-billable.";
  const a = input.appointment;
  if (a?.fundingLane === "non_billable") return "This service is tagged non-billable.";
  if (a && CLOSED_VISIT.has(a.status)) return "A cancelled or missed visit cannot create a claim.";
  if (input.group) {
    const session = AdelanteEHR.getGroupSession(input.group.sessionId);
    if (session && !isBillableGroupCategory(session.category)) return "Open groups are never billed.";
    if (session) {
      const present = (AdelanteEHR.getGroupOccurrence(input.group.sessionId, input.group.occurrenceStart)?.attendance ?? []).filter((x) => x.status !== "absent");
      if (present.length < GROUP_MIN_BILLABLE_ATTENDEES) return "Fewer than 2 present — not a group claim.";
    }
  }
  const rid = input.renderingId ?? a?.clinicianId;
  if (rid) {
    const staff = STAFF_ROSTER.find((m) => m.id === rid || m.clinicianId === rid);
    const clinician = AdelanteEHR.getClinician(rid);
    // Advocates (and anyone else outside staff) can never claim for themselves.
    if (!staff && !clinician) return "Only staff can render a billable service.";
    if (staff && NON_BILLING_STAFF_ROLES.includes(staff.role)) return "This staff role never renders billable services.";
    if (staff && (staff as { active?: boolean }).active === false) return "This staff member is deactivated.";
  }
  return undefined;
}

/** Throws when the service can never become a claim. Every entry point calls this. */
export function assertClaimable(input: ClaimableInput): void {
  const why = claimRefusal(input);
  if (why) throw new Error(why);
}

/** For entry points that return null instead of throwing. */
export function isClaimable(input: ClaimableInput): boolean {
  return claimRefusal(input) === undefined;
}
