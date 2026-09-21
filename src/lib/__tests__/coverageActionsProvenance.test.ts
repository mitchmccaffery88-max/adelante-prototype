import { describe, it, expect } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";

const ACTOR = { actorId: "Lupita Sanchez, MSW", actorRole: "ecm_provider" as const };

function newPatient(overrides: Record<string, unknown> = {}) {
  const p = AdelanteEHR.createPatient({
    firstName: "Test",
    lastName: `Coverage${Math.random().toString(36).slice(2, 7)}`,
    ...overrides,
  } as Parameters<typeof AdelanteEHR.createPatient>[0]);
  return p.id;
}

describe("Phase 3a — Medi-Cal actions provenance", () => {
  it("ECM eligibility never seeds ECM information-sharing consent", () => {
    const id = newPatient();
    AdelanteEHR.setEcmEligible(id, true, ACTOR);
    expect(AdelanteEHR.getConsentState(id).ecmShare).toBe(false);
    expect(AdelanteEHR.ecmConsentCapturePending(id)).toBe(true);
  });

  it("explicit consent clears the capture prompt", () => {
    const id = newPatient();
    AdelanteEHR.setEcmEligible(id, true, ACTOR);
    AdelanteEHR.setConsent(id, "ecmShare", true);
    expect(AdelanteEHR.getConsentState(id).ecmShare).toBe(true);
    expect(AdelanteEHR.ecmConsentCapturePending(id)).toBe(false);
  });

  it("records who changed every eligibility flag and when", () => {
    const id = newPatient();
    AdelanteEHR.setEcmEligible(id, true, ACTOR);
    AdelanteEHR.setJiReentry(id, true, ACTOR);
    AdelanteEHR.setCommunitySupport(id, "housing", true, ACTOR);
    const log = AdelanteEHR.getPatient(id)?.eligibilityFlagLog ?? [];
    expect(log.map((e) => e.key).sort()).toEqual(["cs_housing", "ecm", "jiReentry"]);
    for (const e of log) {
      expect(e.actorId).toBe(ACTOR.actorId);
      expect(e.actorRole).toBe(ACTOR.actorRole);
      expect(Date.parse(e.at)).not.toBeNaN();
    }
  });

  it("recording a check does not assert a coverage status", () => {
    const id = newPatient();
    const before = AdelanteEHR.getPatient(id)?.coverage?.status;
    const res = AdelanteEHR.recordCoverageCheck(id, {
      channel: "phone_county",
      result: "verified",
      ...ACTOR,
    });
    expect(res.ok).toBe(true);
    const cov = AdelanteEHR.getPatient(id)?.coverage;
    expect(cov?.verified).toBe("verified");
    expect(cov?.status).toBe(before ?? "none_unsure");
    expect(cov?.verifications?.[0]?.checkedBy).toBe(ACTOR.actorId);
    expect(cov?.verifications?.[0]?.channel).toBe("phone_county");
  });

  it("changes coverage status only when the checker confirmed one", () => {
    const id = newPatient();
    AdelanteEHR.recordCoverageCheck(id, {
      channel: "medi_cal_portal",
      result: "verified",
      statusConfirmed: "active",
      ...ACTOR,
    });
    const cov = AdelanteEHR.getPatient(id)?.coverage;
    expect(cov?.status).toBe("active");
    expect(cov?.verifications?.[0]?.statusConfirmed).toBe("active");
  });

  it("fills Patient.cin when absent and never copies it onto coverage", () => {
    const id = newPatient();
    AdelanteEHR.recordCoverageCheck(id, {
      channel: "phone_county",
      result: "verified",
      cin: "12345678a",
      ...ACTOR,
    });
    const p = AdelanteEHR.getPatient(id);
    expect(p?.cin).toBe("12345678A");
    const rec = p?.coverage?.verifications?.[0];
    expect(rec?.cinOnFile).toBe(true);
    expect(rec?.cinRecordedNow).toBe(true);
    expect(JSON.stringify(rec)).not.toContain("12345678A");
  });

  it("rejects a CIN that is not 9 characters", () => {
    const id = newPatient();
    const res = AdelanteEHR.recordCoverageCheck(id, {
      channel: "fax",
      result: "verified",
      cin: "123",
      ...ACTOR,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/9 characters/);
    expect(AdelanteEHR.getPatient(id)?.cin).toBeUndefined();
  });

  it("reactivation creates a real staff worklist row when a case manager is assigned", () => {
    const id = newPatient();
    AdelanteEHR.assignCaseManager({ patientId: id, caseManagerId: "cm1" });
    const res = AdelanteEHR.requestReactivation(id, ACTOR);
    expect(res.staffTaskCreated).toBe(true);
    const tasks = AdelanteEHR.listCaseTasks().filter((t) => t.patientId === id);
    expect(tasks.some((t) => /reactivation/i.test(t.title))).toBe(true);
  });

  it("reactivation reports honestly when nobody is assigned", () => {
    const id = newPatient();
    expect(AdelanteEHR.requestReactivation(id, ACTOR).staffTaskCreated).toBe(false);
  });

  it("the client-facing reactivation to-do does not claim a county filing", () => {
    const id = newPatient();
    AdelanteEHR.requestReactivation(id, ACTOR);
    const task = (AdelanteEHR.getPatient(id)?.tasks ?? []).find((t) => t.kind === "reactivation");
    expect(task?.label).not.toMatch(/requested with county/i);
  });

  it("enrollment assistance creates a real staff worklist row", () => {
    const id = newPatient();
    AdelanteEHR.assignCaseManager({ patientId: id, caseManagerId: "cm1" });
    expect(AdelanteEHR.addEnrollmentAssistTask(id, ACTOR).staffTaskCreated).toBe(true);
    const tasks = AdelanteEHR.listCaseTasks().filter((t) => t.patientId === id);
    expect(tasks.some((t) => /BenefitsCal/i.test(t.title))).toBe(true);
  });
});
