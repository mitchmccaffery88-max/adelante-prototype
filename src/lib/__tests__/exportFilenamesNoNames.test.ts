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
