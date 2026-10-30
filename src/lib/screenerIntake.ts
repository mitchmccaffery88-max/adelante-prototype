// §R5 (30 Oct, Draft — pending clinical sign-off) — the intake screener write.
// A shown item left blank stays blank (null), never 0; instrument-skipped
// items are "not asked" and scored per the instrument; an incomplete screener
// gets no total and no band. A blank PHQ-9 item 9 creates the neutral
// follow-up task through the registry; an ANSWERED item 9 > 0 still trips the
// unchanged crisis rule.
import { AdelanteEHR } from "./ehr";
import { runAction } from "./actions/runAction";
import { scoreScreener, type ScreenerDef } from "./screeners";
import { assessCompleteness, phq9Item9Positive, phq9Item9Unanswered, type ScreenerAnswer } from "./screenerCompleteness";
import { screenerFollowupActor } from "./screenerFollowup";

export function recordIntakeScreenerAnswers(
  patientId: string,
  def: ScreenerDef,
  raw: readonly ScreenerAnswer[],
): { complete: boolean } {
  const c = assessCompleteness(def, raw);
  const completedAt = new Date().toISOString();
  if (!c.complete) {
    AdelanteEHR.recordIncompleteScreener(patientId, {
      key: def.key,
      status: "incomplete",
      completedAt,
      timepoint: "intake",
      context: "intake",
      shownCount: c.shownCount,
      answeredCount: c.answeredCount,
      responses: c.responses,
      unansweredItems: c.unansweredItems,
      notAskedItems: c.notAskedItems,
    });
    if (phq9Item9Unanswered(def.key, c)) {
      runAction("screener_item9_followup", screenerFollowupActor, AdelanteEHR.getPatient(patientId), {
        args: [{ patientId, completedAt }],
      });
    }
    return { complete: false };
  }
  const ans = c.scoringAnswers!;
  const scored = scoreScreener(def, ans);
  AdelanteEHR.recordScreener(patientId, {
    key: def.key,
    score: scored.score,
    severity: scored.severity,
    completedAt,
    timepoint: "intake",
    crisisFlag: phq9Item9Positive(def.key, raw),
    responses: ans,
    ...(c.notAskedItems.length ? { notAskedItems: c.notAskedItems } : {}),
    context: "intake",
    ...(scored.positive !== undefined ? { positive: scored.positive } : {}),
    ...(scored.domains ? { domains: scored.domains } : {}),
  });
  return { complete: true };
}
