// §Phase 10d-2 — population health reporting.
import { describe, expect, it } from "vitest";
import { AdelanteEHR, demoScenarioPatientId, SCREENER_WORDING_PENDING_CAVEAT } from "@/lib/ehr";
import "@/lib/ehr-ext";
import { CSSRS_KEY } from "@/lib/cssrs";
import { POPULATION_HEALTH_ASSOCIATION_NOTE, populationHealthReport, sliceTrack } from "@/lib/populationHealth";

const tile = (r: ReturnType<typeof populationHealthReport>, key: string) =>
  r!.overall.instruments.find((t) => t.key === key);

describe("10d-2 role visibility", () => {
  it("therapist sees SUD tiles", () => {
    const r = populationHealthReport("therapist")!;
    expect(r.sudMode).toBe("full");
    expect(tile(r, "audit")).toBeTruthy();
    expect(r.overall.levels).not.toBeNull();
  });
  it("coordinator sees SUD totals only", () => {
    const r = populationHealthReport("clinical_coordinator")!;
    expect(r.sudMode).toBe("totals");
    expect(tile(r, "dast-10")!.administered).toBe(tile(populationHealthReport("therapist"), "dast-10")!.administered);
  });
  it("case manager sees no SUD tile; billing sees no section", () => {
    const r = populationHealthReport("ecm_provider")!;
    expect(r.sudMode).toBeNull();
    expect(tile(r, "audit")).toBeUndefined();
    expect(tile(r, "dast-10")).toBeUndefined();
    expect(r.overall.levels).toBeNull();
    expect(tile(r, "phq-9")).toBeTruthy();
    expect(populationHealthReport("billing")).toBeNull();
  });
});

describe("10d-2 rules", () => {
  it("AUDIT/DAST-10 counted with the wording caveat", () => {
    const r = populationHealthReport("therapist")!;
    expect(tile(r, "audit")!.administered).toBeGreaterThan(0);
    expect(tile(r, "audit")!.caveat).toBe(SCREENER_WORDING_PENDING_CAVEAT);
    expect(tile(r, "dast-10")!.caveat).toBe(SCREENER_WORDING_PENDING_CAVEAT);
  });
  it("retired PCL-5 short form never appears", () => {
    const r = populationHealthReport("therapist")!;
    expect(r.overall.instruments.some((t) => t.key === "pcl-5")).toBe(false);
  });
  it("placeholder C-SSRS results are excluded and counted", () => {
    const placeholders = AdelanteEHR.listPatients().flatMap((p) =>
      (p.screenerHistory ?? []).filter((h) => h.key === CSSRS_KEY && h.placeholderText),
    ).length;
    const c = populationHealthReport("therapist")!.overall.cssrs;
    expect(c.excludedPlaceholder).toBe(placeholders);
  });
  it("change over time has values from the seeded second timepoint", () => {
    const phq = tile(populationHealthReport("therapist"), "phq-9")!;
    expect(phq.withChange).toBeGreaterThanOrEqual(2);
    expect(phq.improved).toBeGreaterThanOrEqual(1);
    expect(phq.worsened).toBeGreaterThanOrEqual(1);
  });
  it("track slices add up and each carries its own guard", () => {
    const r = populationHealthReport("therapist")!;
    const track = r.slices.find((s) => s.kind === "track")!;
    const sum = track.groups.reduce((n, g) => n + g.report.guard.cohortSize, 0);
    expect(sum).toBe(AdelanteEHR.listPatients().length);
    expect(track.groups.map((g) => g.key).sort()).toEqual(["general", "justice_self_report", "pre_release_referred"]);
    for (const g of track.groups) expect(typeof g.report.guard.belowMinimumCohort).toBe("boolean");
  });
  it("justice self-report is a slice, never a substance-use signal", () => {
    const victor = demoScenarioPatientId("ji_self_report")!;
    expect(sliceTrack(AdelanteEHR.getPatient(victor)!)).toBe("justice_self_report");
    const r = populationHealthReport("therapist")!;
    const g = r.slices.find((s) => s.kind === "track")!.groups.find((x) => x.key === "justice_self_report")!;
    const audit = g.report.instruments.find((t) => t.key === "audit")!;
    const withAudit = AdelanteEHR.listPatients().filter(
      (p) => sliceTrack(p) === "justice_self_report" && p.screeners?.["audit"],
    ).length;
    expect(audit.administered).toBe(withAudit);
  });
  it("association-only wording", () => {
    expect(POPULATION_HEALTH_ASSOCIATION_NOTE).toMatch(/association only/);
    expect(POPULATION_HEALTH_ASSOCIATION_NOTE).not.toMatch(/\bcaused by\b|\bleads to\b/);
  });
});
