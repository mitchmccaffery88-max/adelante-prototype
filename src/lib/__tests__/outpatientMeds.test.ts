import { describe, it, expect } from "vitest";
import { AdelanteEHR, demoScenarioPatientId, isSudMedicationName } from "@/lib/ehr";
import { asamTaskDueLabel, asamTaskState } from "@/lib/asam";
import { roleSeesAsam } from "@/lib/asamReporting";

describe("ASAM task due/overdue label", () => {
  const now = new Date("2026-09-25T12:00:00Z");
  it("labels a past-due task overdue, same rule as My Work", () => {
    expect(asamTaskState("2026-09-20", now)).toBe("overdue");
    expect(asamTaskDueLabel("2026-09-20", now)).toBe("overdue by 5 days (was due 2026-09-20, draft)");
    expect(asamTaskDueLabel("2026-09-28", now)).toBe("due 2026-09-28 (draft)");
  });
  it("Marcus's seeded task reads overdue", () => {
    const t = AdelanteEHR.openAsamTask("p3");
    expect(t).toBeDefined();
    expect(asamTaskDueLabel(t!.dueDate)).toMatch(/^overdue by \d+ days?/);
  });
});

describe("outpatient medication demo seed", () => {
  it("Paloma has the richest list with a pending refill and a mix of states", () => {
    const id = demoScenarioPatientId("medication")!;
    const meds = AdelanteEHR.listMedications(id);
    expect(meds.length).toBeGreaterThanOrEqual(4);
    expect(meds.every((m) => m.demo && m.prescriber.includes("PMHNP") && m.pharmacy)).toBe(true);
    const states = new Set(AdelanteEHR.listRefillRequests({ patientId: id }).map((r) => r.status));
    expect(states.has("pending")).toBe(true);
    expect(states.has("denied")).toBe(true);
    expect(states.has("sent_to_pharmacy")).toBe(true);
  });
  it("seeds a needs-an-appointment refill for Marcus", () => {
    const r = AdelanteEHR.listRefillRequests({ patientId: "p3" });
    expect(r.some((x) => x.status === "needs_appointment" && x.denyReason)).toBe(true);
  });
  it("Luis's MOUD is Part 2: clinician passes, case manager does not; task title masked", () => {
    const id = demoScenarioPatientId("sud_consented")!;
    const bn = AdelanteEHR.listMedications(id).find((m) => /buprenorphine/i.test(m.name))!;
    expect(isSudMedicationName(bn.name)).toBe(true);
    const p = AdelanteEHR.getPatient(id)!;
    expect(roleSeesAsam("therapist", p)).toBe(true);
    expect(roleSeesAsam("case_manager", p)).toBe(false);
    const tasks = AdelanteEHR.listCaseTasks().filter((t) => t.patientId === id && t.title.startsWith("Refill"));
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((t) => !/buprenorphine/i.test(t.title + (t.detail ?? "")))).toBe(true);
  });
  it("new sign-ups stay empty", () => {
    const p = AdelanteEHR.createPatient?.({ firstName: "Nova", lastName: "Test" } as never);
    if (p) expect(AdelanteEHR.listMedications((p as { id: string }).id)).toHaveLength(0);
  });
});
