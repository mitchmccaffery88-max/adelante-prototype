import { describe, expect, it } from "vitest";
import { AdelanteEHR, demoScenarioPatientId, type ScreenerResult } from "@/lib/ehr";
// Importing ehr-ext registers the H0001 claim creator (and backfills seeds).
import "@/lib/ehr-ext";
import { scoreScreener, screenerByKey } from "@/lib/screeners";
import { recoveryJourneyVisible } from "@/lib/seeking";
import {
  ASAM_DIMENSIONS,
  ASAM_SIGN_ROLES,
  asamNeedsCosign,
  type AsamAssessment,
} from "@/lib/asam";
import { LPHA_SUPERVISOR_ROLES } from "@/lib/roles";
import { attestationStatement, buildAttestationRecord } from "@/lib/attestation";
import { ASK_ADEL_QUESTIONS, part2Gated } from "@/lib/askAdel";

const REYES = { staffId: "s-th1", name: "Dr. Marisol Reyes", role: "therapist" as const, clinicianId: "c1" };
const VARGAS = { staffId: "s-sudc1", name: "Renee Castillo", role: "sud_counselor" as const };
const OKAFOR = { staffId: "s-th2", name: "Dr. James Okafor", role: "therapist" as const, clinicianId: "c2" };
const ATT = { attested: true, signatureDataUrl: "data:image/png;base64,dGVzdA==" };
const att = (statement: "asam_sign" | "asam_supervisor_sign", signedBy: string) =>
  buildAttestationRecord({ statement: attestationStatement(statement), draft: ATT, signedBy });

let n = 0;
function fresh(part2 = true) {
  const p = AdelanteEHR.createPatient({
    firstName: "Asam",
    lastName: `T${++n}`,
    dob: "1990-01-01",
  } as Parameters<typeof AdelanteEHR.createPatient>[0]);
  AdelanteEHR.completeIntake(p.id, {
    needs: { housing: false, food: false, employment: false, transport: false },
    hipaa: true,
    part2Sud: part2,
  });
  return p;
}

function seedScreener(patientId: string, key: string, answers: number[]) {
  const def = screenerByKey(key)!;
  const scored = scoreScreener(def, answers);
  AdelanteEHR.recordScreener(patientId, {
    key,
    score: scored.score,
    severity: scored.severity,
    ...(scored.positive !== undefined ? { positive: scored.positive } : {}),
    responses: answers,
    completedAt: new Date().toISOString(),
    timepoint: "intake",
    context: "intake",
  } as ScreenerResult);
}

function fullDraft(patientId: string, actor: typeof REYES | typeof VARGAS, over: Partial<AsamAssessment> = {}) {
  return AdelanteEHR.saveAsamDraft(
    patientId,
    {
      dimensions: ASAM_DIMENSIONS.map((d) => ({ key: d.key, documentation: "Documented.", rating: 1 as const })),
      recommendedLevel: "outpatient",
      actualLevel: "outpatient",
      diagnosisCodes: ["F10.20"],
      ...over,
    },
    actor,
  );
}

describe("Phase 10c — ASAM triggers", () => {
  it("a positive AUDIT at intake creates exactly one task; a second trigger de-duplicates", () => {
    const p = fresh();
    seedScreener(p.id, "audit", [2, 2, 2, 2, 0, 0, 2, 0, 0, 0]); // score 10 → positive
    const t1 = AdelanteEHR.openAsamTask(p.id);
    expect(t1).toBeDefined();
    expect(t1!.origin).toBe("asam_needed");
    seedScreener(p.id, "dast-10", [1, 1, 0, 1, 1, 0, 0, 0, 0, 0]); // positive
    const t2 = AdelanteEHR.openAsamTask(p.id);
    expect(t2!.id).toBe(t1!.id); // same task, reason appended
    expect(t2!.detail).toContain("DAST-10");
  });

  it("a negative AUDIT creates no task", () => {
    const p = fresh();
    seedScreener(p.id, "audit", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(AdelanteEHR.openAsamTask(p.id)).toBeUndefined();
  });

  it("selecting substance use treatment creates a task — with AND without Part 2 consent", () => {
    const consented = fresh(true);
    AdelanteEHR.recordSeeking(consented.id, { mentalHealth: false, medication: false, substanceUse: true }, { id: consented.id, role: "patient" }, { sudConsentGiven: true });
    expect(AdelanteEHR.openAsamTask(consented.id)).toBeDefined();

    const declined = fresh(false);
    AdelanteEHR.recordSeeking(declined.id, { mentalHealth: false, medication: false, substanceUse: true }, { id: declined.id, role: "patient" }, { sudConsentGiven: false });
    const task = AdelanteEHR.openAsamTask(declined.id);
    expect(task).toBeDefined();
    expect(task!.detail).toContain("consent declined");
  });

  it("justice involvement alone is NOT a trigger", () => {
    const p = fresh();
    AdelanteEHR.setJusticeSelfReport(p.id, { arrestsPast12Months: 1, timeInCustodyMonths: 6, recordedBy: p.id });
    expect(AdelanteEHR.openAsamTask(p.id)).toBeUndefined();
  });

  it("a clinician decision creates a task even after a recently signed ASAM", () => {
    const p = fresh();
    const d = fullDraft(p.id, REYES);
    AdelanteEHR.signAsam(p.id, d.id, REYES, att("asam_sign", REYES.name));
    // Non-clinician trigger is suppressed inside the reassessment window…
    AdelanteEHR.requestAsamAssessment(p.id, "Positive AUDIT at re-screen (score 12)");
    expect(AdelanteEHR.openAsamTask(p.id)).toBeUndefined();
    // …but a clinician decision always opens one.
    AdelanteEHR.requestAsamAssessment(p.id, "Clinician decision from the chart", { clinicianDecision: true });
    expect(AdelanteEHR.openAsamTask(p.id)).toBeDefined();
  });

  it("a referral naming a substance use need triggers a task at enrollment", () => {
    const ref = AdelanteEHR.createReferral({
      firstName: "Ref",
      lastName: `SUD${n}`,
      referringAgency: "Test Agency",
      referrerName: "Referrer",
      referrerEmail: "referrer@example.org",
      referralSource: "community_based_organization",
      consentToContact: true,
      substanceUseNeed: true,
      channel: "public",
    } as Parameters<typeof AdelanteEHR.createReferral>[0]);
    const pid = AdelanteEHR.enrollReferral(ref!.id)!;
    expect(AdelanteEHR.openAsamTask(pid)).toBeDefined();
  });
});

describe("Phase 10c — Part 2 masking of the no-consent path", () => {
  it("the selection is kept, the task is masked to clinical author roles, and patient tools stay hidden", () => {
    const p = fresh(false);
    AdelanteEHR.recordSeeking(p.id, { mentalHealth: false, medication: false, substanceUse: true }, { id: p.id, role: "patient" }, { sudConsentGiven: false });
    const updated = AdelanteEHR.getPatient(p.id)!;
    // The answer is NOT dropped.
    expect(updated.seeking?.substanceUse).toBe(true);
    expect(updated.seeking?.part2ConsentAtSelection).toBe(false);
    expect(updated.needs.substanceUse).toBe(true);
    // The task is restricted to clinical author roles — never case managers,
    // peers, advocates, or billing.
    const task = AdelanteEHR.openAsamTask(p.id)!;
    expect(task.allowedRoles).toEqual(expect.arrayContaining(["therapist", "pmhnp", "sud_counselor", "clinical_trainee"]));
    for (const r of ["ecm_provider", "cf_care_manager", "peer_specialist", "billing"] as const) {
      expect(task.allowedRoles).not.toContain(r);
    }
    // Patient-facing substance-use tools stay hidden until consent.
    expect(recoveryJourneyVisible(updated)).toBe(false);
  });

  it("with consent, the same selection shows the patient tools", () => {
    const p = fresh(true);
    AdelanteEHR.recordSeeking(p.id, { mentalHealth: false, medication: false, substanceUse: true }, { id: p.id, role: "patient" }, { sudConsentGiven: true });
    expect(recoveryJourneyVisible(AdelanteEHR.getPatient(p.id)!)).toBe(true);
  });
});

describe("Phase 10c — signing rules", () => {
  it("the sign-role list matches the LPHA supervisor list; counselors author, never final-sign", () => {
    expect([...ASAM_SIGN_ROLES].sort()).toEqual([...LPHA_SUPERVISOR_ROLES].sort());
    expect(asamNeedsCosign("sud_counselor")).toBe(true);
    expect(asamNeedsCosign("clinical_trainee")).toBe(true);
    expect(asamNeedsCosign("therapist")).toBe(false);
  });

  it("the system never sets a level: signing without a clinician-chosen level fails", () => {
    const p = fresh();
    const d = fullDraft(p.id, REYES, { actualLevel: undefined });
    expect(() => AdelanteEHR.signAsam(p.id, d.id, REYES, att("asam_sign", REYES.name))).toThrow(/level of care/);
  });

  it("a differing actual level requires a reason", () => {
    const p = fresh();
    const d = fullDraft(p.id, REYES, { recommendedLevel: "residential", actualLevel: "outpatient" });
    expect(() => AdelanteEHR.signAsam(p.id, d.id, REYES, att("asam_sign", REYES.name))).toThrow(/differs/);
    AdelanteEHR.saveAsamDraft(p.id, { levelDifferenceReason: "Patient declines residential; strong home support." }, REYES);
    const signed = AdelanteEHR.signAsam(p.id, d.id, REYES, att("asam_sign", REYES.name));
    expect(signed.status).toBe("signed");
  });

  it("LPHA author signs final and outputs fire immediately (episode, claim, goal, tasks)", () => {
    const p = fresh();
    AdelanteEHR.requestAsamAssessment(p.id, "Clinician decision from the chart", { clinicianDecision: true });
    const d = fullDraft(p.id, REYES);
    const signed = AdelanteEHR.signAsam(p.id, d.id, REYES, att("asam_sign", REYES.name));
    expect(signed.status).toBe("signed");
    expect(signed.outputs?.medicalNecessity).toBe(true);
    expect(signed.outputs?.episodeId).toBeDefined();
    expect(signed.outputs?.claimId).toBeDefined();
    expect(signed.outputs?.calomsPromptTaskId).toBeDefined();
    expect(signed.outputs?.suggestedGoalId).toBeDefined();
    expect(signed.outputs?.reassessmentTaskId).toBeDefined();
    // The open "ASAM needed" task is closed by the signature.
    expect(AdelanteEHR.openAsamTask(p.id)).toBeUndefined();
    // DMC-ODS episode carries the clinician-selected level.
    const ep = AdelanteEHR.getPatient(p.id)!.episodes!.find((e) => e.id === signed.outputs!.episodeId)!;
    expect(ep.type).toBe("sud_dmc_ods");
    expect((ep as { dmcOdsLevel?: string }).dmcOdsLevel).toBe("outpatient");
    // The suggested goal is NOT on the care plan until a clinician accepts it.
    const sg = AdelanteEHR.getPatient(p.id)!.suggestedGoals!.find((g) => g.id === signed.outputs!.suggestedGoalId)!;
    expect(sg.status).toBe("suggested");
    expect(sg.reason).toBe("asam_signed");
  });

  it("counselor-authored: sign → cosign_pending with NO outputs; LPHA cosign fires them", () => {
    const p = fresh();
    const d = fullDraft(p.id, VARGAS);
    const pending = AdelanteEHR.signAsam(p.id, d.id, VARGAS, att("asam_sign", VARGAS.name));
    expect(pending.status).toBe("cosign_pending");
    expect(pending.outputs).toBeUndefined();
    expect(AdelanteEHR.getPatient(p.id)!.episodes ?? []).toHaveLength(0);
    // A non-LPHA cannot cosign; the author cannot cosign their own.
    expect(() => AdelanteEHR.cosignAsam(p.id, d.id, VARGAS, att("asam_supervisor_sign", VARGAS.name))).toThrow();
    const signed = AdelanteEHR.cosignAsam(p.id, d.id, OKAFOR, att("asam_supervisor_sign", OKAFOR.name));
    expect(signed.status).toBe("signed");
    expect(signed.cosignedBy).toBe(OKAFOR.name);
    expect(signed.outputs?.episodeId).toBeDefined();
    expect(signed.outputs?.claimId).toBeDefined();
  });

  it("a declined cosign returns the assessment to the author as a draft", () => {
    const p = fresh();
    const d = fullDraft(p.id, VARGAS);
    AdelanteEHR.signAsam(p.id, d.id, VARGAS, att("asam_sign", VARGAS.name));
    AdelanteEHR.declineAsamCosign(p.id, d.id, OKAFOR, "Dimension 6 needs more detail.");
    const back = AdelanteEHR.listAsamAssessments(p.id).find((a) => a.id === d.id)!;
    expect(back.status).toBe("declined");
    expect(back.outputs).toBeUndefined();
  });

  it("a signed assessment is locked — it cannot be edited or re-signed", () => {
    const p = fresh();
    const d = fullDraft(p.id, REYES);
    AdelanteEHR.signAsam(p.id, d.id, REYES, att("asam_sign", REYES.name));
    expect(() => AdelanteEHR.signAsam(p.id, d.id, REYES, att("asam_sign", REYES.name))).toThrow(/draft/);
  });
});

describe("Phase 10c — Ask Adel", () => {
  it("the ASAM question is Part 2 gated and reports facts only, never a level", () => {
    const q = ASK_ADEL_QUESTIONS.find((x) => x.id === "clinical-asam")!;
    expect(q.anyOf).toEqual(["screeners_sud"]);
    // Roles without Part 2 access never see the question.
    expect(part2Gated("ecm_provider")).toBe(true);
    expect(part2Gated("peer_specialist")).toBe(true);
    const answer = q.answer({ role: "therapist", staffId: "s-th1", staffName: "Dr. Marisol Reyes", clinicianId: "c1" } as Parameters<typeof q.answer>[0]);
    const text = answer.lines.join(" ");
    expect(text).not.toMatch(/level of care: \w/i);
    expect(answer.notes!.join(" ")).toContain("clinician decides the level of care");
  });
});

describe("Phase 10c — demo seeds", () => {
  it("Luis C. has a signed ASAM with outputs; Jasmine H. awaits LPHA cosign; Daniel is due", () => {
    const luisId = demoScenarioPatientId("sud_consented")!;
    const luis = AdelanteEHR.listAsamAssessments(luisId).find((a) => a.version === 1)!;
    expect(luis.status).toBe("signed");
    expect(luis.outputs?.claimId).toBeDefined();
    expect(luis.outputs?.episodeId).toBeDefined();

    const jasmineId = demoScenarioPatientId("combination")!;
    const jasmine = AdelanteEHR.listAsamAssessments(jasmineId)[0];
    expect(jasmine.status).toBe("cosign_pending");
    expect(jasmine.authoredBy.role).toBe("sud_counselor");
    expect(jasmine.outputs).toBeUndefined();

    expect(AdelanteEHR.openAsamTask("p1")).toBeDefined();
  });

  it("Jordan V. (no consent): masked task exists, patient tools hidden", () => {
    const jordanId = demoScenarioPatientId("sud_no_consent")!;
    const jordan = AdelanteEHR.getPatient(jordanId)!;
    expect(jordan.seeking?.substanceUse).toBe(true);
    expect(jordan.seeking?.part2ConsentAtSelection).toBe(false);
    expect(AdelanteEHR.openAsamTask(jordanId)).toBeDefined();
    expect(recoveryJourneyVisible(jordan)).toBe(false);
  });
});
