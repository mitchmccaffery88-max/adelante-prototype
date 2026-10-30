// §R5 (30 Oct, Mitch) — screener completeness. Draft — pending clinical
// sign-off (Christi, Dr. Bagga).
//
// Two different "no answer" cases:
//  • NOT ASKED — the instrument's own skip logic hid the item (PC-PTSD-5 after
//    "No" on the trauma item, C-SSRS gated items). Recorded as not asked and
//    scored exactly as the instrument's published rule says.
//  • UNANSWERED — the item was shown and the member left it blank. Stored as
//    null, never 0. One unanswered shown item makes the screener incomplete:
//    no total, no severity band, no prorating (prorating is a clinical
//    decision pending Christi).
// Pure leaf module: imports only screener definitions.
import { itemVisible, scoreScreener, severityFor, type ScreenerDef } from "./screeners";

export const SCREENER_COMPLETENESS_DRAFT_LABEL = "Draft — pending clinical sign-off";
/** Neutral clinician task text for a shown, unanswered PHQ-9 item 9. */
export const ITEM9_UNANSWERED_TASK_TITLE = "Screening follow-up needed";
export const ITEM9_UNANSWERED_TASK_DETAIL =
  "PHQ-9 item 9 (thoughts of self-harm) not answered: ask directly at next contact; if positive, complete the C-SSRS screener. Draft — pending clinical sign-off.";
export const NOT_ANSWERED_LABEL = "Not answered";
export const NOT_ASKED_LABEL = "Not asked";
export const LEGACY_MAY_INCLUDE_UNANSWERED = "may include unanswered items";
export const MEMBER_SKIPPED_LINE = {
  en: "You skipped some questions. That's okay — your care team may ask about them.",
  es: "Saltaste algunas preguntas. Está bien — tu equipo de atención puede preguntarte sobre ellas.",
};

/** Draft — pending clinical sign-off: -2 is explicit decline, never a score. */
export const DECLINED_ANSWER = -2;
export type ScreenerAnswer = number | null | undefined;

export interface CompletenessAssessment {
  complete: boolean;
  /** Items the member was shown (instrument skip logic applied). */
  shownCount: number;
  answeredCount: number;
  /** Shown and left blank. */
  unansweredItems: number[];
  /** Hidden by the instrument's own skip logic. */
  notAskedItems: number[];
  declinedItems: number[];
  skippedItems: number[];
  /** Stored responses: answered values, null for unanswered AND not-asked items. */
  responses: (number | null)[];
  /**
   * Full-length answers for scoring a COMPLETE screener: not-asked items take
   * the instrument's published value (0 for every gate in use today).
   * Undefined when incomplete — an incomplete screener is never scored.
   */
  scoringAnswers?: number[];
}

const answered = (v: ScreenerAnswer): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

export function assessCompleteness(def: ScreenerDef, raw: readonly ScreenerAnswer[]): CompletenessAssessment {
  const vis = def.questions.map((_, i) => i);
  const asUndef = raw.map((v) => (answered(v) ? v : undefined));
  const notAskedItems = vis.filter((i) => !itemVisible(def, i, asUndef));
  const shown = vis.filter((i) => !notAskedItems.includes(i));
  const unansweredItems = shown.filter((i) => !answered(raw[i]));
  const responses = vis.map((i) => (answered(raw[i]) && !notAskedItems.includes(i) ? (raw[i] as number) : null));
  const complete = unansweredItems.length === 0;
  return {
    complete,
    shownCount: shown.length,
    answeredCount: shown.length - unansweredItems.length,
    unansweredItems,
    notAskedItems,
    declinedItems: unansweredItems.filter((i) => raw[i] === DECLINED_ANSWER),
    skippedItems: unansweredItems.filter((i) => raw[i] !== DECLINED_ANSWER),
    responses,
    ...(complete ? { scoringAnswers: responses.map((v) => v ?? 0) } : {}),
  };
}

/** "7 of 9 answered". */
export function answeredLabel(r: { answeredCount: number; shownCount: number }): string {
  return `${r.answeredCount} of ${r.shownCount} answered`;
}

/** PHQ-9 item 9 (index 8) was shown and left blank. */
export function phq9Item9Unanswered(key: string, a: Pick<CompletenessAssessment, "unansweredItems">): boolean {
  return key === "phq-9" && a.unansweredItems.includes(8);
}

/** The unchanged crisis rule: any ANSWERED item 9 above 0. */
export function phq9Item9Positive(key: string, raw: readonly ScreenerAnswer[]): boolean {
  const v = raw[8];
  return key === "phq-9" && answered(v) && v > 0;
}

/** Staff display for one item on a stored result. */
export function itemDisplay(
  r: { responses?: readonly (number | null)[]; notAskedItems?: number[]; unansweredItems?: number[]; declinedItems?: number[] },
  index: number,
): string {
  if (r.notAskedItems?.includes(index)) return NOT_ASKED_LABEL;
  if (r.declinedItems?.includes(index)) return "Declined";
  const v = r.responses?.[index];
  if (r.unansweredItems?.includes(index) || v === null || v === undefined) return NOT_ANSWERED_LABEL;
  if (v === -1) return NOT_ASKED_LABEL; // C-SSRS gated sentinel on older records
  return String(v);
}

/**
 * Results recorded before this fix carry no completeness stamp; their zeros
 * may be coerced blanks and cannot be told apart. Staff view marks them.
 */
export function mayIncludeUnanswered(r: { completeness?: string } | undefined): boolean {
  return !!r && r.completeness === undefined;
}

/** Draft — pending clinical sign-off: estimate TOTAL only, never an item answer. */
export function scoreAnsweredScreener(def: ScreenerDef, raw: readonly ScreenerAnswer[]) {
  const assessment = assessCompleteness(def, raw);
  if (assessment.scoringAnswers) return { assessment, scored: scoreScreener(def, assessment.scoringAnswers), estimated: false };
  const missing = assessment.unansweredItems.length;
  const eligible = (def.key === "phq-9" && assessment.shownCount === 9 && missing >= 1 && missing <= 2) ||
    (def.key === "gad-7" && assessment.shownCount === 7 && missing === 1);
  if (!eligible) return { assessment, scored: undefined, estimated: false };
  const sum = assessment.responses.reduce<number>((n, v) => n + (v ?? 0), 0);
  const score = Math.round(sum / assessment.answeredCount * assessment.shownCount);
  return { assessment, scored: { score, severity: severityFor(def, score) }, estimated: true };
}

export function estimateLabel(r: { estimated?: boolean; missingItems?: number[] }): string {
  return r.estimated ? `Estimated (${r.missingItems?.length ?? 0} items missing)` : "";
}

/** Unsupported readers/exports fail closed; estimates require explicit opt-in. */
export function acceptsScreenerScore(r: { estimated?: boolean }, supportsEstimates = false): boolean {
  return !r.estimated || supportsEstimates;
}

/** Staff must explicitly answer OR record a decline for every shown item. */
export function staffItemsRecorded(def: ScreenerDef, raw: readonly ScreenerAnswer[]): boolean {
  const a = assessCompleteness(def, raw);
  return a.skippedItems.length === 0;
}

export const ITEM9_REPROMPT = {
  en: "This question helps us make sure you're safe. You can answer or skip.",
  es: "Esta pregunta nos ayuda a asegurarnos de que estás a salvo. Puedes responder o saltarla.",
};
