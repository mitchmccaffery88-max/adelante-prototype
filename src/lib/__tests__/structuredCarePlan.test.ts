import { describe, it, expect } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import {
  getStructuredPlan,
  addStructuredGoal,
  assignToGoal,
  completeAssignment,
  assignmentWeek,
  goalProgress,
  signPlan,
  acknowledgePlan,
  planReviewDue,
  planSuggestions,
  acceptSuggestion,
  dismissSuggestion,
  staffPlanView,
  needStep,
} from "@/lib/structuredCarePlan";

const T = { name: "Marisol Reyes, LCSW", role: "therapist" };
const find = (n: string) => AdelanteEHR.listPatients().find((p) => p.firstName === n)!;

describe("structured care plan", () => {
  it("migrates old plain-text goals without loss", () => {
    const p = AdelanteEHR.listPatients().find((x) => (x.goals ?? []).length > 0)!;
    const plan = getStructuredPlan(p.id);
    for (const g of p.goals!) expect(plan.goals.some((x) => x.legacyGoalId === g.id && x.clinicalText === g.text)).toBe(true);
  });
  it("assignment completion drives goal progress; one tick per day", () => {
    const p = find("Daniel");
    const g = addStructuredGoal({ patientId: p.id, owner: "patient", measure: "x", clinicalText: "Test goal", actor: T });
    const a = assignToGoal({ patientId: p.id, goalId: g.id, kind: "activity", activityId: "box-breathing", frequency: "weekly", actor: T });
    expect(goalProgress(p.id, g.id)).toBe(0);
    completeAssignment(p.id, a.id, { name: "Daniel", role: "patient" });
    completeAssignment(p.id, a.id, { name: "Daniel", role: "patient" });
    expect(assignmentWeek(a).done).toBe(1);
    expect(goalProgress(p.id, g.id)).toBe(100);
  });
  it("non-clinical roles can't edit; signing sets review and version; patient acknowledges", () => {
    const p = find("Marcus");
    expect(() => addStructuredGoal({ patientId: p.id, owner: "patient", measure: "", clinicalText: "No", actor: { name: "Luz", role: "ecm_provider" } })).toThrow();
    addStructuredGoal({ patientId: p.id, owner: "patient", measure: "", clinicalText: "Goal A", actor: T });
    signPlan(p.id, T, { reviewDueAt: new Date().toISOString() });
    expect(getStructuredPlan(p.id).review.version).toBe(1);
    expect(planReviewDue(p.id)).toBe(true);
    acknowledgePlan(p.id, { name: "Marcus", role: "patient" });
    expect(getStructuredPlan(p.id).review.acknowledgedVersion).toBe(1);
  });
  it("suggestions are accepted or dismissed (with a reason) and then disappear", () => {
    const p = find("Jordan");
    const g = addStructuredGoal({ patientId: p.id, owner: "patient", measure: "", clinicalText: "Mood", actor: T });
    AdelanteEHR.addSdohItem(p.id, { need: "Housing" }, { staffName: T.name, role: "therapist" });
    const s = planSuggestions(p.id).find((x) => x.id.startsWith("housing-"))!;
    expect(() => dismissSuggestion(p.id, s.id, "", T)).toThrow();
    acceptSuggestion(p.id, s.id, g.id, T);
    expect(planSuggestions(p.id).some((x) => x.id === s.id)).toBe(false);
  });
  it("SUD-linked goals are hidden from roles failing the Part 2 check", () => {
    const p = find("Luis");
    const sudProb = (p.problems ?? []).find((x) => x.category === "sud" && x.status === "active");
    if (!sudProb) return;
    addStructuredGoal({ patientId: p.id, problemIds: [`pl-${sudProb.id}`], owner: "clinician", measure: "", clinicalText: "Part 2 goal", actor: T });
    const luz = staffPlanView(p.id, "ecm_provider");
    expect(luz.goals.some((g) => g.clinicalText === "Part 2 goal")).toBe(false);
    expect(luz.problems.some((x) => x.sud)).toBe(false);
    expect(staffPlanView(p.id, "therapist").goals.some((g) => g.clinicalText === "Part 2 goal")).toBe(true);
  });
  it("need ladder maps statuses", () => {
    expect(needStep("identified")).toBe("Screened");
    expect(needStep("sent")).toBe("Referred");
    expect(needStep("scheduled")).toBe("Scheduled");
    expect(needStep("completed")).toBe("Completed");
  });
});
