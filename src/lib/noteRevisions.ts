// §Signed-note revisions — pure rules (no store import) shared by the store
// and the UI: late entry, who may add an addendum / amend / approve a void.

/** Late-entry threshold. DRAFT value — pending clinical sign-off. */
export const LATE_ENTRY_HOURS = 24;
export const LATE_ENTRY_DRAFT_NOTE = `Late entry = signed more than ${LATE_ENTRY_HOURS} h after the visit. Draft — pending clinical sign-off.`;

export function isLateEntry(visitISO: string | undefined, signedISO: string | undefined): boolean {
  if (!visitISO || !signedISO) return false;
  return +new Date(signedISO) - +new Date(visitISO) > LATE_ENTRY_HOURS * 3600_000;
}

/** Clinicians with a treatment need to know who may add an addendum to someone else's note. */
export const ADDENDUM_ROLES = ["pmhnp", "physician", "therapist", "sud_counselor", "clinical_trainee"] as const;

/** Roles that may approve a void (besides the author's assigned supervisor). */
export const VOID_APPROVER_ROLES = ["clinical_coordinator", "sys_admin"] as const;

export type NoteRevisionAction =
  | "addendum"
  | "amended"
  | "recosign_required"
  | "void_requested"
  | "void_approved"
  | "void_declined";

export const NOTE_REVISION_LABEL: Record<NoteRevisionAction, string> = {
  addendum: "Addendum added",
  amended: "Corrected (new version)",
  recosign_required: "Re-cosign required",
  void_requested: "Void requested",
  void_approved: "Voided — entered in error",
  void_declined: "Void declined",
};

export const CLAIM_REVIEW_CORRECTED = "Clinical documentation corrected — review claim";
export const CLAIM_BLOCKED_VOIDED = "Blocked: clinical documentation voided";
