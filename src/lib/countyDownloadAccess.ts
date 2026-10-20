// Privacy P3 — client-level county files (CalOMS, TPS) download only for the
// state-reporting owner's client-level access; aggregate files are unchanged.
import { seesClientLevel, type CountyReportId } from "./countyReporting";
import type { StaffRole } from "./roles";

export const CLIENT_LEVEL_REPORTS: readonly CountyReportId[] = ["caloms", "tps"];
export function canDownloadSubmission(role: StaffRole, s: { report: CountyReportId }): boolean {
  return !CLIENT_LEVEL_REPORTS.includes(s.report) || seesClientLevel(role);
}
