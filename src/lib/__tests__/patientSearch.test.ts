import { describe, it, expect } from "vitest";
import { searchPatients, type SearchablePatient } from "../patientSearch";

const patients: SearchablePatient[] = [
  {
    id: "p1",
    firstName: "Marisol",
    lastName: "Reyes",
    dob: "1990-04-02",
    programId: "ADL-2026-001",
    cin: "98765432A",
    caseManagerId: "cm1",
  },
  {
    id: "p2",
    firstName: "Darnell",
    lastName: "Price",
    dob: "1985-11-20",
    programId: "ADL-2026-002",
    primaryClinicianId: "c1",
  },
];

describe("staff patient search", () => {
  it("ignores queries shorter than two characters", () => {
    expect(searchPatients(patients, "")).toEqual([]);
    expect(searchPatients(patients, "m")).toEqual([]);
  });

  it("matches on name in either order", () => {
    expect(searchPatients(patients, "reyes")[0]?.patient.id).toBe("p1");
    expect(searchPatients(patients, "Price Darnell")[0]?.patient.id).toBe("p2");
  });

  it("matches a date of birth typed either way", () => {
    expect(searchPatients(patients, "1990-04-02")[0]?.matchedOn).toBe("dob");
    expect(searchPatients(patients, "04/02/1990")[0]?.patient.id).toBe("p1");
  });

  it("matches program ID and CIN, punctuation-insensitively", () => {
    expect(searchPatients(patients, "adl 2026 002")[0]?.patient.id).toBe("p2");
    expect(searchPatients(patients, "98765432A")[0]?.matchedOn).toBe("cin");
  });

  it("ranks the viewer's assigned patients first without filtering others out", () => {
    const rows = searchPatients(patients, "ADL-2026", { clinicianId: "c1" });
    expect(rows.map((r) => r.patient.id)).toEqual(["p2", "p1"]);
    expect(rows).toHaveLength(2);
  });
});
