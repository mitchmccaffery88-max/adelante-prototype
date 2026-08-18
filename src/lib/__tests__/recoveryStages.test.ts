import { describe, it, expect } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import {
  RECOVERY_STAGES,
  RECOVERY_STAGE_REVIEW,
  recoveryMilestones,
  isRecoveryStageId,
} from "@/lib/recoveryStages";

describe("5-stage recovery model", () => {
  it("has the five real stages in order, each with real signals", () => {
    expect(RECOVERY_STAGES.map((s) => s.label)).toEqual([
      "Stabilizing",
      "Building Strength",
      "Reconnecting",
      "Growing",
      "Thriving",
    ]);
    for (const s of RECOVERY_STAGES) expect(s.signals.length).toBeGreaterThanOrEqual(3);
    expect(RECOVERY_STAGES[0]!.signals).toContain("A safe place to sleep");
    expect(RECOVERY_STAGES[4]!.signals).toContain("Life feels like yours");
  });

  it("is flagged pending clinical review, like the other held content", () => {
    expect(RECOVERY_STAGE_REVIEW.pending).toBe(true);
    expect(RECOVERY_STAGE_REVIEW.reviewers).toMatch(/Christi/);
  });

  it("rejects unknown stage ids", () => {
    expect(isRecoveryStageId("thriving")).toBe(true);
    expect(isRecoveryStageId("transcendence")).toBe(false);
  });
});

describe("stage setting is person-set and audited", () => {
  it("records patient and staff entries as append-only history", () => {
    const pid = "p1";
    const before = AdelanteEHR.recoveryStageHistory(pid).length;
    AdelanteEHR.setRecoveryStage({
      patientId: pid,
      stage: "stabilizing",
      setBy: { actor: "patient", name: "Daniel M. (patient)" },
    });
    const second = AdelanteEHR.setRecoveryStage({
      patientId: pid,
      stage: "building_strength",
      setBy: { actor: "staff", name: "Luz Herrera", role: "ecm_provider" },
      note: "Two weeks of kept appointments.",
    });
    expect(AdelanteEHR.recoveryStageHistory(pid).length).toBe(before + 2);
    expect(AdelanteEHR.getRecoveryStage(pid)?.stage).toBe("building_strength");
    expect(second.previousStage).toBe("stabilizing");
    expect(second.reviewPending).toBe(true);

    const audit = AdelanteEHR.listAuditEvents?.() ?? [];
    const hit = audit.find(
      (e: { action: string; patientId?: string }) =>
        e.action === "recovery_stage_set" && e.patientId === pid,
    );
    expect(hit).toBeTruthy();
  });

  it("is reversible — going back a stage is just another entry", () => {
    const pid = "p4";
    AdelanteEHR.setRecoveryStage({
      patientId: pid,
      stage: "growing",
      setBy: { actor: "patient", name: "Alicia S. (patient)" },
    });
    AdelanteEHR.setRecoveryStage({
      patientId: pid,
      stage: "reconnecting",
      setBy: { actor: "patient", name: "Alicia S. (patient)" },
    });
    expect(AdelanteEHR.getRecoveryStage(pid)?.stage).toBe("reconnecting");
  });

  it("refuses an unknown stage", () => {
    expect(() =>
      AdelanteEHR.setRecoveryStage({
        patientId: "p1",
        // @ts-expect-error deliberately invalid
        stage: "ascension",
        setBy: { actor: "patient", name: "x" },
      }),
    ).toThrow();
  });
});

describe("milestones come from real engagement data only", () => {
  it("is empty when nothing has been done", () => {
    expect(
      recoveryMilestones({
        streakDays: 0,
        checkInDaysLast14: 0,
        lessonsDone: 0,
        exercisesDone: 0,
        toolkitSaved: 0,
      }),
    ).toEqual([]);
  });

  it("celebrates a real streak with the real day count", () => {
    const m = recoveryMilestones({
      streakDays: 7,
      checkInDaysLast14: 9,
      lessonsDone: 2,
      exercisesDone: 0,
      toolkitSaved: 1,
    });
    expect(m[0]!.title).toBe("You've checked in 7 days in a row");
    expect(m.map((x) => x.id)).toContain("lessons");
    expect(m.map((x) => x.id)).toContain("toolkit");
    // no points, badges or ranking anywhere in the copy
    const text = JSON.stringify(m).toLowerCase();
    for (const banned of ["point", "badge", "rank", "leaderboard", "level up"]) {
      expect(text).not.toContain(banned);
    }
  });

  it("does not claim a streak the person does not have", () => {
    const m = recoveryMilestones({
      streakDays: 1,
      checkInDaysLast14: 9,
      lessonsDone: 0,
      exercisesDone: 0,
      toolkitSaved: 0,
    });
    expect(m.map((x) => x.id)).toEqual(["steady_fortnight"]);
  });
});
