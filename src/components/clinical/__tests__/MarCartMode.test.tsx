// @vitest-environment jsdom
//
// §MAR cart/keyboard mode — the whole point of the cart is that it is a VIEW,
// not a second charting path. This charts the same dose both ways and compares
// the resulting DoseAdministration records field by field.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MarTab } from "@/components/clinical/MarTab";
import { AdelanteEHR, type DoseAdministration } from "@/lib/ehr";

afterEach(cleanup);

const NURSE_FREE = ["id", "batchId", "chartedAt", "orderId", "scheduledAt", "patientId"];

function signedOrderOn(index: number) {
  const pid = AdelanteEHR.listPatients()[index].id;
  const draft = AdelanteEHR.addDraftOrder(pid, {
    drugName: "sertraline 50 MG Oral Tablet",
    frequencyCode: "BID",
    createdBy: "N. Ramirez",
  } as never);
  AdelanteEHR.signOrders(pid, [draft.id], "N. Ramirez");
  return { pid, orderId: draft.id };
}

const chartedFor = (pid: string, orderId: string): DoseAdministration[] =>
  (AdelanteEHR.getPatient(pid)!.administrations ?? []).filter((a) => a.orderId === orderId);

const shape = (a: DoseAdministration) =>
  Object.fromEntries(Object.entries(a).filter(([k]) => !NURSE_FREE.includes(k)));

describe("cart mode charts identically to the grid", () => {
  it("produces the same administration record from the keyboard as from the grid", () => {
    // --- Grid: click Given, attest, commit.
    const grid = signedOrderOn(0);
    const { unmount } = render(<MarTab patientId={grid.pid} />);
    fireEvent.click(screen.getAllByLabelText(/^given sertraline/i)[0]);
    fireEvent.click(screen.getByLabelText("MAR attestation"));
    fireEvent.click(screen.getByText(/^Chart 1 dose$/));
    const gridRows = chartedFor(grid.pid, grid.orderId);
    expect(gridRows).toHaveLength(1);
    unmount();
    cleanup();

    // --- Cart: switch view, press G, attest, press Enter.
    const cart = signedOrderOn(1);
    render(<MarTab patientId={cart.pid} />);
    fireEvent.click(screen.getByLabelText("Cart view"));
    expect(screen.getByText(/of \d+$/)).toBeDefined();
    fireEvent.keyDown(window, { key: "g" });
    fireEvent.click(screen.getByLabelText("MAR attestation"));
    fireEvent.keyDown(window, { key: "Enter" });
    const cartRows = chartedFor(cart.pid, cart.orderId);
    expect(cartRows).toHaveLength(1);

    expect(shape(cartRows[0])).toEqual(shape(gridRows[0]));
    expect(cartRows[0].action).toBe("given");
    expect(cartRows[0].chartedBy).toBe(gridRows[0].chartedBy);
  });

  it("ignores shortcuts while the nurse is typing a reason", () => {
    const { pid } = signedOrderOn(0);
    render(<MarTab patientId={pid} />);
    fireEvent.click(screen.getByLabelText("Cart view"));
    fireEvent.keyDown(window, { key: "r" });
    const reason = screen.getAllByLabelText(/Reason for refused dose/i)[0];
    fireEvent.keyDown(reason, { key: "g" });
    // Still refused — the "g" was typing, not a shortcut.
    expect(screen.getAllByLabelText(/Reason for refused dose/i).length).toBeGreaterThan(0);
  });

  it("does not commit while the attestation is unchecked", () => {
    const { pid, orderId } = signedOrderOn(2);
    render(<MarTab patientId={pid} />);
    fireEvent.click(screen.getByLabelText("Cart view"));
    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(chartedFor(pid, orderId)).toHaveLength(0);
  });
});
