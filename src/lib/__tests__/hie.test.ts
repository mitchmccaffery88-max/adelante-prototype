import { describe, it, expect, beforeEach } from "vitest";
import { AdelanteEHR } from "../ehr";
import { _resetHieForTests, runSimulatedHieSync, hieChartView, hieFollowUps, acceptHieDraft, dismissHieDraft, listHieMeds, decideHieMed, hieUtilization } from "../hie";

const pid = (n: string) => AdelanteEHR.listPatients().find((p) => p.firstName === n)!.id;

describe("simulated HIE", () => {
  beforeEach(() => { _resetHieForTests(); runSimulatedHieSync(); });

  it("sync is idempotent", () => {
    expect(runSimulatedHieSync().added).toBe(0);
  });

  it("Daniel's ED visit shows with a follow-up draft; accept creates a task", () => {
    const d = pid("Daniel");
    const v = hieChartView(d, "therapist");
    expect(v.encounters.some((e) => e.kind === "ed_visit")).toBe(true);
    const [row] = hieFollowUps([d], "therapist");
    const task = acceptHieDraft(row!.draft.id, { name: "Marisol Reyes", role: "therapist" });
    expect(task?.title).toMatch(/48 hours/);
    expect(hieFollowUps([d], "therapist")).toHaveLength(0);
    expect(() => acceptHieDraft(row!.draft.id, { name: "x", role: "therapist" })).toThrow();
  });

  it("dismiss needs a reason", () => {
    const m = pid("Marcus");
    const [row] = hieFollowUps([m], "therapist");
    expect(() => dismissHieDraft(row!.draft.id, " ", { name: "x", role: "therapist" })).toThrow();
  });

  it("outside SUD record never shows to a restricted role", () => {
    const v = hieChartView(pid("Marcus"), "case_manager" as never);
    expect(v.encounters.some((e) => e.sud)).toBe(false);
    expect(v.heldCount).toBe(0);
  });

  it("outside med needs a human decision", () => {
    const [med] = listHieMeds(pid("Daniel"));
    expect(med!.status).toBe("review");
    decideHieMed(med!.id, "ignored", { name: "Dr. M. Bagga", role: "physician" });
    expect(listHieMeds(pid("Daniel"))[0]!.status).toBe("ignored");
  });

  it("utilization counts ED visits and admissions with cohort flag", () => {
    const u = hieUtilization();
    expect(u.edVisits).toBe(1);
    expect(u.admissions).toBe(1);
    expect(u.belowMinimumCohort).toBe(true);
  });
});
