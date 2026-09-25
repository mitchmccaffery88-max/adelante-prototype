import { describe, expect, it } from "vitest";
import { AdelanteEHR, DEMO_PRE_RELEASE_PERSONA, demoScenarioPatientId } from "@/lib/ehr";
import { scoreScreener, screenerByKey } from "@/lib/screeners";
import { recoveryJourneyVisible } from "@/lib/seeking";

describe("DAST-10 item 3 reverse scoring", () => {
  const dast = screenerByKey("dast-10")!;
  it("a 'No' on item 3 scores 1", () => {
    expect(scoreScreener(dast, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]).score).toBe(1);
    expect(scoreScreener(dast, [0, 0, 1, 0, 0, 0, 0, 0, 0, 0]).score).toBe(0);
  });
  it("known answer sets", () => {
    expect(scoreScreener(dast, [1, 1, 0, 1, 1, 1, 1, 1, 1, 1]).score).toBe(10);
    expect(scoreScreener(dast, [1, 1, 1, 0, 0, 0, 0, 0, 0, 0]).score).toBe(2);
    expect(scoreScreener(dast, [1, 1, 0, 0, 0, 0, 0, 0, 0, 0]).positive).toBe(true);
  });
});

describe("Part B QA scenario records", () => {
  const get = (k: Parameters<typeof demoScenarioPatientId>[0]) =>
    AdelanteEHR.getPatient(demoScenarioPatientId(k)!)!;

  it("every intake-by-need persona completed intake with the current screeners", () => {
    for (const k of ["mh_only", "medication", "sud_consented", "combination", "ji_self_report"] as const) {
      const p = get(k);
      expect(p.intakeCompletedAt).toBeTruthy();
      for (const s of ["phq-9", "gad-7", "pc-ptsd-5", "ahc-hrsn"]) expect(p.screeners[s]).toBeTruthy();
      expect(p.screeners["pcl-5"]).toBeUndefined();
    }
  });
  it("SUD screeners and Recovery Journey only with substance use + Part 2 consent", () => {
    for (const k of ["sud_consented", "combination"] as const) {
      const p = get(k);
      expect(p.screeners["audit"]).toBeTruthy();
      expect(p.screeners["dast-10"]).toBeTruthy();
      expect(recoveryJourneyVisible(p)).toBe(true);
    }
    for (const k of ["mh_only", "medication", "ji_self_report"] as const) {
      const p = get(k);
      expect(p.screeners["audit"]).toBeUndefined();
      expect(recoveryJourneyVisible(p)).toBe(false);
    }
  });
  it("self-reported justice history is recorded but is not a substance-use signal", () => {
    const p = get("ji_self_report");
    expect(p.coverage?.justiceInvolvement).toBe("yes");
    expect(p.calomsProfile?.justice?.source).toBe("self_report");
    expect(recoveryJourneyVisible(p)).toBe(false);
  });
  it("public referral ran outreach → enrollment → claim code", () => {
    const p = get("public_referral");
    const ref = AdelanteEHR.listReferrals().find((r) => r.enrolledPatientId === p.id)!;
    expect(ref.status).toBe("enrolled");
    expect(ref.outreach?.attempts?.length).toBeGreaterThan(0);
    expect(AdelanteEHR.listEnrollmentCodes(p.id).length).toBeGreaterThan(0);
  });
  it("Tomás has a live enrollment code", () => {
    const t = AdelanteEHR.listPatients().find((p) => p.firstName === DEMO_PRE_RELEASE_PERSONA.firstName)!;
    expect(AdelanteEHR.listEnrollmentCodes(t.id).length).toBeGreaterThan(0);
  });
});
