import { AdelanteEHR } from "../ehr";
import type { ChartActor } from "../chartActions";
import { signupActor } from "./signupStore";
import { canPerformReferralAction } from "../referralActions";

export function canSubmitReferral(actor: ChartActor): boolean {
  return actor.role === signupActor.role && !actor.staffId || !!actor.staffId && canPerformReferralAction(actor.role, "contact");
}
/** Shared public/staff submission; existing store owns validation and delivery state. */
export function submitWebsiteReferral(actor: ChartActor, input: Parameters<typeof AdelanteEHR.createReferral>[0]) {
  if (!canSubmitReferral(actor)) throw new Error("Referral submission is not available for this actor.");
  return AdelanteEHR.createReferral({...input, channel: actor.staffId ? "staff" : "public"});
}