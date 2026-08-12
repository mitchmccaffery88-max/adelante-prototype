// §Weekly recap — the REAL one-off Adel reflection call.
//
// Deliberately NOT the live chat surface: no history, no ACTION tokens, no
// crisis path (this is a summary of numbers the member already sees, never a
// message they wrote). Same real Lovable AI Gateway and same model as
// /api/adel-chat, called once, non-streaming, for one short paragraph.
//
// ANTI-FABRICATION: the body carries NUMBERS ONLY. The prompt is rebuilt here
// from those numbers via `buildWeeklyReflectionPrompt`, so no caller-supplied
// free text ever reaches the model, and the model is told the facts it has are
// the only facts that exist.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { buildWeeklyReflectionPrompt, type WeeklyRecapStats } from "@/lib/weeklyRecap";

const count = z.number().int().min(0).max(10000);

const BodySchema = z.object({
  weekStartKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weekEndKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkInDays: z.number().int().min(0).max(7),
  windowDays: z.literal(7),
  medication: z
    .object({ scheduled: count, selfMarkedTaken: count, unmarked: count })
    .optional(),
  learning: z.object({
    lessonsCompletedTotal: count,
    recoveryLessonsCompletedTotal: count,
    exercisesCompletedTotal: count,
    activeThisWeek: z.boolean(),
    weeklyCountsAvailable: z.literal(false),
  }),
});

export const Route = createFileRoute("/api/adel-recap")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return Response.json({ error: "not_configured" }, { status: 503 });
        }

        let stats: WeeklyRecapStats;
        try {
          stats = BodySchema.parse(await request.json()) as WeeklyRecapStats;
        } catch {
          return Response.json({ error: "bad_request" }, { status: 400 });
        }

        let upstream: Response;
        try {
          upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: buildWeeklyReflectionPrompt(stats) },
                { role: "user", content: "Write this week's reflection." },
              ],
            }),
          });
        } catch (err) {
          console.error("Adel recap gateway unreachable", err);
          return Response.json({ error: "unavailable" }, { status: 502 });
        }

        if (!upstream.ok) {
          const detail = await upstream.text().catch(() => "");
          console.error("Adel recap gateway error", upstream.status, detail.slice(0, 500));
          return Response.json(
            { error: upstream.status === 429 ? "busy" : "unavailable" },
            { status: upstream.status },
          );
        }

        const json = (await upstream.json().catch(() => null)) as
          | { choices?: { message?: { content?: string } }[] }
          | null;
        const reflection = json?.choices?.[0]?.message?.content?.trim();
        if (!reflection) {
          return Response.json({ error: "unavailable" }, { status: 502 });
        }
        // Never render an ACTION line here — this surface has no buttons.
        const body = reflection
          .split("\n")
          .filter((l) => !/^\s*ACTION:/i.test(l))
          .join("\n")
          .trim();
        return Response.json({ reflection: body });
      },
    },
  },
});
