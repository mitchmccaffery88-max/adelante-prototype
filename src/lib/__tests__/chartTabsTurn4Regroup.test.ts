import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { CHART_TABS, IN_FACILITY_SECTIONS, SECTION_TO_TAB, resolveChartLocation } from "@/lib/chartTabs";
import { SECTION_ALIASES } from "@/lib/chartSectionAliases";

const src = readFileSync("src/components/clinical/recordSections.tsx", "utf8");
const sectionIds = [...src.matchAll(/\{\s*id:\s*"([a-z-]+)"/g)].map((m) => m[1]!);

describe("chart tab regroup", () => {
  it("every section id and old alias maps to a tab", () => {
    for (const id of sectionIds) {
      if (IN_FACILITY_SECTIONS.includes(id)) continue;
      expect(SECTION_TO_TAB[id], id).toBeDefined();
    }
    for (const old of Object.keys(SECTION_ALIASES)) expect(resolveChartLocation(old).tab).toBeDefined();
  });
  it("places sections in the requested tabs", () => {
    expect(SECTION_TO_TAB["safety-plan"]).toBe("notes-docs");
    expect(SECTION_TO_TAB["coord"]).toBe("schedule");
    expect(SECTION_TO_TAB["checkins"]).toBe("tasks-contacts");
    expect(SECTION_TO_TAB["outside-records"]).toBe("record");
    expect(resolveChartLocation("asam")).toEqual({ tab: "measures", sub: "asam" });
    expect(CHART_TABS).toHaveLength(8);
  });
});
