// §B2 — Medi-Cal pre-release / reactivation tracker rules and owners.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { releaseCoverageRows, releaseCoverageAggregate, setReleaseCoverageStatus, COVERAGE_RELEASE_DRAFT } from "@/lib/coverageRelease";
import { listEscalations } from "@/lib/escalations";
import { workspaceActionRows } from "@/lib/clinicianWorkspace";
import { runAction } from "@/lib/actions/runAction";
import { MIN_COHORT_SIZE } from "@/lib/cohortGuard";

const DAY = 86_400_000;
const row = (name: string, now = new Date()) => releaseCoverageRows(now).find((r) => r.patientName === name)!;

describe("B2 coverage at release", () => {
  it("draft config", () => {
    expect(COVERAGE_RELEASE_DRAFT).toMatchObject({ preReleaseTaskDays: 30, escalateAfterDays: 3, flagAfterDays: 10 });
  });
  it("pre-release 25 days out, nothing submitted → task to the CF care manager", () => {
    const r = row("Jordan Vega");
    expect(r).toMatchObject({ dayOffset: -25, task: true, escalation: false, ownerStaffId: "s-cf2", nextAction: "submit_application" });
    const rows = workspaceActionRows({ actor: { role: "cf_care_manager", staffId: "s-cf2", staffName: "Darnell Pope" } as never, needsClosing: [] });
    expect(rows.some((x) => x.kind === "coverage" && x.patientId === r.patientId)).toBe(true);
  });
  it("31+ days out → no task", () => {
    expect(row("Jordan Vega", new Date(Date.now() - 6 * DAY)).task).toBe(false);
  });
  it("released day 4, not Active → escalation to the coordinator pool; day 10 flags", () => {
    const r = row("Elena Vargas");
    expect(r).toMatchObject({ released: true, dayOffset: 4, escalation: true, flagged: false, ownerName: "Coordinator pool" });
    const e = listEscalations({ role: "clinical_coordinator", staffId: "s-cc1" }).find((x) => x.type === "coverage_release" && x.patientId === r.patientId)!;
    expect(e.pool).toBe(true);
    expect(row("Elena Vargas", new Date(Date.now() + 6 * DAY)).flagged).toBe(true);
    expect(row("Elena Vargas", new Date(Date.now() - 2 * DAY)).escalation).toBe(false);
  });
  it("status needs a source, is audited via the registry, and Active clears the escalation", () => {
    const r = row("Elena Vargas");
    expect(() => setReleaseCoverageStatus({ episodeId: r.episodeId, status: "active", source: " " }, { name: "x", role: "clinical_coordinator" })).toThrow();
    expect(() => setReleaseCoverageStatus({ episodeId: r.episodeId, status: "active", source: "x" }, { name: "x", role: "billing" })).toThrow();
    const res = runAction("coverage_release_status_set", { role: "clinical_coordinator", staffId: "s-cc1", staffName: "Coord" }, undefined, { args: [{ episodeId: r.episodeId, status: "active", source: "County portal" }, { name: "Coord", role: "clinical_coordinator" }] });
    expect(res.ok).toBe(true);
    expect(row("Elena Vargas").escalation).toBe(false);
    const sim = runAction("coverage_release_check", { role: "clinical_coordinator", staffId: "s-cc1", staffName: "Coord" }, undefined, { args: [r.episodeId, { name: "Coord", role: "clinical_coordinator" }] });
    expect(sim.ok && sim.event.detail).toMatchObject({ simulated: true });
    expect(AdelanteEHR.listPreReleaseEpisodes().length).toBeGreaterThan(0);
  });
  it("aggregate is cohort-guarded", () => {
    const a = releaseCoverageAggregate();
    expect(a.minimumCohortSize).toBe(MIN_COHORT_SIZE);
    expect(a.belowMinimumCohort).toBe(a.released < 11);
  });
});
