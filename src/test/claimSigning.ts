// §Phase 7b.1 — tests reach `signed` the only real way: a note linked to the
// visit, signed with a versioned attestation + drawn mark.
import { AdelanteEHR, type ProgressNote } from "@/lib/ehr";
import { attestationStatement, buildAttestationRecord } from "@/lib/attestation";

export const DRAWN = {
  attested: true,
  signatureDataUrl: "data:image/png;base64,AAA",
  metrics: { totalLength: 220, strokeCount: 3 },
};

export function attest(statementId: string, signedBy: string) {
  return buildAttestationRecord({ statement: attestationStatement(statementId), draft: DRAWN, signedBy });
}

export function linkedDraftNote(patientId: string, appointmentId: string): ProgressNote {
  const n = AdelanteEHR.addProgressNote(patientId, {
    clinicianId: "c1",
    date: new Date().toISOString(),
    sessionType: "individual",
    subjective: "s",
    objective: "",
    assessment: "",
    plan: "",
    authorSource: "human",
    status: "draft",
    appointmentId,
  } as never);
  if (!n) throw new Error("no note");
  return n;
}

/** Self-sign (therapist) a note for this claim's visit → claim signed. */
export function signClaimViaNote(claim: { patientId: string; encounterId: string }) {
  const n = linkedDraftNote(claim.patientId, claim.encounterId);
  AdelanteEHR.signProgressNote(claim.patientId, n.id, {
    signedBy: "Christi",
    signedById: "c1",
    role: "therapist",
    attested: true,
    attestation: attest("progress_note_sign", "Christi"),
  });
  return n;
}
