// Read-only trailing weekly projections. No history snapshots, identifiers,
// names, writes, or new access rules; hosts retain their existing KPI gates.
import { AdelanteEHR, type Patient, type GroupOccurrenceRecord } from "./ehr";
import { marCompliance, type MetricKey } from "./dashboardMetrics";
import { MIN_COHORT_SIZE } from "./cohortGuard";

export interface KpiWeek { period: string; value: number | null }
export interface KpiSparkline { points: KpiWeek[]; caption: string }
export interface KpiHistoryRecords {
  patients: Pick<Patient, "id" | "administrations">[];
  occurrences: Pick<GroupOccurrenceRecord, "occurrenceStart" | "attendanceRecordedAt" | "attendance">[];
}

const WEEK = 7 * 86_400_000;

/** Twelve consecutive seven-day intervals ending now, oldest first.
 * Empty intervals remain null; small patient cohorts remain null as well.
 * Boundaries are (start, end], so a record belongs to exactly one week.
 */
export function kpiWeeklyProjection(
  key: MetricKey,
  records: KpiHistoryRecords,
  now: Date,
): KpiSparkline | null {
  if (key !== "mar_compliance_pct" && key !== "group_attendance_rate_pct") return null;
  const points: KpiWeek[] = [];
  for (let i = 11; i >= 0; i--) {
    const end = now.getTime() - i * WEEK;
    const start = end - WEEK;
    const cohort = new Set<string>();
    let value: number | null = null;
    if (key === "mar_compliance_pct") {
      const patients = records.patients.map((p) => {
        const administrations = (p.administrations ?? []).filter((a) => {
          const at = Date.parse(a.scheduledAt || a.chartedAt);
          return !a.voided && Number.isFinite(at) && at > start && at <= end;
        });
        if (administrations.length) cohort.add(p.id);
        return { administrations };
      });
      value = marCompliance(patients, new Date(end), 7).pct;
    } else {
      let attended = 0;
      let denominator = 0;
      for (const occ of records.occurrences) {
        const at = Date.parse(occ.occurrenceStart);
        if (!occ.attendanceRecordedAt || !Number.isFinite(at) || at <= start || at > end) continue;
        for (const a of occ.attendance) {
          cohort.add(a.patientId);
          denominator++;
          if (a.status === "present" || a.status === "late") attended++;
        }
      }
      value = denominator ? attended / denominator * 100 : null;
    }
    points.push({ period: new Date(end).toISOString(), value: cohort.size < MIN_COHORT_SIZE ? null : value });
  }
  return { points, caption: "last 12 weeks" };
}

/** Called only by the existing authorized KPI host. Unsupported keys do not read records. */
export function liveKpiSparkline(key: MetricKey, now = new Date()): KpiSparkline | null {
  if (key !== "mar_compliance_pct" && key !== "group_attendance_rate_pct") return null;
  return kpiWeeklyProjection(key, {
    patients: key === "mar_compliance_pct" ? AdelanteEHR.listPatients() : [],
    occurrences: key === "group_attendance_rate_pct"
      ? AdelanteEHR.listGroupSessions().flatMap((g) => AdelanteEHR.listGroupOccurrenceRecords(g.id)) : [],
  }, now);
}