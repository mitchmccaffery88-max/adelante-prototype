// §Part 2 store-layer enforcement — the gate lives in the STORE, not in
// intake.tsx. These tests call the store directly, bypassing every UI.
import { describe, expect, it } from "vitest";
import { AdelanteEHR, Part2AccessError } from "@/lib/ehr";
import { isPart2Screener, scoreScreener, screenerByKey } from "@/lib/screeners";
import { setActingRole } from "@/lib/roles";

const patient = AdelanteEHR.listPatients()[0]!;

function record(key: string, answers: number[]) {
  const def = screenerByKey(key)!;
  const s = scoreScreener(def, answers);
  AdelanteEHR.recordScreener(patient.id, {
    key,
    score: s.score,
    severity: s.severity,
    completedAt: new Date().toISOString(),
    responses: answers,
    ...(s.positive !== undefined ? { positive: s.positive } : {}),
    ...(s.domains ? { domains: s.domains } : {}),
  });
}

record("audit", [3, 2, 2, 1, 1, 0, 1, 1, 1, 0]);
record("dast-10", [1, 1, 1, 0, 0, 0, 0, 0, 0, 0]);
record("phq-9", Array(9).fill(1));
record("ahc-hrsn", [1, 0, 0, 0, 0, 0, 1, 1, 1, 1]);

describe("which instruments are Part 2 covered", () => {
  it("covers only the SUD instruments", () => {
    expect(isPart2Screener("audit")).toBe(true);
    expect(isPart2Screener("dast-10")).toBe(true);
    for (const k of ["phq-9", "gad-7", "phq-2", "gad-2", "ahc-hrsn"])
      expect(isPart2Screener(k)).toBe(false);
  });
});

describe("the store itself refuses unauthorized Part 2 reads", () => {
  it("throws for a role with no screeners_sud access", () => {
    expect(() =>
      AdelanteEHR.getScreenerResult(patient.id, "audit", { kind: "staff", role: "billing" }),
    ).toThrow(Part2AccessError);
    expect(
      AdelanteEHR.viewScreenerResult(patient.id, "dast-10", { kind: "staff", role: "billing" })
        .restricted,
    ).toBe(true);
  });

  it("throws for a consent_gated role while no SUD consent is on file", () => {
    AdelanteEHR.setConsent(patient.id, "part2Sud", false);
    expect(() =>
      AdelanteEHR.getScreenerResult(patient.id, "audit", { kind: "staff", role: "peer_specialist" }),
    ).toThrow(Part2AccessError);
  });

  it("allows a consent_gated role once the real consent is granted", () => {
    AdelanteEHR.setConsent(patient.id, "part2Sud", true);
    expect(
      AdelanteEHR.getScreenerResult(patient.id, "audit", { kind: "staff", role: "peer_specialist" })
        ?.key,
    ).toBe("audit");
    AdelanteEHR.setConsent(patient.id, "part2Sud", false);
  });

  it("allows the treating clinician unconditionally", () => {
    expect(
      AdelanteEHR.getScreenerResult(patient.id, "audit", { kind: "staff", role: "therapist" })!
        .score,
    ).toBe(12);
  });

  it("defaults to the acting role when no viewer is supplied", () => {
    setActingRole("billing");
    expect(() => AdelanteEHR.getScreenerResult(patient.id, "audit")).toThrow(Part2AccessError);
    setActingRole("therapist");
    expect(AdelanteEHR.getScreenerResult(patient.id, "audit")).toBeTruthy();
  });

  it("lets the patient read their own, and no one else's", () => {
    expect(
      AdelanteEHR.getScreenerResult(patient.id, "audit", {
        kind: "patient",
        patientId: patient.id,
      }),
    ).toBeTruthy();
    expect(() =>
      AdelanteEHR.getScreenerResult(patient.id, "audit", { kind: "patient", patientId: "other" }),
    ).toThrow(Part2AccessError);
  });

  it("keeps existence checks ungated — workflow status is not content", () => {
    setActingRole("billing");
    expect(AdelanteEHR.hasScreenerResult(patient.id, "audit")).toBe(true);
    setActingRole("therapist");
  });
});

describe("Part 2 is not over-applied", () => {
  it("never gates PHQ-9 or the AHC-HRSN SDOH instrument", () => {
    for (const k of ["phq-9", "ahc-hrsn"]) {
      const gate = AdelanteEHR.screenerAccess(patient.id, k, { kind: "staff", role: "billing" });
      expect(gate.part2).toBe(false);
      expect(gate.allowed).toBe(true);
      expect(AdelanteEHR.getScreenerResult(patient.id, k, { kind: "staff", role: "billing" }))
        .toBeTruthy();
    }
  });
});

describe("population health is not a second unprotected path", () => {
  const opts = { patientIds: [patient.id], keys: ["audit", "ahc-hrsn"] } as const;

  it("suppresses Part 2 contributions for an unauthorized viewer", () => {
    const s = AdelanteEHR.screenerPopulationSummary({
      ...opts,
      viewer: { kind: "staff", role: "billing" },
    });
    const audit = s.instruments.find((i) => i.key === "audit")!;
    expect(audit.administered).toBe(0);
    expect(audit.restricted).toBe(true);
    // Non-Part 2 aggregation is untouched.
    expect(s.sdohDomains.find((d) => d.key === "housing")!.screened).toBe(1);
  });

  it("reports the real numbers for an authorized viewer", () => {
    const s = AdelanteEHR.screenerPopulationSummary({
      ...opts,
      viewer: { kind: "staff", role: "therapist" },
    });
    const audit = s.instruments.find((i) => i.key === "audit")!;
    expect(audit.administered).toBe(1);
    expect(audit.positive).toBe(1);
    expect(audit.restricted).toBeUndefined();
  });
});
