import { activateAhcdForTest } from "./helpers/ahcdTestActivation";
// §v3.0 Phase 4 EXPANSION — two-tier permissions + advocate-as-own-patient.
//
// Proves the four things the expansion has to be true about:
//  1. the decision-making tier gets GENUINELY more than participation,
//  2. 42 CFR Part 2 / SUD content stays masked across the EXPANDED scope,
//     not just the original schedule view,
//  3. an advocate-turned-patient's own record and the record they advocate for
//     never cross, in EITHER direction,
//  4. every expanded read/write is still audited.
import { describe, it, expect } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import {
  permissionsForType,
  advocateTier,
  advocatePart2Masked,
  ADVOCATE_AUTHORIZATION_TYPES,
  type AdvocateAuthorizationType,
} from "@/lib/advocate";

function pid(): string {
  const p = AdelanteEHR.listPatients()[0];
  if (!p) throw new Error("fixture patient missing");
  return p.id;
}

function connected(type: AdvocateAuthorizationType, patientId = pid()) {
  const link = AdelanteEHR.createAdvocateInvitation({
    patientId,
    advocateName: "Rosa Ibarra",
    relationship: "Sister",
    invitationSentTo: "rosa@example.org",
    invitationChannel: "email",
    designatedBy: { actor: "patient", name: "Test Patient" },
  });
  AdelanteEHR.claimAdvocateInvitation({
    code: link.invitationCode,
    authorizationType: type,
    attestedName: "Rosa Ibarra",
  });
  if (type === "ahcd") activateAhcdForTest(link.id);
  if (type === "conservatorship")
    AdelanteEHR.recordAdvocateConservatorshipDocs(link.id, {
      verifiedBy: "Records Clerk",
      courtOrderRef: "PR-2026-0001",
    });
  return { link: AdelanteEHR.getAdvocateLink(link.id)!, patientId };
}

describe("four-tier legal-authority permission model (§Phase 4.1)", () => {
  it("groups every authorization type into exactly one tier", () => {
    for (const t of ADVOCATE_AUTHORIZATION_TYPES) {
      expect(advocateTier(t.key)).toBe(t.tier);
    }
    expect(advocateTier("ahcd")).toBe("ahcd_agent");
    expect(advocateTier("conservatorship")).toBe("conservator");
    expect(advocateTier("hipaa_authorization")).toBe("hipaa_only");
    expect(advocateTier("dhcs_authorized_representative")).toBe("authorized_representative");
    expect(advocateTier("family_participation")).toBe("hipaa_only");
  });

  it("HIPAA-only is strictly read-only — no write grant of any kind", () => {
    const hipaa = permissionsForType("hipaa_authorization");
    expect(hipaa.some((p) => p.endsWith("_write") || p === "document_upload")).toBe(false);
    expect(hipaa.sort()).toEqual(
      [
        "care_plan_participation_view",
        "coordination_view",
        "document_view",
        "eligibility_assist_view",
        // §Adelante Journey Phase 5 — self-help progress is a READ at the
        // floor tier; it adds no write and no clinical content.
        "library_progress_view",
        "schedule_view",
      ].sort(),
    );
  });

  it("AR = the HIPAA-only view set PLUS eligibility_assist_write, nothing else", () => {
    const hipaa = permissionsForType("hipaa_authorization");
    const ar = permissionsForType("dhcs_authorized_representative");
    for (const p of hipaa) expect(ar).toContain(p);
    expect(ar.filter((p) => !hipaa.includes(p))).toEqual(["eligibility_assist_write"]);
    // Enrollment actions only — no clinical view, no coordination authorship.
    expect(ar).not.toContain("care_plan_clinical_view");
    expect(ar).not.toContain("coordination_write");
    expect(ar).not.toContain("care_plan_participation_write");
  });

  it("the two authority tiers are a strict superset of AR and share one grant set", () => {
    const ar = permissionsForType("dhcs_authorized_representative");
    const ahcd = permissionsForType("ahcd");
    const cons = permissionsForType("conservatorship");
    for (const p of ar) expect(ahcd).toContain(p);
    expect([...cons].sort()).toEqual([...ahcd].sort());
    for (const extra of [
      "coordination_write",
      "care_plan_participation_write",
      "care_plan_clinical_view",
    ]) {
      expect(ahcd).toContain(extra);
      expect(ar).not.toContain(extra);
    }
  });

  it("clinical notes and messaging are granted to nobody, at any tier", () => {
    for (const t of ADVOCATE_AUTHORIZATION_TYPES) {
      expect(permissionsForType(t.key)).not.toContain("clinical_notes_view");
      expect(permissionsForType(t.key)).not.toContain("messaging");
    }
  });

  it("the tier differences are real at the STORE boundary, not only in the table", () => {
    const hipaa = connected("hipaa_authorization");
    const ar = connected("dhcs_authorized_representative");
    const auth = connected("conservatorship");

    // Clinical care-plan view: authority tiers only.
    expect(AdelanteEHR.advocateCarePlanClinical(hipaa.link.id).allowed).toBe(false);
    expect(AdelanteEHR.advocateCarePlanClinical(ar.link.id).allowed).toBe(false);
    expect(AdelanteEHR.advocateCarePlanClinical(auth.link.id).allowed).toBe(true);

    // Eligibility write: AR and above.
    expect(
      AdelanteEHR.advocateAttestEligibilityAssist(hipaa.link.id, { attestedName: "Rosa" }).ok,
    ).toBe(false);
    expect(
      AdelanteEHR.advocateAttestEligibilityAssist(ar.link.id, { attestedName: "Rosa" }).ok,
    ).toBe(true);
    expect(
      AdelanteEHR.advocateAttestEligibilityAssist(auth.link.id, { attestedName: "Rosa" }).ok,
    ).toBe(true);

    // Care-plan participation WRITE: authority tiers only.
    const comment = { section: "housing", text: "Spare room in Fresno." } as const;
    expect(AdelanteEHR.advocateAddCarePlanComment(hipaa.link.id, comment).ok).toBe(false);
    expect(AdelanteEHR.advocateAddCarePlanComment(ar.link.id, comment).ok).toBe(false);
    expect(AdelanteEHR.advocateAddCarePlanComment(auth.link.id, comment).ok).toBe(true);

    // Every tier keeps the coordination READ floor.
    for (const c of [hipaa, ar, auth]) {
      expect(AdelanteEHR.advocateCoordination(c.link.id).allowed).toBe(true);
    }
  });
});

describe("42 CFR Part 2 masking survives the expanded scope", () => {
  it("is unconditional for every authorization type", () => {
    expect(advocatePart2Masked()).toBe(true);
    for (const t of ADVOCATE_AUTHORIZATION_TYPES) expect(advocatePart2Masked(t.key)).toBe(true);
  });

  it("SUD coordination items are withheld from the coordination view (count only)", () => {
    const { link, patientId } = connected("hipaa_authorization");
    AdelanteEHR.addSdohItem(patientId, { need: "Bus pass for appointments" });
    AdelanteEHR.addSdohItem(patientId, { need: "Sober living placement after detox" });

    const view = AdelanteEHR.advocateCoordination(link.id);
    expect(view.allowed).toBe(true);
    const text = JSON.stringify(view.items).toLowerCase();
    expect(text).toContain("bus pass");
    expect(text).not.toContain("sober living");
    expect(text).not.toContain("detox");
    expect(view.maskedCount).toBeGreaterThanOrEqual(1);
  });

  it("an advocate cannot WRITE Part 2 content into coordination or the care plan", () => {
    const { link } = connected("conservatorship");
    const w = AdelanteEHR.advocateAddCoordinationNeed(link.id, {
      need: "Ride to the methadone clinic",
    });
    expect(w.ok).toBe(false);
    const c = AdelanteEHR.advocateAddCarePlanComment(link.id, {
      section: "general",
      text: "Please restart her buprenorphine",
    });
    expect(c.ok).toBe(false);
  });

  it("the decision-making tier's clinical care-plan view still strips SUD content", () => {
    const { link } = connected("ahcd");
    const view = AdelanteEHR.advocateCarePlanClinical(link.id);
    expect(view.allowed).toBe(true);
    const blob = JSON.stringify(view).toLowerCase();
    for (const term of ["suboxone", "buprenorphine", "methadone", "audit", "dast", "substance"]) {
      expect(blob).not.toContain(term);
    }
    expect(view.focusAreas.every((f) => f.key !== "sud")).toBe(true);
    expect(view.hiddenSensitiveCount).toBeGreaterThanOrEqual(0);
  });

  it("eligibility visibility carries coverage status only, no clinical qualification detail", () => {
    const { link } = connected("dhcs_authorized_representative");
    const view = AdelanteEHR.advocateEligibilityAssist(link.id);
    expect(view.allowed).toBe(true);
    expect(view.canAct).toBe(true);
    const keys = Object.keys(view.coverage ?? {});
    expect(keys.every((k) => ["status", "verified", "countyOfRelease"].includes(k))).toBe(true);
  });
});

describe("expanded scope is audited", () => {
  it("records a distinct audit row for each expanded read and for denials", () => {
    const { link, patientId } = connected("conservatorship");
    const before = AdelanteEHR.listAuditEvents({ patientId }).length;
    AdelanteEHR.advocateCoordination(link.id);
    AdelanteEHR.advocateCarePlanParticipation(link.id);
    AdelanteEHR.advocateEligibilityAssist(link.id);
    AdelanteEHR.advocateCarePlanClinical(link.id);
    const rows = AdelanteEHR.listAuditEvents({ patientId })
      .filter((e) => e.category === "advocate")
      .map((e) => e.action);
    expect(AdelanteEHR.listAuditEvents({ patientId }).length).toBeGreaterThan(before);
    for (const a of [
      "advocate_coordination_viewed",
      "advocate_care_plan_participation_viewed",
      "advocate_eligibility_viewed",
      "advocate_care_plan_clinical_viewed",
    ]) {
      expect(rows).toContain(a);
    }

    const p2 = connected("hipaa_authorization");
    AdelanteEHR.advocateCarePlanClinical(p2.link.id);
    expect(
      AdelanteEHR.listAuditEvents({ patientId: p2.patientId })
        .filter((e) => e.category === "advocate")
        .map((e) => e.action),
    ).toContain("advocate_access_denied");
  });
});

describe("care plan PARTICIPATION does not become authorship", () => {
  it("comments land in a separate stream and never mutate the plan", () => {
    // §Phase 4.1 — commenting is a write, so this is an activated AHCD agent.
    const { link, patientId } = connected("ahcd");
    const before = JSON.stringify(AdelanteEHR.reentryCarePlanForPatient(patientId) ?? null);
    const res = AdelanteEHR.advocateAddCarePlanComment(link.id, {
      section: "housing",
      text: "She can stay with me for the first two weeks.",
    });
    expect(res.ok).toBe(true);
    expect(JSON.stringify(AdelanteEHR.reentryCarePlanForPatient(patientId) ?? null)).toBe(before);
    const contributions = AdelanteEHR.advocateContributionsForPatient(patientId);
    expect(contributions[0]?.text).toContain("two weeks");
    expect(contributions[0]?.authorName).toBe("Rosa Ibarra");
  });
});

describe("advocate as their own patient — the two sides never cross", () => {
  function dual() {
    const advocatedFor = pid();
    const { link } = connected("conservatorship", advocatedFor);
    const self = AdelanteEHR.startAdvocateSelfCare(link.id, {
      firstName: "Rosa",
      lastName: "Ibarra",
      dob: "1979-04-02",
    });
    return { link, advocatedFor, self };
  }

  it("creates a normal, distinct Patient record under the same connection", () => {
    const { link, advocatedFor, self } = dual();
    expect(self.id).not.toBe(advocatedFor);
    expect(AdelanteEHR.getAdvocateLink(link.id)?.selfPatientId).toBe(self.id);
    // Standard patient, not an advocate flavour of one.
    expect(AdelanteEHR.getPatient(self.id)?.firstName).toBe("Rosa");
    // Idempotent: the prompt cannot spawn duplicate records.
    expect(AdelanteEHR.startAdvocateSelfCare(link.id, { firstName: "X", lastName: "Y" }).id).toBe(
      self.id,
    );
  });

  it("DIRECTION 1 — the advocated-for patient's data never appears on the self record", () => {
    const { advocatedFor, self } = dual();
    AdelanteEHR.addSdohItem(advocatedFor, { need: "Bus pass for appointments" });
    const own = AdelanteEHR.getPatient(self.id)!;
    expect(JSON.stringify(own)).not.toContain("Bus pass");
    expect(own.sdohPlan?.items ?? []).toHaveLength(0);
    expect(AdelanteEHR.getCarePlan(self.id)?.activeGoals ?? []).not.toEqual(
      AdelanteEHR.getCarePlan(advocatedFor)?.activeGoals,
    );
    // No advocate-side audit row is written against the self record.
    expect(
      AdelanteEHR.listAuditEvents({ patientId: self.id }).filter(
        (e) => e.category === "advocate" && e.action !== "advocate_self_care_started",
      ),
    ).toHaveLength(0);
  });

  it("DIRECTION 2 — the self record's data never appears on the advocate surfaces", () => {
    const { link, advocatedFor, self } = dual();
    AdelanteEHR.addSdohItem(self.id, { need: "Childcare while I work" });
    const coord = AdelanteEHR.advocateCoordination(link.id);
    expect(JSON.stringify(coord)).not.toContain("Childcare");
    expect(JSON.stringify(AdelanteEHR.advocateSchedule(link.id))).not.toContain(self.id);
    const clinical = AdelanteEHR.advocateCarePlanClinical(link.id);
    expect(JSON.stringify(clinical)).not.toContain("Childcare");
    // And the advocated-for patient's chart gains nothing from the self record.
    expect(
      (AdelanteEHR.getPatient(advocatedFor)?.sdohPlan?.items ?? []).some((i) =>
        i.need.includes("Childcare"),
      ),
    ).toBe(false);
  });

  it("self-care access is NOT derived from the advocate link's permissions", () => {
    const { link, self } = dual();
    AdelanteEHR.revokeAdvocateLink(link.id, "Test Patient", "no longer needed");
    // Advocate side is dead...
    expect(AdelanteEHR.advocateCoordination(link.id).allowed).toBe(false);
    // ...their own patient record is untouched.
    expect(AdelanteEHR.getPatient(self.id)?.firstName).toBe("Rosa");
  });

  it("a self record can never be the advocated-for record", () => {
    const { link, advocatedFor } = dual();
    expect(AdelanteEHR.advocateSelfPatient(link.id)?.id).not.toBe(advocatedFor);
  });
});
