// §Adel Build 1 — real streaming LLM endpoint.
//
// A raw HTTP server route (not a server fn) because the browser needs a real
// SSE stream back. The Lovable AI Gateway is called server-side only; the key
// is read INSIDE the handler (Workers bind env per request).
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const BodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(40),
  system: z.string().min(1).max(20000),
});

export const Route = createFileRoute("/api/adel-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return Response.json({ error: "Adel is not configured yet." }, { status: 503 });
        }

        let parsed;
        try {
          parsed = BodySchema.parse(await request.json());
        } catch {
          return Response.json({ error: "Bad request." }, { status: 400 });
        }

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            stream: true,
            messages: [{ role: "system", content: parsed.system }, ...parsed.messages],
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const detail = await upstream.text().catch(() => "");
          console.error("Adel gateway error", upstream.status, detail.slice(0, 500));
          const message =
            upstream.status === 429
              ? "Adel is busy right now. Try again in a moment."
              : upstream.status === 402
                ? "Adel is unavailable right now."
                : "Adel could not answer just now.";
          return Response.json({ error: message }, { status: upstream.status });
        }

        return new Response(upstream.body, {
          headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-store",
            connection: "keep-alive",
          },
        });
      },
    },
  },
});
