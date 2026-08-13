// §Advocate build 1 — real invitation delivery.
//
// Thin wrapper only: everything runtime lives inside the handler. Reuses the
// SAME Twilio-through-the-Lovable-connector path the crisis alerts use — no
// second SMS client, and the same honest `not_configured` fallback when the
// connection or numbers are missing.
//
// UNLIKE the staff alert, the destination here is the ADVOCATE's own contact,
// supplied by the inviter. That is the whole point of the mechanism: the code
// goes directly to the advocate and is never relayed through the patient.
//
// Email has no transport yet, so an email invitation honestly reports
// `not_configured` rather than pretending to have sent something.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InviteSchema = z.object({
  channel: z.enum(["email", "sms"]),
  to: z.string().min(3).max(200),
  advocateName: z.string().min(1).max(120),
  code: z.string().min(4).max(40),
  claimLink: z.string().min(1).max(400),
});

export const sendAdvocateInvite = createServerFn({ method: "POST" })
  .inputValidator(InviteSchema)
  .handler(async ({ data }) => {
    const body =
      `${data.advocateName}: you've been named as an advocate. ` +
      `Open ${data.claimLink} and use code ${data.code} to connect. ` +
      `This invitation is only valid for 14 days after you receive it.`;

    if (data.channel === "email") {
      return {
        status: "not_configured" as const,
        detail: "No email transport is connected yet; nothing was sent.",
      };
    }

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
      body: new URLSearchParams({ To: data.to, From: from, Body: body.slice(0, 320) }),
    });
    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      console.error(`Advocate invite failed [${res.status}]: ${errorBody.slice(0, 400)}`);
      return { status: "failed" as const, detail: `${res.status}: ${errorBody.slice(0, 200)}` };
    }
    return { status: "sent" as const, detail: `Sent to ${data.to}.` };
  });
