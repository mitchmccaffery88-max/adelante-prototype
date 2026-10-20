// @vitest-environment jsdom
// Phase 9a-2 — aggregate counts of people below 11 show "<11"; personal work
// and non-patient counts (codes, groups, catalog events) are exempt. The
// CalAIM handoff cue is a gold "Your turn" chip, never amber.
import { describe, expect, it, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { CalAimSection } from "@/components/dashboards/CalAimSection";
import { GroupUtilizationSection } from "@/components/dashboards/GroupUtilizationSection";
import { StatTile } from "@/components/ui/stat-tile";

afterEach(cleanup);
const tile = (c: HTMLElement, id: string) => within(c.querySelector(`[data-tile='${id}']`) as HTMLElement);

describe("9a-2 small-cohort suppression", () => {
  it("CalAIM caseload and discharges below 11 are suppressed; code count is not", () => {
    const { container } = render(
      <CalAimSection codeCount={3} caseloadCount={7} dischargeCount={2} canManage={false} onOpenCaseload={() => {}} onOpenDischarges={() => {}} />,
    );
    expect(tile(container, "calaim-codes").getByText("3")).toBeTruthy();
    expect(tile(container, "calaim-caseload").getByText("<11")).toBeTruthy();
    expect(tile(container, "calaim-caseload").queryByText("7")).toBeNull();
    expect(tile(container, "calaim-discharges").getByText("<11")).toBeTruthy();
    expect(tile(container, "calaim-discharges").queryByText("2")).toBeNull();
  });

  it("CalAIM handoff uses the gold Your turn chip with a word, no amber", () => {
    const { container } = render(
      <CalAimSection codeCount={3} caseloadCount={20} dischargeCount={12} canManage={false} onOpenCaseload={() => {}} onOpenDischarges={() => {}} />,
    );
    const chip = container.querySelector("[data-status='yourturn']");
    expect(chip?.textContent).toContain("Time-sensitive handoff");
    expect(chip?.querySelector("svg")).toBeTruthy();
    expect(container.innerHTML).not.toMatch(/amber|emerald|red-\d|text-navy/);
  });

  it("group enrolled below 11 is suppressed; active group count is not", () => {
    render(
      <GroupUtilizationSection
        activeGroups={2}
        enrolledPatients={5}
        attendance={{ present: 3, late: 0, absent: 1, denominator: 4, pct: 75 }}
        metric={{ value: 75, unit: "pct", higherIsBetter: true } as never}
        onOpenAbsences={() => {}}
        openGroups={{ activeGroups: 1, enrolledPatients: 4, patientsReached: 3, attendance: { present: 3, late: 0, absent: 1, denominator: 4, pct: 75 } }}
      />,
    );
    expect(screen.getByTestId("group-active-count").textContent).toBe("2");
    expect(screen.getByTestId("group-enrolled-count").textContent).toBe("<11");
    expect(screen.getByTestId("group-attendance-pct").textContent).toBe("<11");
    expect(screen.queryByText("4")).toBeNull();
  });

  it("personal and non-patient tiles are exempt", () => {
    render(<>
      <StatTile label="Mine" value={3} personal numberTestId="p" />
      <StatTile label="Codes" value={3} nonPatient numberTestId="n" />
      <StatTile label="People" value={3} numberTestId="a" />
    </>);
    expect(screen.getByTestId("p").textContent).toBe("3");
    expect(screen.getByTestId("n").textContent).toBe("3");
    expect(screen.getByTestId("a").textContent).toBe("<11");
  });
});
