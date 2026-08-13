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

// §Advocate build 3 — the SAME rule, one axis over.
//
// A staff viewer's Part 2 access comes from the RBAC matrix; an advocate's
// comes from `advocateSudAccess` (tier + an active advocate_sud_disclosure
// consent). The masking decision is otherwise identical, and deliberately has
// NOTHING to do with communication rights: an advocate with full messaging
// authorization and no Part 2 disclosure on file still sees the placeholder.

export function isAdvocateMessageBodyMasked(
  message: Pick<CareMessage, "sudFlagged">,
  part2Unmasked: boolean,
): boolean {
  return Boolean(message.sudFlagged) && !part2Unmasked;
}

export function visibleAdvocateMessageBody(
  message: Pick<CareMessage, "sudFlagged" | "body">,
  part2Unmasked: boolean,
): string {
  return isAdvocateMessageBodyMasked(message, part2Unmasked)
    ? MASKED_MESSAGE_BODY
    : message.body;
}
