// §EHR audit Phase 1a — the single way a chart note gets signed from a queue.
//
// Before this, /notes-queue called `AdelanteEHRExt.signNote(apptId, a.clinicianId)`,
// which (a) skipped the real note lifecycle entirely, (b) let any role reaching
// the page sign, and (c) attributed the signature to the ORIGINAL clinician
// instead of the person clicking. This routes through the real
// `signProgressNote` (attestation, crisis-band gate, cosign routing) and then
// MIRRORS the result into the ehr-ext signature ledger so linked claims still
// advance `documented → signed` exactly as before.
//
// §EHR audit Phase 1d — signing now carries an attestation record from the
// shared primitive (`src/lib/attestation.ts`): the versioned wording actually
// shown plus a drawn mark. Authorization is UNCHANGED and still comes from
// `noteSignAuthorization` — the primitive composes with it, it does not
// replace it. Domain blockers and attestation blockers merge into one ordered
// list via `noteSignBlockers`, so a caller can show everything at once.
import { AdelanteEHR } from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import {
  attestationBlockers,
  attestationStatement,
  buildAttestationRecord,
  mergeBlockers,
  type AttestationDraft,
  type AttestationStatement,
  type SignBlocker,
} from "@/lib/attestation";
import { noteSignAuthorization, type NoteSignActor } from "@/lib/notes";
import type { UnsignedWorkRow } from "@/lib/unsignedWork";

export interface SignResult {
  ok: boolean;
  error?: string;
  /** True when the note went to cosign_pending rather than signed. */
  routedToCosign?: boolean;
  /** Everything blocking the signature, ordered for display. */
  blockers?: SignBlocker[];
}

/**
 * Which statement a given signer reads. A supervisor signing another
 * clinician's note attests to something materially different, so it gets its
 * own versioned wording rather than a reused one.
 */
export function noteAttestationStatement(asSupervisor: boolean): AttestationStatement {
  return attestationStatement(
    asSupervisor ? "progress_note_supervisor_sign" : "progress_note_sign",
  );
}

/** Domain blockers for signing an unsigned-work row, merged with attestation. */
export function noteSignBlockers(
  row: UnsignedWorkRow,
  actor: NoteSignActor,
  draft: AttestationDraft,
): SignBlocker[] {
  const domain: SignBlocker[] = [];
  if (row.kind !== "draft_note" || !row.note) {
    domain.push({
      code: "no_note",
      message: "This encounter has no note yet — write it in the chart first.",
    });
  } else {
    const auth = noteSignAuthorization(row.note, actor);
    if (!auth.allowed)
      domain.push({ code: "not_authorized", message: auth.reason ?? "You cannot sign this note." });
  }
  return mergeBlockers(domain, attestationBlockers(draft));
}

export function signUnsignedWorkRow(
  row: UnsignedWorkRow,
  actor: NoteSignActor,
  draft: AttestationDraft,
): SignResult {
  if (row.kind !== "draft_note" || !row.note) {
    return {
      ok: false,
      error: "This encounter has no note yet. Write the note in the chart before signing.",
    };
  }
  const auth = noteSignAuthorization(row.note, actor);
  if (!auth.allowed) return { ok: false, ...(auth.reason ? { error: auth.reason } : {}) };

  const blockers = attestationBlockers(draft);
  if (blockers.length)
    return { ok: false, blockers, ...(blockers[0] ? { error: blockers[0].message } : {}) };

  let attestation;
  try {
    attestation = buildAttestationRecord({
      statement: noteAttestationStatement(auth.asSupervisor),
      draft,
      signedBy: actor.staffName,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not record the signature." };
  }

  try {
    AdelanteEHR.signProgressNote(row.patient.id, row.note.id, {
      signedBy: actor.staffName,
      role: actor.role,
      attested: true,
      attestation,
      ...(auth.routesToCosign ? { cosignRequired: true } : {}),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not sign this note." };
  }

  // Mirror into the encounter signature ledger (claims read this).
  const apptId = row.note.appointmentId;
  if (apptId && !auth.routesToCosign) {
    AdelanteEHRExt.signNote(apptId, actor.clinicianId ?? actor.staffId);
  }
  return { ok: true, routedToCosign: auth.routesToCosign };
}
