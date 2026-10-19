import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { seriesColorFor, seriesColors, chartStatus, OTHER_COLOR, chartDefaults, TARGET_LABEL } from "@/lib/chartTheme";
import { ChartFrame } from "@/components/ui/chart-frame";

const css = readFileSync("src/styles.css", "utf8");
const block = (sel: string) => { const i = css.indexOf(`${sel} {`); return css.slice(i, css.indexOf("\n}", i)); };
const LIGHT: Record<string, string> = { "chart-1": "#2A78D6", "chart-2": "#EB6834", "chart-3": "#1BAF7A", "chart-4": "#EDA100", "chart-5": "#E87BA4", "chart-6": "#008300", "chart-7": "#6250D6", "chart-8": "#E34948", "chart-other": "#8A9699", "chart-grid": "#E3E8E8", "chart-axis": "#C3CBCB", "chart-div-mid": "#EEF1F1", "chart-good": "#0CA30C", "chart-warning": "#FAB219", "chart-serious": "#EC835A", "chart-critical": "#D03B3B", "chart-seq-1": "#CDE2FB", "chart-seq-7": "#0D366B", "chart-single": "var(--path)", "chart-target": "var(--ink)" };
const DARK: Record<string, string> = { ...LIGHT, "chart-1": "#3987E5", "chart-2": "#D95926", "chart-3": "#199E70", "chart-4": "#C98500", "chart-5": "#D55181", "chart-7": "#9085E9", "chart-8": "#E66767", "chart-other": "#7D8C8C", "chart-grid": "#2C3D3C", "chart-axis": "#3F5352", "chart-div-mid": "#33403F" };

describe("Phase 9b chart tokens", () => {
  it.each([[":root", LIGHT], [".dark", DARK]] as const)("%s defines every chart token", (sel, map) => {
    const b = block(sel);
    for (const [k, v] of Object.entries(map)) expect(b).toContain(`--${k}: ${v};`);
  });
});

describe("series color by entity", () => {
  const all = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
  it("color follows the entity, not its rank under a filter", () => {
    expect(seriesColorFor("c", all)).toBe("var(--chart-3)");
    expect(seriesColors(["c", "a"], all).map((s) => s.color)).toEqual(["var(--chart-3)", "var(--chart-1)"]);
  });
  it("max 8 series, then Other", () => {
    expect(seriesColorFor("h", all)).toBe("var(--chart-8)");
    expect(seriesColorFor("i", all)).toBe(OTHER_COLOR);
    expect(seriesColorFor("zz", all)).toBe(OTHER_COLOR);
  });
});

describe("status helper", () => {
  it.each(["good", "warning", "serious", "critical"] as const)("%s always has icon and word", (s) => {
    const r = chartStatus(s, "  ");
    expect(r.icon).toBeTruthy();
    expect(r.word.length).toBeGreaterThan(0);
  });
  it("KPI words avoid red language", () => {
    expect([chartStatus("good").word, chartStatus("warning").word, chartStatus("serious").word]).toEqual(["Met", "Close", "Below target"]);
  });
  it("defaults: 2px lines, 4px bar ends, 2px gaps, one axis, draft target", () => {
    expect(chartDefaults.line.strokeWidth).toBe(2);
    expect(chartDefaults.bar.radius).toEqual([4, 4, 0, 0]);
    expect(chartDefaults.bar.barGap).toBe(2);
    expect(chartDefaults.yAxisCount).toBe(1);
    expect(TARGET_LABEL).toBe("Draft target");
    expect(chartDefaults.showLegend(1)).toBe(false);
    expect(chartDefaults.showDirectLabels(5)).toBe(false);
  });
});

describe("View as table", () => {
  it("ChartFrame renders the toggle", () => {
    const html = renderToStaticMarkup(<ChartFrame title="t" rows={[{ d: "1", v: 2 }]} columns={[{ key: "d", label: "Date" }, { key: "v", label: "Value" }]}><div /></ChartFrame>);
    expect(html).toContain("View as table");
  });
  it("every existing recharts chart is wrapped in ChartFrame", () => {
    for (const f of ["src/components/clinical/RecordTabs.tsx", "src/components/chart/LabsAndMeasures.tsx"]) {
      const s = readFileSync(f, "utf8");
      expect((s.match(/<ChartFrame/g) ?? []).length).toBe((s.match(/<LineChart/g) ?? []).length);
    }
  });
});
