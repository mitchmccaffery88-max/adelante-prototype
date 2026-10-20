// @vitest-environment jsdom
// Phase 9a-2 — converted tiles show the same numbers as the rollback selectors.
// (1) Every selector module feeding a converted tile is byte-identical to the
// rollback commit, so the selector output cannot have moved. (2) Each
// converted tile renders exactly the selector's number when it is publishable.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { CalAimSection } from "@/components/dashboards/CalAimSection";
import { GroupUtilizationSection } from "@/components/dashboards/GroupUtilizationSection";
import { CatalogResolutionMetricsCard } from "@/components/admin/CatalogResolutionMetricsCard";
import { AdelanteEHR } from "@/lib/ehr";

const ROLLBACK = "2c463a96f657306af2a3dc4fcf72eb9b39d84cad";
const SELECTORS = [
  "src/lib/calaim.ts",
  "src/lib/groupMetrics.ts",
  "src/lib/engagementReporting.ts",
  "src/lib/populationHealth.ts",
  "src/lib/timelyAccess.ts",
  "src/lib/referralFunnel.ts",
  "src/lib/sdohReporting.ts",
  "src/lib/apptRequestStatus.ts",
  "src/lib/calomsReporting.ts",
  "src/lib/asamReporting.ts",
  "src/lib/dashboardMetrics.ts",
  "src/lib/ehr.ts",
];

afterEach(cleanup);

describe("9a-2 selector parity with rollback", () => {
  it.each(SELECTORS)("%s is unchanged since rollback", (path) => {
    const old = execFileSync("git", ["show", `${ROLLBACK}:${path}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    expect(readFileSync(path, "utf8")).toBe(old);
  });
});

describe("9a-2 converted tiles render the selector number", () => {
  it("CalAIM tiles", () => {
    const { container } = render(
      <CalAimSection codeCount={4} caseloadCount={23} dischargeCount={12} canManage={false} onOpenCaseload={() => {}} onOpenDischarges={() => {}} />,
    );
    expect(within(container.querySelector("[data-tile='calaim-codes']") as HTMLElement).getByText("4")).toBeTruthy();
    expect(within(container.querySelector("[data-tile='calaim-caseload']") as HTMLElement).getByText("23")).toBeTruthy();
    expect(within(container.querySelector("[data-tile='calaim-discharges']") as HTMLElement).getByText("12")).toBeTruthy();
  });

  it("group utilization tiles", () => {
    render(
      <GroupUtilizationSection
        activeGroups={3}
        enrolledPatients={14}
        attendance={{ present: 30, late: 2, absent: 8, denominator: 40, pct: 80 }}
        metric={{ value: 80, unit: "pct", higherIsBetter: true, basis: "32 of 40" } as never}
        onOpenAbsences={() => {}}
        openGroups={{ activeGroups: 0, enrolledPatients: 0, patientsReached: 0, attendance: { present: 0, late: 0, absent: 0, denominator: 0, pct: null } }}
      />,
    );
    expect(screen.getByTestId("group-active-count").textContent).toBe("3");
    expect(screen.getByTestId("group-enrolled-count").textContent).toBe("14");
    expect(screen.getByTestId("group-attendance-pct").textContent).toMatch(/^80/);
  });

  it("catalog metrics tiles equal catalogResolutionMetrics()", () => {
    const m = AdelanteEHR.catalogResolutionMetrics();
    render(<CatalogResolutionMetricsCard />);
    const tiles = document.querySelectorAll("[data-stat-tile]");
    expect(tiles.length).toBe(2);
    expect(within(tiles[0] as HTMLElement).getByText(String(m.dailymedAttempted))).toBeTruthy();
    expect(within(tiles[1] as HTMLElement).getByText(String(m.manualDoseOrders))).toBeTruthy();
  });
});
