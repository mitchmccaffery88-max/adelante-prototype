// @vitest-environment jsdom
// B2-5 (Mitch review) — the revoke dialog's method select is live and the
// confirm callback receives the value chosen, not the value at ask() time.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { useConfirmDialog } from "@/components/staff/use-confirm-dialog";
import { RevokeMethodField } from "@/components/consent/ConsentCapturePanel";
import type { RevokeMethod } from "@/lib/consentLifecycle";
afterEach(cleanup);

function Host({ sent }: { sent: RevokeMethod[] }) {
  const method = useRef<RevokeMethod>("written");
  const confirm = useConfirmDialog();
  useEffect(() => {
    confirm.ask({ title: "Revoke", description: "d", confirmLabel: "Revoke consent", keepLabel: "Keep it",
      children: <RevokeMethodField initial="written" onChange={(m) => { method.current = m; }} />,
      onConfirm: () => { sent.push(method.current); return true; } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return confirm.dialog;
}

describe("revoke method select", () => {
  for (const m of ["written", "e_sign", "oral"] as RevokeMethod[]) {
    it(`sends "${m}" when chosen`, async () => {
      const sent: RevokeMethod[] = [];
      render(<Host sent={sent} />);
      const select = (await screen.findByLabelText("Revocation method")) as HTMLSelectElement;
      fireEvent.change(select, { target: { value: m } });
      expect(select.value).toBe(m);
      fireEvent.click(screen.getByRole("button", { name: "Revoke consent" }));
      await waitFor(() => expect(sent).toEqual([m]));
    });
  }
});
