// Privacy P3 (Mitch, Oct 20) — sys_admin may export reporting dashboards as
// DE-IDENTIFIED TOTALS only: no names, no IDs, no client-level rows; every
// count below 11 is written as "<11". SUD / CalOMS / ASAM totals count only
// consent-permitted patients (the coordinator cohort) and the whole SUD block
// is absent when that cohort is below 11. Draft — pending clinical sign-off.
import { AdelanteEHR } from "./ehr";
import { MIN_COHORT_SIZE } from "./cohortGuard";
import { reportingSudCohort, reportingSudMode } from "./sysAdminReporting";
import { calomsCompleteness } from "./calomsReporting";
import type { StaffRole } from "./roles";

export const TOTALS_EXPORT_ROLES: readonly StaffRole[] = ["sys_admin"];

export interface TotalsRow { section: string; metric: string; value: string }

/** A count as published: "<11" for 1–10, the number otherwise (0 stays 0). */
export function suppressedCount(n: number): string {
  return n > 0 && n < MIN_COHORT_SIZE ? "<11" : String(n);
}

export function reportingTotalsRows(role: StaffRole): TotalsRow[] | null {
  if (!TOTALS_EXPORT_ROLES.includes(role)) return null;
  const patients = AdelanteEHR.listPatients();
  const rows: TotalsRow[] = [
    { section: "Caseload", metric: "Enrolled clients", value: suppressedCount(patients.length) },
    { section: "Caseload", metric: "Upcoming or past visits on file", value: suppressedCount(AdelanteEHR.listAppointments().length) },
  ];
  if (reportingSudMode(role)) {
    const cohort = reportingSudCohort(role);
    const c = calomsCompleteness(cohort);
    rows.push(
      { section: "SUD (consent-permitted only)", metric: "Clients counted", value: suppressedCount(cohort.length) },
      { section: "SUD (consent-permitted only)", metric: "CalOMS in scope", value: suppressedCount(c.total) },
      { section: "SUD (consent-permitted only)", metric: "CalOMS substance use captured", value: suppressedCount(c.substanceUse) },
      { section: "SUD (consent-permitted only)", metric: "CalOMS prior treatment captured", value: suppressedCount(c.priorTreatment) },
      { section: "SUD (consent-permitted only)", metric: "CalOMS discharge captured", value: suppressedCount(c.discharge) },
      { section: "SUD (consent-permitted only)", metric: "CalOMS justice captured", value: suppressedCount(c.justice) },
      { section: "SUD (consent-permitted only)", metric: "With an ASAM assessment", value: suppressedCount(cohort.filter((p) => (p.asamAssessments?.length ?? 0) > 0).length) },
    );
  }
  return rows;
}

const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** CSV + one content-free audit event. */
export function exportReportingTotals(actor: { role: StaffRole; staffId?: string }): string {
  const rows = reportingTotalsRows(actor.role);
  if (!rows) throw new Error("Totals export is limited to the systems administrator.");
  AdelanteEHR._recordAudit({ category: "access", action: "reporting_totals_exported", actorId: actor.staffId, actorRole: actor.role,
    detail: { rows: rows.length, deidentified: true, minimumCohortSize: MIN_COHORT_SIZE } });
  return ["section,metric,value", ...rows.map((r) => [r.section, r.metric, r.value].map(cell).join(","))].join("\n");
}
