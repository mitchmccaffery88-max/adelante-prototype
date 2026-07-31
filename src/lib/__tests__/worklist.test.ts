// §Worklist Phase A — claim mechanics, status migration, discipline scoping,
// and scoped stat-card counts.
import { describe, expect, it } from "vitest";
import {
  AdelanteEHR,
  taskPriority,
  worklistStatusFor,
  type CaseTask,
} from "@/lib/ehr";
import { isOverdue, matchesDiscipline } from "@/routes/worklist";

const pid = () => AdelanteEHR.listPatients()[0].id;
const make = (over: Partial<Parameters<typeof AdelanteEHR.createCaseTask>[0]> = {}) =>
  AdelanteEHR.createCaseTask({
    patientId: pid(),
    assignedTo: "cm1",
    title: "Task",
    dueDate: "2026-07-31",
    ...over,
  })!;

describe("CaseTask extension defaults", () => {
  it("priority defaults to routine when unset", () => {
    expect(taskPriority(make())).toBe("routine");
    expect(taskPriority(make({ priority: "stat" }))).toBe("stat");
  });

  it("derives worklistStatus from legacy completedAt state when unset", () => {
    const legacy = { ...make(), worklistStatus: undefined } as CaseTask;
    expect(worklistStatusFor(legacy)).toBe("pending");
    expect(worklistStatusFor({ ...legacy, claimedBy: "Luz Herrera" })).toBe("in_progress");
    expect(
      worklistStatusFor({ ...legacy, status: "done", completedAt: "2026-07-01T00:00:00.000Z" }),
    ).toBe("completed");
    // completedAt alone (without status flip) still reads as completed.
    expect(worklistStatusFor({ ...legacy, completedAt: "2026-07-01T00:00:00.000Z" })).toBe(
      "completed",
    );
  });

  it("existing consumers are unaffected: completeCaseTask still sets the legacy status", () => {
    const t = make();
    AdelanteEHR.completeCaseTask(t.id);
    const after = AdelanteEHR.listCaseTasks().find((x) => x.id === t.id)!;
    expect(after.status).toBe("done");
    expect(after.completedAt).toBeTruthy();
    expect(worklistStatusFor(after)).toBe("completed");
  });
});

describe("claim mechanics", () => {
  it("claiming is one-shot — a second claim fails cleanly", () => {
    const t = make();
    expect(AdelanteEHR.claimWorklistTask(t.id, "Luz Herrera", "case_manager")).toBe(true);
    expect(AdelanteEHR.claimWorklistTask(t.id, "Dr. R. Bagga", "pmhnp")).toBe(false);
    const after = AdelanteEHR.listCaseTasks().find((x) => x.id === t.id)!;
    expect(after.claimedBy).toBe("Luz Herrera");
    expect(worklistStatusFor(after)).toBe("in_progress");
  });

  it("only the claimer can release; release returns it to the pool", () => {
    const t = make();
    AdelanteEHR.claimWorklistTask(t.id, "Luz Herrera", "case_manager");
    expect(AdelanteEHR.releaseWorklistTask(t.id, "Dr. R. Bagga", "pmhnp")).toBe(false);
    expect(AdelanteEHR.releaseWorklistTask(t.id, "Luz Herrera", "case_manager")).toBe(true);
    const after = AdelanteEHR.listCaseTasks().find((x) => x.id === t.id)!;
    expect(after.claimedBy).toBeUndefined();
    expect(worklistStatusFor(after)).toBe("pending");
    expect(AdelanteEHR.claimWorklistTask(t.id, "Dr. R. Bagga", "pmhnp")).toBe(true);
  });

  it("a completed task cannot be claimed", () => {
    const t = make();
    AdelanteEHR.completeCaseTask(t.id);
    expect(AdelanteEHR.claimWorklistTask(t.id, "Luz Herrera", "case_manager")).toBe(false);
  });

  it("claim and release are audited", () => {
    const t = make();
    AdelanteEHR.claimWorklistTask(t.id, "Luz Herrera", "case_manager");
    AdelanteEHR.releaseWorklistTask(t.id, "Luz Herrera", "case_manager");
    const actions = AdelanteEHR.listAuditEvents()
      .filter((a) => (a.detail as { taskId?: string } | undefined)?.taskId === t.id)
      .map((a) => a.action);
    expect(actions).toContain("worklist_task_claimed");
    expect(actions).toContain("worklist_task_released");
  });
});

describe("discipline scoping", () => {
  it("empty or missing allowedRoles means no restriction", () => {
    expect(matchesDiscipline(make({ allowedRoles: [] }), "billing")).toBe(true);
    expect(matchesDiscipline(make(), "peer_specialist")).toBe(true);
  });

  it("hides tasks whose allowedRoles do not overlap the acting role", () => {
    const t = make({ allowedRoles: ["pmhnp"] });
    expect(matchesDiscipline(t, "pmhnp")).toBe(true);
    expect(matchesDiscipline(t, "case_manager")).toBe(false);
  });
});

describe("scoped stat counts", () => {
  it("counts come from the filtered set, not raw totals", () => {
    const facility = "fac-worklist-test";
    const a = make({ facilityId: facility, priority: "stat", dueDate: "2020-01-01" });
    make({ priority: "stat" }); // different facility — must not be counted
    const scoped = AdelanteEHR.listCaseTasks().filter((t) => t.facilityId === facility);
    expect(scoped.length).toBe(1);
    expect(scoped.filter((t) => taskPriority(t) === "stat").length).toBe(1);
    expect(scoped.filter((t) => isOverdue(t)).length).toBe(1);
    expect(AdelanteEHR.listCaseTasks().filter((t) => taskPriority(t) === "stat").length).toBeGreaterThan(1);
    expect(isOverdue(a)).toBe(true);
  });

  it("overdue excludes completed and cancelled rows", () => {
    const t = make({ dueDate: "2020-01-01" });
    expect(isOverdue(t)).toBe(true);
    AdelanteEHR.setWorklistStatus(t.id, "cancelled", "Luz Herrera", "case_manager");
    expect(isOverdue(AdelanteEHR.listCaseTasks().find((x) => x.id === t.id)!)).toBe(false);
  });
});
