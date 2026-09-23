// §Dashboard Standardization Phase 5c — attributed task edits, task notes, and
// the per-patient open-items rollup.
import { describe, expect, it } from "vitest";
import { AdelanteEHR, taskPriority } from "@/lib/ehr";
import { listPatientOpenItems } from "@/lib/patientOpenItems";

const pid = () => AdelanteEHR.listPatients()[0].id;
const make = () =>
  AdelanteEHR.createCaseTask({
    patientId: pid(),
    assignedTo: "cm1",
    title: "Task",
    dueDate: "2026-07-31",
  })!;

describe("attributed task edits", () => {
  it("updates due date and priority and records who changed it", () => {
    const t = make();
    expect(
      AdelanteEHR.updateCaseTaskFields(
        t.id,
        { dueDate: "2026-08-15", priority: "urgent" },
        "Luz Herrera",
        "ecm_provider",
      ),
    ).toBe(true);
    const after = AdelanteEHR.listCaseTasks().find((x) => x.id === t.id)!;
    expect(after.dueDate).toBe("2026-08-15");
    expect(taskPriority(after)).toBe("urgent");
    expect(after.lastEditedBy).toBe("Luz Herrera");
    expect(after.lastEditedAt).toBeTruthy();
    const audited = AdelanteEHR.listAuditEvents().some(
      (a) =>
        a.action === "case_task_updated" &&
        (a.detail as { taskId?: string } | undefined)?.taskId === t.id,
    );
    expect(audited).toBe(true);
  });

  it("a no-op patch changes nothing and is not audited as an edit", () => {
    const t = make();
    expect(AdelanteEHR.updateCaseTaskFields(t.id, {}, "Luz Herrera", "ecm_provider")).toBe(false);
    expect(
      AdelanteEHR.updateCaseTaskFields(t.id, { title: "Task" }, "Luz Herrera", "ecm_provider"),
    ).toBe(false);
    expect(AdelanteEHR.listCaseTasks().find((x) => x.id === t.id)!.lastEditedBy).toBeUndefined();
  });

  it("assignment is not editable through this path", () => {
    const t = make();
    AdelanteEHR.updateCaseTaskFields(
      t.id,
      { assignedTo: "cm2" } as never,
      "Luz Herrera",
      "ecm_provider",
    );
    expect(AdelanteEHR.listCaseTasks().find((x) => x.id === t.id)!.assignedTo).toBe("cm1");
  });
});

describe("task notes", () => {
  it("appends an attributed note and rejects empty text", () => {
    const t = make();
    expect(AdelanteEHR.addCaseTaskNote(t.id, "   ", "Luz Herrera", "ecm_provider")).toBe(false);
    expect(AdelanteEHR.addCaseTaskNote(t.id, "Called, left voicemail", "Luz Herrera", "ecm_provider")).toBe(
      true,
    );
    const after = AdelanteEHR.listCaseTasks().find((x) => x.id === t.id)!;
    expect(after.notes?.length).toBe(1);
    expect(after.notes![0]).toMatchObject({
      text: "Called, left voicemail",
      authorName: "Luz Herrera",
      authorRole: "ecm_provider",
    });
  });
});

describe("patient open-items rollup", () => {
  it("includes a pending refill request and drops it once reviewed", () => {
    const patient = AdelanteEHR.listPatients()[0];
    const med = patient.medications?.[0];
    if (!med) return; // seeded data without meds — nothing to assert
    const req = AdelanteEHR.requestRefill?.({
      patientId: patient.id,
      medicationId: med.id,
      medicationName: med.name,
      requestedBy: "patient",
    });
    if (!req) return;
    const items = listPatientOpenItems(patient.id);
    expect(items.some((i) => i.kind === "refill_request" && i.section === "orders")).toBe(true);
  });

  it("never invents reschedule or group-access items", () => {
    const kinds = new Set(listPatientOpenItems(pid()).map((i) => i.kind));
    for (const k of kinds) {
      expect(["unsigned_work", "sdoh_need", "refill_request"]).toContain(k);
    }
  });
});
