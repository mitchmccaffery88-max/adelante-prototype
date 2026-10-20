// Phase 9c-1 — chart components use the shared chartTheme tokens; no navy/teal
// hardcodes or broken hsl(var(--border)) grid syntax remain. ui/chart.tsx
// Recharts override selectors are intentionally out of scope.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { ChartFrame } from "@/components/ui/chart-frame";
import { chartDefaults, seriesColorFor, SINGLE_COLOR } from "@/lib/chartTheme";

const CHART_FILES = [
  "src/components/clinical/RecordTabs.tsx",
  "src/components/chart/LabsAndMeasures.tsx",
];

describe("9c-1 chart color mapping", () => {
  it.each(CHART_FILES)("%s has no navy/teal series hardcodes or hsl(var(--border)) grids", (file) => {
    const src = readFileSync(file, "utf8");
    expect(src).not.toContain('stroke="var(--navy)"');
    expect(src).not.toContain('stroke="var(--teal)"');
    expect(src).not.toContain("hsl(var(--border))");
    expect(src).not.toContain('fill: "var(--teal)"');
  });

  it.each(CHART_FILES)("%s uses the shared chart theme", (file) => {
    const src = readFileSync(file, "utf8");
    expect(src).toContain("@/lib/chartTheme");
    expect(src).toContain("chartDefaults.grid");
  });

  it("RecordTabs score lines use the single-series color; timepoint reference uses the axis stroke with an ink-muted label", () => {
    const src = readFileSync("src/components/clinical/RecordTabs.tsx", "utf8");
    expect(src).toContain(`stroke={SINGLE_COLOR}`);
    expect(src).toContain("stroke={chartDefaults.axis.stroke}");
    expect(src).toContain('fill: "var(--ink-muted)"');
  });

  it("LabsAndMeasures maps BMI/systolic to stable series slots 1 and 2", () => {
    const src = readFileSync("src/components/chart/LabsAndMeasures.tsx", "utf8");
    expect(src).toContain('seriesColorFor("bmi", LAB_SERIES)');
    expect(src).toContain('seriesColorFor("systolic", LAB_SERIES)');
    expect(seriesColorFor("bmi", ["bmi", "systolic"])).toBe("var(--chart-1)");
    expect(seriesColorFor("systolic", ["bmi", "systolic"])).toBe("var(--chart-2)");
    expect(SINGLE_COLOR).toBe("var(--chart-single)");
  });

  it("grid defaults carry the chart-grid token, not the border token", () => {
    expect(chartDefaults.grid.stroke).toBe("var(--chart-grid)");
    expect(chartDefaults.axis.stroke).toBe("var(--chart-axis)");
  });

  it("ChartFrame still renders after the color swap (smoke)", () => {
    const html = renderToStaticMarkup(
      <ChartFrame title="t" rows={[{ d: "1", v: 2 }]} columns={[{ key: "d", label: "Date" }, { key: "v", label: "Value" }]}><div /></ChartFrame>,
    );
    expect(html).toContain("View as table");
  });
});
