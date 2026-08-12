// §Pre-release build 5 — nav ownership + DHCS-staged timeline.
import { describe, it, expect } from "vitest";
import { canAccess, canReadPreRelease, type StaffRole } from "@/lib/roles";
import { STAFF_NAV, canSeeNavEntry } from "@/lib/navSections";
import {
  preReleasePhase,
  preReleaseTimeline,
  daysUntilRelease,
  visiblePreReleaseEpisodes,
} from "@/lib/preReleaseTimeline";

const entry = STAFF_NAV.find((e) => e.id === "pre-release")!;
const OWNERS: StaffRole[] = [
  "cf_care_manager",
  "ecm_provider",
  "pmhnp",
  "therapist",
  "sud_counselor",
  "clinical_coordinator",
  "sys_admin",
];
const OUTSIDERS: StaffRole[] = ["peer_specialist", "billing", "medical_assistant", "community_health_worker"];

describe("nav ownership", () => {
  it("no longer gates on the generic custody_tracking class", () => {
    expect(entry.gate).toEqual({ kind: "record_class", anyOf: ["pre_release"] });
  });

  it.each(OWNERS)("%s sees the nav entry and can read the page", (role) => {
    expect(canSeeNavEntry(role, entry)).toBe(true);
    expect(canReadPreRelease(role)).toBe(true);
  });

  it.each(OUTSIDERS)("%s does not", (role) => {
    expect(canSeeNavEntry(role, entry)).toBe(false);
    expect(canReadPreRelease(role)).toBe(false);
  });

  it("peer_specialist keeps custody_tracking but loses the workspace", () => {
    expect(canAccess("peer_specialist", "custody_tracking").level).not.toBe("none");
    expect(canAccess("peer_specialist", "pre_release").level).toBe("none");
  });

  it("nav gate and page gate are the same computation", () => {
    for (const role of [...OWNERS, ...OUTSIDERS])
      expect(canSeeNavEntry(role, entry)).toBe(canReadPreRelease(role));
  });
});

const epi = (id: string, over: Partial<{ receivingEcmStaffId: string; cfCareManagerStaffId: string }> = {}) => ({
  id,
  cfCareManagerStaffId: "cf1",
  ...over,
});

describe("receiving-side visibility", () => {
  const all = [epi("a", { receivingEcmStaffId: "ecm1" }), epi("b", { receivingEcmStaffId: "ecm2" }), epi("c")];
  it("an ECM Provider sees only episodes where they are the receiving provider", () => {
    expect(visiblePreReleaseEpisodes(all, "ecm_provider", "ecm1").map((e) => e.id)).toEqual(["a"]);
  });
  it("the CF Care Manager and other roles see the full list", () => {
    expect(visiblePreReleaseEpisodes(all, "cf_care_manager", "cf1")).toHaveLength(3);
    expect(visiblePreReleaseEpisodes(all, "pmhnp", "p1")).toHaveLength(3);
  });
});

const today = new Date("2026-08-12T14:00:00Z");
const plus = (days: number) =>
  new Date(Date.parse("2026-08-12T00:00:00Z") + days * 86_400_000).toISOString().slice(0, 10);

describe("DHCS-staged timeline", () => {
  it("computes real day offsets from the anticipated release date", () => {
    expect(daysUntilRelease(plus(75), today)).toBe(75);
    expect(daysUntilRelease(plus(-5), today)).toBe(-5);
  });

  it.each([
    [120, "pre_window"],
    [90, "intake_screening"],
    [75, "intake_screening"],
    [61, "intake_screening"],
    [60, "coordination"],
    [10, "coordination"],
    [4, "coordination"],
    [3, "warm_handoff"],
    [1, "warm_handoff"],
    [0, "warm_handoff"],
    [-1, "released"],
  ])("release in %i days => %s", (d, phase) => {
    expect(preReleasePhase({ anticipatedReleaseDate: plus(d as number) }, today)).toBe(phase);
  });

  it("T-72h window exposes hours and flags the final stretch", () => {
    const t = preReleaseTimeline({ anticipatedReleaseDate: plus(2) }, today);
    expect(t.inWarmHandoffWindow).toBe(true);
    expect(t.hoursUntilRelease).toBe(48);
  });

  it("milestone dates are T-90 / T-60 / T-3 relative to the real release date", () => {
    const t = preReleaseTimeline({ anticipatedReleaseDate: plus(100) }, today);
    expect(t.milestones.map((m) => m.date)).toEqual([plus(10), plus(40), plus(97), plus(100)]);
    expect(t.milestones.every((m) => m.state === "upcoming")).toBe(true);
  });

  it("marks earlier windows passed once the final stretch is reached", () => {
    const t = preReleaseTimeline({ anticipatedReleaseDate: plus(1) }, today);
    expect(t.milestones.map((m) => m.state)).toEqual(["passed", "passed", "active", "upcoming"]);
  });

  it("a missed-handoff episode is a catch-up lane, not a countdown", () => {
    const t = preReleaseTimeline({ anticipatedReleaseDate: plus(-2), missedHandoff: true }, today);
    expect(t.phase).toBe("catch_up");
    expect(t.daysUntilRelease).toBeNull();
    expect(t.inWarmHandoffWindow).toBe(false);
  });
});
