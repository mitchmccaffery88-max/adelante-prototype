// §Advocate Access Redesign — Phase 4, step 1: referral data-model foundation.
//
// Four real properties: the referral vocabulary IS the directory vocabulary,
// an internal link is optional and never required, provenance is recorded,
// and an org going away does not damage the referral record.
import { beforeEach, describe, expect, it } from "vitest";
import { AdelanteEHR, type ResourceReferralCategory } from "@/lib/ehr";
import {
  RESOURCE_CATEGORIES,
  __resetResources,
  listResources,
  patientVisibleResource,
  patientVisibleResources,
} from "@/lib/communityResources";
import { retireContent } from "@/lib/contentPublishing";
import { isResourceLinkActive, referralProviderLabel, resourceLinkState } from "@/lib/referralLinks";

const MANAGER = { staffId: "s-cc2", name: "Cathy", role: "clinical_coordinator" as const };

function patient() {
  return AdelanteEHR.createPatient({ firstName: "Referral", lastName: "Model" }).id;
}
function referrals(id: string) {
  return AdelanteEHR.getPatient(id)?.resourceReferrals ?? [];
}

beforeEach(() => __resetResources());

describe("referral categories match the real directory", () => {
  it("every one of the 14 real category ids is a valid referral category", () => {
    const id = patient();
    expect(RESOURCE_CATEGORIES).toHaveLength(14);
    for (const c of RESOURCE_CATEGORIES) {
      AdelanteEHR.addResourceReferral(id, {
        category: c.id as ResourceReferralCategory,
        provider: `Some org for ${c.name}`,
      });
    }
    expect(referrals(id).map((r) => r.category).sort()).toEqual(
      RESOURCE_CATEGORIES.map((c) => c.id).sort(),
    );
  });

  it("uses the directory's real slugs, not invented ones", () => {
    const ids = RESOURCE_CATEGORIES.map((c) => c.id);
    expect(ids).toContain("transportation");
    expect(ids).toContain("financial");
    expect(ids).not.toContain("transport");
    expect(ids).not.toContain("benefits");
  });
});

describe("resourceId links referrals to real orgs, optionally", () => {
  it("stays undefined for an external referral and the free text is the record", () => {
    const id = patient();
    AdelanteEHR.addResourceReferral(id, {
      category: "housing",
      provider: "Kern County shelter (out of area)",
    });
    const r = referrals(id)[0]!;
    expect(r.resourceId).toBeUndefined();
    expect(resourceLinkState(r)).toEqual({
      kind: "external",
      provider: "Kern County shelter (out of area)",
    });
    expect(referralProviderLabel(r)).toBe("Kern County shelter (out of area)");
  });

  it("resolves to a live directory listing when set", () => {
    const org = patientVisibleResources()[0]!;
    const id = patient();
    AdelanteEHR.addResourceReferral(id, {
      category: org.categoryId as ResourceReferralCategory,
      provider: org.name,
      resourceId: org.id,
    });
    const r = referrals(id)[0]!;
    expect(isResourceLinkActive(r)).toBe(true);
    expect(referralProviderLabel(r)).toBe(org.name);
  });
});

describe("referral provenance", () => {
  it("defaults to internal and accepts the real pre-release value", () => {
    const id = patient();
    AdelanteEHR.addResourceReferral(id, { category: "food", provider: "FoodLink" });
    AdelanteEHR.addResourceReferral(id, {
      category: "food",
      provider: "Facility-listed pantry",
      source: "pre_release",
    });
    const sources = referrals(id).map((r) => r.source);
    expect(sources).toContain("internal");
    expect(sources).toContain("pre_release");
  });
});

describe("referential integrity when an org leaves the directory", () => {
  it("flags the link inactive but keeps the referral record intact", () => {
    const org = patientVisibleResources()[0]!;
    const id = patient();
    AdelanteEHR.addResourceReferral(id, {
      category: org.categoryId as ResourceReferralCategory,
      provider: org.name,
      resourceId: org.id,
      note: "Warm handoff booked.",
    });

    const res = retireContent({
      typeId: "community_resource",
      id: org.id,
      actor: MANAGER,
      note: "Organisation closed.",
    });
    expect(res.ok).toBe(true);
    expect(patientVisibleResource(org.id)).toBeUndefined();

    const r = referrals(id)[0]!;
    expect(r.resourceId).toBe(org.id); // never cleared — this is history
    expect(r.note).toBe("Warm handoff booked.");
    expect(isResourceLinkActive(r)).toBe(false);
    expect(resourceLinkState(r).kind).toBe("inactive");
    expect(referralProviderLabel(r)).toBe(org.name);
  });

  it("degrades to the free-text record when the org id is gone entirely", () => {
    const id = patient();
    AdelanteEHR.addResourceReferral(id, {
      category: "legal",
      provider: "Former legal aid office",
      resourceId: "res_no_longer_exists",
    });
    const r = referrals(id)[0]!;
    expect(resourceLinkState(r).kind).toBe("missing");
    expect(referralProviderLabel(r)).toBe("Former legal aid office");
  });
});

describe("directory hygiene", () => {
  it("has no duplicate orgs within a category", () => {
    const seen = new Set<string>();
    for (const r of listResources()) {
      const key = `${r.categoryId}|${r.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    // The two ported duplicates (CSET Employment Training, California EDD) are gone.
    expect(listResources().map((r) => r.id)).not.toContain("res_cset_employment");
    expect(listResources().map((r) => r.id)).not.toContain("res_edd_california");
    expect(listResources("employment").filter((r) => /edd/i.test(r.name))).toHaveLength(1);
    expect(listResources("employment").filter((r) => /cset/i.test(r.name))).toHaveLength(1);
  });
});
