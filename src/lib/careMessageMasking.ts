// §Messaging Part 2 gate — reuses the EXISTING consent mechanism.
//
// There is no automatic content detection here (still out of scope, still
// unsafe to fake). A human reviewer flags a specific message, and from then on
// the SAME `canAccess(role, "screeners_sud", patient)` check that masks SUD
// Problems and SUD screener tracking decides whether a staff viewer sees the
// body. Patients always see their own thread in full.
import type { CareMessage, Patient } from "./ehr";
import { canAccess, type StaffRole } from "./roles";

/** Same generic wording style as a masked SUD Problems entry. */
export const MASKED_MESSAGE_BODY = "Sensitive message — 42 CFR Part 2 consent required";

export function messageSudLocked(role: StaffRole, patient?: Patient): boolean {
  return canAccess(role, "screeners_sud", patient).locked;
}

/** True when THIS message's body must be hidden from THIS staff viewer. */
export function isMessageBodyMasked(
  message: Pick<CareMessage, "sudFlagged">,
  role: StaffRole,
  patient?: Patient,
): boolean {
  return Boolean(message.sudFlagged) && messageSudLocked(role, patient);
}

/** Body to render for a staff viewer — real text, or the generic placeholder. */
export function visibleMessageBody(
  message: Pick<CareMessage, "sudFlagged" | "body">,
  role: StaffRole,
  patient?: Patient,
): string {
  return isMessageBodyMasked(message, role, patient) ? MASKED_MESSAGE_BODY : message.body;
}
