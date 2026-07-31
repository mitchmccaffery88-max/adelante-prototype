// §Clinical documentation sign / cosign — eligibility rules.
//
// KNOWN SIMPLIFICATION vs. the reference EMR: signer eligibility is decided by
// STAFF ROLE, not by a credentialing lookup. Adelante has no
// credentialing-to-signing integration (licenses live in
// /admin-credentialing but are not consulted here), so a license expiry does
// not currently block signing.
import { NOTE_SELF_SIGN_ROLES, noteStatus, type ProgressNote } from "@/lib/ehr";
import { witnessCandidates } from "@/lib/mar";
import type { StaffMember, StaffRole } from "@/lib/roles";

/** Roles allowed to put a signature (or cosignature) on a clinical note. */
export function canSignNotes(role: StaffRole): boolean {
  return (NOTE_SELF_SIGN_ROLES as readonly string[]).includes(role);
}

/** pmhnp / therapist self-sign; everyone else must route to a cosigner. */
export function requiresCosign(role: StaffRole): boolean {
  return !canSignNotes(role);
}

/**
 * Eligible cosigner pool — the same STAFF_ROSTER-derived clinical pool used for
 * MAR controlled-substance witnesses and refusal co-signatures.
 */
export function cosignerCandidates(excludeName?: string): StaffMember[] {
  return witnessCandidates(excludeName);
}

/** Is this pending note in the acting person's own cosign queue? */
export function isMyCosign(
  note: ProgressNote,
  actor: { role: StaffRole; staffName: string },
): boolean {
  if (noteStatus(note) !== "cosign_pending") return false;
  if (!canSignNotes(actor.role)) return false;
  if (note.signedBy === actor.staffName) return false;
  // Empty/undefined cosignRole = any eligible clinical role.
  if (!note.cosignRole?.length) return true;
  return note.cosignRole.includes(actor.role);
}