// §Phase 6c — real SMS transport for patient group-access notifications.
// Same Twilio connector pattern and honest outcomes as `sendReferralWelcome`.
// The body is composed from fixed templates in `groupNotifications.ts`.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Schema = z.object({
  to: z.string().min(3).max(40),
  body: z.string().min(1).max(320),
});

export const sendGroupNotificationSms = createServerFn({ method: "POST" })
  .inputValidator(Schema)
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
      body: new URLSearchParams({ To: data.to, From: from, Body: data.body }),
    });
    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      console.error(`Group notification failed [${res.status}]: ${errorBody.slice(0, 400)}`);
      return { status: "failed" as const, detail: `${res.status}: ${errorBody.slice(0, 200)}` };
    }
    return { status: "sent" as const, detail: "Sent." };
  });
