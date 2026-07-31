import { describe, expect, it } from "vitest";
import {
  METRIC_KEYS,
  METRIC_KEY_LABELS,
  METRICS_WITHOUT_SOURCE,
  computeLiveMetrics,
  evaluateTarget,
  formatMetric,
  formatTargetValue,
  marCompliance,
  overdueTasks,
  unsignedNotes,
} from "../dashboardMetrics";
import { AdelanteEHR } from "../ehr";
import { canAccess } from "../roles";

describe("dashboardMetrics — pure logic", () => {
  it("labels every metric key", () => {
    for (const k of METRIC_KEYS) expect(METRIC_KEY_LABELS[k]).toBeTruthy();
  });

  it("formats measured values and renders a dash for absent ones", () => {
    expect(formatMetric({ value: 94.44, unit: "percent", higherIsBetter: true })).toBe("94.4%");
    expect(formatMetric({ value: 7, unit: "count", higherIsBetter: false })).toBe("7");
    expect(formatMetric({ value: null, unit: "count", higherIsBetter: false })).toBe("—");
    expect(formatMetric(undefined)).toBe("—");
    expect(formatTargetValue(95, "percent")).toBe("95%");
  });

  it("evaluates targets in both directions", () => {
    const hi = { value: 96, unit: "percent" as const, higherIsBetter: true };
    expect(evaluateTarget(hi, 95).status).toBe("met");
    expect(evaluateTarget({ ...hi, value: 93 }, 95).status).toBe("near");
    expect(evaluateTarget({ ...hi, value: 50 }, 95).status).toBe("missed");
    const lo = { value: 3, unit: "count" as const, higherIsBetter: false };
    expect(evaluateTarget(lo, 5).status).toBe("met");
    expect(evaluateTarget({ ...lo, value: 40 }, 5).status).toBe("missed");
  });

  it("returns no_metric rather than a fake zero when there is no live value", () => {
    const e = evaluateTarget({ value: null, unit: "count", higherIsBetter: false }, 0);
    expect(e.status).toBe("no_metric");
    expect(e.delta).toBeNull();
  });
});

describe("marCompliance", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  const admin = (action: string, daysAgo: number, voided = false) => ({
    action,
    voided,
    scheduledAt: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
    chartedAt: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
  });

  it("computes given / (given + refused + held) in the window", () => {
    const patients = [
      { administrations: [admin("given", 1), admin("given", 2), admin("refused", 3)] },
      { administrations: [admin("held", 4)] },
    ] as never[];
    const r = marCompliance(patients, now);
    expect(r.denominator).toBe(4);
    expect(r.pct).toBe(50);
  });

  it("excludes voided rows and anything outside the window", () => {
    const patients = [
      { administrations: [admin("given", 1), admin("refused", 2, true), admin("refused", 90)] },
    ] as never[];
    const r = marCompliance(patients, now);
    expect(r.denominator).toBe(1);
    expect(r.pct).toBe(100);
  });

  it("returns null (not 0%) when nothing was charted", () => {
    expect(marCompliance([{ administrations: [] }] as never[], now).pct).toBeNull();
  });
});

describe("unsignedNotes / overdueTasks", () => {
  const now = new Date("2026-06-15T12:00:00Z");

  it("counts only draft notes", () => {
    const patients = [
      {
        id: "p1",
        firstName: "A",
        lastName: "B",
        progressNotes: [
          { id: "n1", date: "2026-06-10", sessionType: "Individual", clinicianId: "c", status: "draft" },
          { id: "n2", date: "2026-06-11", sessionType: "Individual", clinicianId: "c", status: "signed" },
          { id: "n3", date: "2026-06-12", sessionType: "Individual", clinicianId: "c", status: "cosign_pending" },
        ],
      },
    ] as never[];
    const rows = unsignedNotes(patients, now);
    expect(rows.map((r) => r.noteId)).toEqual(["n1"]);
    expect(rows[0]!.ageDays).toBe(5);
  });

  it("counts open tasks past their real due date, skipping done and live snoozes", () => {
    const tasks = [
      { id: "t1", patientId: "p1", title: "Late", dueDate: "2026-06-01", status: "open", assignedTo: "x", origin: "manual" },
      { id: "t2", patientId: "p1", title: "Future", dueDate: "2026-07-01", status: "open", assignedTo: "x", origin: "manual" },
      { id: "t3", patientId: "p1", title: "Done", dueDate: "2026-06-01", status: "done", assignedTo: "x", origin: "manual" },
      { id: "t4", patientId: "p1", title: "Snoozed", dueDate: "2026-06-01", status: "snoozed", snoozedUntil: "2026-07-01", assignedTo: "x", origin: "manual" },
    ] as never[];
    const patients = [{ id: "p1", firstName: "A", lastName: "B" }] as never[];
    const rows = overdueTasks(tasks, patients, now);
    expect(rows.map((r) => r.taskId)).toEqual(["t1"]);
    expect(rows[0]!.patientName).toBe("A B");
  });
});

describe("computeLiveMetrics — honest gaps", () => {
  const metrics = computeLiveMetrics();

  it("returns null for every metric with no data source", () => {
    for (const k of METRIC_KEYS) {
      if (METRICS_WITHOUT_SOURCE[k]) {
        expect(metrics[k].value, `${k} must not fabricate a value`).toBeNull();
      }
    }
  });

  it("keeps unsourced keys present so target rows still render", () => {
    expect(Object.keys(metrics).sort()).toEqual([...METRIC_KEYS].sort());
    expect(metrics.controlled_count_discrepancies.value).toBeNull();
    expect(metrics.open_kites_count.value).toBeNull();
  });

  it("computes the sourced metrics from real records", () => {
    const patients = AdelanteEHR.listPatients();
    expect(metrics.unsigned_notes_count.value).toBe(unsignedNotes(patients).length);
    expect(metrics.overdue_task_count.value).toBe(
      overdueTasks(AdelanteEHR.listCaseTasks(), patients).length,
    );
    const mar = marCompliance(patients);
    expect(metrics.mar_compliance_pct.value).toBe(mar.pct);
  });
});

describe("population_health RBAC", () => {
  it("gives config-tier roles write and reporting roles read", () => {
    expect(canAccess("sys_admin", "population_health").level).toBe("write");
    expect(canAccess("clinical_coordinator", "population_health").level).toBe("write");
    for (const r of ["billing", "billing_coordinator", "pmhnp", "therapist", "case_manager"] as const) {
      expect(canAccess(r, "population_health").level).toBe("read");
    }
  });

  it("locks peer specialists out entirely", () => {
    // Denial reasons are reserved for 42 CFR Part 2 consent gating; a plain
    // role denial carries level "none" and the UI supplies the copy.
    expect(canAccess("peer_specialist", "population_health").level).toBe("none");
  });
});

describe("KPI target CRUD", () => {
  it("creates, edits and deactivates with an audit trail", () => {
    const created = AdelanteEHR.createKpiTarget(
      { metricKey: "open_kites_count", label: "Open kites", targetValue: 12, unit: "count" },
      "Test Admin",
    );
    expect(AdelanteEHR.listKpiTargets().some((t) => t.id === created.id)).toBe(true);

    const updated = AdelanteEHR.updateKpiTarget(created.id, { targetValue: 8 }, "Test Admin");
    expect(updated.targetValue).toBe(8);

    expect(() => AdelanteEHR.setKpiTargetActive(created.id, false, "Test Admin", "")).toThrow(
      /reason/i,
    );
    AdelanteEHR.setKpiTargetActive(created.id, false, "Test Admin", "Kites deferred");
    expect(AdelanteEHR.listKpiTargets().some((t) => t.id === created.id)).toBe(false);
    expect(AdelanteEHR.listKpiTargets(true).some((t) => t.id === created.id)).toBe(true);
  });

  it("rejects blank labels and non-numeric targets", () => {
    expect(() =>
      AdelanteEHR.createKpiTarget(
        { metricKey: "open_kites_count", label: "  ", targetValue: 1, unit: "count" },
        "Test Admin",
      ),
    ).toThrow(/label/i);
    expect(() =>
      AdelanteEHR.createKpiTarget(
        { metricKey: "open_kites_count", label: "X", targetValue: Number.NaN, unit: "count" },
        "Test Admin",
      ),
    ).toThrow(/numeric/i);
  });
});
