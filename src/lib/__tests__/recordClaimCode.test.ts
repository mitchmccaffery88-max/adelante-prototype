// §Phase 9a — sign-in codes for records with no login reuse the enrollment code.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { credentialMeta } from "@/lib/signup";

function referralPatient() {
  return AdelanteEHR.createPatient({ firstName: "Ref", lastName: "Claim", referralId: "r-test" });
}
const actor = { actorStaffId: "s-ecm1", actorName: "ECM", actorRole: "ecm_provider" };

describe("record-claim code", () => {
  it("claims the existing record, single use, no duplicate", () => {
    const p = referralPatient();
    const code = AdelanteEHR.issueRecordClaimCode({ patientId: p.id, ...actor });
    expect(code.code).toMatch(/^RE-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(AdelanteEHR.issueRecordClaimCode({ patientId: p.id, ...actor }).code).toBe(code.code);
    const before = AdelanteEHR.listPatients().length;
    const { patient } = AdelanteEHR.redeemEnrollmentCode({ code: code.code, credential: credentialMeta("pin") });
    expect(patient.id).toBe(p.id);
    expect(AdelanteEHR.listPatients()).toHaveLength(before);
    expect(AdelanteEHR.enrollmentCodeStatus(code.code)).toBe("consumed");
    const evt = AdelanteEHR.listAuditEvents().find((e) => e.action === "record_claim_code_issued");
    expect(JSON.stringify(evt)).not.toContain(code.code);
  });
  it("refuses roles outside today's issuers and records that already have a sign-in", () => {
    const p = referralPatient();
    expect(() =>
      AdelanteEHR.issueRecordClaimCode({ patientId: p.id, ...actor, actorRole: "therapist" }),
    ).toThrow();
    AdelanteEHR.redeemEnrollmentCode({
      code: AdelanteEHR.issueRecordClaimCode({ patientId: p.id, ...actor }).code,
      credential: credentialMeta("pin"),
    });
    expect(() => AdelanteEHR.issueRecordClaimCode({ patientId: p.id, ...actor })).toThrow(/already/);
  });
});
