// §Message-routing gap #1 — real SMS transport for staff alerts.
//
// Thin wrapper only: everything runtime lives inside the handler. Twilio is
// reached through the Lovable connector gateway (the same integration pattern
// the rest of this build uses for third-party calls) — no second SMS client.
//
// Destination numbers are configuration, not code: crisis alerts go to the
// on-call number configured in `CRISIS_ALERT_SMS_TO` (comma-separated), from
// `TWILIO_FROM_NUMBER`. Nothing is fabricated here; if the connection or the
// numbers are missing the call returns `not_configured` and the in-app
// notification remains the record of the event.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AlertSchema = z.object({
  kind: z.enum(["crisis_flagged", "anonymous_crisis", "unread_patient_message"]),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(400),
});

export const sendStaffAlertSms = createServerFn({ method: "POST" })
  .inputValidator(AlertSchema)
  .handler(async ({ data }) => {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const twilioKey = process.env["TWILIO_API_KEY"];
    const from = process.env["TWILIO_FROM_NUMBER"];
    const to = (process.env["CRISIS_ALERT_SMS_TO"] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!lovableKey || !twilioKey || !from || to.length === 0) {
      return {
        status: "not_configured" as const,
        detail:
          "Twilio connection and/or CRISIS_ALERT_SMS_TO / TWILIO_FROM_NUMBER are not configured.",
      };
    }

    const text = `${data.subject}\n${data.body}`.slice(0, 320);
    const failures: string[] = [];
    for (const number of to) {
      const res = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": twilioKey,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: number, From: from, Body: text }),
      });
      if (!res.ok) {
        const errorBody = await res.text().catch(() => "");
        console.error(`Twilio alert failed [${res.status}]: ${errorBody.slice(0, 400)}`);
        failures.push(`${res.status}: ${errorBody.slice(0, 200)}`);
      }
    }
    return failures.length
      ? { status: "failed" as const, detail: failures.join(" | ") }
      : { status: "sent" as const, detail: `Sent to ${to.length} number(s).` };
  });
