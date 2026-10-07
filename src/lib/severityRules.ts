// §C3 — Re-screen severity flag RULES (pure; no store import so ehr.ts can
// call it inside recordScreener). Every threshold lives in SEVERITY_RULES.
// Draft — pending clinical sign-off. PHQ-9 item 9 and C-SSRS keep routing
// through the existing crisis path; these flags are an ADDITIONAL review item.
import type { ScreenerResult } from "./ehr";

export const SEVERITY_DRAFT_LABEL = "Draft — pending clinical sign-off";

/** One config. Draft — pending clinical sign-off. */
export const SEVERITY_RULES = {
  /** Instruments the rise / band / improving rules apply to. */
  scored: ["phq-9", "gad-7"] as const,
  /** Rise of this many points or more vs the previous result → flag. */
  risePoints: 5,
  /** Drop of this many points or more → positive "improving" note (no task). */
  improvePoints: 5,
  /** Lowest score of the moderately-severe / severe band, per instrument. */
  bandFloor: { "phq-9": 15, "gad-7": 15 } as Record<string, number>,
  bandLabel: { "phq-9": "moderately severe or severe", "gad-7": "severe" } as Record<string, string>,
  /** PHQ-9 item 9 (0-based index 8) above this → flag. */
  item9Above: 0,
  /** C-SSRS key and the risk levels that flag when moved INTO from a lower level. */
  cssrsKey: "c-ssrs-screener",
  cssrsFlagLevels: ["moderate", "high"] as const,
} as const;

export type SeverityReason = "rise" | "band" | "item9" | "cssrs";
export interface SeverityFlag {
  id: string;
  /** `${key}@${completedAt}` — one flag (or note) per result, ever. */
  resultRef: string;
  key: string;
  kind: "flag" | "improving";
  reasons: SeverityReason[];
  /** Neutral, staff-facing summary (instrument + numbers, never item answers). */
  text: string;
  fromScore?: number;
  toScore?: number;
  fromRisk?: string;
  toRisk?: string;
  resultAt: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

const RISK_ORDER = ["none", "low", "moderate", "high"];
const label = (key: string) => (key === SEVERITY_RULES.cssrsKey ? "C-SSRS" : key.toUpperCase());

/** Evaluate one new result against the previous result of the same instrument. */
export function evaluateSeverity(
  prev: ScreenerResult | undefined,
  cur: ScreenerResult,
): Omit<SeverityFlag, "id" | "createdAt"> | undefined {
  const resultRef = `${cur.key}@${cur.completedAt}`;
  const base = { resultRef, key: cur.key, resultAt: cur.completedAt };
  if (cur.key === SEVERITY_RULES.cssrsKey) {
    const to = cur.cssrsRisk;
    const from = prev?.cssrsRisk ?? "none";
    if (to && (SEVERITY_RULES.cssrsFlagLevels as readonly string[]).includes(to) && RISK_ORDER.indexOf(to) > RISK_ORDER.indexOf(from))
      return { ...base, kind: "flag", reasons: ["cssrs"], text: `C-SSRS moved to ${to} risk.`, fromRisk: from, toRisk: to };
    return undefined;
  }
  if (!(SEVERITY_RULES.scored as readonly string[]).includes(cur.key)) return undefined;
  const reasons: SeverityReason[] = [];
  const parts: string[] = [];
  const name = label(cur.key);
  const d = prev ? cur.score - prev.score : undefined;
  if (d !== undefined && d >= SEVERITY_RULES.risePoints) {
    reasons.push("rise");
    parts.push(`${name} rose ${d} points (${prev!.score} → ${cur.score})`);
  }
  const floor = SEVERITY_RULES.bandFloor[cur.key];
  if (floor !== undefined && cur.score >= floor && (!prev || prev.score < floor)) {
    reasons.push("band");
    parts.push(`${name} ${cur.score} — now in the ${SEVERITY_RULES.bandLabel[cur.key]} range`);
  }
  if (cur.key === "phq-9" && (cur.responses?.[8] ?? 0) > SEVERITY_RULES.item9Above) {
    reasons.push("item9");
    parts.push("PHQ-9 item 9 answered above 0");
  }
  if (reasons.length)
    return { ...base, kind: "flag", reasons, text: `${parts.join("; ")}.`, fromScore: prev?.score, toScore: cur.score };
  if (d !== undefined && -d >= SEVERITY_RULES.improvePoints)
    return { ...base, kind: "improving", reasons: [], text: `${name} improving (${prev!.score} → ${cur.score}).`, fromScore: prev!.score, toScore: cur.score };
  return undefined;
}
