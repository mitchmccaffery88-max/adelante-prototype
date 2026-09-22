// §Referrals Rework Phase 4c — browser-side dispatch of a referrer update.
//
// Mirrors `advocateInviteDelivery.ts`: the store stays synchronous, the send
// is attempted from the caller, and the real outcome is written back. A
// referral with no referrer work phone on file is skipped honestly — nothing
// is logged as sent, and nothing pretends a message was queued.
import { AdelanteEHR, type Referral } from "./ehr";
import {
  referredPersonLabel,
  sendReferrerUpdate,
  type ReferrerUpdateEvent,
} from "./referrerUpdate.functions";

export async function deliverReferrerUpdate(
  referral: Referral,
  event: ReferrerUpdateEvent,
): Promise<"sent" | "not_configured" | "failed" | "no_phone"> {
  const to = referral.referrerPhone?.trim();
  if (!to) return "no_phone";
  try {
    const res = await sendReferrerUpdate({
      data: {
        to,
        event,
        personLabel: referredPersonLabel(referral.firstName, referral.lastName),
      },
    });
    AdelanteEHR.recordReferrerUpdateDelivery(referral.id, {
      event,
      status: res.status,
      ...(res.detail ? { detail: res.detail } : {}),
    });
    return res.status;
  } catch (e) {
    AdelanteEHR.recordReferrerUpdateDelivery(referral.id, {
      event,
      status: "failed",
      detail: e instanceof Error ? e.message : "Delivery failed.",
    });
    return "failed";
  }
}
