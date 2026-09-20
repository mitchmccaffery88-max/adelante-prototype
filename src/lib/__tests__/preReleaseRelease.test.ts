// §Intake/SDOH Phase 1 — the open → released transition, end to end.
//
// The point of this file is the CONSEQUENCE, not the field write: before the
// transition existed, a genuinely released justice-involved patient resolved
// as `pre_release_ji` forever, and the Day-0 reentry module — which triggers
// specifically on `status === "released"` — could never activate.
import { describe, it, expect, beforeEach } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { resolvePopulation, isPopulationAllowed } from "@/lib/population";
import { dayZeroAvailability } from "@/lib/reentryDayZero";
import { canWritePreReleaseEpisode } from "@/lib/roles";

const newPatient = () =>
  AdelanteEHR.createPatient({
    firstName: "Release",
    lastName: "Transition",
    dob: "1988-04-02",
  }).id;

const openEpisode = (patientId: string) =>
  AdelanteEHR.openPreReleaseEpisode({
    patientId,
    anticipatedReleaseDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
    cfCareManagerStaffId: "staff_cf_1",
    cfCareManagerName: "CF Manager",
    openedBy: "CF Manager",
    actorRole: "cf_care_manager",
  });


const release = (episodeId: string) =>
  AdelanteEHR.markPreReleaseEpisodeReleased({
    episodeId,
    confirmedBy: "CF Manager",
    actorRole: "cf_care_manager",
  });

describe("pre-release episode release transition", () => {
  let pid: string;
  let epId: string;

  beforeEach(() => {
    pid = newPatient();
    epId = openEpisode(pid).id;
  });

  it("an open episode holds the patient at pre_release_ji with Day-0 unavailable", () => {
    expect(resolvePopulation(pid).track).toBe("pre_release_ji");
    expect(dayZeroAvailability(pid).available).toBe(false);
  });

  it("confirming release moves the track to post_release_ji and activates Day-0", () => {
    const ep = release(epId);
    expect(ep.status).toBe("released");

    const pop = resolvePopulation(pid);
    expect(pop.track).toBe("post_release_ji");
    expect(pop.provisional).toBe(false);

    const dz = dayZeroAvailability(pid);
    expect(dz.available).toBe(true);
    expect(dz.trigger).toBe("released_episode");
  });

  it("the reentry population surfaces (Obligations, PO disclosure) stay allowed after release", () => {
    release(epId);
    const pop = resolvePopulation(pid);
    // Both cards gate on this exact allow-list.
    expect(isPopulationAllowed(pop, ["pre_release_ji", "post_release_ji"])).toBe(true);
    expect(isPopulationAllowed(pop, ["post_release_ji"])).toBe(true);
  });

  it("closing after release keeps the patient post_release_ji", () => {
    release(epId);
    AdelanteEHR.closePreReleaseEpisode({
      episodeId: epId,
      reason: "Handoff complete",
      closedBy: "CF Manager",
      actorRole: "cf_care_manager",
    });
    expect(resolvePopulation(pid).track).toBe("post_release_ji");
  });

  it("release can only be confirmed once, from an open episode", () => {
    release(epId);
    expect(() => release(epId)).toThrow(/already released/i);
  });

  it("writes a real audit row naming the actor", () => {
    release(epId);
    const row = AdelanteEHR.listAuditEvents({ patientId: pid }).find(
      (a) => a.action === "pre_release_episode_released",
    );
    expect(row).toBeTruthy();
    expect(row?.actorRole).toBe("cf_care_manager");

  });

  it("only write-level pre-release roles may move the episode", () => {
    expect(canWritePreReleaseEpisode("cf_care_manager")).toBe(true);
    expect(canWritePreReleaseEpisode("ecm_provider")).toBe(true);
    expect(canWritePreReleaseEpisode("therapist")).toBe(false);
    expect(canWritePreReleaseEpisode("clinical_coordinator")).toBe(false);
    expect(canWritePreReleaseEpisode("peer_specialist")).toBe(false);
  });
});
