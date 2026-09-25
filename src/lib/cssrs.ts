// §Phase 10b — Columbia Suicide Severity Rating Scale (C-SSRS), Screener.
//
// CONTENT RULE: the official Columbia wording is NOT written here from memory.
// Every item text below is a PLACEHOLDER SLOT. Clinical staff must supply the
// exact published English text (and Columbia's official Spanish version) and
// confirm it; until `CSSRS_TEXT_APPROVED` is true the form can only be used in
// the demo build, with a visible placeholder banner, and results are flagged
// `placeholderText` and excluded from reporting totals.
//
// STRUCTURE (item count, yes/no answers, skip rules) follows the Screener
// version's published layout: items 1–2 always; items 3–5 only when item 2 is
// "yes"; item 6 (behavior) always. Risk mapping and response protocol are
// DRAFT settings pending clinical sign-off.

import { DRAFT_LABEL, type ScreenerDef } from "./screeners";

export const CSSRS_KEY = "c-ssrs-screener";

/** Flip only after clinical staff paste and approve the official text. */
export const CSSRS_TEXT_APPROVED = false;
/** This wireframe is a demo build; placeholder use is allowed here only. */
export const IS_DEMO_BUILD = true;

export const CSSRS_PLACEHOLDER_BANNER =
  "Placeholder item text — awaiting official Columbia wording, to be supplied and confirmed by clinical staff. Demo use only.";

function slot(n: number, topic: string) {
  return `[C-SSRS item ${n} — ${topic}. Awaiting official Columbia text]`;
}

/** Topic labels are structural descriptions, not the instrument's wording. */
export const CSSRS_ITEMS: { n: number; topic: string; en: string; es: string }[] = [
  { n: 1, topic: "wish to be dead (past month)", en: slot(1, "wish to be dead"), es: "[Pendiente: texto oficial de Columbia en español]" },
  { n: 2, topic: "non-specific active suicidal thoughts (past month)", en: slot(2, "suicidal thoughts"), es: "[Pendiente: texto oficial de Columbia en español]" },
  { n: 3, topic: "thoughts with method, no intent (past month)", en: slot(3, "method"), es: "[Pendiente: texto oficial de Columbia en español]" },
  { n: 4, topic: "intent, without specific plan (past month)", en: slot(4, "intent"), es: "[Pendiente: texto oficial de Columbia en español]" },
  { n: 5, topic: "intent with specific plan (past month)", en: slot(5, "plan"), es: "[Pendiente: texto oficial de Columbia en español]" },
  { n: 6, topic: "suicidal behavior (lifetime / past 3 months)", en: slot(6, "behavior"), es: "[Pendiente: texto oficial de Columbia en español]" },
];

/** Answers: 1 = yes, 0 = no, undefined = not asked (skipped). */
export type CssrsAnswers = (0 | 1 | undefined)[];

export function cssrsItemAsked(index: number, answers: CssrsAnswers): boolean {
  if (index >= 2 && index <= 4) return answers[1] === 1;
  return true;
}

export function cssrsComplete(answers: CssrsAnswers): boolean {
  return CSSRS_ITEMS.every((_, i) => !cssrsItemAsked(i, answers) || answers[i] === 0 || answers[i] === 1);
}

export type CssrsRisk = "none" | "low" | "moderate" | "high";
export const CSSRS_RISK_ORDER: CssrsRisk[] = ["none", "low", "moderate", "high"];

/**
 * DRAFT risk mapping (pending clinical sign-off):
 *   high     — item 4 or 5 yes, or item 6 yes
 *   moderate — item 3 yes
 *   low      — item 1 or 2 yes only
 *   none     — all no
 */
export function cssrsRisk(answers: CssrsAnswers): CssrsRisk {
  if (answers[3] === 1 || answers[4] === 1 || answers[5] === 1) return "high";
  if (answers[2] === 1) return "moderate";
  if (answers[0] === 1 || answers[1] === 1) return "low";
  return "none";
}

export function maxRisk(a: CssrsRisk, b: CssrsRisk): CssrsRisk {
  return CSSRS_RISK_ORDER.indexOf(a) >= CSSRS_RISK_ORDER.indexOf(b) ? a : b;
}

export const CSSRS_RISK_LABEL: Record<CssrsRisk, string> = {
  none: "No risk identified",
  low: "Low risk (draft)",
  moderate: "Moderate risk (draft)",
  high: "High risk (draft)",
};

/** DRAFT response protocol per risk level — pending clinical sign-off. */
export const CSSRS_RESPONSE_PROTOCOL: Record<CssrsRisk, string> = {
  none: "Document result. No additional action beyond routine care.",
  low: "Review safety plan with the patient; clinician follow-up within 72 hours.",
  moderate: "Same-day clinician contact; update safety plan; consider crisis-line warm handoff.",
  high: "Immediate clinician contact; follow crisis protocol; do not leave the person without a safety plan; 988 / emergency services as indicated.",
};
export const CSSRS_PROTOCOL_STATUS = DRAFT_LABEL;

/** A ScreenerDef-shaped descriptor so chart, reporting and labels treat it like any instrument. */
export const CSSRS_DEF: ScreenerDef = {
  key: CSSRS_KEY,
  name: "C-SSRS Screener",
  description: "Suicide risk screen — triggered only (PHQ-9 item 9 or crisis text). Placeholder item text.",
  questions: CSSRS_ITEMS.map((i) => i.en),
  options: [
    { label: "No", value: 0 },
    { label: "Yes", value: 1 },
  ],
  bands: [
    { max: 0, label: CSSRS_RISK_LABEL.none },
    { max: 1, label: CSSRS_RISK_LABEL.low },
    { max: 2, label: CSSRS_RISK_LABEL.moderate },
    { max: 3, label: CSSRS_RISK_LABEL.high },
  ],
  source: "Columbia Lighthouse Project — C-SSRS Screener (official text to be supplied by clinical staff).",
  version: "C-SSRS Screener (version pending clinical decision)",
  scoringVersion: "risk-map-draft-v1",
  textVerified: false,
  atIntake: false,
};
