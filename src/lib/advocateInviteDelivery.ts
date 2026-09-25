// §Advocate build 1 — browser-side dispatch for an advocate invitation.
//
// Mirrors `staffAlertSms.ts`: the store records the outcome, the transport is
// fire-and-forget from the caller's point of view. The 14-day window only
// starts once the transport confirms a send — see
// `AdelanteEHR.recordAdvocateInvitationDelivery`.
import { AdelanteEHR, type AdvocateLink } from "./ehr";
import { sendAdvocateInvite } from "./advocateInvite.functions";

export function advocateInvitationConsentActive(patientId: string): boolean {
  return (
    AdelanteEHR.isConsentCategoryAuthorized(patientId, "roi_collateral") ||
    AdelanteEHR.isConsentCategoryAuthorized(patientId, "advocate_sud_disclosure")
  );
}

export async function deliverAdvocateInvitation(link: AdvocateLink): Promise<void> {
  const current = AdelanteEHR.getAdvocateLink(link.id);
  if (
    !current ||
    current.status !== "invited" ||
    current.notificationSentAt ||
    current.notificationDelivery?.status === "pending" ||
    !advocateInvitationConsentActive(current.patientId)
  ) {
    return;
  }
  AdelanteEHR.markAdvocateInvitationDeliveryPending(link.id);
  try {
    const res = await sendAdvocateInvite({
      data: {
        channel: link.invitationChannel,
        to: link.invitationSentTo,
        advocateName: link.advocateName,
        code: link.invitationCode,
        claimLink: link.claimLink ?? "/advocate",
      },
    });
    AdelanteEHR.recordAdvocateInvitationDelivery(link.id, {
      status: res.status,
      ...(res.detail ? { detail: res.detail } : {}),
    });
  } catch (e) {
    AdelanteEHR.recordAdvocateInvitationDelivery(link.id, {
      status: "failed",
      detail: e instanceof Error ? e.message : "Delivery failed.",
    });
  }
}

export async function deliverConsentedAdvocateInvitations(patientId: string): Promise<void> {
  if (!advocateInvitationConsentActive(patientId)) return;
  const pending = AdelanteEHR.listAdvocateLinks(patientId).filter(
    (link) =>
      link.status === "invited" &&
      !link.notificationSentAt &&
      link.notificationDelivery?.status !== "pending",
  );
  await Promise.all(pending.map((link) => deliverAdvocateInvitation(link)));
}
