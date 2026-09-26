// §Needs step 2 — connect requests, same-day tasks, funnel stage.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import type { StaffRole } from "@/lib/roles";
import { sdohFunnel } from "@/lib/sdohReporting";

const staff = { staffName: "Lupita Sanchez, MSW", role: "ecm_provider" as StaffRole };

function newPatient(cm?: string) {
  const p = AdelanteEHR.createPatient({ firstName: "Test", lastName: `N${Math.random()}`, dob: "1990-01-01", preferredLanguage: "en" } as Parameters<typeof AdelanteEHR.createPatient>[0]);
  if (cm) AdelanteEHR.assignCaseManager({ patientId: p.id, caseManagerId: cm });
  return p.id;
}
function need(pid: string, s: { need: string; urgency?: "today"; safetySensitive?: boolean; categoryId?: string }) {
  AdelanteEHR.applyIntakeNeeds(pid, { confirmed: [], selfReported: [s] });
  return AdelanteEHR.getPatient(pid)!.sdohPlan!.items.find((i) => i.need === s.need)!;
}

describe("connect requests", () => {
  it("creates one request for the assigned case manager and dedupes", () => {
    const pid = newPatient("cm1");
    const item = need(pid, { need: "Legal help", categoryId: "legal" });
    const t1 = AdelanteEHR.requestNeedConnect(pid, item.id, { id: pid, role: "patient" });
    const t2 = AdelanteEHR.requestNeedConnect(pid, item.id, { id: pid, role: "patient" });
    expect(t1?.assignedTo).toBe("cm1");
    expect(t2?.id).toBe(t1?.id);
    expect(AdelanteEHR.caseTasksForPatient(pid).filter((t) => t.taskType === "sdoh_connect_request")).toHaveLength(1);
  });
  it("goes to the pooled queue when no case manager is assigned", () => {
    const pid = newPatient();
    const item = need(pid, { need: "Legal help", categoryId: "legal" });
    const t = AdelanteEHR.requestNeedConnect(pid, item.id, { id: pid, role: "patient" });
    expect(t?.assignedTo).toBe("");
    expect(t?.allowedRoles?.length).toBeGreaterThan(0);
  });
  it("the Refer action closes the request", () => {
    const pid = newPatient("cm1");
    const item = need(pid, { need: "Legal help", categoryId: "legal" });
    const t = AdelanteEHR.requestNeedConnect(pid, item.id, { id: pid, role: "patient" })!;
    AdelanteEHR.addResourceReferral(pid, { category: "legal", provider: "Legal Aid", sdohItemId: item.id } as never, staff);
    expect(AdelanteEHR.caseTasksForPatient(pid).find((x) => x.id === t.id)?.status).toBe("done");
    expect(AdelanteEHR.getPatient(pid)!.sdohPlan!.items.find((i) => i.id === item.id)?.connectRequestClosedAt).toBeTruthy();
  });
  it("a patient cannot request on a staff-only safety need", () => {
    const pid = newPatient("cm1");
    const item = need(pid, { need: "Interpersonal safety", safetySensitive: true });
    expect(AdelanteEHR.requestNeedConnect(pid, item.id, { id: pid, role: "patient" })).toBeUndefined();
  });
});

describe("same-day tasks (draft rule)", () => {
  it("today topic → one urgent same-day task to the case manager, idempotent", () => {
    const pid = newPatient("cm1");
    need(pid, { need: "ID and documents", urgency: "today", categoryId: "life_skills" });
    AdelanteEHR.raiseNeedUrgencyTasks(pid);
    AdelanteEHR.raiseNeedUrgencyTasks(pid);
    const tasks = AdelanteEHR.caseTasksForPatient(pid).filter((t) => t.taskType === "sdoh_same_day");
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.priority).toBe("urgent");
    expect(tasks[0]!.assignedTo).toBe("cm1");
  });
  it("no steady place to live → same-day task", () => {
    const pid = newPatient("cm1");
    need(pid, { need: "Housing", categoryId: "housing" });
    expect(AdelanteEHR.raiseNeedUrgencyTasks(pid, { housingUnstable: true })).toHaveLength(1);
  });
  it("safety positive → staff-only tasks to case manager and clinician; never crisis queue", () => {
    const pid = newPatient("cm1");
    const before = AdelanteEHR.listCrisisQueue?.().length ?? 0;
    need(pid, { need: "Interpersonal safety", safetySensitive: true });
    const tasks = AdelanteEHR.raiseNeedUrgencyTasks(pid);
    expect(tasks).toHaveLength(2);
    expect(tasks.every((t) => t.taskType === "sdoh_safety_same_day")).toBe(true);
    expect(AdelanteEHR.listCrisisQueue?.().length ?? 0).toBe(before);
  });
  it("seeded Victor has a same-day task for cm1", () => {
    const v = AdelanteEHR.listPatients().find((p) => p.firstName === "Victor" && p.lastName === "Hale")!;
    expect(AdelanteEHR.caseTasksForPatient(v.id).some((t) => t.taskType === "sdoh_same_day" && t.assignedTo === "cm1")).toBe(true);
  });
});

describe("funnel", () => {
  it("counts connect requested", () => {
    const pid = newPatient("cm1");
    const item = need(pid, { need: "Legal help", categoryId: "legal" });
    AdelanteEHR.requestNeedConnect(pid, item.id, { id: pid, role: "patient" });
    expect(sdohFunnel({ patientIds: [pid] }).connectRequested).toBe(1);
  });
});
