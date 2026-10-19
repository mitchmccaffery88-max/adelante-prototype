import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { AdelanteEHR } from "../ehr";
import { disclosureCsvFilename } from "../exportFilenames";

it("disclosure export file name uses the program ID, never the patient's name or DOB", () => {
  for (const p of AdelanteEHR.listPatients()) {
    const name = disclosureCsvFilename(p.id, new Date("2026-10-19T12:00:00Z"));
    expect(name).toBe(`disclosures-${p.programId}-2026-10-19.csv`);
    for (const part of [p.firstName, p.lastName, p.dob].filter(Boolean)) expect(name.toLowerCase()).not.toContain(String(part).toLowerCase());
  }
});

it("the data-exchange download no longer builds its name from the patient name", () => {
  const src = readFileSync("src/routes/data-exchange.tsx", "utf8");
  expect(src).toContain("a.download = disclosureCsvFilename(id);");
  expect(src).not.toMatch(/download = `disclosures-\$\{nameOf/);
});

it("note and refusal PDF names use the program ID, never the patient's name or DOB", async () => {
  const { notePdfFilename } = await import("../notePdf");
  const { refusalPdfFilename } = await import("../refusalPdf");
  for (const p of AdelanteEHR.listPatients()) {
    const note = notePdfFilename({ id: "pn-abc123", date: "2026-07-20T15:00:00.000Z", signedAt: "2026-07-20T16:00:00.000Z" } as never, p);
    const refusal = refusalPdfFilename({ id: "rf-123456", createdAt: "2026-07-30T09:00:00.000Z", finalizedAt: "2026-07-30T10:00:00.000Z" } as never, p);
    expect(note).toBe(`note-${p.programId}-2026-07-20-pn-abc.pdf`);
    expect(refusal).toBe(`refusal-${p.programId}-2026-07-30-rf-123.pdf`);
    for (const part of [p.firstName, p.lastName, p.dob].filter(Boolean))
      for (const n of [note, refusal]) expect(n.toLowerCase()).not.toContain(String(part).toLowerCase());
  }
});
