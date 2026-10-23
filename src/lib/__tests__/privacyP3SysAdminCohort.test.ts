// Privacy P3 item 3 — sys_admin ASAM / population-health totals above the cohort guard.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { aggregatePatients, asamAccessMode, asamClinicalReport, coordinatorConsentedPatients, roleSeesAsamRow } from "@/lib/asamReporting";
import { populationHealthReport } from "@/lib/populationHealth";
import { captureCoordination } from "@/test/typedConsentCapture";

describe("sys_admin consent-cohort totals", () => {
  it("is hidden below 11 consent-permitted patients", () => {
    expect(coordinatorConsentedPatients().length).toBeLessThan(11);
    expect(asamAccessMode("sys_admin")).toBeNull();
    expect(asamClinicalReport("sys_admin")).toBeNull();
    expect(aggregatePatients("sys_admin")).toEqual([]);
  });
  it("at 11+ counts exactly the coordinator's consent cohort, totals only, no names", () => {
    // B2-5 ledger (tighten): the cohort is built from test-local typed
    // care-coordination captures (runAction("consent_record_capture")); flags alone count nothing.
    const ps = AdelanteEHR.listPatients().slice(0, 11);
    expect(ps).toHaveLength(11);
    for (const p of ps) { p.sudCoordinationConsent = "tpo"; p.consents.part2Sud = true; }
    expect(coordinatorConsentedPatients()).toHaveLength(0);
    expect(asamAccessMode("sys_admin")).toBeNull();
    for (const p of ps.slice(0, 10)) captureCoordination(p.id);
    expect(coordinatorConsentedPatients()).toHaveLength(10);
    expect(asamAccessMode("sys_admin")).toBeNull();
    captureCoordination(ps[10].id);
    expect(coordinatorConsentedPatients()).toHaveLength(11);
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
