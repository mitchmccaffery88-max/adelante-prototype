// §Phase 10c — the ONE orchestration path for ASAM signatures. Mirrors
// noteSignFlow: the store (`AdelanteEHR.signAsam` / `cosignAsam`) validates,
// records, and fires outputs (including the H0001 claim, via the creator
// ehr-ext registers with the store); this module only builds the attestation
// through the shared primitive. UI calls these two functions and nothing else.
import { AdelanteEHR } from "@/lib/ehr";
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
  /** Roster clinicianId (e.g. "c1") — used for the claim's clinician field. */
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
  return AdelanteEHR.signAsam(patientId, asamId, actor, attestation);
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
  return AdelanteEHR.cosignAsam(patientId, asamId, actor, attestation);
}
