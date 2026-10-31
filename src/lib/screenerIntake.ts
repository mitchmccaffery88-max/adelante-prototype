// R5 follow-ups (30 Oct). Draft — pending clinical sign-off.
// One writer for intake and rescreen; never imputes an individual answer.
import { AdelanteEHR, type ScreenerResult, type IncompleteScreener } from "./ehr";
import { enqueueItem9Followup } from "./screenerWriteBoundary";
import { type ScreenerDef } from "./screeners";
import { scoreAnsweredScreener, phq9Item9Positive, phq9Item9Unanswered, type ScreenerAnswer } from "./screenerCompleteness";
import { registerMemberScreenerWriter } from "./screenerWriteBoundary";

export function recordMemberScreenerAnswers(patientId: string, def: ScreenerDef, raw: readonly ScreenerAnswer[],
  metadata: { timepoint: ScreenerResult["timepoint"]; context: ScreenerResult["context"] },
): ScreenerResult | IncompleteScreener {
  const { assessment: c, scored, estimated } = scoreAnsweredScreener(def, raw);
  const completedAt = new Date().toISOString();
  const evidence = { responses: c.responses, unansweredItems: c.unansweredItems, notAskedItems: c.notAskedItems,
    declinedItems: c.declinedItems, skippedItems: c.skippedItems };
  let result: ScreenerResult | IncompleteScreener;
  if (scored) {
    const stored: ScreenerResult = { key: def.key, ...scored, ...metadata, ...evidence, completedAt,
      completeness: estimated ? "estimated" : "complete", estimated,
      ...(estimated ? { missingItems: c.unansweredItems } : {}),
      crisisFlag: phq9Item9Positive(def.key, raw) };
    result = stored;
    AdelanteEHR.recordScreener(patientId, stored);
  } else {
    result = { key: def.key, status: "incomplete", ...metadata, ...evidence, completedAt,
      shownCount: c.shownCount, answeredCount: c.answeredCount };
    AdelanteEHR.recordIncompleteScreener(patientId, result);
  }
  if (phq9Item9Unanswered(def.key, c)) {
    enqueueItem9Followup({ patientId, completedAt });
  }
  return result;
}
export function recordIntakeScreenerAnswers(patientId: string, def: ScreenerDef, raw: readonly ScreenerAnswer[]): { complete: boolean } {
  const result = recordMemberScreenerAnswers(patientId, def, raw, { timepoint: "intake", context: "intake" });
  return { complete: !("status" in result) && !result.estimated };
}
registerMemberScreenerWriter(recordMemberScreenerAnswers);
