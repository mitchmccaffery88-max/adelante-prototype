// @vitest-environment jsdom
//
// Export affordance rules, exercised through the real Notes tab: draft and
// unsigned notes get no export action at all, and a SUD note masked on-screen
// stays masked (no export button, and the builder refuses to render).
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
// jsdom cannot mount the real canvas signature pad; see the stub's comment.
vi.mock("@/components/clinical/refusal/SignaturePad", () => import("@/test/signaturePadStub"));

const { AdelanteEHR } = await import("@/lib/ehr");
const { NotesTab } = await import("@/components/clinical/RecordTabs");
const { setActingRole, setActingStaff } = await import("@/lib/roles");
const { buildNoteDocumentModel } = await import("@/lib/notePdf");

afterEach(cleanup);

const patient = AdelanteEHR.listPatients()[0]!;

function addNote(over: Partial<Parameters<typeof AdelanteEHR.addProgressNote>[1]>) {
  return AdelanteEHR.addProgressNote(patient.id, {
    clinicianId: "c1",
    date: new Date().toISOString(),
    sessionType: "individual",
    subjective: "S",
    objective: "O",
    assessment: "A",
    plan: "P",
    status: "draft",
    ...over,
  } as never);
}

describe("note PDF export affordance", () => {
  it("shows no export action on draft or cosign_pending notes", () => {
    setActingStaff("s-th1");
    setActingRole("therapist");
    for (const n of AdelanteEHR.getPatient(patient.id)?.progressNotes ?? []) {
      n.status = "draft";
    }
    addNote({ status: "cosign_pending", signedBy: "Luz Herrera", cosignRequired: true });
    render(<NotesTab patientId={patient.id} />);
    expect(screen.queryAllByRole("button", { name: /Export PDF/i }).length).toBe(0);
  });

  it("shows the export action once a note is signed", () => {
    setActingStaff("s-th1");
    setActingRole("therapist");
    addNote({
      status: "signed",
      signedBy: "Marisol Reyes",
      signedAt: new Date().toISOString(),
    });
    render(<NotesTab patientId={patient.id} />);
    expect(screen.getAllByRole("button", { name: /Export PDF/i }).length).toBeGreaterThan(0);
  });

  it("hides export for a SUD-masked note and refuses to render its content", () => {
    // clinical_trainee (full note access) is consent_gated for SUD content; therapist is not.
    setActingStaff("s-cm1");
    setActingRole("clinical_trainee");
    // A fresh patient with no consent and no other (unmasked) notes — demo
    // seeds now put signed notes on the early demo patients.
    const sudPatient = AdelanteEHR.createPatient({ firstName: "Sud", lastName: "Masked" } as never);
    expect(AdelanteEHR.getConsentState(sudPatient.id).part2Sud).toBeFalsy();
    const note = AdelanteEHR.addProgressNote(sudPatient.id, {
      clinicianId: "c1",
      date: new Date().toISOString(),
      sessionType: "individual",
      subjective: "Confidential SUD content",
      objective: "",
      assessment: "",
      plan: "",
      category: "sud",
      status: "signed",
      signedBy: "Marisol Reyes",
      signedAt: new Date().toISOString(),
    } as never) as unknown as { id: string };
    render(<NotesTab patientId={sudPatient.id} />);
    expect(screen.queryByText("Confidential SUD content")).toBeNull();
    expect(screen.queryAllByRole("button", { name: /Export PDF/i }).length).toBe(0);
    const stored = (AdelanteEHR.getPatient(sudPatient.id)?.progressNotes ?? []).find(
      (n) => n.category === "sud",
    )!;
    expect(() =>
      buildNoteDocumentModel({ note: stored, patient: sudPatient, role: "clinical_trainee" }),
    ).toThrow(/42 CFR Part 2/i);
  });
});
