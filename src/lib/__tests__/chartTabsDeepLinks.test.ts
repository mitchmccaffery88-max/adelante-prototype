import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CHART_TABS, IN_FACILITY_SECTIONS, resolveChartLocation, tabBadges } from "@/lib/chartTabs";
import { SECTION_ALIASES } from "@/lib/chartSectionAliases";
import { AdelanteEHR } from "@/lib/ehr";

// Every section id the chart has ever used, read from the sections file so a
// new section can't be added without a tab.
const src = readFileSync("src/components/clinical/recordSections.tsx", "utf8");
const ids = [...src.matchAll(/^\s+id: "([a-z-]+)",/gm)].map((m) => m[1]!);

describe("chart tab deep links", () => {
  it("reads the full old section list", () => {
    expect(ids.length).toBeGreaterThanOrEqual(30);
  });
  it.each(ids.filter((id) => !IN_FACILITY_SECTIONS.includes(id)))("?section=%s maps to a tab and sub-section", (id) => {
    const loc = resolveChartLocation(id);
    expect(loc.sub).toBe(id);
    expect(CHART_TABS.find((t) => t.id === loc.tab)!.sections).toContain(id);
  });
  it.each(Object.keys(SECTION_ALIASES))("old merged id %s still lands on its section", (old) => {
    const loc = resolveChartLocation(old);
    expect(loc.sub).toBe(SECTION_ALIASES[old]);
  });
  it("examples", () => {
    expect(resolveChartLocation("asam")).toEqual({ tab: "measures", sub: "asam" });
    expect(resolveChartLocation("orders").tab).toBe("medications");
    expect(resolveChartLocation("advocates").tab).toBe("record");
    expect(resolveChartLocation(undefined).tab).toBe("brief");
    expect(resolveChartLocation("medications")).toEqual({ tab: "medications" });
    expect(resolveChartLocation("nonsense").tab).toBe("brief");
  });
  it("in-facility sections never become tabs while the flag is off", () => {
    for (const id of ["bookings", "housing-moves"]) expect(resolveChartLocation(id).tab).toBe("brief");
    expect(CHART_TABS.flatMap((t) => t.sections)).not.toContain("bookings");
  });
  it("badges are actionable counts only, and billing gets none", () => {
    const p = AdelanteEHR.getPatient("p1")!;
    expect(tabBadges(p, "billing")).toEqual({});
  });
});
