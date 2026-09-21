// §Clinical documentation sign / cosign — eligibility rules.
//
// KNOWN SIMPLIFICATION vs. the reference EMR: signer eligibility is decided by
// STAFF ROLE, not by a credentialing lookup. Adelante has no
// credentialing-to-signing integration (licenses live in
// /admin-credentialing but are not consulted here), so a license expiry does
// not currently block signing.
import { NOTE_SELF_SIGN_ROLES, noteStatus, type ProgressNote } from "@/lib/ehr";
import { witnessCandidates } from "@/lib/mar";
import { STAFF_ROSTER, supervisionStatus, type StaffMember, type StaffRole } from "@/lib/roles";


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
// ----- §EHR audit Phase 1a — who may sign a given note -------------------
//
// Notes carry an author token (`clinicianId ?? staffId`, see `useActingStaff`),
// so the roster lookup has to accept either form.
export function staffForAuthorToken(token: string | undefined): StaffMember | undefined {
  const t = (token ?? "").trim();
  if (!t) return undefined;
  return STAFF_ROSTER.find((m) => m.id === t || m.clinicianId === t);
}

export interface NoteSignAuthorization {
  allowed: boolean;
  /** True when the actor is signing as the author's supervising LPHA. */
  asSupervisor: boolean;
  /** True when the signature will route to a cosigner rather than complete. */
  routesToCosign: boolean;
  reason?: string;
}

export interface NoteSignActor {
  role: StaffRole;
  staffId: string;
  staffName: string;
  clinicianId?: string;
}

/**
 * Authorization deliberately reuses what already exists: `canSignNotes` for
 * role eligibility and the `supervisedBy` supervision chain for the one real
 * cross-person case. A clinician who is neither the author nor the author's
 * supervisor does NOT get a sign button — the existing cosign inbox is the
 * real mechanism for a second clinician putting their name on someone else's
 * note.
 */
export function noteSignAuthorization(
  note: ProgressNote,
  actor: NoteSignActor,
): NoteSignAuthorization {
  const deny = (reason: string): NoteSignAuthorization => ({
    allowed: false,
    asSupervisor: false,
    routesToCosign: false,
    reason,
  });
  const status = noteStatus(note);
  if (status !== "draft" && status !== "declined") return deny("This note is no longer a draft.");

  const tokens = [actor.staffId, actor.clinicianId].filter(Boolean) as string[];
  const isAuthor = tokens.includes(note.clinicianId);

  if (isAuthor) {
    return {
      allowed: true,
      asSupervisor: false,
      routesToCosign: requiresCosign(actor.role),
      ...(requiresCosign(actor.role)
        ? { reason: "Your role signs with a cosigner — this note will route for cosignature." }
        : {}),
    };
  }

  const author = staffForAuthorToken(note.clinicianId);
  const supervisor = author ? supervisionStatus(author.id).supervisor : undefined;
  if (supervisor && supervisor.id === actor.staffId) {
    if (!canSignNotes(actor.role))
      return deny("Your role cannot put a signature on a clinical note.");
    return { allowed: true, asSupervisor: true, routesToCosign: false };
  }

  return deny(
    "Only the note's author or their supervising clinician can sign it. Use the cosign inbox instead.",
  );
}
