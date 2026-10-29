// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ClientRecordDrawer } from "../ClientRecordDrawer";
import { AdelanteEHR } from "@/lib/ehr";

vi.mock("@/components/chart/ChartAccessGate", () => ({ ChartAccessGate: () => null }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("quick peek pre-data boundary", () => {
  it("does not read the patient or clinical sections before the shared gate mounts its children", () => {
    const read = vi.spyOn(AdelanteEHR, "getPatient");
    render(<ClientRecordDrawer patientId="not-authorized" open onOpenChange={() => {}} />);
    expect(read).not.toHaveBeenCalled();
  });
  it("does not read a selected patient while the drawer is closed", () => {
    const read = vi.spyOn(AdelanteEHR, "getPatient");
    render(<ClientRecordDrawer patientId="not-authorized" open={false} onOpenChange={() => {}} />);
    expect(read).not.toHaveBeenCalled();
  });
});