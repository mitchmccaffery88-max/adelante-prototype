// §Advocate build 1 — invite actors, documentation requirements, the
// delivery-based 14-day window, the staff resend, and the demo bypass.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { setAdvocateDemoClaim, resetAdvocateDemoClaim } from "@/lib/advocateDemo";

function patientId(): string {
  return AdelanteEHR.listPatients()[0]!.id;
}

function invite(actor: "ecm_provider" | "administrator" | "patient", type?: never) {
  return AdelanteEHR.createAdvocateInvitation({
    patientId: patientId(),
    advocateName: "Rosa Ibarra",
    invitationSentTo: "+15595550101",
    invitationChannel: "sms",
    expectedAuthorizationType: "hipaa_authorization",
    designatedBy: { actor, name: "Test Staff" },
    ...(type ? {} : {}),
  });
}

describe("advocate build 1 — invite actors and documentation", () => {
  afterEach(() => resetAdvocateDemoClaim());

  it("accepts ECM Provider and Administrator as real invite actors", () => {
    expect(invite("ecm_provider").designatedBy.actor).toBe("ecm_provider");
    expect(invite("administrator").designatedBy.actor).toBe("administrator");
  });

  it("seeds documentation requirements from the expected authorization type", () => {
    const link = invite("administrator");
    const rows = AdelanteEHR.advocateDocumentRequirements(link.id);
    expect(rows.map((r) => r.key)).toEqual(["hipaa_roi"]);
    expect(rows[0]!.status).toBe("pending");
  });

  it("re-seeds requirements when the advocate confirms a different instrument", () => {
    const link = invite("ecm_provider");
    AdelanteEHR.claimAdvocateInvitation({
      code: link.invitationCode,
      authorizationType: "dhcs_authorized_representative",
      attestedName: "Rosa Ibarra",
      attestedRequirements: ["dhcs_ar_designation"],
    });
    const rows = AdelanteEHR.advocateDocumentRequirements(link.id);
    expect(rows.map((r) => r.key)).toEqual(["dhcs_ar_designation"]);
    expect(rows[0]!.status).toBe("attested");
  });

  it("refuses advocate self-attestation of staff-only requirements", () => {
    const link = invite("ecm_provider");
    AdelanteEHR.claimAdvocateInvitation({
      code: link.invitationCode,
      authorizationType: "ahcd",
      // The clinician determination is ticked by the caller but must be ignored.
      attestedRequirements: ["ahcd_document", "ahcd_clinician_activation"],
      attestedName: "Rosa Ibarra",
    });
    const rows = AdelanteEHR.advocateDocumentRequirements(link.id);
    expect(rows.find((r) => r.key === "ahcd_document")!.status).toBe("attested");
    expect(rows.find((r) => r.key === "ahcd_clinician_activation")!.status).toBe("pending");
    expect(() =>
      AdelanteEHR.attestAdvocateDocumentRequirement({
        linkId: link.id,
        key: "ahcd_clinician_activation",
        attestedName: "Rosa Ibarra",
      }),
    ).toThrow(/recorded by staff/);
  });

  it("starts the 14-day window on delivery, not on generation", () => {
    const link = invite("administrator");
    const beforeExpiry = link.invitationExpiresAt;
    expect(link.notificationSentAt).toBeUndefined();

    AdelanteEHR.recordAdvocateInvitationDelivery(link.id, { status: "not_configured" });
    expect(AdelanteEHR.getAdvocateLink(link.id)!.notificationSentAt).toBeUndefined();

    AdelanteEHR.recordAdvocateInvitationDelivery(link.id, { status: "sent" });
    const after = AdelanteEHR.getAdvocateLink(link.id)!;
    expect(after.notificationSentAt).toBeTruthy();
    expect(+new Date(after.invitationExpiresAt)).toBeGreaterThanOrEqual(+new Date(beforeExpiry));
    expect(
      Math.round((+new Date(after.invitationExpiresAt) - +new Date(after.notificationSentAt!)) / 86400_000),
    ).toBe(14);
  });

  it("lets staff re-request a missing document without a new invite cycle", () => {
    const link = invite("ecm_provider");
    AdelanteEHR.claimAdvocateInvitation({
      code: link.invitationCode,
      authorizationType: "hipaa_authorization",
      attestedRequirements: ["hipaa_roi"],
      attestedName: "Rosa Ibarra",
    });
    AdelanteEHR.requestAdvocateDocument({
      linkId: link.id,
      key: "hipaa_roi",
      requestedBy: "Admin User",
    });
    const row = AdelanteEHR.advocateDocumentRequirements(link.id)[0]!;
    // A re-request reopens an unverified attestation and keeps the claim.
    expect(row.status).toBe("pending");
    expect(row.requestCount).toBe(1);
    expect(AdelanteEHR.getAdvocateLink(link.id)!.status).toBe("active");

    AdelanteEHR.verifyAdvocateDocumentRequirement({
      linkId: link.id,
      key: "hipaa_roi",
      verifiedBy: "Admin User",
    });
    expect(AdelanteEHR.advocateDocumentRequirements(link.id)[0]!.status).toBe("verified");
  });

  it("audits code generation with a fingerprint, never the code itself", () => {
    const link = invite("administrator");
    const events = AdelanteEHR.listAuditEvents({ patientId: link.patientId }).filter(
      (e) => e.action === "advocate_invite_code_generated",
    );
    expect(events.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain(link.invitationCode);
    expect(serialized).toContain("codeFingerprint");
  });

  it("keeps real validation intact with the demo bypass off, and is opt-in", () => {
    invite("ecm_provider");
    expect(() =>
      AdelanteEHR.claimAdvocateInvitation({
        code: "TOTALLY-MADE-UP",
        authorizationType: "hipaa_authorization",
        attestedName: "Rosa Ibarra",
      }),
    ).toThrow(/isn't valid/);

    setAdvocateDemoClaim(true);
    const claimed = AdelanteEHR.claimAdvocateInvitation({
      code: "TOTALLY-MADE-UP",
      authorizationType: "hipaa_authorization",
      attestedName: "Rosa Ibarra",
    });
    expect(claimed.status).toBe("active");
    const audit = AdelanteEHR.listAuditEvents({ patientId: claimed.patientId }).find(
      (e) => e.action === "advocate_connection_claimed",
    );
    // A bypassed claim is always distinguishable in the trail.
    expect(JSON.stringify(audit?.detail)).toContain("demoBypass");
  });
});
