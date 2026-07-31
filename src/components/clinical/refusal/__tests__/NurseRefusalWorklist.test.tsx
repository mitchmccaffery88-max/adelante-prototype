// @vitest-environment jsdom
//
// The cross-patient worklist is the second entry point into the refusal legal
// document (the MAR tab list is the first). These cover the feed itself and the
// read-only RBAC treatment; the signing flow is covered in RefusalFormDialog.test.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/components/clinical/refusal/RefusalFormDialog", () => ({
  RefusalFormDialog: () => <div>refusal-dialog</div>,
}));
vi.mock("@/components/clinical/refusal/RefusalEscalationDialog", () => ({
  RefusalEscalationDialog: () => <div>escalation-dialog</div>,
}));

const { NurseRefusalWorklist } = await import(
  "@/components/clinical/refusal/NurseRefusalWorklist"
);
const { AdelanteEHR } = await import("@/lib/ehr");

afterEach(cleanup);

describe("NurseRefusalWorklist", () => {
  it("lists pending refusal forms across patients", () => {
    const pending = AdelanteEHR.listPendingRefusalForms();
    render(<NurseRefusalWorklist staffName="Nurse Tester" />);
    expect(screen.getByText("Refusal documents to sign")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Open & sign/i }).length).toBe(pending.length);
  });

  it("disables signing for read-only roles", () => {
    render(<NurseRefusalWorklist staffName="Nurse Tester" readOnly />);
    for (const btn of screen.getAllByRole("button", { name: /Open & sign/i })) {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    }
  });
});
