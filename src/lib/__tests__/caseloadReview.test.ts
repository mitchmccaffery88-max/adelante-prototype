import { describe, it, expect, beforeEach } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import {
  __resetCaseloadReview, caseloadFor, caseloadRollup, canSeeContactNote, checkInSummary,
  ensureCaseloadOwners, isWeekReviewed, logContact, markWeekReviewed, patientStatus, caseManagerIdFor,
} from "@/lib/caseloadReview";
import { canSeeNavEntry, STAFF_NAV } from "@/lib/navSections";
import { listUnassignedPatients } from "@/lib/coordination";

const luz = { id: "s-cm1", name: "Luz Herrera", role: "ecm_provider" as const };
const day = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

describe("item 7 caseload review", () => {
  let pid: string;
  beforeEach(() => {
    __resetCaseloadReview();
    ensureCaseloadOwners();
    pid = AdelanteEHR.listPatients().find((p) => !p.caseManagerId || p.caseManagerId === "cm3")!.id;
    AdelanteEHR.assignCaseManager({ patientId: pid, caseManagerId: caseManagerIdFor("s-cm1")!, actorId: "t" });
  });

  it("attempts are not contacts; status moves overdue → on track", () => {
    const p = caseloadFor("s-cm1").find((x) => x.id === pid)!;
    expect(patientStatus(p, luz.id).status).toBe("overdue");
    logContact(luz, { patientId: pid, type: "attempt", date: day(0) });
    expect(patientStatus(p, luz.id).status).toBe("overdue");
    logContact(luz, { patientId: pid, type: "call", date: day(0), note: "ok" });
    expect(patientStatus(p, luz.id).status).toBe("on_track");
    expect(AdelanteEHR.listAuditEvents({}).some((e) => e.action === "caseload_attempt_logged" && e.patientId === pid)).toBe(true);
  });

  it("rejects non case-manager roles and future dates", () => {
    expect(() => logContact({ id: "s-th1", name: "x", role: "therapist" }, { patientId: pid, type: "call", date: day(0) })).toThrow();
    expect(() => logContact(luz, { patientId: pid, type: "call", date: day(-3) })).toThrow();
  });

  it("coordinator never sees notes; roll-up has counts only", () => {
    const c = logContact(luz, { patientId: pid, type: "call", date: day(0), note: "secret" });
    expect(canSeeContactNote(c, { id: "s-cc1", role: "clinical_coordinator" })).toBe(false);
    expect(canSeeContactNote(c, { id: "x", role: "billing_coordinator" })).toBe(false);
    const row = caseloadRollup().find((r) => r.staffId === "s-cm1")!;
    expect(JSON.stringify(row)).not.toContain("secret");
    expect(row.reviewed).toBe(false);
    markWeekReviewed(luz);
    expect(isWeekReviewed("s-cm1")).toBe(true);
  });

  it("check-in summary has no scores and no SUD data", async () => {
    AdelanteEHR.recordQuickCheck(pid, { "phq-2": [0, 0] });
    await new Promise((r) => setTimeout(r, 5));
    AdelanteEHR.recordQuickCheck(pid, { "phq-2": [3, 3] });
    const p = AdelanteEHR.getPatient(pid)!;
    const s = checkInSummary(p, "cf_care_manager");
    expect(Object.keys(s).sort()).toEqual(["daysThisWeek", "followUpSuggested", "moodDaysThisWeek", "trend"]);
    expect(s.trend).toBe("worse");
    expect(s.daysThisWeek).toBeGreaterThanOrEqual(1);
    expect(s.followUpSuggested).toBe(true);
  });

  it("nav gate: case managers + coordinator only", () => {
    const e = STAFF_NAV.find((x) => x.id === "caseload-review")!;
    expect(canSeeNavEntry("ecm_provider", e)).toBe(true);
    expect(canSeeNavEntry("cf_care_manager", e)).toBe(true);
    expect(canSeeNavEntry("clinical_coordinator", e)).toBe(true);
    expect(canSeeNavEntry("therapist", e)).toBe(false);
  });

  it("unassigned list carries a cause", () => {
    for (const u of listUnassignedPatients()) expect(["lost", "never"]).toContain(u.cause);
  });
});
