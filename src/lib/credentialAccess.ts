// §EHR audit Phase 2a — who may touch whose credential file.
//
// Real hole this closes: `/clinician-credentials` ("My credentials") shipped
// with an "Acting as" dropdown listing EVERY clinician and no gate, so any
// staff member could read, add to, and delete anyone else's licence file.
//
// The model implemented here:
//  - Everyone manages their OWN file, and only their own. A staff member's
//    file is the credential set attached to their linked `clinicianId`.
//    Staff with no linked clinician record have no file at all (a real,
//    pre-existing limitation of the data model — reported, not papered over).
//  - A narrower ASSIST capability exists for the credentialing tier, because
//    the real job of a credentialing coordinator includes attaching a licence
//    document that arrived by fax or email on the clinician's behalf. Assist
//    is read + upload only. It does NOT include delete: destroying someone
//    else's licence record is not a clerical act, and the owner can always
//    remove their own.
//
// The assist tier is not a new permission: it is `staff_supervision` write —
// exactly the class that already gates `/admin-credentialing`, so access stays
// a single matrix edit rather than a second, competing rule.

import { canAccess, type StaffRole } from "@/lib/roles";

export interface CredentialActor {
  role: StaffRole;
  staffId: string;
  staffName: string;
  clinicianId?: string;
}

export type CredentialAccessMode = "own" | "assist" | "none";

export interface CredentialAccess {
  mode: CredentialAccessMode;
  canView: boolean;
  canUpload: boolean;
  canDelete: boolean;
  /** Plain-language explanation shown when a capability is missing. */
  note?: string;
}

export const CREDENTIAL_ASSIST_NOTE =
  "You are managing someone else's credential file on their behalf. You can add documents; only they can remove one.";

export const CREDENTIAL_NO_RECORD_NOTE =
  "Your staff profile isn't linked to a clinician record, so there is no credential file to manage. Credentials attach to clinician records only.";

/** True when the role sits in the credentialing tier that may assist others. */
export function canAssistCredentials(role: StaffRole): boolean {
  return canAccess(role, "staff_supervision").level === "write";
}

/** Clinician files this actor may open at all: their own, plus all if assisting. */
export function credentialTargetsFor(
  actor: CredentialActor,
  allClinicianIds: string[],
): string[] {
  if (canAssistCredentials(actor.role)) return allClinicianIds;
  return actor.clinicianId ? [actor.clinicianId] : [];
}

export function credentialAccessFor(
  actor: CredentialActor,
  targetClinicianId: string | undefined,
): CredentialAccess {
  if (!targetClinicianId) {
    return {
      mode: "none",
      canView: false,
      canUpload: false,
      canDelete: false,
      note: CREDENTIAL_NO_RECORD_NOTE,
    };
  }
  if (actor.clinicianId && actor.clinicianId === targetClinicianId) {
    return { mode: "own", canView: true, canUpload: true, canDelete: true };
  }
  if (canAssistCredentials(actor.role)) {
    return {
      mode: "assist",
      canView: true,
      canUpload: true,
      canDelete: false,
      note: CREDENTIAL_ASSIST_NOTE,
    };
  }
  return {
    mode: "none",
    canView: false,
    canUpload: false,
    canDelete: false,
    note: "You can only manage your own credential file.",
  };
}
