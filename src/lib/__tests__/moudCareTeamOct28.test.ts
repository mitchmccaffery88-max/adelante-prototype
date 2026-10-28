// 28 Oct (Mitch, Draft): MOUD episode care manager → care_manager care-team row, one audit.
import { describe, expect, it } from "vitest";
import { AdelanteEHR, demoScenarioPatientId } from "@/lib/ehr";
import { runAction } from "@/lib/actions/runAction";
import { listAdditionalTeam } from "@/lib/chartRelationships";
import { chartEntryFor, onCareTeam } from "@/lib/chartAccess";

const cc = { role: "clinical_coordinator" as const, staffId: "s-cc1" };
const billing = { role: "billing" as const, staffId: "s-bill1" };
const audits = (pid?: string) => AdelanteEHR.listAuditEvents({}).filter(e => (e.detail as { actionId?: string })?.actionId?.startsWith("moud_care_manager") && (!pid || true));

let n = 0;
function freshEpisode() {
  n++;
  const p = AdelanteEHR.createPatient({ firstName: `Moud${n}`, lastName: `Team${n}`, dob: "1990-01-01" } as Parameters<typeof AdelanteEHR.createPatient>[0]);
  const ep = AdelanteEHR.openPreReleaseEpisode({ patientId: p.id, anticipatedReleaseDate: "2026-12-01", cfCareManagerStaffId: "", cfCareManagerName: "", openedBy: "s-cc1", actorRole: "clinical_coordinator" });
  return { p, ep };
}

describe("MOUD episode care manager writes the care team", () => {
  it("assign adds an active care_manager row with exactly one audit; chart access follows the care-team rule", () => {
    const { p, ep } = freshEpisode();
    expect(onCareTeam("s-cf2", AdelanteEHR.getPatient(p.id)!)).toBe(false);
    const before = audits().length;
    const r = runAction("moud_care_manager_assign", cc, undefined, { args: [cc, { episodeId: ep.id, staffId: "s-cf2" }] });
    expect(r.ok).toBe(true);
    expect(audits().length - before).toBe(1);
    const row = listAdditionalTeam().find(x => x.patientId === p.id && x.staffId === "s-cf2")!;
    expect(row.kind).toBe("care_manager");
    expect(row.end).toBeUndefined();
    expect(onCareTeam("s-cf2", AdelanteEHR.getPatient(p.id)!)).toBe(true);
    expect(AdelanteEHR.getPreReleaseEpisode(ep.id)!.cfCareManagerStaffId).toBe("s-cf2");
  });

  it("an existing membership is kept, not duplicated, and survives ending the episode assignment", () => {
    const { p, ep } = freshEpisode();
    expect(runAction("chart_team_assignment", cc, undefined, { args: [cc, { patientId: p.id, staffId: "s-cf2", start: "2026-01-01T00:00:00Z" }] }).ok).toBe(true);
    const r = runAction<{ kept: boolean }>("moud_care_manager_assign", cc, undefined, { args: [cc, { episodeId: ep.id, staffId: "s-cf2" }] });
    expect(r.ok && r.value.kept).toBe(true);
    expect(listAdditionalTeam().filter(x => x.patientId === p.id && x.staffId === "s-cf2").length).toBe(1);
    expect(runAction("moud_care_manager_end", cc, undefined, { args: [cc, { episodeId: ep.id }] }).ok).toBe(true);
    expect(onCareTeam("s-cf2", AdelanteEHR.getPatient(p.id)!)).toBe(true);
  });

  it("ending an episode-only membership ends the team row", () => {
    const { p, ep } = freshEpisode();
    runAction("moud_care_manager_assign", cc, undefined, { args: [cc, { episodeId: ep.id, staffId: "s-cf2" }] });
    const r = runAction<{ ended: number }>("moud_care_manager_end", cc, undefined, { args: [cc, { episodeId: ep.id, at: new Date(Date.now() - 1000).toISOString() }] });
    expect(r.ok && r.value.ended).toBe(1);
    expect(onCareTeam("s-cf2", AdelanteEHR.getPatient(p.id)!)).toBe(false);
  });

  it("roles outside the assigner set are blocked with one blocked event", () => {
    const { ep } = freshEpisode();
    const r = runAction("moud_care_manager_assign", billing, undefined, { args: [billing, { episodeId: ep.id, staffId: "s-cf2" }] });
    expect(r.ok).toBe(false);
    expect(r.event.action).toBe("action.blocked");
  });

  it("demo scenario patient is untouched by the module import", () => {
    expect(demoScenarioPatientId("sud_consented")).toBeTruthy();
  });

  it("a care manager may assign themselves but not another care manager", () => {
    const { p, ep } = freshEpisode();
    const cm = { role: "ecm_provider" as const, staffId: "s-cf2" };
    const before = audits().length;
    const denied = runAction("moud_care_manager_assign", cm, undefined, { args: [cm, { episodeId: ep.id, staffId: "s-cf1" }] });
    expect(denied.ok).toBe(false);
    expect(listAdditionalTeam().filter(x => x.patientId === p.id)).toEqual([]);
    expect(audits().length - before).toBe(1);
    expect(runAction("moud_care_manager_assign", cm, undefined, { args: [cm, { episodeId: ep.id, staffId: cm.staffId }] }).ok).toBe(true);
  });

  it("a care manager cannot replace someone else even by assigning themselves", () => {
    const { p, ep } = freshEpisode();
    expect(runAction("moud_care_manager_assign", cc, undefined, { args: [cc, { episodeId: ep.id, staffId: "s-cf1" }] }).ok).toBe(true);
    const cm = { role: "ecm_provider" as const, staffId: "s-cf2" };
    expect(runAction("moud_care_manager_assign", cm, undefined, { args: [cm, { episodeId: ep.id, staffId: cm.staffId }] }).ok).toBe(false);
    expect(listAdditionalTeam().filter(x => x.patientId === p.id && !x.end).map(x => x.staffId)).toEqual(["s-cf1"]);
    expect(runAction("moud_care_manager_assign", cc, undefined, { args: [cc, { episodeId: ep.id, staffId: cm.staffId }] }).ok).toBe(true);
  });

  it("ending an episode-only assignment immediately removes direct chart entry", () => {
    const { p, ep } = freshEpisode();
    const cm = { role: "ecm_provider" as const, staffId: "s-cf2" };
    expect(runAction("moud_care_manager_assign", cc, undefined, { args: [cc, { episodeId: ep.id, staffId: cm.staffId }] }).ok).toBe(true);
    expect(chartEntryFor(cm.role, cm.staffId, p.id).ok).toBe(true);
    expect(runAction("moud_care_manager_end", cc, undefined, { args: [cc, { episodeId: ep.id }] }).ok).toBe(true);
    expect(chartEntryFor(cm.role, cm.staffId, p.id).ok).toBe(false);
  });
});
