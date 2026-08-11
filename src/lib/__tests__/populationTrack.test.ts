import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { isPopulationAllowed, resolvePopulation } from "@/lib/population";

function newPatient(over: Record<string, unknown> = {}) {
  return AdelanteEHR.createPatient({ firstName: "Pop", lastName: "Track", ...over } as never).id;
}

function openEpisode(pid: string) {
  return AdelanteEHR.openPreReleaseEpisode({
    patientId: pid,
    anticipatedReleaseDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    cfCareManagerStaffId: "cf-1",
    cfCareManagerName: "CF Manager",
    openedBy: "CF Manager",
  } as never);
}

describe("population resolver — derived from real record data", () => {
  it("pre-release JI: an open pre-release episode", () => {
    const pid = newPatient();
    openEpisode(pid);
    const r = resolvePopulation(pid);
    expect(r.track).toBe("pre_release_ji");
    expect(r.provisional).toBe(false);
  });

  it("post-release JI: a confirmed front-door justice answer, no episode", () => {
    const pid = newPatient();
    AdelanteEHR.setCoverage(pid, { justiceInvolvement: "yes" } as never);
    expect(resolvePopulation(pid).track).toBe("post_release_ji");
  });

  it("post-release JI: a justice-linked referral source", () => {
    const pid = newPatient();
    AdelanteEHR.recordFrontDoorEntry(pid, {
      existingCare: "no",
      heardAbout: "probation_parole_drug_court",
    } as never);
    expect(resolvePopulation(pid).track).toBe("post_release_ji");
  });

  it("general population: no justice signal anywhere", () => {
    const pid = newPatient();
    AdelanteEHR.recordFrontDoorEntry(pid, {
      existingCare: "no",
      heardAbout: "word_of_mouth",
    } as never);
    const r = resolvePopulation(pid);
    expect(r.track).toBe("general_population");
    expect(r.provisional).toBe(false);
  });

  it("'not sure' is provisional and does NOT open a justice-only gate", () => {
    const pid = newPatient();
    AdelanteEHR.setCoverage(pid, { justiceInvolvement: "unsure" } as never);
    const r = resolvePopulation(pid);
    expect(r.track).toBe("post_release_ji");
    expect(r.provisional).toBe(true);
    expect(isPopulationAllowed(r, ["post_release_ji"])).toBe(false);
    expect(isPopulationAllowed(r, ["post_release_ji"], { requireConfirmed: false })).toBe(true);
  });

  it("track follows the real episode state, not a stored flag", () => {
    const pid = newPatient();
    const ep = openEpisode(pid);
    expect(resolvePopulation(pid).track).toBe("pre_release_ji");
    AdelanteEHR.closePreReleaseEpisode({
      episodeId: ep.id,
      reason: "Released from custody",
      closedBy: "CF Manager",
      actorRole: "cf_care_manager",
    });
    expect(resolvePopulation(pid).track).toBe("post_release_ji");
  });
});

describe("advocate is never the patient's population", () => {
  it("an advocate viewing a pre-release patient resolves to 'advocate'", () => {
    const pid = newPatient();
    openEpisode(pid);
    const r = resolvePopulation(pid, { kind: "advocate", advocateLinkId: "link-1" });
    expect(r.track).toBe("advocate");
    // And no patient-population gate lets them through.
    for (const allow of [["pre_release_ji"], ["post_release_ji"], ["general_population"]] as const) {
      expect(isPopulationAllowed(r, [...allow])).toBe(false);
    }
  });

  it("unknown record falls back to general population, provisionally", () => {
    const r = resolvePopulation(undefined);
    expect(r.track).toBe("general_population");
    expect(isPopulationAllowed(r, ["general_population"])).toBe(false);
  });
});
