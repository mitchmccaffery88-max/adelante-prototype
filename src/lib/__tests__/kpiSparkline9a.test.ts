import { describe, expect, it } from "vitest";
import { kpiWeeklyProjection, type KpiHistoryRecords } from "@/lib/kpiSparkline";
import type { DoseAdministration } from "@/lib/ehr";

const now = new Date("2026-10-20T12:00:00Z");
const dose = (id: string, at: string, action: DoseAdministration["action"], voided = false): DoseAdministration => ({
  id, patientId: id, orderId: "o", batchId: "batch", scheduledAt: at, chartedAt: at, action, chartedBy: "staff", voided,
});
const records: KpiHistoryRecords = {
  patients: Array.from({ length: 11 }, (_, i) => ({ id: `p${i}`, administrations: [
    dose(`a${i}`, "2026-10-19T12:00:00Z", i < 9 ? "given" : "held"),
    dose(`b${i}`, "2026-10-13T12:00:00Z", "given"),
    dose(`void${i}`, "2026-10-19T12:00:00Z", "refused", true),
    dose(`future${i}`, "2026-10-21T12:00:00Z", "refused"),
  ] })),
  occurrences: [{ occurrenceStart: "2026-10-19T12:00:00Z", attendanceRecordedAt: "2026-10-20T00:00:00Z",
    attendance: Array.from({ length: 11 }, (_, i) => ({ patientId: `p${i}`, status: i < 8 ? "present" : i === 8 ? "late" : "absent" })),
  }, { occurrenceStart: "2026-10-18T12:00:00Z", attendance: [{ patientId: "p0", status: "absent" }] }],
};

describe("Real weekly KPI projections", () => {
  it("MAR uses twelve real non-overlapping dated weeks; void/future events excluded", () => {
    const series = kpiWeeklyProjection("mar_compliance_pct", records, now);
    expect(series?.points).toHaveLength(12);
    expect(series?.points[11].value).toBe(9 / 11 * 100);
    expect(series?.points[10].value).toBe(100);
    expect(series?.points.slice(0, 10).every((p) => p.value === null)).toBe(true);
  });
  it("group attendance uses occurrence date, recorded rosters, and present plus late", () => {
    const series = kpiWeeklyProjection("group_attendance_rate_pct", records, now);
    expect(series?.points[11].value).toBe(9 / 11 * 100);
    expect(series?.points[10].value).toBeNull();
  });
  it("weekly aggregates with ten patients are suppressed, not manufactured zeros", () => {
    const small = { patients: records.patients.slice(0, 10), occurrences: [] };
    expect(kpiWeeklyProjection("mar_compliance_pct", small, now)?.points[11].value).toBeNull();
  });
  it.each(["unsigned_notes_count", "overdue_task_count", "controlled_count_discrepancies"] as const)("%s has no fabricated history", (key) => {
    expect(kpiWeeklyProjection(key, records, now)).toBeNull();
  });
});