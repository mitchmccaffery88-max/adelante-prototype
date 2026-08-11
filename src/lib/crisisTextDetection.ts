// §Adelante Journey Phase 1 — safety-critical crisis detection in free text.
//
// This is a SIGNAL SOURCE into the EXISTING crisis escalation system. It calls
// the same `AdelanteEHR.flagCrisis` the intake PHQ-9 trigger and the assisted
// sign-up button call — there is deliberately no second escalation, severity,
// routing, or queue path here. The only new thing is `triggerSource:
// "message_pattern"`, so an automated free-text catch stays distinguishable
// from `screener_score`, `assisted_signup` and clinician `manual` flags.
//
// ─────────────────────────────────────────────────────────────────────────────
// OPEN — CLINICAL REVIEW REQUIRED (Christi / Dr. Bagga):
// The pattern list below is a REASONABLE STARTING SET of direct crisis
// language, NOT a validated or finalized screen. Real coverage review
// (idiom, Spanish-language phrasing, negation/quotation handling, false
// positive tolerance) is an explicit clinical decision and is NOT made here.
// Do not silently widen this list without that review.
//
// EXPLICIT NON-GOAL (do not add here): pattern-based HISTORICAL-signal
// escalation — repeated heavy check-ins, screener trends over time, etc.
// Whether that should auto-escalate at all or stay member-consent-gated is an
// open policy question for Christi / Dr. Bagga, not a code decision.
// ─────────────────────────────────────────────────────────────────────────────
import { AdelanteEHR, type CrisisEscalation } from "@/lib/ehr";

/** Actor recorded on automated flags — never a real staff identity. */
export const CRISIS_TEXT_SCANNER = "Message scan (automated)";

export interface CrisisPattern {
  id: string;
  /** Matched case-insensitively against loosely-normalized text. */
  re: RegExp;
}

/** STARTING SET — see the clinical-review note above before changing. */
export const CRISIS_PATTERNS: CrisisPattern[] = [
  { id: "kill_myself", re: /\bkill(ing)?\s+(myself|my\s*self)\b/ },
  { id: "want_to_die", re: /\b(want|wanna|wish|hope)\w*\s+(to\s+)?(die|be\s+dead)\b/ },
  { id: "suicidal", re: /\bsuicid(e|al)\b/ },
  { id: "harm_myself", re: /\b(hurt|harm|cut)(ing)?\s+(myself|my\s*self)\b/ },
  { id: "end_my_life", re: /\bend(ing)?\s+(my|it)\s+(life|all)\b|\bend\s+it\s+all\b/ },
  { id: "not_worth_living", re: /\b(not|isn'?t|ain'?t)\s+worth\s+living\b/ },
  { id: "better_off_dead", re: /\bbetter\s+off\s+dead\b/ },
  { id: "no_reason_to_live", re: /\b(no|nothing)\s+(reason|point)\s+to\s+(live|go\s+on)\b/ },
  { id: "take_my_own_life", re: /\btak(e|ing)\s+my\s+own\s+life\b/ },
  { id: "overdose_intent", re: /\b(overdose|od)\s+on\s+purpose\b/ },
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[\u2019\u02bc]/g, "'").replace(/\s+/g, " ").trim();
}

export interface CrisisTextMatch {
  matched: boolean;
  /** Ids of every pattern that fired — the audit detail, not the raw text. */
  patternIds: string[];
}

/** Pure, side-effect free. Safe to call on every keystroke if ever needed. */
export function detectCrisisLanguage(text: string | undefined | null): CrisisTextMatch {
  const body = normalize(text ?? "");
  if (!body) return { matched: false, patternIds: [] };
  const patternIds = CRISIS_PATTERNS.filter((p) => p.re.test(body)).map((p) => p.id);
  return { matched: patternIds.length > 0, patternIds };
}

export interface CrisisScanOptions {
  /** Where the text came from, e.g. "care message" — goes into the reason. */
  surface: string;
  /**
   * When true (default) a second match is suppressed while an earlier
   * message_pattern escalation for this patient is still open, so one distress
   * conversation does not flood the queue with duplicate rows.
   */
  dedupeWhileOpen?: boolean;
}

/**
 * Scan free text and, on a match, raise a REAL crisis escalation through the
 * existing mechanism. Returns the escalation when one was created.
 *
 * WHERE TO WIRE THIS IN: call it immediately after a patient-authored free-text
 * value is committed (never on the draft), passing the patient id whose record
 * the text belongs to. It intentionally never blocks or alters the send —
 * the message is still delivered verbatim.
 */
export function scanTextForCrisis(
  patientId: string | undefined,
  text: string | undefined | null,
  opts: CrisisScanOptions,
): CrisisEscalation | undefined {
  if (!patientId) return undefined;
  const hit = detectCrisisLanguage(text);
  if (!hit.matched) return undefined;

  if (opts.dedupeWhileOpen !== false) {
    const alreadyOpen = AdelanteEHR.listCrisisEscalations(patientId, { status: "open" }).some(
      (r) => r.triggerSource === "message_pattern",
    );
    if (alreadyOpen) return undefined;
  }

  // The raw message body is deliberately NOT copied into the escalation reason:
  // the message itself already lives in the record (and may be Part 2 flagged).
  return AdelanteEHR.flagCrisis(
    patientId,
    CRISIS_TEXT_SCANNER,
    `Automated flag: crisis language detected in ${opts.surface} (patterns: ${hit.patternIds.join(", ")}). Unvalidated screen — clinician review required.`,
    { triggerSource: "message_pattern" },
  );
}