import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import {
  AHC_HRSN,
  RESCREEN_SCHEDULE,
  RETIRED_SCREENERS,
  SCREENERS,
  activeScreenerByKey,
  optionsForItem,
  scoreScreener,
  screenerByKey,
  screenerComplete,
} from "@/lib/screeners";
import { intakeScreeners } from "@/lib/seeking";
import { CSSRS_ITEMS, CSSRS_KEY, CSSRS_TEXT_APPROVED, cssrsRisk } from "@/lib/cssrs";

const def = (k: string) => screenerByKey(k)!;

function fresh() {
  return AdelanteEHR.createPatient({
    firstName: "Ten",
    lastName: `Test${Math.random().toString(36).slice(2, 6)}`,
    dob: "1990-01-01",
  } as Parameters<typeof AdelanteEHR.createPatient>[0]);
}

describe("Phase 10a — AUDIT validated anchors", () => {
  const audit = def("audit");
  it("items 9 and 10 score 0 / 2 / 4", () => {
    for (const i of [8, 9]) expect(optionsForItem(audit, i).map((o) => o.value)).toEqual([0, 2, 4]);
  });
  it("known answer sets", () => {
    expect(scoreScreener(audit, Array(10).fill(0)).score).toBe(0);
    expect(scoreScreener(audit, [4, 4, 4, 4, 4, 4, 4, 4, 4, 4]).score).toBe(40);
    // Moderate drinker, injured last year, others concerned last year.
    const r = scoreScreener(audit, [2, 1, 1, 0, 0, 0, 1, 0, 4, 4]);
    expect(r.score).toBe(13);
    expect(r.positive).toBe(true);
  });
  it("Marcus's seeded 16 has no item answers and is relabelled, not re-scored", () => {
    const marcus = AdelanteEHR.getPatient("p3")!;
    const a = marcus.screeners["audit"]!;
    expect(a.score).toBe(16);
    expect(a.responses).toBeUndefined();
    expect(a.scoringVersion).not.toBe("who-anchors-v2");
  });
});

describe("Phase 10a — PTSD instruments", () => {
  it("the 5-item short form is retired and cannot be scored or offered", () => {
    expect(RETIRED_SCREENERS.map((s) => s.key)).toContain("pcl-5");
    expect(activeScreenerByKey("pcl-5")).toBeUndefined();
    expect(() => scoreScreener(def("pcl-5"), [0, 0, 0, 0, 0])).toThrow();
    expect(intakeScreeners(true).some((s) => s.key === "pcl-5")).toBe(false);
  });
  it("PC-PTSD-5 gate: no trauma exposure completes at 0", () => {
    const pc = def("pc-ptsd-5");
    expect(screenerComplete(pc, [0])).toBe(true);
    expect(scoreScreener(pc, [0, 0, 0, 0, 0, 0]).score).toBe(0);
    expect(screenerComplete(pc, [1, 1])).toBe(false);
    const r = scoreScreener(pc, [1, 1, 1, 1, 1, 0]);
    expect(r.score).toBe(4);
    expect(r.positive).toBe(true);
  });
  it("full PCL-5 is 20 items, 0–4, max 80, staff/trigger only", () => {
    const p = def("pcl-5-20");
    expect(p.questions).toHaveLength(20);
    expect(p.options.map((o) => o.label)).toEqual([
      "Not at all", "A little bit", "Moderately", "Quite a bit", "Extremely",
    ]);
    expect(scoreScreener(p, Array(20).fill(4)).score).toBe(80);
    expect(intakeScreeners(true).some((s) => s.key === "pcl-5-20")).toBe(false);
  });
});

describe("Phase 10a — verbatim fidelity (spot items from the official sources)", () => {
  it("PHQ-9 / GAD-7", () => {
    expect(def("phq-9").questions[0]).toBe("Little interest or pleasure in doing things");
    expect(def("phq-9").questions).toHaveLength(9);
    expect(def("gad-7").questions[0]).toBe("Feeling nervous, anxious or on edge");
    expect(def("phq-9").options.map((o) => o.label)).toEqual([
      "Not at all", "Several days", "More than half the days", "Nearly every day",
    ]);
  });
  it("PC-PTSD-5 and AHC-HRSN", () => {
    expect(def("pc-ptsd-5").questions).toHaveLength(6);
    expect(AHC_HRSN.questions[0]).toBe("What is your living situation today?");
    expect(optionsForItem(AHC_HRSN, 2).map((o) => o.label)).toEqual([
      "Often true", "Sometimes true", "Never true",
    ]);
    expect(optionsForItem(AHC_HRSN, 6).map((o) => o.value)).toEqual([1, 2, 3, 4, 5]);
  });
  it("every active instrument carries provenance", () => {
    for (const s of [...SCREENERS, AHC_HRSN]) {
      expect(s.source, s.key).toBeTruthy();
      expect(s.version, s.key).toBeTruthy();
      expect(s.scoringVersion, s.key).toBeTruthy();
      expect(typeof s.textVerified, s.key).toBe("boolean");
    }
    // Honest flags: AUDIT (WHO PDF unreachable) and DAST-10 (paraphrase).
    expect(def("audit").textVerified).toBe(false);
    expect(def("dast-10").textVerified).toBe(false);
  });
});

describe("Phase 10a — intake offering and cadence", () => {
  it("intake offers AHC-HRSN with its own per-item options, Part 2 still the only filter", () => {
    expect(intakeScreeners(false).map((s) => s.key)).toEqual(["phq-9", "gad-7", "pc-ptsd-5", "ahc-hrsn"]);
    expect(optionsForItem(AHC_HRSN, 0)).toHaveLength(3);
  });
  it("one draft rule per active instrument", () => {
    const keys = RESCREEN_SCHEDULE.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toContain("pcl-5");
  });
});

describe("Phase 10a/10b — EHR record metadata and audit", () => {
  it("recordScreener stamps version, scoring, verified flag and audits", () => {
    const p = fresh();
    AdelanteEHR.recordScreener(p.id, {
      key: "gad-7", score: 3, severity: "Minimal", completedAt: new Date().toISOString(),
      timepoint: "intake", responses: [1, 1, 1, 0, 0, 0, 0], context: "intake",
    });
    const r = AdelanteEHR.getPatient(p.id)!.screeners["gad-7"]!;
    expect(r.instrumentVersion).toBeTruthy();
    expect(r.scoringVersion).toBeTruthy();
    expect(r.textVerified).toBe(true);
    const audit = AdelanteEHR.listAudit?.({ patientId: p.id }) ?? [];
    if (Array.isArray(audit)) expect(audit.some((a: { action: string }) => a.action === "screener_recorded")).toBe(true);
  });
  it("retired forms are refused for new results", () => {
    const p = fresh();
    expect(() =>
      AdelanteEHR.recordScreener(p.id, {
        key: "pcl-5", score: 1, severity: "x", completedAt: new Date().toISOString(), timepoint: "intake",
      }),
    ).toThrow();
  });
});

describe("Phase 10b — C-SSRS", () => {
  it("item text is placeholder until Columbia wording is supplied", () => {
    expect(CSSRS_TEXT_APPROVED).toBe(false);
    for (const it of CSSRS_ITEMS) expect(it.en).toMatch(/Awaiting official Columbia text/);
  });
  it("draft risk mapping", () => {
    expect(cssrsRisk([0, 0, undefined, undefined, undefined, 0])).toBe("none");
    expect(cssrsRisk([1, 0, undefined, undefined, undefined, 0])).toBe("low");
    expect(cssrsRisk([1, 1, 1, 0, 0, 0])).toBe("moderate");
    expect(cssrsRisk([1, 1, 1, 1, 0, 0])).toBe("high");
  });
  it("PHQ-9 item 9 > 0 requests a C-SSRS; item 9 = 0 does not", () => {
    const a = fresh();
    AdelanteEHR.recordScreener(a.id, {
      key: "phq-9", score: 1, severity: "Minimal", completedAt: new Date().toISOString(),
      timepoint: "intake", responses: [1, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    expect(AdelanteEHR.openCssrsRequest(a.id)).toBeUndefined();
    const b = fresh();
    AdelanteEHR.recordScreener(b.id, {
      key: "phq-9", score: 1, severity: "Minimal", completedAt: new Date().toISOString(),
      timepoint: "intake", crisisFlag: true, responses: [0, 0, 0, 0, 0, 0, 0, 0, 1],
    });
    expect(AdelanteEHR.openCssrsRequest(b.id)).toBeTruthy();
  });
  it("staff result is attributed; patient self-report never lowers staff risk; high risk reaches the crisis queue", () => {
    const p = fresh();
    expect(() => AdelanteEHR.recordCssrs({ patientId: p.id, answers: [0, 0, undefined, undefined, undefined, 0], mode: "staff" })).toThrow();
    AdelanteEHR.recordCssrs({
      patientId: p.id, answers: [1, 1, 1, 1, 0, 0], mode: "staff", staffName: "Test Clinician", staffRole: "therapist",
    });
    expect(AdelanteEHR.getPatient(p.id)!.screeners[CSSRS_KEY]!.cssrsRisk).toBe("high");
    const self = AdelanteEHR.recordCssrs({ patientId: p.id, answers: [0, 0, undefined, undefined, undefined, 0], mode: "patient_self" });
    expect(self.cssrsRisk).toBe("high");
    expect(AdelanteEHR.patientsWithOpenCssrs).toBeTypeOf("function");
    const open = AdelanteEHR.getPatient(p.id)!.crisisEscalations?.find((e) => !e.resolvedAt);
    expect(open?.cssrsRisk).toBe("high");
  });
  it("C-SSRS and retired/unverified results are excluded from population totals", () => {
    const p = fresh();
    AdelanteEHR.recordCssrs({ patientId: p.id, answers: [1, 0, undefined, undefined, undefined, 0], mode: "patient_self" });
    const s = AdelanteEHR.screenerPopulationSummary({ patientIds: [p.id], keys: [CSSRS_KEY] });
    expect(s.instruments[0]!.administered).toBe(0);
    expect(s.instruments[0]!.excludedPendingVerification).toBe(1);
  });
});
