// @vitest-environment jsdom
//
// Export affordance rules, exercised through the real Notes tab: draft and
// unsigned notes get no export action at all, and a SUD note masked on-screen
// stays masked (no export button, and the builder refuses to render).
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const { AdelanteEHR } = await import("@/lib/ehr");
const { NotesTab } = await import("@/components/clinical/RecordTabs");
const { setActingRole, setActingStaff } = await import("@/lib/roles");
const { buildNoteDocumentModel } = await import("@/lib/notePdf");

afterEach(cleanup);

function seed(patientId: string) {
  const p = AdelanteEHR.listPatients()[0]!;
  return p;
}

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
      signedBy: "Dr. Marisol Reyes",
      signedAt: new Date().toISOString(),
    });
    render(<NotesTab patientId={patient.id} />);
    expect(screen.getAllByRole("button", { name: /Export PDF/i }).length).toBeGreaterThan(0);
  });

  it("hides export for a SUD-masked note and refuses to render its content", () => {
    setActingStaff("s-th1");
    setActingRole("therapist");
    const sudPatient = AdelanteEHR.listPatients().find(
      (p) => !AdelanteEHR.getConsentState(p.id).part2Sud,
    )!;
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
      signedBy: "Dr. Marisol Reyes",
      signedAt: new Date().toISOString(),
    } as never) as unknown as { id: string };
    render(<NotesTab patientId={sudPatient.id} />);
    expect(screen.queryByText("Confidential SUD content")).toBeNull();
    expect(screen.queryAllByRole("button", { name: /Export PDF/i }).length).toBe(0);
    const stored = (AdelanteEHR.getPatient(sudPatient.id)?.progressNotes ?? []).find(
      (n) => n.category === "sud",
    )!;
    expect(() =>
      buildNoteDocumentModel({ note: stored, patient: sudPatient, role: "therapist" }),
    ).toThrow(/42 CFR Part 2/i);
  });
});
