import { describe, expect, it } from "vitest";
import type { Patient, ProgressNote } from "../ehr";
import {
  buildNoteDocumentModel,
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
    // case_manager stays consent_gated for screeners_sud; therapist is not.
    const gate = noteExportGate(sudNote, "case_manager", patient);
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toMatch(/42 CFR Part 2/i);
  });

  it("allows a SUD note for a role that reads SUD without consent gating", () => {
    expect(noteExportGate({ ...base, category: "sud" }, "pmhnp", patient).allowed).toBe(true);
    expect(noteExportGate({ ...base, category: "sud" }, "therapist", patient).allowed).toBe(true);
  });
});

describe("note PDF builder", () => {
  it("refuses to render content a role could not see on screen", () => {
    expect(() =>
      buildProgressNotePdf({ note: { ...base, category: "sud" }, patient, role: "case_manager" }),
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
            { key: "hidden", type: "text", label: "Only if risk", show_if: "phq1 >= 99" },
          ],
        },
      ],
      scoring: [
        {
          id: "phq",
          label: "PHQ total",
          sum_of: ["phq1", "phq2"],
          bands: [{ min: 0, max: 5, label: "Minimal" }],
        },
      ],
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
    const blocks = buildNoteDocumentModel({ note, patient, role: "pmhnp" });
    const headings = blocks.filter((b) => b.kind === "heading").map((b) => b.text);
    expect(headings).toContain("Template — Behavioral health intake v2");
    expect(headings).toContain("Scoring");
    const fields = blocks.filter((b) => b.kind === "field");
    const value = (label: string) => fields.find((f) => f.label === label)?.value;
    expect(value("PHQ item 1")).toBe("2");
    expect(value("PHQ item 2")).toBe("1");
    // Hidden-by-show_if fields must not leak into the legal record.
    expect(value("Only if risk")).toBeUndefined();
    expect(value("PHQ total")).toBe("3 — Minimal");
    expect(value("Signed by")).toBe("Dr. Marisol Reyes");
    expect(value("Cosigned by")).toBe("Dr. R. Bagga");
    expect(value("Status")).toBe("cosigned");
    expect(buildProgressNotePdf({ note, patient, role: "pmhnp" }).getNumberOfPages()).toBe(1);
  });

  it("renders SOAP content and signer provenance in the model", () => {
    const blocks = buildNoteDocumentModel({
      note: base,
      patient,
      role: "therapist",
      authorLabel: "Dr. Marisol Reyes",
      exportedBy: "Dr. Marisol Reyes",
    });
    const paragraphs = blocks.filter((b) => b.kind === "paragraph").map((b) => b.text);
    expect(paragraphs).toContain("Reports improved sleep.");
    expect(paragraphs).toContain("Continue weekly therapy.");
    const fields = blocks.filter((b) => b.kind === "field");
    expect(fields.find((f) => f.label === "Author")?.value).toBe("Dr. Marisol Reyes");
    expect(fields.find((f) => f.label === "Status")?.value).toBe("signed");
  });

  it("throws from the content model too — no bypass around the PDF renderer", () => {
    expect(() =>
      buildNoteDocumentModel({ note: { ...base, category: "sud" }, patient, role: "case_manager" }),
    ).toThrow(/42 CFR Part 2/i);
  });

  it("names the file by patient and signed date", () => {
    expect(notePdfFilename(base, patient)).toBe("note-rivera-2026-07-20-pn-abc.pdf");
  });
});
