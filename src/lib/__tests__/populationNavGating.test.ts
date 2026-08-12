import { describe, expect, it } from "vitest";
import { resolvePopulationTrack } from "@/lib/population";
import { PATIENT_NAV, patientNavForPopulation } from "@/lib/navSections";

describe("justice-involved reentry flag", () => {
  const base = { preReleaseEpisodes: [], hasReferralRecord: false, hasMissedPreReleaseFlag: false };

  it("counts the Medi-Cal JI reentry flag as a confirmed justice signal", () => {
    const r = resolvePopulationTrack({ ...base, hasJiReentryFlag: true });
    expect(r.track).toBe("post_release_ji");
    expect(r.provisional).toBe(false);
  });

  it("still lets an open episode win as pre-release", () => {
    const r = resolvePopulationTrack({
      ...base,
      preReleaseEpisodes: [{ status: "open" }],
      hasJiReentryFlag: true,
    });
    expect(r.track).toBe("pre_release_ji");
  });

  it("leaves an unflagged patient in the general population", () => {
    expect(resolvePopulationTrack(base).track).toBe("general_population");
  });
});

describe("patient nav population gating", () => {
  it("hides Obligations from general population and keeps it for JI tracks", () => {
    const general = patientNavForPopulation(PATIENT_NAV, "general_population").map((e) => e.id);
    const ji = patientNavForPopulation(PATIENT_NAV, "post_release_ji").map((e) => e.id);
    expect(general).not.toContain("obligations");
    expect(ji).toContain("obligations");
    expect(general.length).toBe(PATIENT_NAV.length - 1);
  });
});
