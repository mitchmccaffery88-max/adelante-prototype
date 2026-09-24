// §Referrals Rework Phase 4c — tell the REFERRER when their referral moves.
//
// Same honest sender shape as the Phase 4a welcome text: validated payload,
// one real Twilio call through the Lovable connector, and a truthful
// `sent` / `not_configured` / `failed` result written back onto the referral.
// Nothing is ever stamped without an attempt.
//
// COPY CONSTRAINTS (deliberate, do not relax):
//   • The reader is an OUTSIDE party — a probation officer, a CBO worker.
//     Nothing clinical, no reason for a decline, no program-of-care detail.
//   • The referred person is identified by first name and last initial only.
//   • A real way to stop.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const REFERRER_UPDATE_EVENTS = ["received", "contacted", "enrolled", "declined"] as const;
export type ReferrerUpdateEvent = (typeof REFERRER_UPDATE_EVENTS)[number];

const UpdateSchema = z.object({
  to: z.string().min(3).max(40),
  event: z.enum(REFERRER_UPDATE_EVENTS),
  personLabel: z.string().min(1).max(80),
});

export function composeReferrerUpdate(input: {
  event: ReferrerUpdateEvent;
  personLabel: string;
}): string {
  const who = input.personLabel;
  const tail = " Reply STOP to stop these texts.";
  const body =
    input.event === "received"
      ? `Adelante received your referral for ${who}. Our team will reach out to this person, and we'll text you status updates.`
      : input.event === "contacted"
      ? `Adelante has made contact with the person you referred (${who}). No action is needed from you.`
      : input.event === "enrolled"
        ? `Update from Adelante: the person you referred (${who}) is now enrolled with us.`
        : `Update from Adelante: we've closed the referral for ${who}. We followed up with this person. You're welcome to contact us if you'd like to refer again.`;
  return (body + tail).slice(0, 320);
}

/** First name + last initial — never a full name in an outbound message. */
export function referredPersonLabel(firstName: string, lastName: string): string {
  const initial = lastName.trim().charAt(0);
  return initial ? `${firstName.trim()} ${initial.toUpperCase()}.` : firstName.trim();
}

export const sendReferrerUpdate = createServerFn({ method: "POST" })
  .inputValidator(UpdateSchema)
  .handler(async ({ data }) => {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const twilioKey = process.env["TWILIO_API_KEY"];
    const from = process.env["TWILIO_FROM_NUMBER"];
    if (!lovableKey || !twilioKey || !from) {
      return {
        status: "not_configured" as const,
        detail: "Twilio connection and/or TWILIO_FROM_NUMBER are not configured.",
      };
    }

    const res = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": twilioKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: data.to,
        From: from,
        Body: composeReferrerUpdate(data),
      }),
    });
    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      console.error(`Referrer update failed [${res.status}]: ${errorBody.slice(0, 400)}`);
      return { status: "failed" as const, detail: `${res.status}: ${errorBody.slice(0, 200)}` };
    }
    return { status: "sent" as const, detail: `Sent to ${data.to}.` };
  });
