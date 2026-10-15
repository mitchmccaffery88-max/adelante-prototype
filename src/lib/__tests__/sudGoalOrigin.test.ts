// SUD care-plan trigger by goal origin. Draft — pending clinical sign-off.
import { describe, expect, it } from "vitest";
import { AdelanteEHR, demoScenarioPatientId, type Patient } from "@/lib/ehr";
import { ASAM_DIMENSIONS } from "@/lib/asam";
import { signAsamAssessment } from "@/lib/asamFlow";
import { runAction } from "@/lib/actions/runAction";
import { latestFinalAsam, listAsamSuggestions } from "@/lib/asamCarePlan";
import { getStructuredPlan } from "@/lib/structuredCarePlan";
import { applyFlagJourneys } from "@/lib/flagJourneys";
import { sudSignalReason } from "@/lib/sudSignal";
import type { StaffRole } from "@/lib/roles";

const GOAL = "substance-use goal on the care plan";
const BAGGA = { staffId: "s-np1", name: "Dr. M. Bagga", role: "physician" as StaffRole, clinicianId: "c5" };
const ATT = { attested: true, signatureDataUrl: "data:image/png;base64,c2VlZA==" };
// Only the care-plan source: strip the patient's other SUD signals from the view.
const goalOnly = (p: Patient) => sudSignalReason({ ...p, problems: [], episodes: [], needs: { ...p.needs, substanceUse: false } } as Patient);

function legacyGoal(last: string, reason?: "asam_signed") {
  const p = AdelanteEHR.createPatient({ firstName: "Origin", lastName: last });
  AdelanteEHR.addGoal(p.id, "Legacy goal text", "Dr. Test");
  const g = AdelanteEHR.getPatient(p.id)!.goals!.at(-1)!;
  if (reason) (AdelanteEHR.getPatient(p.id)!.suggestedGoals ??= []).push({ id: `sg-${last}`, text: g.text, reason, status: "accepted", createdAt: g.createdAt, goalId: g.id });
  return AdelanteEHR.getPatient(p.id)!;
}

describe("SUD signal by goal origin (Draft — pending clinical sign-off)", () => {
  it("an accepted ASAM suggestion sets the SUD signal", () => {
    const p = AdelanteEHR.getPatient(demoScenarioPatientId("sud_consented")!)!;
    const v = AdelanteEHR.amendAsam(p.id, latestFinalAsam(p)!.id, BAGGA, "Follow-up");
    AdelanteEHR.saveAsamDraft(p.id, { dimensions: ASAM_DIMENSIONS.map((d) => ({ key: d.key, documentation: "Documented.", rating: (d.key === "d3" ? 3 : 1) as 0 | 1 | 2 | 3 | 4 })), recommendedLevel: "intensive_outpatient", actualLevel: "intensive_outpatient" }, BAGGA);
    signAsamAssessment(p.id, v.id, BAGGA, ATT);
    const s = listAsamSuggestions(p.id, "physician").find((x) => x.dimensionKey === "d3")!;
    const r = runAction("asam_plan_suggestion", { role: "physician", staffId: BAGGA.staffId, staffName: BAGGA.staffId }, p, { via: "acceptAsamSuggestion", args: [p.id, s.id, { name: BAGGA.name, role: BAGGA.role, staffId: BAGGA.staffId }] });
    expect(r.ok).toBe(true);
    const g = getStructuredPlan(p.id).goals.find((x) => x.source?.suggestionId === s.id)!;
    expect(g.origin).toBe("clinician");
    expect(goalOnly(AdelanteEHR.getPatient(p.id)!)).toBe(GOAL);
  });

  it("an accepted asam_signed legacy goal sets it", () => {
    const p = legacyGoal("Asam", "asam_signed");
    expect(getStructuredPlan(p.id).goals.find((g) => g.legacyGoalId)?.origin).toBe("clinician");
    expect(sudSignalReason(p)).toBe(GOAL);
  });

  it("a free-text legacy goal does not", () => {
    const p = legacyGoal("Free");
    expect(getStructuredPlan(p.id).goals.find((g) => g.legacyGoalId)?.origin).toBeUndefined();
    expect(sudSignalReason(p)).toBeUndefined();
  });

  it("the auto-added journey goal still does not", () => {
    const p = AdelanteEHR.createPatient({ firstName: "Origin", lastName: "Auto" });
    AdelanteEHR.addProblem(p.id, { description: "Alcohol use disorder", icd10Code: "F10.20", category: "sud", enteredBy: "test" });
    applyFlagJourneys(p.id);
    const goals = getStructuredPlan(p.id).goals.filter((g) => g.sud && g.status === "active");
    expect(goals.length).toBeGreaterThan(0);
    expect(goals.every((g) => g.origin === "system")).toBe(true);
    expect(goalOnly(AdelanteEHR.getPatient(p.id)!)).toBeUndefined();
  });
});
