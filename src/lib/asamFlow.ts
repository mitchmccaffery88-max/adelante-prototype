// §Phase 10c — the ONE orchestration path for ASAM signatures. Mirrors
// noteSignFlow: the store (`AdelanteEHR.signAsam` / `cosignAsam`) validates
// and records; this module builds the attestation through the shared
// primitive and attaches the H0001 claim through the existing claim path in
// ehr-ext. UI calls these two functions and nothing else.
import { AdelanteEHR } from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import {
  attestationStatement,
  buildAttestationRecord,
  type AttestationDraft,
} from "@/lib/attestation";
import type { AsamAssessment } from "@/lib/asam";
import type { StaffRole } from "@/lib/roles";

export interface AsamActor {
  staffId: string;
  name: string;
  role: StaffRole;
  /** Roster clinicianId (e.g. "c1") — needed for the claim's clinician field. */
  clinicianId?: string;
}

/** Author signs their draft. Counselor/trainee authors → cosign_pending. */
export function signAsamAssessment(
  patientId: string,
  asamId: string,
  actor: AsamActor,
  draft: AttestationDraft,
): AsamAssessment {
  const attestation = buildAttestationRecord({
    statement: attestationStatement("asam_sign"),
    draft,
    signedBy: actor.name,
  });
  const signed = AdelanteEHR.signAsam(patientId, asamId, actor, attestation);
  if (signed.status === "signed") attachAsamClaim(patientId, signed, actor);
  return signed;
}

/** LPHA co-signs a counselor/trainee-authored assessment → outputs fire. */
export function cosignAsamAssessment(
  patientId: string,
  asamId: string,
  actor: AsamActor,
  draft: AttestationDraft,
): AsamAssessment {
  const attestation = buildAttestationRecord({
    statement: attestationStatement("asam_supervisor_sign"),
    draft,
    signedBy: actor.name,
  });
  const signed = AdelanteEHR.cosignAsam(patientId, asamId, actor, attestation);
  attachAsamClaim(patientId, signed, actor);
  return signed;
}

function attachAsamClaim(patientId: string, asam: AsamAssessment, actor: AsamActor): void {
  if (asam.outputs?.claimId) return;
  const claim = AdelanteEHRExt.createAsamClaim({
    asamId: asam.id,
    patientId,
    clinicianId: actor.clinicianId ?? actor.staffId,
    serviceDate: (asam.cosignedAt ?? asam.signedAt ?? new Date().toISOString()).slice(0, 10),
  });
  AdelanteEHR.attachAsamClaim(patientId, asam.id, claim.id);
}
