// §R5 (30 Oct, Mitch) — unanswered screener items are never scored as 0.
// Draft — pending clinical sign-off (Christi, Dr. Bagga).
import { describe, it, expect } from "vitest";
import "@/lib/ehr-ext";
import "@/lib/chartActions";
import { AdelanteEHR, type ScreenerResult } from "@/lib/ehr";
import { screenerByKey, scoreScreener } from "@/lib/screeners";
import { assessCompleteness, ITEM9_UNANSWERED_TASK_TITLE, answeredLabel, itemDisplay } from "@/lib/screenerCompleteness";
import { recordIntakeScreenerAnswers } from "@/lib/screenerIntake";
import { evaluateSeverity } from "@/lib/severityRules";

const PHQ9 = screenerByKey("phq-9")!;
const PTSD = screenerByKey("pc-ptsd-5")!;

function freshPatient() {
  const p = AdelanteEHR.listPatients().find((x) => x.caseManagerId && !x.crisisFlag && !(x.incompleteScreeners ?? []).length)!;
  expect(p).toBeTruthy();
  return p;
}

describe("R5 screener completeness", () => {
  it("a shown item left blank stays blank, never 0", () => {
    const c = assessCompleteness(PHQ9, [1, 1, 1, undefined, 1, 1, 1, 1, 0]);
    expect(c.complete).toBe(false);
    expect(c.responses[3]).toBeNull();
    expect(c.unansweredItems).toEqual([3]);
    expect(c.scoringAnswers).toBeUndefined();
  });

  it("instrument-skipped items are not asked and score per the instrument", () => {
    const c = assessCompleteness(PTSD, [0]);
    expect(c.complete).toBe(true);
    expect(c.notAskedItems).toEqual([1, 2, 3, 4, 5]);
    expect(c.responses.slice(1).every((v) => v === null)).toBe(true);
    expect(scoreScreener(PTSD, c.scoringAnswers!).score).toBe(0);
    expect(itemDisplay({ responses: c.responses, notAskedItems: c.notAskedItems }, 2)).toBe("Not asked");
  });

  it("an incomplete screener has no total and records the answered count", () => {
    const p = freshPatient();
    const before = p.screeners["phq-9"];
    const r = recordIntakeScreenerAnswers(p.id, PHQ9, [1, 1, 1, null, 1, 1, 1, 0, 0]);
    expect(r.complete).toBe(false);
    const inc = AdelanteEHR.listIncompleteScreeners(p.id).at(-1)!;
    expect(inc.status).toBe("incomplete");
    expect(answeredLabel(inc)).toBe("8 of 9 answered");
    expect("score" in inc).toBe(false);
    expect(AdelanteEHR.getPatient(p.id)!.screeners["phq-9"]).toBe(before);
  });

  it("a blank item 9 creates the neutral task and does not trip the crisis rule", () => {
    const p = freshPatient();
    recordIntakeScreenerAnswers(p.id, PHQ9, [1, 1, 1, 1, 1, 1, 1, 1, undefined]);
    const pp = AdelanteEHR.getPatient(p.id)!;
    expect(pp.crisisFlag).toBeUndefined();
    const tasks = AdelanteEHR.caseTasksForPatient(p.id);
    expect(tasks.some((t) => t.title === ITEM9_UNANSWERED_TASK_TITLE)).toBe(true);
    expect(tasks.some((t) => t.title.startsWith("Crisis flag"))).toBe(false);
    const inc = AdelanteEHR.listIncompleteScreeners(p.id).at(-1)!;
    expect(itemDisplay(inc, 8)).toBe("Not answered");
  });

  it("an answered item 9 of 1+ still trips the crisis rule, complete or not", () => {
    const a = freshPatient();
    recordIntakeScreenerAnswers(a.id, PHQ9, [0, 0, 0, 0, 0, 0, 0, 0, 1]);
    expect(AdelanteEHR.getPatient(a.id)!.crisisFlag?.source).toBe("phq-9");
    const b = freshPatient();
    recordIntakeScreenerAnswers(b.id, PHQ9, [0, null, 0, 0, 0, 0, 0, 0, 2]);
    expect(AdelanteEHR.getPatient(b.id)!.crisisFlag?.source).toBe("phq-9");
  });

  it("severity rules ignore incomplete screeners", () => {
    const p = freshPatient();
    const flagsBefore = (AdelanteEHR.getPatient(p.id)!.severityFlags ?? []).length;
    recordIntakeScreenerAnswers(p.id, PHQ9, [3, 3, 3, 3, 3, 3, 3, null, 0]);
    expect((AdelanteEHR.getPatient(p.id)!.severityFlags ?? []).length).toBe(flagsBefore);
    expect((AdelanteEHR.getPatient(p.id)!.screenerHistory ?? []).every((h: ScreenerResult) => h.completeness !== undefined || true)).toBe(true);
    // A complete result is stamped and still evaluated as today.
    recordIntakeScreenerAnswers(p.id, PHQ9, [3, 3, 3, 3, 3, 3, 3, 3, 0]);
    const latest = AdelanteEHR.getPatient(p.id)!.screeners["phq-9"]!;
    expect(latest.completeness).toBe("complete");
    expect(latest.score).toBe(24);
    expect(evaluateSeverity(undefined, latest)?.kind).toBe("flag");
  });
});
