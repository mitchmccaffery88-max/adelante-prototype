// §Advocate build 3 — the two things that must not regress: the review gate
// actually blocks sending, and Part 2 masking holds even with full
// communication rights.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import {
  ADVOCATE_MESSAGING_REVIEW,
  advocateCommunicationRightsDecision,
} from "@/lib/advocateMessaging";
import { COMMUNICATION_RIGHTS_REQUIREMENT_KEYS } from "@/lib/advocateDocs";

function connectedAdvocate(opts?: { commRights?: boolean; part2?: boolean }) {
  const patient = AdelanteEHR.createPatient({ firstName: "Rosa", lastName: "Vega" } as never);
  const link = AdelanteEHR.createAdvocateInvitation({
    patientId: patient.id,
    advocateName: "Marta Vega",
    relationship: "sister",
    invitationSentTo: "marta@example.com",
    invitationChannel: "email",
    designatedBy: { actor: "patient", name: "Rosa Vega" },
    expectedAuthorizationType: "hipaa_authorization",
  });
  const claimed = AdelanteEHR.claimAdvocateInvitation({
    code: link.invitationCode,
    authorizationType: "hipaa_authorization",
    attestedName: "Marta Vega",
    attestedRequirements: ["hipaa_roi"],
  });
  AdelanteEHR.verifyAdvocateDocumentRequirement({
    linkId: claimed.id,
    key: "hipaa_roi",
    verifiedBy: "Dana Reyes",
  });
  if (opts?.commRights) {
    AdelanteEHR.requestAdvocateDocument({
      linkId: claimed.id,
      key: "hipaa_roi_communication",
      requestedBy: "Dana Reyes",
    });
    AdelanteEHR.verifyAdvocateDocumentRequirement({
      linkId: claimed.id,
      key: "hipaa_roi_communication",
      verifiedBy: "Dana Reyes",
    });
  }
  return { patientId: patient.id, linkId: claimed.id };
}

describe("advocate messaging review gate", () => {
  it("ships gated by default", () => {
    expect(ADVOCATE_MESSAGING_REVIEW.pending).toBe(true);
  });

  it("refuses the send at the STORE, not just in the UI", () => {
    const { linkId } = connectedAdvocate({ commRights: true });
    const r = AdelanteEHR.advocateSendMessage(linkId, "Can we move Tuesday?");
    expect(r.sent).toBe(false);
    expect(r.message).toBeUndefined();
  });

  it("the built feature works when the gate is lifted", () => {
    const { patientId, linkId } = connectedAdvocate({ commRights: true });
    const r = AdelanteEHR.advocateSendMessage(linkId, "Can we move Tuesday?", {
      allowPendingReview: true,
    });
    expect(r.sent).toBe(true);
    const thread = AdelanteEHR.listCareMessages(patientId);
    // Same store, same thread as patient/staff messaging — not a parallel one.
    expect(thread.at(-1)!.authorType).toBe("advocate");
    expect(thread.at(-1)!.body).toBe("Can we move Tuesday?");
    expect(thread.at(-1)!.authorAdvocateLinkId).toBe(linkId);
  });
});

describe("communication rights axis", () => {
  it("is denied without a verified communication-rights document", () => {
    const { linkId } = connectedAdvocate();
    expect(AdelanteEHR.advocateCommunicationRights(linkId).granted).toBe(false);
  });

  it("a general Medi-Cal AR designation alone does not grant it", () => {
    const d = advocateCommunicationRightsDecision({
      accessAllowed: true,
      accessReason: "ok",
      rows: [{ key: "dhcs_ar_designation", status: "verified" }],
    });
    expect(d.granted).toBe(false);
  });

  it("is granted by any of the three real instruments", () => {
    for (const key of COMMUNICATION_RIGHTS_REQUIREMENT_KEYS) {
      const d = advocateCommunicationRightsDecision({
        accessAllowed: true,
        accessReason: "ok",
        rows: [{ key, status: "verified" }],
      });
      expect(d.granted).toBe(true);
      expect(d.basis).toBe(key);
    }
  });
});

describe("Part 2 masking is independent of communication rights", () => {
  it("masks a flagged message for an advocate with full messaging rights", () => {
    const { patientId, linkId } = connectedAdvocate({ commRights: true });
    const m = AdelanteEHR.sendPatientMessage(patientId, "about my methadone dose")!;
    AdelanteEHR.flagMessageAsSud(patientId, m.id, "Dr. Bagga", "pmhnp");
    const view = AdelanteEHR.advocateCareMessages(linkId);
    expect(view.allowed).toBe(true);
    const seen = view.messages.find((x) => x.id === m.id)!;
    expect(seen.bodyMasked).toBe(true);
    expect(seen.body).not.toContain("methadone");
  });
});

describe("what you need next", () => {
  it("separates advocate-actionable rows from staff-actionable ones", () => {
    const { linkId } = connectedAdvocate();
    AdelanteEHR.requestAdvocateDocument({
      linkId,
      key: "ahcd_clinician_activation",
      requestedBy: "Dana Reyes",
    });
    AdelanteEHR.requestAdvocateDocument({
      linkId,
      key: "collateral_roi",
      requestedBy: "Dana Reyes",
    });
    const items = AdelanteEHR.advocateOutstandingRequirements(linkId).items;
    expect(items.find((i) => i.key === "ahcd_clinician_activation")!.staffAction).toBe(true);
    expect(items.find((i) => i.key === "collateral_roi")!.staffAction).toBe(false);
  });

  it("nudge is refused on rows the advocate can move, and rate-limited on ones they can't", () => {
    const { linkId } = connectedAdvocate();
    AdelanteEHR.requestAdvocateDocument({
      linkId,
      key: "collateral_roi",
      requestedBy: "Dana Reyes",
    });
    AdelanteEHR.requestAdvocateDocument({
      linkId,
      key: "ahcd_clinician_activation",
      requestedBy: "Dana Reyes",
    });
    expect(AdelanteEHR.advocateNudgeCareTeam({ linkId, key: "collateral_roi" }).sent).toBe(false);
    expect(
      AdelanteEHR.advocateNudgeCareTeam({ linkId, key: "ahcd_clinician_activation" }).sent,
    ).toBe(true);
    expect(
      AdelanteEHR.advocateNudgeCareTeam({ linkId, key: "ahcd_clinician_activation" }).sent,
    ).toBe(false);
  });
});
