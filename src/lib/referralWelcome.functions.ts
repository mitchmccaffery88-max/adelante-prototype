// §Referrals Rework Phase 4a — real welcome text for an inbound referral.
//
// THE BUG THIS FIXES: submitting a referral used to stamp the record with
// "welcome SMS sent" and render a green tick, while nothing was ever sent,
// queued or attempted. This is the same honest sender the advocate invitation
// uses — validated payload, one real Twilio call through the Lovable
// connector, and a truthful `sent` / `not_configured` / `failed` result that
// the caller writes back onto the referral.
//
// COPY CONSTRAINTS (deliberate, do not relax):
//   • The recipient did NOT initiate contact — a third party named them. The
//     message must therefore say who referred them and from where.
//   • Nothing clinical, no diagnosis, no program-of-care implication beyond
//     "community health program".
//   • A real way out, in the first message.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const WelcomeSchema = z.object({
  to: z.string().min(3).max(40),
  firstName: z.string().min(1).max(80),
  referrerName: z.string().min(1).max(120),
  referringAgency: z.string().min(1).max(160),
});

export function composeReferralWelcome(input: {
  firstName: string;
  referrerName: string;
  referringAgency: string;
}): string {
  return (
    `Hi ${input.firstName} — ${input.referrerName} at ${input.referringAgency} ` +
    `asked Adelante to reach out to you. We're a community health program and ` +
    `someone will call you soon. Reply STOP to stop these texts.`
  ).slice(0, 320);
}

export const sendReferralWelcome = createServerFn({ method: "POST" })
  .inputValidator(WelcomeSchema)
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
        Body: composeReferralWelcome(data),
      }),
    });
    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      console.error(`Referral welcome failed [${res.status}]: ${errorBody.slice(0, 400)}`);
      return { status: "failed" as const, detail: `${res.status}: ${errorBody.slice(0, 200)}` };
    }
    return { status: "sent" as const, detail: `Sent to ${data.to}.` };
  });
