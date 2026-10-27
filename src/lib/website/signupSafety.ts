// 26 Oct evening (Mitch) — sign-up answers run through the existing crisis
// patterns after each command. A match never blocks account creation: it
// records a pre-chart safety source (pattern ids only), routes through the
// existing triage/flagCrisis path, and returns `safety: true` so the screen
// shows 988. Intake sees only "Needs clinical triage now".
import { detectCrisisLanguage } from "../crisisTextDetection";
import { linkAutomatedSignupSafety, recordAutomatedSafetyFlag } from "../intakeTriage";
import type { ChartActor } from "../chartActions";
import { runSignupCommand as runSignupCommandBase, signupFreeText, type SignupCommand, type SignupResult } from "./signupStore";

export type ScannedSignupResult = SignupResult & { safety?: boolean };

export function scanSignupSession(sessionId: string): boolean {
  const hits = signupFreeText(sessionId).map((f) => ({ field: f.field, ids: detectCrisisLanguage(f.text).patternIds })).filter((h) => h.ids.length);
  if (!hits.length) return false;
  recordAutomatedSafetyFlag("signup", sessionId, hits.map((h) => h.field).join(","), [...new Set(hits.flatMap((h) => h.ids))]);
  linkAutomatedSignupSafety(sessionId);
  return true;
}

export function runSignupCommand(actor: ChartActor, input: SignupCommand, now = Date.now()): ScannedSignupResult {
  const r = runSignupCommandBase(actor, input, now);
  const safety = scanSignupSession(r.sessionId);
  return safety ? { ...r, safety } : r;
}
