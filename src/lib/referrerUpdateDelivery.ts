// §Referrals Rework Phase 4c — browser-side dispatch of a referrer update.
// Privacy P3 — every update first passes the referrer policy. Held updates
// are recorded with their reason and nothing is sent; sent updates write a
// disclosure-log entry and an audit event. No patient name in any text.
import { AdelanteEHR, type Referral } from "./ehr";
import { sendReferrerUpdate, type ReferrerUpdateEvent } from "./referrerUpdate.functions";
import { logSentReferrerUpdate, referrerDecisionFor } from "./referrerUpdateGate";
import { recordHeldReferrerUpdate } from "./referrerAuthorizationStore";

export async function deliverReferrerUpdate(
  given: Referral,
  event: ReferrerUpdateEvent,
): Promise<"sent" | "not_configured" | "failed" | "no_phone" | "held"> {
  // Read the current record (enrollment date, authorization) — not a stale copy.
  const referral = AdelanteEHR.listReferrals().find((r) => r.id === given.id) ?? given;
  const decision = referrerDecisionFor(referral, event);
  if (!decision.send) {
    recordHeldReferrerUpdate(referral.id, event, decision.held);
    return "held";
  }
  const to = referral.referrerPhone?.trim();
  if (!to) return "no_phone";
  try {
    const enrolledOn = decision.message === "enrolled" ? referral.enrolledAt?.slice(0, 10) : undefined;
    const res = await sendReferrerUpdate({
      data: { to, message: decision.message, ...(enrolledOn ? { enrolledOn } : {}) },
    });
    AdelanteEHR.recordReferrerUpdateDelivery(referral.id, {
      event,
      status: res.status,
      ...(res.detail ? { detail: res.detail } : {}),
    });
    if (res.status === "sent") logSentReferrerUpdate(referral, event, decision);
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
