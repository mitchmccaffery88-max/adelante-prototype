// §v3.0 Phase 4.1 — the four-tier legal-authority model (gap analysis 6.1–6.3).
//
// Each tier's PERMITTED ACTIONS are asserted at the store boundary, and the
// SUD/Part 2 axis is asserted SEPARATELY, because it is not derived from the
// general tier: an AR is categorically barred from Part 2 content even though
// it sits above HIPAA-only on the general axis.
import { describe, it, expect } from "vitest";
import { AdelanteEHR, type ConsentCategory } from "@/lib/ehr";
import {
  advocateSudAccess,
  advocateTier,
  permissionsForType,
  ADVOCATE_SUD_DISCLOSURE_CATEGORY,
  type AdvocateAuthorizationType,
} from "@/lib/advocate";

let n = 0;
const freshPatient = () =>
  AdelanteEHR.createPatient({ firstName: "Tier", lastName: `Case${++n}` });

function connected(patientId: string, type: AdvocateAuthorizationType) {
  const link = AdelanteEHR.createAdvocateInvitation({
    patientId,
    advocateName: "Rosa Ibarra",
    relationship: "Sister",
    invitationSentTo: `rosa${n}@example.org`,
    invitationChannel: "email",
    designatedBy: { actor: "patient", name: "Test Patient" },
  });
  AdelanteEHR.claimAdvocateInvitation({
    code: link.invitationCode,
    authorizationType: type,
    attestedName: "Rosa Ibarra",
  });
  if (type === "ahcd") AdelanteEHR.activateAdvocateAhcd(link.id, "Dr. Bagga");
  if (type === "conservatorship")
    AdelanteEHR.recordAdvocateConservatorshipDocs(link.id, {
      verifiedBy: "Records Clerk",
      courtOrderRef: "PR-2026-0001",
    });
  return AdelanteEHR.getAdvocateLink(link.id)!;
}

function signSudDisclosure(patientId: string) {
  const sections: { category: ConsentCategory; authorized: boolean }[] = [
    { category: ADVOCATE_SUD_DISCLOSURE_CATEGORY, authorized: true },
  ];
  return AdelanteEHR.createConsentRecord({
    patientId,
    formType: "NonAB133",
    source: "placeholder — pending Christi's DHCS-sourced language",
    signedByName: "Test Patient",
    attested: true,
    effectiveDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    sections,
    capturedBy: { staffName: "Test", role: "therapist" },
  });
}

/** What each tier can actually DO, exercised through the store. */
function actions(linkId: string) {
  return {
    scheduleView: AdelanteEHR.advocateSchedule(linkId).allowed,
    coordinationView: AdelanteEHR.advocateCoordination(linkId).allowed,
    coordinationWrite: AdelanteEHR.advocateAddCoordinationNeed(linkId, {
      need: "Bus pass for appointments",
    }).ok,
    carePlanParticipationView: AdelanteEHR.advocateCarePlanParticipation(linkId).allowed,
    carePlanParticipationWrite: AdelanteEHR.advocateAddCarePlanComment(linkId, {
      section: "housing",
      text: "Spare room in Fresno.",
    }).ok,
    carePlanClinicalView: AdelanteEHR.advocateCarePlanClinical(linkId).allowed,
    eligibilityView: AdelanteEHR.advocateEligibilityAssist(linkId).allowed,
    eligibilityWrite: AdelanteEHR.advocateAttestEligibilityAssist(linkId, {
      attestedName: "Rosa Ibarra",
    }).ok,
    documentUpload: AdelanteEHR.advocateUploadDocument(linkId, {
      file: { fileName: "id-card.jpg", mimeType: "image/jpeg", sizeBytes: 2048 },
      isPart2: false,
    }).ok,
  };
}

describe("6.1 / 6.3 — each tier's permitted actions match its row exactly", () => {
  it("HIPAA Authorization only — read-only across every surface", () => {
    const link = connected(freshPatient().id, "hipaa_authorization");
    expect(actions(link.id)).toEqual({
      scheduleView: true,
      coordinationView: true,
      coordinationWrite: false,
      carePlanParticipationView: true,
      carePlanParticipationWrite: false,
      carePlanClinicalView: false,
      eligibilityView: true,
      eligibilityWrite: false,
      documentUpload: false,
    });
  });

  it("Authorized Representative — the read set plus enrollment writes only", () => {
    const link = connected(freshPatient().id, "dhcs_authorized_representative");
    expect(actions(link.id)).toEqual({
      scheduleView: true,
      coordinationView: true,
      coordinationWrite: false,
      carePlanParticipationView: true,
      carePlanParticipationWrite: false,
      // Categorically no clinical file access.
      carePlanClinicalView: false,
      eligibilityView: true,
      eligibilityWrite: true,
      documentUpload: false,
    });
  });

  it("Activated AHCD Agent — full clinical file access and care-plan authority", () => {
    const link = connected(freshPatient().id, "ahcd");
    expect(actions(link.id)).toEqual({
      scheduleView: true,
      coordinationView: true,
      coordinationWrite: true,
      carePlanParticipationView: true,
      carePlanParticipationWrite: true,
      carePlanClinicalView: true,
      eligibilityView: true,
      eligibilityWrite: true,
      documentUpload: true,
    });
  });

  it("Legal Conservator — the same broadest set, and the court documents are a real precondition", () => {
    const p = freshPatient();
    const link = connected(p.id, "conservatorship");
    expect(actions(link.id)).toEqual(actions(connected(freshPatient().id, "ahcd").id));
    expect(AdelanteEHR.getAdvocateLink(link.id)?.conservatorshipDocs?.courtOrderRef).toBe(
      "PR-2026-0001",
    );

    // The documentation is a PRECONDITION, not a label: without it the same
    // conservatorship connection is denied.
    const bare = AdelanteEHR.createAdvocateInvitation({
      patientId: freshPatient().id,
      advocateName: "Rosa Ibarra",
      relationship: "Sister",
      invitationSentTo: "nodocs@example.org",
      invitationChannel: "email",
      designatedBy: { actor: "patient", name: "Test Patient" },
    });
    AdelanteEHR.claimAdvocateInvitation({
      code: bare.invitationCode,
      authorizationType: "conservatorship",
      attestedName: "Rosa Ibarra",
    });
    expect(AdelanteEHR.advocateAccess(bare.id).allowed).toBe(false);
  });

  it("an AHCD agent that was never activated is dormant, not merely unlabelled", () => {
    const p = freshPatient();
    const inv = AdelanteEHR.createAdvocateInvitation({
      patientId: p.id,
      advocateName: "Rosa Ibarra",
      relationship: "Sister",
      invitationSentTo: "dormant@example.org",
      invitationChannel: "email",
      designatedBy: { actor: "patient", name: "Test Patient" },
    });
    AdelanteEHR.claimAdvocateInvitation({
      code: inv.invitationCode,
      authorizationType: "ahcd",
      attestedName: "Rosa Ibarra",
    });
    expect(AdelanteEHR.advocateAccess(inv.id).allowed).toBe(false);
    expect(AdelanteEHR.advocateCarePlanClinical(inv.id).allowed).toBe(false);
  });
});

describe("6.2 — SUD/Part 2 is a separate axis, not a function of the general tier", () => {
  const live = { linkValid: true, sudDisclosureConsentActive: true } as const;

  it("HIPAA-only stays consent-conditional (the existing mechanism, unchanged)", () => {
    expect(advocateSudAccess("hipaa_only", { ...live, sudDisclosureConsentActive: false })).toEqual({
      unmasked: false,
      mode: "consent_conditional",
      basis: "none",
    });
    expect(advocateSudAccess("hipaa_only", live)).toEqual({
      unmasked: true,
      mode: "consent_conditional",
      basis: "consent",
    });
  });

  it("AR is categorically barred — consent does NOT unlock it (harder gate, not softer)", () => {
    expect(advocateSudAccess("authorized_representative", live)).toEqual({
      unmasked: false,
      mode: "categorically_barred",
      basis: "none",
    });
  });

  it("the authority tiers are unmasked by authority, with no consent record present", () => {
    for (const tier of ["ahcd_agent", "conservator"] as const) {
      expect(
        advocateSudAccess(tier, { linkValid: true, sudDisclosureConsentActive: false }),
      ).toEqual({ unmasked: true, mode: "authority_derived", basis: "authority" });
    }
  });

  it("a dead link masks every tier, authority included", () => {
    for (const tier of ["hipaa_only", "authorized_representative", "ahcd_agent", "conservator"] as const) {
      expect(
        advocateSudAccess(tier, { linkValid: false, sudDisclosureConsentActive: true }).unmasked,
      ).toBe(false);
    }
  });
});

describe("6.2 at the STORE boundary — the AR bar is real, not just in the predicate", () => {
  const SUD_TOPIC = "Placeholder SUD relapse-prevention topic";

  function sudGroupFor(patientId: string) {
    const clinician = AdelanteEHR.listClinicians()[0]!;
    const g = AdelanteEHR.createGroupSession({
      topic: SUD_TOPIC,
      category: "sud_clinical_preauth",
      facilitatorId: clinician.id,
      serviceType: "therapy_group",
      modality: "in_person",
      start: new Date(Date.now() + 86400000).toISOString(),
      durationMin: 60,
      capacity: 8,
      recurrence: { kind: "weekly", daysOfWeek: [new Date().getDay()] },
      createdBy: "test",
    });
    AdelanteEHR.setGroupEligibility({
      patientId,
      reason: "placeholder criteria",
      curriculumNeedTag: "placeholder-tag",
      role: "therapist",
      actor: "test",
    });
    AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId, enrolledBy: "test" });
    return g;
  }

  const labels = (linkId: string) =>
    AdelanteEHR.advocateSchedule(linkId).items.map((i) => i.label).join("|");

  it("an AR sees no SUD topic even with an ACTIVE advocate_sud_disclosure consent", () => {
    const p = freshPatient();
    sudGroupFor(p.id);
    const ar = connected(p.id, "dhcs_authorized_representative");
    const hipaa = connected(p.id, "hipaa_authorization");
    signSudDisclosure(p.id);
    expect(
      AdelanteEHR.isConsentCategoryAuthorized(p.id, ADVOCATE_SUD_DISCLOSURE_CATEGORY),
    ).toBe(true);
    // Same patient, same live consent: the HIPAA-only advocate is unmasked and
    // the AR is not. The difference is the tier, not the consent.
    expect(labels(hipaa.id)).toContain(SUD_TOPIC);
    expect(labels(ar.id)).not.toContain(SUD_TOPIC);
    expect(AdelanteEHR.advocateSchedule(ar.id).part2Disclosed).toBe(false);
    expect(JSON.stringify(AdelanteEHR.advocateSchedule(ar.id))).not.toContain(SUD_TOPIC);
  });

  it("a conservator sees SUD content with NO consent record at all", () => {
    const p = freshPatient();
    sudGroupFor(p.id);
    const cons = connected(p.id, "conservatorship");
    expect(
      AdelanteEHR.isConsentCategoryAuthorized(p.id, ADVOCATE_SUD_DISCLOSURE_CATEGORY),
    ).toBe(false);
    expect(labels(cons.id)).toContain(SUD_TOPIC);
    expect(AdelanteEHR.advocateSchedule(cons.id).part2Disclosed).toBe(true);
  });

  it("tier mapping is the single source of truth for both axes", () => {
    expect(advocateTier("dhcs_authorized_representative")).toBe("authorized_representative");
    expect(permissionsForType("dhcs_authorized_representative")).not.toContain(
      "care_plan_clinical_view",
    );
  });
});
