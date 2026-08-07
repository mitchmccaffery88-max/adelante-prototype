// §Print/export center — the masking and RBAC guarantees, tested explicitly.
//
// The point of these tests is that this export CANNOT become a side channel:
// a note masked on-screen must be masked here, and a role without meds access
// must not get medications by asking for `?meds=1`.
import { beforeEach, describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { setActingRole } from "@/lib/roles";
import { buildPrintRecordDocument, type PrintFlags } from "@/lib/printRecord";

const FLAGS: PrintFlags = { meds: true, mar: true, notes: true, notesScope: "all" };

function signedNote(patientId: string, over: Record<string, unknown> = {}) {
  return AdelanteEHR.addProgressNote(patientId, {
    clinicianId: "c1",
    date: new Date().toISOString(),
    sessionType: "individual",
    subjective: "Subjective body text",
    objective: "",
    assessment: "",
    plan: "",
    status: "signed",
    signedBy: "Dr. Marisol Reyes",
    signedAt: new Date().toISOString(),
    ...over,
  } as never) as unknown as { id: string };
}

describe("print record — sections", () => {
  beforeEach(() => setActingRole("pmhnp"));

  it("includes only requested sections and never labs/diet/restrictions", () => {
    const patient = AdelanteEHR.listPatients()[0]!;
    const doc = buildPrintRecordDocument({
      patient,
      role: "pmhnp",
      flags: { ...FLAGS, mar: false, notes: false },
    });
    expect(doc.sections.map((s) => s.key)).toEqual(["meds"]);
  });

  it("renders template answers, not an empty SOAP shell", () => {
    const patient = AdelanteEHR.listPatients()[0]!;
    signedNote(patient.id, {
      subjective: "",
      templateKey: "phq2",
      templateTitle: "PHQ-2",
      templateVersion: 1,
      templateSchema: {
        sections: [
          {
            id: "s1",
            title: "Screening",
            fields: [{ key: "phq_1", type: "radio", label: "Little interest", options: [] }],
          },
        ],
      },
      templateAnswers: { phq_1: "Nearly every day" },
    });
    const doc = buildPrintRecordDocument({
      patient,
      role: "pmhnp",
      flags: { ...FLAGS, meds: false, mar: false },
    });
    const notes = doc.sections.find((s) => s.key === "notes");
    const flat = JSON.stringify(notes);
    expect(flat).toContain("Little interest");
    expect(flat).toContain("Nearly every day");
  });

  it("filters MAR rows to the requested month", () => {
    const patient = AdelanteEHR.listPatients()[0]!;
    const doc = buildPrintRecordDocument({
      patient,
      role: "pmhnp",
      flags: { ...FLAGS, meds: false, notes: false, marMonth: "1999-01" },
    });
    const mar = doc.sections.find((s) => s.key === "mar");
    expect(mar && mar.key === "mar" ? mar.rows.length : -1).toBe(0);
  });
});

describe("print record — RBAC", () => {
  it("denies medications to a role without meds_erx read", () => {
    const patient = AdelanteEHR.listPatients()[0]!;
    const doc = buildPrintRecordDocument({
      patient,
      role: "billing",
      flags: { ...FLAGS, mar: false, notes: false },
    });
    expect(doc.sections).toHaveLength(0);
    expect(doc.denied.map((d) => d.key)).toContain("meds");
  });
});

describe("print record — SUD masking parity with the on-screen gate", () => {
  it("masks a SUD note for a consent-gated role and carries no content", () => {
    const patient = AdelanteEHR.listPatients().find(
      (p) => !AdelanteEHR.getConsentState(p.id).part2Sud,
    )!;
    signedNote(patient.id, { subjective: "Confidential SUD content", category: "sud" });

    const gated = buildPrintRecordDocument({
      patient,
      role: "ecm_provider",
      flags: { ...FLAGS, meds: false, mar: false },
    });
    const section = gated.sections.find((s) => s.key === "notes");
    const entry =
      section && section.key === "notes"
        ? section.entries.find((e) => e.note.category === "sud")
        : undefined;
    expect(entry).toBeDefined();
    expect(entry!.masked).toBe(true);
    expect(entry!.blocks).toBeUndefined();
    expect(JSON.stringify(section)).not.toContain("Confidential SUD content");
    expect(entry!.maskReason).toMatch(/42 CFR Part 2/i);
  });

  it("includes the same note for a role the on-screen gate allows", () => {
    const patient = AdelanteEHR.listPatients().find(
      (p) => !AdelanteEHR.getConsentState(p.id).part2Sud,
    )!;
    signedNote(patient.id, { subjective: "Therapist-visible SUD content", category: "sud" });
    const doc = buildPrintRecordDocument({
      patient,
      role: "therapist",
      flags: { ...FLAGS, meds: false, mar: false },
    });
    expect(JSON.stringify(doc.sections)).toContain("Therapist-visible SUD content");
  });

  it("never includes unsigned notes", () => {
    const patient = AdelanteEHR.listPatients()[0]!;
    signedNote(patient.id, {
      status: "draft",
      signedBy: undefined,
      signedAt: undefined,
      subjective: "Draft-only body",
    });
    const doc = buildPrintRecordDocument({
      patient,
      role: "pmhnp",
      flags: { ...FLAGS, meds: false, mar: false },
    });
    expect(JSON.stringify(doc.sections)).not.toContain("Draft-only body");
  });
});