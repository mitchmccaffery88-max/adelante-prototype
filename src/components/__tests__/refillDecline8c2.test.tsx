// @vitest-environment jsdom
// §8c-2 — refill decline goes through the shared ConfirmDialog: one registry
// action entry on confirm, nothing on cancel, reason required.
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AdelanteEHR } from "@/lib/ehr";
import { setActingRole } from "@/lib/roles";
import { RefillDecisionPanel } from "@/components/chart/AdelDrafts";

afterEach(cleanup);
const actionEvents = () => AdelanteEHR.listAuditEvents({ category: "action" });

let patientId = "";
let refillId = "";
beforeAll(() => {
  setActingRole("physician");
  for (const p of AdelanteEHR.listPatients()) {
    const med = AdelanteEHR.listMedications(p.id)[0];
    if (!med) continue;
    const r = AdelanteEHR.requestRefill({ patientId: p.id, medicationId: med.id, requestedBy: "patient" });
    const { unmount } = render(<RefillDecisionPanel patientId={p.id} />);
    const shown = screen.queryAllByTestId("adel-refill-card").length > 0;
    unmount();
    if (shown && r) { patientId = p.id; refillId = r.id; break; }
  }
});

function openDecline() {
  render(<RefillDecisionPanel patientId={patientId} />);
  const card = screen.getAllByTestId("adel-refill-card")[0]!;
  fireEvent.click(within(card).getByRole("button", { name: "Deny" }));
  return screen.getByRole("alertdialog");
}
const status = () => AdelanteEHR.listRefillRequests({ patientId }).find((r) => r.id === refillId)?.status;

describe("refill decline confirmation", () => {
  it("found a refill a physician can decide", () => expect(refillId).not.toBe(""));

  it("focuses Keep pending first and writes nothing on cancel", () => {
    const before = actionEvents().length;
    const dialog = openDecline();
    expect(within(dialog).getByText("Decline this refill?")).toBeTruthy();
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Keep pending" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep pending" }));
    expect(actionEvents().length).toBe(before);
  });

  it("requires a reason, then writes exactly one action entry", async () => {
    const before = actionEvents().length;
    const dialog = openDecline();
    fireEvent.click(within(dialog).getByRole("button", { name: "Decline refill" }));
    expect(actionEvents().length).toBe(before);
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Needs a visit first" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Decline refill" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    const added = actionEvents().slice(0, actionEvents().length - before);
    expect(added).toHaveLength(1);
    expect(JSON.stringify(added[0])).toContain("refill_decision");
    if (status()) expect(status()).toBe("denied");
  });
});
