// §v3.0 Phase 4.2 — AHCD activation workflow (6.4) + frontline validation
// checklist (6.5). The point of these tests is that activation is a real
// clinical act with real preconditions, not a boolean somebody can set.
import { describe, it, expect } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { ADVOCATE_SUD_DISCLOSURE_CATEGORY } from "@/lib/advocate";
import { activateAhcdForTest } from "./helpers/ahcdTestActivation";

let n = 0;
const REVIEWER = "Val Ortiz, CF Care Manager";

function ahcdLink() {
  const patient = AdelanteEHR.createPatient({ firstName: "Ahcd", lastName: `Case${++n}` });
  const link = AdelanteEHR.createAdvocateInvitation({
    patientId: patient.id,
    advocateName: "Rosa Ibarra",
    relationship: "Sister",
    invitationSentTo: `rosa-ahcd${n}@example.org`,
    invitationChannel: "email",
    designatedBy: { actor: "patient", name: "Test Patient" },
  });
  AdelanteEHR.claimAdvocateInvitation({
    code: link.invitationCode,
    authorizationType: "ahcd",
    attestedName: "Rosa Ibarra",
  });
  return { patientId: patient.id, linkId: link.id };
}

function clearItems(linkId: string, part2: "verified" | "unclear" = "verified") {
  for (const item of ["identity_match", "agent_identification", "execution_validity"] as const)
    AdelanteEHR.recordAhcdChecklistItem(linkId, { item, outcome: "verified", reviewedBy: REVIEWER });
  AdelanteEHR.recordAhcdChecklistItem(linkId, {
    item: "part2_scope",
    outcome: part2,
    reviewedBy: REVIEWER,
  });
}

const determination = {
  determinedBy: "Dr. Bagga",
  determinedByRole: "pmhnp",
  basis: "Client cannot communicate health care decisions.",
};

describe("AHCD activation — who may determine incapacity", () => {
  it("an arbitrary staff role cannot record the determination", () => {
    const { linkId } = ahcdLink();
    clearItems(linkId);
    expect(() =>
      AdelanteEHR.activateAdvocateAhcd(linkId, { ...determination, determinedByRole: "cf_care_manager" }),
    ).toThrow(/PMHNP or licensed therapist/i);
    expect(AdelanteEHR.advocateAccess(linkId).denyReason).toBe("ahcd_not_activated");
  });

  it("the advocate cannot self-attest the determination", () => {
    const { linkId } = ahcdLink();
    clearItems(linkId);
    expect(() =>
      AdelanteEHR.activateAdvocateAhcd(linkId, { ...determination, determinedByRole: "advocate" }),
    ).toThrow(/PMHNP or licensed therapist/i);
  });

  it("a clinical role with a stated basis activates it", () => {
    const { linkId } = ahcdLink();
    clearItems(linkId);
    AdelanteEHR.activateAdvocateAhcd(linkId, { ...determination, determinedByRole: "therapist" });
    const state = AdelanteEHR.ahcdValidationState(linkId);
    expect(state.activation?.state).toBe("clinically_active");
    expect(AdelanteEHR.advocateAccess(linkId).allowed).toBe(true);
  });

  it("a basis is required", () => {
    const { linkId } = ahcdLink();
    clearItems(linkId);
    expect(() => AdelanteEHR.activateAdvocateAhcd(linkId, { ...determination, basis: "  " })).toThrow(
      /basis/i,
    );
  });
});

describe("AHCD activation — the checklist is a real precondition", () => {
  it("item 4 alone is not enough: items 1-3 must be cleared first", () => {
    const { linkId } = ahcdLink();
    expect(() => AdelanteEHR.activateAdvocateAhcd(linkId, determination)).toThrow();
    AdelanteEHR.recordAhcdChecklistItem(linkId, {
      item: "identity_match",
      outcome: "verified",
      reviewedBy: REVIEWER,
    });
    expect(() => AdelanteEHR.activateAdvocateAhcd(linkId, determination)).toThrow();
    expect(AdelanteEHR.advocateAccess(linkId).denyReason).toBe("ahcd_not_activated");
  });

  it("the Part 2 scope question must be answered either way before activation", () => {
    const { linkId } = ahcdLink();
    for (const item of ["identity_match", "agent_identification", "execution_validity"] as const)
      AdelanteEHR.recordAhcdChecklistItem(linkId, { item, outcome: "verified", reviewedBy: REVIEWER });
    expect(() => AdelanteEHR.activateAdvocateAhcd(linkId, determination)).toThrow();
    AdelanteEHR.recordAhcdChecklistItem(linkId, {
      item: "part2_scope",
      outcome: "unclear",
      reviewedBy: REVIEWER,
    });
    expect(() => AdelanteEHR.activateAdvocateAhcd(linkId, determination)).not.toThrow();
  });

  it("a failed execution-validity check blocks activation outright", () => {
    const { linkId } = ahcdLink();
    clearItems(linkId);
    AdelanteEHR.recordAhcdChecklistItem(linkId, {
      item: "execution_validity",
      outcome: "failed",
      reviewedBy: REVIEWER,
      note: "One witness was the facility operator.",
    });
    expect(() => AdelanteEHR.activateAdvocateAhcd(linkId, determination)).toThrow(/failed/i);
  });

  it("each item is independently tracked and opens its own worklist task", () => {
    const { patientId, linkId } = ahcdLink();
    const tasks = AdelanteEHR.listCaseTasks().filter(
      (t) => t.patientId === patientId && t.origin === "advocate_ahcd_validation",
    );
    expect(tasks).toHaveLength(5);
    AdelanteEHR.recordAhcdChecklistItem(linkId, {
      item: "identity_match",
      outcome: "verified",
      reviewedBy: REVIEWER,
    });
    const state = AdelanteEHR.ahcdValidationState(linkId);
    expect(state.items.find((i) => i.key === "identity_match")?.finding?.outcome).toBe("verified");
    expect(state.items.find((i) => i.key === "agent_identification")?.finding).toBeUndefined();
  });

  it("item 4 is the activation, not a separate checkbox", () => {
    const { linkId } = ahcdLink();
    expect(() =>
      AdelanteEHR.recordAhcdChecklistItem(linkId, {
        item: "incapacity_determination",
        outcome: "verified",
        reviewedBy: REVIEWER,
      }),
    ).toThrow(/activating the directive/i);
  });
});

describe("AHCD activation — temporary determinations expire", () => {
  it("an expired review date returns the link to dormant behaviour", () => {
    const { linkId } = ahcdLink();
    clearItems(linkId);
    AdelanteEHR.activateAdvocateAhcd(linkId, { ...determination, reviewByDate: "2999-01-01" });
    expect(AdelanteEHR.advocateAccess(linkId).allowed).toBe(true);
    // Simulate the review date lapsing.
    const link = AdelanteEHR.getAdvocateLink(linkId)!;
    link.ahcdActivation!.reviewByDate = "2020-01-01";
    const decision = AdelanteEHR.advocateAccess(linkId);
    expect(decision.allowed).toBe(false);
    expect(decision.denyReason).toBe("ahcd_determination_expired");
    expect(AdelanteEHR.ahcdValidationState(linkId).activation?.state).toBe("expired");
  });

  it("a review date in the past is rejected at activation time", () => {
    const { linkId } = ahcdLink();
    clearItems(linkId);
    expect(() =>
      AdelanteEHR.activateAdvocateAhcd(linkId, { ...determination, reviewByDate: "2020-01-01" }),
    ).toThrow(/future/i);
  });
});

describe("AHCD — Part 2 scope gates SUD independently of general access", () => {
  function signSud(patientId: string) {
    AdelanteEHR.recordConsent({
      patientId,
      category: ADVOCATE_SUD_DISCLOSURE_CATEGORY,
      granted: true,
      signedBy: "patient",
      method: "electronic",
    });
  }

  it("a clearly-scoped AHCD gets Part 2 from its own authority", () => {
    const { linkId } = ahcdLink();
    activateAhcdForTest(linkId);
    expect(AdelanteEHR.advocateSudUnmasked(linkId)).toBe(true);
  });

  it("an AHCD marked 'Part 2 unclear' still needs the separate ASCMI consent", () => {
    const { patientId, linkId } = ahcdLink();
    activateAhcdForTest(linkId, { part2ScopeUnclear: true });
    // General clinical access is active…
    expect(AdelanteEHR.advocateAccess(linkId).allowed).toBe(true);
    // …but Part 2 is not, until the consent exists.
    expect(AdelanteEHR.advocateSudUnmasked(linkId)).toBe(false);
    signSud(patientId);
    expect(AdelanteEHR.advocateSudUnmasked(linkId)).toBe(true);
  });
});
