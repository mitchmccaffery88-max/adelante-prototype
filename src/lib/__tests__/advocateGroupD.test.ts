// §Quality pass Group D — advocate hardening.
//
// Items covered here: 1 (contribution review/acceptance), 2 (eligibility
// attestation visibility + review), 5 (data-layer authorization proof), 6
// (consent-revocation re-masking regressions), 7 (audit rows carry both gates).
import { describe, expect, it } from "vitest";
import {
  AdelanteEHR,
  ADVOCATE_REVIEW_ROLES,
  type ConsentCategory,
  type GroupCategory,
} from "../ehr";
import { ADVOCATE_SUD_DISCLOSURE_CATEGORY, type AdvocateAuthorizationType } from "../advocate";
import { advocateGateOutcome } from "../consentAudit";

let n = 0;
function freshPatient() {
  return AdelanteEHR.createPatient({ firstName: "GroupD", lastName: `Case${++n}` });
}

function connected(patientId: string, type: AdvocateAuthorizationType = "hipaa_authorization") {
  const link = AdelanteEHR.createAdvocateInvitation({
    patientId,
    advocateName: `Advocate ${n}`,
    relationship: "Sister",
    invitationSentTo: `adv${n}@example.org`,
    invitationChannel: "email",
    designatedBy: { actor: "patient", name: "Test Patient" },
  });
  AdelanteEHR.claimAdvocateInvitation({
    code: link.invitationCode,
    authorizationType: type,
    attestedName: "Advocate",
  });
  // §Phase 4.1 — the two authority tiers with real preconditions must have
  // them satisfied here, or the link is claimed but inert.
  if (type === "ahcd") AdelanteEHR.activateAdvocateAhcd(link.id, "Dr. Bagga");
  if (type === "conservatorship")
    AdelanteEHR.recordAdvocateConservatorshipDocs(link.id, {
      verifiedBy: "Records Clerk",
      courtOrderRef: "PR-2026-0001",
    });
  return AdelanteEHR.getAdvocateLink(link.id)!;
}

function signSudDisclosure(patientId: string, authorized = true) {
  const sections: { category: ConsentCategory; authorized: boolean }[] = [
    { category: ADVOCATE_SUD_DISCLOSURE_CATEGORY, authorized },
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

const SUD_TOPIC = "Placeholder SUD relapse-prevention topic";

function sudGroupFor(patientId: string) {
  const clinician = AdelanteEHR.listClinicians()[0]!;
  const g = AdelanteEHR.createGroupSession({
    topic: SUD_TOPIC,
    category: "sud_clinical_preauth" as GroupCategory,
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

const labels = (linkId: string) => AdelanteEHR.advocateSchedule(linkId).items.map((i) => i.label);

// ---------------------------------------------------------------- item 1 ---

describe("item 1 — advocate contribution review / acceptance", () => {
  // §Phase 4.1 — `care_plan_participation_write` moved out of the read-only
  // HIPAA tier and into the authority tiers, so a contributing advocate here
  // is an activated AHCD agent.
  const contributor = (patientId: string) => connected(patientId, "ahcd");
  it("new contributions start pending and appear in the owner queue", () => {
    const p = freshPatient();
    const link = contributor(p.id);
    expect(
      AdelanteEHR.advocateAddCarePlanComment(link.id, {
        section: "housing",
        text: "Her aunt has a spare room in Fresno.",
      }).ok,
    ).toBe(true);
    const row = AdelanteEHR.advocateContributionQueue({ status: "pending" }).find(
      (c) => c.patientId === p.id,
    );
    expect(row).toBeTruthy();
    expect(row!.review.status).toBe("pending");
    // Ownership is derived, never assigned by hand.
    expect(ADVOCATE_REVIEW_ROLES).toContain(row!.ownerRole);
  });

  it("only the ECM Provider / CF Care Manager may accept", () => {
    const p = freshPatient();
    const link = contributor(p.id);
    AdelanteEHR.advocateAddCarePlanComment(link.id, { section: "general", text: "Please call me." });
    const c = AdelanteEHR.advocateContributionsForPatient(p.id)[0]!;
    for (const role of ["peer_specialist", "therapist", "billing", "community_health_worker"]) {
      const res = AdelanteEHR.reviewAdvocateContribution({
        contributionId: c.id,
        status: "accepted",
        reviewerName: "Someone",
        reviewerRole: role,
      });
      expect(res.ok).toBe(false);
    }
    expect(AdelanteEHR.advocateContributionsForPatient(p.id)[0]!.review.status).toBe("pending");
  });

  it("accepting stamps who/when/what and does NOT mutate the authoritative plan", () => {
    const p = freshPatient();
    const link = contributor(p.id);
    AdelanteEHR.advocateAddCarePlanComment(link.id, {
      section: "pharmacy",
      text: "Use the pharmacy on Belmont.",
    });
    const c = AdelanteEHR.advocateContributionsForPatient(p.id)[0]!;
    const planBefore = JSON.stringify(AdelanteEHR.reentryCarePlanForPatient(p.id) ?? null);

    const res = AdelanteEHR.reviewAdvocateContribution({
      contributionId: c.id,
      status: "accepted",
      reviewerName: "Nora ECM",
      reviewerRole: "ecm_provider",
      note: "Added to the pharmacy section myself.",
    });
    expect(res.ok).toBe(true);

    const after = AdelanteEHR.advocateContributionsForPatient(p.id)[0]!;
    expect(after.review.status).toBe("accepted");
    expect(after.review.reviewedBy).toBe("Nora ECM");
    expect(after.review.reviewedByRole).toBe("ecm_provider");
    expect(after.review.reviewedAt).toBeTruthy();
    expect(after.review.note).toBe("Added to the pharmacy section myself.");
    // Acceptance is a STATUS, not a merge: the plan is byte-identical.
    expect(JSON.stringify(AdelanteEHR.reentryCarePlanForPatient(p.id) ?? null)).toBe(planBefore);

    const audit = AdelanteEHR.listAuditEvents({ category: ["advocate"], patientId: p.id }).find(
      (e) => e.action === "advocate_contribution_reviewed",
    );
    expect(audit?.detail?.["contributionId"]).toBe(c.id);
    expect(audit?.detail?.["status"]).toBe("accepted");
    expect(audit?.detail?.["planMutated"]).toBe(false);
    expect(audit?.actorRole).toBe("ecm_provider");
  });

  it("declining is a distinct, equally-audited terminal state", () => {
    const p = freshPatient();
    const link = contributor(p.id);
    AdelanteEHR.advocateAddCarePlanComment(link.id, { section: "dme", text: "A walker would help." });
    const c = AdelanteEHR.advocateContributionsForPatient(p.id)[0]!;
    expect(
      AdelanteEHR.reviewAdvocateContribution({
        contributionId: c.id,
        status: "declined",
        reviewerName: "Cruz CF",
        reviewerRole: "cf_care_manager",
      }).ok,
    ).toBe(true);
    expect(AdelanteEHR.advocateContributionsForPatient(p.id)[0]!.review.status).toBe("declined");
    expect(
      AdelanteEHR.advocateContributionQueue({ status: "pending" }).some((x) => x.id === c.id),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------- item 2 ---

describe("item 2 — eligibility-assist attestation is visible and reviewable", () => {
  // §Phase 4.1 — eligibility_assist_write now belongs to the AR tier (and to
  // the two authority tiers above it). AR is the natural holder of this act.
  const withWrite = (patientId: string) => connected(patientId, "dhcs_authorized_representative");

  it("an attestation creates a pending, reviewable record that submits nothing", () => {
    const p = freshPatient();
    const link = withWrite(p.id);
    expect(
      AdelanteEHR.advocateAttestEligibilityAssist(link.id, {
        attestedName: "Rosa Ibarra",
        note: "Helping with the renewal packet.",
      }).ok,
    ).toBe(true);
    const row = AdelanteEHR.advocateEligibilityAttestationQueue({ status: "pending" }).find(
      (a) => a.patientId === p.id,
    );
    expect(row).toBeTruthy();
    expect(row!.attestedName).toBe("Rosa Ibarra");
    expect(row!.submission).toBe("no_submission_path_defined");
    expect(ADVOCATE_REVIEW_ROLES).toContain(row!.ownerRole);
  });

  it("records who reviewed it and when, and audits the review", () => {
    const p = freshPatient();
    const link = withWrite(p.id);
    AdelanteEHR.advocateAttestEligibilityAssist(link.id, { attestedName: "Rosa Ibarra" });
    const a = AdelanteEHR.advocateEligibilityAttestationQueue().find((x) => x.patientId === p.id)!;

    expect(
      AdelanteEHR.reviewAdvocateEligibilityAttestation({
        attestationId: a.id,
        reviewerName: "Wanda Peer",
        reviewerRole: "peer_specialist",
      }).ok,
    ).toBe(false);

    expect(
      AdelanteEHR.reviewAdvocateEligibilityAttestation({
        attestationId: a.id,
        reviewerName: "Nora ECM",
        reviewerRole: "ecm_provider",
        note: "Seen; nothing to submit.",
      }).ok,
    ).toBe(true);

    const after = AdelanteEHR.advocateEligibilityAttestationQueue().find((x) => x.id === a.id)!;
    expect(after.review.status).toBe("reviewed");
    expect(after.review.reviewedBy).toBe("Nora ECM");
    expect(after.review.reviewedByRole).toBe("ecm_provider");
    expect(after.review.reviewedAt).toBeTruthy();

    const audit = AdelanteEHR.listAuditEvents({ category: ["advocate"], patientId: p.id }).find(
      (e) => e.action === "advocate_eligibility_attestation_reviewed",
    );
    expect(audit?.detail?.["attestationId"]).toBe(a.id);
  });

  it("an advocate WITHOUT write authority creates no attestation record", () => {
    const p = freshPatient();
    const link = connected(p.id); // participation tier, no eligibility write
    expect(AdelanteEHR.advocateAttestEligibilityAssist(link.id, { attestedName: "X" }).ok).toBe(
      false,
    );
    expect(
      AdelanteEHR.advocateEligibilityAttestationQueue().some((a) => a.patientId === p.id),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------- item 5 ---
//
// HONEST FRAMING: this prototype has no server tier, so "server-side check"
// cannot be tested literally. What CAN be proven — and is proven here — is that
// the gate lives in the shared data-layer functions, not in components: these
// calls go straight to `AdelanteEHR.*` with no React, no route and no
// component tree anywhere in the stack. A real backend enforcement layer
// remains a dev-team follow-up.

describe("item 5 — the gate is in the data layer, not the UI", () => {
  it("masked SUD content cannot be retrieved by calling the store directly", () => {
    const p = freshPatient();
    sudGroupFor(p.id);
    const link = connected(p.id);
    const view = AdelanteEHR.advocateSchedule(link.id);
    expect(view.allowed).toBe(true);
    expect(view.part2Disclosed).toBe(false);
    // Nothing in the returned payload carries the topic — the mask is not a
    // rendering decision, the string never crosses the boundary.
    expect(JSON.stringify(view)).not.toContain(SUD_TOPIC);
  });

  it("a Part 2 document's name never crosses the boundary without consent", () => {
    const p = freshPatient();
    const link = connected(p.id);
    // §Phase 4.1 — the HIPAA-only advocate is read-only now, so the Part 2
    // document is uploaded by the patient; the assertion (can this advocate
    // see it?) is unchanged.
    const up = AdelanteEHR.uploadPatientDocument({
      patientId: p.id,
      file: { fileName: "detox-discharge-summary.pdf", mimeType: "application/pdf", sizeBytes: 1024 },
      uploader: { kind: "patient", name: "Test Patient" },
      isPart2: true,
    });
    expect(up.ok).toBe(true);
    const docs = AdelanteEHR.advocateDocuments(link.id);
    expect(JSON.stringify(docs)).not.toContain("detox-discharge-summary.pdf");
    expect(docs.items.every((d) => !d.isPart2 || d.restricted)).toBe(true);

    signSudDisclosure(p.id);
    const after = AdelanteEHR.advocateDocuments(link.id);
    expect(JSON.stringify(after)).toContain("detox-discharge-summary.pdf");
  });

  it("a revoked link returns nothing from every advocate read function", () => {
    const p = freshPatient();
    sudGroupFor(p.id);
    const link = connected(p.id, "conservatorship");
    signSudDisclosure(p.id);
    expect(AdelanteEHR.advocateSchedule(link.id).items.length).toBeGreaterThan(0);
    AdelanteEHR.revokeAdvocateLink(link.id, "test", "revoked for test");
    expect(AdelanteEHR.advocateSchedule(link.id).items).toEqual([]);
    expect(AdelanteEHR.advocateCoordination(link.id).allowed).toBe(false);
    expect(AdelanteEHR.advocateDocuments(link.id).allowed).toBe(false);
    expect(AdelanteEHR.advocateCarePlanClinical(link.id).allowed).toBe(false);
    expect(AdelanteEHR.advocateCarePlanParticipation(link.id).allowed).toBe(false);
    expect(AdelanteEHR.advocateEligibilityAssist(link.id).allowed).toBe(false);
  });
});

// ---------------------------------------------------------------- item 6 ---

describe("item 6 — consent revocation re-masks immediately (regression)", () => {
  it("revoking the disclosure re-masks on the very next read", () => {
    const p = freshPatient();
    sudGroupFor(p.id);
    const link = connected(p.id);
    const rec = signSudDisclosure(p.id);
    expect(labels(link.id).join("|")).toContain(SUD_TOPIC);
    AdelanteEHR.revokeConsentRecord(rec.id, {
      reason: "patient revoked",
      revokedBy: "Test",
      role: "therapist",
    });
    expect(labels(link.id).join("|")).not.toContain(SUD_TOPIC);
    expect(AdelanteEHR.advocateSchedule(link.id).part2Disclosed).toBe(false);
  });

  it("superseding the record with the category UNAUTHORIZED also re-masks", () => {
    const p = freshPatient();
    sudGroupFor(p.id);
    const link = connected(p.id);
    signSudDisclosure(p.id);
    expect(labels(link.id).join("|")).toContain(SUD_TOPIC);
    // There is no per-category "deactivate" switch in the model; the real way
    // to turn the category off is a newer record that does not authorize it.
    signSudDisclosure(p.id, false);
    expect(
      AdelanteEHR.isConsentCategoryAuthorized(p.id, ADVOCATE_SUD_DISCLOSURE_CATEGORY),
    ).toBe(false);
    expect(labels(link.id).join("|")).not.toContain(SUD_TOPIC);
  });

  it("consent is PATIENT-scoped: two advocates for one patient move together", () => {
    const p = freshPatient();
    sudGroupFor(p.id);
    const a = connected(p.id);
    // Both are HIPAA-only: the consent-conditional tier is the one whose SUD
    // visibility actually tracks the consent record. (A conservator is
    // `authority_derived` and would NOT move with it — see Phase 4.1.)
    const b = connected(p.id, "hipaa_authorization");
    const rec = signSudDisclosure(p.id);
    expect(labels(a.id).join("|")).toContain(SUD_TOPIC);
    expect(labels(b.id).join("|")).toContain(SUD_TOPIC);

    AdelanteEHR.revokeConsentRecord(rec.id, {
      reason: "patient revoked",
      revokedBy: "Test",
      role: "therapist",
    });
    // Both re-mask — the consent is not link-scoped. This is the open question
    // flagged in Phase 4 and is asserted here so the behaviour cannot drift
    // silently if a per-advocate consent is ever introduced.
    expect(labels(a.id).join("|")).not.toContain(SUD_TOPIC);
    expect(labels(b.id).join("|")).not.toContain(SUD_TOPIC);
  });

  it("revoking ONE advocate's link leaves the other advocate unaffected", () => {
    const p = freshPatient();
    sudGroupFor(p.id);
    const a = connected(p.id);
    const b = connected(p.id, "hipaa_authorization");
    signSudDisclosure(p.id);
    AdelanteEHR.revokeAdvocateLink(a.id, "test", "one advocate only");
    expect(AdelanteEHR.advocateSchedule(a.id).allowed).toBe(false);
    expect(labels(b.id).join("|")).toContain(SUD_TOPIC);
  });
});

// ---------------------------------------------------------------- item 7 ---

describe("item 7 — advocate audit rows expose BOTH gates separately", () => {
  it("records link validity and consent status per read", () => {
    const p = freshPatient();
    sudGroupFor(p.id);
    const link = connected(p.id);
    AdelanteEHR.advocateSchedule(link.id);
    const masked = AdelanteEHR.listAuditEvents({ category: ["advocate"], patientId: p.id }).find(
      (e) => e.action === "advocate_schedule_viewed",
    )!;
    expect(advocateGateOutcome(masked)).toEqual({
      linkValid: true,
      consentActive: false,
      part2Disclosed: false,
    });

    signSudDisclosure(p.id);
    AdelanteEHR.advocateSchedule(link.id);
    const disclosed = AdelanteEHR.listAuditEvents({ category: ["advocate"], patientId: p.id }).find(
      (e) => e.action === "advocate_schedule_viewed",
    )!;
    expect(advocateGateOutcome(disclosed)).toEqual({
      linkValid: true,
      consentActive: true,
      part2Disclosed: true,
    });
  });

  it("returns undefined for non-advocate events so other rows stay clean", () => {
    const consentEvent = AdelanteEHR.listAuditEvents({ category: ["consent"] })[0];
    if (consentEvent) expect(advocateGateOutcome(consentEvent)).toBeUndefined();
  });
});
