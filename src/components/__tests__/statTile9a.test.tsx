// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { StatTile, type StatTileProps } from "@/components/ui/stat-tile";
import { StaffDensityProvider } from "@/components/StaffDensity";
import { chartStatus } from "@/lib/chartTheme";

afterEach(cleanup);
describe("Phase 9a StatTile boundaries", () => {
  it.each([0, 10])("suppresses aggregate %s below 11", (value) => {
    render(<StatTile label="Count" value={value} numberTestId="number" />);
    expect(screen.getByTestId("number").textContent).toBe("<11");
    expect(screen.getByRole("button", { name: "Hidden to protect privacy (fewer than 11)" })).toBeTruthy();
  });
  it("shows an aggregate of exactly 11", () => {
    render(<StatTile label="Count" value={11} numberTestId="number" />);
    expect(screen.getByTestId("number").textContent).toBe("11");
  });
  it("personal work is explicitly exempt, including a measured zero", () => {
    render(<StatTile label="My work" value={0} personal numberTestId="number" />);
    expect(screen.getByTestId("number").textContent).toBe("0");
    expect(screen.queryByRole("button", { name: /Hidden to protect/ })).toBeNull();
  });
  it("suppresses a rate with an explicitly small cohort and its provenance/history", () => {
    render(<StatTile label="Rate" value={91} unit="percent" cohortSize={10} basis="9 of 10" sparkline={{ points: [{ period: "week", value: 91 }], caption: "last 12 weeks" }} numberTestId="number" />);
    expect(screen.getByTestId("number").textContent).toBe("<11");
    expect(screen.queryByText("9 of 10")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });
  it.each([null, NaN])("missing data is neither zero nor dash (%s)", (value) => {
    render(<StatTile label="Rate" value={value} numberTestId="number" />);
    expect(screen.getByTestId("number").textContent).toBe("No live metric yet");
  });
  it.each(["good", "warning", "serious", "critical"] as const)("%s retains chartStatus icon and word", (status) => {
    const { container } = render(<StatTile label="Rate" value={95} unit="percent" status={status} />);
    expect(screen.getByText(chartStatus(status).word)).toBeTruthy();
    expect(container.querySelector(`[data-chart-status='${status}'] svg`)).toBeTruthy();
  });
  it("staff shells opt into colors, member previews refuse them even nested in staff", () => {
    const { container } = render(<StaffDensityProvider>
      <StatTile label="Staff" value={95} unit="percent" status="good" />
      <div className="member-comfortable"><StatTile label="Member" value={95} unit="percent" status="good" /></div>
    </StaffDensityProvider>);
    expect(container.querySelectorAll('[data-status-color="staff"]')).toHaveLength(1);
    expect(container.querySelector('.member-comfortable [data-status-color="neutral"]')).toBeTruthy();
    expect(container.querySelector('.member-comfortable [class*="text-chart-"]')).toBeNull();
  });
  it("API excludes patient-name properties and does not forward unknown props", () => {
    type HasName = "patientName" extends keyof StatTileProps ? true : false;
    const hasName: HasName = false;
    expect(hasName).toBe(false);
    const extra = { patientName: "PRIVATE-NAME" };
    const { container } = render(<StatTile label="Count" value={11} {...extra} />);
    expect(container.innerHTML).not.toContain("PRIVATE-NAME");
  });
});