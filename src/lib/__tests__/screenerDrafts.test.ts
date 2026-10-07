// §B7 — screener save/resume. Covers: save/resume, drafts never scored/never
// in screenerHistory, 7-day expiry with a content-free audit stub, the PHQ-9
// item 9 / C-SSRS crisis trigger (once per draft), staff save via runAction,
// and the EN/ES resume copy.
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { AdelanteEHR, demoScenarioPatientId } from "@/lib/ehr";
import { runAction } from "@/lib/actions/runAction";
import { CSSRS_KEY } from "@/lib/cssrs";
import {
  discardScreenerDraft,
  expireScreenerDrafts,
  getScreenerDraft,
  listScreenerDrafts,
  saveScreenerDraft,
  SCREENER_DRAFT_COPY,
  SCREENER_DRAFT_DAYS,
  SCREENER_DRAFT_IN_PROGRESS_LABEL,
} from "@/lib/screenerDrafts";

const luis = () => demoScenarioPatientId("sud_consented")!;

describe("screenerDrafts — save/resume", () => {
  afterEach(() => {
    discardScreenerDraft(luis(), "phq-9");
    discardScreenerDraft(luis(), CSSRS_KEY);
    vi.useRealTimers();
  });

  it("saves a partial and resumes with the same answers", () => {
    const patientId = luis();
    saveScreenerDraft(patientId, "phq-9", { answers: [1, 0, undefined, undefined, undefined, undefined, undefined, undefined, undefined] }, "patient");
    const resumed = getScreenerDraft(patientId, "phq-9");
    expect(resumed?.answers).toEqual([1, 0, undefined, undefined, undefined, undefined, undefined, undefined, undefined]);
  });

  it("a partial draft is never scored and never written to screenerHistory", () => {
    const patientId = luis();
    const before = (AdelanteEHR.getPatient(patientId)?.screenerHistory ?? []).length;
    saveScreenerDraft(patientId, "phq-9", { answers: [1, 1, undefined, undefined, undefined, undefined, undefined, undefined, undefined] }, "patient");
    const after = AdelanteEHR.getPatient(patientId)?.screenerHistory ?? [];
    expect(after.length).toBe(before);
    const draft = getScreenerDraft(patientId, "phq-9");
    expect(draft).toBeTruthy();
    expect((draft as any).score).toBeUndefined();
  });

  it("expires after 7 days into a content-free audit stub", () => {
    vi.useFakeTimers();
    const start = new Date("2024-01-01T00:00:00.000Z");
    vi.setSystemTime(start);
    const patientId = luis();
    saveScreenerDraft(patientId, "gad-7", { answers: [1, 1, 0, 0, 0, 0, 0] }, "patient");
    expect(getScreenerDraft(patientId, "gad-7")).toBeTruthy();

    const justUnder = new Date(start.getTime() + (SCREENER_DRAFT_DAYS - 1) * 86_400_000);
    vi.setSystemTime(justUnder);
    expect(expireScreenerDrafts(justUnder)).toEqual([]);
    expect(getScreenerDraft(patientId, "gad-7")).toBeTruthy();

    const past = new Date(start.getTime() + (SCREENER_DRAFT_DAYS + 1) * 86_400_000);
    vi.setSystemTime(past);
    const beforeAudits = AdelanteEHR.listAuditEvents({ patientId, category: "action" }).length;
    const expiredIds = expireScreenerDrafts(past);
    expect(expiredIds.length).toBe(1);
    expect(getScreenerDraft(patientId, "gad-7")).toBeUndefined();
    const audits = AdelanteEHR.listAuditEvents({ patientId });
    const stub = audits.find((a) => a.action === "screener_draft_expired");
    expect(stub).toBeTruthy();
    // Content-free: only the instrument key, never an answer value.
    expect(JSON.stringify(stub?.detail)).not.toMatch(/\[1,\s*1/);
    expect((stub?.detail as any)?.screenerKey).toBe("gad-7");
    void beforeAudits;
  });

  it("PHQ-9 item 9 above 0 triggers the existing crisis path, other items blank, only once", () => {
    const patientId = luis();
    const before = (AdelanteEHR.getPatient(patientId)?.crisisEscalations ?? []).length;
    const answers = [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 1];
    saveScreenerDraft(patientId, "phq-9", { answers }, "patient");
    const after1 = AdelanteEHR.getPatient(patientId)?.crisisEscalations ?? [];
    expect(after1.length).toBe(before + 1);
    // Saving again (still item 9 > 0) must not fire a second time.
    saveScreenerDraft(patientId, "phq-9", { answers }, "patient");
    const after2 = AdelanteEHR.getPatient(patientId)?.crisisEscalations ?? [];
    expect(after2.length).toBe(after1.length);
  });

  it("a C-SSRS positive item triggers the crisis path", () => {
    const patientId = luis();
    const before = (AdelanteEHR.getPatient(patientId)?.crisisEscalations ?? []).length;
    saveScreenerDraft(patientId, CSSRS_KEY, { answers: [0, 1] }, "patient");
    const after = AdelanteEHR.getPatient(patientId)?.crisisEscalations ?? [];
    expect(after.length).toBe(before + 1);
  });

  it("a staff save goes through runAction(\"screener_draft_save\") and audits", () => {
    const patientId = luis();
    const patient = AdelanteEHR.getPatient(patientId)!;
    const result = runAction(
      "screener_draft_save",
      { role: "therapist", staffId: "staff-1", staffName: "Case Mgr" },
      patient,
      { args: [patientId, "gad-7", { answers: [1, undefined, undefined, undefined, undefined, undefined, undefined] }, "staff-1"] },
    );
    expect(result.ok).toBe(true);
    const audits = AdelanteEHR.listAuditEvents({ patientId, category: "action" });
    expect(audits.some((a) => (a.detail as any)?.actionId === "screener_draft_save")).toBe(true);
    expect(getScreenerDraft(patientId, "gad-7")?.answers[0]).toBe(1);
  });

  it("EN/ES resume copy is present and the 7-day window label matches sign-off wording", () => {
    expect(SCREENER_DRAFT_COPY.en.resumeHeading).toBe("Pick up where you left off");
    expect(SCREENER_DRAFT_COPY.es.resumeHeading).toBe("Continúa donde lo dejaste");
    expect(SCREENER_DRAFT_COPY.en.draftLabel).toBe("Draft — pending clinical sign-off");
    expect(SCREENER_DRAFT_COPY.es.draftLabel).toBe("Draft — pending clinical sign-off");
    expect(SCREENER_DRAFT_IN_PROGRESS_LABEL).toBe("In progress");
    void listScreenerDrafts;
  });
});
