// @vitest-environment jsdom
// QA fix — a refused confirmed action shows the store's own reason.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConfirmDialog } from "@/components/staff/confirm-dialog";
afterEach(cleanup);
const host = (err: unknown) => render(<ConfirmDialog open onOpenChange={() => {}} title="Delete this frequency?" description="d" confirmLabel="Delete frequency" keepLabel="Keep frequency" onConfirm={() => { throw err; }} />);

describe("ConfirmDialog refusal reason", () => {
  it("shows the thrown reason", async () => {
    host(new Error("BID is in use by 2 signed or held orders and cannot be deleted."));
    fireEvent.click(screen.getByRole("button", { name: "Delete frequency" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("is in use by 2"));
  });
  it("falls back to the generic line when there is no message", async () => {
    host(new Error(""));
    fireEvent.click(screen.getByRole("button", { name: "Delete frequency" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("The change was not completed"));
  });
});
