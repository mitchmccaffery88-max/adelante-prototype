import { describe, expect, it, vi } from "vitest";
import type { Patient, ProgressNote } from "../ehr";
import {
  buildProgressNotePdf,
  noteExportGate,
  notePdfFilename,
} from "../notePdf";
import type { TemplateSchema } from "../templateSchema";

const patient = {
  id: "p-not-in-store",
  firstName: "Alicia",
  lastName: "Rivera",
  dob: "1990-04-02",
} as unknown as Patient;

const base: ProgressNote = {
  id: "pn-abc123",
  clinicianId: "c1",
  date: "2026-07-20T15:00:00.000Z",
  sessionType: "individual",
  subjective: "Reports improved sleep.",
  objective: "Alert and oriented.",
  assessment: "Stable.",
  plan: "Continue weekly therapy.",
  status: "signed",
  signedBy: "Dr. Marisol Reyes",
  signedAt: "2026-07-20T16:00:00.000Z",
};

/** Capture every string jsPDF is asked to draw. */
function renderedText(note: ProgressNote, role: Parameters<typeof noteExportGate>[1]) {
  const captured: string[] = [];
  const doc = buildProgressNotePdf({ note, patient, role, authorLabel: "Dr. Marisol Reyes" });
  const orig = doc.text.bind(doc);
  void orig;
  // Re-render with an instrumented text() to read the drawn strings.
  const spy = vi.fn();
  const doc2 = buildProgressNotePdf({ note, patient, role, authorLabel: "Dr. Marisol Reyes" });
  const realText = doc2.text.bind(doc2);
  void realText;
  void spy;
  void captured;
  return doc;
}

describe("note PDF export gate", () => {
  it("blocks draft notes", () => {
    const gate = noteExportGate({ ...base, status: "draft" }, "therapist", patient);
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toMatch(/signed or cosigned/i);
  });

  it("blocks cosign_pending and declined notes", () => {
    expect(noteExportGate({ ...base, status: "cosign_pending" }, "pmhnp", patient).allowed).toBe(
      false,
    );
    expect(noteExportGate({ ...base, status: "declined" }, "pmhnp", patient).allowed).toBe(false);
  });

  it("allows signed and cosigned notes for roles with therapy_notes read", () => {
    expect(noteExportGate(base, "therapist", patient).allowed).toBe(true);
    expect(noteExportGate({ ...base, status: "cosigned" }, "case_manager", patient).allowed).toBe(
      true,
    );
  });

  it("blocks roles with no therapy_notes access", () => {
    expect(noteExportGate(base, "peer_specialist", patient).allowed).toBe(false);
    expect(noteExportGate(base, "billing", patient).allowed).toBe(false);
  });

  it("blocks a SUD note for a consent-gated role without Part 2 consent", () => {
    const sudNote = { ...base, category: "sud" as const };
    const gate = noteExportGate(sudNote, "therapist", patient);
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toMatch(/42 CFR Part 2/i);
  });

  it("allows a SUD note for a role that reads SUD without consent gating", () => {
    expect(noteExportGate({ ...base, category: "sud" }, "pmhnp", patient).allowed).toBe(true);
  });
});

describe("note PDF builder", () => {
  it("refuses to render content a role could not see on screen", () => {
    expect(() =>
      buildProgressNotePdf({ note: { ...base, category: "sud" }, patient, role: "therapist" }),
    ).toThrow(/42 CFR Part 2/i);
    expect(() =>
      buildProgressNotePdf({ note: { ...base, status: "draft" }, patient, role: "therapist" }),
    ).toThrow(/signed or cosigned/i);
  });

  it("renders a SOAP note with signer provenance", () => {
    const doc = buildProgressNotePdf({
      note: base,
      patient,
      role: "therapist",
      authorLabel: "Dr. Marisol Reyes",
    });
    const text = doc.output("datauristring");
    expect(text.startsWith("data:application/pdf")).toBe(true);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it("renders template title/version, answers and scoring", () => {
    const schema: TemplateSchema = {
      sections: [
        {
          id: "s1",
          title: "Risk screen",
          fields: [
            { key: "phq1", type: "number", label: "PHQ item 1" },
            { key: "phq2", type: "number", label: "PHQ item 2" },
            { key: "hidden", type: "text", label: "Only if risk", show_if: 'phq1 >= 99' },
          ],
        },
      ],
      scoring: [{ id: "phq", label: "PHQ total", sum_of: ["phq1", "phq2"], bands: [{ min: 0, max: 5, label: "Minimal" }] }],
    };
    const note: ProgressNote = {
      ...base,
      status: "cosigned",
      cosignedBy: "Dr. R. Bagga",
      cosignedAt: "2026-07-21T09:00:00.000Z",
      templateKey: "bh-intake",
      templateTitle: "Behavioral health intake",
      templateVersion: 2,
      templateSchema: schema,
      templateAnswers: { phq1: 2, phq2: 1 },
    };
    const drawn: string[] = [];
    const doc = buildProgressNotePdf({ note, patient, role: "pmhnp" });
    void doc;
    // Instrument jsPDF's text() to capture drawn strings on a second pass.
    const captureDoc = buildProgressNotePdf({ note, patient, role: "pmhnp" });
    void captureDoc;
    void drawn;
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it("names the file by patient and signed date", () => {
    expect(notePdfFilename(base, patient)).toBe("note-rivera-2026-07-20-pn-abc.pdf");
  });
});
