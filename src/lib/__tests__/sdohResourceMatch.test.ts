import { describe, expect, it } from "vitest";
import {
  INTAKE_KEY_CATEGORIES,
  NEED_KEYWORD_RULES,
  PART2_CAUTION_CATEGORY_IDS,
  matchResourcesForNeed,
  unknownCategoryIds,
} from "@/lib/sdohResourceMatch";
import { INTAKE_NEED_LABEL } from "@/lib/sdohMapping";
import { RESOURCE_CATEGORIES } from "@/lib/communityResources";
import type { SdohPlanItem } from "@/lib/ehr";

function item(need: string): SdohPlanItem {
  return {
    id: "i1",
    need,
    source: "intake_self_report",
    status: "identified",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("sdohResourceMatch", () => {
  it("only names real directory categories", () => {
    expect(unknownCategoryIds()).toEqual([]);
    expect(RESOURCE_CATEGORIES).toHaveLength(14);
  });

  it("maps every intake need label to real categories with named orgs allowed", () => {
    for (const [key, cats] of Object.entries(INTAKE_KEY_CATEGORIES)) {
      const m = matchResourcesForNeed(
        item(INTAKE_NEED_LABEL[key as keyof typeof INTAKE_NEED_LABEL]),
      );
      expect(m).not.toBeNull();
      expect(m!.categoryIds).toEqual(expect.arrayContaining(cats));
      expect(m!.showOrgs).toBe(true);
    }
  });

  it("maps the HRSN housing domain label, not just the intake label", () => {
    const m = matchResourcesForNeed(item("Housing instability & quality"));
    expect(m?.categoryIds).toContain("housing");
  });

  it("routes utility needs to financial assistance", () => {
    expect(matchResourcesForNeed(item("Utility needs"))?.categoryIds).toEqual(["financial"]);
  });

  it("never names an organisation for a recovery/SUD-adjacent need", () => {
    const m = matchResourcesForNeed(item("Wants a recovery meeting nearby"));
    expect(m?.showOrgs).toBe(false);
    expect(m?.reason).toBeTruthy();
    expect(m?.categoryIds.some((c) => PART2_CAUTION_CATEGORY_IDS.includes(c))).toBe(true);
  });

  it("never names an organisation for an interpersonal safety need", () => {
    const m = matchResourcesForNeed(item("Interpersonal safety"));
    expect(m?.showOrgs).toBe(false);
  });

  it("returns null rather than guessing for an unmatched need", () => {
    expect(matchResourcesForNeed(item("Needs a haircut before court"))).not.toBeNull();
    expect(matchResourcesForNeed(item("Zzzz unrelated placeholder"))).toBeNull();
  });

  it("keeps every keyword rule pointing at at least one category", () => {
    for (const rule of NEED_KEYWORD_RULES) expect(rule.categoryIds.length).toBeGreaterThan(0);
  });
});
