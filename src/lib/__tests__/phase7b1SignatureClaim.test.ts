import { describe, it, expect, beforeEach } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { AdelanteEHRExt, CLAIM_SIGN_REFUSED } from "@/lib/ehr-ext";
import { buildAttestationRecord, attestationStatement } from "@/lib/attestation";
import { setActingRole, setActingStaff, type StaffRole } from "@/lib/roles";
import { attest, linkedDraftNote, signClaimViaNote } from "@/test/claimSigning";

let slot = 0;
function freshClaim() {
  const c = AdelanteEHR.listClinicians()[0]!;
  const patientId = AdelanteEHR.listPatients()[0]!.id;
  slot += 1;
  const a = AdelanteEHR.bookAppointment({
    patientId, clinicianId: c.id,
    start: new Date(Date.now() + 86400_000 * (200 + slot)).toISOString(), durationMin: 30,
  });
  AdelanteEHR.updateAppointmentStatus(a.id, "attended");
  return AdelanteEHRExt.claimForEncounter(a.id)!;
}

function traineeSign(claim: ReturnType<typeof freshClaim>) {
  const n = linkedDraftNote(claim.patientId, claim.encounterId);
  AdelanteEHR.signProgressNote(claim.patientId, n.id, {
    signedBy: "Trainee T", signedById: "s-trainee", role: "ecm_provider", attested: true,
    attestation: attest("progress_note_sign", "Trainee T"),
    cosignRequired: true, cosignRole: ["therapist"],
  });
  return n;
}

const audits = (claimId: string) =>
  AdelanteEHR.listAuditEvents({ category: "clinical" }).filter(
    (e) => e.action === "claim_status_changed" && e.detail?.["claimId"] === claimId,
  );

describe("Phase 7b.1 — signature to claim", () => {
  beforeEach(() => { setActingStaff("s-bill1"); setActingRole("billing" as StaffRole); });

  it("trainee signature leaves the claim documented; cosign advances it, credited to the cosigner", () => {
    const c = freshClaim();
    const n = traineeSign(c);
    expect(c.state).toBe("documented");
    AdelanteEHR.cosignProgressNote(c.patientId, n.id, {
      cosignedBy: "Christi", cosignedById: "c1", role: "therapist",
      attestation: attest("progress_note_supervisor_sign", "Christi"),
    });
    expect(c.state).toBe("signed");
    const h = c.history.at(-1)!;
    expect(h.actor).toBe("c1");
    expect(h.role).toBe("therapist"); // signer, not the billing session
    expect(h.signature).toMatchObject({
      noteId: n.id, statementKey: "progress_note_supervisor_sign", statementVersion: "v1",
      signerId: "c1", signerName: "Christi", signerRole: "therapist", cosign: true, authorName: "Trainee T",
    });
    const a = audits(c.id).find((e) => e.detail?.["to"] === "signed")!;
    expect(a.actorRole).toBe("therapist");
    expect(a.detail?.["noteId"]).toBe(n.id);
    expect(a.detail?.["statementVersion"]).toBe("v1");
    expect(a.detail?.["signedAt"]).toBeTruthy();
  });

  it("cosign requires the supervisor attestation with a drawn mark; a tap is refused", () => {
    const c = freshClaim();
    const n = traineeSign(c);
    const base = { cosignedBy: "Christi", cosignedById: "c1", role: "therapist" };
    expect(() => AdelanteEHR.cosignProgressNote(c.patientId, n.id, base)).toThrow(/attestation/i);
    expect(() =>
      AdelanteEHR.cosignProgressNote(c.patientId, n.id, { ...base, attestation: attest("progress_note_sign", "Christi") }),
    ).toThrow(/wrong statement/);
    expect(() =>
      buildAttestationRecord({
        statement: attestationStatement("progress_note_supervisor_sign"),
        draft: { attested: true, signatureDataUrl: "data:x", metrics: { totalLength: 2, strokeCount: 1 } },
        signedBy: "Christi",
      }),
    ).toThrow();
    const tap = { ...attest("progress_note_supervisor_sign", "Christi"), signatureStrokeCount: 1, signatureLength: 2 };
    expect(() => AdelanteEHR.cosignProgressNote(c.patientId, n.id, { ...base, attestation: tap })).toThrow(/too small/);
    expect(n.status).toBe("cosign_pending");
    expect(c.state).toBe("documented");
  });

  it("a direct call without a genuinely final, attested note is refused and changes nothing", () => {
    const c = freshClaim();
    const draft = linkedDraftNote(c.patientId, c.encounterId);
    const r1 = AdelanteEHRExt.markClaimSignedFromNote({
      patientId: c.patientId, noteId: draft.id, attestation: attest("progress_note_sign", "X"),
    });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.error).toContain(CLAIM_SIGN_REFUSED);
    const pending = traineeSign(c);
    const r2 = AdelanteEHRExt.markClaimSignedFromNote({
      patientId: c.patientId, noteId: pending.id, attestation: pending.attestation,
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error).toMatch(/awaiting cosign/);
    expect(c.state).toBe("documented");
  });

  it("a forged attestation that doesn't match the note is refused", () => {
    const c = freshClaim();
    const n = linkedDraftNote(c.patientId, c.encounterId);
    AdelanteEHR.signProgressNote(c.patientId, n.id, { signedBy: "Christi", role: "therapist", attested: true });
    // no attestation stored → claim stayed documented
    expect(c.state).toBe("documented");
    const r = AdelanteEHRExt.markClaimSignedFromNote({
      patientId: c.patientId, noteId: n.id, attestation: attest("progress_note_sign", "Christi"),
    });
    expect(r.ok).toBe(false);
    expect(c.state).toBe("documented");
  });

  it("self-signed note carries note id and attestation version on history", () => {
    const c = freshClaim();
    const n = signClaimViaNote(c);
    expect(c.state).toBe("signed");
    expect(c.history.at(-1)!.signature).toMatchObject({ noteId: n.id, statementKey: "progress_note_sign", statementVersion: "v1", cosign: false });
  });

  it("seed moves are audited and marked as seed data", () => {
    const seeded = AdelanteEHRExt.listClaims().find((c) => c.history.some((h) => h.via === "seed_data"))!;
    expect(seeded).toBeTruthy();
    expect(AdelanteEHRExt.claimSignature(seeded)).toBe("seed");
    const rows = audits(seeded.id);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((e) => e.detail?.["seed"] === true && e.detail?.["via"] === "seed_data")).toBe(true);
  });
});
