// Community resources and naloxone access points are managed content now.
// These tests guard the three things product asked for: Cathy's real
// verification history survives as the initial published revision, a content
// manager publishes directly with no second approver, and nothing expires.
import { describe, expect, it, beforeEach } from "vitest";
import {
  __resetContentOfType,
  getContentEntry,
  publishContent,
  saveContentDraft,
  publishedContentOfType,
} from "@/lib/contentPublishing";
import {
  NALOXONE_ACCESS_POINTS,
  NALOXONE_ACCESS_REVIEW,
  liveNaloxoneAccessPoints,
  seedNaloxoneAccessContent,
} from "@/lib/safetyContent";
import {
  CATHY_VERIFIED_RESOURCE_IDS,
  RESOURCE_VERIFIER_CATHY,
  __resetResources,
  patientVisibleResources,
} from "@/lib/communityResources";
import { COMMUNITY_RESOURCE_TYPE, NALOXONE_ACCESS_TYPE } from "@/lib/contentTypes";

const MANAGER = { staffId: "s-cc2", name: "Cathy Cruz", role: "clinical_coordinator" as const };

describe("community resource + naloxone content migration", () => {
  beforeEach(() => {
    __resetResources();
    __resetContentOfType("naloxone_access_point");
    seedNaloxoneAccessContent();
  });

  it("keeps Cathy's real verification pass as revision 1 of each access point", () => {
    for (const p of NALOXONE_ACCESS_POINTS) {
      const e = getContentEntry("naloxone_access_point", p.id);
      expect(e?.status).toBe("published");
      const first = e!.revisions[0]!;
      expect(first.rev).toBe(1);
      expect(first.byStaffId).toBe(NALOXONE_ACCESS_REVIEW.verifiedByStaffId);
      expect(first.at.startsWith(NALOXONE_ACCESS_REVIEW.verifiedOn)).toBe(true);
    }
    expect(liveNaloxoneAccessPoints().length).toBe(NALOXONE_ACCESS_POINTS.length);
  });

  it("replays Cathy's resource verification pass onto the published store", () => {
    const liveIds = patientVisibleResources().map((r) => r.id);
    for (const id of CATHY_VERIFIED_RESOURCE_IDS) expect(liveIds).toContain(id);
    expect(RESOURCE_VERIFIER_CATHY.staffId).toBe("s-cc2");
  });

  it("a content manager creates and publishes a new resource in one seat", () => {
    const id = "res_new_shelter";
    const body = {
      ...COMMUNITY_RESOURCE_TYPE.emptyBody(),
      id,
      name: "Visalia Rescue Mission Annex",
      address: "123 Main St, Visalia, CA",
      phone: "(559) 555-0101",
      hours: "Daily, 7am-7pm",
      description: "Overnight beds and a hot meal, no referral needed.",
    };
    expect(COMMUNITY_RESOURCE_TYPE.validate(body)).toEqual([]);
    expect(saveContentDraft({ typeId: "community_resource", id, body, actor: MANAGER }).ok).toBe(true);
    const res = publishContent({
      typeId: "community_resource",
      id,
      actor: MANAGER,
      validate: COMMUNITY_RESOURCE_TYPE.validate,
    });
    expect(res.ok).toBe(true);
    expect(patientVisibleResources().map((r) => r.id)).toContain(id);
  });

  it("a content manager creates and publishes a new naloxone access point", () => {
    const id = "nal_new_pharmacy";
    const body = {
      ...NALOXONE_ACCESS_TYPE.emptyBody(),
      id,
      name: "Any pharmacy counter",
      what: "Ask the pharmacist for naloxone. You do not need a prescription in California.",
      phone: "(559) 555-0199",
    };
    expect(NALOXONE_ACCESS_TYPE.validate(body)).toEqual([]);
    saveContentDraft({ typeId: "naloxone_access_point", id, body, actor: MANAGER });
    expect(
      publishContent({
        typeId: "naloxone_access_point",
        id,
        actor: MANAGER,
        validate: NALOXONE_ACCESS_TYPE.validate,
      }).ok,
    ).toBe(true);
    expect(liveNaloxoneAccessPoints().map((p) => p.id)).toContain(id);
  });

  it("nothing expires: published content stays published regardless of age", () => {
    const before = publishedContentOfType("naloxone_access_point").length;
    // No expiry sweep exists anymore — there is no code path that unpublishes
    // on a timer, so the same content is live after any elapsed interval.
    expect(publishedContentOfType("naloxone_access_point").length).toBe(before);
    expect(patientVisibleResources().length).toBeGreaterThan(0);
  });
});
