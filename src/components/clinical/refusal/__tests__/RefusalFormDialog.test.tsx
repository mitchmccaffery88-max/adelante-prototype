// @vitest-environment jsdom
//
// UI coverage for the Refusal legal document. SignaturePad is stubbed: jsdom
// has no canvas, and the stroke-validation logic itself is unit-tested in
// src/lib/__tests__/refusal.test.ts.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/components/clinical/refusal/SignaturePad", () => ({
  SignaturePad: ({
    label,
    onChange,
  }: {
    label: string;
    onChange: (v: string | undefined) => void;
  }) => (
    <button type="button" onClick={() => onChange("data:image/png;base64,AAAA")}>
      {`sign:${label}`}
    </button>
  ),
}));

const { RefusalFormDialog } = await import("@/components/clinical/refusal/RefusalFormDialog");
const { AdelanteEHR } = await import("@/lib/ehr");
const { deriveMarDay } = await import("@/lib/mar");
const { facilityDateKey } = await import("@/lib/facilityTime");
const { CAPACITY_BANNER_TEXT, GUARDIAN_NOTE_TEXT } = await import("@/lib/refusal");

afterEach(cleanup);

const NURSE = "N. Ramirez";

function refusedForm(patientIndex = 0) {
  const pid = AdelanteEHR.listPatients()[patientIndex].id;
  const draft = AdelanteEHR.addDraftOrder(pid, {
    drugName: "sertraline 50 MG Oral Tablet",
    frequencyCode: "BID",
    createdBy: NURSE,
  } as never);
  AdelanteEHR.signOrders(pid, [draft.id], NURSE);
  const slot = deriveMarDay(AdelanteEHR.getPatient(pid)!, facilityDateKey(new Date(), undefined))
    .slots.find((s) => s.order.id === draft.id)!;
  const admin = AdelanteEHR.chartDose(
    pid,
    draft.id,
    slot.scheduledAt,
    "refused",
    "Patient declined",
    NURSE,
    `b_${Math.random().toString(36).slice(2)}`,
    "late in test",
  );
  return { pid, form: AdelanteEHR.createRefusalFormShell(pid, admin.id, NURSE) };
}

const renderForm = (pid: string, form: Parameters<typeof RefusalFormDialog>[0]["form"]) =>
  render(
    <RefusalFormDialog
      patientId={pid}
      form={form}
      staffName={NURSE}
      onClose={() => {}}
      onFinalized={() => {}}
    />,
  );

describe("RefusalFormDialog", () => {
  it("blocks finalize until attestation, patient branch, and nurse signature are complete", async () => {
    const u = userEvent.setup();
    const { pid, form } = refusedForm();
    renderForm(pid, form);

    const finalize = screen.getByRole("button", { name: /finalize refusal document/i });
    expect((finalize as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByLabelText("Refusal form blockers").textContent).toContain(
      "Nurse attestation is required.",
    );

    await u.click(screen.getByLabelText("Nurse risk attestation"));
    await u.click(screen.getByRole("button", { name: "patient signed" }));
    await u.click(screen.getByRole("button", { name: "sign:Patient signature" }));
    expect((finalize as HTMLButtonElement).disabled).toBe(true); // nurse signature still missing
    await u.click(screen.getByRole("button", { name: `sign:Nurse signature (${NURSE})` }));
    expect((finalize as HTMLButtonElement).disabled).toBe(false);
  });

  it("requires a witness when a patient with no capacity flag declines to sign", async () => {
    const u = userEvent.setup();
    const { pid, form } = refusedForm();
    renderForm(pid, form);

    await u.click(screen.getByLabelText("Nurse risk attestation"));
    await u.click(screen.getByRole("button", { name: `sign:Nurse signature (${NURSE})` }));
    await u.click(screen.getByRole("button", { name: "patient declined" }));

    expect(screen.getByLabelText("Refusal witness")).toBeTruthy();
    expect(screen.getByLabelText("Refusal form blockers").textContent).toContain(
      "A witness is required when the patient declines to sign.",
    );
  });

  it("shows the capacity banner and drops the witness requirement when flagged", async () => {
    const u = userEvent.setup();
    const { pid, form } = refusedForm();
    const flagged = { ...form, capacityFlagsAtSigning: ["Decision-making capacity concern"] };
    renderForm(pid, flagged);

    expect(screen.getByText(CAPACITY_BANNER_TEXT)).toBeTruthy();
    await u.click(screen.getByLabelText("Nurse risk attestation"));
    await u.click(screen.getByRole("button", { name: `sign:Nurse signature (${NURSE})` }));
    await u.click(screen.getByRole("button", { name: "patient declined" }));
    expect(screen.queryByLabelText("Refusal witness")).toBeNull();
  });

  it("shows the guardian note for a patient under 18", () => {
    const { pid, form } = refusedForm();
    renderForm(pid, { ...form, guardianRequired: true });
    expect(screen.getByText(GUARDIAN_NOTE_TEXT)).toBeTruthy();
  });

  it("shows the interpreter section only for a non-English form", () => {
    const { pid, form } = refusedForm();
    const { unmount } = renderForm(pid, form);
    expect(screen.queryByLabelText("Interpreter method")).toBeNull();
    unmount();
    renderForm(pid, { ...form, languageCode: "es" });
    expect(screen.getByLabelText("Interpreter method")).toBeTruthy();
  });

  // A non-English language with no translated catalog resolves to the reviewed
  // English wording: interpreter section still appears, but nothing may present
  // the text as an unapproved draft.
  it("falls back to reviewed English with no draft banner when no catalog exists", () => {
    const { pid, form } = refusedForm();
    renderForm(pid, {
      ...form,
      languageCode: "vi", // no Vietnamese catalog
      riskTextSnapshotEn: form.riskTextSnapshot,
      riskTextReviewed: true,
      riskTextSnapshotEnLocked: true,
    });

    expect(screen.getByLabelText("Interpreter method")).toBeTruthy();
    expect(screen.getByText(/No reviewed translation exists for this language/i)).toBeTruthy();
    // No draft banner, no draft version label, no separate English disclosure.
    expect(screen.queryByText(/Draft translation/i)).toBeNull();
    expect(screen.queryByText(/es-v1-draft/i)).toBeNull();
    expect(screen.queryByText(/English wording \(locked reference copy\)/i)).toBeNull();
    expect(screen.queryByText(/Reviewed English wording/i)).toBeNull();
  });
});
