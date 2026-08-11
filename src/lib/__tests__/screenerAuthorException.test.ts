// §Part 2 author/actor exception — the person who personally administered a
// Part 2-covered screener may read THAT result. Nothing broader.
import { afterEach, describe, expect, it } from "vitest";
import { AdelanteEHR, Part2AccessError, type CfAttribution } from "@/lib/ehr";
import { getStaffMember } from "@/lib/roles";

const CF_A = "s-cf1";
const CF_B = "s-cf2";
const AUDIT = [3, 2, 2, 1, 1, 0, 1, 1, 1, 0];

const attribution = (staffId: string): CfAttribution => {
  const s = getStaffMember(staffId)!;
  return { enteredBy: { staffId: s.id, staffName: s.name, role: s.role } };
};

function openEpisode(patientId: string, cfStaffId: string) {
  const cf = getStaffMember(cfStaffId)!;
  return AdelanteEHR.openPreReleaseEpisode({
    patientId,
    anticipatedReleaseDate: "2026-09-01",
    cfCareManagerStaffId: cf.id,
    cfCareManagerName: cf.name,
    openedBy: "test",
    actorRole: "cf_care_manager",
  });
}

function administer(patientId: string, cfStaffId: string) {
  const ep = openEpisode(patientId, cfStaffId);
  AdelanteEHR.recordPreReleaseScreener({
    episodeId: ep.id,
    screenerKey: "audit",
    answers: AUDIT,
    attribution: attribution(cfStaffId),
  });
  return ep;
}

afterEach(() => {
  for (const p of AdelanteEHR.listPatients()) {
    const ep = AdelanteEHR.activePreReleaseEpisode(p.id);
    if (ep)
      AdelanteEHR.closePreReleaseEpisode({
        episodeId: ep.id,
        reason: "test teardown",
        closedBy: "test",
        actorRole: "cf_care_manager",
      });
  }
});

const view = (patientId: string, staffId: string) =>
  AdelanteEHR.getScreenerResult(patientId, "audit", {
    kind: "staff",
    role: "cf_care_manager",
    staffId,
  });

describe("author/actor exception", () => {
  const [p1, p2] = AdelanteEHR.listPatients();

  it("records who administered the screener, reusing the CfAttribution shape", () => {
    administer(p1!.id, CF_A);
    const r = AdelanteEHR.getScreenerResult(p1!.id, "audit", { kind: "system" })!;
    expect(r.administeredBy?.enteredBy.staffId).toBe(CF_A);
  });

  it("lets the administering CF Care Manager read that specific result", () => {
    administer(p1!.id, CF_A);
    expect(view(p1!.id, CF_A)!.key).toBe("audit");
  });

  it("still refuses the same CF Care Manager on a patient they did not screen", () => {
    administer(p1!.id, CF_A);
    administer(p2!.id, CF_B);
    expect(() => view(p2!.id, CF_A)).toThrow(Part2AccessError);
  });

  it("still refuses a different CF Care Manager on their own episode's patient", () => {
    administer(p1!.id, CF_A);
    // CF_B now owns an episode for the same patient, but did not administer.
    AdelanteEHR.closePreReleaseEpisode({
      episodeId: AdelanteEHR.activePreReleaseEpisode(p1!.id)!.id,
      reason: "handoff",
      closedBy: "test",
      actorRole: "cf_care_manager",
    });
    openEpisode(p1!.id, CF_B);
    expect(() => view(p1!.id, CF_B)).toThrow(Part2AccessError);
  });

  it("does not widen the role generally — no author, no access", () => {
    expect(() => view(p2!.id, CF_A)).toThrow(Part2AccessError);
  });
});
