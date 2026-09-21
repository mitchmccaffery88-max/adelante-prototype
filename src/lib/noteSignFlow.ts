// §EHR audit Phase 1a — the single way a chart note gets signed from a queue.
//
// Before this, /notes-queue called `AdelanteEHRExt.signNote(apptId, a.clinicianId)`,
// which (a) skipped the real note lifecycle entirely, (b) let any role reaching
// the page sign, and (c) attributed the signature to the ORIGINAL clinician
// instead of the person clicking. This routes through the real
// `signProgressNote` (attestation, crisis-band gate, cosign routing) and then
// MIRRORS the result into the ehr-ext signature ledger so linked claims still
// advance `documented → signed` exactly as before.
import { AdelanteEHR } from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { noteSignAuthorization, type NoteSignActor } from "@/lib/notes";
import type { UnsignedWorkRow } from "@/lib/unsignedWork";

export interface SignResult {
  ok: boolean;
  error?: string;
  /** True when the note went to cosign_pending rather than signed. */
  routedToCosign?: boolean;
}

export function signUnsignedWorkRow(row: UnsignedWorkRow, actor: NoteSignActor): SignResult {
  if (row.kind !== "draft_note" || !row.note) {
    return {
      ok: false,
      error: "This encounter has no note yet. Write the note in the chart before signing.",
    };
  }
  const auth = noteSignAuthorization(row.note, actor);
  if (!auth.allowed) return { ok: false, ...(auth.reason ? { error: auth.reason } : {}) };

  try {
    AdelanteEHR.signProgressNote(row.patient.id, row.note.id, {
      signedBy: actor.staffName,
      role: actor.role,
      attested: true,
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
