import { describe, expect, it } from "vitest";
import {
  parseCsvLine,
  previewCredentialImport,
  toCredentialCsv,
} from "@/lib/credentialRoster";

const known = {
  clinicianIds: ["c1", "c2"],
  existing: [{ id: "cr1", clinicianId: "c1", kind: "license", number: "A123" }],
};

describe("credential roster CSV", () => {
  it("exports a header plus one row per credential", () => {
    const csv = toCredentialCsv([
      {
        id: "cr1",
        clinicianId: "c1",
        clinicianName: "Reyes, Marisol",
        kind: "license",
        number: "A123",
        expiresAt: "2027-01-01",
        status: "current",
        hasDocument: true,
      },
    ]);
    const [header, row] = csv.split("\n");
    expect(header).toContain("clinician_id");
    // The name contains a comma, so it must come back quoted.
    expect(row).toContain('"Reyes, Marisol"');
    expect(row!.endsWith("yes")).toBe(true);
  });

  it("reads quoted cells with embedded commas and quotes", () => {
    expect(parseCsvLine('a,"b,c","say ""hi"""')).toEqual(["a", "b,c", 'say "hi"']);
  });

  it("matches an existing credential as an update and a new one as an add", () => {
    const csv = [
      "clinician_id,kind,number,issuing_state,issued_at,expires_at",
      "c1,license,A123,CA,2020-01-01,2028-01-01",
      "c2,dea,X999,CA,,2027-06-30",
    ].join("\n");
    const p = previewCredentialImport(csv, known);
    expect(p.problems).toEqual([]);
    expect(p.candidates.map((c) => c.action)).toEqual(["update", "add"]);
    expect(p.candidates[0]!.existingId).toBe("cr1");
  });

  it("rejects unknown clinicians, bad types and bad dates, one reason per row", () => {
    const csv = [
      "clinician_id,kind,number,issuing_state,issued_at,expires_at",
      "c9,license,,CA,,2028-01-01",
      "c1,wizardry,,CA,,2028-01-01",
      "c1,dea,,CA,,01/01/2028",
    ].join("\n");
    const p = previewCredentialImport(csv, known);
    expect(p.candidates).toEqual([]);
    expect(p.problems).toHaveLength(3);
    expect(p.problems[0]!.message).toContain('No clinician with id "c9"');
    expect(p.problems[1]!.message).toContain("isn't a credential type");
    expect(p.problems[2]!.message).toContain("YYYY-MM-DD");
  });

  it("refuses a file with the wrong header rather than guessing", () => {
    const p = previewCredentialImport("name,expiry\nfoo,2028-01-01", known);
    expect(p.candidates).toEqual([]);
    expect(p.problems[0]!.message).toContain("missing");
  });

  it("says so plainly when the file is empty", () => {
    expect(previewCredentialImport("", known).problems[0]!.message).toBe("That file is empty.");
  });
});
