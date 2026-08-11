import { beforeEach, describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { canAccess } from "@/lib/roles";
import {
  CRISIS_LIFELINE_NUMBER,
  SAFETY_PLAN_REVIEW,
  SAFETY_PLAN_SECTIONS,
  __resetSafetyPlans,
} from "@/lib/safetyPlan";

function newPatient() {
  return AdelanteEHR.createPatient({
    firstName: "Safety",
    lastName: "Plan",
    programId: "TEST",
  } as never).id;
}

describe("safety plan — Stanley-Brown structure", () => {
  beforeEach(() => __resetSafetyPlans());

  it("has the seven published sections in order", () => {
    expect(SAFETY_PLAN_SECTIONS.map((s) => s.id)).toEqual([
      "warning_signs",
      "internal_coping",
      "distractions",
      "support_people",
      "professionals",
      "environment_safety",
      "reasons_for_living",
    ]);
    expect(SAFETY_PLAN_SECTIONS.map((s) => s.step)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("pre-populates the real 988 lifeline and refuses to let it be removed", () => {
    const pid = newPatient();
    const plan = AdelanteEHR.ensureSafetyPlan(pid)!;
    const lifeline = plan.entries.find((e) => e.sectionId === "professionals")!;
    expect(lifeline.phone).toBe(CRISIS_LIFELINE_NUMBER);
    expect(CRISIS_LIFELINE_NUMBER).toBe("988");
    expect(lifeline.locked).toBe(true);
    expect(() => AdelanteEHR.removeSafetyPlanEntry(pid, lifeline.id)).toThrow(/cannot be removed/i);
    expect(() =>
      AdelanteEHR.updateSafetyPlanEntry(pid, lifeline.id, { text: "nope" }),
    ).toThrow(/cannot be edited/i);
  });

  it("creates, edits and removes patient-authored entries per section", () => {
    const pid = newPatient();
    const e = AdelanteEHR.addSafetyPlanEntry(pid, {
      sectionId: "warning_signs",
      text: "  Not sleeping for two nights  ",
    });
    expect(e.text).toBe("Not sleeping for two nights");
    expect(e.source).toBe("patient");
    const updated = AdelanteEHR.updateSafetyPlanEntry(pid, e.id, { text: "Can't sleep" })!;
    expect(updated.text).toBe("Can't sleep");
    expect(updated.updatedAt).toBeTruthy();
    expect(AdelanteEHR.removeSafetyPlanEntry(pid, e.id)).toBe(true);
    expect(AdelanteEHR.safetyPlanEntries(pid, "warning_signs")).toHaveLength(0);
    expect(() => AdelanteEHR.addSafetyPlanEntry(pid, { sectionId: "warning_signs", text: " " })).toThrow(
      /required/i,
    );
  });

  it("summary counts patient-filled sections only and exposes the review flag", () => {
    const pid = newPatient();
    AdelanteEHR.ensureSafetyPlan(pid);
    let s = AdelanteEHR.safetyPlanSummary(pid);
    expect(s.exists).toBe(true);
    expect(s.sectionsFilled).toBe(0); // the 988 row is prepopulated, not authored
    expect(s.totalSections).toBe(7);
    AdelanteEHR.addSafetyPlanEntry(pid, { sectionId: "reasons_for_living", text: "My daughter" });
    s = AdelanteEHR.safetyPlanSummary(pid);
    expect(s.sectionsFilled).toBe(1);
    expect(s.clinicalReviewPending).toBe(true);
  });

  it("audits into the single clinical audit stream without leaking patient text", () => {
    const pid = newPatient();
    AdelanteEHR.addSafetyPlanEntry(pid, {
      sectionId: "support_people",
      text: "My sponsor Maria",
      phone: "559-555-0101",
    });
    AdelanteEHR.markSafetyPlanReviewed(pid, "Dr. B", "pmhnp");
    const events = AdelanteEHR.listAuditEvents({ patientId: pid } as never).filter((e: { action: string }) =>
      e.action.startsWith("safety_plan"),
    );
    const actions = events.map((e: { action: string }) => e.action);
    expect(actions).toContain("safety_plan_created");
    expect(actions).toContain("safety_plan_entry_added");
    expect(actions).toContain("safety_plan_reviewed");
    expect(JSON.stringify(events)).not.toMatch(/Maria|555-0101/);
  });

  it("keeps the plan OFF the clinical Patient record", () => {
    const pid = newPatient();
    AdelanteEHR.addSafetyPlanEntry(pid, { sectionId: "internal_coping", text: "Walk the block" });
    const patient = AdelanteEHR.getPatient(pid) as unknown as Record<string, unknown>;
    expect(JSON.stringify(patient)).not.toMatch(/Walk the block/);
    expect(patient["safetyPlan"]).toBeUndefined();
  });

  it("clinical-adjacent RBAC: crisis responders read, billing is excluded", () => {
    for (const role of ["pmhnp", "therapist", "ecm_provider", "clinical_coordinator"] as const) {
      expect(canAccess(role, "safety_plan").level).toBe("write");
    }
    expect(canAccess("peer_specialist", "safety_plan").level).toBe("read");
    for (const role of ["billing", "billing_coordinator"] as const) {
      expect(canAccess(role, "safety_plan").locked).toBe(true);
    }
  });

  it("keeps the clinical-review-pending flag real until sign-off", () => {
    expect(SAFETY_PLAN_REVIEW.pending).toBe(true);
    expect(SAFETY_PLAN_SECTIONS.every((s) => s.clinicalReviewPending)).toBe(true);
  });
});