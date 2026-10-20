// Privacy P3 — sys_admin reporting: de-identified totals only, <11 suppressed.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { asamAccessMode, aggregatePatients, asamTaskRows, asamCosignRows, asamClinicalReport, coordinatorConsentedPatients } from "@/lib/asamReporting";
import { seesClientLevel } from "@/lib/countyReporting";
import { canDownloadSubmission } from "@/lib/countyDownloadAccess";
import { reportingSudCohort, reportingSudMode } from "@/lib/sysAdminReporting";
import { hasSudReportingAccess } from "@/lib/sudReportingAccess";
import { chartEntryFor } from "@/lib/chartAccess";
import { reportingTotalsRows, suppressedCount, exportReportingTotals } from "@/lib/reportingTotalsExport";
import { STAFF_ROLES } from "@/lib/roles";

describe("Privacy P3 — sys_admin aggregates", () => {
  it("counts the same consent-only cohort as the coordinator; hidden below 11", () => {
    const n = coordinatorConsentedPatients().length;
    expect(asamAccessMode("sys_admin")).toBe(n >= 11 ? "totals" : null);
    expect(reportingSudMode("sys_admin")).toBe(n >= 11 ? "totals" : null);
    expect(reportingSudCohort("sys_admin").map((p) => p.id)).toEqual(n >= 11 ? coordinatorConsentedPatients().map((p) => p.id) : []);
    expect(aggregatePatients("sys_admin").map((p) => p.id)).toEqual(n >= 11 ? coordinatorConsentedPatients().map((p) => p.id) : []);
    expect(reportingSudCohort("clinical_coordinator").map((p) => p.id)).toEqual(aggregatePatients("clinical_coordinator").map((p) => p.id));
  });
  it("gets no client-level rows, names, chart access or SUD detail", () => {
    expect(asamTaskRows("sys_admin") ?? []).toEqual([]);
    expect(asamCosignRows("sys_admin") ?? []).toEqual([]);
    const report = asamClinicalReport("sys_admin");
    if (report) expect(JSON.stringify(report)).not.toMatch(new RegExp(AdelanteEHR.listPatients().map((p) => p.lastName).filter(Boolean).join("|")));
    expect(seesClientLevel("sys_admin")).toBe(false);
    expect(hasSudReportingAccess("sys_admin")).toBe(false);
    expect(canDownloadSubmission("sys_admin", { report: "caloms" })).toBe(false);
    expect(canDownloadSubmission("sys_admin", { report: "tps" })).toBe(false);
    expect(canDownloadSubmission("sys_admin", { report: "datar" })).toBe(true);
    for (const p of AdelanteEHR.listPatients()) expect(chartEntryFor("sys_admin", undefined, p.id).ok).toBe(false);
  });
  it("the coordinator stays the state-reporting owner", () => {
    expect(seesClientLevel("clinical_coordinator")).toBe(true);
    expect(canDownloadSubmission("clinical_coordinator", { report: "caloms" })).toBe(true);
  });
  it("suppresses every count from 1 to 10", () => {
    for (let i = 1; i <= 10; i++) expect(suppressedCount(i)).toBe("<11");
    expect(suppressedCount(0)).toBe("0");
    expect(suppressedCount(11)).toBe("11");
  });
  it("export is sys_admin only, de-identified, and every value is suppressed or ≥11", () => {
    for (const { key } of STAFF_ROLES.filter((r) => r.key !== "sys_admin")) expect(reportingTotalsRows(key)).toBeNull();
    const rows = reportingTotalsRows("sys_admin")!;
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.value === "0" || r.value === "<11" || Number(r.value) >= 11).toBe(true);
    const csv = exportReportingTotals({ role: "sys_admin" });
    for (const p of AdelanteEHR.listPatients()) {
      expect(csv).not.toContain(p.id);
      expect(csv).not.toContain(p.programId);
      if (p.lastName) expect(csv).not.toContain(p.lastName);
    }
  });
});
