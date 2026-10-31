import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";

function completedPatient() {
  const p = AdelanteEHR.listPatients().find((x) => x.intakeCompletedAt)!;
  return p;
}

describe("Phase 9b targeted re-screen", () => {
  it("a clinician re-screen task shows as due and completing it closes the task", () => {
    const p = completedPatient();
    AdelanteEHR.sendRescreenTask(p.id, "gad-7");
    const due = AdelanteEHR.patientReassessmentDue(p.id).find((d) => d.key === "gad-7");
    expect(due?.taskIds.length).toBeGreaterThan(0);
    const before = (AdelanteEHR.getPatient(p.id)?.screenerHistory ?? []).length;
    AdelanteEHR.completeRescreen(p.id, "gad-7", [0, 1, 0, 1, 0, 0, 0], { actorId: p.id, actorRole: "patient" });
    expect(AdelanteEHR.getPatient(p.id)?.screenerHistory?.length).toBe(before + 1);
    expect(AdelanteEHR.patientReassessmentDue(p.id).some((d) => d.key === "gad-7")).toBe(false);
    expect(AdelanteEHR.getPatient(p.id)?.tasks?.filter((t) => t.screenerKey === "gad-7" && !t.completedAt)).toHaveLength(0);
  });
  it("refuses incomplete answers", () => {
    const p = completedPatient();
    // Draft — pending clinical sign-off: optional blanks remain incomplete, never zero.
    const historyBefore = (AdelanteEHR.getPatient(p.id)?.screenerHistory ?? []).length;
    const result = AdelanteEHR.completeRescreen(p.id, "phq-9", [0, 1], { actorId: p.id, actorRole: "patient" });
    expect(result).toMatchObject({ status: "incomplete", responses: [0, 1, null, null, null, null, null, null, null], skippedItems: [2, 3, 4, 5, 6, 7, 8] });
    expect(result.score).toBeUndefined();
    expect(AdelanteEHR.listIncompleteScreeners(p.id)).toContainEqual(result);
    expect(AdelanteEHR.getPatient(p.id)?.screenerHistory?.length ?? 0).toBe(historyBefore);
    expect(AdelanteEHR.caseTasksForPatient(p.id).some((task) => task.title === "Screening follow-up needed" && !task.completedAt)).toBe(true);
  });
  it("SUD instruments are hidden without sud_treatment consent", () => {
    const p = AdelanteEHR.listPatients().find(
      (x) => x.intakeCompletedAt && !AdelanteEHR.isConsentCategoryAuthorized(x.id, "sud_treatment"),
    );
    if (!p) return;
    AdelanteEHR.sendRescreenTask(p.id, "audit");
    expect(AdelanteEHR.patientReassessmentDue(p.id).some((d) => d.key === "audit")).toBe(false);
    expect(() => AdelanteEHR.completeRescreen(p.id, "audit", Array(10).fill(0), { actorId: p.id, actorRole: "patient" })).toThrow();
  });
});
