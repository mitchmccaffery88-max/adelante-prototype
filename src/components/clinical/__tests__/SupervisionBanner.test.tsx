// §Quality pass Group A — the banner is a LIVE read, not a login snapshot.
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { SupervisionBanner } from "../SupervisionBanner";
import { assignSupervisor, setActingStaff } from "@/lib/roles";

afterEach(() => {
  cleanup();
  assignSupervisor("s-tr1", "s-th1");
  setActingStaff("s-cm1");
});

describe("SupervisionBanner", () => {
  it("hides for roles that do not require supervision", () => {
    act(() => setActingStaff("s-cm1"));
    render(<SupervisionBanner />);
    expect(screen.queryByTestId("supervision-banner")).toBeNull();
  });

  it("shows supervisor + billability, and updates when supervision is revoked", () => {
    act(() => {
      setActingStaff("s-tr1");
      assignSupervisor("s-tr1", "s-th1");
    });
    render(<SupervisionBanner />);
    expect(screen.getByTestId("supervision-banner").textContent).toMatch(/Dr. Marisol Reyes/);
    expect(screen.getByTestId("supervision-banner").textContent).toMatch(/billable/i);

    act(() => {
      assignSupervisor("s-tr1", null);
    });
    const t = screen.getByTestId("supervision-banner").textContent ?? "";
    expect(t).toMatch(/Supervision incomplete/i);
    expect(t).toMatch(/not billable/i);
  });

  it("shows the same status for a Medical Assistant", () => {
    act(() => setActingStaff("s-ma1"));
    render(<SupervisionBanner />);
    expect(screen.getByTestId("supervision-banner").textContent).toMatch(/Dr. R. Bagga/);
  });
});