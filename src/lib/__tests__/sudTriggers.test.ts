// SUD triggers (Draft — pending clinical sign-off): care-plan goal sets the
// flag; AUDIT/DAST screeners only create a staff task.
import { describe, it, expect } from "vitest";
import { AdelanteEHR, type ScreenerResult } from "@/lib/ehr";
import { addStructuredGoal, buildPlanProblems } from "@/lib/structuredCarePlan";
import { sudSignalReason } from "@/lib/sudSignal";
import { autoAddedJourneyIds, detectFlags } from "@/lib/flagJourneys";

const PMHNP = { name: "Test PMHNP", role: "pmhnp" as const };
const at = (min: number) => new Date(Date.now() - min * 60000).toISOString();
const reviewTasks = (id: string) =>
  AdelanteEHR.caseTasksForPatient(id).filter((t) => t.origin === "recovery_journey_review");

describe("care-plan SUD trigger", () => {
  it("a substance-use goal keeps the SUD flag and the Recovery Journey stays", () => {
    const p = AdelanteEHR.createPatient({ firstName: "Trig", lastName: "Goal" });
    const prob = AdelanteEHR.addProblem(p.id, { description: "Alcohol use disorder", icd10Code: "F10.20", category: "sud", enteredBy: "test" });
    const planProblem = buildPlanProblems(AdelanteEHR.getPatient(p.id)!).find((x) => x.sud)!;
    addStructuredGoal({ patientId: p.id, problemIds: [planProblem.id], owner: "patient" as never, measure: "Fewer drinking days", clinicalText: "Cut down alcohol use", actor: PMHNP });
    expect(autoAddedJourneyIds(p.id)).toContain("reentry-curriculum");
    // Resolve the diagnosis: the goal alone still carries the signal.
    const problemId = (prob as { id?: string } | undefined)?.id ?? AdelanteEHR.getPatient(p.id)!.problems!.at(-1)!.id;
    AdelanteEHR.resolveProblem(p.id, problemId, "test");
    expect(sudSignalReason(AdelanteEHR.getPatient(p.id)!)).toBe("substance-use goal on the care plan");
    expect(detectFlags(AdelanteEHR.getPatient(p.id)!).sud).toBeTruthy();
    expect(autoAddedJourneyIds(p.id)).toContain("reentry-curriculum");
  });
});

describe("screener task", () => {
  it("AUDIT >= 8 creates one task per result, neutral text, no SUD flag", () => {
    const p = AdelanteEHR.createPatient({ firstName: "Trig", lastName: "Audit" });
    const res = { key: "audit", score: 9, severity: "moderate", completedAt: at(5) } as ScreenerResult;
    AdelanteEHR.recordScreener(p.id, res);
    AdelanteEHR.recordScreener(p.id, { ...res });
    const tasks = reviewTasks(p.id);
    expect(tasks).toHaveLength(1);
    const text = `${tasks[0]!.title} ${tasks[0]!.detail ?? ""}`;
    expect(tasks[0]!.title).toBe("Consider the Recovery Journey");
    expect(text).not.toMatch(/audit|dast|9\b|score/i);
    expect(detectFlags(AdelanteEHR.getPatient(p.id)!).sud).toBeUndefined();
    // A second, different result is its own task.
    AdelanteEHR.recordScreener(p.id, { key: "dast-10", score: 3, severity: "moderate", completedAt: at(1) } as ScreenerResult);
    expect(reviewTasks(p.id)).toHaveLength(2);
  });
  it("below the cutoffs creates none", () => {
    const p = AdelanteEHR.createPatient({ firstName: "Trig", lastName: "Low" });
    AdelanteEHR.recordScreener(p.id, { key: "audit", score: 7, severity: "low", completedAt: at(4) } as ScreenerResult);
    AdelanteEHR.recordScreener(p.id, { key: "dast-10", score: 2, severity: "low", completedAt: at(3) } as ScreenerResult);
    expect(reviewTasks(p.id)).toHaveLength(0);
  });
  it("assignee notification text stays neutral", () => {
    const p = AdelanteEHR.createPatient({ firstName: "Trig", lastName: "Notify" });
    AdelanteEHR.recordScreener(p.id, { key: "audit", score: 12, severity: "high", completedAt: at(2) } as ScreenerResult);
    const t = reviewTasks(p.id)[0]!;
    const notes = AdelanteEHR.listNotifications?.().filter((n: { taskKey?: string }) => n.taskKey === `task:${t.id}`) ?? [];
    for (const n of notes as { subject: string; body: string }[]) expect(`${n.subject} ${n.body}`).not.toMatch(/recovery|audit|dast|score/i);
  });
});
