import { describe, it, expect, beforeEach } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { __resetMedAdherence, isMatOrder } from "@/lib/medAdherence";
import { SHORT_FORM_SCREENERS, isShortFormPositive } from "@/lib/screeners";

function newPatient() {
  return AdelanteEHR.createPatient({ firstName: "Quick", lastName: "Check" }).id;
}

describe("PHQ-2 / GAD-2 quick check", () => {
  it("uses the real short-form items and cutoff", () => {
    const phq2 = SHORT_FORM_SCREENERS.find((s) => s.key === "phq-2")!;
    expect(phq2.questions).toEqual([
      "Little interest or pleasure in doing things",
      "Feeling down, depressed, or hopeless",
    ]);
    expect(phq2.options.map((o) => o.value)).toEqual([0, 1, 2, 3]);
    expect(phq2.fullFormKey).toBe("phq-9");
    expect(isShortFormPositive(phq2, 3)).toBe(true);
    expect(isShortFormPositive(phq2, 2)).toBe(false);
  });

  it("stores results through the existing screener history, not a parallel store", () => {
    const pid = newPatient();
    AdelanteEHR.recordQuickCheck(pid, { "phq-2": [1, 1], "gad-2": [0, 1] });
    const p = AdelanteEHR.getPatient(pid)!;
    expect(p.screeners["phq-2"]?.score).toBe(2);
    expect(p.screenerHistory?.some((h) => h.key === "gad-2")).toBe(true);
  });

  it("a positive result creates a real, traceable link to the full instrument", () => {
    const pid = newPatient();
    const res = AdelanteEHR.recordQuickCheck(pid, { "phq-2": [2, 2], "gad-2": [0, 0] });
    expect(res.escalated).toHaveLength(1);
    expect(res.escalated[0]!.fullFormKey).toBe("phq-9");

    // Patient-facing follow-up task on the existing "rescreen" kind.
    const pending = AdelanteEHR.pendingFullScreeners(pid);
    expect(pending.some((t) => t.screenerKey === "phq-9")).toBe(true);

    // Real clinician work item on the existing case-task queue.
    const task = AdelanteEHR.listCaseTasks?.({ patientId: pid }) ?? [];
    expect(
      task.some((t) => t.origin === "screener_flag" && t.title.includes("PHQ-9")),
    ).toBe(true);
  });

  it("a negative result creates no follow-up", () => {
    const pid = newPatient();
    const res = AdelanteEHR.recordQuickCheck(pid, { "phq-2": [1, 1], "gad-2": [1, 1] });
    expect(res.escalated).toHaveLength(0);
    expect(AdelanteEHR.pendingFullScreeners(pid)).toHaveLength(0);
  });

  it("is weekly: due before the first check-in, not due right after one", () => {
    const pid = newPatient();
    expect(AdelanteEHR.quickCheckDue(pid)).toBe(true);
    AdelanteEHR.recordQuickCheck(pid, { "phq-2": [0, 0], "gad-2": [0, 0] });
    expect(AdelanteEHR.quickCheckDue(pid)).toBe(false);
  });
});

describe("medication self-report + side effects", () => {
  beforeEach(() => __resetMedAdherence());

  function patientWithOrder() {
    const pid = AdelanteEHR.createPatient({ firstName: "Mat", lastName: "Patient" }).id;
    const p = AdelanteEHR.getPatient(pid)!;
    const order = {
      id: "ord_test_1",
      patientId: pid,
      drugName: "Buprenorphine/naloxone",
      dose: "8-2 mg",
      route: "sublingual",
      doseForm: "film",
      frequencyCode: "QD",
      status: "active" as const,
      createdAt: new Date().toISOString(),
      startDate: new Date().toISOString().slice(0, 10),
    };
    // Attach directly to the real order list on the record.
    (AdelanteEHR.__patientsForTest?.() ?? []).length; // no-op when helper absent
    p.orders = [...(p.orders ?? []), order as never];
    return { pid, orderId: order.id };
  }

  it("identifies MAT medications off the real order, not a separate list", () => {
    expect(
      isMatOrder({ drugName: "Buprenorphine/naloxone", doseForm: "film" } as never),
    ).toBe(true);
    expect(isMatOrder({ drugName: "Ibuprofen" } as never)).toBe(false);
  });

  it("a self-report is stored against the real order id and reconciles as self-report only", () => {
    const { pid, orderId } = patientWithOrder();
    const scheduledAt = new Date().toISOString();
    AdelanteEHR.selfReportDose(pid, {
      orderId,
      scheduledAt,
      facilityDate: scheduledAt.slice(0, 10),
      status: "taken",
    });
    const rows = AdelanteEHR.listDoseSelfReports(pid, { orderId });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("taken");
    // No charted dose was created — charting stays staff-only.
    expect(AdelanteEHR.listAdministrations(pid, { orderId })).toHaveLength(0);
  });

  it("re-marking the same slot updates rather than duplicating", () => {
    const { pid, orderId } = patientWithOrder();
    const scheduledAt = new Date().toISOString();
    const base = { orderId, scheduledAt, facilityDate: scheduledAt.slice(0, 10) };
    AdelanteEHR.selfReportDose(pid, { ...base, status: "taken" });
    AdelanteEHR.selfReportDose(pid, { ...base, status: "not_taken" });
    const rows = AdelanteEHR.listDoseSelfReports(pid, { orderId });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("not_taken");
  });

  it("the week strip reads real scheduled slots", () => {
    const { pid } = patientWithOrder();
    const week = AdelanteEHR.adherenceWeek(pid);
    expect(week).toHaveLength(7);
    expect(week.every((d) => typeof d.scheduled === "number")).toBe(true);
  });

  it("a side effect reaches a real staff surface", () => {
    const { pid, orderId } = patientWithOrder();
    const report = AdelanteEHR.reportMedSideEffect(pid, {
      orderId,
      severity: "severe",
      note: "Very dizzy in the mornings",
    })!;
    expect(report.caseTaskId).toBeTruthy();
    const tasks = AdelanteEHR.listCaseTasks?.({ patientId: pid }) ?? [];
    const t = tasks.find((x) => x.origin === "med_side_effect");
    expect(t).toBeTruthy();
    expect(t!.priority).toBe("urgent");
    expect(AdelanteEHR.allMedSideEffects({ openOnly: true }).some((s) => s.id === report.id)).toBe(
      true,
    );
    AdelanteEHR.acknowledgeMedSideEffect(pid, report.id, "N. Ruiz");
    expect(AdelanteEHR.listMedSideEffects(pid, { openOnly: true })).toHaveLength(0);
  });

  it("rejects a side effect on a medication the patient is not on", () => {
    const { pid } = patientWithOrder();
    expect(() =>
      AdelanteEHR.reportMedSideEffect(pid, { orderId: "nope", severity: "mild", note: "x" }),
    ).toThrow();
  });
});
