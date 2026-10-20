// Privacy P3 item 3 — sys_admin ASAM / population-health totals above the cohort guard.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { aggregatePatients, asamAccessMode, asamClinicalReport, coordinatorConsentedPatients, roleSeesAsamRow } from "@/lib/asamReporting";
import { populationHealthReport } from "@/lib/populationHealth";

describe("sys_admin consent-cohort totals", () => {
  it("is hidden below 11 consent-permitted patients", () => {
    expect(coordinatorConsentedPatients().length).toBeLessThan(11);
    expect(asamAccessMode("sys_admin")).toBeNull();
    expect(asamClinicalReport("sys_admin")).toBeNull();
    expect(aggregatePatients("sys_admin")).toEqual([]);
  });
  it("at 11+ counts exactly the coordinator's consent cohort, totals only, no names", () => {
    // Test fixture: record SUD coordination consent on 11 patients.
    const ps = AdelanteEHR.listPatients().slice(0, 11);
    expect(ps).toHaveLength(11);
    for (const p of ps) { p.sudCoordinationConsent = "tpo"; p.consents.part2Sud = true; }
    expect(asamAccessMode("sys_admin")).toBe("totals");
    expect(aggregatePatients("sys_admin").map((p) => p.id)).toEqual(aggregatePatients("clinical_coordinator").map((p) => p.id));
    const report = asamClinicalReport("sys_admin")!;
    expect(report.mode).toBe("totals");
    expect(JSON.stringify(report)).toBe(JSON.stringify(asamClinicalReport("clinical_coordinator")));
    for (const t of report.tasks) expect(t.patientName).toBe("");
    for (const p of AdelanteEHR.listPatients()) expect(roleSeesAsamRow("sys_admin", p)).toBe(false);
    expect(JSON.stringify(populationHealthReport("sys_admin"))).toBe(JSON.stringify(populationHealthReport("clinical_coordinator")));
  });
});
