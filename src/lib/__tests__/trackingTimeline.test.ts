import { describe, it, expect } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { buildTrackingRows, filterTrackingRows, latestFromHistory } from "@/lib/trackingTimeline";

const byName = (n: string) => AdelanteEHR.listPatients().find((p) => p.firstName === n)!;

describe("Tracking timeline", () => {
  it("Luis has 3+ PHQ-9 points and a missed entry for a clinician", () => {
    const rows = buildTrackingRows(byName("Luis"), "therapist");
    expect(filterTrackingRows(rows, { instrument: "PHQ-9", status: "completed" }).length).toBeGreaterThanOrEqual(3);
    expect(rows.some((r) => r.status === "missed")).toBe(true);
  });
  it("hides SUD instruments from ECM (Part 2)", () => {
    for (const n of ["Luis", "Jordan"]) {
      const rows = buildTrackingRows(byName(n), "ecm_provider");
      expect(rows.some((r) => r.sud)).toBe(false);
      expect(rows.some((r) => ["AUDIT", "DAST-10", "ASAM"].includes(r.label))).toBe(false);
    }
  });
  it("care plan latest matches Tracking latest (Rosa PHQ-9 = 8)", () => {
    const rosa = byName("Rosa");
    const latestRow = filterTrackingRows(buildTrackingRows(rosa, "therapist"), { instrument: "PHQ-9", status: "completed" })[0];
    expect(latestFromHistory(rosa, "phq-9")?.score).toBe(8);
    expect(latestRow.score).toBe(8);
    expect(rosa.screeners["phq-9"]?.score).toBe(8);
  });
  it("six demo patients each have 3+ points per seeded instrument", () => {
    for (const n of ["Luis", "Rosa", "Daniel", "Marcus", "Jordan", "Carmen"]) {
      const h = byName(n).screenerHistory ?? [];
      expect(h.filter((x) => x.key === "phq-9").length).toBeGreaterThanOrEqual(3);
    }
  });
});
