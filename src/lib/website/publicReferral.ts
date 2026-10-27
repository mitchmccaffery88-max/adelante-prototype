import { AdelanteEHR } from "../ehr";
import type { ChartActor } from "../chartActions";
import { signupActor } from "./signupStore";
import { canPerformReferralAction } from "../referralActions";
import { detectCrisisLanguage } from "../crisisTextDetection";
import { recordAutomatedSafetyFlag } from "../intakeTriage";

/** Identity/contact/structured keys are not free text; everything else typed into the form is scanned. */
const NOT_FREE_TEXT = new Set(["firstName", "lastName", "dob", "phone", "email", "channel", "referrerPhone", "referrerEmail", "referrerType", "zip", "county"]);
/** 26 Oct evening (Mitch): public referral free text through the existing crisis patterns; pattern ids only. */
export function scanReferralFreeText(referralId: string, input: Record<string, unknown>): boolean {
  const hits = Object.entries(input).filter(([k, v]) => typeof v === "string" && !NOT_FREE_TEXT.has(k)).map(([k, v]) => ({ k, ids: detectCrisisLanguage(v as string).patternIds })).filter((h) => h.ids.length);
  if (!hits.length) return false;
  recordAutomatedSafetyFlag("referral", referralId, hits.map((h) => h.k).join(","), [...new Set(hits.flatMap((h) => h.ids))]);
  return true;
}

export function canSubmitReferral(actor: ChartActor): boolean {
  return actor.role === signupActor.role && !actor.staffId || !!actor.staffId && (actor.role === "clinical_coordinator" || canPerformReferralAction(actor.role, "contact"));
}
export const REFERRAL_SUBMIT_DENIED = "You can't send referrals from this role.";
/** Shared public/staff submission; existing store owns validation and delivery state. */
export function submitWebsiteReferral(actor: ChartActor, input: Parameters<typeof AdelanteEHR.createReferral>[0]) {
  if (!canSubmitReferral(actor)) throw new Error(REFERRAL_SUBMIT_DENIED);
  const referral = AdelanteEHR.createReferral({...input, channel: actor.staffId ? "staff" : "public", staffSubmitActor: actor.staffId ? actor : undefined});
  // Never blocks the referral; a match routes to clinical triage and the screen shows 988.
  const safety = actor.staffId ? false : scanReferralFreeText(referral.id, input as unknown as Record<string, unknown>);
  return safety ? { ...referral, safetyFlagged: true as const } : referral;
}